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
| `team/` | **Team Page**: one-club aggregate view (all overlay links, live roster PDF, graphics packs, full brand palette, this club's league standings) — no ?team= shows a team picker | `?team=` |
| `league/` | **League Page**: league-only aggregate view (standings, this weekend's fixtures, clubs directory, rosters, brand) — no ?league= shows a league picker | `?league=` |
| `ticker/` | **Ticker Page**: scorebug clip + top-right verbose scrolling game ticker (pregame / live / FINAL aware) | `?team=` `?g=` `?test=1` `?ad=` `?tk=` `?speed=` `?bs=` `?bug=` |
| `scorebug/` | Singular scorebug clip + goal/penalty banner (bottom of frame) | `?team=` `?g=` `?test=1` `?bs=` `?bug=` |
| `activity-banner/` | Transparent 1920×1080, goal/penalty banner ONLY (no scorebug), flush bottom. Also renders Player Lower Thirds (headshot+stats+fact) fired remotely from `lowerthirds/` — same page, no new browser source | `?team=` `?g=` `?test=1` `?preview=` |
| `summary/` | Live Game Summary graphic (1840×1000-style card) | `?team=` `?g=` `?w=1` `?bg=opaque` |
| `scoringleaders/` | **Team Scoring Leaders**: each side's top-3 point scorers, live stats + a season-form descriptor line (1840×1000-style card, same visual family as `summary/`) | `?team=` `?g=` `?w=1` `?bg=opaque` |
| `scoringleaders/ab-test.html` | **Design-experiment page, NOT part of the deployed rotation** — not linked from the portal or anywhere else, direct-URL only. Stacks multiple full-size variants of the Team Scoring Leaders pill construction (mirrored vs symmetric vs centred-text, labelled A/B/C) on one page so Mat can compare before a decision lands in `scoringleaders/index.html`. Same convention as the old `summary/translucent-test.html`. Safe to delete once a variant is picked and promoted — ask before deleting. | `?team=` `?g=` `?w=1` |
| `preflight/` | **Broadcast Pre-Flight** (producer tool, not an overlay): worker round-trip, manifest freshness (GitHub commits API), leaders/standings/schedule reach, per-club game resolution + BUGMAP status + box-score probe + FINAL status, copy-ready overlay URLs with per-club `?bs=`/`?tk=` tuning persisted in localStorage | — |
| `graphicstests/` | **Broadcast Graphics QA** (producer tool, not an overlay): sibling to `preflight/` — answers "does each GRAPHIC actually render" rather than "will the data resolve." Loads every overlay's real URL in a live iframe per club (using each page's own `?test=1`/`?preview=` harness where one exists — `activity-banner`/`scorebug`/`scorebug-l3`'s built-in `fireTest()`, `ticker`'s real-game `?test=1`, `startinglineup`'s `?preview=` synthetic lineup), checks the rendered DOM for broken images/placeholder text/layout overflow, plus static-asset checks (Standings PNGs, DVD Bounce corner mp4s+zips, UP-NEXT galleries) via one repo-tree fetch. Sections run on demand (or all at once) so it doesn't hammer the worker/esportsdesk on every load. | — |
| `warehouse/` | **Data Warehouse** (producer tool, not an overlay): browses the full season game archive (`nzihl-season-data`'s `nzihl.json`/`nzwihl.json` — completed games w/ streak chips + searchable/filterable table + box-score links, plus remaining fixtures) and the full player+coach photo library (`nzihl-player-photos`'s `manifest.json` — every rostered person, grouped by team, sorted by jersey #, real thumbnails or initials placeholders, missing-photo counts) on one page. Both fetched live client-side, nothing copied in. | — |
| `lowerthirds/` | **Player Lower Thirds** (producer tool, not an overlay): phone control page — tap a tonight's-roster jersey pill, preview (shares the `activity-banner/?preview=` renderer), edit/toggle an auto-computed fact, Fire through a Cloudflare Worker Durable Object control channel to the `activity-banner/` already on air | `?team=` |
| `startinglineup/` | **Starting Lineup** broadcast graphic: 1840×1000 opaque panel (transparent surround) on the bottom half of a vertical rink — six starters (LF/CF/RF/LD/RD/GK) as horizontal cards in an inverted pyramid. Evergreen browser source: state persists in the worker's `/lineup/<slug>` channel, polls every 10 s | `?team=` `?preview=` |
| `startinglineup/control/` | **Starting Lineup control** (producer tool, not an overlay): director's picker — six slot buttons, tap a slot then a jersey pill, live preview iframe (the display page itself in `?preview=` mode), team switcher, domigan gate | `?team=` |
| `assets/fonts/` | InterVariable (+Italic) woff2 — the 2026 house font | — |

Common params across live pages: `?team=<slug>` picks the club's live/next game from the roster
manifests; `?g=<gameid>` forces a game (`?w=1` or `?l=nzwihl` selects the women's league IDs);
`?worker=` overrides the proxy.

**Team slugs** (used by ticker / scorebug / activity-banner / summary / scoringleaders): `canterbury-red-devils`
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
- **Season data warehouse** (matchavez/nzihl-season-data, nightly cron 16:30 UTC + `workflow_dispatch`,
  full contract/gotchas in that repo's own README):
  `https://raw.githubusercontent.com/matchavez/nzihl-season-data/main/{nzihl,nzwihl}.json` — every
  **completed** game (gameid, date, away/home line scores + SOG/PP/PIM, goals, pens, goalies,
  `finalType`), plus a `derived` block (`last5`, `streak`, `head_to_head`, `player_game_logs`) computed
  fresh at build time. This is what `ticker/`'s pregame preview uses for last-meeting + head-to-head
  instead of a live sequential-gameid probe (see `ticker/` section below) — reach for it before adding
  any NEW season-level claim to an overlay page, rather than re-deriving it from a live probe.
  Cursor/bookkeeping state lives in a separate `cursor.json` in that repo, not in the two data files.
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

**Player stats (skater totals)** `stats_1team.cfm?clientid=&leagueid=&teamid=&printPage=1`:
  used LIVE by `scoringleaders/` (via the Worker) AND offline by the roster-PDF pipeline
  (`nzihl-broadcast-rosters`/`nzwihl-broadcast-rosters`'s `scraper.py`) — keep both parsers in
  sync if this table's column layout ever drifts again.
- A `PLAYER STATISTICS ... TEAM TOTALS` block contains one table, one row per skater. **Column
  lookup is HEADER-LABEL-DRIVEN, not fixed-offset** — this table has shipped more than one column
  order historically (see [[nzihl-roster-scraper-robustness]] equivalent fixes in the roster
  repo). Read the header row's `<th>` text, build a `{LABEL: index}` map, then look up
  `#`/`POSITION`/`GP`/`G`/`A`/`+/-` by label with sane fallback indices for the common layout.
- Player name comes from the row's `<a href="...playerID=...">` **`title` attribute**, not the
  link text (the link text is often just initials/abbreviated). Title-case it — source names
  arrive ALL-CAPS or all-lowercase at random, same as everywhere else on this site.
- **`+/-` prints `"E"` for even** (zero), otherwise a signed integer (`"13"`, `"-7"`) — normalise
  `"E"` → `0` before use. Treat this column as OPTIONAL when computing a "need this many
  columns" floor for row validity — some historical layouts omit it entirely, and a parser that
  hard-requires it will silently drop every row on those pages.
- A quote-aware tag stripper is required here too (see the box-score span-fusion/tooltip gotchas
  below) — a naive `<[^>]+>` regex breaks on any cell whose tooltip `title` embeds a `<br />`.

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

**Rosters** (for the roster PDF pipeline, different repos): also built on `stats_1team.cfm`
(contract above); nzihl.com team pages are JS-rendered and empty to fetchers.

**GitHub Pages gotcha (two DIFFERENT failure modes, don't conflate them):**
1. **Stale edge cache** (common, benign): the Fastly edge can serve a PREVIOUS build for minutes
   after a push, even once the build itself succeeded. Verify with
   `curl "https://matchavez.com/hockey/<path>?v=$RANDOM" | grep <new-marker>`; `POST
   /repos/matchavez/hockey/pages/builds` (authed) queues a fresh build, which usually clears this
   in ~25s. The `/pages/builds/latest` status API can also just lag ~15s behind reality — a
   `"building"` status doesn't always mean the site hasn't already updated.
2. **Genuine build failure loop** (rarer, worth recognising): `/pages/builds/latest` reports
   `"errored"` / `"Page build failed."` repeatedly for one SPECIFIC commit (not just a slow
   `"building"`), and — unlike case 1 — a direct `curl` of the live file confirms the ORIGIN
   itself is still serving the old content, not just an edge cache. Seen 2026-07-09 on a
   completely valid commit (clean HTML/JS, valid UTF-8, no stray Jekyll/Liquid `{% %}`/`{{ }}`
   tokens) that failed to build ~5 times over ~9 minutes before clearing on a further blank
   `POST /pages/builds` retry with zero code changes. **If you hit this: don't assume the file is
   broken just because the build keeps erroring — validate the file thoroughly first (UTF-8,
   JSON/JS syntax, no accidental Liquid-tag-looking sequences), then just keep retrying the force
   -build.** The API gives no more detail than `"Page build failed."` — there's no deeper error
   message available without the (non-API) Pages settings UI.
Either way: confirming via the **GitHub Contents API** (`api.github.com/repos/.../contents/...`)
only proves the git PUSH landed — it says nothing about whether Pages has actually built and
served it. Always follow up with a direct `curl` of the live URL (or a Chrome reload) before
declaring a deploy done.

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
4. **Period dividers** — the LATEST break also carries the goaltender line ("Alexa Gibson has
   stopped 24 of 27" — SA/SV straight from the GOALIES tables, cols `# | Name | SA | GA | SV |
   SV% | MP | PIM`, skip rows with MP 0:00; present-tense truth means earlier breaks omit it;
   test mode derives numbers from the two-period fiction). Dividers otherwise read — "END OF THE FIRST PERIOD — Away 2, Home 1 — Shots 13-7" (score at the
   break from the tally walk; shots cumulative from the SOG parens) after each period the game
   has moved PAST (`PERSDONE` = max(SOG paren count, highest event period)).
5. **Pregame preview** (while the game has zero events): puck drop (manifest time/venue, only
   while now < start+30min), standings line, each club's leading scorer, last meeting result AND
   a season head-to-head record ("Dunedin Thunder lead the season series 3-1" / "X and Y are tied
   2-2 this season") — both read from the **season data warehouse**
   (`matchavez/nzihl-season-data`'s `derived.head_to_head`, one instant fetch) via
   `findLastMeetingFromWarehouse()`, not a live probe. `findLastMeetingLive()` (the original
   25-fetch sequential-gameid walk) only runs as a fallback if that fetch fails; the head-to-head
   line never renders off the fallback path (a season tally isn't worth a live crawl — omit
   rather than under-report). **Anything unresolved is OMITTED — never invented.**
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

## lowerthirds/ — Player Lower Thirds (phone control page)

Not an overlay itself — a phone-friendly producer tool that fires a traditional lower third
(headshot, season stats, an interesting fact) through the `activity-banner/` overlay already
loaded in the mixer. `?team=<slug>` shows tonight's roster as tappable jersey-number pills
(team-primary colour if a photo exists in the `nzihl-player-photos` manifest, grey/initials
frame otherwise; goalies marked; HC/AC coach pills at the end). Tap a pill to select, see a
live preview (a scaled `activity-banner/?preview=...` iframe — the exact same rendering path
`activity-banner/` uses live, so preview and broadcast can never drift apart), edit or toggle
off the auto-computed fact line, then Fire.

- **Data:** season stat line from `stats.json` (emitted nightly by `nzihl-broadcast-rosters` /
  `nzwihl-broadcast-rosters`); tonight's game from `boxscores.json` (falls back to
  `nzihl-season-data`'s `upcoming` field); photo from `nzihl-player-photos`' manifest; facts
  engine checks tonight's-multi-point → active streak → H2H series → leads-team →
  league-top10 → milestone-watch (first qualifying rule wins), sourced from
  `nzihl-season-data`'s per-player game logs / head-to-head / streak data.
- **Collision rule:** a goal/penalty auto-banner interrupts a live player L3 instantly (the
  player returns to queued on the phone, one tap re-fires); firing while an auto-banner is
  live is rejected. `activity-banner/`'s own `enqueue()` detects this locally and reports it
  back over the control channel — the channel itself has no domain logic, it's a dumb relay.
- **Control channel:** a Cloudflare Worker Durable Object (`nzihl-broadcast-assets`'s
  `summary/worker.js`, route `/control/<slug>`), ~750ms polling, shared-secret token on
  writes. **Deployed 2026-07-12** — full fire round trip (queue → fire → live overlay render →
  auto-hide → clear) verified live.
- **Geometry (redesigned 2026-07-12):** ~1000×174 (noFact 130), flush against the same bottom
  edge as `#bnr` (`bottom:0`) — safe because the collision rule above already guarantees the
  two never render at once. Circular headshot with a team-colour border ring on the left,
  a bold-value/small-unit-label stat row (matching `scoringleaders/`'s visual language)
  in the middle, a team-logo end panel balancing the headshot on the right.
- **Password gate:** the page itself is behind a simple client-side password prompt (persisted
  in `localStorage` so a producer's phone doesn't re-prompt every reload). Same trust model as
  the `CONTROL_TOKEN` already embedded in the page's source — a deterrent against casual
  visitors on a static GitHub Pages file, not real security.

## startinglineup/ — Starting Lineup graphic + control (2026-07-13)

Evergreen per-team starting-six graphic, deliberately NOT tied to any game — teams rarely
change more than a slot or two between games, so the last-set lineup persists until the
director changes it minutes before puck drop.

- **Display** (`startinglineup/?team=<slug>`): 1840×1000 opaque panel centered in a
  transparent 1920×1080 browser source (Game Summary convention). Bottom ~half of a vertical
  rink drawn inline as SVG (centre red line across the top + half centre circle, blue line,
  end-zone faceoff circles with hash marks, goal line, crease, goal frame). Team half-dark
  header (logo, STARTING LINEUP, team name in team ink, league label). Six horizontal cards —
  headshot (or team crest if no photo — estate convention; silhouette if slot unset), jersey
  # in team ink, name (shrink-to-fit, never ellipsis), generic FORWARD/DEFENSE/GOALIE label.
  Inverted pyramid: LF/CF/RF on the red line with CF staggered higher, LD/RD on the blue
  line, GK at the crease. Staggered reveal (GK up through the pyramid, CF last); slot changes
  after first paint swap in place with a pulse, no re-reveal. Polls `/lineup/<slug>` every
  10 s so a last-minute change lands on an already-loaded source. `?preview=<json>` renders a
  URL-supplied lineup and skips polling (single JSON.parse of the URLSearchParams-decoded
  value — never double-decode, see the L3 "%-in-a-fact" bug).
- **Control** (`startinglineup/control/?team=<slug>`): phone-first picker behind the shared
  domigan gate (same `l3_gate_ok` localStorage key as `lowerthirds/`). Six slot rows
  (LF/CF/RF/LD/RD/GK), tap a slot → full-roster jersey pills (goalies badged, team-ink =
  has photo, grey = crest fallback; players already in the lineup get a white ring), tap a
  pill → saved via `POST /lineup/<slug> {action:"set_slot"}`. Per-slot ✕ clears; Clear-all
  button on the preview card. Preview iframe = the display page in `?preview=` mode (one
  renderer, can't drift). Team switcher at the bottom covers the same Mako-excluded 9 clubs;
  last team remembered in localStorage. If the worker predates the `/lineup/` route the page
  detects the non-JSON reply and shows a "needs redeploy" notice (picks still preview).
- **State:** worker-side, per team, in the SAME ControlChannel Durable Object as the L3
  channel but under a separate `"lineup"` storage key — shape
  `{slots:{LF..GK:{number,name,position,photo}}, updated_at}`. Photo is resolved to a
  `nzihl-player-photos` manifest path at pick time so the display page never needs the
  manifest. Writes token-gated with the same CONTROL_TOKEN; reads open.

## summary/

- `summary/` — Live Game Summary card (goal/penalty rows w/ headshots-or-initials, period-driven
  columns, per-team accents incl. legibility tints + the Swarm-vs-Red-Devils Honey exception via
  `applyMatchupAccents()`). `?bg=opaque` for a solid background.

**2026-07-12: `box/` retired.** It was a dual-iframe auto-refresher around the raw esportsdesk
box score, with no unique data of its own (superseded by `summary/`'s Game Summary graphic).
`preflight/`'s "Box" copy button and `warehouse/`'s per-game box-score links now point straight
at the live esportsdesk `hockey_boxscores.cfm` origin instead.

## scoringleaders/ — Team Scoring Leaders

Same visual family/stage size as `summary/` (1840×1000-style card, `?bg=opaque` supported), same
team/game resolution (`resolve()`, `LAST_GAME` fallback table — **kept independently from
`summary.html`'s own `LAST_GAME`; update both by hand when the round changes, they can drift**),
but a different data source and a much slower poll (5 min, not Game Summary's 15s — season
totals don't move mid-game; same 3h15m auto-stop cap as every other live page).

- **Selection:** live-fetch `stats_1team.cfm` for both teams (contract above) via the shared
  Worker, take each side's **top 3 by points** (points desc → goals desc → jersey asc — identical
  rule to the roster PDF's skater ranking).
- **Layout — 3 lines per player, deliberately equal font-size** (a locked-in simplification, not
  an oversight — re-differentiating any line's size should be an explicit ask, not a "fix"):
  1. Jersey (`.jnum`, `.75em`/weight 800, team ink colour, no `#` prefix) · position letter (same
     ink colour, base size) · full name.
  2. `20 G  11 A  31 Pts  +13` — no `/` separators, no parens around Pts (both were explicitly
     removed on request). Unit letters (`.unit`) are `.6em`/weight 300; the `+/-` value (`.pm`) is
     weight 300 at full size (lighter, not smaller).
  3. Italic descriptor line, ~80% of the other two lines' size, no leading/trailing dots.
- **No text ever truncates** — `fitPlayerText()` runs after every render, shrinking each line's
  OWN inline `font-size` (not the whole pill) until its `scrollWidth` fits its `.ptext`
  container's real `clientWidth`, down to a 10px floor. This is a hard product rule from Mat, not
  a nice-to-have — don't reintroduce `text-overflow:ellipsis` as a "simpler" alternative.
- **Descriptor variety system** (`buildCandidates()` + `assignDescriptors()`): the goal is that
  none of the 6 on-screen players (3 per side) shows a repeated stat TYPE, with one deliberate
  exception — "Point streak" is reserved for the 1–2 players with the longest active streak
  (≥3 games) across the WHOLE 6-player pool, everyone else gets a distinct type. Current type
  roster: `bestgame` (season-high single-game points), `last3` (points in the last 2–3 games),
  `multipoint` (count of 2+-point games), `rank` (top-10 league-wide, summed client-side from the
  warehouse), `pointrate` ("points in X of Y games"), `teamshare` (% of the team's season total),
  `ppg` (points per game), `season` (the unconditional fallback — always available). Greedy
  assignment is most-constrained-player-first so nobody gets boxed out. **Explicitly removed:**
  a goal/assist-split framing ("N of M points have come via goals" / "a pass-first playmaker") —
  Mat's verdict: it just restates the G/A/Pts numbers already on line 2, not a real insight. Don't
  reintroduce that category without an explicit ask.
- Sources the season-form descriptor data from the **season data warehouse** (see Shared
  infrastructure above) — same repo the ticker's pregame preview uses, just a different slice
  (`derived.player_game_logs`) than the ticker's `derived.head_to_head`.
- **Not yet integrated:** `preflight/` (the producer pre-flight tool) doesn't check
  `scoringleaders/`'s resolution/reachability at all — only Game Summary/Ticker/etc. are covered
  there. Worth adding if this page starts getting relied on live.
- `ab-test.html` in this same folder is a throwaway design-comparison page (see Page inventory) —
  not linked anywhere, safe to delete once a pill-construction decision lands here.

## Portal (`index.html`)

Single-page portal, jump-nav + section anchors (keep both lists in sync when adding a section —
missing a jump-nav entry for a real section is an easy oversight, caught and fixed 2026-07-09).
Actual sections, in page order: `#standings` (Live Standings, both PNG sizes ×2 leagues),
`#boxscores` (**Live Game Summary** — auto-resolving matchup-card grid fed by both leagues'
`boxscores.json`, links to `summary/?g=`), `#leaders-live` (**Live Team Scoring Leaders** — a
genuine sibling of `#boxscores`, not a copy: both are rendered from the SAME fetched `fresh`
games array inside `loadBoxscores()`, just via a second `urlOfLeaders(g)` helper pointing at
`scoringleaders/?g=` instead of `summary/?g=`; the "This Weekend" hero chips at the top of the
page intentionally still only link to Game Summary, not Scoring Leaders — that wasn't asked for
and wasn't assumed), `#summaryslugs` (Game Summary Team Slugs, evergreen per-team URLs,
Black/Opaque/Copy pills via `summaryCard()`), `#leadersslugs` (Team Scoring Leaders Team Slugs,
same pattern via `leadersCard()`), `#bannerslugs` (Activity Banner Team Slugs), `#rosters`
(Game-Day Rosters, live-fetched latest release PDFs), `#brand`, `#upnext`, `#loops`, `#logos`.
Above `<main>`: a wordless **Team Pages logo strip** (all 10 clubs incl. Mako) linking to
`team/?team=<slug>`. Footer: source-repo links, **beta-only** links for pages that don't have
their own portal section yet (`scorebug/?test=1` ×2 clubs, `activity-banner/?test=1`,
`ticker/?test=1`, `preflight/`, 49ing Cockpit, Singular login) — when a page graduates to having
its own portal section (as `summary/` and `scoringleaders/` both have), it comes OUT of the
footer beta list, it doesn't get both.

## team/ — one-club aggregate view

`team/?team=<slug>` pulls together everything for one club: this club's league standings (both
PNG sizes), Game Summary (Black/Opaque), **Team Scoring Leaders**, Activity Banner, Ticker,
Scorebug (only where `BUGMAP`-wired — currently Red Devils + Inferno share the Christchurch
output; other clubs show a "not wired" note instead of a dead link), live-fetched latest roster
PDF, Up Next + DVD Loop packs, logo, and the club's **full colour palette with hex values** (a
local `PALETTES` map — every chip from the 2026 Style & Colour Guide hex cheat sheet's `DATA`
array, not just a 2-colour ink/dark pair; keep both in sync). Branding is intentionally loud: the
logo renders 2x on a gradient plate (`--p1`/`--p2`/`--p3` CSS vars set from the club's palette),
and a full-page fixed `.brand-wash` tints every section as you scroll, not just the hero. No
`?team=` (or an unrecognised one) renders a team picker grid instead. Roster matching resolves
the club's short code from `boxscores.json` (`away_code`/`home_code`) rather than a fixed table,
as a safety net against future code drift (2026-07-11: retired the legacy `WAA` short code for
Pure NZ Admirals in favour of `ADM`, matching the Style Guide TLA — see `nzihl-broadcast-rosters`
`teams.py`). All 10 clubs are covered, including Auckland Mako (stood down, no 2026 games) — its
page still renders cleanly, just mostly "no game"/"not wired"/"no roster yet" states.

## league/ — one-league aggregate view

`league/?league=nzihl` or `?league=nzwihl` (case-insensitive) is the league-only counterpart to
`team/`: that league's standings, this weekend's fixtures (filtered from the same
`boxscores.json` manifest used elsewhere, `in_core_window`-aware), a clubs directory linking out
to each member's `team/` page, roster links, and the league mark + brand guide links. Same
loud-branding treatment as `team/` but themed by a fixed `THEMES` map (gold = NZIHL, blue =
NZWIHL — this site's own accent convention, e.g. `.chip.blue`/`.league-label.blue` elsewhere;
NOT an official club-brand colour, the Style Guide only defines a generic black/white pair for
"League Marks"). No `?league=` (or an unrecognised one) renders a 2-card league picker instead.

---

## Verification workflow (what has repeatedly worked)

1. Edit → `node -e "new Function(<script body>)"` syntax check → commit/push to `main`.
2. Poll the live URL with a cache-buster until the new marker string appears.
3. Drive the page via Chrome automation: `?test=1`, click by element ref (raw coordinates
   intermittently miss), force states from the console (`holding=false; rebuild()`,
   `traveled=ENTRY+unitW+1; step()` to force a seam) and read
   `track.firstElementChild.textContent` to assert exact strip wording.
4. Real-data checks: game 2519940 (CRD/DUN, milestones), 2519941 (Final/OT — FINAL + OT-winner),
   ?team=botany-swarm (pregame preview, incl. warehouse-sourced last-meeting + head-to-head —
   verify against `matchavez/nzihl-season-data`'s committed `derived.head_to_head` directly if in
   doubt). Chrome-MCP console output REDACTS URL-like strings — re-encode (`?`→" Q ") when dumping
   links.
5. **For anything about precise layout/alignment/sizing, don't trust a screenshot alone** —
   scaled-down screenshots make small offsets (20–30px) hard to judge by eye and can look
   "left-aligned" when they're actually centred. Use the Chrome extension's JS-execution tool to
   read `getBoundingClientRect()` / `getComputedStyle()` straight off the live DOM (e.g. confirm a
   text block's left/right margins are actually equal, or that a row's real `className`/
   `flexDirection` is what the code intended) — caught a false alarm this way on 2026-07-09
   verifying `scoringleaders/ab-test.html`'s centred-text variant.
