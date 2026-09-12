#!/usr/bin/env node
/**
 * Registers the merge drivers named in .gitattributes.
 *
 * .gitattributes can say a file uses `merge=mobile`, but it cannot say what
 * `mobile` does — that lives in git config, which is per-clone and never
 * committed. Without this step the attributes are inert and every sync falls
 * back to the line-based merge they exist to avoid, silently: nothing warns
 * you, the conflicts simply come back.
 *
 * So it runs from npm's `prepare`, which fires on `npm install` and `npm ci`.
 * A fresh clone is configured by the install everyone does anyway, and the CI
 * runner is configured by the same step. Run it directly with
 * `npm run setup:git` if a clone predates this file.
 *
 * The drivers:
 *   mobile        keep ours, always. Registered as `true` — the shell builtin,
 *                 which succeeds without touching %A, and %A is already ours.
 *   package-json  union the dependency maps; see build/mergePackageJson.mjs.
 *   additive      keep both sides when they only added imports at the same
 *                 point; see build/mergeAdditive.mjs.
 */
import { execFileSync } from 'node:child_process';

const DRIVERS = [
  ['merge.mobile.name', 'keep this repo\'s version (see .gitattributes)'],
  ['merge.mobile.driver', 'true'],
  ['merge.package-json.name', 'union dependencies, keep our version and scripts'],
  ['merge.package-json.driver', 'node build/mergePackageJson.mjs %O %A %B %P'],
  ['merge.additive.name', 'keep both sides of an import-only insertion'],
  // %L is the conflict marker size. git varies it when a file already contains
  // something that looks like a marker, so the driver has to be told rather
  // than assuming seven, or it would parse its own output wrongly in exactly
  // the file where being wrong is least recoverable.
  ['merge.additive.driver', 'node build/mergeAdditive.mjs %O %A %B %L %P'],
];

try {
  for (const [key, value] of DRIVERS) {
    execFileSync('git', ['config', key, value], { stdio: 'pipe' });
  }
  console.log('[git-merge-setup] merge drivers registered (mobile, package-json)');
} catch (error) {
  // Never fail an install over this. Installing from a tarball, or in a
  // container with no git, is legitimate — and a missing driver costs a
  // conflict later, not a broken build now.
  console.warn(`[git-merge-setup] skipped: ${error.message.split('\n')[0]}`);
}
