#!/usr/bin/env node
/* eslint-env node */
/**
 * Lists the AMS files this repo has edited in place. The goal is an empty list.
 *
 * A sync can only conflict on a file both sides changed. So the rule that keeps
 * syncs conflict-free is that this repo never edits a file AMS ships. The app's
 * differences live instead in:
 *
 *   - `X.mobile.js` overrides beside AMS's `X.js` (build/mobileOverrides.js),
 *     most of them native implementations of the seams in src/mobile/README.md;
 *   - files AMS does not have at all (src/mobile/*.mobile.*, android/, ...);
 *   - vite.app.config.js / vitest.app.config.js, which wrap AMS's configs;
 *   - the few files with a merge driver in .gitattributes (package.json and
 *     friends), which resolve on their own.
 *
 * A fix that belongs in a shared file goes to AMS as a PR, and arrives here with
 * the next sync. Anything this prints is a future conflict waiting for the web
 * team to touch the same lines.
 *
 *   npm run ams-edits            list them
 *   npm run ams-edits -- --check exit 1 if there are any
 *
 * AMS's file list comes from the AMS clone that safe-pull-from-ams.ps1 exports
 * from (AMS_PATH to override). The vendor branch cannot answer that: the sync
 * never deletes, so `ams-update` still holds files AMS removed long ago, and
 * nothing upstream will ever edit those.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const check = process.argv.includes('--check');
const git = (args, cwd) =>
  execFileSync('git', args, { encoding: 'utf8', cwd, maxBuffer: 64 * 1024 * 1024 }).trim();

const AMS_PATH = path.resolve(process.env.AMS_PATH || '../IAMS/AMS-with-TimeTable');
if (!existsSync(path.join(AMS_PATH, '.git'))) {
  console.error(`No AMS clone at ${AMS_PATH}. Set AMS_PATH to one.`);
  process.exit(2);
}

// What AMS ships now, at the ref the sync exports. AMS_REF checks against
// another, e.g. a PR branch before it merges.
const amsRef = process.env.AMS_REF || 'origin/main';
const amsFiles = new Set(
  git(['ls-tree', '-r', '--name-only', `${amsRef}:client`], AMS_PATH).split('\n').filter(Boolean),
);

// Resolved by a driver, so an edit there cannot stop a sync.
const DRIVEN = new Set(['mobile', 'package-json', 'union']);
const driverOf = (files) => {
  if (!files.length) return new Map();
  const out = execFileSync('git', ['check-attr', 'merge', '--stdin'], {
    input: files.join('\n'),
    encoding: 'utf8',
  });
  return new Map(
    out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [file, , value] = line.split(': ');
        return [file, value];
      }),
  );
};

const ours = git(['ls-files']).split('\n').filter((f) => amsFiles.has(f));
const drivers = driverOf(ours);

const edited = [];
for (const file of ours) {
  if (DRIVEN.has(drivers.get(file))) continue;
  const theirs = git(['rev-parse', `${amsRef}:client/${file}`], AMS_PATH);
  const mine = git(['hash-object', file]);
  if (theirs !== mine) edited.push(file);
}

if (!edited.length) {
  console.log(`No AMS file is edited in place (checked ${ours.length} against AMS ${amsRef}).`);
  process.exit(0);
}

console.log(`${edited.length} AMS file(s) edited in place. Each is a future sync conflict:\n`);
for (const file of edited) console.log(`  ${file}`);
console.log(
  '\nMove the change into AMS (a PR), or into an X.mobile.js override or seam. See src/mobile/README.md.',
);
if (check) process.exit(1);
