import { Capacitor } from '@capacitor/core';

/**
 * Keep the app clear of the notch, the Dynamic Island and the home indicator.
 *
 * The first attempt at this was capacitor.config's ios.contentInset: "always".
 * It looked right standing still and was wrong in motion: contentInset offsets
 * where content *begins*, but the scroll view still draws into that region, so
 * scrolling put a strip of live text in the gap above the header. The header
 * itself was pinned below the inset and could not cover it.
 *
 * So the WebView is now edge-to-edge (contentInset "never") and the page owns
 * the insets, which is what Apple's own guidance recommends and what
 * env(safe-area-inset-*) exists for.
 *
 * Three things have to happen together, and none of them can live where you
 * would expect:
 *
 *  1. viewport-fit=cover, or iOS reports every inset as 0. The meta tag is in
 *     index.html, which is AMS's, so it is amended here at runtime instead.
 *  2. Body padding, so the first screenful starts below the island.
 *  3. The sticky headers have to move down too. This is the part CSS alone
 *     cannot do from outside: `position: sticky; top: 0` pins to the scrollport,
 *     which body padding does not inset, so a padded body still leaves the
 *     header pinning under the island the moment you scroll. They need their
 *     `top` changed -- and they are Navbar.jsx and LearningLayout.jsx, both
 *     AMS's, one styled by Tailwind classes and the other by Chakra's generated
 *     ones. There is no stable selector to write.
 *
 * Hence the observer: rather than guess at class names that upstream will
 * change, it asks the browser which elements are actually sticking to the top
 * and tags them. A tag is a selector we own, so the stylesheet can then do the
 * work. New screens get handled as they mount, and nothing here needs updating
 * when AMS restyles a header.
 *
 * iOS only. Android has no cutout and its layout is correct today.
 */

const STYLE_ID = 'xceed-safe-area';
const STICKY_ATTR = 'data-xceed-sticky-top';
const COVER_ID = 'xceed-safe-area-cover';

function ensureViewportFitCover() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const content = meta.getAttribute('content') || '';
  if (content.includes('viewport-fit')) return;
  meta.setAttribute('content', `${content}, viewport-fit=cover`);
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --xceed-safe-top: env(safe-area-inset-top, 0px);
      --xceed-safe-bottom: env(safe-area-inset-bottom, 0px);
    }
    body {
      padding-top: var(--xceed-safe-top);
      padding-bottom: var(--xceed-safe-bottom);
    }
    [${STICKY_ATTR}] {
      top: var(--xceed-safe-top) !important;
    }
    /* The bar that actually hides the strip. Padding alone cannot: it moves
       where content begins, and scrolled content still travels up through the
       inset. Something opaque has to sit over it. */
    #${COVER_ID} {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--xceed-safe-top);
      background: var(--xceed-safe-bg, #ffffff);
      z-index: 2147483647;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Tag anything the page is sticking to the very top.
 *
 * Read from the computed style rather than from class names: it is the only
 * source that is true regardless of whether the header came from Tailwind,
 * Chakra or an inline style, and it stays true after upstream restyles it.
 */
function tagStickyTops(root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('*').forEach((el) => {
    if (el.hasAttribute(STICKY_ATTR)) return;
    const cs = window.getComputedStyle(el);
    if (cs.position === 'sticky' && cs.top === '0px') {
      el.setAttribute(STICKY_ATTR, '');
    }
  });
}

/**
 * Paint the bar the same colour as whatever is beneath it.
 *
 * A fixed colour is wrong twice: the app has a dark mode, and the surface under
 * the island is a white header on most screens but the page background on the
 * login screen, which has no header at all. Either mismatch reads as a stray
 * line across the top -- which is exactly what a hardcoded white produced.
 *
 * So the colour is read from the page: the header if one is sticking, the body
 * otherwise. Transparent values are skipped, because a transparent bar defeats
 * the entire point of having one.
 */
function matchCoverColour() {
  const opaque = (c) => c && c !== 'transparent' && !c.startsWith('rgba(0, 0, 0, 0)');

  const header = document.querySelector(`[${STICKY_ATTR}]`);
  if (header) {
    const bg = window.getComputedStyle(header).backgroundColor;
    if (opaque(bg)) {
      document.documentElement.style.setProperty('--xceed-safe-bg', bg);
      return;
    }
  }

  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  if (opaque(bodyBg)) {
    document.documentElement.style.setProperty('--xceed-safe-bg', bodyBg);
  }
}

function ensureCover() {
  if (document.getElementById(COVER_ID)) return;
  const cover = document.createElement('div');
  cover.id = COVER_ID;
  document.body.appendChild(cover);
}

export function setupSafeArea() {
  if (Capacitor.getPlatform() !== 'ios') return;

  ensureViewportFitCover();
  ensureStyles();
  ensureCover();
  tagStickyTops(document);
  matchCoverColour();

  // Screens mount and unmount as the user navigates, so a one-off pass would
  // only ever fix the first one. Batched into an animation frame because React
  // commits many nodes at once and a scan per node would be wasteful.
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      ensureCover();
      tagStickyTops(document);
      matchCoverColour();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
