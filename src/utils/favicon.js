/**
 * Keep the tab icon readable against the browser's own chrome.
 *
 * The mark is a single colour, so the light-on-light / dark-on-dark case is a
 * favicon nobody can see. There is no CSS for this — a favicon is not styled —
 * so the href is swapped from JS whenever prefers-color-scheme flips.
 *
 * This lived as an inline <script> in index.html until the server started
 * sending a Content-Security-Policy: script-src 'self' refuses inline script,
 * so the block was dropped on every page load and the icon was stuck on
 * whichever file index.html happened to name. Moving it into the bundle makes
 * it a same-origin script the policy already allows, which is a better fix than
 * a 'sha256-…' hash in the header that any whitespace edit here would break.
 *
 * Imported for its side effect from main.jsx; safe to import more than once.
 */
const DARK_MARK = '/logo-mark-white.svg';
const LIGHT_MARK = '/logo-mark-black.svg';

const query = window.matchMedia('(prefers-color-scheme: dark)');

function apply() {
  const link = document.getElementById('favicon');
  if (!link) return;
  link.href = query.matches ? DARK_MARK : LIGHT_MARK;
}

apply();
// addEventListener rather than the deprecated addListener the inline version
// used: Safari dropped the old form, so the icon never followed a theme change
// there even before CSP stopped the script running at all.
query.addEventListener('change', apply);
