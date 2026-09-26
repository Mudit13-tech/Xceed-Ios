/**
 * Swipe from the left edge to go back, on iOS.
 *
 * iOS users reach for this before they reach for anything on screen — it is how
 * every other app on the phone goes back, and a screen that does not answer it
 * reads as stuck. Android has the system gesture and the hardware key, both of
 * which already arrive as Capacitor's `backButton` event (see MobileShell.jsx);
 * iOS has neither, and had no way back at all from a screen whose own header
 * did not offer one.
 *
 *
 * Why this is a web gesture and not WKWebView's
 * --------------------------------------------
 * WebKit will do this itself — `allowsBackForwardNavigationGestures` on the
 * WebView, and you get the real interactive peel with the previous screen
 * sliding in under the finger. It is deliberately not used:
 *
 *  - It walks the *WebView's* back-forward list, restoring a snapshot WebKit
 *    captured. This app never loads a page: it swaps content under one
 *    document via pushState, so those snapshots are of a DOM that React has
 *    since rewritten, and the router's idea of the current route and what is on
 *    screen can end up disagreeing with no way to reconcile them.
 *  - It is a native setting, so it ships in a binary. This app updates over the
 *    air (utils/otaUpdater.js); a fix that needs App Review is a fix that is not
 *    on the affected phones for weeks.
 *
 * Driving the router directly costs the page-peel animation and buys an
 * affordance that cannot desync, ships today, and can decline the gesture in
 * the places where going back would destroy work. Those places are the reason
 * this file is longer than a touch handler has any right to be.
 *
 *
 * What it refuses, and why
 * ------------------------
 * A back gesture that fires when it should not is worse than no gesture: the
 * user loses a screen they were using, and on some screens loses the work on
 * it. Each guard below answers a specific way an edge swipe goes wrong.
 */

import { colorMode } from './colorMode';
import { isIosApp } from './platform';

/**
 * How close to the left edge a touch has to start.
 *
 * Apple's own edge gesture uses a strip in this range. Wider starts stealing
 * taps from whatever is at the left of the screen; narrower and the gesture
 * feels unreliable on a phone held one-handed, which is exactly when it is
 * used.
 */
const EDGE_WIDTH = 24;

/** Movement before the direction of a drag is called either way. */
const DIRECTION_SLOP = 10;

/** A drag this far across, or a flick this fast, commits. */
const COMMIT_FRACTION = 0.25;
const FLICK_VELOCITY = 0.45; // px per ms
const FLICK_DISTANCE = 56;

/**
 * Routes a back gesture must not fire on.
 *
 * Leaving one of these is not navigation, it is abandonment: a quiz attempt in
 * progress, a live Short the class is watching, a presentation on a projector.
 * None of them has a navigation blocker — the Android back button can walk out
 * of a quiz today — but an edge swipe is far easier to trigger by accident than
 * a deliberate press of the back key, and it is triggered with the hand that is
 * also holding the phone.
 */
const LOCKED = [/\/attempt\//, /\/short\/live\//, /\/present(\/|$)/, /\/seb-exit$/];

/**
 * Routes where there is nothing behind to go back to.
 *
 * The hardware back key's list, plus `/userroles`. The key exits the app on
 * these; this gesture does nothing instead, because a thumb resting near the
 * edge of the screen should never be able to close the app.
 *
 * `/userroles` is the dashboard every unlock lands on, and it is reached by a
 * full page load from /login (see utils/sessionSwitch.js), so the entry behind
 * it is always the login screen. Going back there does not return anywhere
 * useful: the login screen sees a saved account, runs Face ID or asks for the
 * PIN again, and puts the user straight back on the dashboard. To the user
 * that reads as a back gesture that does nothing except demand their face.
 */
const ROOT_PATHS = ['/', '/login', '/home', '/learning', '/learning/', '/userroles'];

/**
 * True if a dialog is actually open on screen.
 *
 * `[role="dialog"]` alone is not that question. Chakra's <Popover> keeps its
 * content element -- role="dialog" -- mounted for as long as the popover is,
 * open or not, and hides it with `visibility: hidden` on the positioner around
 * it. The notification bell renders one on every Learning page whenever the
 * viewport is wide enough (iPad, or an iPhone held landscape), and the timetable
 * load screens render them in table cells. Asking only "is there a dialog?"
 * meant the gesture was refused on every one of those screens, permanently.
 *
 * So a dialog counts only if it is modal (Chakra's Modal, Drawer and
 * AlertDialog set aria-modal, and unmount when closed) or it is visible.
 */
function hasOpenDialog() {
  const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
  for (const el of dialogs) {
    if (el.getAttribute('aria-modal') === 'true') return true;
    if (el.closest('[hidden], [aria-hidden="true"]')) continue;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    return true;
  }
  return false;
}

/**
 * True if the touch started inside something that scrolls sideways.
 *
 * The class tab row is the case that matters: it is a horizontal scroller that
 * reaches the left edge of the screen, so every attempt to scroll it back to
 * "Stream" starts exactly where this gesture starts. Whoever is dragging a
 * scroller means to drag the scroller.
 */
function insideHorizontalScroller(node) {
  for (let el = node; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const overflowX = window.getComputedStyle(el).overflowX;
    if (overflowX === 'auto' || overflowX === 'scroll') return true;
  }
  return false;
}

/**
 * The chevron that follows the finger.
 *
 * Built as a detached DOM node rather than a React component on purpose: it
 * moves on every touchmove, and a component would put sixty renders a second
 * through the tree that is also drawing the screen being dragged.
 *
 * The page itself is deliberately not transformed. Translating a container
 * makes it the containing block for every `position: fixed` descendant inside
 * it — the sticky class header, open modals, toasts — which would detach them
 * from the viewport for the length of the drag. The chevron says "let go and
 * you will go back" without touching the layout it is drawn over.
 */
function createIndicator() {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    left: '0',
    top: '50%',
    width: '38px',
    height: '46px',
    borderRadius: '0 23px 23px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '2147483000',
    pointerEvents: 'none',
    opacity: '0',
    willChange: 'transform, opacity',
    boxShadow: '0 2px 14px rgba(0, 0, 0, 0.22)',
  });
  el.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
  return el;
}

