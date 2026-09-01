import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';

import ErrorBoundary from '../ErrorBoundary';

function Bomb({ shouldThrow }) {
  if (shouldThrow) throw new Error('boom');
  return <div>safe content</div>;
}

let consoleErrorSpy;
beforeEach(() => {
  // React logs the caught error to console itself on top of our own
  // componentDidCatch call — expected noise for every test in this file.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
});

it('renders children normally when nothing throws', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByText('safe content')).toBeInTheDocument();
});

it('shows a fallback instead of blanking when a child throws during render', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  expect(screen.queryByText('safe content')).not.toBeInTheDocument();
});

it('"Try again" clears the error and re-renders the same children', () => {
  let shouldThrow = true;
  function Toggleable() {
    return <Bomb shouldThrow={shouldThrow} />;
  }

  const { rerender } = render(
    <MemoryRouter initialEntries={['/']}>
      <ErrorBoundary>
        <Toggleable />
      </ErrorBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

  // Fix the underlying condition, then ask the boundary to re-attempt.
  shouldThrow = false;
  fireEvent.click(screen.getByRole('button', { name: /try again/i }));
  rerender(
    <MemoryRouter initialEntries={['/']}>
      <ErrorBoundary>
        <Toggleable />
      </ErrorBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByText('safe content')).toBeInTheDocument();
});

it('recovers automatically when the route changes, so a still-working navbar link is a real way out', () => {
  function Page() {
    return (
      <Routes>
        <Route path="/broken" element={<Bomb shouldThrow />} />
        <Route path="/safe" element={<div>a different, working page</div>} />
      </Routes>
    );
  }

  render(
    <MemoryRouter initialEntries={['/broken']}>
      {/* Stands in for the always-mounted Navbar in App.jsx: still clickable
          even while the boundary below it is showing its fallback. */}
      <Link to="/safe">Go elsewhere</Link>
      <ErrorBoundary>
        <Page />
      </ErrorBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

  fireEvent.click(screen.getByText('Go elsewhere'));

  expect(screen.getByText('a different, working page')).toBeInTheDocument();
  expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
});
