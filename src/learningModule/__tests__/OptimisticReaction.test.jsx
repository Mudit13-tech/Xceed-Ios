import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The thumb fills on the tap.
 *
 * Reacting to an announcement is the most-tapped control in the module, and it
 * used to wait for the round trip before showing anything — so on a slow
 * connection the press looked like it had not landed and people pressed again.
 * The toggle is applied locally and put back if the server disagrees.
 *
 * It is the one write here that is safe to show before it is confirmed:
 * nothing depends on a reaction, and the server's own list (which carries
 * everyone else's) replaces the guess as soon as it arrives.
 */

const reactToAnnouncement = vi.fn();
const getStream = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    getStream: (...a) => getStream(...a),
    reactToAnnouncement: (...a) => reactToAnnouncement(...a),
    listComments: vi.fn().mockResolvedValue([]),
    me: vi.fn().mockResolvedValue({ id: 'u1', name: 'Asha' }),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useOutletContext: () => ({
      classId: 'c1',
      isTeacher: false,
      klass: { name: 'Signals', topics: [] },
      me: { id: 'u1', name: 'Asha' },
    }),
  };
});

const announcement = {
  _id: 'a1',
  streamType: 'announcement',
  text: 'Lab moved to Thursday.',
  attachments: [],
  reactions: [],
  commentCount: 0,
  createdAt: new Date().toISOString(),
  author: { name: 'Dr Rao' },
};

const openStream = async () => {
  const { default: Stream } = await import('../pages/Stream');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ChakraProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Stream />
        </MemoryRouter>
      </QueryClientProvider>
    </ChakraProvider>,
  );
};

/** Never settles, so the assertion lands while the request is still in flight. */
const neverResolves = () => new Promise(() => {});

describe('reacting to an announcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStream.mockResolvedValue({ items: [announcement] });
  });

  it('counts the reaction before the server has answered', async () => {
    reactToAnnouncement.mockImplementation(neverResolves);
    await openStream();
    await screen.findByText(/lab moved to thursday/i);

    const thumb = screen.getByRole('button', { name: /like this announcement|remove your like/i });
    fireEvent.click(thumb);

    // Still in flight, and the tap has already been acknowledged.
    await waitFor(() => expect(thumb.textContent).toMatch(/1/));
    expect(reactToAnnouncement).toHaveBeenCalledWith('c1', 'a1', '👍');
  });

  it('puts it back when the server refuses', async () => {
    reactToAnnouncement.mockRejectedValue(new Error('Nope'));
    await openStream();
    await screen.findByText(/lab moved to thursday/i);

    const thumb = screen.getByRole('button', { name: /like this announcement|remove your like/i });
    fireEvent.click(thumb);

    await waitFor(() => expect(thumb.textContent).not.toMatch(/1/));
  });

  it('takes the server’s list once it arrives, not the local guess', async () => {
    // Somebody else reacted while this one was in flight; the answer has to be
    // theirs and mine, not just mine.
    reactToAnnouncement.mockResolvedValue({
      reactions: [
        { userId: 'u1', name: 'Asha', value: '👍' },
        { userId: 'u2', name: 'Bala', value: '👍' },
      ],
    });
    await openStream();
    await screen.findByText(/lab moved to thursday/i);

    const thumb = screen.getByRole('button', { name: /like this announcement|remove your like/i });
    fireEvent.click(thumb);

    await waitFor(() => expect(thumb.textContent).toMatch(/2/));
  });
});
