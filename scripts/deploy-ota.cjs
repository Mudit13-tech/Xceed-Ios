const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');
const FormData = require('form-data');
const axios = require('axios');
const { execSync } = require('child_process');
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

  // 3. Zip the dist folder
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

  // 4. Upload to server
  console.log(`📤 Uploading to ${UPLOAD_URL}...`);
  try {
    const form = new FormData();
    form.append('version', newVersion);
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