/** Light pill on a dark app, dark pill on a light one — legible either way. */
function paintIndicator(el) {
  const dark = colorMode() === 'dark';
  el.style.background = dark ? 'rgba(247, 250, 252, 0.94)' : 'rgba(26, 32, 44, 0.88)';
  el.style.color = dark ? '#1A202C' : '#FFFFFF';
}

/**
 * Installs the gesture. Returns a teardown function.
 *
 * `getPath` and `goBack` are passed in rather than imported so this module
 * knows nothing about the router: the caller owns navigation, and this owns
 * deciding that the user asked for it.
 */
export function setupSwipeBack({ getPath, goBack }) {
  if (!isIosApp()) return () => {};

  let indicator = null;
  let tracking = false;   // a touch started at the edge and may become a swipe
  let committed = false;  // it is a horizontal drag; the page must stop scrolling
  let startX = 0;
  let startY = 0;
  let startedAt = 0;
  let progress = 0;

  const commitDistance = () => Math.max(60, window.innerWidth * COMMIT_FRACTION);

  const show = () => {
    if (!indicator) indicator = createIndicator();
    paintIndicator(indicator);
    if (!indicator.isConnected) document.body.appendChild(indicator);
  };

  const draw = (p) => {
    if (!indicator) return;
    // Slides out of the edge and settles; past 1 it swells slightly, which is
    // the only signal that letting go now will actually navigate.
    const eased = Math.min(p, 1);
    const x = -38 + 42 * eased;
    const scale = p >= 1 ? 1.08 : 1;
    indicator.style.transition = 'none';
    indicator.style.transform = `translate3d(${x}px, -50%, 0) scale(${scale})`;
    indicator.style.opacity = String(Math.min(1, 0.25 + eased * 0.75));
  };

  const hide = (animate) => {
    if (!indicator) return;
    const el = indicator;
    el.style.transition = animate ? 'transform 160ms ease-out, opacity 160ms ease-out' : 'none';
    el.style.transform = 'translate3d(-38px, -50%, 0) scale(1)';
    el.style.opacity = '0';
    window.setTimeout(() => { if (el.isConnected && !tracking) el.remove(); }, animate ? 200 : 0);
  };

  const reset = (animate) => {
    tracking = false;
    committed = false;
    progress = 0;
    hide(animate);
  };

  const onTouchStart = (event) => {
    tracking = false;
    committed = false;

    if (event.touches.length !== 1) return;            // pinch, or a second finger
    const touch = event.touches[0];
    if (touch.clientX > EDGE_WIDTH) return;

    const path = getPath();
    if (ROOT_PATHS.includes(path)) return;
    if (LOCKED.some((pattern) => pattern.test(path))) return;
    // An open dialog is its own context. Going back would navigate the screen
    // underneath it and leave the dialog sitting over a page it does not belong
    // to; dismissing it is the modal's own job, not this gesture's.
    if (hasOpenDialog()) return;
    if (insideHorizontalScroller(event.target)) return;

    tracking = true;
    startX = touch.clientX;
    startY = touch.clientY;
    startedAt = event.timeStamp || Date.now();
    progress = 0;
  };

  const onTouchMove = (event) => {
    if (!tracking) return;
    const touch = event.touches[0];
    if (!touch) return;

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (!committed) {
      // Undecided: wait for enough movement to tell a back swipe from a scroll,
      // and give up the moment it looks more vertical than horizontal. Reading
      // it the other way round — claiming the gesture and releasing it later —
      // costs the first few pixels of every scroll that starts near the edge.
      if (Math.abs(dx) < DIRECTION_SLOP && Math.abs(dy) < DIRECTION_SLOP) return;
      if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) {
        tracking = false;
        return;
      }
      committed = true;
      show();
    }

    // Only once the drag is unambiguously ours: until then the page must be
    // free to scroll normally.
    if (event.cancelable) event.preventDefault();

    progress = Math.max(0, dx) / commitDistance();
    draw(progress);
  };

  const onTouchEnd = (event) => {
    if (!tracking || !committed) {
      reset(false);
      return;
    }

    const touch = event.changedTouches?.[0];
    const dx = touch ? touch.clientX - startX : 0;
    const elapsed = Math.max(1, (event.timeStamp || Date.now()) - startedAt);
    const flicked = dx >= FLICK_DISTANCE && dx / elapsed >= FLICK_VELOCITY;

    const passed = dx >= commitDistance() || flicked;
    reset(true);

    // history.length counts forward entries too, so it is a floor rather than a
    // count of what is behind — but a length of 1 does mean there is nothing.
    if (passed && window.history.length > 1) goBack();
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  // Not passive: a committed drag has to stop the page scrolling under it, and
  // preventDefault() on a passive listener is ignored. The handler returns on a
  // boolean for every touch that is not this gesture, which is all of them.
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', () => reset(true), { passive: true });

  return () => {
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    indicator?.remove();
    indicator = null;
  };
}
