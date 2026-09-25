# 📚 XCEED – Learning Module App

> A full-featured academic platform for NITJ, built with **React + Vite** and deployed as native **Android** and **iOS** apps via **Capacitor**.  
> This guide walks you through **everything** — from cloning the repo to pushing live OTA updates to users' phones.
>
> One web bundle serves both stores. Anything that has to differ between the two branches at **runtime**, not at build time — see
> [iOS-only behaviour in the web code](#ios-only-behaviour-in-the-web-code).

---

## 📋 Table of Contents

1. [Prerequisites](#-1-prerequisites)
2. [Clone & Install](#-2-clone--install)
3. [Environment Setup (.env)](#-3-environment-setup-env)
4. [Running the Web App Locally](#-4-running-the-web-app-locally)
5. [Android App Setup (Capacitor)](#-5-android-app-setup-capacitor)
6. [Building & Running on Android Studio](#-6-building--running-on-android-studio)
7. [iOS App Setup (Capacitor)](#-7-ios-app-setup-capacitor)
8. [Building & Running in Xcode](#-8-building--running-in-xcode)
9. [Publishing OTA Updates](#-9-publishing-ota-updates-over-the-air)
10. [Pulling Updates from AMS (Safe Sync)](#-10-pulling-updates-from-ams-safe-sync)
11. [Project Scripts Reference](#-11-project-scripts-reference)
12. [How OTA Updates Work (Under the Hood)](#-12-how-ota-updates-work-under-the-hood)
13. [Troubleshooting](#-13-troubleshooting)

---

## ⚙️ 1. Prerequisites

Install these tools **before** doing anything else.

| Tool | Version | Why it's needed |
|---|---|---|
| [Node.js](https://nodejs.org/) | **v22** (LTS) | Runtime for all JavaScript tooling |
| [Yarn](https://yarnpkg.com/getting-started/install) | Latest | Package manager (preferred over npm here) |
| [Git](https://git-scm.com/downloads) | Latest | To clone and manage the repository |
| [Android Studio](https://developer.android.com/studio) | Latest stable | To build and run the Android app |
| [Xcode](https://developer.apple.com/xcode/) *(macOS only)* | 15 or newer | To build and run the iOS app |
| [CocoaPods](https://cocoapods.org/) *(macOS only)* | 1.12+ | Installs the native iOS dependencies (`ios/App/Podfile`) |

> **Node version matters!**  
> This project requires **Node 22** (defined in `.nvmrc`). If you use [nvm](https://github.com/nvm-sh/nvm) (Mac/Linux) or [nvm-windows](https://github.com/coreybutler/nvm-windows), run `nvm use` inside the project folder and it will auto-switch.

> **The iOS app needs a Mac.** Xcode does not exist for Windows or Linux, and there is no way around it — Apple's toolchain signs and builds
> the binary. Everything else in this guide (web dev server, Android build, OTA publishing) works on any platform; only
> [Sections 7](#-7-ios-app-setup-capacitor) and [8](#-8-building--running-in-xcode) are macOS-only.

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

## 🍎 7. iOS App Setup (Capacitor)

The same Capacitor project also produces the iOS app. **This section needs a Mac** — see the note in [Section 1](#-1-prerequisites).

| Setting | Value |
|---|---|
| Bundle identifier | `in.ac.nitj.xceed.learning.app` (identical to Android, set in `capacitor.config.json`) |
| Minimum iOS version | **15.0** (`ios/App/Podfile` → `platform :ios, '15.0'`) |
| Signing | Automatic, team `6553BS28Q4` (`ios/App/App.xcodeproj`) |
| Workspace to open | `ios/App/App.xcworkspace` — **never** `App.xcodeproj` |

### Step 1 — Install Xcode and the command-line tools
1. Install [Xcode](https://apps.apple.com/app/xcode/id497799835) from the App Store and open it once so it finishes installing its components.
2. Install the command-line tools and point `xcode-select` at the full app:
   ```bash
   xcode-select --install
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
3. Accept the licence: `sudo xcodebuild -license accept`

### Step 2 — Install CocoaPods
Capacitor installs the native plugin dependencies through CocoaPods, and `npx cap sync ios` runs `pod install` for you — but only if `pod` exists.

```bash
brew install cocoapods          # preferred
# or: sudo gem install cocoapods
```

### Step 3 — Sign in with an Apple ID
In **Xcode → Settings → Accounts**, add the Apple ID that belongs to the development team above. Without it the build fails at signing, not at compile.

### ❓ Missing folders? (First-time only)
After a fresh clone, `ios/` looks incomplete: no `App/Pods/`, no `App/App/public/`, no `App/App/capacitor.config.json`, no `App/App/config.xml`, no `capacitor-cordova-ios-plugins/`. **This is normal** — all of them are in `ios/.gitignore` and all of them are generated by `npx cap sync ios`. Run the sync before you open Xcode, or Xcode will open a project that cannot build.

### iOS-only behaviour in the web code

There is no iOS build of the web bundle. **One bundle is uploaded for both stores**, so `build/mobileOverrides.js` — which swaps `X.mobile.ext` in for `X.ext` — cannot help here: it distinguishes *mobile from web*, not iOS from Android. Anything that must differ between the two phones branches at runtime on `isIosApp()`.

| File | What it does |
|---|---|
| `src/mobile/platform.js` | The one place that answers "am I on iOS" — `isIosApp()`, `isAndroidApp()`, `nativePlatform()`. Grep for these to audit which screens have been touched. |
| `src/mobile/statusBar.js` | Turns off the status-bar overlay so the app header clears the Dynamic Island, and keeps the clock/battery legible in both themes. Re-applied after every full-screen native view (Quick Look, the share sheet), because `@capacitor/status-bar` resets it from `capacitor.config.json` on `viewDidAppear`. The plugin is left out of the Android build (`android.includePlugins`), since its Android startup code would move that layout. |
| `src/mobile/swipeBack.js` | Swipe from the left edge to go back. Android already gets this from the system gesture and the hardware key via Capacitor's `backButton`; iOS had no way back at all from a screen whose own header did not offer one. It drives the router rather than WKWebView's `allowsBackForwardNavigationGestures`, and declines the gesture where going back would destroy work (a quiz attempt, a live Short, a presentation), on root paths, over a horizontal scroller, and while a dialog is open. |

> The class screen is AMS's own on both phones. `ClassHeaderCard.jsx` gives it a phone layout below `md` (labelled tiles, the class code in its own panel, settings in an overflow menu), so there is no iOS override for it. There used to be one, `ClassLayout.mobile.jsx`; AMS shipped the same design, and the copy was already missing what AMS added after it, such as the room's map pin, so it was removed.

---

## 🏗️ 8. Building & Running in Xcode

The same **3 steps in order**, every time you change the web code:

### Step 1 — Build the web code
```bash
npm run build
```

### Step 2 — Sync to iOS
```bash
npx cap sync ios
```
Copies `dist/` into `ios/App/App/public/`, regenerates `capacitor.config.json` and `config.xml` inside the native project, and runs `pod install` for the plugins listed in `ios/App/Podfile`.

### Step 3 — Open in Xcode
```bash
npx cap open ios
```
This opens **`App.xcworkspace`** (the workspace, which includes the Pods project). Then:
1. Wait for Xcode to finish indexing.
2. In **App → Signing & Capabilities**, confirm a team is selected.
3. Pick a target — a **connected iPhone** or a **Simulator**.
4. Click **▶ Run**.

> **On a physical device, first run only:** the app installs but refuses to launch until you trust the certificate — **Settings → General → VPN & Device Management → Developer App → Trust**.

> **The Simulator cannot do everything.** Push notifications, Face ID / Touch ID (`capacitor-native-biometric`) and the camera need a real device. Anything that touches login-with-biometrics or attachments-from-camera has to be tested on hardware.

### Native version vs OTA version

Two different version numbers live in this repo, and confusing them is the usual reason an OTA update appears not to arrive on iOS:

| Where | What it is |
|---|---|
| `package.json` → `version` | The **OTA** version. `npm run deploy:ota` bumps its patch segment on every publish. |
| Xcode → `MARKETING_VERSION` | The **native** version baked into the `.ipa`, the one the App Store sees. |

The updater skips the download when `nativeVersion >= latestVersion` (see [Section 12](#-12-how-ota-updates-work-under-the-hood)). So when you cut a native build, set `MARKETING_VERSION` to the current `package.json` version — if you set it *higher*, that build ignores every OTA bundle until the server catches up.

### Shipping to TestFlight / the App Store
1. Set `MARKETING_VERSION` and bump `CURRENT_PROJECT_VERSION` (the build number — it must be unique per upload).
2. **Product → Destination → Any iOS Device (arm64)**, then **Product → Archive**.
3. In the Organizer, **Distribute App → App Store Connect**.

> Ship a native build whenever you change something OTA cannot carry: a Capacitor plugin, `capacitor.config.json`, `Info.plist` (including any new usage-description string), the app icon, or anything under `ios/`.

---

## 📡 9. Publishing OTA Updates (Over-the-Air)

OTA updates push new code **directly to users' installed apps** without going through the Play Store or the App Store. The app checks for updates on every launch and applies them instantly. **One bundle serves both platforms** — publishing once reaches Android and iOS alike.

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

### Publishing a full release from your machine (no GitHub Actions)

`npm run deploy:ota` publishes the bundle, but a release is more than that: the
version bump has to be committed and `main` + `ams-update` pushed together, or
the next AMS sync merges against a stale base. The
**`Remote AMS Sync & OTA Update`** workflow used to do all of it on a runner.

It currently cannot run at all. Run `35259040307` (2026-09-17) failed in 4
seconds with no steps executed:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

That is GitHub billing on the org account — nothing in this repo fixes it, and
every dispatch fails the same way until it is sorted. Until then, publish from
PowerShell in the repo root:

```powershell
.\manual-ota-update.ps1
```

or `npm run ota:manual`. It does exactly what the runner's job did:

1. **Preflight** — on `main`, clean tree, `OTA_SECRET_KEY` present, `main` not behind `origin/main`
2. 📦 **Builds and uploads** via `scripts/deploy-ota.cjs` (same script the workflow called)
3. 📝 **Commits** `Bump version for OTA update [skip ci]`
4. 🚀 **Pushes** `main` and `ams-update` atomically, fast-forwarding `ams-update` first
5. ✅ **Verifies** that `version.json` on the server really serves the new version

Every check that can stop the run happens **before** the upload, because once
the server accepts a bundle every device pulls it on next launch — there is no
un-publishing it.

| Flag | Effect |
|---|---|
| `-Sync` | Run `safe-pull-from-ams.ps1` first — full parity with the workflow |
| `-Install` | `npm ci` before building (implied by `-Sync`) |
| `-Dev` | Publish to `localhost:8010`; commits and pushes nothing |
| `-NoPush` | Publish and commit, but push by hand |
| `-Force` | Skip the clean-tree / on-main / up-to-date guards |

> If it stops at the AMS sync with a merge conflict, that is the normal failure
> mode — resolve it, commit, push both branches, then re-run **without**
> `-Sync`. See [Section 10](#-10-pulling-updates-from-ams-safe-sync).

> **On a Mac** — where you will be for anything iOS — `npm run ota:manual` does
> not work: the alias shells out to `powershell`, which exists only on Windows.
> The script itself is portable (it only calls `npm`, `git` and
> `Invoke-RestMethod`), so install PowerShell 7
> (`brew install --cask powershell`) and run `pwsh ./manual-ota-update.ps1`
> directly. Or use `npm run deploy:ota` and do the version-bump commit and the
> two-branch push by hand.

When Actions is billed again, nothing needs undoing: the workflow still works,
and this script stays useful for publishing without one.

### Testing against a local backend
```bash
npm run deploy:ota -- --dev
```
Targets `http://localhost:8010` instead of production. `.\manual-ota-update.ps1 -Dev`
does the same as a rehearsal of the whole release, without touching git.

### What users experience
Next time a user opens the installed app — Android or iOS:
- The app silently checks `https://xceed.nitj.ac.in/api/v1/ota/version.json`
- If a newer version exists, it downloads and applies it immediately
- The user sees: *"🎉 OTA Update X.X.X Downloaded! Applying instantly..."*

> **Important:** OTA updates only update the **JavaScript/web layer**. If you change native code — add a Capacitor plugin, modify `capacitor.config.json`, or edit anything under `android/` or `ios/` (including `Info.plist` usage strings and the Podfile) — you must cut and re-release a native build: an APK/AAB through the Play Store, and an `.ipa` through App Store Connect. OTA cannot cover native changes, and it cannot cover them on either platform.

---

## 🔄 10. Pulling Updates from AMS (Safe Sync)

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

**An override is still both platforms.** `.mobile` means *native*, not *iOS*:
the one bundle runs on Android too. `src/utils/nativeCapabilities.mobile.js` is
the case to copy: one override, with the iOS and Android paths branching at
runtime on the platform. `src/mobile/platform.js` answers that question. See
[iOS-only behaviour in the web code](#ios-only-behaviour-in-the-web-code).

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
| `android/**`, `ios/**`, `capacitor.config.json`, `README.md` | Ours. AMS has a copy of `android/` and of this file, but they describe the web deployment; AMS has never carried an `ios/` at all. |
| `package-lock.json` | Ours, then regenerated from the merged `package.json`. A lockfile conflict cannot be resolved by hand and means nothing when it happens. |
| `package.json` | Unioned by `build/mergePackageJson.mjs`: a dependency the web client added is taken, our Capacitor deps, our `version` (the OTA channel reads it) and `deploy:ota` survive. |

Merge drivers live in git config, which is per-clone and cannot be committed, so
`.gitattributes` alone does nothing. `npm install` registers them via `prepare`.
On a clone that predates this, run `npm run setup:git`.

---

## 📖 11. Project Scripts Reference

| Command | What it does |
|---|---|
| `yarn run dev` | Starts the local dev server at `localhost:5173` |
| `npm run build` | Builds the production web bundle into `dist/` |
| `npx cap sync android` | Copies `dist/` into Android project & syncs plugins |
| `npx cap open android` | Opens the Android project in Android Studio |
| `npx cap sync ios` | Copies `dist/` into the iOS project, syncs plugins & runs `pod install` *(macOS)* |
| `npx cap open ios` | Opens `ios/App/App.xcworkspace` in Xcode *(macOS)* |
| `npm run deploy:ota` | Builds, bumps version, zips, and uploads an OTA update |
| `npm run deploy:ota -- --dev` | Same but targets `localhost:8010` |
| `npm run ota:manual` | Full release: `deploy:ota` plus the version-bump commit and push, i.e. what the workflow did (Windows; on macOS run `pwsh ./manual-ota-update.ps1`) |
| `.\manual-ota-update.ps1 -Sync` | Same, with an AMS sync first — one green workflow run, locally |
| `npm run test` | Runs the test suite once |
| `npm run lint` | Checks code for style issues |
| `npm run drift` | Lists what AMS changed in the files this repo overrides (add `-- -v` for diffs) |
| `npm run setup:git` | Registers the merge drivers from `.gitattributes` (also runs on `npm install`) |

---

## 🔬 12. How OTA Updates Work (Under the Hood)

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
    │       nativeVersion   (baked into the installed binary: the APK's versionName, or iOS MARKETING_VERSION)
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

## 🛠️ 13. Troubleshooting

### `yarn install` fails
- Check your Node version: `node -v` — must be **22**.
- With nvm: `nvm install 22 && nvm use 22`

### Android Studio shows "SDK not found"
- Open **SDK Manager** in Android Studio and install the Android SDK.
- Simply opening the project in Android Studio will auto-create `android/local.properties`.

### `npx cap sync android` fails with a Java error
- Set `JAVA_HOME` to point to Android Studio's bundled JDK (see [Section 5](#-5-android-app-setup-capacitor), Step 2).

### `npx cap sync ios` fails — `pod: command not found`
- CocoaPods is not installed: `brew install cocoapods` (see [Section 7](#-7-ios-app-setup-capacitor), Step 2).

### Xcode build fails right after adding or updating a Capacitor plugin
- The Pods are stale. `cd ios/App && pod install --repo-update`, then in Xcode **Product → Clean Build Folder** (the Podfile disables input/output paths precisely because Xcode caches Pods).

### Xcode: "Signing for 'App' requires a development team"
- **App → Signing & Capabilities** → pick the team. Add the Apple ID under **Xcode → Settings → Accounts** first if the list is empty.

### The iOS app installs but will not open on a physical device
- Trust the certificate: **Settings → General → VPN & Device Management → Developer App → Trust**.

### Xcode opens a project that will not build, or shows no web content
- You opened `App.xcodeproj` instead of `App.xcworkspace`, or you skipped `npx cap sync ios`. `ios/App/App/public/` is generated — it is empty in a fresh clone.

### OTA upload returns 401 Unauthorized
- Your `OTA_SECRET_KEY` in `.env` does not match the server's key. Ask the maintainer.

### OTA update not showing on device
- The check is async — wait a few seconds after the app opens.
- Make sure the device has internet access.
- The version in `package.json` must be **greater than** what's running on the device.
- In Android Studio's **Logcat**, filter by tag `OTA` to see debug output. On iOS, use Xcode's **Console** (Window → Devices and Simulators → Open Console) or run the app from Xcode and watch the debug area.

### OTA update reaches Android but never iOS
- Check `MARKETING_VERSION` in Xcode against `package.json`. The updater skips the download when `nativeVersion >= latestVersion`, so a native build stamped ahead of the OTA channel ignores every bundle until the server catches up. See [Section 8](#-8-building--running-in-xcode).

### The app header is drawn under the Dynamic Island / the status bar clock is invisible
- `src/mobile/statusBar.js` owns this. It has to be re-applied after every full-screen native view, because `@capacitor/status-bar` re-reads `capacitor.config.json` on `viewDidAppear`. If you added a new native presentation (a picker, a viewer, a share sheet), it likely needs to re-assert on dismiss too.

### Swipe-from-the-left-edge does nothing
- It is iOS-only by design (`isIosApp()`), and it deliberately declines in several places: on root paths, during a quiz attempt or a live session, over a horizontal scroller (the class tab row reaches the same edge), with a dialog open, with a second finger down, or on a mostly-vertical drag. See `src/mobile/swipeBack.js`.

### App still shows old content after OTA update
- OTA only updates the JS bundle. If you changed native code, you need a full native release — an APK/AAB via the Play Store, or an `.ipa` via App Store Connect / TestFlight.

### `safe-pull-from-ams.ps1` aborts — "working directory not clean"
- Run `git status` to see modified files.
- Either `git commit` or `git stash` your changes, then re-run the script.
