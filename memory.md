# memory.md — matchavez/hockey

Self-context for Claude. README.md here is already extremely thorough and explicitly written for AI-assisted maintenance (data contracts, URL params, gotchas) — treat README.md as the primary source of truth for how each page works. This file covers what README.md doesn't: cross-repo relationships, process gotchas, and "what's in flight" framing. Last refreshed: 2026-07-11.

## What this repo is
The live portal + every deployed broadcast overlay page for NZIHL/NZWIHL. `https://matchavez.com/hockey/` via GitHub Pages, custom domain, deploy = push to `main`. Single-file HTML overlays, no build step, 1920×1080 YoloBox browser sources.

## Page inventory (see README for full param contracts)
`index.html` (portal), `team/`, `league/`, `ticker/`, `scorebug/`, `activity-banner/`, `summary/` (Live Game Summary), `scoringleaders/` (+ `ab-test.html`, a design-experiment page not in the deployed rotation — ask before deleting once a variant is promoted), `box/`, `preflight/` (producer tool, not an overlay), `warehouse/` (producer tool, not an overlay — added 2026-07-11), `assets/fonts/`.

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
- Cloudflare Worker (admin.esportsdesk.com no-cache origin) — all live scraping across this whole family of repos switched to this no-cache origin; some ticker/activity-banner work is still blocked on a worker redeploy (see [[nzihl_activity_banner]] equivalent in Claude's cross-session memory if picking this back up).

## Recent focus (as of 2026-07-10/11)
Team Scoring Leaders (`scoringleaders/`) just went through five iteration rounds ending in a Chrome-screenshot-confirmed final layout (fitPlayerText, styling, descriptor variety). Team page just gained a schedule/results widget (top-right of idcard). If resuming Scoring Leaders work, re-verify current live state first — this went through a lot of back-and-forth before landing.

## Sync note
Keep this file and README.md in sync with every meaningful change. If they drift, flag it to Mat and get approval before publishing the sync rather than doing it silently.
