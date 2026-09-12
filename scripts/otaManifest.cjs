const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Build the file manifest the Capgo updater uses for delta downloads.
 *
 * The device treats the manifest as the definition of the bundle: for each
 * entry it looks for a file with that hash in the APK's builtin assets, then in
 * its content-addressed cache, and only downloads when neither has it (see
 * handleManifestDownload in the plugin's DownloadService.java). That is where
 * the saving comes from — Vite content-hashes every chunk filename, so a file
 * the build did not touch produces byte-identical output and resolves locally.
 *
 * It also means the manifest has to be *complete*. An entry that is missing is
 * not "left as it was"; the file simply is not in the new bundle.
 */

/**
 * Every file under `dir`, relative to it, separated by `/`.
 *
 * The separator is not cosmetic. Deploys can run from a Windows checkout, and
 * `path.relative` there yields `assets\index-abc.js`, which the Android side
 * resolves as a single filename containing a backslash rather than a path —
 * the file lands in the bundle root and the app boots to a blank screen with
 * no download error to point at it.
 */
function walkFiles(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs, rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

/**
 * Directories that are built into `dist/` but must never enter an OTA bundle.
 *
 * The notebook kernels' runtimes — Pyodide and the clang toolchain, ~535 MB of
 * WebAssembly — are mirrored into `public/` by AMS's build so the *web* client
 * can serve them from its own origin, and Vite copies `public/` into `dist/`
 * verbatim. This app does not mirror them (see .env.production: it points the
 * kernels at https://xceed.nitj.ac.in instead), so in a normal build these
 * directories are simply absent and this list matches nothing.
 *
 * It exists for the build that is not normal. `npm run fetch:runtimes` is still
 * here as a development escape hatch, and a deploy from a checkout where
 * somebody has run it would otherwise publish half a gigabyte to every phone on
 * the network — with no error, because nothing about that is invalid. The zip
 * would simply be 25x its usual size and the manifest would list 100,000 files.
 * A silent 535 MB is not a failure mode worth leaving open for the sake of a
 * list of two.
 */
const BUNDLE_EXCLUDES = ['pyodide', 'clang'];

/** True for a `dist`-relative path that must not be published. */
function isExcludedFromBundle(fileName) {
  return BUNDLE_EXCLUDES.some((dir) => fileName === dir || fileName.startsWith(`${dir}/`));
}

/**
 * SHA-256, lowercase hex. The plugin compares with equalsIgnoreCase, so the
 * case does not matter to it, but keeping it stable keeps manifests diffable.
 *
 * This must always be the hash of the file as it will sit on disk. If a
 * transfer encoding is added later (the plugin decompresses any entry whose
 * file_name ends in `.br`), the hash still describes the *decompressed* bytes —
 * it is verified after decompression. Hashing the compressed payload instead
 * fails every file at checksum with nothing naming the cause.
 */
function hashFile(absPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

/**
 * @param distDir absolute path to the built web root.
 * @param downloadUrlFor (hash, fileName) => absolute URL the device fetches
 *   when it has neither a builtin nor a cached copy.
 * @returns ManifestEntry[], sorted by file name so two builds of the same tree
 *   produce identical manifests.
 */
function buildManifest(distDir, downloadUrlFor) {
  return walkFiles(distDir)
    .filter((fileName) => !isExcludedFromBundle(fileName))
    .sort()
    .map((fileName) => {
      const fileHash = hashFile(path.join(distDir, ...fileName.split('/')));
      return {
        file_name: fileName,
        file_hash: fileHash,
        download_url: downloadUrlFor(fileHash, fileName),
      };
    });
}

/**
 * What a device holding `previous` would actually have to fetch for `next`.
 *
 * Only ever used to report — the device does this comparison itself, and
 * against its own cache rather than against any one earlier release. It exists
 * because the whole point of the change is a number that nobody could see
 * before: the deploy log said "uploaded" either way.
 */
function diffManifests(previous, next) {
  const known = new Set((previous || []).map((entry) => entry.file_hash));
  const changed = next.filter((entry) => !known.has(entry.file_hash));
  return { changed, unchanged: next.length - changed.length, total: next.length };
}

module.exports = { walkFiles, hashFile, buildManifest, diffManifests, isExcludedFromBundle, BUNDLE_EXCLUDES };
