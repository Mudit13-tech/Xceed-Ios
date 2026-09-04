# 📚 XCEED – Learning Module App

> A full-featured academic platform for NITJ, built with **React + Vite** and deployed as a native Android app via **Capacitor**.  
> This guide walks you through **everything** — from cloning the repo to pushing live OTA updates to users' phones.

---

## 📋 Table of Contents

1. [Prerequisites](#-1-prerequisites)
2. [Clone & Install](#-2-clone--install)
3. [Environment Setup (.env)](#-3-environment-setup-env)
4. [Running the Web App Locally](#-4-running-the-web-app-locally)
5. [Android App Setup (Capacitor)](#-5-android-app-setup-capacitor)
6. [Building & Running on Android Studio](#-6-building--running-on-android-studio)
7. [Publishing OTA Updates](#-7-publishing-ota-updates-over-the-air)
8. [Pulling Updates from AMS (Safe Sync)](#-8-pulling-updates-from-ams-safe-sync)
9. [Project Scripts Reference](#-9-project-scripts-reference)
10. [How OTA Updates Work (Under the Hood)](#-10-how-ota-updates-work-under-the-hood)
11. [Troubleshooting](#-11-troubleshooting)

---

## ⚙️ 1. Prerequisites

Install these tools **before** doing anything else.

| Tool | Version | Why it's needed |
|---|---|---|
| [Node.js](https://nodejs.org/) | **v22** (LTS) | Runtime for all JavaScript tooling |
| [Yarn](https://yarnpkg.com/getting-started/install) | Latest | Package manager (preferred over npm here) |
| [Git](https://git-scm.com/downloads) | Latest | To clone and manage the repository |
| [Android Studio](https://developer.android.com/studio) | Latest stable | To build and run the Android app |

> **Node version matters!**  
> This project requires **Node 22** (defined in `.nvmrc`). If you use [nvm](https://github.com/nvm-sh/nvm) (Mac/Linux) or [nvm-windows](https://github.com/coreybutler/nvm-windows), run `nvm use` inside the project folder and it will auto-switch.

---

## 📥 2. Clone & Install

### Step 1 — Clone the repository
```bash
git clone <your-repo-url>
cd learning-module-app
```

### Step 2 — Install all dependencies
```bash
yarn install
```
> This downloads every library the project needs into `node_modules/`. It may take a few minutes on the first run.

---

## 🔐 3. Environment Setup (.env)

The `.env` file is **not committed to Git** (it's in `.gitignore`). You must create it yourself.

### Step 1 — Create the file
In the **root** of the project folder (same level as `package.json`), create a file named exactly `.env`.

### Step 2 — Add the required variables

```env
# The URL of the backend server that serves and receives OTA updates
OTA_SERVER_URL=https://xceed.nitj.ac.in

# The secret key for authenticating OTA uploads.
# THIS MUST MATCH the OTA_SECRET_KEY set in the backend server's .env file.
OTA_SECRET_KEY=your_secret_key_here
```

> **How to get the secret key?**  
> Ask the project maintainer (whoever runs the backend server). The key in your `.env` must be **identical** to what is set on the server — otherwise OTA uploads will be rejected with a 401 Unauthorized error.

---

## 🌐 4. Running the Web App Locally

Start the development server:
```bash
yarn run dev
```

Open your browser at **`http://localhost:5173`** — you should see the app.

> The dev server automatically proxies all `/api` requests to `http://localhost:8010` (the backend). If you're running without a local backend, the app will still load but API calls will fail — this is expected.

---

## 📱 5. Android App Setup (Capacitor)

This project uses **Capacitor** to wrap the web app into a native Android app.

### Step 1 — Set up Android Studio
1. Download and install [Android Studio](https://developer.android.com/studio).
2. On first launch, let it download the **Android SDK** — it will prompt you automatically.
3. Via **Android Studio → SDK Manager**, make sure these are installed:
   - Android SDK Platform (API 35 or latest)
   - Android SDK Build-Tools
   - Android Emulator (if you don't have a physical device)

### Step 2 — Set `JAVA_HOME` (if needed)
Android Studio ships with its own JDK. Point your terminal to it:

**Windows (PowerShell):**
```powershell
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
```
> If `npx cap sync android` fails with a Java error, this is the fix.

---

## 🚀 6. Building & Running on Android Studio

Every time you change the web code and want to see it in the Android app, follow these **3 steps in order**:

### Step 1 — Build the web code
```bash
npm run build
```
Compiles your React app into the `dist/` folder (plain HTML, JS, CSS).

### Step 2 — Sync to Android
```bash
npx cap sync android
```
Copies `dist/` into the Android project and updates all Capacitor plugins.

### Step 3 — Open in Android Studio
```bash
npx cap open android
```
Once Android Studio opens:
1. Wait for the **Gradle sync** to finish (progress bar at the bottom).
2. Pick your target — a **connected phone** (USB, with USB Debugging enabled) or an **emulator** (create one via Device Manager).
3. Click the green **▶ Run** button.

### ❓ Missing folders? (First-time only)
When you first clone, the `android/` directory will be missing `.gradle/`, `build/`, `local.properties`, and `capacitor-cordova-android-plugins/`. **This is normal.** They are generated automatically:
- `npx cap sync android` creates the Capacitor plugin folders.
- Opening in Android Studio creates `local.properties` and builds the Gradle cache.

---

## 📡 7. Publishing OTA Updates (Over-the-Air)

OTA updates push new code **directly to users' installed apps** without going through the Play Store. The app checks for updates on every launch and applies them instantly.

### Prerequisites
- `.env` must have `OTA_SECRET_KEY` set (see [Section 3](#-3-environment-setup-env)).
- `.env` must have `OTA_SERVER_URL` set to the correct server.
- You need internet access to reach the server.

### How to publish an update

```bash
npm run deploy:ota
```

**What happens automatically, in order:**
1. 📦 **Builds** the latest web code (`npm run build`)
2. 📈 **Bumps the patch version** in `package.json` (e.g., `2.1.2` → `2.1.3`)
3. 🗜️ **Zips** the entire `dist/` folder into `update.zip`
4. 📤 **Uploads** the zip to the server's OTA endpoint with your secret key
5. 🎉 **Reports** the live URL of the update on success

### Testing against a local backend
```bash
npm run deploy:ota -- --dev
```
Targets `http://localhost:8010` instead of production.

### What users experience
Next time a user opens the installed Android app:
- The app silently checks `https://xceed.nitj.ac.in/api/v1/ota/version.json`
- If a newer version exists, it downloads and applies it immediately
- The user sees: *"🎉 OTA Update X.X.X Downloaded! Applying instantly..."*

> **Important:** OTA updates only update the **JavaScript/web layer**. If you change native Android code (add a Capacitor plugin, modify `capacitor.config.json`, or edit anything in `android/`), you must rebuild and re-release the APK through the Play Store. OTA cannot cover native changes.

---

## 🔄 8. Pulling Updates from AMS (Safe Sync)

There is a companion repository called `AMS-with-TimeTable`. When it gets updated, use the safe sync script to bring those changes into this project without losing your custom work.

### Required folder layout
Your workspace must look like this:
```
YourFolder/
├── learning-module-app/       ← this repo
└── IAMS/
    └── AMS-with-TimeTable/    ← the AMS repo (must be cloned here)
```

Clone the AMS repo if you haven't already:
```bash
cd ..
mkdir IAMS
cd IAMS
git clone <ams-repo-url> AMS-with-TimeTable
cd ../learning-module-app
```

### Running the sync

> ⚠️ **Commit or stash any work-in-progress first.** The script will abort if your working directory is dirty.

Open **PowerShell** (not CMD or Git Bash) in the `learning-module-app` folder and run:
```powershell
.\safe-pull-from-ams.ps1
```

**What the script does:**
1. Checks that your working directory is clean
2. Switches to the `ams-update` branch
3. Exports the latest client code from AMS and extracts it here
4. Commits the imported changes on `ams-update`
5. Registers the merge drivers, then merges `ams-update` back into `main`
6. Rebuilds `package-lock.json` against the merged `package.json`
7. Reports what upstream changed in the files this repo overrides

### Why conflicts happen, and how to stop one coming back

`src/` is not this repo's code. It is AMS's client tree, replaced wholesale on
every sync, and the merge in step 5 is a real three-way merge: base is AMS as of
the last sync, theirs is AMS now, ours is `main` with the app's work on top.

That means **every line this repo changes in a file the web team also changes is
a future conflict**. Not a possible one — a scheduled one, waiting for the sync
that happens to touch it. So the goal is not to resolve conflicts well. It is to
own as few of AMS's lines as possible.

There are three ways to add something, in order of preference.

**1. A new file.** Nothing to conflict with, ever. `src/utils/deepLink.js`,
`src/utils/otaUpdater.js`, `src/mobile/MobileShell.jsx` and the rest of
`src/mobile/` cost nothing at sync time and never have.

**2. A one-line seam into a new file.** When something genuinely has to run from
inside an AMS file, put the logic in a new file and leave a single call behind.
This is what `src/mobile/` is for, and most of it started life inline:

| Lives in | Was | Called from |
|---|---|---|
| `MobileShell.jsx` | 110 lines in `App.jsx` | one `<MobileShell />` |
| `session.js` | the same 6 lines in 4 files | `await clearNativeSession()` |
| `useTerminationAlerts.jsx` | 67 lines in `QuizResults.jsx` | 2 lines |
| `httpSession.js` | 50 lines in `main.jsx` | the import, and one call |

Note the name is about ownership, not about phones: `src/mobile/` means *this
repo owns it*. Some of what lives there — the terminated-exam alert — is not
device-specific at all. It is there because it is ours, and AMS's files are not.

**3. An override, for a file that is genuinely a fork.** Some files are not
patched but rewritten — `LoginForm.jsx` is the login *flow*, with saved
accounts, a PIN and biometrics, not the web form with additions. Merging a
rewrite against an edit fails every time.

For those, add `X.mobile.ext` beside `X.ext` and leave `X.ext` **byte-identical
to AMS**. `build/mobileOverrides.js` teaches Vite and Vitest to load the
`.mobile` file in place of the original. Because the original is untouched it
always merges cleanly, and because `.mobile` is a name AMS will never create,
the override never conflicts either. An override in the same directory keeps its
relative imports working, so moving a fork onto this is a rename and nothing
more.

An override may also *wrap* what it replaces: `src/getenvironment.mobile.js`
imports the AMS original and only adds the Capacitor case, so it keeps
inheriting everything else. Prefer this when you are adding rather than
replacing.

### The cost of an override, and `npm run drift`

An overridden file stops inheriting upstream changes, **silently**. This is not
hypothetical: `getenvironment.js` was a fork for months and still named
`nitjtt.onrender.com` long after AMS deleted that host, because a fork has no
conflicts to report.

```bash
npm run drift          # what AMS has changed in each overridden file since
npm run drift -- -v    # ...with the diffs
```

It runs at the end of every sync, local and CI. Treat its output as a to-do
list: for each entry, read the upstream diff and decide whether to port it. That
decision is the price of not having conflicts, and it is a much better price —
it is paid with the diff in hand, rather than at 2am with a deploy stopped.

### Files with a merge policy

`.gitattributes` settles the ones that were never about code:

| Path | Policy |
|---|---|
| `* text=auto eol=lf` | Line endings are fixed here, not by each machine's `core.autocrlf`. The sync runs from Windows *and* from ubuntu; without this the same file can be committed with different endings and every line reads as changed. |
| `android/**`, `capacitor.config.json`, `README.md` | Ours. AMS has a copy, but it describes the web deployment. |
| `package-lock.json` | Ours, then regenerated from the merged `package.json`. A lockfile conflict cannot be resolved by hand and means nothing when it happens. |
| `package.json` | Unioned by `build/mergePackageJson.mjs`: a dependency the web client added is taken, our Capacitor deps, our `version` (the OTA channel reads it) and `deploy:ota` survive. |

Merge drivers live in git config, which is per-clone and cannot be committed, so
`.gitattributes` alone does nothing. `npm install` registers them via `prepare`.
On a clone that predates this, run `npm run setup:git`.

---

## 📖 9. Project Scripts Reference

| Command | What it does |
|---|---|
| `yarn run dev` | Starts the local dev server at `localhost:5173` |
| `npm run build` | Builds the production web bundle into `dist/` |
| `npx cap sync android` | Copies `dist/` into Android project & syncs plugins |
| `npx cap open android` | Opens the Android project in Android Studio |
| `npm run deploy:ota` | Builds, bumps version, zips, and uploads an OTA update |
| `npm run deploy:ota -- --dev` | Same but targets `localhost:8010` |
| `npm run test` | Runs the test suite once |
| `npm run lint` | Checks code for style issues |
| `npm run drift` | Lists what AMS changed in the files this repo overrides (add `-- -v` for diffs) |
| `npm run setup:git` | Registers the merge drivers from `.gitattributes` (also runs on `npm install`) |

---

## 🔬 10. How OTA Updates Work (Under the Hood)

The system uses [`@capgo/capacitor-updater`](https://capgo.app/) as the update engine:

```
App Launch
    │
    ▼
setupOtaUpdater() runs in main.jsx
    │
    ├─► notifyAppReady()                    ← confirms current bundle booted OK (prevents rollback)
    │
    ├─► GET /api/v1/ota/version.json        ← fetches { version, url } from the server
    │
    ├─► Compares versions:
    │       nativeVersion   (from Play Store APK)
    │       activeVersion   (currently running Capgo bundle)
    │       latestVersion   (from server)
    │
    ├─► nativeVersion >= latestVersion  → skip (native is already current)
    │
    ├─► latestVersion > activeVersion   → download & apply
    │       CapacitorUpdater.download({ url, version })
    │       CapacitorUpdater.set({ id })    ← app reloads with new bundle
    │
    └─► Otherwise → "App is up to date"
```

**Version numbering:**  
`npm run deploy:ota` auto-increments the **patch** segment on every deploy (`2.1.2` → `2.1.3` → `2.1.4`).

---

## 🛠️ 11. Troubleshooting

### `yarn install` fails
- Check your Node version: `node -v` — must be **22**.
- With nvm: `nvm install 22 && nvm use 22`

### Android Studio shows "SDK not found"
- Open **SDK Manager** in Android Studio and install the Android SDK.
- Simply opening the project in Android Studio will auto-create `android/local.properties`.

### `npx cap sync android` fails with a Java error
- Set `JAVA_HOME` to point to Android Studio's bundled JDK (see Section 5, Step 2).

### OTA upload returns 401 Unauthorized
- Your `OTA_SECRET_KEY` in `.env` does not match the server's key. Ask the maintainer.

### OTA update not showing on device
- The check is async — wait a few seconds after the app opens.
- Make sure the device has internet access.
- The version in `package.json` must be **greater than** what's running on the device.
- In Android Studio's **Logcat**, filter by tag `OTA` to see debug output.

### App still shows old content after OTA update
- OTA only updates the JS bundle. If you changed native code, you need a full APK release via the Play Store.

### `safe-pull-from-ams.ps1` aborts — "working directory not clean"
- Run `git status` to see modified files.
- Either `git commit` or `git stash` your changes, then re-run the script.
