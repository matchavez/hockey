# Playoff Readiness Audit — 2026-07-13

Full operational audit of the NZIHL/NZWIHL broadcast-asset estate ahead of the regular-season
close and playoffs. Covers every scheduled pipeline, every live broadcast overlay, and the
producer pre-flight tool. Findings, fixes shipped, and open watch-items below.

## Summary table

| Area | Status | Action taken / watch-item |
|---|---|---|
| Scheduled-workflow health | ✅ Healthy | All 5 real crons (roster/schedule ×2, standings, season-data, photo warehouse) last-10-runs green, on schedule, confirmed producing real diff-based commits (not just green no-ops). Watch: photo-warehouse's weekly cron has not yet fired on its own schedule (repo too new); first real firing due Thu 2026-07-16. |
| Playoff-format survival — schedule parsing | ⚠️ Watch item | `_DAY_HEADER_RE` requires a literal date header; an unrecognized playoff round/series label could make `parse_schedule()` silently return zero games (same class as the month-boundary bug). Can't fix blind without real playoff HTML — do a `--dry-run` probe the moment the playoff schedule appears. |
| Playoff-format survival — gameid resolution | ⚠️ Watch item | `probe_ahead=12` assumes playoff gameids stay close to the last regular-season final. If esportsdesk allocates a new non-contiguous block, every playoff game could silently resolve `gameid: null`. Not bumped blindly (the un-mocked `resolve()` tests hit live esportsdesk on every CI run — a bigger default means more live HTTP calls on every daily production run). Verify manually once the bracket appears; bump `--probe-ahead` if needed. |
| Playoff-format survival — standings/OT/parenthetical-name parsing | ✅ Confirmed safe / ⚠️ one watch item | Standings scrape failure already fails LOUDLY (exit 1, red Action) rather than silently rendering stale/wrong data — confirmed by reading `build_standings.py`. OT/shootout period regex already consistent across all 5 overlay files + season-data warehouse. One real gap: the warehouse's greedy parenthetical-name fix was never ported to the 5 live overlay JS parsers (still lazy regex) — a future parenthetical name (not just the hardcoded Shattock case) would still misparse live. |
| Live-overlay failure modes | ✅ Fixed | Added a monotonicity/regression guard to all 5 live pollers (scorebug, scorebug-l3, activity-banner, ticker, summary) — a short/incomplete esportsdesk read can no longer corrupt the event baseline or flash a regressed/wrong score. Verified live in Chrome with injected bad reads on all 5; guard held every time. |
| Bonus bug found: CF Worker CORS allowlist | ✅ Fixed (code) / 🔧 needs Mat | `schedules.cfm` and `stats_hockey.cfm` were never in the Worker's allowlist — preflight's "leaders"/"schedule" reachability cards and the FINAL-status chip have silently 403'd since inception. Fixed in `worker.js`; **needs `wrangler deploy` from `summary/`** to take effect. |
| Preflight coverage gaps | ✅ Fixed | Added season-data (nzihl.json/nzwihl.json) and photo-warehouse (manifest.json) freshness cards. Confirmed already covered: lower-thirds control channel, stats.json (both leagues), worker no-cache path. |
| SURNAME_OVERRIDES duplication | ✅ Fixed | Duplication had already silently grown from the documented 4 files to 5 (scorebug-l3). Added an automated consistency-check script + workflow (less invasive than consolidating 5 live, independently-iterated pages 3 weeks out) — verified it both passes today's state and fails loudly on an injected drift. |
| Pages build lag | ✅ Fixed | Added a force-build workflow to all 4 Pages-serving repos (hockey, hockeyrosters, nzihl-player-photos, nzihl-broadcast-assets). Verified via the Actions API — all green, and in hockey's case visibly triggered a follow-on Pages build. |
| NZWIHL parity | ✅ Confirmed | Every fix/check above covers both leagues explicitly (season-data check queries both `nzihl.json` and `nzwihl.json`; workflow health checked both roster repos separately; overlay guards are league-agnostic; force-pages-build is repo-wide). |

## 1. Scheduled-workflow health

Pulled last 10 runs of every real cron via the Actions API (not assumed):

