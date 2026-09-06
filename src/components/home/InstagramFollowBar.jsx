// The Instagram call-to-action pinned to the bottom of the home page.
//
// Fixed rather than parked in the footer, so it stays put while the page
// scrolls. It sits below the navbar in the stack (that bar is z-index 9999) and
// above the page content, and Home reserves bottom padding for it so it never
// covers the last line of the footer.

import { useEffect, useState } from 'react';

const INSTAGRAM_HANDLE = 'xceed_nitj';
const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;
const HANDLE = `@${INSTAGRAM_HANDLE}`;

/*
 * Opening the Instagram app when one is installed.
 *
 * iOS needs nothing: Instagram registers the https address as a Universal
 * Link, so the plain href below opens the app when it is there and Safari when
 * it is not. Firing a custom `instagram://` scheme at it would be worse — an
 * iPhone without the app answers that with an error dialog.
 *
 * Android does not intercept the https link as reliably, but it has a proper
 * answer of its own: an `intent://` URL naming the package, with the web
 * address as `browser_fallback_url`. Chrome opens the app if it is installed
 * and follows the fallback if it is not, so there is no timer guessing whether
 * the app took over — which is the usual way this is written, and the reason
 * it usually misfires on slow devices.
 *
 * Everything else — desktop, and any browser that is neither — just follows
 * the ordinary link.
 */
const ANDROID_INTENT_URL =
  `intent://instagram.com/_u/${INSTAGRAM_HANDLE}` +
  '#Intent;package=com.instagram.android;scheme=https;' +
  `S.browser_fallback_url=${encodeURIComponent(INSTAGRAM_URL)};end`;

const isAndroid = () =>
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');

// Per-viewer, per-browser convenience only — nothing here needs to survive a
// cleared cache, and every access is guarded because some browsers throw on
// storage rather than returning null.
const DISMISS_KEY = 'xceed:instagram-bar-dismissed';

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

function InstagramGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="tw-w-5 tw-h-5 tw-flex-shrink-0"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

const InstagramFollowBar = () => {
  // Starts hidden and is switched on after mount, so a dismissed bar never
  // flashes up before the stored answer is read.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  if (dismissed) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // A viewer who blocks storage simply sees it again next visit.
    }
  };

  // Android only — see the note beside ANDROID_INTENT_URL. Everywhere else the
  // href does the right thing on its own, so the click is left alone.
  const openApp = (event) => {
    if (!isAndroid()) {
      return;
    }
    event.preventDefault();
    window.location.href = ANDROID_INTENT_URL;
  };

  return (
    <div
      className="tw-fixed tw-inset-x-0 tw-bottom-0 tw-flex tw-justify-start tw-px-4 tw-pb-4 tw-pointer-events-none"
      style={{ zIndex: 50 }}
    >
      <div className="tw-pointer-events-auto tw-flex tw-items-center tw-gap-1 tw-rounded-full tw-border tw-border-gray-700 tw-bg-gray-900/95 tw-shadow-lg tw-backdrop-blur">
        <a
          href={INSTAGRAM_URL}
          onClick={openApp}
          target="_blank"
          rel="noopener noreferrer"
          className="tw-flex tw-items-center tw-gap-3 tw-rounded-full tw-py-2.5 tw-pl-5 tw-pr-3 tw-text-sm tw-font-medium tw-text-white hover:tw-text-pink-300 tw-transition-colors"
        >
          <span className="tw-text-pink-400">
            <InstagramGlyph />
          </span>
          <span>
            Follow us{' '}
            <span className="tw-font-bold tw-text-pink-300">{HANDLE}</span>
          </span>
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide the Instagram bar"
          title="Hide"
          className="tw-mr-2 tw-flex tw-h-7 tw-w-7 tw-flex-shrink-0 tw-items-center tw-justify-center tw-rounded-full tw-text-gray-500 hover:tw-bg-gray-800 hover:tw-text-white tw-transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="tw-w-3.5 tw-h-3.5"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default InstagramFollowBar;
