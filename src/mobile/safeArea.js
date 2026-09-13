import { Capacitor } from '@capacitor/core';

/**
 * Keep the app clear of the notch, the Dynamic Island and the home indicator.
 *
 * Two earlier attempts are worth recording, because the fault each one left
 * explains the shape of this one.
 *
 * capacitor.config's ios.contentInset "always" looked right standing still and
 * was wrong in motion: contentInset offsets where content begins, but the scroll
 * view still draws into that region, so scrolling put a strip of live text above
 * the header.
 *
 * Then body padding plus a fixed bar to cover the strip. The bar had to be
 * painted some colour, and every choice was wrong somewhere -- white against the
 * dark launch screen was a white line across the top, which is the fault it was
 * added to fix.
 *
 * The bar was never needed. A sticky header pinned at top: 0 already spans the
 * full width at the top of the screen; it only has to be tall enough. Giving it
 * padding-top of the inset makes its own background cover the island strip and
 * puts its content below the cutout, in one element, with no colour to guess at
 * and nothing extra painted over the page.
 *
 * Body padding then applies only on screens that have no sticky header -- the
 * login screen -- because there the page itself must start below the island.
 * Applying both would inset twice and leave a gap.
 *
 * The header is Navbar.jsx on some screens and LearningLayout.jsx on others,
 * both AMS's, one styled by Tailwind and the other by Chakra's generated class
 * names. There is no stable selector to write, so rather than guess at names
 * upstream will change, the observer asks the browser which elements are
 * actually sticking to the top and tags them. The tag is a selector we own.
 *
 * viewport-fit=cover has to be set or iOS reports every inset as 0; that meta
 * tag lives in index.html, which is AMS's, so it is amended at runtime.
 *
 * iOS only. Android has no cutout and its layout is correct today.
 */

const STYLE_ID = 'xceed-safe-area';
const STICKY_ATTR = 'data-xceed-sticky-top';
const HAS_STICKY_ATTR = 'data-xceed-has-sticky-top';

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

    /* No header on this screen, so the page carries the inset itself. */
    body {
      padding-top: var(--xceed-safe-top);
      padding-bottom: var(--xceed-safe-bottom);
    }

    /* A header is sticking, and it carries the inset instead -- see below.
       Both at once would inset twice. */
    html[${HAS_STICKY_ATTR}] body {
      padding-top: 0;
    }

    /* Stays pinned at the very top so its background covers the strip the
       scroll view draws into, and grows by the inset so its own content sits
       below the cutout. */
    [${STICKY_ATTR}] {
      top: 0 !important;
      padding-top: var(--xceed-safe-top) !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Tag whatever the page is sticking to the very top.
 *
 * Read from the computed style, not from class names: it is the only source
 * that is true whether the header came from Tailwind, Chakra or an inline
 * style, and it stays true after upstream restyles it.
 */
function tagStickyTops() {
  let found = false;
  document.querySelectorAll('*').forEach((el) => {
    if (el.hasAttribute(STICKY_ATTR)) {
      found = true;
      return;
    }
    const cs = window.getComputedStyle(el);
    if (cs.position === 'sticky' && cs.top === '0px') {
      el.setAttribute(STICKY_ATTR, '');
      found = true;
    }
  });

  // Drives which of the two insets above applies on this screen.
  if (found) document.documentElement.setAttribute(HAS_STICKY_ATTR, '');
  else document.documentElement.removeAttribute(HAS_STICKY_ATTR);
}

export function setupSafeArea() {
  if (Capacitor.getPlatform() !== 'ios') return;

  ensureViewportFitCover();
  ensureStyles();
  tagStickyTops();

  // Screens mount and unmount as the user navigates, so a one-off pass would
  // only ever fix the first one. Batched into an animation frame because React
  // commits many nodes at once and a scan per node would be wasteful.
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      tagStickyTops();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
