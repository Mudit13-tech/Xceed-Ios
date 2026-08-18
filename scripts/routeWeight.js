/* eslint-env node */
/**
 * What one screen actually costs a student to open.
 *
 * The build prints a list of chunks, which answers a different question — the
 * total is meaningless once the app is split, and the biggest chunk is usually
 * one nobody loads. What matters is the *closure*: the entry, plus the chunk
 * for the screen, plus everything those pull in transitively.
 *
 * Reads dist/.vite/manifest.json (enabled in vite.config.js) and reports raw and
 * gzipped bytes for the named source files.
 *
 *   node scripts/routeWeight.js
 *   node scripts/routeWeight.js src/learningModule/pages/QuizAttempt.jsx
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(DIST, '.vite', 'manifest.json'), 'utf8'));

// The screens worth watching: what a student opens to sit a test, and a couple
// of others for contrast.
const DEFAULT_ROUTES = [
  'src/learningModule/LearningRoutes.jsx',
  'src/learningModule/pages/QuizBrief.jsx',
  'src/learningModule/pages/QuizAttempt.jsx',
];

const byFile = new Map(Object.entries(manifest));
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);

/** Every chunk needed before a given manifest entry can run. */
function closure(keys) {
  const seen = new Set();
  const queue = [...keys];
  while (queue.length) {
    const key = queue.shift();
    if (!key || seen.has(key) || !byFile.has(key)) continue;
    seen.add(key);
    const chunk = byFile.get(key);
    // `imports` are static — needed to run. `dynamicImports` are further splits
    // that load later, so they are not part of this screen's cost.
    (chunk.imports || []).forEach((next) => queue.push(next));
    (chunk.css || []).forEach((css) => seen.add(`css:${css}`));
  }
  return seen;
}

function weigh(keys) {
  const files = new Set();
  closure(keys).forEach((key) => {
    if (key.startsWith('css:')) files.add(key.slice(4));
    else if (byFile.has(key)) files.add(byFile.get(key).file);
  });

  let raw = 0;
  let gz = 0;
  files.forEach((file) => {
    const full = path.join(DIST, file);
    if (!fs.existsSync(full)) return;
    const bytes = fs.readFileSync(full);
    raw += bytes.length;
    gz += zlib.gzipSync(bytes, { level: 6 }).length;
  });
  return { raw, gz, count: files.size };
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const row = (label, { raw, gz, count }) =>
  `${label.padEnd(46)} ${kb(raw).padStart(9)} raw  ${kb(gz).padStart(9)} gzip  ${String(count).padStart(3)} files`;

const routes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROUTES;
const entry = weigh([entryKey]);

console.log(row('entry (every page pays this)', entry));
console.log('-'.repeat(86));

// Cumulative, because that is how a student meets them: the entry loads, then
// the learning shell, then the screen.
const seen = [entryKey];
routes.forEach((route) => {
  if (!byFile.has(route)) {
    console.log(`${route} — not in the manifest (is it lazily imported?)`);
    return;
  }
  seen.push(route);
  console.log(row(`+ ${route.replace('src/learningModule/', '')}`, weigh(seen)));
});
