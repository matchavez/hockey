# memory.md — matchavez/hockey

Self-context for Claude. README.md here is already extremely thorough and explicitly written for AI-assisted maintenance (data contracts, URL params, gotchas) — treat README.md as the primary source of truth for how each page works. This file covers what README.md doesn't: cross-repo relationships, process gotchas, and "what's in flight" framing. Last refreshed: 2026-07-11.

## What this repo is
The live portal + every deployed broadcast overlay page for NZIHL/NZWIHL. `https://matchavez.com/hockey/` via GitHub Pages, custom domain, deploy = push to `main`. Single-file HTML overlays, no build step, 1920×1080 YoloBox browser sources.

## Page inventory (see README for full param contracts)
`index.html` (portal), `team/`, `league/`, `ticker/`, `scorebug/`, `activity-banner/`, `summary/` (Live Game Summary), `scoringleaders/` (+ `ab-test.html`, a design-experiment page not in the deployed rotation — ask before deleting once a variant is promoted), `box/`, `preflight/` (producer tool, not an overlay), `assets/fonts/`.

## Process gotchas (not always obvious from the code)
- **GitHub Pages doesn't always auto-build on push.** If a change doesn't seem to be live, POST to `/pages/builds` to force a rebuild rather than trusting the build-status endpoint — that endpoint can lag minutes behind reality. Trust a Contents-API byte match + a live reload over the build-status endpoint.
- Verify visual changes with an actual DOM inspection / live screenshot, not just "the commit landed" — several rounds of the Scoring Leaders work needed Chrome-screenshot confirmation before being called done.
- `stats_1team.cfm?...&printPage=1` (esportsdesk) is the roster data source; nzihl.com's own team pages are JS-rendered and return empty to plain fetchers — don't try nzihl.com directly.

## Related repos (data flows in)
- **matchavez/nzihl-broadcast-assets** — standings PNGs (raw.githubusercontent.com), team/league logos, brand assets, Up Next / DVD Bounce overlays linked from `team/`. Game Summary and Scoring Leaders design work is often prototyped there first (`summary/`, `previews/`) before landing here.
- **matchavez/nzihl-season-data** — `nzihl.json`/`nzwihl.json` game-level warehouse; powers streaks/H2H/last-meeting on `ticker/` and player game-logs on `scoringleaders/`.
- **matchavez/nzihl-broadcast-rosters**, **matchavez/nzwihl-broadcast-rosters** — roster PDFs and `boxscores.json` (gameid resolution); `hockeyrosters` repo/page surfaces the PDFs to talent.
- **matchavez/hockeyrosters** — separate repo/page (matchavez.com/hockeyrosters) for talent-facing roster downloads; linked from this portal.
- Cloudflare Worker (admin.esportsdesk.com no-cache origin) — all live scraping across this whole family of repos switched to this no-cache origin; some ticker/activity-banner work is still blocked on a worker redeploy (see [[nzihl_activity_banner]] equivalent in Claude's cross-session memory if picking this back up).

## Recent focus (as of 2026-07-10/11)
Team Scoring Leaders (`scoringleaders/`) just went through five iteration rounds ending in a Chrome-screenshot-confirmed final layout (fitPlayerText, styling, descriptor variety). Team page just gained a schedule/results widget (top-right of idcard). If resuming Scoring Leaders work, re-verify current live state first — this went through a lot of back-and-forth before landing.

## Sync note
Keep this file and README.md in sync with every meaningful change. If they drift, flag it to Mat and get approval before publishing the sync rather than doing it silently.
