const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');
const FormData = require('form-data');
const axios = require('axios');
const { execSync } = require('child_process');
const { buildManifest, diffManifests } = require('./otaManifest.cjs');
require('dotenv').config();

const DIST_DIR = path.join(__dirname, '../dist');
const ZIP_PATH = path.join(__dirname, '../update.zip');
const PACKAGE_JSON_PATH = path.join(__dirname, '../package.json');

// Get secret key from environment or prompt
const SECRET_KEY = process.env.OTA_SECRET_KEY;
// We should probably read this from the same logic getenvironment.js uses.
// For the script, we'll assume production by default unless an arg is passed
const isDev = process.argv.includes('--dev');
const SERVER_URL = isDev ? 'http://localhost:8010' : (process.env.OTA_SERVER_URL || 'https://xceed.nitj.ac.in');
const UPLOAD_URL = `${SERVER_URL}/api/v1/ota/upload`;
const VERSION_URL = `${SERVER_URL}/api/v1/ota/version.json`;

/**
 * Where the device fetches a file it has neither builtin nor cached.
 *
 * Addressed by content, not by release: two versions that share a file share
 * the URL, which is what lets the server store one copy and the device reuse
 * what it already downloaded for an earlier bundle.
 */
const fileUrl = (hash) => `${SERVER_URL}/api/v1/ota/files/${hash}`;

async function deploy() {
  console.log('🚀 Starting OTA Deployment...');

  // 1. Build the project
  console.log('📦 Building Vite project...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Build failed. Aborting deployment.');
    process.exit(1);
  }

  // 2. Read current version and work out the next patch version.
  // The bump is only written to package.json once the upload has actually been
  // accepted (step 5). Writing it here left the repo claiming a version that was
  // never published whenever the upload failed — and the workflow then committed
  // and pushed that phantom bump.
  const pkg = require(PACKAGE_JSON_PATH);
  const currentVersion = pkg.version;
  const parts = currentVersion.split('.');
  parts[2] = parseInt(parts[2]) + 1;
  const newVersion = parts.join('.');

  console.log(`📈 Publishing version: ${currentVersion} -> ${newVersion}`);

  // 3. Build the file manifest that lets devices download only what changed.
  //
  // Without this the device has one URL and one choice: fetch the whole bundle.
  // With it, each file is addressed by its own hash, and the plugin resolves an
  // entry from the APK's builtin assets or its content-addressed cache before it
  // reaches the network — so a release that touches one route moves that route's
  // chunk instead of every image, font and vendor chunk alongside it.
  console.log('🧾 Building file manifest...');
  const manifest = buildManifest(DIST_DIR, fileUrl);
  console.log(`✅ Manifest built: ${manifest.length} files.`);

  // 3b. Report what a device on the current release will actually fetch.
  //
  // Best-effort and never fatal: it is the only place the size of a release is
  // visible, but a server that cannot answer is not a reason to refuse to
  // publish. The real comparison happens on the device against its own cache,
  // which reaches back further than one release — so this is a ceiling on the
  // download, not a prediction of it.
  try {
    const { data: current } = await axios.get(VERSION_URL, { timeout: 10000 });
    if (Array.isArray(current?.manifest)) {
      const { changed, unchanged, total } = diffManifests(current.manifest, manifest);
      const changedBytes = changed.reduce(
        (sum, entry) => sum + fs.statSync(path.join(DIST_DIR, ...entry.file_name.split('/'))).size,
        0
      );
      console.log(
        `📊 Since ${current.version}: ${changed.length} of ${total} files changed ` +
          `(${(changedBytes / 1048576).toFixed(2)} MB), ${unchanged} reused.`
      );
    } else {
      console.log('📊 Server has no manifest yet — this release is the baseline.');
    }
  } catch (error) {
    console.log(`📊 Could not read ${VERSION_URL} for a size comparison (${error.message}).`);
  }

  // 4. Zip the dist folder
  console.log('🗜️ Zipping dist folder...');
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(ZIP_PATH);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    // Zip the contents of the dist folder, not the folder itself
    archive.directory(DIST_DIR, false);
    archive.finalize();
  });
  console.log('✅ Zipped successfully.');

  // 5. Upload to server
  console.log(`📤 Uploading to ${UPLOAD_URL}...`);
  try {
    const form = new FormData();
    form.append('version', newVersion);
    /* The zip still carries the bytes — the manifest only says how they are
       addressed, so the server unpacks it into a store keyed by file_hash and
       serves each entry at its download_url. Sending both keeps whole-bundle
       download working as the fallback for devices whose plugin predates
       manifest support, which ignore the manifest and fetch `url` instead.

       Ordered before the file deliberately. multer fills req.body as it parses,
       so a text field sent after the file is not yet readable from the storage
       and fileFilter callbacks that run mid-stream — a trap for any later change
       that wants to name the upload after its version or check the manifest
       before accepting bytes. */
    form.append('manifest', JSON.stringify(manifest));
    form.append('updateFile', fs.createReadStream(ZIP_PATH));

    const response = await axios.post(UPLOAD_URL, form, {
      headers: {
        ...form.getHeaders(),
        'x-ota-secret-key': SECRET_KEY,
        /* The server's csrfGuard refuses a state-changing request that carries no
           header a cross-site form could not have set, so every browser call goes
           out with this — see the axios interceptor in src/main.jsx. This script
           runs in Node and never loads that interceptor, so it has to set the
           header itself; without it the upload comes back CSRF_HEADER_REQUIRED. */
        'X-App-Name': 'xceed-learning',
      },
    });

    console.log('🎉 OTA Update Published Successfully!');
    console.log('URL:', response.data.url);

    // Only now is the new version real, so record it.
    pkg.version = newVersion;
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2));
    console.log(`📝 package.json set to ${newVersion}`);
  } catch (error) {
    console.error('❌ Upload failed:');
    if (error.response) {
      console.error(error.response.status, error.response.data);
    } else {
      console.error(error.message);
    }
    console.error(`⚠️  Nothing was published. package.json left at ${currentVersion}.`);
    // Exit non-zero so CI fails loudly instead of reporting a green run for a
    // release that never happened.
    process.exitCode = 1;
  } finally {
    // Cleanup zip
    if (fs.existsSync(ZIP_PATH)) {
      fs.unlinkSync(ZIP_PATH);
    }
  }
}

deploy();
