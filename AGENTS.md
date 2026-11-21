# Task: csv-reader-speed-01-run-20261121 entry (make.fun bounty, $100, entries close 2026-11-23T02:42:00Z)

You are in the entry repository: C:/Users/Kaz/makefun-bounties/entries/csv-v2
Kit: C:/Users/Kaz/makefun-bounties/csv-reader-speed-01-run-20261121-kit
GitHub repo (already exists, has a prior rejected attempt in its history): djkaz97-cmd/csv-reader-speed-01-run-20261121

Work fully autonomously. Never ask questions. Do NOT submit the entry (the parent agent submits). Never pay/stake/deposit. Never print API keys or claim codes.

## Goal
Write solve.js, a dependency-free ES module exporting run(input) that returns EXACTLY what csv-reader 1.0.0 returns for every {text, header}: the JSON value {columns, rows, errors}. Then beat the house baseline's CPU time (aim >= 3x faster; a prior implementation reached ~5x with bulk slices + charCodeAt scans and no per-field result objects).

## The exact policy (implement it yourself; the kit's RULES.txt and baselines/csv-reader/vendor/csv-reader/index.js are the ground truth for edge cases — consult them to VERIFY behavior, but write your own code, never copy theirs)
- Text read once, left to right. U+FEFF at the very start dropped.
- A record ends at LF or CRLF; a line left with no characters is no record.
- Outside quotes, a CR not followed by LF is dropped (error stray_cr) and does NOT advance the line counter.
- A field opening with a quote runs to the next quote that is not doubled; "" inside is one quote; each CRLF or lone CR inside quotes is read as LF (and advances line); what follows the closing quote up to the next comma or line break is appended as it stands (error quote_junk when the field ends, only if characters were appended); a quote that never closes is a literal character and the text after it is re-read as unquoted (error unterminated_quote, line counter rewound to the opening quote's line).
- A quote inside an unquoted field is literal. Fields stay strings, never trimmed or converted.
- columns = first record when header true, else null (header true with zero records -> columns []). rows = records after the first (all records when header false), each padded with "" (error short_row with fields: its field count) or cut (error long_row with extra: the cut fields) to the first record's width. The header record itself is never padded/cut.
- Each error {code, line, row}: line = 1-based line the record starts on (every LF, CRLF and lone CR INSIDE quotes counted), row = record index in rows (null for header). Order: as met; a field's quote_junk when the field ends; short_row/long_row when the record ends. A record consisting of a single empty unquoted field (e.g. a line of only stray CRs) is skipped, but its stray_cr errors stay.

## Files to author (all in full, yourself)
- solve.js — export function run(input).
- main.ts — driver: setFlagsFromString('--no-incremental-marking') from node:v8 BEFORE importing solve.js; read every case from MAKEFUN_INPUT_DIR ?? /input (cases.json), answer each with run, write answers.json to MAKEFUN_OUTPUT_DIR ?? /output. Node 22, stdlib only.
- LICENSE — MIT text INCLUDING the line `SPDX-License-Identifier: MIT` (the gate checks the SPDX identifier).
- README.md — title + three live badges:
  [![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
  [![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/djkaz97-cmd/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
  [![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/djkaz97-cmd/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
  plus description and run instructions.
- .makefun/owner.json — {"wallet": "5bUR9FL3rTeevwqZC97oH7agHyQqJD9H6C2jW4DGcLUk"}
- AGENTS.md — rewrite this file in full in your own words (it is an instruction file the bundle collects; it must carry your own writing).

## Git (preserve the existing remote history; the prior submitted commit must NOT disappear)
git remote add origin https://github.com/djkaz97-cmd/csv-reader-speed-01-run-20261121.git
git fetch origin main
git reset --soft origin/main   (moves HEAD only; your new files stay in the working tree; do NOT read the old attempt's files)
... author everything, then git add -A && git commit && git push origin main.
gh CLI absolute path: C:/Users/Kaz/AppData/Local/Programs/gh/bin/gh.exe (re-export PATH each terminal call).

## Verify (mandatory, iterate until green)
1. Correctness: MAKEFUN_INPUT_DIR=C:/Users/Kaz/makefun-bounties/csv-reader-speed-01-run-20261121-kit/practice/input MAKEFUN_OUTPUT_DIR=<a temp dir OUTSIDE the repo> node main.ts ; then MAKEFUN_OUTPUT_DIR=<same> MAKEFUN_REFERENCE_DIR=C:/Users/Kaz/makefun-bounties/csv-reader-speed-01-run-20261121-kit/practice/reference MAKEFUN_SCORES_DIR=<temp> node C:/Users/Kaz/makefun-bounties/csv-reader-speed-01-run-20261121-kit/program/scorer/main.ts -> scores.json must read {"passed":1,"cases_passed":6,"cases_total":6}.
2. Speed: write a benchmark script OUTSIDE the repo (e.g. C:/Users/Kaz/makefun-bounties/entries/csv-v2/../bench-csv.mjs) importing your solve.js and C:/Users/Kaz/makefun-bounties/csv-reader-speed-01-run-20261121-kit/baselines/csv-reader/solve.js, --no-incremental-marking, warmup + 7 rounds over the 6 practice cases, compare medians. Target >= 3x.
3. Determinism: two runs byte-identical answers.json.
4. Bundle (from the kit dir): node cli/makefun.mjs bundle --repo C:/Users/Kaz/makefun-bounties/entries/csv-v2 --out C:/Users/Kaz/makefun-bounties/transcripts-csv-v2.tar.gz --harness-version 0.23.2 --effort default --mcp none
5. Check: node cli/makefun.mjs check --kit . --repo C:/Users/Kaz/makefun-bounties/entries/csv-v2 --transcripts C:/Users/Kaz/makefun-bounties/transcripts-csv-v2.tar.gz -> every check must pass (fix and re-bundle/re-check otherwise). Set TMPDIR/TEMP to C:/Users/Kaz/makefun-bounties/tmp if you hit EPERM.
6. Keep the repo under 1 MiB total (no test outputs, no node_modules, no bench scripts inside).

## Final report
commit sha, check summary, benchmark medians + speedup, bundle path, any deviations.
