## Startup and redundant-loading fixes (platform-neutral)

Four independent fixes, one per commit. All of it reaches the app through the
existing `.mobile` override mechanism, so no AMS-owned file is edited and the
next sync has nothing to conflict with — `src/index.css`, `src/routePreload.js`,
`src/utils/queryPersister.js`, `src/learningModule/api/lmApi.js` and
`src/certificatemodule/pages/SelectCertficate.jsx` are all left byte-identical to
upstream.

Nothing here is platform-specific. iOS-only work (the Dynamic Island status-bar
reset and the viewport/zoom fixes) is deliberately **not** in this PR — that
lives on a separate branch against `feat/ios-support`, because those two changes
would cost Android pinch-zoom and enlarge every small input for bugs Android
does not have.

### The commits

1. **Keep the network off the critical path at startup** — `index.css` opens with
   three `@import url(https://fonts.googleapis.com/…)`. An `@import` at the top of
   a render-blocking stylesheet is itself render-blocking, so nothing paints
   until DNS, TLS and three responses have completed — on every cold start, since
   a freshly launched WebView has no HTTP cache. Two of the three are the
   certificate designer's ~45-family font picker, which a student opening a quiz
   never uses. Fonts now load after first paint; the certificate families are
   requested by `SelectCertficate`, the one component every certificate-drawing
   screen reaches. The OTA updater also no longer starts on mount, where it
   downloaded a bundle over the same connection as the first screen's own API
   calls — for an update not applied until the next launch anyway.

2. **Preload a route on a tap, not on everything a finger passes** — upstream
   listens for `pointerover`, which on a touch screen fires as a finger lands and
   again for whatever passes under it during a scroll. Each event walked the
   whole route registry on the main thread *and* started a real chunk download
   for a page nobody opened — and these chunks are not uniform, the certificate
   renderer alone is 5.1 MB. Only the listener changes; `lazyWithPreload`,
   `registerRouteTree` and `preloadPath` are re-exported from upstream untouched.

3. **Bound the persisted query cache** — nothing limited its size. `gcTime` and
   `maxAge` are both `Infinity` (deliberately, so an offline phone still opens to
   something), so the cache only ever grew, and every change re-encoded all of it
   across the Capacitor bridge on the main thread. **This is the one most worth
   having on Android**: a multi-megabyte `SharedPreferences` write on the main
   thread is a well-known way to make an app stop responding. Capped at 2 MB,
   oldest dropped first, throttle 1s → 4s.

4. **Serve the learning module's shell reads from memory and disk** —
   `LearningLayout` holds `me`, `overview` and the class list in plain
   `useState(null)`, and `Dashboard` re-runs its four-request loader on every
   mount. Since those values are gated on their own absence (`overview ?` for the
   stat tiles, `if (!classes)` for the class switcher), every tab change refetched
   everything and brought the skeletons back. Now the last answer is returned
   immediately while a refresh runs behind it. Staleness is bounded by writes
   rather than a clock — creating, joining, archiving and leaving classes all go
   through the same object, where they clear the cache outright.

### One decision that needs a reviewer's opinion

Commit 4 writes `me` to the device so the first load after launch paints
instantly. **This contradicts the explicit decision in `utils/queryPersister.js`**
to keep the signed-in identity out of persisted storage, so it should not pass
without someone agreeing to it.

- It is not optional for the result: the loader awaits all three reads together,
  so the screen cannot paint until the slowest returns. Persisting only
  `overview` and `listClasses` would make the launch no faster at all.
- The threat that note describes is a shared machine restoring one student's
  record into another's browser. This is Capacitor Preferences — app-private,
  unreadable by other apps, cleared on uninstall — on a personal phone. The auth
  token already lives on that same device, and anyone who can read this can read
  the token and ask the server for `/me` directly.
- The other half of that note — a signed-out app still showing the last person's
  details — is guarded: nothing is restored unless the token it was stored under
  matches the token in hand, and the token itself is never written, only a
  one-way fingerprint.

Dropping `me` from `PERSISTED` in `lmApi.mobile.js` is a one-line revert. Cold
start returns to a real load; everything else stands.

### Testing

Commits 1–2 were verified on a physical device (iOS) across several rounds; they
are platform-neutral code and the behaviour they change is the same on Android.
Commit 4's caching, invalidation, session-change and persistence behaviour was
verified by running the wrapper against a stubbed `lmApi`. Override resolution
was checked directly against `build/mobileOverrides.js` for every import shape in
use, on this branch's tree. `eslint` clean on all changed JS.

**Not run: an Android build, `npm run build`, or the vitest suite.** The sandbox
this was written in could not execute them (macOS-native `node_modules`, Linux
shell). Worth a CI pass, and worth someone opening the app on an Android handset
before merge — particularly launch (no blank screen while fonts load), switching
tabs and back, and that an OTA update still arrives now that the check waits five
seconds.

### Note unrelated to this PR

`.env.save` is sitting untracked **and ungitignored** in the repo root next to
`.env`. A stray `git add -A` would commit it. Worth adding to `.gitignore`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PZQuYap1Ym4C4eqzLRr2HV