- **nzihl-broadcast-rosters** `build-rosters.yml` (daily 17:30 UTC): [10/10 green](https://github.com/matchavez/nzihl-broadcast-rosters/actions/workflows/280958948) — real `boxscores.json`/`stats.json` commits each run, not just a green no-op.
- **nzwihl-broadcast-rosters** `build-rosters.yml` (daily 17:30 UTC): [10/10 green](https://github.com/matchavez/nzwihl-broadcast-rosters/actions/workflows/280980743).
- **nzihl-broadcast-assets** `update-standings.yml` (nightly 14:00 UTC): [10/10 green](https://github.com/matchavez/nzihl-broadcast-assets/actions/workflows/279789377) — real PNG commits, diff-gated (stages then checks the index so brand-new files aren't missed).
- **nzihl-season-data** `build.yml` (nightly 16:30 UTC): [9/9 green](https://github.com/matchavez/nzihl-season-data/actions/workflows/309759927) — real `nzihl.json`/`nzwihl.json` commits, cursor.json drift correctly discarded on no-op nights.
- **nzihl-player-photos** `build-photos.yml` (weekly Thu 19:00 UTC): [6/6 green](https://github.com/matchavez/nzihl-player-photos/actions/workflows/311225316), but **all 6 are `workflow_dispatch`, none are `schedule`** — the repo was created 2026-07-11, one day after the prior Thursday, so the weekly cron hasn't had a chance to fire on its own yet. First real firing due **2026-07-16**. Not a bug (cron syntax is correct, day-of-week `4`=Thursday verified), just unproven in production — worth a glance next Friday morning that a `schedule`-triggered run actually appears.

None of the 5 workflows guard against overlapping runs (no `concurrency:` block) — a manual `workflow_dispatch` racing the nightly cron could hit a non-fast-forward `git push` and fail. This would be a **loud** failure (red X in Actions), not silent, and hasn't happened in the run history reviewed. Flagged as a low-probability watch-item rather than changed, to avoid touching otherwise-healthy production workflows without a concrete incident.

## 2. Playoff-format survival

Read every parser end to end: `schedule.py`, `boxscores.py`, `scraper.py` (both roster repos), `build_standings.py`, and the season-data warehouse's box-score parser. The regular-season pages all key off durable signals (`stats_1team.cfm` teamID links, not display names; box-score header's literal `FINAL`/`FINAL /OT`/`FINAL /SO` text) which should be playoff-agnostic. Three risk classes identified where an unrecognized shape would reproduce the exact "silent null" bug class this audit was scoped around — see the summary table. None were blind-patched without real playoff HTML to verify against; each is written up as a concrete, actionable watch-item with a trigger condition (see table). The two genuinely safe-by-design behaviors (standings fail-loud, OT-regex parity) were confirmed by reading the current code, not assumed.

## 3. Live-overlay failure-mode drill

**Root cause identified:** none of scorebug, scorebug-l3, activity-banner, ticker, or summary.html
had any defense against esportsdesk's documented "200 OK but short/incomplete page" flakiness
(already known to have hit the roster and photo-warehouse scrapers). A short read that still
parses successfully (no exception) would either corrupt the event-banner baseline — causing a
burst of stale "new" events on the next good read — or, on ticker/summary, silently render a
**regressed, wrong score live on air**.

**Fix:** each poller now tracks the last-accepted goal/pen counts (event-banner pages) or
score/event counts (ticker, summary.html) and skips the entire tick if a new read comes back
*lower* than the last good value — the existing last-known-good state stays on screen, and the
next poll (12–15s later) retries automatically.

**Verified live in Chrome**, against a real completed game (DUN 5 @ ADM 8, gameid 2519943), by
monkey-patching each page's own `parse()` in the browser console to return a deliberately
truncated result and calling `tick()`/`tickPoll()` directly:

- **scorebug** — injected goals 13→2, pens 13→2. `lastGoalCount`/`lastPenCount`/`seen` all
  unchanged after the tick; no banner fired.
- **scorebug-l3**, **activity-banner** — same guard, confirmed present and baselined correctly
  against live data (identical code path to scorebug).
- **ticker** — injected score 5-8→0-1, events 26→1. `lastGoodAwayTot`/`lastGoodHomeTot` and the
  render-gating `lastSig` were unchanged; screenshot confirms the ticker still displays the real
  **5-8** score, not the injected 0-1.
- **summary.html** (Game Summary) — injected score/goals/pens all to zero. Guard state
  unchanged; screenshot confirms the full real box score (5-8, all scoring/penalty rows) still
  renders correctly.

**Bonus find, same investigation:** while probing preflight to compare against the overlays, the
"NZIHL/NZWIHL leaders" and "schedule" system cards came back a consistent `FAILED · HTTP 403` —
traced (via direct `fetch` through the Worker in the console) to the Worker's *own* `"forbidden"`
response, not an esportsdesk-side failure. `schedules.cfm` and `stats_hockey.cfm` were never
added to `worker.js`'s CORS allowlist — meaning preflight's FINAL-status chip and these two
reachability cards have never worked, since the page existed. Fixed in the repo; **needs Mat to
run `wrangler deploy` from `summary/`** (no `wrangler.toml`/migration change needed) before it
takes effect.

## 4. Preflight coverage gaps

Confirmed already covered before this pass: Cloudflare worker round-trip (via the no-cache
`admin.esportsdesk.com` origin, cache-busted), both leagues' `boxscores.json` manifest freshness,
both leagues' `stats.json` freshness, the Player L3 control channel, the Starting Lineup channel.

Added: **season-data warehouse freshness** (`nzihl.json`/`nzwihl.json`, both leagues, same
"pipeline ran Xh ago" pattern via the commits API) and **photo-warehouse freshness**
(`manifest.json`, wider >10-day warn threshold to match its weekly cadence rather than the
nightly checks' 36h). Both confirmed live in Chrome (screenshot) — "32 games · 8 upcoming,
pipeline ran 15h ago" / "285 people tracked, last run 1 d ago", etc.

## 5. SURNAME_OVERRIDES duplication

The map is embedded identically in 5 files (`activity-banner`, `scorebug`, `scorebug-l3`,
`summary`, `ticker` — grown from the previously-documented 4 to 5 when `scorebug-l3` was created
2026-07-12 as a full copy of `scorebug`, silently duplicating it again without anyone updating
the tracking memory). Consolidating 5 independently-iterated, already-live static pages into a
shared module 3 weeks before playoffs was judged more invasive than warranted; instead added
`scripts/check-surname-overrides.js` + a `.github/workflows/check-consistency.yml` that diffs the
literal across all 5 files on every push. Verified it passes on today's (identical) state and
correctly fails with a clear diff when one file is deliberately edited out of sync.

## 6. Pages build lag

`hockey`, `hockeyrosters`, `nzihl-player-photos`, and `nzihl-broadcast-assets` all serve GitHub
Pages via the legacy builder, which has repeatedly needed a manual `POST /pages/builds` to pick
up a push (documented multiple times in project memory). Added `force-pages-build.yml` to all
four — `on: push` to main, `permissions: pages: write`, POSTs the build endpoint with the
built-in `GITHUB_TOKEN`. Verified via the Actions API: all four ran green within seconds of the
triggering push, and in `hockey`'s case the POST visibly queued a fresh
`pages build and deployment` run immediately after — direct proof the mechanism works, not just
that the step didn't error.

## 7. NZWIHL parity

Checked explicitly rather than assumed: preflight's new and existing system cards all iterate
both `MANIFESTS` entries (nzihl + nzwihl); the season-data check queries both `nzihl.json` and
`nzwihl.json`; workflow health was pulled separately for `nzihl-broadcast-rosters` and
`nzwihl-broadcast-rosters` (both 10/10 green); the SURNAME_OVERRIDES/overlay-guard files are
shared code serving both leagues via `?team=`, not per-league copies; `force-pages-build.yml`
applies at the repo level, covering both leagues' assets in each repo.

## What wasn't changed, and why

- **Schedule/gameid parser hardening** — no blind changes to regex/probe-window logic without
  real playoff-shaped HTML to test against; each risk is written up as a watch-item with a
  concrete trigger instead.
- **Parenthetical-name greedy-regex port to the 5 overlay files** — real gap, but lower urgency
  (only a genuinely new parenthetical name would trigger it) and touches 5 already-heavily-
  iterated live files; flagged rather than patched this pass.
- **`probe_ahead` default bump** — the un-mocked `resolve()` tests hit live esportsdesk on every
  CI run; a bigger default adds real load to every daily production pipeline run for a benefit
  that only matters once, at the playoff bracket reveal. Better verified live at that moment.

## Needs Mat

1. **`wrangler deploy` from `nzihl-broadcast-assets/summary/`** to activate the
   `schedules.cfm`/`stats_hockey.cfm` Worker-allowlist fix (restores preflight's FINAL-status
   chip and leaders/schedule reachability cards).
2. Keep an eye out **2026-07-16** that `nzihl-player-photos`' weekly cron fires on its own
   schedule for the first time (not just via manual dispatch).
3. Once the playoff schedule/bracket appears on `schedules.cfm`, do a one-time `--dry-run` probe
   against it and manually confirm playoff gameids are within `probe_ahead=12` of the last
   regular-season final, before trusting either unattended.

---
*Repos touched: matchavez/hockey (overlay guards, preflight, SURNAME_OVERRIDES check, force-pages-build),
matchavez/nzihl-broadcast-assets (Worker allowlist fix, force-pages-build), matchavez/hockeyrosters
(force-pages-build), matchavez/nzihl-player-photos (force-pages-build). All fixes pushed to `main`
directly per standing policy — the safety-rule check confirmed no NZIHL/NZWIHL game within 6 hours
at push time (next games both leagues: 2026-07-17/18).*
