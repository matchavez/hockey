# matchavez/hockey — NZIHL / NZWIHL Broadcast Overlay Pages

Live at **https://matchavez.com/hockey/** (GitHub Pages, custom domain, deploy = push to `main`).
Every page is a self-contained single-file HTML overlay designed as a **1920×1080 browser source
for the YoloBox** (fit-scaled for desktop preview via a `#stage` transform). No build step, no
dependencies beyond the repo's own font files and the shared Cloudflare worker.

> **This README is optimized for AI-assisted maintenance.** It records data contracts, invariants
> and known gotchas precisely. When you change a parser or convention, update this file in the
> same commit.

---

## Page inventory

| Path | Purpose | Key URL params |
|---|---|---|
| `index.html` | Portal: links, team-slug lists, standings embeds, beta links in footer | — |
| `ticker/` | **Ticker Page**: scorebug clip + top-right verbose scrolling game ticker (pregame / live / FINAL aware) | `?team=` `?g=` `?test=1` `?ad=` `?tk=` `?speed=` `?bs=` `?bug=` |
| `scorebug/` | Singular scorebug clip + goal/penalty banner (bottom of frame) | `?team=` `?g=` `?test=1` `?bs=` `?bug=` |
| `activity-banner/` | Transparent 1920×1080, goal/penalty banner ONLY (no scorebug), flush bottom | `?team=` `?g=` `?test=1` |
| `summary/` | Live Game Summary graphic (1840×1000-style card) | `?team=` `?g=` `?w=1` `?bg=opaque` |
| `box/` | Auto-refreshing box-score iframe card with team logos | `?g=` `?w=1` `?s=<secs>` (refresh, default 35, min 8) |
| `assets/fonts/` | InterVariable (+Italic) woff2 — the 2026 house font | — |

