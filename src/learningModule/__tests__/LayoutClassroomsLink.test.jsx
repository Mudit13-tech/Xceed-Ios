import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The way to the campus classroom locator, from the learning module's header.
 *
 * It lives in the top bar rather than the sidebar for a reason worth writing
 * down: it is wanted in the ten seconds before a class, usually on a phone, by
 * somebody who is not going to open a menu to look for it. It also leaves the
 * module entirely, and a nav item sitting among Classes, To-do and Timetable
 * would say otherwise.
 *
 * Both things below are what make it useful and are each one edit from being
 * lost: that it goes to /classrooms, and that it is reachable on a phone. The
 * header hides several of its controls below `md` — the "to review" badge, the
 * account name — and this must not quietly join them.
 */

const lmApi = {
  me: vi.fn(async () => ({ name: 'A Teacher', email: 't@nitj.ac.in', roles: ['faculty'] })),
  overview: vi.fn(async () => ({ awaitingReview: 0 })),
  listClasses: vi.fn(async () => []),
  claimInvites: vi.fn(async () => ({ claimed: 0 })),
  getMyDashboardSections: vi.fn(async () => ({ sections: null })),
  notifications: vi.fn(async () => ({ notifications: [], unread: 0 })),
  unreadCount: vi.fn(async () => ({ unread: 0 })),
};

vi.mock('../api/lmApi', () => ({ default: lmApi }));
vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));
vi.mock('../hooks/useTimetableChanges', () => ({ default: () => ({ changes: [], dismiss: vi.fn() }) }));
vi.mock('../components/NotificationBell', () => ({ default: () => <div>bell</div> }));

beforeEach(() => {
  vi.clearAllMocks();
});

const settled = async () => {
  const { default: LearningLayout } = await import('../components/LearningLayout');
  render(
    <ChakraProvider>
      <MemoryRouter>
        <LearningLayout />
      </MemoryRouter>
    </ChakraProvider>,
  );
  await waitFor(() => expect(lmApi.me).toHaveBeenCalled());
};

const mapLink = () => screen.getByRole('link', { name: /find a classroom/i });

describe('the classroom locator in the header', () => {
  it('goes to the campus directory', async () => {
    await settled();
    await waitFor(() => expect(mapLink()).toHaveAttribute('href', '/classrooms'));
  });

  /* jsdom never matches a media query, so every responsive style resolves to
     its `base` branch and role queries skip what CSS has hidden. Finding it by
     role here is therefore the phone case, which is the one that matters. */
  it('is reachable on a phone, not hidden with the desktop-only controls', async () => {
    await settled();
    await waitFor(() => expect(mapLink()).toBeVisible());
  });

  it('says what it is, since it is drawn as a bare pin', async () => {
    await settled();
    await waitFor(() => expect(mapLink()).toHaveAttribute('title', 'Find a classroom'));
  });
});
