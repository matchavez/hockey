# memory.md — matchavez/hockey

Self-context + technical reference for Claude. This file merges what used to be a
separate README.md (data contracts, URL params, gotchas — written explicitly for
AI-assisted maintenance) and memory.md (cross-repo relationships, process gotchas,
running history). They were split before 2026-07-20; merged into one file that day
at Mat's request, since both halves were already AI-facing and keeping them in sync
was pure overhead.

**README.md is a different thing entirely (as of 2026-07-20): a full human-facing
visual inventory of the whole NZIHL/NZWIHL broadcast estate** — real screenshots
and plain-language descriptions of every on-air graphic, live overlay, and producer
tool across ALL the `matchavez/*` broadcast repos, not just this one. It exists
because this repo's Portal is the front door people actually land on, so Mat wants
the full tour available right here even though several of the pictured assets
(Standings, Up Next, DVD Bounce, Keys to the Series, CIHA Lower Third, Style Guide,
Roster PDFs) physically live in sibling repos (`nzihl-broadcast-assets`,
`hockeyrosters`) or the local project folder, not in this repo's code. **Don't
treat README.md as documentation of this repo's own contents — it documents the
whole estate.** Read *this* file (memory.md) for how the code in THIS repo actually
works. README's images live in `images/` and are real captures, not mockups — they
will go stale as pages evolve; refreshing them is a manual re-capture job, not
something that happens automatically.

Part 1 below is the technical reference (read this first when touching any page's
code). Part 2 is the project history — decisions, fixes, and what's in flight,
roughly newest-relevant-context-first within each dated entry.

---

# Part 1 — Reference: how everything works

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
| `preflight/` | **Broadcast Pre-Flight** (producer tool, not an overlay): worker round-trip, manifest freshness (GitHub commits API), leaders/standings/schedule reach, per-club game resolution + BUGMAP status + box-score probe + FINAL status, copy-ready overlay URLs with per-club `?bs=`/`?tk=` tuning persisted in localStorage | — |
| `graphicstests/` | **Broadcast Graphics QA** (producer tool, not an overlay): sibling to `preflight/` — answers "does each GRAPHIC actually render" rather than "will the data resolve." Loads every overlay's real URL in a live iframe per club (using each page's own `?test=1`/`?preview=` harness where one exists — `activity-banner`/`scorebug`/`scorebug-l3`'s built-in `fireTest()`, `ticker`'s real-game `?test=1`, `startinglineup`'s `?preview=` synthetic lineup), checks the rendered DOM for broken images/placeholder text/layout overflow, plus static-asset checks (Standings PNGs, DVD Bounce corner mp4s+zips, UP-NEXT galleries) via one repo-tree fetch. Sections run on demand (or all at once) so it doesn't hammer the worker/esportsdesk on every load. | — |
| `warehouse/` | **Data Warehouse** (producer tool, not an overlay): browses the full season game archive (`nzihl-season-data`'s `nzihl.json`/`nzwihl.json` — completed games w/ streak chips + searchable/filterable table + box-score links, plus remaining fixtures) and the full player+coach photo library (`nzihl-player-photos`'s `manifest.json` — every rostered person, grouped by team, sorted by jersey #, real thumbnails or initials placeholders, missing-photo counts) on one page. Both fetched live client-side, nothing copied in. | — |
| `lowerthirds/` | **Player Lower Thirds** (producer tool, not an overlay): phone control page — tap a tonight's-roster jersey pill, preview (shares the `activity-banner/?preview=` renderer), edit/toggle an auto-computed fact, Fire through a Cloudflare Worker Durable Object control channel to the `activity-banner/` already on air | `?team=` |
| `startinglineup/` | **Starting Lineup** broadcast graphic: 1840×1000 opaque panel (transparent surround) on the bottom half of a vertical rink — six starters (LF/CF/RF/LD/RD/GK) as horizontal cards in an inverted pyramid. Evergreen browser source: state persists in the worker's `/lineup/<slug>` channel, polls every 10 s | `?team=` `?preview=` |
| `startinglineup/control/` | **Starting Lineup control** (producer tool, not an overlay): director's picker — six slot buttons, tap a slot then a jersey pill, live preview iframe (the display page itself in `?preview=` mode), team switcher, domigan gate | `?team=` |
| `startinglineup/combined/` | **Combined Starting Lineups**: both teams' starting six on ONE full landscape rink (home left / away right, home defends the left end), 12 compact cards, 1-2-3-3-2-1 — reads the same two `/lineup/<slug>` worker channels as the per-team page/control (no worker or control-page changes). `?home=`/`?away=` for an exact matchup, OR a single evergreen `?team=<slug>` (2026-07-14) that resolves the team's next fixture from `nzihl-season-data`'s `upcoming` field, same convention as `activity-banner`'s `?team=`. Bad/unknown slug, a cross-league pair, or (for `?team=`) no resolvable fixture, renders nothing | `?home=` `?away=` `?team=` `?worker=` `?previewHome=` `?previewAway=` |
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

### startinglineup/combined/ — Combined Starting Lineups (2026-07-14)

Both teams' starting six on one full landscape rink (`?home=<slug>&away=<slug>`), evergreen,
polling the SAME two `/lineup/<slug>` worker channels the per-team page and control/ already
read/write — no worker or control-page changes. Home defends the left end, away the right;
header is split (home's half-dark gradient left, away's mirrored right, title centred between).
Twelve compact ~420×90 cards (photo/crest/silhouette, same fallback convention as the per-team
page) in 1-2-3-3-2-1 reading left to right: GK / D pair (stacked) / F trio (stacked) per side,
positions derived by transposing the per-team page's vertical layout into a horizontal one (see
`nzihl_combined_lineups.md` in the Claude memory for the full derivation). `?previewHome=`/
`?previewAway=` mirror the per-team page's `?preview=` (same JSON shape, one `JSON.parse` per
side, never double-decoded). Bad/unknown slug for either param, or a cross-league pair, renders
nothing (transparent source). Each side polls and resiliences independently — one team's
unset/failed channel never blanks the other's six cards. `startinglineup/index.html`'s TEAMS
registry gained `auckland-mako` in the same commit (was missing entirely, a 2026-07-13 QA
finding — see Broadcast Graphics QA below); the combined page's own TEAMS copy includes it too.
Portal gained a schedule-driven "Combined Starting Lineups" mini-grid under the Starting Lineup
section, sourced from `nzihl-season-data`'s `upcoming` field (teamID-keyed, next 4 days) — a
deliberately different source than the rest of the portal's schedule sections (`boxscores.json`),
matching `team/index.html`'s schedule widget's reasoning (see Shared infrastructure above).

