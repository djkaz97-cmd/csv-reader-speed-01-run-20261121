# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/djkaz97-cmd/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/djkaz97-cmd/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in replacement for csv-reader 1.0.0, the reference program of the
make.fun bounty csv-reader-speed-01-run-20261121.

`solve.js` is a dependency-free ES module exporting `run(input)`, which returns
exactly what csv-reader 1.0.0 returns for every `{text, header}`: the JSON value
`{columns, rows, errors}`. It implements csv-reader's own broken-row policy
(U+FEFF drop, record end at LF/CRLF, stray CR, quoted fields with `""` escapes,
quote junk, unterminated quotes, short/long rows with `short_row` /
`long_row` errors) in a single left-to-right pass that slices normal character
runs off the original text instead of reading one character at a time.

`main.ts` is the driver the harness runs: it turns V8's incremental marking off
(`setFlagsFromString('--no-incremental-marking')` from `node:v8`), reads every
case from `$MAKEFUN_INPUT_DIR ?? /input`, answers each with `run` and writes
`answers.json` to `$MAKEFUN_OUTPUT_DIR ?? /output`. Node 22, standard library
only.

## Files

- `solve.js` — the entry: `export function run(input)`.
- `main.ts` — the harness driver.
- `LICENSE` — MIT (`SPDX-License-Identifier: MIT`).
- `.makefun/owner.json` — claim wallet.

## Run locally

```sh
node main.ts
# with custom dirs:
MAKEFUN_INPUT_DIR=.../practice/input MAKEFUN_OUTPUT_DIR=.../out node main.ts
```

The kit's scorer validates `answers.json` against `practice/reference`:

```sh
MAKEFUN_OUTPUT_DIR=<out> MAKEFUN_REFERENCE_DIR=.../practice/reference \
  MAKEFUN_SCORES_DIR=<scores> node <kit>/program/scorer/main.ts
# scores.json must read {"passed":1,"cases_passed":6,"cases_total":6}
```
