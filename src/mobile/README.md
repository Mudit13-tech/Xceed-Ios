# Mobile seams

The Android and iOS app (the `xceed-app` repo) is built from this same client.
It does not fork the pages. It swaps a handful of small modules for native
versions, and those modules are the ones listed below.

Each file here is the **web implementation**: a no-op, or exactly what the web
already did. The app ships `X.mobile.js` beside each one, and its build resolves
that file in place of this one. So:

- **The web build is unaffected.** Nothing here imports Capacitor, and this repo
  has no native dependencies.
- **Pages call the seam, never Capacitor.** When a page needs to behave
  differently in the app, it gets a function here. It never gets an
  `if (Capacitor...)` of its own.
- **Keep the exports and signatures stable.** Adding an export is fine. Renaming
  or removing one breaks the app's build, so mention it in the PR.

| Module | Web behaviour | App behaviour |
| --- | --- | --- |
| `mobile/session.js` | nothing to clear | clears saved accounts and the PIN from the keystore |
| `mobile/httpSession.js` | `xceed-web`, cookies on, 401 left to the page | `xceed-learning`, header-only auth, a 401 ends the session |
| `mobile/queryCache.js` | react-query defaults | cache kept indefinitely, busted per release |
| `mobile/MobileShell.jsx` | renders nothing | back button, deep links, push, OTA updates |
| `mobile/deviceInfo.js` (`getDeviceInfo`, `currentDeviceId`, `storedDeviceId`) | browser device ID in localStorage; model and OS version from Client Hints (Android Chromium only) | the native device ID, model and OS version |
| `mobile/useTerminationAlerts.jsx` | announces nothing | announces terminated quiz attempts |
| `components/NativeCamera.jsx` | renders nothing | device camera for upload forms |
| `utils/nativeCapabilities.js` | plain anchors and downloads | Android DownloadManager, iOS Share sheet |

`filedownload/savePdf.js` and `filedownload/saveFile.js` are shared rather than
swapped. They call `nativeCapabilities`, and on the web they do exactly what each
call site did before they existed. A page that builds a file in the browser (a
CSV, a spreadsheet) should hand it to `saveBlob` from `saveFile.js`. A bare
`<a download>` over a blob: URL does nothing in the app.
