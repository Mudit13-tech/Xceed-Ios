import { useEffect, useState } from 'react';

/**
 * What fills the page while a route's chunk is in flight.
 *
 * A skeleton of the page, not a progress bar. The bar this replaced was a 4px
 * shimmer sitting immediately under the navbar, which read as a stray
 * horizontal rule rather than as loading — it looked like a border the page had
 * grown, and it said nothing about what was coming.
 *
 * The shape is deliberately generic: a heading, a row of tiles, a few content
 * rows. It cannot match every route, and it is not trying to — what it has to
 * do is occupy the page the way a page does, so the navbar stops looking like
 * the whole app.
 *
 * Inline styles and no component library on purpose: this is the one thing that
 * has to render before anything else has loaded, on the slow connection that
 * made splitting worth doing in the first place.
 *
 * The shimmer uses a CSS animation injected once via a <style> tag — no deps,
 * no import, and it survives rendering before Chakra or anything else is ready.
 * Dark mode hangs off `[data-theme="dark"]`, which is what Chakra sets on the
 * document, so the skeleton is not a white flash on a dark page.
 */
const _routeFallbackStyle = `
@keyframes _rfShimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
._rfBlock {
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    #e8e8e8 25%,
    #f5f5f5 50%,
    #e8e8e8 75%
  );
  background-size: 1200px 100%;
  animation: _rfShimmer 1.4s ease-in-out infinite;
}
[data-theme="dark"] ._rfBlock {
  background: linear-gradient(
    90deg,
    #262d3a 25%,
    #313a4a 50%,
    #262d3a 75%
  );
  background-size: 1200px 100%;
}
/* A shimmer that never stops is exactly the kind of motion this setting is
   for. The blocks stay — the shape is the point — they just hold still. */
@media (prefers-reduced-motion: reduce) {
  ._rfBlock { animation: none; }
}
._rfWrap { max-width: 1100px; margin: 0 auto; padding: 32px 24px 64px; }
._rfTitle { height: 28px; width: min(260px, 60%); }
._rfSub { height: 14px; width: min(420px, 85%); margin-top: 14px; border-radius: 7px; }
._rfTiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-top: 36px;
}
._rfTile { height: 96px; border-radius: 12px; }
._rfRows { margin-top: 32px; }
._rfRow { height: 52px; border-radius: 10px; margin-bottom: 12px; }
`;

// Most chunk fetches finish well inside this, and a skeleton that appears for a
// few frames and vanishes reads as a flicker rather than as progress. Only a
// fetch that is actually slow gets to show it.
const ROUTE_FALLBACK_DELAY_MS = 400;

let _rfStyleInjected = false;
export default function RouteFallback() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), ROUTE_FALLBACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!_rfStyleInjected && typeof document !== 'undefined') {
    const tag = document.createElement('style');
    tag.textContent = _routeFallbackStyle;
    document.head.appendChild(tag);
    _rfStyleInjected = true;
  }
  if (!visible) return null;
  return (
    <div
      className="_rfWrap"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      {/* aria-hidden on the shapes: the label above already says "Loading
          page", and a screen reader counting nine empty divs says nothing a
          listener can use. */}
      <div aria-hidden="true">
        <div className="_rfBlock _rfTitle" />
        <div className="_rfBlock _rfSub" />
        <div className="_rfTiles">
          <div className="_rfBlock _rfTile" />
          <div className="_rfBlock _rfTile" />
          <div className="_rfBlock _rfTile" />
          <div className="_rfBlock _rfTile" />
        </div>
        <div className="_rfRows">
          <div className="_rfBlock _rfRow" />
          <div className="_rfBlock _rfRow" />
          <div className="_rfBlock _rfRow" />
        </div>
      </div>
    </div>
  );
}
