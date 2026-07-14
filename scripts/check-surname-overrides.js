// Player-name corrections (multi-word surnames, parenthetical strips) now
// live in ONE canonical file: nzihl-broadcast-assets/assets/name-overrides.json
// (see memory: nzihl-player-name-overrides). Every consumer page fetches it at
// start() and only falls back to the hardcoded SURNAME_OVERRIDES/PAREN_STRIPS
// object literal below that fetch if the network call fails -- an on-air
// graphic must never lose a name correction to a hiccup.
//
// This script no longer verifies "the" single source (that's the JSON file,
// not these pages) -- it verifies the FALLBACK snapshots stay byte-identical
// across every copy, so a stale/edited-by-hand fallback in one file doesn't
// silently diverge from the others during whatever window the fetch is down.
// Same drift class as before (scorebug-l3 silently duplicating the table when
// it was created as a copy of scorebug/, 2026-07-12) -- just one layer down,
// since the live value itself is no longer duplicated.
const fs = require("fs");
const path = require("path");

// Files that declare SURNAME_OVERRIDES (splits/abbreviates a scraped name --
// only the 5 broadcast overlays that do that kind of truncation need it).
const SURNAME_FILES = [
  "activity-banner/index.html",
  "scorebug/index.html",
  "scorebug-l3/index.html",
  "summary/index.html",
  "ticker/index.html",
];

// Files that declare PAREN_STRIPS (strip a maiden-name/nickname parenthetical
// from raw scraped text) -- every page that parses raw box-score/roster text.
const PAREN_FILES = [
  ...SURNAME_FILES,
  "lowerthirds/index.html",
  "scoringleaders/index.html",
];

function checkGroup(label, files, re) {
  let reference = null;
  let referenceFile = null;
  let failed = false;
  for (const rel of files) {
    const p = path.join(__dirname, "..", rel);
    if (!fs.existsSync(p)) {
      console.error(`[${label}] MISSING FILE: ${rel}`);
      failed = true;
      continue;
    }
    const src = fs.readFileSync(p, "utf8");
    const m = src.match(re);
    if (!m) {
      console.error(`[${label}] MISSING declaration in ${rel}`);
      failed = true;
      continue;
    }
    const literal = m[1];
    if (reference === null) {
      reference = literal;
      referenceFile = rel;
    } else if (literal !== reference) {
      console.error(`[${label}] DRIFT DETECTED`);
      console.error(`  ${referenceFile}: ${reference}`);
      console.error(`  ${rel}: ${literal}`);
      failed = true;
    }
  }
  if (!failed) {
    console.log(`OK -- [${label}] fallback identical across all ${files.length} files: ${reference}`);
  }
  return !failed;
}

const okSurname = checkGroup("SURNAME_OVERRIDES fallback", SURNAME_FILES, /let SURNAME_OVERRIDES=(\{[^;]*\});/);
const okParen = checkGroup("PAREN_STRIPS fallback", PAREN_FILES, /let PAREN_STRIPS=(\[[^;]*\]);/);

if (!okSurname || !okParen) {
  console.error("\nFix: make the fallback literal identical (byte-for-byte) in every file listed above,");
  console.error("or better -- if the correction is a real, permanent one, add it to");
  console.error("nzihl-broadcast-assets/assets/name-overrides.json (the actual single source of truth)");
  console.error("and only update these fallbacks to match it.");
  process.exit(1);
}
