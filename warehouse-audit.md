# Warehouse Migration Audit — NZIHL / NZWIHL Broadcast Estate

Generated 2026-07-12. Full-estate audit of every graphic, overlay, and page against the two
warehouses (`matchavez/nzihl-player-photos`, `matchavez/nzihl-season-data`), per Mat's request.
Covers both leagues on every surface.

Legend: **RT** = real-time (must stay on the no-cache `admin.esportsdesk.com` worker path).

## Photos

| Repo / surface | Photo source found | Action | Notes |
|---|---|---|---|
| hockey/activity-banner (goal/pen banner scorer photo) | naive `<FirstLast>.jpg` guess → `rosters_profile.cfm` live fallback | **Migrated** | Added warehouse manifest lookup as the new first step (see Migrations). |
| hockey/activity-banner (Player L3) | warehouse manifest already primary | No change | Already correct (shipped 2026-07-12). |
| hockey/scorebug-l3 (Player L3) | warehouse manifest already primary | No change | Already correct (shipped 2026-07-12). |
| hockey/lowerthirds (phone page pill photo-exists check) | warehouse manifest already primary | No change | Already correct. |
| hockey/scoringleaders/index.html + ab-test.html | naive guess → `rosters_profile.cfm` live fallback | **Migrated** | ab-test.html is a throwaway A/B tool (not linked anywhere); ported the same fix for parity since it shares the pipeline. |
| hockey/summary (Game Summary, scoring rows) | naive guess → `rosters_profile.cfm` live fallback | **Migrated** | |
| hockey/box (box score) | team logos only, no player headshots | No change | Out of scope — logos aren't warehouse-tracked. |
| hockey/scorebug (original, pre-L3) | no headshot logic at all | No change | Scoreboard + banner only, no player photos on this page. |
| hockey/ticker | no headshot logic | No change | Text-only ticker. |
| hockey/team, hockey/index.html (portal), hockey/warehouse | no live headshot fetch — portal only links out to the gallery; `hockey/warehouse/index.html` already reads the manifest natively | No change | Already correct. |
| hockeyrosters | no headshot logic | No change | Links to roster PDF releases only. |
| nzihl-broadcast-rosters / nzwihl-broadcast-rosters (roster PDFs) | no photos embedded in PDFs | No change | Text/table PDFs only. |
| nzihl-broadcast-assets/summary/index.html + previews/game-summary.html | naive guess, `www.nzihl.com` host | **Not migrated** | Confirmed via memory.md: this is prototype/design workspace, NOT the deployed page (deployed page is hockey/summary/, already migrated above). Low priority — flagged, not touched, to avoid churning a dev sandbox mid-iteration. |
| reddevils-nzihl-integration (client deliverable) | no headshots (Fixtures/Standings/Top Scorers only, no photo section) | No change | N/A — doesn't fetch photos at all. |

## Season / game data

