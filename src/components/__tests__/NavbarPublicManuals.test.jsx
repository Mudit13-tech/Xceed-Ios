/**
 * The manuals under /learning are onboarding documentation for staff who have
 * not been given an account yet. Mounting them outside LearningLayout is only
 * half of what makes them reachable — Navbar's own redirect runs on every page
 * and will bounce an anonymous reader to /login unless the path is treated as
 * public. This test covers that second half, which is the half that was
 * missing.
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChakraProvider } from '@chakra-ui/react';

import Navbar from '../home/Navbar';

function LocationProbe({ onChange }) {
  const location = useLocation();
  onChange(location.pathname);
  return null;
}

/** Renders the navbar at `path` with nobody signed in, and reports where it left us. */
async function landingPathFor(path) {
  let current = path;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await React.act(async () => {
    render(
      <QueryClientProvider client={client}>
        <ChakraProvider>
          <MemoryRouter initialEntries={[path]}>
            <LocationProbe onChange={(p) => { current = p; }} />
            <Routes>
              <Route path="*" element={<Navbar />} />
            </Routes>
          </MemoryRouter>
        </ChakraProvider>
      </QueryClientProvider>,
    );
  });
  // The redirect waits for the auth probe to settle, so the assertion has to.
  await waitFor(() => expect(current).toBeDefined());
  return () => current;
}

describe('Navbar auth redirect', () => {
  beforeEach(() => {
    // Signed out: /user/getuser answers 401, which is what makes the gate fire.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const MANUALS = [
    '/learning/manual',
    '/learning/quizmanual',
    '/learning/shortsmanual',
    '/learning/tutorialmanual',
    '/learning/assignmentmanual',
    '/learning/codingmanual',
    '/learning/formsmanual',
    '/learning/setupmanual',
  ];

  it.each(MANUALS)('leaves a signed-out reader on %s', async (path) => {
    const where = await landingPathFor(path);
    await waitFor(() => expect(where()).toBe(path));
  });

  it('still sends a signed-out visitor away from a real learning page', async () => {
    const where = await landingPathFor('/learning/class/abc/quizzes');
    await waitFor(() => expect(where()).not.toBe('/learning/class/abc/quizzes'));
  });
});
