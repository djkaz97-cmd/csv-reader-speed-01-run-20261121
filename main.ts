// main.ts — csv-reader-speed-01-run-20261121 entry driver.
// Reads every case from /input/cases.json, answers each with run() from
// solve.js, writes /output/answers.json. Node 22, standard library only.
// MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR stand in for /input and /output
// outside the grader's container. V8 incremental marking off, as the house
// baseline runs, set before solve.js is imported.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

setFlagsFromString('--no-incremental-marking');

const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const inDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const cases = JSON.parse(readFileSync(join(inDir, 'cases.json'), 'utf8')) as { id: string; input: unknown }[];
const answers: unknown[] = [];
for (const c of cases) answers.push(run(c.input));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'answers.json'), JSON.stringify(answers));
