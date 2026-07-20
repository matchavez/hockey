# Cloudflare Worker — what it is, and how to rebuild it

Every live overlay in this repo runs entirely in a web browser (an OBS/vMix
browser source), and browsers can't fetch `admin.esportsdesk.com` directly —
the league's data host doesn't allow cross-origin requests from a random
web page. One small Cloudflare Worker sits in between, fetches the real
page server-side, and hands it back with the right headers. That's the
whole reason it exists.

Over time it picked up a second, unrelated job: it's also the always-on
relay that lets the Player Lower Thirds phone page and the Starting Lineup
control page talk to their on-air overlay in near-real-time.

**This is one Worker doing two jobs, not two Workers.**

- **Job 1 — CORS / no-cache scrape proxy.** `GET /?url=<encoded esportsdesk URL>`. Fetches the target server-side and returns it with CORS headers, so any overlay page's JavaScript can read and parse it. This is what section 4 of the main README calls "scraped by a Cloudflare agent."
- **Job 2 — Control channel.** `GET/POST /control/<team-slug>` (Player Lower Thirds fire/queue/clear) and `GET/POST /lineup/<team-slug>` (Starting Lineup's persistent six-player state). Backed by a Cloudflare **Durable Object** — one small isolated instance per team slug, so each club's state never collides with another's.

---

## Current live deployment

- **Name:** `blue-butterfly-aa69`
- **URL:** `https://blue-butterfly-aa69.matchavez.workers.dev`
- **Account:** Mat's Cloudflare account (`matchavez.workers.dev` subdomain)
- **Plan:** Workers Free is sufficient — the Durable Object here uses SQLite-backed storage, which works on both Free and Paid (confirmed against Cloudflare's docs when this was built; no upgrade was needed).
- **Source of truth:** `matchavez/nzihl-broadcast-assets`, folder `summary/` — `worker.js` (the code), `wrangler.toml` (deploy config), `DEPLOY.md` (step-by-step deploy notes this file draws from).

Deployed in two stages:
1. **2026-06-29** — the plain CORS proxy, pasted directly into the Cloudflare dashboard's "Edit code" box (no local tooling needed for this part alone).
2. **2026-07-12 / 2026-07-13** — the Durable Object control channel and the Starting Lineup routes were added on top. This required switching to `wrangler deploy`, because Durable Objects need a migration declared in `wrangler.toml`, which the dashboard's Quick Edit box can't do.

---

## Job 1 — the scrape proxy, in detail

Request contract:
```
GET https://blue-butterfly-aa69.matchavez.workers.dev/?url=<url-encoded target>
```

The Worker only forwards requests to a short **allowlist** of exact endpoints — this is intentionally narrow, not a general-purpose CORS bypass:

```
https://www.nzihl.com/...
https://www.nzwihl.com/...
https://admin.esportsdesk.com/leagues/hockey_boxscores.cfm?...
https://admin.esportsdesk.com/leagues/stats_1team.cfm?...
https://admin.esportsdesk.com/leagues/standings.cfm?...
https://admin.esportsdesk.com/leagues/schedules.cfm?...
https://admin.esportsdesk.com/leagues/stats_hockey.cfm?...
```

Anything outside that list gets `403 forbidden`. The upstream fetch has a 10-second timeout (added 2026-07-20) so a hung request fails fast instead of tying up the Worker indefinitely; it also always sets `cf:{cacheTtl:0,cacheEverything:false}` and `Cache-Control: no-store` so every read is genuinely live, never a cached copy.

**Why `admin.esportsdesk.com` and not `www.nzihl.com`/`www.nzwihl.com`?** The public league sites sit behind a CDN with real delay; `admin.esportsdesk.com` is the un-cached origin behind them (same HTML, confirmed byte-for-byte identical structure). Everything was switched over to it on 2026-06-30 so a goal banner can't lag behind a real event.

---

## Job 2 — the control channel, in detail

One Durable Object class, `ControlChannel`, with **one instance per team slug** (`env.CONTROL.idFromName(slug)`) — so Botany Swarm's queued player, Red Devils' starting lineup, etc. are all isolated from each other automatically, with no shared database or row-keying to get wrong.

It holds two independent pieces of state per team, under separate storage keys:

**`/control/<slug>` — Player Lower Thirds.** Fire-once state:
```
status: "idle" | "queued" | "fired"
player: {team_slug, role, number, name, position} | null
fact / include_fact
fire_id            — changes every fire, lets the overlay detect a NEW fire
fired_at / expires_at   — fired_at + 10000ms, so a fire always self-clears
interrupted_at     — set if an auto goal/penalty banner blocked or killed the L3
```
Actions (`POST` body `{action, token, ...}`): `queue`, `fire`, `clear`, `interrupt`. Reads (`GET`) are open to anyone; writes require the shared token below. A fired L3 auto-reverts to `"queued"` (not `"idle"`) once its 10-second hold elapses, so the same player can be re-fired with one tap — this self-heals on the next read/write, no cron job needed.

**`/lineup/<slug>` — Starting Lineup.** Durable, not fire-once:
```
slots: { LF, CF, RF, LD, RD, GK: {number, name, position, photo} }
updated_at
```
Actions: `set_slot` (one position at a time), `set` (replace the whole lineup), `clear`.

**Shared-secret token:** `CONTROL_TOKEN = "l3-EXleXBAfHbgn7P1qHeJ81U1K"`, gating writes only. This is **not real security** — it's a value embedded in plain sight in the public phone-control and overlay page source (same trust model as `WORKER` itself being a plain constant in every page). It exists to deter casual poking, not a determined attacker. If that ever matters more than it does today, this would need a real auth layer, which doesn't exist anywhere in this stack currently.

---

## Every page that depends on this Worker

All of these live in `matchavez/hockey` and embed the Worker URL as a `WORKER` constant near the top of the file (a few also embed `CONTROL_TOKEN`):

| Page | Uses proxy | Uses control channel |
|---|---|---|
| `scorebug/` | ✅ | — |
| `scorebug-l3/` | ✅ | ✅ (L3) |
| `activity-banner/` | ✅ | ✅ (L3) |
| `ticker/` | ✅ | — |
| `summary/` | ✅ | — |
| `scoringleaders/` | ✅ | — |
| `lowerthirds/` (phone control) | ✅ | ✅ (L3) |
| `startinglineup/` | ✅ | ✅ (lineup, read) |
| `startinglineup/control/` | ✅ | ✅ (lineup, write) |
| `startinglineup/combined/` | ✅ | ✅ (lineup, read) |
| `preflight/` | ✅ (health check only) | — |

Most pages also accept a `?worker=<url>` query-string override, useful for testing a replacement Worker against a live page before switching everyone over for real.

---

## Rebuilding from scratch (e.g. swapping to a new Worker after the season)

1. **Get the source.** It's all in `matchavez/nzihl-broadcast-assets/summary/`: `worker.js`, `wrangler.toml`, `DEPLOY.md`. Nothing needs to be rewritten — the same file supports a fresh deployment as-is.
2. **Install wrangler** if the machine doing the deploy doesn't have it: `npm install -g wrangler`.
3. **Decide the new Worker's name.** If it's a genuinely new Worker (new Cloudflare project, or Mat wants a clean slate), edit `wrangler.toml`'s `name = "blue-butterfly-aa69"` to the new name *before* deploying — this becomes the new `<name>.matchavez.workers.dev` URL. If it's just redeploying the same Worker (e.g. after an account issue), leave the name as-is.
4. **Log in and deploy**, from inside `summary/`:
   ```
   git pull                # always, first — a stale local clone has silently
                            # deployed an old worker.js before
   cd summary
   wrangler login
   wrangler deploy
   ```
   The first deploy of a Durable Object class shows a migration confirmation step (`ControlChannel` — new SQLite class) — confirm it. This is a **one-time thing per new Worker**; don't touch `wrangler.toml`'s `[[migrations]]` block on later redeploys of the same Worker.
5. **Verify the proxy:**
   ```
   curl "https://<new-name>.matchavez.workers.dev/?url=https%3A%2F%2Fadmin.esportsdesk.com%2Fleagues%2Fstandings.cfm%3Fclientid%3D7131%26leagueid%3D35499%26printPage%3D1"
   ```
   Should return standings HTML, not an error.
6. **Verify the control channel:**
   ```
   curl "https://<new-name>.matchavez.workers.dev/control/pure-nz-admirals"
   ```
   Should return `{"status":"idle","player":null,...}` — a fresh Durable Object's default state.
7. **Point every consumer page at the new URL.** Update the `WORKER` constant in all 11 files listed in the table above (all in `matchavez/hockey`). There's no central config — it's a plain string baked into each page. Test with `?worker=<new-url>` on a couple of pages first if you want to confirm before committing to all of them.
8. **Rotating the shared token (optional).** If `CONTROL_TOKEN` should change too, pick a new value and update it in the 4 files that carry it: `activity-banner/index.html`, `scorebug-l3/index.html`, `lowerthirds/index.html`, `startinglineup/control/index.html`. Not required for a Worker swap — only needed if the token itself is the thing being rotated.
9. **Know what resets.** A new Worker means a new, empty set of Durable Objects — every team's Player Lower Thirds state and Starting Lineup will start blank again. That's expected and harmless (this is day-of-broadcast state, not season data), but worth setting lineups again before the first game on the new Worker rather than assuming they carried over.

### Rollback

The previous `worker.js` is always in that repo's git history (`git log -- summary/worker.js`) — `wrangler deploy` that older version to revert a bad change. An unused Durable Object binding left over from a rollback is harmless.

---

## Known gotchas (from actually running this)

- **Dashboard paste only works for the proxy-only version.** The moment Durable Objects are involved, `wrangler deploy` is mandatory — the dashboard's Quick Edit box can't declare the `[[migrations]]` block a new DO class needs.
- **Always `git pull` before `wrangler deploy`.** A fix pushed to `main` but deployed from a stale local clone will silently redeploy the OLD code — the deploy reports success either way.
- **Must run `wrangler deploy` from inside `summary/`**, not the repo root — `wrangler.toml` is folder-scoped.
- **`wrangler.toml`'s `name` must match the actual Worker's name in the dashboard**, not just the workers.dev subdomain you expect — double-check in Workers & Pages → your Worker before a first deploy under a new name.

---

*See `matchavez/hockey`'s own `memory.md` for the full day-by-day history of every change to this Worker; this file is the "what it is / how to rebuild it" reference, not the changelog.*