**2026-07-14 addition — evergreen `?team=<slug>` param.** Mat asked for this page to support a
single team slug "the same way as the Activity Banner Slugs" so a bookmarked URL keeps showing
the game-appropriate graphic as the schedule moves game to game, instead of needing a fresh
`?home=&away=` URL for every fixture. `resolveTeamSlug()` looks up the given slug's teamID
(now stored in the page's own `TEAMS` registry as `id`; `null` for Auckland Mako, which is stood
down and never has a fixture) and finds its soonest entry in `nzihl-season-data`'s `upcoming`
field for that team's league — the SAME source + field the schedule-driven grid above already
uses, so no new data source was added. Because `upcoming` only ever lists games that haven't
been played yet (a completed game moves into the warehouse's `games` array), "soonest entry for
this teamID" is always "this team's next game" with no extra date-window filtering, and it
naturally advances to the following fixture once the current one is played — no re-polling
needed within a single page load, an OBS browser source just needs a reload to pick up a new
resolve, same as `activity-banner`'s `?team=`. `?home=`/`?away=` still take priority when given
(the portal's per-fixture links keep using them, no network round trip needed). No resolvable
fixture (bye week, off-season, Mako) degrades to the same "render nothing" bad-slug convention
as everywhere else on this page. Portal gained a second evergreen "Combined Starting Lineups
Team Slugs" grid (Open/Copy per team, 9-team Mako-excluded list) alongside the existing
schedule-driven one, mirroring the Activity Banner Team Slugs section's pattern.

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
output; other clubs show a "not wired" note instead of a dead link), **Starting Lineup** (live
preview iframe, Open/Control/Copy) plus, since 2026-07-15, **Combined Starting Lineups**
(`startinglineup/combined/?team=<slug>` — live preview iframe, Open/Copy; resolves this club's
next fixture automatically from `nzihl-season-data`'s `upcoming` field, same as the portal's
"Combined Starting Lineups Team Slugs" grid), live-fetched latest roster
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


---

# Part 2 — Project history & context

## Portal redesign v2 → PRODUCTION (2026-07-14)
The redesign2/ preview was promoted to production the same day Mat approved it
("Put this into production, and I'll do tweaks with Sonnet"). Changes:
- `nav.js` (repo root, NEW) — the shared top bar injected on EVERY page:
  Portal + NZIHL + 6 clubs + NZWIHL + 4 clubs (crest + TLA, 13 links) + an
  Ops pill pinned far right. Also injects shared CSS bits: `.gh` (octocat
  glyph for GitHub-bound links) and `.gcode` (esportsdesk game-code pill).
  Exposes `window.RD2` — the club/league registry (slugs, TLAs, logo
  filenames, up/dvd dir names, roster repo, active flag). index.html and
  team/index.html now consume RD2 instead of carrying their own team arrays
  (league/ and warehouse/ still have their own copies — drift risk remains
  there). Include with `<script src="<path>/nav.js" data-root="<path-to-root>">`.
- `index.html` — full redesign: Game Day section merges Game Summary +
  Scoring Leaders + Combined Lineups into one card per fixture with a
  `G <gameid>` pill; per-team link walls replaced by an asset catalog whose
  crest strips route to team pages (Activity Banner + Starting Lineup keep
  full slug lists in <details> expanders — Mat's "hybrid" pick); Brand &
  Reference merges brand + logos; diagnostics/test/data links all moved out
  to `ops/`.
- `team/index.html` — one-row mast (72px plate + name + `TLA · LEAGUE` +
  palette chips inline right; crumbs dropped), consolidated roster button
  row (PDF · Roster Portal · All releases), merged Brand & Reference card,
  Player Lower Thirds card added to overlays.
- `ops/index.html` (NEW) — sub-portal for Pre-Flight, Graphics QA, test/beta
  pages, warehouse + data repos, source repos, 49ing Cockpit, Singular login.
- `league/index.html` — untouched EXCEPT the nav.js include (Mat will tweak
  with Sonnet; its own crumbs/team strip still there, slightly redundant now).
- `redesign2/` — the preview that produced all this; kept in place (not
  deleted without Mat's say-so). Its nav.js is a near-copy with a different
  league-link path; don't edit it expecting production to change.
Tweak rounds by Mat via Sonnet are expected on all of this.

## What this repo is
The live portal + every deployed broadcast overlay page for NZIHL/NZWIHL. `https://matchavez.com/hockey/` via GitHub Pages, custom domain, deploy = push to `main`. Single-file HTML overlays, no build step, 1920×1080 YoloBox browser sources.

## Page inventory (short recap — full param contracts are in Part 1's Page inventory table above)
`index.html` (portal), `team/`, `league/`, `ticker/`, `scorebug/`, `activity-banner/` (now also renders Player Lower Thirds, see below), `summary/` (Live Game Summary), `scoringleaders/` (+ `ab-test.html`, a design-experiment page not in the deployed rotation — ask before deleting once a variant is promoted), `preflight/` (producer tool, not an overlay), `warehouse/` (producer tool, not an overlay — added 2026-07-11), `lowerthirds/` (producer tool, phone control page — added 2026-07-12), `startinglineup/` + `startinglineup/control/` (evergreen starting-six graphic + director's picker — added 2026-07-13), `assets/fonts/`. `box/` was retired 2026-07-12, see below.

## warehouse/ (2026-07-11)
Single page combining two data sources that previously only had standalone/linked-out views: the full season game archive (nzihl-season-data) and the full player+coach photo library (nzihl-player-photos). Built in the preflight/-style dark producer-tool theme (--bg:#0d0f13 etc.), not the flashy portal-landing style -- this is a browsing tool for Mat, not a broadcast overlay or a public-facing showcase page.

Both data sources are fetched client-side straight from raw.githubusercontent.com (nzihl-season-data/main/{nzihl,nzwihl}.json, nzihl-player-photos/main/manifest.json) -- nothing is copied into this repo, so it's always current with whatever those two repos' latest nightly/weekly run committed. Games table is searchable/filterable (team-code select + free-text search over date/team), sorted newest-first; photo grid is sorted by team then jersey number ascending (coaches last, Head Coach before Assistant Coach), matching what Mat explicitly asked for.

Verification approach worth reusing for future client-heavy pages: before ever pushing, the full render logic (all the render*/load* functions) was dry-run in Node against LIVE data by stubbing just document.getElementById and using Node 18's native fetch -- this caught the actual data shapes and confirmed zero runtime errors well before touching a browser. After deploying, a real Claude-in-Chrome pass (navigate + screenshot + zoom + type into the search box) confirmed it live: logos, streak chips, box-score links, and the search filter all work. One false alarm during that pass -- real dark hockey-jersey photos looked like blank boxes in a compressed thumbnail screenshot; a zoom screenshot proved they were loading fine. Don't trust a low-res screenshot's absence of visible content as proof of a missing image without zooming in first.

Team registry (short_code -> display name + logo filename, 10 clubs incl. a Mako "not fielding a team" placeholder) is inlined in warehouse/index.html itself -- this is now the THIRD near-duplicate copy of this data in the repo (after team/index.html's NZIHL/NZWIHL arrays and each overlay's REG table). Same "sibling repos/pages drift silently" risk as elsewhere in this repo -- if a team's logo filename or branding ever changes, check all of these.

## Process gotchas (not always obvious from the code)
- **GitHub Pages doesn't always auto-build on push.** If a change doesn't seem to be live, POST to `/pages/builds` to force a rebuild rather than trusting the build-status endpoint — that endpoint can lag minutes behind reality. Trust a Contents-API byte match + a live reload over the build-status endpoint.
- Verify visual changes with an actual DOM inspection / live screenshot, not just "the commit landed" — several rounds of the Scoring Leaders work needed Chrome-screenshot confirmation before being called done.
- `stats_1team.cfm?...&printPage=1` (esportsdesk) is the roster data source; nzihl.com's own team pages are JS-rendered and return empty to plain fetchers — don't try nzihl.com directly.

## Related repos (data flows in)
- **matchavez/nzihl-broadcast-assets** — standings PNGs (raw.githubusercontent.com), team/league logos, brand assets, Up Next / DVD Bounce overlays linked from `team/`. Game Summary and Scoring Leaders design work is often prototyped there first (`summary/`, `previews/`) before landing here.
- **matchavez/nzihl-season-data** — `nzihl.json`/`nzwihl.json` game-level warehouse; powers streaks/H2H/last-meeting on `ticker/` and player game-logs on `scoringleaders/`.
- **matchavez/nzihl-broadcast-rosters**, **matchavez/nzwihl-broadcast-rosters** — roster PDFs and `boxscores.json` (gameid resolution); `hockeyrosters` repo/page surfaces the PDFs to talent.
- **matchavez/hockeyrosters** — separate repo/page (matchavez.com/hockeyrosters) for talent-facing roster downloads; linked from this portal.
- Cloudflare Worker (admin.esportsdesk.com no-cache origin) — all live scraping across this whole family of repos switched to this no-cache origin; this redeploy was completed and verified live 2026-06-30 (this line was stale as of 2026-07-11 and is corrected here). A SEPARATE, unrelated worker deploy is pending as of 2026-07-12 -- the Player Lower Thirds control channel, see below.

## Player Lower Thirds (2026-07-12)
New producer tool + overlay extension, built end-to-end this session per
Mat's spec. Phone-friendly control page at `lowerthirds/?team=<slug>` lists
tonight's roster as tappable jersey pills; tapping selects a player, shows a
live preview (a scaled `activity-banner/?preview=...` iframe -- the SAME
renderer as the live overlay, not a separate mock), auto-computes a fact
line (editable, one-tap toggle to omit), and "Fire" pushes it through a
Cloudflare Worker Durable Object control channel to whichever
`activity-banner/?team=<slug>` instance is already loaded in the video
mixer -- no new browser source needed.

**Data:** season stat lines come from `stats.json`, now emitted by both
roster repos (nzihl-broadcast-rosters, nzwihl-broadcast-rosters) -- see
those repos' memory.md. Tonight's game resolves from `boxscores.json`
(primary) falling back to nzihl-season-data's `upcoming` field. Photos come
from nzihl-player-photos' manifest. Facts engine checks (in priority order)
tonight's-multi-point -> active streak -> H2H series record -> leads-team ->
league-top10 -> milestone-watch, each keyed against nzihl-season-data's
`player_game_logs`/`head_to_head`/`streak` structures.

**Collision rule:** a goal/penalty auto-banner INTERRUPTS a live player L3
(kills it instantly, player returns to queued on the phone for a one-tap
re-fire); firing an L3 while an auto-banner is live is rejected. This is
enforced client-side in `activity-banner/`'s own `enqueue()` (the only party
that actually knows its local busy-state) via a dedicated `interrupt` call
back to the control channel -- not server-side domain logic.

**"One renderer" invariant:** `activity-banner/index.html`'s `showL3()` is
defined exactly once and called from exactly two places -- the live
`pollControl()` loop and the `?preview=` URL-param path used by the phone's
iframe. If this ever needs touching, grep `function showL3` first to
confirm it's still singular before assuming preview/live could have drifted
apart.

**Control channel:** `nzihl-broadcast-assets`'s `summary/worker.js` grew a
`/control/<slug>` route backed by a Durable Object (`ControlChannel`,
SQLite-backed, Free-plan compatible) -- see that repo's memory.md for the
API shape. **DEPLOYED by Mat 2026-07-12.** Full round trip verified live:
queued+fired a real player via curl, watched it render on the actual
`activity-banner/?team=pure-nz-admirals` page in Chrome (real photo/stats/fact),
confirmed the 10s auto-hide, confirmed self-heal to `queued` (not `idle`)
per the design, confirmed manual `clear` resets to `idle`. `preflight/`'s
"Player L3 control channel" check now reads green/live instead of the
amber "not deployed" fallback state.

**Consumers wired:** portal `index.html` got a "Player Lower Thirds" card
(`#lowerthirds`, evergreen per-team Open/Copy URLs, both leagues, Mako
excluded) and a "Player L3s" nav link; `preflight/index.html` got
`checkStatsJson()` (stats.json freshness per league) and
`checkControlChannel()` (worker reachability, tolerant of the pre-deploy
501/plain-text response) system checks, plus a per-club "Player L3" copy
button.

**Verified live (Chrome, this session):** real game resolution matches
today's actual boxscores.json entry; real photo+stats+fact render in
preview; no-fact/toggle-off layout shrinks with no empty gap; a no-photo
player falls back to initials and still fires; a test goal banner instantly
kills a live L3 (collision rule confirmed); AND, after Mat's worker deploy,
the full control-channel fire round trip end-to-end (queue -> fire -> live
overlay render -> auto-hide -> self-heal to queued -> clear).

**Redesigned same day, second pass (Mat's feedback after seeing it live):**
flush-bottom on the SAME edge as `#bnr` (`bottom:0`, was `bottom:120px` --
safe because the collision rule already guarantees an auto banner kills a
live L3 first, so they never actually render at once); ~1/3 smaller overall
(1000x174, noFact 130 -- was 1500x260/196); headshot switched from a
portrait rectangle to a circular photo with a 3px team-ink border ring
("framing boundary"); stat line rewritten from a single "13 GP · 6 G · 11 A"
text string to a Scoring-Leaders-style row of bold value + small unit-label
pairs (`buildL3Data()` now returns `statParts:[{val,unit}]`, not a
`statLine` string); added a team-logo end panel on the right
(`.l3logowrap`, same `LOGO`+`REG[..].logo` source `#bnr`'s crest ends use),
balanced in width against the photo panel on the left. Re-verified live via
`?preview=` for the full-fact, no-fact, and no-photo-initials states --
all correct. `hockey/lowerthirds/` also gained a simple client-side
password gate (word: "domigan", case-insensitive) at Mat's request -- same
trust model as the `CONTROL_TOKEN` already embedded in that page's source
(a static GitHub Pages file, so this is a deterrent, not real security),
persisted via `localStorage` so a producer's phone doesn't re-prompt every
reload.

**Third pass (same day, Mat's feedback after seeing the second pass live):**
- **No-photo fallback now shows the team crest on the LEFT side too** (photo
  circle), not initials -- a player with no headshot shows the SAME crest on
  both sides, balanced, instead of a crest vs. bare initials. Priority chain
  is photo -> team logo -> initials (only a team with no `REG` entry at all,
  e.g. Auckland Mako, falls all the way to initials). The crest image is
  fetched once and reused for both the left fallback slot and the always-on
  right end panel (one `logoP` promise, `Promise.all([photoP, logoP])`).
- **Line 1 (name) rebuilt to match `scoringleaders/index.html`'s
  `.pline`/`.jnum` pattern**: jersey number (smaller, bold, team-ink
  coloured) + position (team-ink coloured, same size as name) + name
  (white), all one line, built as one `innerHTML` string in `showL3()` --
  replaces the old separate name+meta lines. Line 2 (stats) bumped to the
  same base font size as line 1 (26px, was 20px) to "balance" per Mat's ask
  -- Scoring Leaders keeps line1/line2 at one shared size, only the unit
  labels shrink. Line 3 (fact) restyled italic+bold+light-grey to match
  Scoring Leaders' `.descr` treatment (was plain-weight, non-italic). Panel
  height bumped 174->180 (noFact 130->135) for clearance at the larger sizes.
- **`fitWindow()` rewritten to lock the frame's bottom-centre to the
  window's bottom-centre at any aspect ratio** (was: scale only, from a
  fixed top-left origin -- on a non-16:9 window the whole frame, including
  the L3, visibly drifted toward the top-left instead of staying centred).
  Now computes `translate(left,top) scale(s)` with
  `left=(innerWidth-1920*s)/2` (always symmetric) and
  `top=innerHeight-1080*s` (always bottom-anchored, so any letterboxing
  lands entirely at the top). Verified via live transform-matrix inspection
  for both a height-constrained and a width-constrained window shape.
- **Two bugs caught + fixed during this round's live verification** (worth
  knowing if this class of code gets touched again): (1) `showPhotoState()`'s
  "photo" branch never actually set `l3img.src` -- the circle stayed blank
  even though the image had loaded successfully; (2) the team-crest fallback
  `<div>` had an inline `style="display:none"` in the markup, which beats a
  CSS class selector's specificity, so toggling a `.show` class never
  actually revealed it -- fixed by setting `.style.display` directly in JS
  instead, matching how `l3initials`/`l3img` were already handled. Both
  caught by inspecting live DOM/computed-style state via Chrome devtools JS,
  not by screenshot alone -- default to that check first next time a "why
  isn't this rendering" bug shows up here.

Every piece of this project is now fully live, nothing left pending.

**Fourth + fifth passes (same day, two more rounds of Mat's feedback):**
- **Fourth: circular framing removed.** Went back to a rectangular photo (no
  `border-radius:50%`); the team-ink accent bar that used to sit as a thin
  5px divider between photo and body was removed as a separate element --
  it's now literally the photo's own border (`border:6px solid var(--l3ink)`
  directly on `.l3photo`, `box-sizing:border-box`), i.e. the bar was
  "extended" into a frame around the portrait rather than sitting beside it.
  Card also scaled up (1000x180/135 -> 1200x245/180) since the smaller round-2
  size left visible empty vertical space in the box.
- **Fifth: photo compressed into a SQUARE.** The rectangular photo from the
  fourth pass used `align-self:stretch` (full card height) with a fixed
  190px width -- tall and visibly elongated. Changed to
  `flex:0 0 auto;align-self:stretch;aspect-ratio:1/1` so the width is
  DERIVED from whatever height the card currently has (245 full / 180
  noFact) instead of a separate fixed number -- always a true square in
  both states, no extra JS. Applied the same to `.l3logowrap` on the right
  so the two ends stay visually balanced (both square, both sized off the
  card's live height). Card widened again (1200->1320) to give the body
  text room now that the square end-caps are wider than the old 190px
  rectangles. Text sizes bumped again in the same pass (name/stat
  26->32->38px, fact 17->22->24px) to keep pace with the bigger card.
  Re-verified live: square photo confirmed exactly matching in both full
  and noFact states (245x245 / 180x180 via computed style), no-photo
  logo-both-sides fallback still balanced at the new size.

**Sixth pass, same day:** name/position no longer the same size -- `.l3name`'s base
font-size now only drives `.jnum`/`.pos`, while the actual name text is wrapped in its own
`.nametext` span at `1.25em` (~25% bigger than jersey/position, not equal, per Mat's explicit
"only ~25% bigger"). `.pos` also got `margin-right:.22em` for breathing room before the name
(was a single plain space). Body padding (buffer between photo/logo and the text) bumped
34px->51px (1.5x, "half-again as much space" per Mat), panel widened 1320->1360 to compensate
so the text column doesn't lose room. Verified live via `?preview=`.

**Seventh pass, 2026-07-12:** two small fixes to `lowerthirds/`. (1) The pre-game
"confidence alert" banner in `activity-banner/index.html` (`#pre`, shown before puck-drop)
was firing on EVERY page load including `?preview=` mode, which meant the phone-page preview
iframe always had it stacked over the L3 test render. `start()` now only calls
`showConfidenceAlert(PREGAME)` when there's no `preview` query param -- verified live via
computed style (`display:none`, `opacity:0` on `#pre` with `?preview=` set). (2)
`lowerthirds/index.html`'s control card was showing four separate things (preview iframe,
status text, a full-width CLEAR row with a redundant `selectedLbl` name/number readout, FIRE
button) when the preview graphic itself already displays the player's name/number -- so
`selectedLbl` was pure duplication. Removed `.controlRow`/`#selectedLbl` entirely (and the
matching JS writes in `selectPlayer()`, the clear handler, and `start()`'s control-state
adoption), moved `#clearBtn` to a small absolute-positioned corner button inside the preview
card itself, and tightened header/factBox/groupTitle spacing so the whole page reads as
"preview graphic + queued/fire header + fact box + pills" per Mat's ask. Verified live:
selecting a player, clearing, and page-load state adoption all work with no console errors.

**Bug fix, 2026-07-12 (Mat: "Toby Schuck isn't working"):** `activity-banner/index.html`'s
`?preview=` handler double-decoded the param -- `Q.get("preview")` (URLSearchParams) already
URI-decodes once, but the code then called `decodeURIComponent()` on it AGAIN. That's harmless
for plain text but throws `URIError: URI malformed` for any fact/name containing a literal "%"
not followed by two hex digits -- which is exactly what a goalie's auto-suggested SV% fact
looks like ("Toby Schuck stopped 73.3% of shots..."). The error was caught by an existing
`catch(e){ /* show nothing */ }` with no logging, so it failed completely silently: blank
preview, no console error, looked like the player was just broken. Root-caused by calling
`showL3()` directly in the Chrome console (worked fine) vs. going through the real `?preview=`
URL (failed), then bisecting down to the decode step. Fixed to `JSON.parse(PREVIEW)` (single
decode, matching what `lowerthirds/index.html`'s `updatePreview()` actually sends), with the
old double-decode kept only as a fallback if the single-parse throws, for safety. Verified live
both via a direct `?preview=` URL and via the real phone-page pill-tap flow for Toby Schuck
(DUN #58) -- photo, stats (9 GP · 4.13 GAA · .864 SV% · 0 SO), and the %-containing fact all
render correctly now. This bug would have hit ANY player (not just Schuck) whose name or
computed fact happened to contain a bare "%" -- goalie SV% facts are the most likely trigger.

See Claude's `nzihl-player-lower-thirds` cross-session memory for the full
design-decision log (this is the "built" follow-up to that memory, which
previously said "not built yet" -- update that memory too if revisiting).

**`?nobanner=1`, 2026-07-12 (Mat: "It's not working on the Canterbury Inferno page
.../scorebug/?team=canterbury-inferno"):** turned out `scorebug/index.html` is a totally
separate, self-contained page (Singular scoreboard iframe + its own goal/penalty banner +
pregame alert) that never got Player L3 support built into it -- firing from the phone posts
to the same control channel fine, but scorebug/ has nothing listening for it. Mat confirmed
`activity-banner/` (the intended L3 platform) does work, and chose to add it as a SECOND
browser source over `scorebug/` for teams needing both, rather than porting L3 support into
scorebug/ itself. Problem: both pages independently poll the same box score for goal/penalty
events and both show a pregame confidence banner, so naively layering them would double-fire
both. Added `activity-banner/?team=<slug>&nobanner=1` -- suppresses `showConfidenceAlert()`
and the `fireGoal()`/`firePen()` calls in `tick()` (goal/pen signatures are still tracked even
while suppressed, so toggling the flag mid-game can't backfill a burst of missed events) while
leaving L3 polling/firing completely untouched. Verified live for Canterbury Inferno (CIN):
`NOBANNER===true`, `#pre` stays `display:none`, and a real control-channel fire for Gabrielle
Guerin (#10) still rendered correctly. Production setups needing both a persistent scoreboard
AND Player L3s should run `scorebug/?team=<slug>` (as before) PLUS
`activity-banner/?team=<slug>&nobanner=1` as a second layered source.

**`scorebug-l3/index.html`, 2026-07-12 (Mat changed his mind — can't run two layered
browser sources):** instead of `activity-banner/?nobanner=1` as a second source, built a full
standalone COPY of `scorebug/index.html` with Player L3 support ported in directly, at a new
URL (`scorebug-l3/`), leaving the original `scorebug/index.html` completely untouched as a
same-day fallback in case anything goes wrong. Ported straight from `activity-banner/`'s
current (already-verified) L3 implementation: the `#l3` CSS/HTML, `CONTROL_TOKEN`/
`STATS_URLS`/`PHOTO_MANIFEST_URL`/`PHOTO_BASE`/`CODE_LEAGUE`/`TEAM_DISPLAY_NAMES`/
`TEAMID_CODE`, `getStats`/`getPhotoManifest`/`standingsRowFor` (needed adding `SCRAPE_HOST`,
which scorebug/ didn't have), `buildL3Data`/`showL3`/`initialsOf`/`hideL3`, and
`pollControl`/`reportInterrupt`/`bannerBusy`. Also added the L3-interrupt guard to `enqueue()`
and an `if(typeof LAST_PARSE!=="undefined") LAST_PARSE=P;` line to `tick()` (feeds the L3
TONIGHT chip) — both verbatim from activity-banner. Hooked `TEAM_SLUG` + `pollControl()` +
`setInterval` into `start()`. No `NOBANNER` flag needed here (unlike the `?nobanner=1` approach)
since this is a single unified source, not a layer. `node --check` clean, no duplicate
identifiers. Verified live for Canterbury Inferno: scoreboard (INF vs WLD) and pregame banner
render exactly as before, and firing Jessie Strain (#19) through the real phone-page FIRE
button rendered the L3 correctly at the bottom while the scoreboard stayed visible at top.
Production recipe for teams needing this: `scorebug-l3/?team=<slug>` as the single source
(replaces `scorebug/?team=<slug>` — same Singular scoreboard, same banner, now also L3s).
`scorebug/index.html` itself was NOT modified.

**Seventh pass, 2026-07-12 (Mat, after the scorebug-l3 work): narrow + centre + never-ellipsis.**
Applied identically to BOTH `activity-banner/index.html` and `scorebug-l3/index.html` (kept in
parity since they're now two independent copies of the same L3 code): card width 1360->1320px
(40px narrower), `.l3name`/`.l3stat` given `text-align:center` (was left-aligned within the
full-width body column), and CSS `text-overflow:ellipsis` truncation replaced with a JS
shrink-to-fit — reused the existing `fitLine(el,base,min)` helper (already used for the pregame
banner text, same "never ellipsis, shrink font instead" pattern) called as
`fitLine(l3name,38,20)` / `fitLine(l3stat,38,20)` right after `l3.classList.add("show")` in
`finishPhoto()`, with a forced reflow (`void l3.offsetWidth`) first since clientWidth reads 0
while `#l3` is still `display:none`. Verified live: a normal name (Toby Schuck) renders
narrower + centered; a deliberately absurd stress-test name ("Maximilian Wolfgang-Harrington
Alexander III") shrinks to fit on one line with zero truncation/ellipsis in both files.

**Eighth pass, 2026-07-12: centre + balance the fact line.** Same-day follow-up to the
narrow/centre/never-ellipsis pass — the fact line (`.l3fact`) was still left-aligned and, when
it wrapped to two lines, could look ragged (a full first line + a short leftover second line).
Added `text-align:center` and `text-wrap:balance` (both files, kept in parity). Verified live
with a fact long enough to force a two-line wrap in both `activity-banner/` and `scorebug-l3/`
— lines come out visually balanced instead of ragged. Pre-existing `max-height:2.6em` still caps
it at ~2 lines (unrelated, unchanged) — a 3rd-line-worth of fact text still gets clipped, same
as before this pass.

**Ninth pass, 2026-07-12: compress pill grid 40% + inline fact toggle.**
`lowerthirds/index.html` only -- `.pill` height 52px->31px (40% reduction, "so we have a better
chance of seeing it without scrolling") and `.factBox` restructured to a flex row so the
"Include fact" switch sits inline to the LEFT of the fact textarea (compact vertical
switch+label column) instead of stacked on its own row above it. Verified live: full page
(preview + fact box + both team pill grids) now fits without scrolling on a phone-sized
viewport; pill tap/preview/toggle all still function correctly.

**Pending, flagged for Mon 2026-07-13 afternoon: clean up the L3 setup.** Mat asked for a note
to revisit and consolidate. Current loose ends: (1) original `scorebug/index.html` was kept
untouched as a same-day fallback for the 2026-07-12 Inferno game -- decide whether it's still
needed now that `scorebug-l3/index.html` (same page + L3s) is the one actually being used, or
whether it should be retired/redirected; (2) `activity-banner/`'s `?nobanner=1` flag was built
for the two-layer approach Mat then abandoned in favour of `scorebug-l3/` -- confirm whether
anything still uses it before leaving it in place; (3) `scorebug-l3/` and `activity-banner/`
now each carry an independent COPY of the same Player L3 code (CSS+JS) -- fine for now, but
worth deciding if/how to de-duplicate before more L3 iteration rounds land, since every future
L3 tweak has to be applied to both files by hand (as this session's narrow/centre/balance
passes were).

## box/ retired (2026-07-12)

Mat asked to remove it, on the assumption it had no other dependents. It actually had two: the
"Box" copy-URL button in `preflight/`'s per-club panel, and the box-score link on every
completed-game row in `warehouse/`'s game archive table -- both built `box/?g=<gameid>` links.
Flagged this before deleting; Mat's call was to repoint both straight at the live esportsdesk
`hockey_boxscores.cfm` origin instead of removing the links or building a replacement page.
`preflight/` now reuses its existing `boxURL(m,gid)` helper for the copy button. `warehouse/`
gained an equivalent `boxScoreURL(leagueKey,gid)` helper (it didn't have direct esportsdesk
access before -- `renderGamesLeague()` used to take a `boxHref` string param pointing at
`../box/`, now takes no such param and builds the URL itself). No other repo/page linked to
`box/` -- confirmed via a full-repo grep before deleting. `README.md`'s `box/` doc row/section
removed, replaced with a short retirement note.

## Photo + season-data warehouse estate-wide audit + migration (2026-07-12)

Full-estate audit per Mat's request, covering both leagues on every graphic/overlay/page
against the two warehouses ([[nzihl-player-photos]], [[nzihl-season-data]]). Full findings
committed as `warehouse-audit.md` at repo root (repo/surface -> photo source, data source,
real-time?, action taken/reason).

**Photo migration shipped (commit a21c51c):** `activity-banner/` (goal/pen banner scorer
photo), `scoringleaders/index.html` + `ab-test.html`, and `summary/` (Game Summary) were all
still naive-guess -> esportsdesk `rosters_profile.cfm` live fallback ONLY -- none of them tried
the photo warehouse first, even though Player L3s (added the day before, in `activity-banner/`,
`scorebug-l3/`, `lowerthirds/`) already did. Added `warehousePhotoFor(teamID, no)` to each: looks
up `nzihl-player-photos`' `manifest.json` by team code + jersey number BEFORE the naive guess.
Fallback chain everywhere is now: warehouse manifest -> naive `<FirstLast>.jpg` guess ->
`rosters_profile.cfm` live profile-page scrape -> initials placeholder (unchanged tail, just a
new head). `ab-test.html` (already known throwaway, not linked anywhere -- see [[nzihl-scoring-leaders-project]])
got a lighter version keyed directly off team code since it doesn't carry `TEAMID_CODE`.
**Deliberately NOT touched:** `nzihl-broadcast-assets/summary/index.html` +
`previews/game-summary.html` -- confirmed via that repo's own memory.md these are
design/prototype workspace, not the deployed page (deployed = this repo's `summary/`) --
migrating dev-sandbox files mid-iteration wasn't worth the churn. `box/index.html`'s
`admin.esportsdesk.com/media/leagues/6795/graphics/` use is team LOGOS, not player headshots
-- out of scope.

**Season-data side: verified, found a real bug, did NOT migrate scoring-leaders' totals.**
Reproduced live `stats_1team.cfm` season totals via `nzihl-season-data`'s `player_game_logs`
for 2 teams/league (ADM/CRD nzihl, AST/CIN nzwihl). ADM/CRD/AST matched exactly. **CIN did
not** -- found a genuine parser bug in `nzihl-season-data`: a parenthetical nickname/maiden
name in an ASSIST name (not just the scorer's own name, which was already fixed) corrupts the
goal-line regex, e.g. game 2520003 stored as `who:"Gabrielle Guerin (Reagyn Shattock",
assists:["Niskakoski)"], teamID:null` -- the goal silently drops out of both players' totals.
Same bug recurred in game 2520016 via "Lucy-Jane(LJ) Hart"'s own nickname paren. Ruled out a
freshness gap first (triggered a `workflow_dispatch`, confirmed the newest CIN game was already
included, discrepancy persisted) before concluding it's a real parsing bug. Per Mat's standing
instruction, scoringleaders stays on its live `stats_1team.cfm` Worker fetch -- did not switch.
Flagged to Mat as a fast-follow for `nzihl-season-data`: port the existing "greedy name capture"
fix (already applied to scorer names) to assist names too.

**Other findings, not actioned this pass (see `warehouse-audit.md` for full detail):**
`stats.json` (feeds Player L3 stat lines, built into both roster repos) duplicates
`nzihl-season-data`'s purpose but not its mechanism -- left alone since it shipped 2026-07-11
and nzihl-season-data currently has the bug above. Pregame team-standing-position text in
`activity-banner`/`scorebug-l3`/`ticker` (one-shot live `standings.cfm` fetch) is a genuine
migration candidate to `nzihl-season-data` but that repo doesn't store a standings table yet --
flagged rather than shipped unverified.

**`reddevils-nzihl-integration` retired 2026-07-12.** Was flagged as a migration candidate in
the audit above; Mat confirmed the same day it's a dead one-off ("probably didn't get used, no
longer my problem") and asked it dropped from tracking entirely. Local deliverable files (the
folder, zip, and plan doc in the project folder) left untouched at his request -- just no
longer audited or referenced anywhere in this repo or memory going forward.

## Pregame standings migrated to nzihl-season-data (2026-07-13)

Closed out the migration candidate flagged in the 2026-07-12 warehouse audit above
(`warehouse-audit.md` finding #3). `activity-banner/` + `scorebug-l3/`'s
`standingsRowFor(league, code)` and `ticker/`'s `fetchStandings()`/`STAND`/`standOf()` each did
a one-shot live `standings.cfm` fetch purely for pregame banner text (coach Player L3
record+rank stat line; ticker's pregame "sits Nth" confidence line). [[nzihl-season-data]]
grew a `standings.py` scraper (`derived.standings`) that captures the table esportsdesk already
computed VERBATIM -- rank order + W/L/OTW/OTL/PTS as scraped, deliberately not recomputed
client-side (NZIHL/NZWIHL's exact points-per-result rules aren't reliably known here, and
getting that math wrong on a live broadcast graphic is a bad failure mode).

All three pages now fetch `SEASON_DATA_URL[league]` instead. Return shapes unchanged, so
`buildL3Data()`/`pregameItems()` needed zero changes. `activity-banner`/`scorebug-l3`
simplified further: since `derived.standings` entries carry our canonical `code` directly, the
old `TEAM_DISPLAY_NAMES` fused-name-matching table (needed to match standings.cfm's concatenated
"TeamNameTLA" cell text) is gone as dead code -- direct code match instead. Same
graceful-omit-on-failure behavior in all three (no esportsdesk fallback tier -- not
real-time-critical the way the box-score poll is).

**Verified 2026-07-13:** `derived.standings` spot-checked against a fresh live `standings.cfm`
fetch for every team in both leagues (5 NZIHL + 4 NZWIHL, not just a sample) -- exact match on
rank order and every column. Live-verified in Chrome: `activity-banner/?team=pure-nz-admirals`
coach L3 rendered "7-6-1-0 RECORD · 2nd IN NZIHL" (matches warehouse exactly);
`scorebug-l3/?team=auckland-steel` coach L3 rendered "8-0-0-0 RECORD · 1st IN NZWIHL";
`ticker`'s `fetchStandings()`/`standOf()` confirmed correct for both leagues via direct console
calls (pregame line text unchanged in format, just a different source). Grepped all three files
post-migration: no live `standings.cfm` fetch remains anywhere in them. Real-time behavior
(goal/pen banners, live ticker recap, box score) untouched -- only the one-shot pregame fetch
moved.

**Known tradeoff (flagged to Mat, not blocking):** `nzihl-season-data` only updates nightly
(16:30 UTC) -- a game played earlier the same day as tonight's broadcast may not be reflected in
`derived.standings` yet, same freshness profile already accepted for H2H/last-meeting/streaks
elsewhere in this repo. `workflow_dispatch` on that repo forces a same-day refresh if a specific
broadcast needs tighter freshness.

## Recent focus (as of 2026-07-10/11)
Team Scoring Leaders (`scoringleaders/`) just went through five iteration rounds ending in a Chrome-screenshot-confirmed final layout (fitPlayerText, styling, descriptor variety). Team page just gained a schedule/results widget (top-right of idcard). If resuming Scoring Leaders work, re-verify current live state first — this went through a lot of back-and-forth before landing.

## startinglineup/ (2026-07-13)
Evergreen starting-six graphic + control page (full contract in Part 1's `startinglineup/`
section above). Worth remembering beyond that: state lives in the worker's `/lineup/<slug>` route — added to
`nzihl-broadcast-assets` `summary/worker.js` (commit 65aaffd) reusing the existing
ControlChannel DO under a separate "lineup" storage key, so redeploy needs NO wrangler.toml
migration, just `wrangler deploy` from `summary/` (Mat's manual step, same as the L3 channel).
Until redeployed, `/lineup/` falls through to the box-score proxy ("missing ?url", 400) — both
startinglineup pages and preflight's "Starting Lineup channel" card detect that and degrade
gracefully. Control page shares the L3 gate's `l3_gate_ok` localStorage key deliberately (one
unlock covers both producer tools). Display cards use the same photo→crest→(silhouette when
unset) fallback convention as the L3.

## Playoff-readiness audit (2026-07-13)
Full operational audit ahead of playoffs -- see `playoff-readiness.md` at repo root for the full
findings table. Changes made in this repo:

- **Overlay regression guard** added to all 5 live pollers (`scorebug/`, `scorebug-l3/`,
  `activity-banner/`, `ticker/`, `summary/`): each tracks the last-accepted goal/pen counts (or
  score+event counts for ticker/summary) and skips a tick entirely if a new read comes back LOWER
  than the last good value -- defends against esportsdesk's documented short/incomplete-200
  flakiness corrupting the event baseline or flashing a regressed score live. Verified live in
  Chrome (gameid 2519943) by monkey-patching each page's own `parse()` in the console to return a
  truncated result and confirming the guard state / on-screen render didn't move.
- **`scripts/check-surname-overrides.js`** + **`.github/workflows/check-consistency.yml`**: the
  SURNAME_OVERRIDES map is duplicated across all 5 overlay files above (grown from a previously
  documented 4 to 5 when scorebug-l3 was created 2026-07-12 -- nobody updated the tracking memory
  at the time). This CI check diffs the literal across all 5 on every push and fails loudly on
  drift, rather than consolidating 5 already-live independently-iterated pages into a shared
  module 3 weeks before playoffs.
- **`preflight/index.html`**: added `checkSeasonData()` (nzihl-season-data freshness, both
  leagues) and `checkPhotoManifest()` (nzihl-player-photos manifest.json freshness, >10-day warn
  threshold matching its weekly cadence). Previously only boxscores.json/stats.json/control
  channels were checked.
- **`.github/workflows/force-pages-build.yml`** (new): POSTs `/pages/builds` on every push to
  main so this repo's well-documented "Pages doesn't always auto-build" gotcha (see Process
  gotchas above) never depends on someone remembering the manual trick. Verified via the Actions
  API -- ran green and visibly queued a follow-on Pages build.
- **Bug found in a SIBLING repo, not this one:** `nzihl-broadcast-assets/summary/worker.js`'s CORS
  allowlist never included `schedules.cfm`/`stats_hockey.cfm` -- this is why preflight's
  "leaders"/"schedule" system cards and the club board's FINAL-status chip have always failed
  (403 from the Worker itself, not esportsdesk). Fixed there; needs Mat's `wrangler deploy`.

## Maintenance note
This file used to be split across README.md + memory.md (technical reference vs. AI
self-context) — merged 2026-07-20 at Mat's request, since both files were already
AI-facing and the split just created a two-file sync burden. This file (memory.md)
is the single source of truth for how the code in this repo works AND the running
history of decisions/fixes — when you change a parser, a data contract, or a
convention, update the relevant Reference section above in the same commit.

**README.md's role changed again the same day** — an initial short human-facing
overview was replaced, at Mat's explicit follow-up request, with a full real-
screenshot visual inventory of the ENTIRE broadcast estate (see the top-of-file
note above). README.md is NOT kept in sync with this file and does not describe
this repo's code — don't confuse edits to one for the other. If a NEW page/overlay
ships in this repo, it should probably get an entry (with a real screenshot) added
to README.md's inventory too, but that's a separate, manual, estate-wide document —
check with Mat before assuming its structure/scope should change.

## Broadcast Graphics QA (2026-07-13)
New sibling page to `preflight/`: `graphicstests/index.html`. Preflight answers "will the data
resolve tonight" (worker/manifest/pipeline health); this answers "does each GRAPHIC actually
render correctly, right now, for every club" by loading the real overlay URL in a live iframe per
club and checking the rendered DOM (broken images, empty/placeholder undefined-NaN text, layout
overflow) rather than just checking that data resolved.

**Per-family test mechanism** (reuses each page's own existing test harness rather than building a
separate one):
- `activity-banner/`, `scorebug/`, `scorebug-l3/`: `?team=<slug>&test=1`, then calls the page's own
  `fireTest()`/`TEST_TEAMS` via `contentWindow.eval()` (NOT `win.TEST_TEAMS` directly — top-level
  `const`/`let` never attach to `window`, only function declarations do; this cost a full false-FAIL
  debugging cycle before landing on eval).
- Player Lower Thirds (rendered via `activity-banner/`'s `#l3`, no separate page): drives it with
  `?team=<slug>&preview=<json>` — a synthetic `{player:{team_code,name,number,role,position},
  fact,include_fact}` payload, same shape the phone control page (`lowerthirds/`) sends live.
- `ticker/`: `?team=<slug>&test=1` — real prior game (2519940) through the live parser, `?team=`
  still drives that club's crest/colour.
- `summary/`, `scoringleaders/`: plain `?team=<slug>&bg=opaque` — both already have a `LAST_GAME`
  fallback so they render real data with no test flag needed. Auckland Mako has no `LAST_GAME`
  entry (stood down) so its "no game found" is scored as an expected PASS, not a failure.
- `startinglineup/`: `?team=<slug>&preview=<json>` synthetic 6-slot lineup.
- `team/`, `league/`: plain URL, checked for `#idcard`/`#games-grid` population.
- Static assets (Standings PNGs, DVD Bounce corner mp4s+zips, UP-NEXT galleries): direct
  `Image()`/GitHub-tree checks, no iframe.

**Real bugs found and fixed while building this (all verified live, not just in theory):**
1. `win.TEST_TEAMS`/`win.ACTIVE_TEST_TEAMS` read as `undefined` from outside the iframe (the
   const/let-doesn't-attach-to-window issue above) — every club showed a false "no TEST_TEAMS"
   FAIL regardless of the actual page. Fixed with `contentWindow.eval()`.
2. `imgOk()` originally flagged ANY `<img>` in the whole document with no loaded `naturalWidth`,
   including elements that are blank BY DESIGN when inactive (`l3img`/`l3logo`/`gavImg` before any
   L3/rare-state fires) — not just genuinely failed loads. This was the actual root cause of a
   "broken images" false-FAIL wall across Activity Banner/Scorebug/Scorebug+L3, confirmed by
   checking `naturalWidth` directly via the console on the real page (banner crests loaded fine,
   naturalWidth 2114; only the by-design-empty ones read 0). Fixed: an `<img>` with no `src` ever
   assigned is treated as inactive-by-design, not broken.
3. Static-asset checks originally fired ~30 unauthenticated `contents/<path>` GitHub API calls
   (one per file per club) — tripped the 60/hr/IP unauthenticated cap and surfaced as false
   FAIL/WARN 403s. Replaced with a single `git/trees/main?recursive=1` fetch (sessionStorage-cached
   10 min) that all 20 per-club checks read from client-side.
4. **Genuine finding, RESOLVED 2026-07-14 (not fixed here, flagged to Mat at the time):**
   `startinglineup/index.html`'s internal `TEAMS` registry was missing `auckland-mako` entirely
   (only 9 of 10 clubs) — a `?preview=` test for Mako rendered all 6 slots empty because `T`
   resolved to `null` and the page silently no-opped rather than throwing. Every other
   Mako-facing surface (DVD Bounce, UP-NEXT, portal roster list, Summary/Leaders' explicit
   stand-down handling) already accounted for Mako being stood down; Starting Lineup's roster
   table was the one place that didn't. Fixed as part of the Combined Starting Lineups build (see
   below) — Mako added to both `startinglineup/index.html`'s and the new `startinglineup/
   combined/`'s TEAMS registries. `lineup` family re-run 2026-07-14: 10/10 PASS (was 9 pass/1
   warn).

**Design notes for future maintenance:**
- Test iframes are mounted directly into their visible (scaled, e.g. 0.16×) thumbnail slot at
  creation and never moved or rendered off-screen — an earlier off-screen (`left:-99999px`)
  version was suspected of browser-throttling image loads (a red herring in the end, but keeping
  iframes visible from creation is still the more correct design regardless).
- Each family is opt-in ("Run" button) rather than auto-running on load like Preflight's system
  cards — ~98 checks across live iframes is much heavier than Preflight's handful of fetches, so
  auto-running everything on every page view would be irresponsible. Static-asset checks (cheap:
  4 Image() loads + 1 tree fetch) DO auto-run on load, matching Preflight's philosophy for
  lightweight checks.
- Portal footer links `graphicstests/` next to `preflight/` in both the top pill-row and the
  bottom beta-links list.

## Control-page load resilience fix (2026-07-14)
Mat reported `startinglineup/control/?team=...` (and "any other control page") sometimes doesn't
load. Code review (not a live repro) found two real, unguarded failure modes in both
`startinglineup/control/index.html` and `lowerthirds/index.html`: (1) every `localStorage`
call was unwrapped — `startinglineup/control`'s very first executable statement was
`localStorage.getItem(LAST_TEAM_KEY)`, so a throw there (Safari Private Browsing forces
`setItem` to throw via `QuotaExceededError`; some Safari versions have thrown on `getItem` too)
killed the entire inline `<script>` before even the gate's button handlers were bound — page
shows the gate forever, does nothing. Both files' `tryUnlock()` also called
`localStorage.setItem(GATE_KEY,"1")` *before* `unlockGate()`, so a throw there silently blocked
unlock even with the correct password. (2) No timeout on any fetch — worker GET/POST,
`stats.json`, `manifest.json`, control-channel GET/POST, season-data lookups — so a hung
endpoint left `start()` awaiting forever with no error and no retry.

Fixed in both files: `safeGet`/`safeSet` wrappers around every `localStorage` call (try/catch,
never throw), `tryUnlock()` now calls `unlockGate()` unconditionally regardless of whether the
write succeeded. `fetchWithTimeout()` (AbortController, 8-10s per endpoint) wraps every fetch;
an outer `withTimeout()` watchdog around `start()`'s init sequence (15s) plus a `ROSTER.length`/
`TEAM_DATA` emptiness check surfaces a new `#loadFail` notice (reuses `.notice`/`.notice.err`
styling) with a Retry button (`location.reload()`) if init still fails or comes back empty. No
changes to `worker.js`/`ControlChannel` DO — client-side only.

**Verified live (not just reasoned about), via `Prompts/sonnet-prompt-10-...md`:**
- localStorage failure mode: overrode `Storage.prototype.getItem`/`setItem` to throw (simulating
  worse than real Private Browsing, which normally only throws on `setItem`) via a fresh-realm
  `document.write()` harness (needed since JS globals persist across repeated `document.write`
  calls in the same window — a same-window redeclaration `SyntaxError` was a red herring on the
  first attempt, not a real bug). OLD code: password entered correctly, Unlock clicked/called
  directly — nothing happens, gate stays up forever (confirmed dead). NEW code: unlocks and loads
  the full roster despite both calls throwing.
- Fetch-timeout failure mode: `?worker=<hanging endpoint>` (httpbin.org/delay/60, query-string
  trick to dodge httpbin's route matching) on the real live page — old code would have hung
  `Promise.all` forever; new code's `fetchWithTimeout` aborted at ~8s, surfaced the existing
  "can't reach the control worker" notice, and the roster/preview still rendered fully.
- Happy path regression, both pages, live in Chrome: real password unlock, roster/pill grid
  loads, a real slot pick (LD → Owen Gouin) saved and previewed correctly, then reverted back to
  the real Admirals lineup (Justin Daigle #47) to leave production state untouched.
  `lowerthirds/?team=pure-nz-admirals` also confirmed loading cleanly (matchup resolved, pill
  grids for both teams, existing queued state intact) with zero console errors.

Commit `e160011`. See also [[nzihl-starting-lineup]], [[nzihl-player-lower-thirds]].

---
## Combined Starting Lineups (2026-07-14)
Built from a Sonnet handoff prompt (`Prompts/sonnet-prompt-11-combined-starting-lineups.md` in
the Claude project folder), spec locked the day before. `startinglineup/combined/?home=<slug>
&away=<slug>` — both teams' starting six on one full landscape rink, home left / away right.
Deliberately reuses the per-team page's own `/lineup/<slug>` worker channels (two independent
polls, one per side) — **zero worker or control-page changes**, this was a hard constraint from
the spec and held throughout.

Build notes worth keeping beyond Part 1's reference entry above:
- **Card layout** (12 cards, 1-2-3-3-2-1) was derived by affine-transposing the per-team page's
  vertical single-team layout (GK/D/F positions) into a horizontal one, then manually pulling the
  two CF cards (home's and away's) further from the centre seam than a pure transpose gave —
  the raw transpose put both CF centres only 180px apart, which collides at any card width worth
  using. Final: 420×90 cards, home columns at x≈{230(GK),560(D),690(F)}, away mirrored, full
  position table in the file's own header comment.
- **Rink SVG** is NOT a rescaled copy of the half-rink — the per-team page's half-rink maps
  "width" to the rink's actual width and "height" to length-from-centre, so a literal transpose
  of that geometry (swap x/y) actually corrects itself into good full-rink geometry for the
  circles' hash-mark/bracket detail (verified by hand: the transposed brackets land
  toward/away-centre-ice, i.e. left/right of each dot, and hash marks land toward the side
  boards, i.e. top/bottom of each circle — matches real rink convention). One symmetric local
  template (hash ticks + brackets) is reused via `<g transform="translate(...)">` at all 4
  circle centres rather than duplicated/mirrored by hand.
- **Two real bugs found only by Chrome-screenshotting the first build** (both fixed, both
  Chrome-reverified before shipping): (1) the away header half used
  `flex-direction:row-reverse` + `justify-content:flex-end`, which (row-reverse's main-end is the
  LEFT) packed the away team name toward centre, colliding with the centred "STARTING LINEUPS"
  title — fixed by dropping row-reverse entirely and just swapping the away half's DOM order
  (name before logo) with plain `justify-content:flex-end`. (2) `.hdrTeam`'s `max-width:300px`
  was overly conservative and ellipsis-truncated "Dunedin Thunder Women" — there's ~600px of
  real clearance before the title's footprint on each side; widened to 480px. **Lesson: don't
  trust hand-reasoned CSS flex math on a split/mirrored header without an actual screenshot —
  both bugs were invisible from reading the code.**
- Mako QA finding fixed in the same commit: `startinglineup/index.html`'s TEAMS registry was
  missing `auckland-mako` entirely (flagged 2026-07-13 in the Graphics QA build, see below) —
  added to both the per-team page and the new combined page's TEAMS copy, ink/dark pulled from
  the hex-cheat-sheet-derived values already used by scorebug/activity-banner's Mako entries
  (`#62656A`/`#202222`), logo filename from the same registries.
- Portal's new "Combined Starting Lineups" mini-grid deliberately sources `nzihl-season-data`'s
  `upcoming` field (teamID-keyed) rather than `boxscores.json` like the rest of the portal's
  schedule sections — avoids the raw-name ambiguity (`upcoming` entries say "Red Devils" and, in
  NZWIHL, "Dunedin Thunder" for the women's team) the same way `team/index.html`'s schedule
  widget already does. Window = next 4 days (`daysPast` in [-4,0]), matching the portal's usual
  lookahead. Verified against the real 2026-07-14 fixture list: home/away resolve correctly
  (home -> `home=` param, renders left) with no reversal.

**Verified live in Chrome (not just reasoned about):** preview renders for one NZIHL matchup
(Admirals/Swarm) and one NZWIHL matchup (Steel/Inferno), plus a long-name stress test on Dunedin
Thunder Women/Wakatipu Wild (29-char single-line name, two 2-line-wrap names) — all 12 cards
legible, no clipping, no overlaps. Cross-league pair and an unknown slug both render a fully
empty `document.body` (confirmed via `body.innerHTML.trim().length === 0`), no JS errors. Full
live round trip: set Botany Swarm's LF via the real control page (gate password `domigan`,
already known from prior sessions), confirmed it on the combined page's INITIAL load; then, with
the combined page already open, POSTed a second change directly to the worker and watched it land
in place within one ~10s poll cycle with no reload — proves the per-side independent polling
actually works, not just the happy-path first paint. Test data cleared from Botany Swarm's live
channel afterward. Per-team regression: `?team=pure-nz-admirals` unchanged (same real six as
before), `?team=auckland-mako` now renders instead of blanking. Graphics QA page: new `combined`
family 2/2 PASS; `lineup` family now 10/10 PASS (was 9 pass/1 warn — the Mako gap is gone).

Deliberately NOT done (left for a visual-tweak round, per the spec's own expectation — the
per-team graphic went through several before landing): card shadow/entrance-bounce tuning to
match the per-team page's later polish rounds (this build used the per-team page's ORIGINAL
values, scaled down, not its final post-polish ones); position labels are LW/C/RW/LD/RD/G
(abbreviated, spec explicitly allowed this) rather than the per-team page's FORWARD/DEFENSE/
GOALTENDER — not reconciled, may be worth Mat's call either way.

Commits: `9b6e365` (initial build), `681ea44` (header row-reverse fix), `357620c` (header
max-width fix). See also [[nzihl-starting-lineup]], [[nzihl-graphics-qa-project]],
[[nzihl-season-data-warehouse]], [[nzihl-team-page-schedule-widget]].

### Combined Starting Lineups: evergreen `?team=<slug>` param (2026-07-14)
Mat: "they also need a team slug ... same way as the Activity Banner Slugs; if a team uses their
slug, it will update over time to ensure they have the game-appropriate graphic." Added
`?team=<slug>` as an alternative to `?home=&away=` on `startinglineup/combined/index.html`.

`TEAMS` gained an `id` field per team (the same teamIDs the portal's `SL_TEAMID` map and every
other REG-style registry in this repo already use) — `null` for `auckland-mako` (stood down, no
2026 games, never appears in the warehouse). `resolveTeamSlug(slug)` looks the team's `id` up in
`nzihl-season-data`'s `upcoming` field for its league (the SAME field the portal's schedule-driven
Combined Starting Lineups grid already reads — no new data source), takes the soonest entry for
that teamID, and derives `HOME_SLUG`/`AWAY_SLUG` from that fixture's `home`/`away` teamIDs via a
small `idToSlug()` reverse-lookup over `TEAMS`. Because `upcoming` only ever holds
not-yet-played games (a completed one moves into the warehouse's `games` array), "soonest
`upcoming` entry for this teamID" is always this team's next game — no date-window filtering
needed, and a bookmarked URL naturally advances to the following fixture once the current one is
played (the "update over time" behavior Mat asked for), matching `activity-banner`'s `?team=`
resolve-once-per-load convention rather than continuous mid-session polling. `?home=`/`?away=`
still take priority when both are given (used unchanged by the portal's per-fixture links, zero
network round trip). Resolution failure (unknown slug, Mako, or no `upcoming` entry for that
team — e.g. a bye week) leaves `HOME_SLUG`/`AWAY_SLUG` unset, which the existing `VALID` check
turns into the same "render nothing" bad-slug convention as every other case on this page — no
new failure mode introduced.

Required restructuring the page's init flow from synchronous (`TH`/`TA`/`VALID`/`SIDE_HOME`/
`SIDE_AWAY` computed as top-level `const`s at parse time) to a `resolveAndBuild()` async function
(awaits `resolveTeamSlug()` only when `?team=` was given without explicit `?home=`/`?away=`, then
computes the same values as `let`s) called from a new `boot()` that runs before `document.fonts.
ready` triggers `start()` — `start()` itself is unchanged.

Dry-run verified in Node against the live `nzihl.json`/`nzwihl.json` warehouse data (not just
reasoned about): `?team=pure-nz-admirals` -> resolves SkyCity Stampede (home) vs Pure NZ Admirals
(away), the team's actual soonest fixture (2026-07-24); `?team=canterbury-red-devils` and
`?team=skycity-stampede` both correctly resolve to the SAME upcoming game (they play each other
2026-07-18/19); `?team=auckland-mako` and an unknown slug both correctly return no resolution
(no network call made for Mako, since `id` is `null`); `?team=wakatipu-wild` correctly returned
no resolution too (nothing currently scheduled for Wild in `nzwihl.json`'s `upcoming` at the time
of testing) — confirms the graceful "nothing scheduled yet" path, not just the happy path.

Portal (`index.html`) gained a second evergreen grid, "Combined Starting Lineups Team Slugs"
(Open/Copy per team, 9-team Mako-excluded list, `startinglineup/combined/?team=<slug>`),
alongside the existing schedule-driven "Combined Starting Lineups" grid — same `slCard()`-style
pattern as every other Team Slugs section (Game Summary, Team Scoring Leaders, Activity Banner,
Starting Lineup), via a new `combinedTeamCard()` function.

**Chrome-verified live post-deploy (same session):** `?team=pure-nz-admirals` renders the
resolved Stampede(home)/Admirals(away) matchup exactly as the dry-run predicted, with both real
`/lineup/<slug>` channels' live data (Admirals' six: Daigle C / Hayward Jones A / Sevenier /
Mawson / Finlay, Stampede's partially-set six with silhouette placeholders for unset slots) —
confirms the `/lineup/` polling and TEAMS rendering both work end-to-end off a resolved (not
explicit) home/away pair. `?team=auckland-mako` renders a fully blank page (confirmed visually,
no cards/rink/header) — the "no resolvable fixture" path degrades correctly. Explicit
`?home=canterbury-red-devils&away=botany-swarm` regression-checked unchanged (real data,
correct sides). Portal's new "Combined Starting Lineups Team Slugs" grid renders correctly under
the existing schedule-driven grid, both coexisting without layout collision.

### Combined Starting Lineups link added to team/ pages (2026-07-15)
Mat: "Add the Combined Starting Lineup Team Slug link to the team pages as appropriate." Added a
second mini-section under team/index.html's existing "Starting Lineup" section (same page,
`team/?team=<slug>`) — a `lineup-preview` iframe of `../startinglineup/combined/?team=<slug>`
plus Open/Copy buttons, styled with the same "sec-head, font-size:16px, margin:22px 0 14px"
sub-section convention the portal already uses for its own "Combined Starting Lineups" mini-grid.
New `lineupCombined` const sits alongside the existing `lineupPath`/`lineupControl` consts.

Applied uniformly to all 10 clubs, including Auckland Mako — deliberately NOT excluded, matching
this page's own documented convention (see the NZIHL/NZWIHL array comment: Mako's live overlays
"just resolve to no game... the page still renders cleanly, it's just mostly empty, which is an
accurate reflection of the club's status"). A blank Combined-lineups iframe on Mako's page is the
same kind of accurate-empty-state as its Game Summary/Activity Banner/Ticker cards already are,
not a special case needing its own handling.

See also [[nzihl_combined_lineups]] for the `?team=` resolution logic itself (unchanged here —
this is purely a new link surface, no logic changes to `startinglineup/combined/`).

### Combined Starting Lineups header text-shadow fix (2026-07-18)
Mat flagged the header team names (e.g. "CANTERBURY / RED DEVILS") rendering blurry/ghosted on
Chromium-family browsers, fine on Safari. Font-size on `.hdrTeamL1`/`.hdrTeamL2` was already a
flat integer (36px both lines) — confirmed NOT the cause before touching anything. Root cause:
`-webkit-text-stroke:2px` + `paint-order:stroke fill` under this page's runtime `#frame` scale
transform (`fitWindow()`, `s = min(innerWidth/1920, innerHeight/1080)`, essentially never an
integer) is a known Chromium/CEF rough edge — a stroked glyph outline doesn't get the same
pixel-snapping/hinting WebKit applies at non-integer scale, so it renders soft/doubled.

Fix: swapped the outline technique from `-webkit-text-stroke` to an 8-direction flat-colour
`text-shadow` (composites as layered fills, not a stroked glyph path — renders identically
across engines regardless of scale factor). Static default (black, `#08080A`) moved into CSS
directly on `.hdrTeamL1`/`.hdrTeamL2`; the dynamic per-team override on L2 (white `stroke2` for
stampede/wild, since their `hdrLine2` is a dark navy a black outline would swallow) now goes
through a new `outlineShadow(color)` JS helper instead of `.style.webkitTextStroke`.

Verified locally before pushing: cloned a headless Chromium (playwright, manually vendored the
missing shared libs since the sandbox has no root/apt) and rendered the page at a deliberately
non-integer scale (1383×778 viewport against the 1920×1080 frame) both before and after the
change, then diffed the two screenshots pixel-by-pixel with all animations settled. The diff
isolated cleanly to the header text pixels (expected — the outline technique changed) with zero
difference anywhere else on the panel (cards, rink, logos, positions) — a real, faint sub-pixel
antialiasing jitter shows up on ALL text between two independent page loads regardless of any
code change, so a small nonzero diff floor elsewhere was expected and not a regression signal.
Commit `d495495`. Couldn't get a live cross-browser (Chrome vs Safari) comparison in this
session — Chrome extension wouldn't connect — so if Mat still sees the funny look after this
ships, that's the next thing to check with an actual side-by-side screenshot.

## Repo litter sweep (2026-07-14)

Mat asked for a general tidy-up pass after the redesign v2 promotion, plus explicit permission
to remove `redesign2/` whenever. Full-repo grep-first-then-delete pass, everything confirmed
unreferenced before removal:

- **`redesign2/`** (the preview that produced the production redesign) — deleted. Its own
  `nav.js`/`index.html`/`team/`/`ops/` were a self-contained near-copy, nothing else in the repo
  pointed at it.
- **`redesign-preview.html`** (the abandoned v1 zone-IA prototype, superseded 2026-07-14 by v2 —
  see [[hockey-portal-redesign]]) — deleted. Not linked from anywhere; its git history stays
  recoverable if ever needed.
- **`scoringleaders/ab-test.html`** (design-experiment page for the Scoring Leaders pill layout —
  README/memory both flagged "ask before deleting once a variant is picked and promoted"; the
  variant was picked and shipped 2026-07-09) — deleted after confirming with Mat. Removed its
  entry from `scripts/check-surname-overrides.js`'s `PAREN_FILES` list and from
  `.github/workflows/check-consistency.yml`'s trigger paths (both referenced the now-gone file);
  re-ran the check script locally to confirm it still passes clean across the remaining files.
- **`league/index.html`**'s standalone `.crumbs` div (`← Portal / League`, plus its CSS and the
  JS line setting `#crumb-league`'s text) — removed. This was the "slightly redundant" leftover
  flagged in [[hockey-portal-redesign]]'s production-promotion note: `nav.js`'s shared top bar
  already has a Portal link and underlines the current page, so the page's own crumbs were pure
  duplication. Nothing else on `league/` touched (its own `NZIHL`/`NZWIHL` team-array copy and
  drift risk vs `window.RD2` are unchanged — that's a refactor, not litter, left for a future
  pass).
- **`box/` was already retired** (2026-07-12, see below) — confirmed nothing new links it.
- Swept for other litter classes (`.orig`/`.bak`/`.tmp`, `.DS_Store`, orphaned scripts, stray
  workflow references) — found none beyond the items above. `warehouse-audit.md` and
  `playoff-readiness.md` at repo root are intentional audit-report deliverables, not litter.
