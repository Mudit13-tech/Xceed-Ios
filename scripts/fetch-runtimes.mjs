/**
 * Fetches the notebook kernels' runtimes at build time, so they can be served
 * from this app's own origin instead of somebody else's CDN.
 *
 * ## Why this exists
 *
 * Both kernels used to load from public CDNs — Pyodide from jsDelivr, clang from
 * runno.dev. That works until it does not, and when it does not the student sees:
 *
 *     Failed to execute 'importScripts' on 'WorkerGlobalScope':
 *     The script at 'https://cdn.jsdelivr.net/pyodide/…/pyodide.js' failed to load.
 *
 * which is a lab full of people unable to run a single cell. jsDelivr is blocked
 * outright by several Indian ISPs, and runno.dev is one small host with no CDN
 * behind it at all. Neither is a dependency a teaching platform should have in
 * the middle of a timetabled session.
 *
 * Served from our own origin, there is nothing left to block: if a student can
 * load the page, they can load the kernel.
 *
 * ## Why at build time rather than committed
 *
 * Half a gigabyte does not belong in git. It is downloaded during the build,
 * cached under node_modules (which the host keeps between builds), and emitted
 * into public/ where Vite copies it to dist/ untouched. Netlify stores assets by
 * content hash, so the second deploy uploads none of it again.
 *
 * ## Why these sources
 *
 * Both are version-pinned and reachable from a CI network:
 *   - Pyodide from its GitHub release, which is where the CDN gets it too.
 *   - clang from the `@runno/sandbox` npm package, which ships the exact three
 *     files runno.dev serves. npm is a better dependency than a personal domain:
 *     pinned, immutable, cached, and already how everything else here arrives.
 *
 * Usage: `node scripts/fetch-runtimes.mjs [--force]`
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const publicDir = path.join(root, 'public');
// Netlify (and most CI) preserve node_modules between builds, so a cache placed
// here survives; anywhere else and the 284 MB is re-downloaded every time.
const cacheDir = path.join(root, 'node_modules', '.cache', 'notebook-runtimes');

const PYODIDE_VERSION = '0.26.4';
const PYODIDE_URL = `https://github.com/pyodide/pyodide/releases/download/${PYODIDE_VERSION}/pyodide-${PYODIDE_VERSION}.tar.bz2`;

const RUNNO_VERSION = '0.10.2';
const RUNNO_URL = `https://registry.npmjs.org/@runno/sandbox/-/sandbox-${RUNNO_VERSION}.tgz`;
/** The only three files the C worker asks for. */
const CLANG_FILES = ['clang.wasm', 'wasm-ld.wasm', 'clang-fs.tar.gz'];

/**
 * Packages not worth mirroring.
 *
 * The full Pyodide distribution is 1.27 GB, and about a third of that is a dozen
 * single-domain libraries — astronomy, genomics, GIS, computer vision, NLP
 * corpora — that no B.Tech lab on this platform is going to import. Dropping
 * them takes the mirror to ~535 MB with every package a Python, VLSI or general
 * engineering course would reach for still present.
 *
 * **This is a starting point, not a policy.** If a course needs one of these,
 * delete the line and rebuild; the machinery does not care which names are here.
 * Nothing silently half-works either: a pruned package is removed from
 * `pyodide-lock.json` too, so Pyodide reports it as unavailable rather than
 * letting a student watch a fetch 404.
 */
const SKIP_PACKAGES = new Set([
  // Names as `pyodide-lock.json` spells them, which is **not** how the wheel
  // filenames do: the lock says `python-flint`, the file says `python_flint`.
  // Getting that wrong is a silent no-op that mirrors the package anyway, so
  // every name here is checked against the lock and an unknown one fails the
  // build.
  'python-flint',   // 156 MB — number theory
  'yt',             //  94 MB — astrophysics
  'opencv-python',  //  48 MB
  'duckdb',         //  48 MB
  'pysam',          //  38 MB — genomics
  'astropy',        //  22 MB — astronomy
  'scikit-image',   //  21 MB — opencv's neighbour; scikit-learn is the taught one
  'robotraconteur', //  18 MB — robotics middleware
  'mne',            //  14 MB — neuroimaging
  'fiona',          // the GIS stack, and everything built on it
  'gdal',
  'pyproj',
  'geopandas',
  'cartopy',
  'netcdf4',
  'gensim',         // NLP corpora
  'nltk',
  'mypy',           // a type checker, in a browser
  'bokeh',          // matplotlib is the one that is taught
  'h5py',
  'biopython',
  'libmagic',
  'test',           // 27 MB — CPython's own test suite
]);

/* ─────────────────────────────── helpers ──────────────────────────────── */

const log = (message) => process.stdout.write(`[runtimes] ${message}\n`);
const mb = (bytes) => `${(bytes / 1e6).toFixed(0)} MB`;

/** Directory size, for reporting what the build actually produced. */
function measure(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? measure(full) : fs.statSync(full).size;
  }
  return total;
}

