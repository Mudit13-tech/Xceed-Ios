#!/usr/bin/env node
/**
 * A git merge driver for package.json, used by the AMS sync.
 *
 * The default line-based merge is wrong for this file in both directions. It
 * conflicts over dependencies that were merely added near each other — two
 * teams adding an unrelated package under "c" is a conflict about alphabetical
 * order, nothing more — and it silently accepts AMS's "version", "name" and
 * "scripts", which do not describe this app at all. The OTA channel reads
 * "version" to decide whether a bundle is new, and `npm run deploy:ota` is the
 * script the deploy invokes, so a merge that takes AMS's copy of either fails
 * the run outright. That is the failure the deploy-ota workflow's
 * grep for "deploy:ota" was added to catch after the fact; this driver is meant
 * to stop it happening.
 *
 * The rule, per dependency:
 *
 *   only AMS has it      -> take it. A package the web client started using is
 *                           exactly what the sync exists to deliver, and the
 *                           code importing it arrives in the same merge.
 *   only we have it      -> keep it. Capacitor and its plugins have no web side.
 *   both, we changed it  -> keep ours. A pin we moved deliberately (or a plugin
 *                           fork) outranks upstream's range.
 *   both, we did not     -> take AMS's. Upstream owns the version it tests with.
 *   AMS removed it       -> remove it, unless we had changed it, which means
 *                           something here still wants it.
 *
 * Everything outside the dependency maps is ours, except that "scripts" is
 * unioned the same way so a task the web team adds is available here too.
 *
 * git calls this as: node build/mergePackageJson.mjs %O %A %B %P
 *   %O base   %A ours (also the file to write)   %B theirs   %P real path
 * Exit 0 for a clean merge, 1 to report a conflict.
 */
import fs from 'node:fs';

const [, , basePath, oursPath, theirsPath, realPath = 'package.json'] = process.argv;

const read = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

const base = read(basePath) ?? {};
const ours = read(oursPath);
const theirs = read(theirsPath);

// A driver that cannot parse its inputs must not invent a result. Failing here
// hands the file back to git, which conflicts it, and a human sees real markers
// rather than a silently mangled manifest.
if (!ours || !theirs) {
  console.error(`[merge-package-json] ${realPath}: could not parse both sides; leaving the conflict to git.`);
  process.exit(1);
}

const MAPS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'scripts'];

function mergeMap(baseMap = {}, ourMap = {}, theirMap = {}, { sorted = false } = {}) {
  const merged = { ...ourMap };
  const keys = new Set([...Object.keys(baseMap), ...Object.keys(ourMap), ...Object.keys(theirMap)]);

  for (const key of keys) {
    const inBase = key in baseMap;
    const inOurs = key in ourMap;
    const inTheirs = key in theirMap;
    const weChanged = inOurs !== inBase || ourMap[key] !== baseMap[key];

    if (!inOurs && !inBase && inTheirs) merged[key] = theirMap[key]; // upstream added
    else if (inOurs && inTheirs && !weChanged) merged[key] = theirMap[key]; // upstream moved it, we had not
    else if (inBase && !inTheirs && !weChanged) delete merged[key]; // upstream removed
  }

  // npm keeps the dependency maps sorted, so sorting here avoids showing an
  // unrelated reordering as churn in the next sync's diff. The scripts block
  // is not sorted by npm and is read by people, so its order is left alone.
  if (!sorted) return merged;
  return Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
}

const result = { ...ours };
for (const field of MAPS) {
  if (field in ours || field in theirs || field in base) {
    result[field] = mergeMap(base[field], ours[field], theirs[field], { sorted: field !== 'scripts' });
  }
}

const before = JSON.stringify(ours);
const after = JSON.stringify(result);

// npm writes package.json with two-space indent and a trailing newline; matching
// that keeps `npm install` from rewriting the file on the next run.
fs.writeFileSync(oursPath, `${JSON.stringify(result, null, 2)}\n`);

if (before !== after) {
  const changed = [];
  for (const field of MAPS) {
    const ourKeys = new Set(Object.keys(ours[field] ?? {}));
    for (const key of Object.keys(result[field] ?? {})) {
      if (!ourKeys.has(key)) changed.push(`+${field}.${key}@${result[field][key]}`);
      else if (ours[field][key] !== result[field][key]) changed.push(`~${field}.${key}@${result[field][key]}`);
    }
    for (const key of ourKeys) {
      if (!(key in (result[field] ?? {}))) changed.push(`-${field}.${key}`);
    }
  }
  console.error(`[merge-package-json] ${realPath}: took from AMS: ${changed.join(' ') || '(none)'}`);
}

process.exit(0);
