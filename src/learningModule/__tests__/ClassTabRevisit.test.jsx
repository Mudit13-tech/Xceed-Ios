import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DEFAULT_STALE_TIME, CACHE_GC_TIME } from '../../mobile/queryCache';

/**
 * Coming back to a tab you were just on.
 *
 * Every tab inside a class is a route, so leaving one unmounts the page behind
 * it. Four of them held their list in the query cache and came back instantly;
 * the other six kept it in `useState` behind a `useEffect`, which meant every
 * visit was a cold fetch and a skeleton — Tutorials, Assignments, Forms,
 * Coding, Grades and Forum, however recently you had looked at them. Clicking
 * along a row of tabs re-fetched every one of them, and clicking back
 * re-fetched them all again.
 *
 * Tutorials stands for the six here; they were converted together and share
 * the shape. What is pinned is the thing a student notices: the second visit
 * costs nothing and shows no spinner. That the list is eventually re-asked for
 * once it is genuinely old is the defaults' behaviour, pinned in
 * src/__tests__/QueryRefetchDefaults.test.jsx.
 */

const listTutorials = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    listTutorials: (...args) => listTutorials(...args),
    createTutorial: vi.fn(),
    deleteTutorial: vi.fn(),
    updateTutorial: vi.fn(),
  },
}));

const OUTLET = { classId: 'c1', isTeacher: false, klass: { name: 'Signals' } };
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn(), useOutletContext: () => OUTLET };
});

/** A client with the app's own defaults, so this tests what ships. */
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: DEFAULT_STALE_TIME, gcTime: CACHE_GC_TIME, retry: false },
  },
});

const openTab = async () => {
  const { default: Tutorials } = await import('../pages/Tutorials');
  return render(
    <ChakraProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Tutorials />
        </MemoryRouter>
      </QueryClientProvider>
    </ChakraProvider>,
  );
};

describe('leaving a class tab and coming back', () => {
  beforeEach(() => {
    listTutorials.mockReset();
    listTutorials.mockResolvedValue([
      { _id: 't1', title: 'Resistive Networks', settings: {}, questions: [] },
    ]);
    client.clear();
  });

  it('fetches once on the first visit', async () => {
    await openTab();

    expect(await screen.findByText('Resistive Networks')).toBeInTheDocument();
    expect(listTutorials).toHaveBeenCalledTimes(1);
  });

  it('does not fetch again when you come straight back', async () => {
    const first = await openTab();
    await screen.findByText('Resistive Networks');
    first.unmount();

    await openTab();

    expect(listTutorials).toHaveBeenCalledTimes(1);
  });

  it('shows the list straight away on the way back, with no skeleton', async () => {
    // The wait is the whole complaint. A cached list is on screen in the first
    // render after the remount, not after a round trip.
    const first = await openTab();
    await screen.findByText('Resistive Networks');
    first.unmount();

    await openTab();

    expect(screen.getByText('Resistive Networks')).toBeInTheDocument();
  });
});