/**
 * Downloads to the cache, or reports the copy already there.
 *
 * Written to a temporary name and renamed on success, so an interrupted build
 * cannot leave a half-file behind that every later build then trusts.
 */
async function download(url, name) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const target = path.join(cacheDir, name);
  if (fs.existsSync(target)) {
    log(`cached  ${name} (${mb(fs.statSync(target).size)})`);
    return target;
  }

  log(`fetching ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);

  const partial = `${target}.partial`;
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(partial, bytes);
  fs.renameSync(partial, target);
  log(`fetched ${name} (${mb(bytes.length)})`);
  return target;
}

/**
 * Extraction is shelled out to `tar`.
 *
 * Node has gzip built in but not bzip2, and the Pyodide release is bz2. A pure-JS
 * bzip2 decoder would be a dependency carried by every developer on the team to
 * save calling a program that is already present on every CI image and every
 * machine anyone builds this on.
 */
function extract(archive, into) {
  fs.mkdirSync(into, { recursive: true });
  try {
    execFileSync('tar', ['xf', archive, '-C', into], { stdio: 'inherit' });
  } catch (error) {
    throw new Error(
      `Could not extract ${path.basename(archive)} with tar. `
      + 'This script needs GNU or BSD tar with bzip2 support on PATH — every CI image '
      + `has it; on Windows use WSL or Git Bash. (${error.message})`,
    );
  }
}

/** A build is only redone when something that shapes it has changed. */
const stampFor = (parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16);

function isCurrent(dir, stamp) {
  const file = path.join(dir, '.stamp');
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').trim() === stamp;
}

/* ─────────────────────────────── pyodide ──────────────────────────────── */

/**
 * Packages that a course will definitely want, whatever the skip list says.
 *
 * The guard rail on the list below: if editing `SKIP_PACKAGES` ever knocks one of
 * these out, the build stops and says which. Better a failed build than a term
 * spent wondering why `import pandas` stopped working.
 */
const MUST_KEEP = ['numpy', 'pandas', 'matplotlib', 'scipy', 'sympy', 'scikit-learn', 'micropip'];

/**
 * Everything to drop: the skip list, plus whatever depends on it.
 *
 * Dropping a package without dropping its dependents would leave the
 * distribution internally inconsistent — `contextily` present and the
 * `geopandas` it imports gone — and the failure would surface as a broken import
 * in a student's notebook rather than as an error here.
 *
 * The direction matters and is easy to get backwards. An earlier version of this
 * walked the *forward* dependencies and kept anything reachable, which rescued
 * geopandas, fiona, cartopy and the whole GIS stack on account of one obscure
 * package that imports them — pruning nothing and defeating the exercise.
 * "We are not shipping GIS" means the stack and everyone who needs it.
 */
export function resolvePruned(packages, skip = SKIP_PACKAGES, mustKeep = MUST_KEEP) {
  const dependents = new Map();
  for (const [name, spec] of Object.entries(packages)) {
    for (const dependency of spec.depends || []) {
      if (!dependents.has(dependency)) dependents.set(dependency, []);
      dependents.get(dependency).push(name);
    }
  }

  const unknown = [...skip].filter((name) => !packages[name]);
  if (unknown.length) {
    throw new Error(
      `SKIP_PACKAGES names ${unknown.join(', ')}, which ${unknown.length === 1 ? 'is' : 'are'} not in `
      + 'pyodide-lock.json. Use the lock\'s spelling, not the wheel filename\'s — `python-flint`, '
      + 'not `python_flint`. A name that matches nothing would silently mirror the package anyway.',
    );
  }

  const pruned = new Set();
  const stack = [...skip];
  while (stack.length) {
    const name = stack.pop();
    if (pruned.has(name)) continue;
    pruned.add(name);
    stack.push(...(dependents.get(name) || []));
  }

  const casualties = mustKeep.filter((name) => pruned.has(name));
  if (casualties.length) {
    throw new Error(
      `SKIP_PACKAGES would drop ${casualties.join(', ')}, which the notebooks teach. `
      + 'Something on the skip list is a dependency of it — remove that entry.',
    );
  }
  return pruned;
}

/**
 * Removes the pruned packages and the test suites from the lock, in place.
 *
 * Separated from the file copying because the lock is the part that has to stay
 * *consistent*: a package it still advertises whose wheel is not on disk is a
 * 404 in a student's notebook, and a surviving package whose dependency was
 * pruned is an unresolvable import. Both are checked by the tests.
 *
 * @returns the set of filenames that must not be copied.
 */
export function pruneLock(lock, skip = SKIP_PACKAGES, mustKeep = MUST_KEEP) {
  const pruned = resolvePruned(lock.packages, skip, mustKeep);
  const dropFile = new Set();
  for (const name of pruned) dropFile.add(lock.packages[name].file_name);

  for (const [name, spec] of Object.entries(lock.packages)) {
    if (pruned.has(name)) {
      delete lock.packages[name];
      continue;
    }
    /* The per-package test suites are 150 MB of tarballs that only an
       `import numpy.tests` would ever request, which no notebook does.

       They have to be removed from the lock two ways, which is not obvious and
       cost a round of this: every package carries an `unvendored_tests` flag,
       *and* the suite is separately registered as its own package — `numpy-tests`
       alongside `numpy`. Clearing only the flag leaves fifty-four lock entries
       pointing at tarballs that are no longer there. */
    if (spec.file_name.endsWith('-tests.tar')) {
      delete lock.packages[name];
      dropFile.add(spec.file_name);
      continue;
    }
    if (spec.unvendored_tests) spec.unvendored_tests = false;
  }
  return dropFile;
}

async function buildPyodide() {
  const out = path.join(publicDir, 'pyodide');
  const stamp = stampFor([PYODIDE_VERSION, [...SKIP_PACKAGES].sort()]);
  if (isCurrent(out, stamp) && !process.argv.includes('--force')) {
    log(`pyodide ${PYODIDE_VERSION} already in public/pyodide — skipping`);
    return;
  }

  const archive = await download(PYODIDE_URL, `pyodide-${PYODIDE_VERSION}.tar.bz2`);
  const staging = path.join(cacheDir, 'pyodide-staging');
  fs.rmSync(staging, { recursive: true, force: true });
  extract(archive, staging);

  const source = path.join(staging, 'pyodide');
  const lock = JSON.parse(fs.readFileSync(path.join(source, 'pyodide-lock.json'), 'utf8'));
  const dropFile = pruneLock(lock);

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  let copied = 0;
  let skipped = 0;
  for (const entry of fs.readdirSync(source)) {
    if (entry === 'pyodide-lock.json') continue;
    if (dropFile.has(entry) || entry.endsWith('-tests.tar')) { skipped += 1; continue; }
    // Recursive: the distribution ships a `fonts/` directory alongside the files.
    fs.cpSync(path.join(source, entry), path.join(out, entry), { recursive: true });
    copied += 1;
  }
  // Written last and from memory, so the manifest can never describe files that
  // were not copied.
  fs.writeFileSync(path.join(out, 'pyodide-lock.json'), JSON.stringify(lock));
  fs.writeFileSync(path.join(out, '.stamp'), stamp);

  fs.rmSync(staging, { recursive: true, force: true });
  log(`pyodide ${PYODIDE_VERSION}: ${copied + 1} files kept, ${skipped} dropped, ${mb(measure(out))}`);
}

/* ──────────────────────────────── clang ───────────────────────────────── */

async function buildClang() {
  const out = path.join(publicDir, 'clang');
  const stamp = stampFor([RUNNO_VERSION, CLANG_FILES]);
  if (isCurrent(out, stamp) && !process.argv.includes('--force')) {
    log(`clang toolchain already in public/clang — skipping`);
    return;
  }

  const archive = await download(RUNNO_URL, `runno-sandbox-${RUNNO_VERSION}.tgz`);
  const staging = path.join(cacheDir, 'runno-staging');
  fs.rmSync(staging, { recursive: true, force: true });
  extract(archive, staging);

  const langs = path.join(staging, 'package', 'dist', 'langs');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  for (const name of CLANG_FILES) {
    const from = path.join(langs, name);
    if (!fs.existsSync(from)) {
      throw new Error(
        `@runno/sandbox ${RUNNO_VERSION} does not contain dist/langs/${name}. `
        + 'The package layout changed — check a newer version before bumping RUNNO_VERSION.',
      );
    }
    fs.copyFileSync(from, path.join(out, name));
  }
  fs.writeFileSync(path.join(out, '.stamp'), stamp);

  fs.rmSync(staging, { recursive: true, force: true });
  log(`clang toolchain: ${CLANG_FILES.length} files, ${mb(measure(out))}`);
}

/* ───────────────────────────────── main ───────────────────────────────── */

/* Only when run as a program. The pruning above is exported and tested, and an
   import that downloaded 300 MB as a side effect would be a poor thing to hand a
   test runner. */
const runAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

try {
  if (runAsScript) {
    await buildPyodide();
    await buildClang();
    log('done — notebook kernels will be served from this origin');
  }
} catch (error) {
  /* Leave nothing half-built. The stamp is written last, so an interrupted run
     would not be *trusted* by the next build — but a partial public/pyodide
     would still be deployed, and a mirror missing the file a student needs is
     worse than no mirror at all. */
  for (const name of ['pyodide', 'clang']) {
    const dir = path.join(publicDir, name);
    if (fs.existsSync(dir) && !fs.existsSync(path.join(dir, '.stamp'))) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  process.stderr.write(`[runtimes] ${error.message}\n`);
  /* A build that cannot fetch the runtimes still produces a working app: the
     kernels fall back to their CDNs, which is what they did before this script
     existed. Failing the whole deploy over it would turn a degraded notebook
     into no platform at all. */
  process.stderr.write('[runtimes] continuing without local runtimes — the kernels will use their CDNs\n');
}
