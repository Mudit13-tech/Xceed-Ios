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

module.exports = { walkFiles, hashFile, buildManifest, diffManifests };
