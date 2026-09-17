import React, { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * A page hop must not blank the app.
 *
 * Every page in this app is a `React.lazy` chunk behind one Suspense boundary
 * that wraps the whole route table in App.jsx. A click on a link whose chunk is
 * not downloaded yet therefore replaced *everything* — header, rail, class
 * switcher — with the boundary's 4px loading bar, until the chunk landed
 * (#2413, second half).
 *
 * Wrapping navigation in `React.startTransition` is what stops that: React
 * keeps the page that is already on screen until the next one can actually
 * render, instead of falling back. React Router does it for every navigation
 * under `future.v7_startTransition`, so this test asks the router for the
 * behaviour rather than the component tree.
 */

// A route whose chunk is still in flight. `release()` is the network answering.
function pendingRoute(label) {
  let release;
  const ready = new Promise((resolve) => {
    release = () => resolve({ default: () => <div>{label} page</div> });
  });
  return { Component: React.lazy(() => ready), release };
}

const renderApp = (Next, future) =>
  render(
    <MemoryRouter initialEntries={['/here']} future={future}>
      <Suspense fallback={<div data-testid="app-fallback">loading bar</div>}>
        <Routes>
          <Route
            path="/here"
            element={
              <div>
                <div data-testid="shell">shell</div>
                <Link to="/next">Go next</Link>
              </div>
            }
          />
          <Route path="/next" element={<Next />} />
        </Routes>
      </Suspense>
    </MemoryRouter>
  );

describe('navigating to a page whose chunk has not arrived', () => {
  it('blanks the whole app without startTransition — the behaviour being fixed', async () => {
    const next = pendingRoute('next');
    renderApp(next.Component, undefined);

    fireEvent.click(screen.getByText('Go next'));

    await waitFor(() => expect(screen.getByTestId('app-fallback')).toBeInTheDocument());
    expect(screen.queryByTestId('shell')).not.toBeVisible();
  });

  it('keeps the current page on screen with v7_startTransition', async () => {
    const next = pendingRoute('next');
    renderApp(next.Component, { v7_startTransition: true });

    fireEvent.click(screen.getByText('Go next'));

    // Chunk is deliberately still in flight here.
    await Promise.resolve();
    expect(screen.queryByTestId('app-fallback')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell')).toBeVisible();

    next.release();
    await screen.findByText('next page');
  });
});
