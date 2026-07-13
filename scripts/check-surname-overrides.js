// Verifies the SURNAME_OVERRIDES map embedded in every live-overlay page is
// byte-identical across all copies. These five pages have no shared build/bundler
// (independent static HTML files) -- the map has already drifted once in practice
// (grew from 4 files to 5 when scorebug-l3/index.html was created as a full copy of
// scorebug/index.html on 2026-07-12, silently duplicating the override table again).
// Run this in CI on every push so a future edit to just one file fails loudly instead
// of silently drifting on-air surname rendering between overlay pages.
//
// See memory: nzihl-player-name-overrides, nzihl-roster-scraper-robustness.
const fs = require("fs");
const path = require("path");

const FILES = [
  "activity-banner/index.html",
  "scorebug/index.html",
  "scorebug-l3/index.html",
  "summary/index.html",
  "ticker/index.html",
];

const RE = /const SURNAME_OVERRIDES=(\{[^;]*\});/;

let reference = null;
let referenceFile = null;
let failed = false;

for (const rel of FILES) {
  const p = path.join(__dirname, "..", rel);
  if (!fs.existsSync(p)) {
    console.error(`MISSING FILE: ${rel} (expected in the SURNAME_OVERRIDES file list -- ` +
      `update FILES in scripts/check-surname-overrides.js if this file was intentionally removed)`);
    failed = true;
    continue;
  }
  const src = fs.readFileSync(p, "utf8");
  const m = src.match(RE);
  if (!m) {
    console.error(`MISSING "const SURNAME_OVERRIDES=" declaration in ${rel}`);
    failed = true;
    continue;
  }
  const literal = m[1];
  if (reference === null) {
    reference = literal;
    referenceFile = rel;
  } else if (literal !== reference) {
    console.error(`SURNAME_OVERRIDES DRIFT DETECTED`);
    console.error(`  ${referenceFile}: ${reference}`);
    console.error(`  ${rel}: ${literal}`);
    failed = true;
  }
}

if (failed) {
  console.error("\nFix: make the SURNAME_OVERRIDES literal identical (byte-for-byte) in every file listed above.");
  process.exit(1);
}
console.log(`OK -- SURNAME_OVERRIDES identical across all ${FILES.length} live-overlay files: ${reference}`);
