# iOS: visible status bar, swipe-back, and a class card laid out for a phone

**Base:** `feat/ios-support` · **Head:** `feat/ios-chrome-and-class-card` · 3 commits, 15 files

Three iOS-only changes. All of it is web-side, so it ships over the OTA pipeline — no App Store build.

---

## 1. `fix(ios)` The status bar clock and battery were invisible

They were never missing. They were being drawn in the one colour that cannot be seen against what is behind them.

Two decisions had drifted apart:

- Turning the overlay off — what keeps the app header out from under the Dynamic Island — is also what *creates* the strip. `setOverlaysWebView(false)` has the plugin insert its own view behind the status bar, and `StatusBarConfig.backgroundColor` defaults to `UIColor.black`, with nothing in `capacitor.config.json` saying otherwise.
- Meanwhile `statusBar.js` asked for `Style.Light`, whose name reads like "a light status bar" and means the opposite: light *background*, therefore **dark glyphs** (`.darkContent`).

Black glyphs on a black strip.

Both halves now come off one reading of the app's colour mode, so they can't contradict each other again: the strip takes the page background the app is already showing (`gray.50` / `gray.900`, matching `pageBg` in `LearningLayout.jsx`) and the glyph style is derived from that same choice.

`handleViewDidAppear` re-applies `config.backgroundColor` on every full-screen dismissal — PDF viewer, share sheet, camera — so the colour is asserted inside `apply()` and inherits the reset defences that file already had. The colour-mode toggle changes an attribute and nothing else (no resize, no `viewDidAppear`), so it gets its own observer.

## 2. `feat(ios)` Swipe from the left edge to go back

iOS had no way back from a screen whose own header didn't offer one. Android has the system gesture and the hardware key, both of which already arrive as Capacitor's `backButton` event; iOS has neither.

**Why a web gesture and not `allowsBackForwardNavigationGestures`:** that setting walks the *WebView's* back-forward list, restoring a snapshot WebKit captured. This app never loads a page — it swaps content under one document via `pushState` — so those snapshots are of a DOM React has since rewritten, and the router's idea of the route can end up disagreeing with what's on screen. It's also a native setting, so it ships in a binary; a fix that needs App Review isn't on the affected phones for weeks.

Driving the router directly costs the page-peel animation and buys an affordance that can't desync and can decline the gesture where going back would destroy work. Those refusals are most of the file:

| Situation | Behaviour |
|---|---|
| Quiz attempt, live Short, presentation | Refused — that's abandonment, not navigation, and nothing blocks it today |
| Root paths (`/`, `/login`, `/home`, `/learning`) | Nothing happens — unlike the hardware key, it will not exit the app |
| Horizontal scroller under the finger | Left to scroll — the class tab row reaches the same edge |
| Open dialog, second finger, mostly-vertical drag | Left alone |

The page itself is **not** transformed. Translating a container makes it the containing block for every `position: fixed` descendant inside it — the sticky class header, open modals, toasts — which would detach them from the viewport for the length of the drag. A chevron follows the finger instead.

## 3. `feat(ios)` The class card, laid down the screen instead of across it

The header was the desktop header with its buttons shrunk: one wrapping row of icon-only circles — people, insights, leaderboard, the class code, a bell, a cog — under the class name. Six unlabelled targets of roughly the same size and colour is a row you decode rather than read, and the class code, the single thing a teacher opens this screen to read out loud, was a 60px pill indistinguishable from the buttons beside it.

The card is now the three things it's actually made of: **who and what**, then the **class-level destinations** as labelled tiles big enough to hit, then the **code in its own full-width panel** — it's read aloud and copied, not navigated to. Notification preferences and class settings move into an overflow menu.

A student's card is built from what a student may do rather than greyed out: insights, the code and settings aren't rendered at all, and the tile row divides by however many are left, so two tiles fill the width. The Upcoming panel collapses to one line — the state is the whole message — and loses its material button, since the Material tab is a thumb's reach up the same screen. The tab row is rebuilt at thumb size but draws from the shared `TABS`, so a tab added upstream appears on the phone with no second edit.

**Android is untouched.** One bundle serves both stores, so `ClassLayout.mobile.jsx` runs on Android too and renders the AMS component verbatim there. The Android app is the one that ships today, its header already fits its screens, and moving it to fix a layout problem it doesn't have would trade a working app for an untested one.

**Why an override rather than an edit:** the iOS path replaces the header wholesale, and a rewrite living in the AMS copy turns every upstream touch of that file into a conflict nobody can resolve without knowing both intentions. The AMS copy keeps one addition — `export` on `TABS`.

---

## AMS-owned files touched

Kept as small as possible, since `src/` is re-synced from the AMS client and every line we edit is a line the web team may also edit:

- `ClassLayout.jsx` — `export` added to `TABS` (+ a comment saying why)
- `Stream.jsx` — the Upcoming block becomes `<UpcomingCard />`, one line
- `Icon.jsx` — `copy` and `more` added to the icon map

Everything else is new files, or `src/mobile/*` which is ours.

## Shared helpers

The platform check was about to exist in three copies, so it's now one: `src/mobile/platform.js` (`isIosApp()`), used by `statusBar.js`, `swipeBack.js` and the class card. One place that answers "am I on iOS", and one name to grep when auditing which screens have been touched. `src/mobile/colorMode.js` does the same for the theme, which both the status bar and the swipe chevron need.

## Testing

44 tests, all passing:

- `statusBar.test.js` (5) — the colour and glyph style are asserted as a *pair*, so no colour mode can produce an unreadable combination
- `swipeBack.test.js` (17) — mostly the refusals, since a back gesture firing when it shouldn't is the expensive failure
- `IosClassHeader.test.jsx` (5) — including that a student gets no insights tile and no class code
- `IosClassChromePlatform.test.jsx` (5) — that Android and web keep the card they have

Each guard was checked by deleting it and confirming its test fails. Forcing `isIosApp()` true and dropping the `isTeacher` guards fails exactly the five tests that should catch it.

Lint is clean on every file touched.

## Not covered

Neither the status bar nor the gesture can be exercised in jsdom — the Capacitor plugin and real touch behaviour need a device. Worth a manual pass on: the status bar after returning from the PDF viewer and after toggling dark mode, and the swipe on the class tab row and mid-quiz.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Gu7isH3XjZBCbipZtHfLwH
