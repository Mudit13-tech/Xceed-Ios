/**
 * The web fonts, fetched after the app is on screen instead of before it.
 *
 * src/index.mobile.css explains why they had to come out of the stylesheet at
 * all: an `@import` there is render-blocking, so every launch waited on three
 * round trips to Google before painting anything. This is where they go
 * instead.
 *
 * Two things make an injected <link> non-blocking, and both are needed:
 *
 *  - `media="print"`. A stylesheet that does not apply to the current medium is
 *    still fetched, but the browser does not hold rendering for it. Flipping
 *    media to "all" in onload applies it in one go, after the bytes are already
 *    in hand. This is the standard trick and it is the whole mechanism -- there
 *    is no `rel=stylesheet` attribute that means "fetch but do not block".
 *
 *  - Doing it after first paint rather than at import time. A module imported
 *    from the entry chunk runs while the WebView is still assembling the first
 *    frame, and a fetch started there competes with the app's own first API
 *    calls for a connection the phone may only barely have.
 *
 * Failure is not handled because there is nothing to handle. If the request
 * never completes the link simply stays on media="print" and the text stays in
 * the system font, which is where it already was. An app that cannot reach
 * Google is an app that works.
 */

const GOOGLE_CSS = 'https://fonts.googleapis.com';
const GOOGLE_FILES = 'https://fonts.gstatic.com';

/** Stylesheets already requested, so a second call is free. */
const requested = new Set();

/**
 * Opens the connections the font requests will need, before they are made.
 *
 * A font stylesheet costs two hosts, not one: the CSS comes from
 * fonts.googleapis.com and every @font-face inside it points at
 * fonts.gstatic.com, which the browser only discovers once the CSS has parsed.
 * Warming both up front collapses two serial DNS+TLS setups into one that
 * overlaps the fetch.
 *
 * `crossorigin` on the gstatic hint is load-bearing rather than decorative:
 * fonts are fetched in CORS mode, and a preconnect opened in a different mode
 * than the request that follows is a connection the request cannot use, so
 * leaving it off warms a socket that is then thrown away.
 */
function preconnect() {
  for (const [href, cors] of [[GOOGLE_CSS, false], [GOOGLE_FILES, true]]) {
    if (requested.has(`preconnect:${href}`)) continue;
    requested.add(`preconnect:${href}`);
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    if (cors) link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
}

/** Fetches a stylesheet without letting it hold up rendering. See the note above. */
function loadStylesheet(href) {
  if (typeof document === 'undefined' || requested.has(href)) return;
  requested.add(href);

  preconnect();

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.media = 'print';
  link.addEventListener('load', () => { link.media = 'all'; }, { once: true });
  document.head.appendChild(link);
}

/**
 * Runs `task` once the app has stopped being busy, or after `timeout` at the
 * latest.
 *
 * requestIdleCallback is the right instrument and Safari did not ship it until
 * relatively recently, so the timeout is not only a fallback for old WebViews
 * -- it is also the guarantee that a screen which never goes idle (a live exam
 * timer, a polling dashboard) still gets its fonts.
 */
function whenIdle(task, timeout = 2000) {
  if (typeof window === 'undefined') return;
  const run = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(task, { timeout });
    } else {
      window.setTimeout(task, 300);
    }
  };
  // `load` has usually fired by the time React mounts; readyState tells us
  // rather than leaving a listener that will never be called.
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

/**
 * The one family the app itself is set in: Plus Jakarta Sans, reached through
 * the `tw-font-jakarta` utility (see tailwind.config.js).
 *
 * Weights 200-800 with italics, which is what AMS's stylesheet asked for. It is
 * more than the app demonstrably uses, but this is now a background fetch of a
 * variable font rather than a barrier in front of first paint, so trimming it
 * would be guessing at which weight some screen needs in exchange for nothing
 * that can be measured.
 */
export function loadUiFonts() {
  whenIdle(() => {
    loadStylesheet(
      `${GOOGLE_CSS}/css2?family=Plus+Jakarta+Sans:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300;1,400;1,500;1,600;1,700;1,800&display=swap`
    );
  });
}

/**
 * The certificate designer's font picker -- some forty-five display families,
 * from Alex Brush to Rubik Wet Paint.
 *
 * These are the two imports that had no business being in a global stylesheet.
 * They are needed, in full, by the screens that draw a certificate: the list at
 * certificatedesign.jsx:2192 is a menu the user picks from, so any family
 * missing is a menu entry that silently renders as something else. So they are
 * not trimmed either -- only moved behind the door of the module that owns
 * them. Called from the .mobile.jsx overrides beside those screens.
 *
 * Requested immediately rather than on idle: by the time this is called the
 * screen that needs them is already mounting, and the user is looking at the
 * text they apply to.
 */
export function loadCertificateFonts() {
  loadStylesheet(
    `${GOOGLE_CSS}/css2?family=Alex+Brush&family=Allura&family=Cookie&family=Dancing+Script:wght@400..700&family=Euphoria+Script&family=Libre+Caslon+Display&family=Monoton&family=Noto+Serif+Devanagari:wght@100..900&family=Playwrite+DE+Grund:wght@100..400&family=Special+Elite&family=UnifrakturCook:wght@700&display=swap`
  );
  loadStylesheet(
    `${GOOGLE_CSS}/css2?family=Abril+Fatface&family=Anton+SC&family=Blaka+Ink&family=Concert+One&family=Finger+Paint&family=Ga+Maamli&family=Grey+Qo&family=Ingrid+Darling&family=Kings&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lobster&family=Merienda:wght@300..900&family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&family=Neuton:ital,wght@0,200;0,300;0,400;0,700;0,800;1,400&family=Noto+Serif+Grantha&family=Ole&family=Oleo+Script:wght@400;700&family=Oswald:wght@200..700&family=Pacifico&family=Permanent+Marker&family=Roboto+Slab:wght@100..900&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Rowdies:wght@300;400;700&family=Rubik+Bubbles&family=Rubik+Burned&family=Rubik+Marker+Hatch&family=Rubik+Maze&family=Rubik+Microbe&family=Rubik+Spray+Paint&family=Rubik+Wet+Paint&display=swap`
  );
}
