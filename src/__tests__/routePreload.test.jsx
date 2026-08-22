import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPreloadRegistry,
  lazyWithPreload,
  preloadPath,
  registerRouteTree,
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
