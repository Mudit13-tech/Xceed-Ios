/**
 * Which colour mode the app is in, for code that runs outside React.
 *
 * Chakra writes the answer onto the document element on every toggle, before
 * it renders anything (@chakra-ui/react color-mode.utils.mjs:
 * `document.documentElement.dataset.theme = value`). That attribute is the only
 * signal available to a plain module — a hook cannot be called from a touch
 * handler or from the boot path — and it is set synchronously, so anything
 * watching it is never a frame behind what the user sees.
 *
 * Shared rather than duplicated because two copies of "how do I know the
 * theme?" is how one of them ends up reading a key the other has moved on from.
 */

/** @returns {'light' | 'dark'} */
export function colorMode() {
  const mode = document.documentElement.dataset.theme;
  if (mode === 'light' || mode === 'dark') return mode;
  // The instant before the provider has mounted, and any path where Chakra has
  // not written the attribute at all.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Calls `onChange` with the new mode whenever it actually changes.
 *
 * The toggle changes an attribute and nothing else — no resize, no navigation —
 * so an observer is the only way to hear it. Returns a disconnect function.
 */
export function watchColorMode(onChange) {
  let last = colorMode();
  const observer = new MutationObserver(() => {
    const mode = colorMode();
    if (mode === last) return;
    last = mode;
    onChange(mode);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
