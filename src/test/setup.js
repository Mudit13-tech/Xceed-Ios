import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// Chakra UI reads matchMedia during theme/color-mode resolution — jsdom has
// no real implementation, so components using ChakraProvider crash without this stub.
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom has no EventSource — only needed if a test renders HealthProvider.
if (!global.EventSource) {
  global.EventSource = class {
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

// recharts sizes itself with a ResizeObserver, which jsdom does not implement.
// The stub never fires — a chart in a test is measured by the explicit width and
// height the test gives it, not by layout jsdom does not do.
// (`globalThis` rather than the `global` its neighbours use, only because the
// bare name is not declared to eslint and this block need not add to that.)
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Every attendance-module component/hook fetches on mount; give every test a
// safe default so an unmocked call fails loudly instead of hanging.
global.fetch = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
);

// localStorage mock for test environment (Node 22+ / jsdom compatibility)
const createLocalStorageMock = () => {
  let store = {};
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    key: vi.fn((index) => Object.keys(store)[index] ?? null),
    get length() { return Object.keys(store).length; },
  };
};

const storageMock = createLocalStorageMock();
try {
  Object.defineProperty(globalThis, 'localStorage', { value: storageMock, writable: true, configurable: true });
} catch (e) {}
try {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: storageMock, writable: true, configurable: true });
  }
} catch (e) {}

afterEach(() => {
  vi.clearAllMocks();
});
