# memory.md — matchavez/hockey

Self-context for Claude. README.md here is already extremely thorough and explicitly written for AI-assisted maintenance (data contracts, URL params, gotchas) — treat README.md as the primary source of truth for how each page works. This file covers what README.md doesn't: cross-repo relationships, process gotchas, and "what's in flight" framing. Last refreshed: 2026-07-11.

## What this repo is
The live portal + every deployed broadcast overlay page for NZIHL/NZWIHL. `https://matchavez.com/hockey/` via GitHub Pages, custom domain, deploy = push to `main`. Single-file HTML overlays, no build step, 1920×1080 YoloBox browser sources.

## Page inventory (see README for full param contracts)
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
Evergreen starting-six graphic + control page (full contract in README.md). Worth remembering
beyond the README: state lives in the worker's `/lineup/<slug>` route — added to
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

## Sync note
Keep this file and README.md in sync with every meaningful change. If they drift, flag it to Mat and get approval before publishing the sync rather than doing it silently.

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

Build notes worth keeping beyond the README:
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
