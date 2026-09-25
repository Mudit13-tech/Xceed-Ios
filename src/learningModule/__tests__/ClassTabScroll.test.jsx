import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Keeping the tab you are on where you can see it.
 *
 * A class carries thirteen tabs and the row scrolls sideways on a phone. The
 * browser does not scroll it for you, so opening Grades from a link — or
 * returning to a class you had left on a later tab — put the highlighted tab
 * somewhere off the right-hand edge. The one thing on the row that says where
 * you are was the one thing you could not see.
 */

vi.mock('../api/lmApi', () => ({
  default: {
    getClass: vi.fn().mockResolvedValue({
      _id: 'c1',
      name: 'Signals',
      isTeacher: false,
      code: 'ABC123',
      counts: {},
      topics: [],
    }),
    notifications: vi.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
  },
}));
vi.mock('../components/SubjectAttendanceStrip', () => ({ default: () => null }));
// Rendered outside a <Routes>, so useParams sees no pattern to read :classId
// from — and every tab's `to` would be built for class "undefined", matching
// nothing and leaving no active tab to scroll to.
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ classId: 'c1' }) };
});
vi.mock('../routePreload', () => ({ preloadPath: () => {} }), { virtual: true });

const scrollIntoView = vi.fn();
window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

const openClassAt = async (path) => {
  const { default: ClassLayout } = await import('../pages/ClassLayout');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ChakraProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <ClassLayout />
        </MemoryRouter>
      </QueryClientProvider>
    </ChakraProvider>,
  );
};

describe('opening a class deep in the tab row', () => {
  beforeEach(() => {
    scrollIntoView.mockClear();
  });

  it('scrolls the tab you are on into view', async () => {
    await openClassAt('/learning/class/c1/grades');
    await screen.findByText('Grades');

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('scrolls it nearest rather than centring it', async () => {
    // `center` would jerk a tab that is already comfortably in view sideways,
    // under the finger about to tap it.
    await openClassAt('/learning/class/c1/grades');
    await screen.findByText('Grades');

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(scrollIntoView).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' });
  });
});