| Repo / surface | Data source found | Real-time? | Action | Notes |
|---|---|---|---|---|
| hockey/scorebug, scorebug-l3 (scoreboard + goal/pen banner) | `hockey_boxscores.cfm` via no-cache worker | **RT** | No change | Correctly real-time. |
| hockey/activity-banner (goal/pen banner events) | `hockey_boxscores.cfm` via no-cache worker | **RT** | No change | Correctly real-time. |
| hockey/ticker (live scrolling goal/pen events) | `hockey_boxscores.cfm` via no-cache worker | **RT** | No change | Correctly real-time. |
| hockey/ticker (league scoring-leaders sidebar, refetched ~60s) | `stats_hockey.cfm` via no-cache worker | **RT** | No change | Deliberately kept in sync with the live box score mid-broadcast (Mat's 2026-07-07 "make it awesome" spec) — this is intra-game, correctly not warehouse-sourced. |
| hockey/ticker (last-meeting / H2H pregame line) | `nzihl-season-data` | No | No change | Already migrated (2026-07-09), confirmed still wired. |
| hockey/summary (in-game box score numbers) | `hockey_boxscores.cfm` via no-cache worker | **RT** | No change | Correctly real-time. |
| hockey/team/index.html (schedule/results widget) | `nzihl-season-data` `games` + `upcoming` (whole season, no lookahead cap) | No | No change | Already migrated (2026-07-11), verified below still whole-season not 11-day-capped. |
| hockey/scoringleaders (top-3 selection + season totals) | live `stats_1team.cfm` via Worker | No (season-view) | **Verified, kept as-is — see Findings** | Discrepancy found in warehouse-derived totals for at least one team; per your instruction, did not switch. |
| hockey/lowerthirds (fact engine: streaks, H2H, last-meeting, league rank) | `nzihl-season-data` `player_game_logs`/`head_to_head`/`streak` | No | No change | Already fully warehouse-sourced, whole-season. |
| hockey/lowerthirds / activity-banner (`stats.json` season stat line: GP/G/A/PTS/PIM, goalie GA/SO/W/L) | `stats.json` (own nightly scrape of `stats_1team.cfm` + `personnel.cfm`, built into both roster repos) | No | **Investigated, left as-is** | See Findings below — genuinely duplicate-in-spirit but not consolidated this pass. |
| hockey/activity-banner, scorebug-l3, ticker (pregame team-standing-position banner text) | live `standings.cfm` via no-cache worker, fetched once pregame | No (pre-game, one-shot) | **Found, not migrated** | Genuine migration candidate — see Findings. |
| hockey/preflight (producer health-check board) | live `standings.cfm`/`schedules.cfm`/`stats_hockey.cfm`/`hockey_boxscores.cfm`, worker reachability | N/A | No change (by design) | This tool exists specifically to test the live scrape path's health — migrating it to the warehouse would defeat its purpose. |
| hockeyrosters | `boxscores.json` (11-day window, roster-PDF release matching only) | N/A | No change | Not a season-stat consumer — this window is for "which PDF release is current," a legitimate near-term use, not season data. |
| nzihl-broadcast-rosters / nzwihl-broadcast-rosters (roster PDFs, `boxscores.json`) | own nightly `stats_1team.cfm`/`schedules.cfm` scrape | N/A | No change (optional) | Nightly, polite, stable — no forced migration per your "don't churn stable pipelines" rule. |
| nzihl-broadcast-assets (standings PNGs) | own nightly `standings.cfm` scrape | N/A | No change (optional) | Same reasoning — nightly, stable, produces the standings graphic itself (can't be sourced from nzihl-season-data, which doesn't carry a standings table). |
| reddevils-nzihl-integration (Fixtures/Standings/Top Scorers) | live `standings.cfm`/`stats_1team.cfm`/scoreboard scrape, cron 3x/week | No (season-view) | **Recommended, not actioned** | Third-party-owned Next.js codebase (Strive Digital) — local deliverable package only, not a repo Claude pushes to. Migrating it to `nzihl-season-data`'s raw JSON is straightforward (same data, one static fetch) but requires Mat to re-deliver the package to the developer. Flagged for Mat's call. |

## Findings for Mat (things neither warehouse can fully serve yet, or found mid-audit)

1. **`nzihl-season-data` has a real parser bug affecting NZWIHL season totals.** Verified
   scoring-leaders-style totals for 2 teams/league against live `stats_1team.cfm`
   (Pure NZ Admirals, Canterbury Red Devils, Auckland Steel all matched exactly). **Canterbury
   Inferno did not** — Gabrielle Guerin, Nerhys Gordon, Reagyn Shattock, Lucy-Jane Hart, and
   Stephanie Koviessen were each short by 1 goal or assist in the warehouse vs. live. Root
   cause found: when a **parenthetical nickname/maiden name appears in an ASSIST name**
   (not just the scorer's own name, which was already fixed) it breaks the goal-line parser —
   e.g. game 2520003 has a goal literally stored as `who: "Gabrielle Guerin (Reagyn Shattock",
   assists: ["Niskakoski)"], teamID: null`. Same bug hit again in game 2520016 via
   Lucy-Jane's `(LJ)` nickname. Per your instruction, **did not switch scoringleaders (or
   anything else) to warehouse-derived season totals** — it stays on the live
   `stats_1team.cfm` Worker fetch. Recommend porting the existing "greedy name capture" fix
   (already applied to scorer names) to assist names too, in `nzihl-season-data`'s goal-line
   regex. I re-ran the pipeline live to rule out a freshness gap first (triggered
   `workflow_dispatch`, confirmed the newest CIN game was already included) before concluding
   it's a genuine parsing bug, not staleness.
2. **`stats.json` (used by Player Lower Thirds) duplicates `nzihl-season-data`'s purpose but
   not its mechanism.** It's a separate nightly scrape of `stats_1team.cfm`/`personnel.cfm`
   built into both roster repos, producing per-player season GP/G/A/PTS/PIM and goalie
   GA/SO/W/L. In principle this could be derived from `nzihl-season-data`'s `games[]` (same
   aggregation the scoring-leaders check above does) instead of its own scrape. I did not
   consolidate it this pass: (a) it shipped yesterday (2026-07-12) and is fully live in
   production with nothing pending, (b) `nzihl-season-data` currently has the parser bug in
   finding #1, so deriving goalie/skater stats from it isn't safe until that's fixed, and (c)
   your rule is this kind of consolidation is optional unless it deletes code — worth
   revisiting once #1 is fixed.
3. **Team-standing-position text (pregame banners) is a real, un-actioned migration
   candidate.** `activity-banner`, `scorebug-l3`, and `ticker` each do a one-shot live
   `standings.cfm` fetch purely for the pregame "sits Nth" banner line. This is genuinely
   pre-game/season-view and belongs on `nzihl-season-data` — but that repo doesn't currently
   store a standings table, only raw games. Computing one client-side (W/L/OTW/OTL/PTS + rank)
   is straightforward in principle but I didn't want to guess NZIHL's points system without
   verifying it against a live standings page the same way I verified scoring totals — flagging
   as a scoped follow-up rather than shipping unverified.
4. **`reddevils-nzihl-integration`** (Fixtures/Standings/Top Scorers on reddevils.co.nz) is a
   clean migration candidate in principle but is delivered code in a third-party dev's
   repository, not something in Claude's push scope. Flagged for your call on whether to
   re-package and hand off an updated version.

See also repo `memory.md` updates for full technical detail on what shipped this session.
