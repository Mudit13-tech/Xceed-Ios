import React, { lazy, useEffect } from 'react';
import { matchPath } from 'react-router-dom';

/**
 * Route chunks, fetched on intent rather than on arrival.
 *
 * Splitting the router (every page behind `React.lazy`) bought a first paint
 * that no longer waits for the whole app, and paid for it with a "Loading…"
 * between pages: the chunk starts downloading only once the click has already
 * changed the URL. Hovering a link, or tabbing onto it, is a good enough
 * prediction of the click that follows — a few hundred milliseconds is usually
 * the whole fetch — so that is where the download starts instead.
 *
 * Nothing here changes what is in the bundle. A chunk nobody moves toward is
 * still never fetched.
 */

// { pattern, end, preload } for every lazy route that has been registered.
// Filled by `registerRouteTree`, read by `preloadPath`.
const registry = [];
// Pathnames already handled, so a mouse crossing a sidebar does not re-match
// the whole table for every pixel.
const seen = new Set();

/**
 * `React.lazy`, plus a `preload()` that starts the import early.
 *
 * The import is memoised here rather than left to `lazy`, so preloading and
 * rendering share one request no matter which happens first.
 */
export function lazyWithPreload(load) {
  let started;
  const preload = () => (started || (started = load()));
  const Component = lazy(() => preload());
  Component.preload = preload;
  return Component;
}

// `base` is the pattern the parent route matched; `path` is the child's, which
// react-router treats as relative unless it is absolute.
function joinPath(base, path) {
  if (!path) return base;
  if (path.startsWith('/')) return path;
  return `${base}/${path}`.replace(/\/{2,}/g, '/');
}

/**
 * Walks a `<Routes>` tree and records where each lazy element lives.
 *
 * Reading the tree beats maintaining a second list of paths beside it: the
 * pattern a link has to match is the one already written on the `<Route>`, and
 * a route added later is registered by having been added.
 *
 * Layout routes — the ones with children — are recorded as prefixes, because
 * reaching any page under them needs their chunk too.
 */
export function registerRouteTree(routesElement, base = '') {
  const walk = (node, prefix) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === React.Fragment) {
        walk(child.props.children, prefix);
        return;
      }
      const { path, element, children } = child.props || {};
      const here = joinPath(prefix, path);
      const preload = element?.type?.preload;
      if (typeof preload === 'function') {
        registry.push({ pattern: here, end: !children, preload });
      }
      if (children) walk(children, here);
    });
  };
  walk(routesElement?.props?.children, base.replace(/\/+$/, ''));
}

/**
 * Starts the chunk fetch for every route on the way to `pathname` — the page
 * itself and the layouts above it. Returns how many it started.
 *
 * A splat pattern (`/learning/*`) matches as a prefix, which is what mounts a
 * nested router: hovering a link into the learning module fetches that router,
 * and once it is running its own routes register themselves and the pages
 * inside it get the same treatment.
 */
export function preloadPath(pathname) {
  let started = 0;
  for (const route of registry) {
    if (matchPath({ path: route.pattern, end: route.end }, pathname)) {
      route.preload();
      started += 1;
    }
  }
  return started;
}

// A link worth predicting: one this router will handle, opened in this tab.
function targetPath(link) {
  if (!link || link.target === '_blank' || link.hasAttribute('download')) return null;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }
  let url;
  try {
    url = new URL(link.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname) return null;
  return url.pathname;
}

// Metered or 2G connections are the ones splitting was for. Guessing wrong
// there costs the user data they did not ask to spend.
function connectionAllowsPreload() {
  const connection = navigator.connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !/(^|-)2g$/.test(connection.effectiveType || '');
}

/**
 * Installs the one listener that drives all of this. Call it once, at the top
 * of the app.
 *
 * Delegated from the document rather than wired into each `<Link>`: the links
 * that matter are not only the sidebar's but every card on a list page, and a
 * handler that has to be remembered per link is one that gets forgotten.
 */
export function useLinkPreloading() {
  useEffect(() => {
    if (!connectionAllowsPreload()) return undefined;

    const onIntent = (event) => {
      const link = event.target?.closest?.('a[href]');
      if (!link) return;
      const pathname = targetPath(link);
      if (!pathname || seen.has(pathname)) return;
      seen.add(pathname);
      preloadPath(pathname);
    };

    // `pointerover` covers mouse and pen; `focusin` covers the keyboard.
    // `touchstart` is the closest a touch screen gets to intent — it still
    // lands ahead of the click.
    document.addEventListener('pointerover', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent);
    document.addEventListener('touchstart', onIntent, { passive: true });
    return () => {
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('focusin', onIntent);
      document.removeEventListener('touchstart', onIntent);
    };
  }, []);
}

// Test seam. The registry is module state on purpose — nested routers add to it
// as they load — which leaves tests needing a way back to empty.
export function __resetPreloadRegistry() {
  registry.length = 0;
  seen.clear();
}
