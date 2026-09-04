#!/usr/bin/env node
/**
 * Reports what AMS has changed in the files this repo overrides.
 *
 * Overriding a file buys clean merges by giving up inheritance, and the giving
 * up is silent — that is the whole danger of it. getenvironment.js is the
 * warning: it sat as a fork for months, still naming a Render host AMS had
 * deleted, and nothing ever said so because a fork has no conflicts to report.
 *
 * So the inheritance that used to arrive as a merge conflict arrives here
 * instead, as a list. For every `X.mobile.ext` under src/, this compares the
 * AMS original at the commit where the override was last touched against the
 * original on `ams-update` now. Anything it prints is a change the web team
 * made that this app has not taken.
 *
 *   npm run drift          list what upstream has changed since
 *   npm run drift -- -v    ...with the diffs
 *   npm run drift -- --check   exit 1 if anything has drifted (for CI)
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const argv = process.argv.slice(2);
const verbose = argv.includes('-v') || argv.includes('--verbose');
const check = argv.includes('--check');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const gitQuiet = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};

// The vendor branch may only exist as a remote ref in a fresh clone or on a CI
// runner that fetched a single branch.
const vendorFlag = argv.indexOf('--vendor');
const VENDOR_CANDIDATES = vendorFlag === -1 ? ['ams-update', 'origin/ams-update'] : [argv[vendorFlag + 1]];
const VENDOR = VENDOR_CANDIDATES.find((ref) => gitQuiet('rev-parse', '--verify', `${ref}^{commit}`));
if (!VENDOR) {
  console.error('No ams-update branch found locally or on origin — nothing to compare against.');
  console.error('Fetch it with: git fetch origin ams-update:ams-update');
  process.exit(check ? 1 : 0);
}

// Listed and filtered here rather than with a pathspec: git's `src/**/*` needs
// at least one directory level, so a glob quietly skips the overrides sitting
// directly in src/ — which is where getenvironment.mobile.js lives.
const overrides = git('ls-files', 'src')
  .split('\n')
  .filter((file) => /[.]mobile[.][^.]+$/.test(file))
  .map((override) => {
    const ext = path.extname(override);
    const stem = override.slice(0, override.length - ext.length);
    return { override, original: `${stem.slice(0, -'.mobile'.length)}${ext}` };
  });

if (overrides.length === 0) {
  console.log('No overrides in this tree.');
  process.exit(0);
}

console.log(`Overrides vs ${VENDOR}\n`);

let drifted = 0;

for (const { override, original } of overrides) {
  // A wrapper that imports its original inherits upstream automatically, so
  // there is nothing here to port and nothing to report.
  const wraps = gitQuiet('grep', '-l', '-e', `from './${path.basename(original, path.extname(original))}'`, 'HEAD', '--', override);

  const since = gitQuiet('log', '-1', '--format=%H', '--', override);
  if (!since) {
    console.log(`  ${override}\n      (never committed)\n`);
    continue;
  }

  const upstreamExists = gitQuiet('cat-file', '-e', `${VENDOR}:${original}`) !== null;
  if (!upstreamExists) {
    console.log(`  ${original}\n      gone from ${VENDOR} — the override may no longer be needed\n`);
    drifted += 1;
    continue;
  }

  const numstat = gitQuiet('diff', '--numstat', since, VENDOR, '--', original);
  if (!numstat) {
    console.log(`  ${original}\n      up to date\n`);
    continue;
  }

  const [added, removed] = numstat.split('\t');
  const commits = (gitQuiet('log', '--oneline', `${since}..${VENDOR}`, '--', original) || '')
    .split('\n')
    .filter(Boolean);

  drifted += 1;
  const note = wraps ? '  [wrapper — delegates to the original, so most changes arrive on their own]' : '';
  console.log(`  ${original}${note}`);
  console.log(`      +${added} -${removed} across ${commits.length} upstream commit${commits.length === 1 ? '' : 's'} since ${since.slice(0, 7)}`);
  console.log(`      port into: ${override}`);
  console.log(`      see: git diff ${since.slice(0, 7)} ${VENDOR} -- ${original}`);
  if (verbose) {
    console.log('');
    console.log(
      (gitQuiet('diff', since, VENDOR, '--', original) || '')
        .split('\n')
        .map((line) => `        ${line}`)
        .join('\n'),
    );
  }
  console.log('');
}

console.log(
  drifted === 0
    ? `All ${overrides.length} override${overrides.length === 1 ? '' : 's'} are current with ${VENDOR}.`
    : `${drifted} of ${overrides.length} override${overrides.length === 1 ? '' : 's'} ${drifted === 1 ? 'has' : 'have'} upstream changes not yet ported.`,
);

process.exit(check && drifted > 0 ? 1 : 0);
