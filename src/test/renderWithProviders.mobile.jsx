import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { renderWithProviders as amsRenderWithProviders } from './renderWithProviders';

/**
 * The AMS test harness, plus the query client this app's components need.
 *
 * The original's own comment says it wraps a component "the way the real app
 * does (main.jsx)" — and main.jsx has mounted a query provider since long
 * before this file did. It goes unnoticed upstream because nothing the web
 * client renders through this helper calls useQuery. Here things do:
 * allotedroles.mobile.jsx moved its fetching onto react-query so the roles page
 * survives being opened with no network, and the two tests AMS ships for that
 * page started failing with "No QueryClient set" — a component that works
 * failing on a harness that had not caught up.
 *
 * Delegating rather than forking means the provider stack stays AMS's. When
 * they add one to match a change in main.jsx, it arrives on the next sync and
 * this file does not need to know.
 *
 * A fresh client per render, with retries off: a test asserting an error state
 * should reach it on the first rejection rather than after react-query's
 * default three attempts, and one test's cache must never decide another's
 * result.
 */
export function renderWithProviders(ui, options) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return amsRenderWithProviders(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    options,
  );
}

export default renderWithProviders;
