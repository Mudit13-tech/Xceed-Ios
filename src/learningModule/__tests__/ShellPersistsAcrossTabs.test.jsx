import React, { Suspense } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from '../../components/ErrorBoundary';

/**
 * The shell must survive a hop between pages.
 *
 * Reported as "side menus keep loading" (#2413): every click in the rail put
 * the class switcher back to its skeleton and made the module re-read `me`,
 * `overview` and the class list — `/overview` alone is six queries. The cause
 * was above the module: App.jsx wraps the whole route table in an ErrorBoundary
 * keyed on the pathname, so a changed URL threw away the entire tree and built
 * it again. This mounts the real route table inside the real boundary and
 * counts, because a simplified harness is exactly what missed it the first time.
 */

const calls = {};
vi.mock('../api/lmApi', () => {
  const answer = (name) => {
    if (name === 'me') return { _id: 'u1', name: 'Asha', email: 'asha@nitj.ac.in', roles: ['student'] };
    if (name === 'listClasses') return [{ _id: 'c1', name: 'bc' }, { _id: 'c2', name: 'test1' }];
    if (name === 'overview') return { classCount: 2 };
    if (name === 'claimInvites') return { claimed: 0 };
    return {};
  };
  // A proxy rather than a listed set: the shell's bootstrap is not the only
  // thing that runs here, and a page reaching for a method nobody stubbed
  // should answer harmlessly instead of failing the count.
  return {
    default: new Proxy({}, {
      get(target, prop) {
        if (!target[prop]) {
          target[prop] = vi.fn(async () => {
            calls[prop] = (calls[prop] || 0) + 1;
            return answer(prop);
          });
        }
        return target[prop];
      },
    }),
  };
});

vi.mock('../components/NotificationBell', () => ({ default: () => null }));

const LearningRoutes = (await import('../LearningRoutes')).default;

beforeEach(() => {
  for (const key of Object.keys(calls)) delete calls[key];
});

const renderModule = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChakraProvider>
        <MemoryRouter initialEntries={['/learning']}>
          {/* The shape App.jsx actually mounts: boundary outside, one Suspense
              around the whole table. */}
          <ErrorBoundary>
            <Suspense fallback={<div data-testid="app-fallback" />}>
              <LearningRoutes />
            </Suspense>
          </ErrorBoundary>
        </MemoryRouter>
      </ChakraProvider>
    </QueryClientProvider>
  );

describe('learning shell across a page hop', () => {
  it('does not re-read the shell when moving between rail pages', async () => {
    const { container } = renderModule();

    await screen.findByText('My classes', {}, { timeout: 8000 });
    expect(calls.overview).toBe(1);

    // The rail's own links are laid out for a wide viewport, which jsdom reads
    // as display:none — so they are reached by href rather than by role.
    fireEvent.click(container.querySelector('a[href="/learning/todo"]'));

    await waitFor(() => expect(container.querySelector('a[href="/learning/todo"]')).toBeTruthy());

    expect(calls.overview).toBe(1);
    expect(calls.me).toBe(1);
    expect(calls.listClasses).toBe(1);
  }, 30000);

  it('keeps the class list on screen across the hop', async () => {
    const { container } = renderModule();

    await screen.findByText('My classes', {}, { timeout: 8000 });
    expect(screen.getByText('bc')).toBeInTheDocument();

    fireEvent.click(container.querySelector('a[href="/learning/todo"]'));

    // The switcher is not what the reader asked to change, so it never goes
    // back to its skeleton.
    expect(screen.getByText('bc')).toBeInTheDocument();
  }, 30000);
});
