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

/**
 * Values this repo deliberately kept while AMS was moving them, collected for
 * the report at the end.
 *
 * "Keep ours" is the correct rule and also a silent one, which is the same trap
 * `.mobile.` overrides set and build/amsDrift.mjs exists to answer: once a key
 * diverges, every later upstream change to it is dropped with nothing said. The
 * live example is `scripts.build` — AMS's is
 * `node scripts/fetch-runtimes.mjs && vite build`, ours is plain `vite build`
 * because that mirror is half a gigabyte this app must not ship (see
 * .env.production). That divergence is deliberate and permanent; a *later*
 * change AMS makes to the same script is not something anyone should have to
 * notice by accident.
 */
const held = [];

function mergeMap(baseMap = {}, ourMap = {}, theirMap = {}, { sorted = false, field = '' } = {}) {
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
    else if (inOurs && inTheirs && weChanged && ourMap[key] !== theirMap[key]) {
      // Kept ours over a different upstream value. Only worth reporting when
      // AMS actually moved it in this sync — a divergence that is merely still
      // standing is not news every time.
      if (inBase && theirMap[key] !== baseMap[key]) {
        held.push(`${field}.${key}: kept ${JSON.stringify(ourMap[key])} over AMS's ${JSON.stringify(theirMap[key])}`);
      }
    }
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
    result[field] = mergeMap(base[field], ours[field], theirs[field], { sorted: field !== 'scripts', field });
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

// Printed whether or not anything else changed: the whole point is that this is
// the only place an upstream change to a diverged key is ever mentioned.
for (const line of held) {
  console.error(`[merge-package-json] ${realPath}: ${line}`);
}

process.exit(0);
