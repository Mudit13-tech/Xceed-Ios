import { StatusBar, Style } from '@capacitor/status-bar';

import { colorMode, watchColorMode } from './colorMode';
import { isIosApp } from './platform';

/**
 * Keep the app's own header out from under the status bar.
 *
 * On iOS the Capacitor WebView is laid out over the entire screen, status bar
 * included, so the first thing the page draws lands underneath the clock and —
 * on a Dynamic Island device — behind the island itself. That is what put the
 * XCEED wordmark and the theme toggle under the cutout.
 *
 * The obvious fix is CSS: viewport-fit=cover plus env(safe-area-inset-top)
 * padding. It is not used here because there is nowhere of ours to put it. The
 * header is src/components/home/Navbar.jsx, the viewport meta is index.html,
 * and both belong to AMS — padding them means editing files the web team
 * rewrites, which .gitattributes merges against their copy on every sync. A
 * rule that has to be re-applied after each sync is a rule that will be lost
 * after some sync.
 *
 * Telling the status bar not to overlay the WebView moves the layout boundary
 * instead: iOS starts the view below the inset, every screen is correct at
 * once, and no markup is touched.
 *
 * iOS only, deliberately. setOverlaysWebView is not a no-op on Android -- that
 * platform is what it was built for -- and the Android app is the one that
 * ships today, with a header that already sits where it should. Changing its
 * status bar to fix a cutout it does not have would be trading a working app
 * for an untested one, so the guard is the platform, not merely "is native".
 *
 *
 * Why this is applied more than once
 * ----------------------------------
 * Because the plugin undoes it. This is not a guess about iOS -- it is written
 * down in @capacitor/status-bar's own source, ios/Sources/StatusBarPlugin/
 * StatusBar.swift:
 *
 *     addObserver(forName: .capacitorViewDidAppear) { self?.handleViewDidAppear(config:) }
 *
 *     private func handleViewDidAppear(config: StatusBarConfig) {
 *         setStyle(config.style)
 *         setBackgroundColor(config.backgroundColor)
 *         setOverlaysWebView(config.overlaysWebView)
 *     }
 *
 * Every time the Capacitor view controller appears, the plugin re-applies the
 * value from capacitor.config.json — and `StatusBarConfig.overlaysWebView`
 * defaults to `true`. So any full-screen presentation dismissing back to the
 * app resets the WebView to full-bleed, discarding the call made at boot.
 *
 * Opening a PDF was how it was found: Quick Look (FileViewer, see
 * utils/nativeCapabilities.js) comes up full-screen, and on Done the app came
 * back with its header drawn straight through the Dynamic Island, the whole
 * page shifted up by the height of the status bar. It was never only the PDF
 * viewer — the share sheet, the camera, the file picker and the in-app browser
 * are all full-screen presentations, and every one of them triggers the same
 * viewDidAppear.
 *
 * Setting `plugins.StatusBar.overlaysWebView: false` in capacitor.config.json
 * would be the tidy fix, and is deliberately not used: plugin config in
 * Capacitor is global, with no per-platform block (see @capacitor/cli's
 * declarations.d.ts — `plugins` exists only at the top level), so it would hand
 * Android a status bar change on a platform whose layout is already correct and
 * where the Android implementation behaves differently again. The guard above
 * exists precisely to avoid that, and config cannot honour it.
 *
 * So the value is re-asserted from here instead, whenever the WebView's height
 * changes — which is the observable half of the reset, whichever plugin caused
 * it.
 *
 * Re-applying when nothing has changed is genuinely free, and that is what
 * makes this safe rather than a thing that fights the keyboard. From the same
 * file:
 *
 *     func setOverlaysWebView(_ overlay: Bool) {
 *         if overlay == isOverlayingWebview { return }
 *
 * A call that agrees with the current state returns before touching a frame, so
 * it cannot resize anything, cannot provoke another resize, and cannot loop.
 * The only call that does work is the one that finds the plugin has just
 * reset it.
 *
 *
 * Why the clock and battery were invisible
 * ----------------------------------------
 * Turning the overlay off is what creates the strip in the first place. From
 * the same plugin source:
 *
 *     private var backgroundColor = UIColor.black
 *
 *     func setOverlaysWebView(_ overlay: Bool) {
 *         ...
 *         } else {
 *             initializeBackgroundViewIfNeeded()   // uses backgroundColor
 *
 * So iOS stops drawing the status bar over the page and the plugin puts its own
 * view behind it — a **black** one, because `StatusBarConfig.backgroundColor`
 * defaults to black and capacitor.config.json says nothing about it. Meanwhile
 * this file asked for `Style.Light`, whose name reads like "a light status bar"
 * and means the opposite: light *background*, therefore **dark glyphs**
 * (`.darkContent`). Black glyphs on a black strip. The clock, the battery and
 * the signal bars were being drawn the whole time, in the one colour that
 * cannot be seen against what is behind them.
 *
 * Both halves are now set together, from the app's own colour mode, so they
 * cannot disagree again: the strip takes the page background the app is already
 * showing (gray.50 or gray.900 — see PAGE_BACKGROUND), and the glyph style is
 * derived from that same choice rather than written down separately.
 *
 * `handleViewDidAppear` above re-applies `config.backgroundColor` too, so the
 * colour is reset to black by exactly the presentations that reset the overlay
 * — which is why it is asserted inside apply(), and gets the reset defences
 * already built here for free.
 *
 * Note for anyone tempted to add a debounce here: an earlier version of this
 * fix had one, and the debounce was the bug. The reset arrives *as* a resize a
 * fraction after the one the dismissal animation produces, so a settle window
 * meant to stop oscillation swallowed the single event worth reacting to and
 * the header stayed under the island. Coalescing within one frame is the most
 * that is safe.
 */

