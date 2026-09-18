import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The status bar's colour and its glyph style.
 *
 * The bug these cover was not a crash or a missing call — every call this
 * module makes was being made. The strip was painted the plugin's default
 * black while the style asked for dark glyphs, and iOS drew the clock, the
 * battery and the signal bars in black on black. Nothing about that is visible
 * to a test that only checks the module ran, so what is asserted here is the
 * pairing: whatever colour goes behind the glyphs, the style has to be the one
 * that shows up against it.
 */
const calls = { overlay: [], style: [], background: [] };

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setOverlaysWebView: vi.fn((o) => { calls.overlay.push(o); return Promise.resolve(); }),
    setStyle: vi.fn((o) => { calls.style.push(o); return Promise.resolve(); }),
    setBackgroundColor: vi.fn((o) => { calls.background.push(o); return Promise.resolve(); }),
  },
  Style: { Light: 'LIGHT', Dark: 'DARK', Default: 'DEFAULT' },
}));

const { configureStatusBar } = await import('../statusBar');

const setMode = (mode) => {
  if (mode) document.documentElement.dataset.theme = mode;
  else delete document.documentElement.dataset.theme;
};

const latest = () => ({
  style: calls.style.at(-1)?.style,
  color: calls.background.at(-1)?.color,
});

beforeEach(() => {
  calls.overlay.length = 0;
  calls.style.length = 0;
  calls.background.length = 0;
});

afterEach(() => {
  setMode(null);
  vi.useRealTimers();
});

describe('mobile status bar', () => {
  it('paints the strip the light page background, with the glyphs that show on it', async () => {
    setMode('light');
    await configureStatusBar();

    // Style.Light is Capacitor's name for DARK glyphs on a LIGHT background.
    expect(latest()).toEqual({ style: 'LIGHT', color: '#F7FAFC' });
    expect(calls.overlay.at(-1)).toEqual({ overlay: false });
  });

  it('switches both the colour and the glyphs together in dark mode', async () => {
    setMode('dark');
    await configureStatusBar();

    expect(latest()).toEqual({ style: 'DARK', color: '#171923' });
  });

  it('never leaves dark glyphs on the dark strip, or light on the light one', async () => {
    // The actual defect, stated as a rule: the two are read off one decision,
    // so no colour mode may produce a pairing that cannot be read.
    const readable = { LIGHT: '#F7FAFC', DARK: '#171923' };

    for (const mode of ['light', 'dark']) {
      setMode(mode);
      await configureStatusBar();
      const { style, color } = latest();
      expect(readable[style]).toBe(color);
    }
  });

  it('follows the colour-mode toggle without waiting for a resize', async () => {
    setMode('light');
    await configureStatusBar();
    expect(latest().color).toBe('#F7FAFC');

    setMode('dark');
    // The observer is a microtask, not a frame.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(latest()).toEqual({ style: 'DARK', color: '#171923' });
  });

  it('falls back to the system preference before the provider has mounted', async () => {
    setMode(null);
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    await configureStatusBar();

    expect(latest()).toEqual({ style: 'DARK', color: '#171923' });
  });
});
