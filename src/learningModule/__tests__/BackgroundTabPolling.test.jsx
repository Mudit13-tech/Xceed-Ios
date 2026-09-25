import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * What a tab left open in the background costs the server.
 *
 * Students do not close tabs, they switch away from them — a lecture tab, a
 * coursework tab, one from Tuesday. Every one of those was still polling: the
 * notification bell alone asked for notifications once a minute, per tab,
 * indefinitely, for a screen nobody was looking at. Across a campus that is a
 * steady load carrying no information to anyone.
 *
 * The bell is the one that matters most because it is on every learning page,
 * so it stands here for the rest of them; the shared hook they all now use has
 * its own tests in attendancemodule/__tests__/usePolling.test.jsx.
 */

const notifications = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    notifications: (...args) => notifications(...args),
    markNotificationsRead: vi.fn().mockResolvedValue({}),
  },
}));

/** Drive document.visibilityState, which jsdom exposes read-only. */
function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

const A_MINUTE = 60000;

const renderBell = async () => {
  const { default: NotificationBell } = await import('../components/NotificationBell');
  return render(
    <ChakraProvider>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </ChakraProvider>,
  );
};

describe('the notification bell in a background tab', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setVisibility('visible');
    notifications.mockReset();
    notifications.mockResolvedValue({ items: [], unreadCount: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls once a minute while the tab is on screen', async () => {
    await renderBell();
    expect(notifications).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(A_MINUTE * 2); });

    expect(notifications).toHaveBeenCalledTimes(3);
  });

  it('stops entirely once the tab is switched away from', async () => {
    await renderBell();
    await act(async () => { await vi.advanceTimersByTimeAsync(A_MINUTE); });
    const beforeHiding = notifications.mock.calls.length;

    await act(async () => { setVisibility('hidden'); });
    // Half an hour of somebody working in another tab.
    await act(async () => { await vi.advanceTimersByTimeAsync(A_MINUTE * 30); });

    expect(notifications).toHaveBeenCalledTimes(beforeHiding);
  });

  it('refreshes the moment the tab comes back, rather than after a full minute', async () => {
    // The point of pausing is not to make a returning student wait: whatever
    // arrived while they were away is on screen as soon as they are.
    await renderBell();
    await act(async () => { setVisibility('hidden'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(A_MINUTE * 10); });
    const whileHidden = notifications.mock.calls.length;

    await act(async () => { setVisibility('visible'); });

    expect(notifications).toHaveBeenCalledTimes(whileHidden + 1);
  });

  it('picks the timer back up after returning', async () => {
    await renderBell();
    await act(async () => { setVisibility('hidden'); });
    await act(async () => { setVisibility('visible'); });
    const onReturn = notifications.mock.calls.length;

    await act(async () => { await vi.advanceTimersByTimeAsync(A_MINUTE * 2); });

    expect(notifications).toHaveBeenCalledTimes(onReturn + 2);
  });

  it('stops for good once the bell is unmounted', async () => {
    const { unmount } = await renderBell();
    unmount();
    const atUnmount = notifications.mock.calls.length;

    await act(async () => { await vi.advanceTimersByTimeAsync(A_MINUTE * 5); });

    expect(notifications).toHaveBeenCalledTimes(atUnmount);
  });
});
