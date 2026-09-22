## iOS responsiveness: startup, layout and redundant loading

Six independent fixes, one per commit, each reviewable on its own. All of it is
device-only and reaches the app through the existing `.mobile` override
mechanism, so no AMS-owned file is edited and the next sync has nothing to
conflict with. The two exceptions are `vite.config.js` and `src/mobile/*`, which
are ours already.

### The commits

1. **Keep the network off the critical path at startup** — `index.css` opened with
   three `@import url(https://fonts.googleapis.com/…)`. An `@import` at the top of
   a render-blocking stylesheet is itself render-blocking, so nothing painted
   until DNS, TLS and three responses had completed — on every cold start, since
   a fresh WebView has no HTTP cache. Two of the three were the certificate
   designer's ~45-family font picker. Now fetched after first paint, with the
   certificate families requested by `SelectCertficate` (the one component every
   certificate-drawing screen reaches). The OTA updater also no longer starts on
   mount, where it competed with the first screen's own API calls for an update
   not applied until the next launch.

2. **Preload a route on a tap, not on everything a finger passes** — `pointerover`
   has no hover on iOS: it fires as a finger lands and again for whatever passes
   under it during a scroll, walking the whole route registry on the main thread
   *and* starting real chunk downloads for pages nobody opened. The certificate
   renderer alone is 5.1 MB. Only the listener changes; the registry and matching
   are re-exported from upstream untouched.

3. **Bound the persisted query cache** — `gcTime`/`maxAge` are both `Infinity`
   (deliberately), so the cache only ever grew, and every change re-encoded all
   of it across the Capacitor bridge on the main thread. Capped at 2 MB, oldest
   first, throttle 1s → 4s.

4. **Re-assert the status bar after a native screen closes** — the header was
   drawn through the Dynamic Island after closing a PDF. `@capacitor/status-bar`
   re-applies `config.overlaysWebView` (default `true`) on every
   `.capacitorViewDidAppear`, so any full-screen presentation discarded the call
   made at boot. Not PDF-specific — share sheet, camera, file picker and in-app
   browser do the same.

5. **Settle the viewport at build time** — `viewport-fit=cover` was set by mutating
   the meta tag at runtime, which does nothing: WKWebView resolves `viewport-fit`
   at parse time. Every safe-area inset was therefore 0, silently making
   `safeArea.js` a no-op. Also caps `maximum-scale`, fixing the app getting stuck
   zoomed in after tapping the comment box with no way back out.

6. **Serve the learning module's shell reads from memory and disk** —
   `LearningLayout` holds `me`/`overview`/`classes` in plain `useState(null)`, and
   `Dashboard` re-runs its four-request loader on every mount, so every tab change
   refetched everything and brought the skeletons back. Now served from the last
   known values while refreshing behind.

### One decision that needs a reviewer's opinion

Commit 6 writes `me` to the device. **This contradicts the explicit decision in
`utils/queryPersister.js`** to keep the signed-in identity out of persisted
storage, so it should not pass without someone agreeing to it.

The argument for it:

- It is not optional for the result. The loader awaits all three reads together,
  so the screen cannot paint until the slowest returns — persisting only
  `overview` and `listClasses` would make the launch no faster at all.
- The threat that note describes is a shared lab machine restoring one student's
  record into another's browser. This is Capacitor Preferences on a personal
  phone: app-private, unreadable by other apps, gone on uninstall. The auth token
  already lives on that same device, and anyone who can read this can read the
  token and ask the server for `/me` directly.
- The other half of that note — a signed-out app still showing the last person's
  details — is guarded: nothing is restored unless the token it was stored under
  matches the token in hand, and the token itself is never written, only a
  one-way fingerprint.

If that trade is unwanted, dropping `me` from `PERSISTED` in `lmApi.mobile.js` is
a one-line revert. Cold start returns to a real load; everything else stands.

### Testing

Verified on device (iPhone, Dynamic Island) across several rounds for commits
1–5. Commit 6's caching, invalidation, session-change and persistence behaviour
was verified by running the wrapper against a stubbed `lmApi`. Override
resolution was checked directly against `build/mobileOverrides.js` for every
import shape in use. `eslint` clean on all changed JS.

Not run: `npm run build` and the vitest suite — the sandbox this was written in
could not execute them (macOS-native `node_modules`, Linux shell). Worth a CI
pass before merge.

### Note unrelated to this PR

`.env.save` is sitting untracked **and ungitignored** in the repo root next to
`.env`. A stray `git add -A` would commit it. Worth adding to `.gitignore`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PZQuYap1Ym4C4eqzLRr2HV