Common params across live pages: `?team=<slug>` picks the club's live/next game from the roster
manifests; `?g=<gameid>` forces a game (`?w=1` or `?l=nzwihl` selects the women's league IDs);
`?worker=` overrides the proxy.

**Team slugs** (used by ticker / scorebug / activity-banner / summary): `canterbury-red-devils`
(default), `botany-swarm`, `skycity-stampede`, `dunedin-thunder`, `pure-nz-admirals`,
`auckland-steel`, `canterbury-inferno`, `dunedin-thunder-women`, `wakatipu-wild`.
Slug rule: lowercase, `&`→`and`, non-alphanumerics→`-`. Auckland Mako is NOT wired (stood down,
no 2026 games).

---

## Shared infrastructure

- **CORS proxy (required for all live scraping):**
  `https://blue-butterfly-aa69.matchavez.workers.dev?url=<encoded>` — allow-lists
  `admin.esportsdesk.com` (plus the old `www` host). Baked into each page as `WORKER`.
- **Data origin:** always `https://admin.esportsdesk.com` (the un-cached origin behind
  nzihl.com/nzwihl.com — identical HTML, no CDN delay). Append `&_=${Date.now()}` +
  `cache:"no-store"` on every poll.
- **League IDs:** NZIHL `clientid=7131&leagueid=35499` · NZWIHL `clientid=7132&leagueid=35501`.
- **Game resolution manifests** (current round only, regenerated daily by the roster pipeline):
  `https://raw.githubusercontent.com/matchavez/{nzihl,nzwihl}-broadcast-rosters/main/boxscores.json`
  — fields: `date, time, datetime(+12:00), away, home, away_code, home_code, venue, gameid,
  boxscore_url, in_core_window`. Selection: soonest game ≥ now−5h, else most recent with a gameid.
- **Team visual registry `REG`** (duplicated in ticker/scorebug/summary/activity-banner — keep in
  sync), keyed by esportsdesk **teamID**:

  | teamID | code | team | ink (readable accent) | dark (half-dark bg) | logo file |
  |---|---|---|---|---|---|
  | 674110 | ADM | Pure NZ Admirals | `#F7BE11` | `#081D48` | `Pure-NZ-Admirals-2000x2000.png` |
  | 675633 | CRD | Canterbury Red Devils | `#E5242B` | `#550000` | `Red Devils 2000x2000r.png` |
  | 675634 | DUN | Dunedin Thunder | `#1E9E63` | `#012C1E` | `Dunedin_Thunder.png` |
  | 675635 | SCS | SkyCity Stampede | `#FAC805` | `#162543` | `Skycity Stampede 2000x2000.png` |
  | 674109 | BSW | Botany Swarm | `#F7AF28` | `#441620` | `Botany Swarm 2000x2000.png` |
  | 675636 | AST | Auckland Steel | `#9FB6C8` | `#18263E` | `Auckland-Steel-White.png` |
  | 675637 | CIN | Canterbury Inferno | `#E0564E` | `#550000` | `Inferno-White.png` |
  | 675638 | DTW | Dunedin Thunder Women | `#1E9E63` | `#012C1E` | `thunder-women-white.png` |
  | 675639 | WLD | Wakatipu Wild | `#FAC805` | `#162543` | `Wakatipu-wild-white.png` |

  Logos base: `https://matchavez.com/nzihl-broadcast-assets/assets/logos/` ·
  League marks: `.../nzihl-broadcast-assets/assets/league/NZIHL-White-2000.png` and
  `NZWIHL-Logo-White-1000px.png`. Full brand rules live in the Style & Colour Guide in
  `matchavez/nzihl-broadcast-assets`.

---

## esportsdesk scraping contracts (hard-won — read before touching any parser)

**Box score** `hockey_boxscores.cfm?clientid=&leagueid=&gameid=&printPage=1`:
- `tables[0]` = score grid: header `Team | 1 | 2 | 3 [| OT1] | Total`; rows 2–3 = away, home.
  Team cell ends with the 2–4-letter code (`/^(.*?)\s+([A-Z]{2,4})$/`); teamID from the row's
  `a[href*="teamID="]`.
- **SOG details table** (header matches `/SOG/`): cell like `"38 (13-11-14)"` — total shots with
  **per-period counts in the parens** (entries appear as periods are played). Also `PP` (`1/3`)
  and `PIM` columns.
- `h5` section headers: `SCORING SUMMARY`, `PENALTY SUMMARY`, `SKATERS` (per team), `GOALIES`.
- Scoring rows: `#8 Connor Harrison (Conner Jean, Jackson Flight) | PPG | 16:24` — the **middle
  cell is a goal-type pill** (`PPG`/`SHG`/`ENG`, empty for even strength), present only when the
  row has 3+ cells. **Times are TIME REMAINING in the period** (clock counts down) — use verbatim.
- Penalty rows: `#26 Tristan Darling (Dunedin Thunder) | Boarding | 2 Minutes | 9:43` — team is
  ALWAYS in the trailing parens (incl. team penalties with no player). Durations written as
  `"2 Minutes"`.
- Assist lists carry **no jersey numbers** — resolve them from the SKATERS roster rows
  (name-contains match, take the row's leading number; omit if unmatched).
- ⚠ **Period headings include `"OVERTIME PERIOD 1"`** — the section() heading regex MUST be
  `/^(1ST|2ND|3RD|\dTH|OVERTIME|OT\d*|SHOOTOUT)(\s+PERIOD)?(\s*\d+)?$/i`. Without the trailing
  `(\s*\d+)?` OT goals silently fold into P3 (bug lived in scorebug + activity-banner until
  2026-07-07, commit 7f400f6).
- ⚠ **Span fusion:** esportsdesk wraps `#no FirstName` in a responsive span with the surname as
  trailing text, sometimes with NO space (`...</span>beckstead`). Every parser must do
  `html.replace(/<\/span>/gi,"</span> ")` before DOMParser.
- ⚠ **Name case:** source names arrive ALL-CAPS or all-lowercase randomly — normalise with a
  hyphen/apostrophe-aware `properCase()` (`Ruski-Jones`, `O'Brien`). Known override: Red Devils
  #7 = "Te Rangi Henare" (multi-word given name; surname = final token).
- Pre-game box scores are **shells**: team rows exist (names + teamIDs parse), goals/pens empty.
  A completed game always has goals (a real final can't be 0-0 — OT/SO decides).

**League leaders** `stats_hockey.cfm?clientid=&leagueid=&printPage=1`:
- One table, PTS-sorted. Cols: `rank | Player | # | Pos | BY | Team | GP | G | A | PTS | ...`.
- Player cell duplicates the name responsively: `"A Gagnon IM Alex Gagnon IM"` — the FULL name is
  the `span.d-none.d-sm-block` (wide) span; strip `IM`/`AF` import badges. Match against
  box-score names by lowercase-alpha-only containment.
- Team cell fuses name+code (`"Dunedin ThunderDUN"`) — match clubs by normalised containment.
- ⚠ Endpoints `stats.cfm`, `stats_scoring.cfm`, `player_stats.cfm` do NOT exist (404). The other
  real pages: `standings.cfm`, `schedules.cfm`, `hockey_special_teams.cfm`, `rosters_profile.cfm`,
  `suspension_report.cfm`.

**Standings** `standings.cfm?clientid=&leagueid=&printPage=1`:
- One table; rank = row order. Cols: `Team | GP | W | L | OTW | OTL | PTS | P% | GF | GA | DIFF |
  GF/G | GA/G | PIM | STR | L10`. Team cell fuses name+code.

**Schedule** `schedules.cfm?clientid=&leagueid=&printPage=1`:
- ⚠ **Shows the CURRENT ROUND ONLY** (~2 games); `month=`/`teamID=` params are ignored. Not a
  season archive.
- Game status text: `Final`, `Final /OT`, `Final /SO` appears in the box-score link text — the
  ONLY trustworthy "game over" signal. ⚠ The markup writes **`gameID=`** (capital D) — match
  case-insensitively.
- For historical games: **gameids are sequential** — walk downward from a known id and parse each
  box score (grouped by matchup, so a recent meeting is usually within ~25 ids).

**Rosters** (for the roster PDF pipeline, different repos): use
`stats_1team.cfm?...&printPage=1`; nzihl.com team pages are JS-rendered and empty to fetchers.

**GitHub Pages gotcha:** the Fastly edge can serve stale files for minutes after a push (per-PoP).
Verify with `curl "https://matchavez.com/hockey/<path>?v=$RANDOM" | grep <new-marker>`; an empty
commit forces a fresh build if stuck. The `/pages/builds/latest` API can also lag ~15s.

---

## ticker/ — the Ticker Page (most feature-rich asset)

One static URL per club: `ticker/?team=<slug>`. Upper-left: the Singular scorebug clip
(identical geometry/BUGMAP to `scorebug/`). Upper-right: a black (#000) marquee exactly the
scorebug bar's height with a fixed **"Recap:"** label; the crawl clips behind it. NO activity
banner on this page.

**Geometry** (`?tk=x,y,w,h` overrides): default `x=796` (flush against the clock's right edge —
the "5 on 5"/fly-out chips extend past it and the ticker COVERS them, z-index 4 over the bug's 1),
`w=1920−x` (clamped in-frame), `h = BUG.scale × 83 = 64.74px` — the bar bottom is FRACTIONAL
because the scorebug is a 0.78-scaled iframe (integer 64 gaps, 65 bumps). Lower `x` later to
cover the clock/period. Font = 0.37×h; weights: emphasis 600, body 400, team/player names 600,
jersey numbers 80% size @ 800 in the same team ink.

**Marquee engine (rAF-throttle-proof):** position is a pure function of wall-clock time
(`traveled += dt×SPEED`; `offset = −((traveled−ENTRY) % unitW)`), driven by rAF + a 250ms
interval fallback — occluded Chrome throttles rAF to ~1fps and accumulated frame deltas stall.
`lastT` must NEVER move backwards (rAF timestamps lag `performance.now()`; regressing
double-counts). New content splices ONLY at the loop seam (`dirty` → rebuild) so the crawl never
jumps — except when the strip was empty (immediate). `SPEED` default 120 px/s (`?speed=`).
**Startup:** the score line renders ALONE, CENTRED, holds 7s (`HOLD_MS`), then the crawl begins;
`ENTRY=(SW−w0)/2`. Templates are picked by `hashStr(name|t|per)` so each event's wording is
stable across rebuilds.

**Strip content (chronological, loop begins with the score line every cycle):**
1. **Score line** `(away crest) Away N - N Home (home crest)`; prefixed `FINAL (OT/SO) — ` once
   the schedule says so.
2. **Goal calls** — 4 rotated shapes ("came from" / "scored" / "found the net for" / "struck
   for"); the game's first goal is always "{player} opened the scoring for {team}". Composed
   clauses, all calculated: goal-type pill → "on the power play / while short handed / into an
   empty net"; season context after the scorer's name (rank line on their first goal of the
   strip — "the NZIHL's top goal scorer" (goals rank 1) / "the NZIHL's leading scorer" (points
   rank 1) / "second/third in NZIHL scoring" / "a top-ten NZIHL scorer"; later goals "his/her Nth
   of the season" gated ≥5, `row.G − (tonightTotal − k)`); trailing clauses — milestones ("his
   second of the game", "completing the hat trick"), lead-changes ("tying the game at N",
   "giving TEAM their first lead of the night", "putting TEAM back in front", "pulling TEAM back
   within one"), and post-FINAL the GWG (winner's goal #loserTotal+1) → "the game-winning goal" /
   "the overtime winner". Every goal ends with the running score `(a-h)` (away-home). Pronoun by
   league: NZWIHL = "her".
3. **Penalty calls** — 3 rotated shapes ("was called for" / "took a[n] X penalty" / "went to the
   box for"); team penalties "TEAM were called for". 2-min minors carry NO duration; 4 →
   "(double minor)", 5 → "(major)", 10 → "(misconduct)", text durations parenthesised lowercase.
4. **Period dividers** — "END OF THE FIRST PERIOD — Away 2, Home 1 — Shots 13-7" (score at the
   break from the tally walk; shots cumulative from the SOG parens) after each period the game
   has moved PAST (`PERSDONE` = max(SOG paren count, highest event period)).
5. **Pregame preview** (while the game has zero events): puck drop (manifest time/venue, only
   while now < start+30min), standings line, each club's leading scorer, last meeting result
   (sequential-gameid walk). **Anything unresolved is OMITTED — never invented.**
6. **Ad slot (pre-wired, dormant):** `?ad=<slug>` → `ADMAP` entry `{img,lead,brand,url,accent}`;
   renders as a native item (sponsor logo in the crest slot + one line, brand in accent colour)
   after each period divider (end-of-loop if none yet). `?ad=test` previews. To go live: PNG
   wordmark → `nzihl-broadcast-assets/assets/ads/`, add the ADMAP entry, share the `?ad=` URL.

**Test mode `?test=1`:** feeds real game **2519940** (Dunedin Thunder 4 @ Canterbury Red Devils 6)
through the full live pipeline, trimmed to periods 1+2 as if at the second intermission (score
recounted from the filtered goals; dividers close P1+P2). `+ Goal` / `+ Penalty` buttons append
synthetic OT events (incl. PPG/SHG + 4/5-min pens); speed buttons; diag bottom-right.
Polling: box score 12s, leaders/FINAL-check every 5th poll, auto-stop 3h15m (`RUN_CAP`).

---

## scorebug/ and activity-banner/ — goal/penalty banner overlays

- `scorebug/` = Singular scorebug iframe (clipped; watermark falls outside the clip) + a
  78px-tall banner flush at frame BOTTOM. `activity-banner/` = the same banner on an otherwise
  transparent/empty 1920×1080 (each club runs its own scorebug). Banner: flat fill = team
  half-dark, wipe in/out 250ms, goal 10s / penalty 7s, both end crests = the scoring team,
  auto-shrink text (never ellipsise), goal-scorer headshot circle (goals only; from
  `admin.esportsdesk.com/media/leagues/6795/graphics/<FirstnameLastname>.jpg`, no fallback shown
  on 404). Names render "F. Surname".
- **Singular output is PER-BROADCAST, not per-team:** `BUGMAP` has only Christchurch
  (`7wvd7ZPATlYl3NoLxtxmkF` — Red Devils + Inferno). **TODO: fill each other club's output id
  (or pass `?bug=<id|url>`) before publishing that club's scorebug/ticker page.**
- Scorebug clip tuning: `?bs=scale,x,y,clipW,clipH[,cropX,cropY]` (defaults 0.78, 0, 0, 1000,
  172, 390, 500). Left white gap = raise cropX.
- `?test=1`: per-club G/P demo buttons (`&team=<slug>` filters to one club); the CRD demo
  deliberately fires sibling scorers (Ollie/Leo Ruski-Jones) to exercise initials.

## summary/ and box/

- `summary/` — Live Game Summary card (goal/penalty rows w/ headshots-or-initials, period-driven
  columns, per-team accents incl. legibility tints + the Swarm-vs-Red-Devils Honey exception via
  `applyMatchupAccents()`). `?bg=opaque` for a solid background.
- `box/` — dual-iframe cross-faded auto-refresher around the raw printPage box score (`?s=`
  cadence, default 35s), team logos overlaid, NZWIHL via `?w=1`.

## Portal (`index.html`)

Sections: standings graphics, roster links, Activity Banner team slugs, section thumbnails,
footer beta links (scorebug ×2, activity banner, **Ticker Page**, 49ing cockpit, Singular login).
When adding a page, add its footer link.

---

## Verification workflow (what has repeatedly worked)

1. Edit → `node -e "new Function(<script body>)"` syntax check → commit/push to `main`.
2. Poll the live URL with a cache-buster until the new marker string appears.
3. Drive the page via Chrome automation: `?test=1`, click by element ref (raw coordinates
   intermittently miss), force states from the console (`holding=false; rebuild()`,
   `traveled=ENTRY+unitW+1; step()` to force a seam) and read
   `track.firstElementChild.textContent` to assert exact strip wording.
4. Real-data checks: game 2519940 (CRD/DUN, milestones), 2519941 (Final/OT — FINAL + OT-winner),
   ?team=botany-swarm (pregame preview). Chrome-MCP console output REDACTS URL-like strings —
   re-encode (`?`→" Q ") when dumping links.
