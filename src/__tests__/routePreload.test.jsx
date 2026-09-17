import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPreloadRegistry,
  lazyWithPreload,
  preloadPath,
  registerRouteTree,
  useIdleRouteWarmup,
  warmUpRoutes,
} from '../routePreload';

// A stand-in for a page chunk: records that the import was asked for, and how
// many times, since one hover then a click must still be one request.
function stubPage(name) {
  const load = vi.fn(() => Promise.resolve({ default: () => <div>{name}</div> }));
  const Component = lazyWithPreload(load);
  Component.load = load;
  return Component;
}

afterEach(() => {
  __resetPreloadRegistry();
  vi.useRealTimers();
});

describe('preloadPath', () => {
  it('starts the chunk for a matching leaf route and leaves the others alone', () => {
    const Quizzes = stubPage('quizzes');
    const People = stubPage('people');
    registerRouteTree(
      <Routes>
        <Route path="/class/:id/quizzes" element={<Quizzes />} />
        <Route path="/class/:id/people" element={<People />} />
      </Routes>,
    );

    expect(preloadPath('/class/7/quizzes')).toBe(1);
    expect(Quizzes.load).toHaveBeenCalledTimes(1);
    expect(People.load).not.toHaveBeenCalled();
  });

  it('imports once however many times the link is hovered', () => {
    const Page = stubPage('page');
    registerRouteTree(
      <Routes>
        <Route path="/page" element={<Page />} />
      </Routes>,
    );

    preloadPath('/page');
    preloadPath('/page');
    expect(Page.load).toHaveBeenCalledTimes(1);
  });

  it('fetches the layouts above a page as well as the page', () => {
    const Layout = stubPage('layout');
    const Leaf = stubPage('leaf');
    registerRouteTree(
      <Routes>
        <Route path="/class/:id" element={<Layout />}>
          <Route path="grades" element={<Leaf />} />
        </Route>
      </Routes>,
    );

    expect(preloadPath('/class/7/grades')).toBe(2);
    expect(Layout.load).toHaveBeenCalledTimes(1);
    expect(Leaf.load).toHaveBeenCalledTimes(1);
  });

  it('does not treat a parent path as a match for its leaf', () => {
    const Leaf = stubPage('leaf');
    registerRouteTree(
      <Routes>
        <Route path="/class/:id/grades" element={<Leaf />} />
      </Routes>,
    );

    expect(preloadPath('/class/7')).toBe(0);
    expect(Leaf.load).not.toHaveBeenCalled();
  });

  it('matches a splat route as a prefix, so a nested router loads on intent', () => {
    const NestedRouter = stubPage('nested');
    registerRouteTree(
      <Routes>
        <Route path="/learning/*" element={<NestedRouter />} />
      </Routes>,
    );

    expect(preloadPath('/learning/class/7/quizzes')).toBe(1);
    expect(NestedRouter.load).toHaveBeenCalledTimes(1);
  });

  it('resolves a nested tree against the base it is mounted at', () => {
    const Dashboard = stubPage('dashboard');
    registerRouteTree(
      <Routes>
        <Route path="todo" element={<Dashboard />} />
      </Routes>,
      '/learning',
    );

    expect(preloadPath('/todo')).toBe(0);
    expect(preloadPath('/learning/todo')).toBe(1);
    expect(Dashboard.load).toHaveBeenCalledTimes(1);
  });

  it('ignores routes whose element is not lazy', () => {
    registerRouteTree(
      <Routes>
        <Route path="/eager" element={<div>eager</div>} />
      </Routes>,
    );

    expect(preloadPath('/eager')).toBe(0);
  });
});

describe('lazyWithPreload', () => {
  it('asks again after a failed import instead of keeping the failure', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ default: () => null });
    const Page = lazyWithPreload(load);

    await expect(Page.preload()).rejects.toThrow('network');
    await expect(Page.preload()).resolves.toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('useIdleRouteWarmup', () => {
  it('fetches only the listed pages, after the delay, including ones listed later', async () => {
    vi.useFakeTimers();
    const [A, B, Unlisted, Late] = [stubPage('a'), stubPage('b'), stubPage('x'), stubPage('late')];
    registerRouteTree(
      <Routes>
        <Route path="/a" element={<A />} />
        <Route path="/b" element={<B />} />
        <Route path="/x" element={<Unlisted />} />
      </Routes>,
    );
    warmUpRoutes([A, B]);

    renderHook(() => useIdleRouteWarmup(1000));
    await vi.advanceTimersByTimeAsync(500);
    expect(A.load).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    expect(A.load).toHaveBeenCalledTimes(1);
    expect(B.load).toHaveBeenCalledTimes(1);
    expect(Unlisted.load).not.toHaveBeenCalled();

    // A module whose chunk arrives after the queue has drained still gets warmed.
    warmUpRoutes([Late, A]);
    await vi.advanceTimersByTimeAsync(500);
    expect(Late.load).toHaveBeenCalledTimes(1);
    expect(A.load).toHaveBeenCalledTimes(1);
  });

  it('keeps going past a chunk that fails', async () => {
    vi.useFakeTimers();
    const Broken = lazyWithPreload(vi.fn(() => Promise.reject(new Error('404'))));
    const Fine = stubPage('fine');
    warmUpRoutes([Broken, Fine]);

    renderHook(() => useIdleRouteWarmup(0));
    await vi.advanceTimersByTimeAsync(1000);
    expect(Fine.load).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the user has asked to save data', async () => {
    vi.useFakeTimers();
    const original = navigator.connection;
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    });
    try {
      const Page = stubPage('page');
      warmUpRoutes([Page]);
      renderHook(() => useIdleRouteWarmup(0));
      await vi.advanceTimersByTimeAsync(1000);
      expect(Page.load).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'connection', { value: original, configurable: true });
    }
  });
});
