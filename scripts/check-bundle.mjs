// Q-5: перф-бюджет initial-бандла. Падает, если entry+vendor+css превышают лимит
// или сид перестал быть отдельным ленивым чанком.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DIR = 'dist/assets';
const INITIAL_BUDGET_KB = 110; // gzip: index + vendor + css (Overview и мелочь не считаем — они <7 КБ)

let initial = 0;
let seedChunk = null;
for (const f of readdirSync(DIR)) {
  if (!/\.(js|css)$/.test(f)) continue;
  const gz = gzipSync(readFileSync(join(DIR, f))).length / 1024;
  if (/^seed-/.test(f)) seedChunk = { f, gz };
  if (/^(index|vendor)-.*\.(js|css)$/.test(f)) initial += gz;
}

const fail = (msg) => {
  console.error('BUNDLE BUDGET FAIL: ' + msg);
  process.exit(1);
};

if (!seedChunk) fail('демо-корпус не найден отдельным чанком (seed-*.js) — сид попал в initial-бандл?');
console.log(`initial (index+vendor+css) = ${initial.toFixed(1)} KB gzip (budget ${INITIAL_BUDGET_KB})`);
console.log(`seed chunk = ${seedChunk.f}: ${seedChunk.gz.toFixed(1)} KB gzip (lazy)`);
if (initial > INITIAL_BUDGET_KB) fail(`initial ${initial.toFixed(1)} KB > ${INITIAL_BUDGET_KB} KB`);
console.log('bundle budget OK');