/**
 * The strip's colour, per colour mode: the page background the app is already
 * drawing underneath its header (`useColorModeValue('gray.50', 'gray.900')` in
 * learningModule/components/LearningLayout.jsx), so the status bar reads as the
 * top of the page rather than a band bolted above it.
 *
 * Literals rather than theme lookups because this runs outside React, before
 * any provider exists, and because of the plugin method it is handed to:
 *
 *     guard let hexString = call.options["color"] as? String,
 *           let color = UIColor.capacitor.color(fromHex: hexString)
 *     else { return }        // <- resolves nothing
 *
 * A colour it cannot parse leaves the promise pending for ever. Two constants
 * cannot go wrong, and the call is made last in apply() so that even if one
 * somehow did, it could not starve the two calls that matter more.
 */
const PAGE_BACKGROUND = { light: '#F7FAFC', dark: '#171923' };

// Set once the listeners are installed, so a second configureStatusBar() call
// does not stack another set of them.
let watching = false;
// Coalesces the several resize events one transition emits into one call.
let queued = false;

async function apply() {
  const mode = colorMode();
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    // Style is named for the background it is meant to sit on, not for the ink:
    // Style.Light is dark glyphs for a light background, Style.Dark is light
    // glyphs for a dark one. Derived from `mode` rather than chosen separately,
    // because choosing it separately is how it came to contradict the colour
    // behind it.
    await StatusBar.setStyle({ style: mode === 'dark' ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: PAGE_BACKGROUND[mode] });
  } catch (error) {
    // A device without a configurable status bar is not a reason to fail
    // boot -- the app is entirely usable with the header where it was.
    console.warn('Status bar could not be configured', error);
  }
}

function reapply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    void apply();

    // Insurance against ordering. The dismissal animation and the plugin's
    // viewDidAppear reset are two separate events and their order is not ours
    // to depend on: if the resize we are answering was the animation's, the
    // reset has not happened yet and the call above hit the early return. A
    // second pass after the transition has finished catches that case. It is
    // free whenever it is unnecessary, for the same reason.
    window.setTimeout(() => { void apply(); }, 350);
  });
}

function watchForReset() {
  if (watching) return;
  watching = true;

  // The WebView getting its full height back is the observable half of the
  // reset, and it is observable no matter which plugin caused it.
  window.addEventListener('resize', reapply);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', reapply);
  }

  // The moon/sun button in the header changes an attribute and nothing else --
  // no resize, no viewDidAppear -- so none of the listeners around this one
  // would hear it, and the strip would keep the old mode's colour until the
  // next transition happened to repaint it.
  watchColorMode(() => { void apply(); });

  // Returning from the background raises viewDidAppear too, and does not
  // always change the height on the way out and back.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) reapply();
  });

  /**
   * The backstop, and the reason this fix does not rest on one assumption.
   *
   * Everything above is built on the WebView frame change reaching the page as
   * a resize. That is what the plugin's resizeWebView() does and it should, but
   * a previous attempt at this bug failed on a detail of event ordering that
   * looked just as certain beforehand, so there is one path left that does not
   * depend on being right about it: the next time the user touches the screen,
   * check.
   *
   * The user is going to touch the screen — that is what they came back from
   * the PDF to do — so this bounds how long a reset can survive to "until the
   * next tap" even in the case where no resize arrives at all.
   *
   * Throttled to once a second, and the throttle is an integer comparison, so
   * the scroll path pays essentially nothing; the call it guards is the same
   * early-returning no-op as everywhere else in this file.
   */
  let lastTouchCheck = 0;
  document.addEventListener('touchstart', () => {
    const now = Date.now();
    if (now - lastTouchCheck < 1000) return;
    lastTouchCheck = now;
    void apply();
  }, { passive: true });
}

/**
 * Runs once, before anything paints below the notch, and then keeps it that
 * way. Safe to call more than once; the listeners are installed only on the
 * first call.
 */
export async function configureStatusBar() {
  if (!isIosApp()) return;
  await apply();
  watchForReset();
}
