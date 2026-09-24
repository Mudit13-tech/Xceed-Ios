import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Where a class meets, on the card that lists it.
 *
 * The card already showed *when* — a row of schedule tags, with today's slot
 * picked out. It did not show where, so the obvious next question had to be
 * answered by opening the class, and the map behind the room was another two
 * navigations after that.
 *
 * The rooms sit directly under the schedule, for that reason: the slots say
 * when, the line below says where.
 *
 * One entry per room, not per slot. Most classes meet in the same room all
 * week, and a card that said "LT-1, LT-1, LT-1" would be reporting how many
 * periods there are, which the schedule above already does.
 */

const mockNavigate = vi.fn();
let outletContext;
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useOutletContext: () => outletContext };
});

const listClasses = vi.fn();
const ttRoomLocations = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: {
    listClasses: (...a) => listClasses(...a),
    ttRoomLocations: (...a) => ttRoomLocations(...a),
    createClass: vi.fn(),
    previewCode: vi.fn(),
    joinByCode: vi.fn(),
    ttBranches: vi.fn(async () => []),
    ttSemesters: vi.fn(async () => []),
    ttSubjects: vi.fn(async () => []),
  },
}));
vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));

const CLASS = {
  _id: 'c1',
  name: 'Operating Systems',
  section: 'A',
  subject: 'Operating Systems',
  coverColor: '#1967d2',
  ownerName: 'Dr Sharma',
  myRole: 'student',
  code: 'abc123',
  stats: { studentCount: 40, courseworkCount: 12 },
  schedule: [
    { day: 'Monday', label: 'Mon: 9-10' },
    { day: 'Wednesday', label: 'Wed: 11-12' },
  ],
  room: 'LT-1',
};

const renderDashboard = async (klass = CLASS) => {
  const { forgetRoomLocations } = await import('../hooks/useRoomLocations');
  forgetRoomLocations();

  listClasses.mockImplementation(async (status) => (status ? [] : [klass]));
  outletContext = { me: { name: 'A Student', roles: ['student'] }, overview: {}, reloadOverview: vi.fn() };

  const { default: Dashboard } = await import('../pages/Dashboard');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <ChakraProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    </ChakraProvider>,
  );
  await screen.findByText('Operating Systems');
};

const card = () => screen.getByRole('button', { name: /Operating Systems/ });

beforeEach(() => {
  vi.clearAllMocks();
  ttRoomLocations.mockImplementation(async (rooms) =>
    Object.fromEntries(
      rooms
        .split(',')
        .filter((name) => name.startsWith('LT') || name.startsWith('CS'))
        .map((name) => [name, { mapUrl: `https://maps.example.com/${name}`, building: 'Main Block' }]),
    ),
  );
});

describe('the room on a class card', () => {
  it('names the room and offers its map', async () => {
    await renderDashboard();

    const pin = await screen.findByRole('link', { name: /find LT-1 on the map/i });
    expect(pin).toHaveAttribute('href', 'https://maps.example.com/LT-1');
    expect(within(card()).getByText('LT-1')).toBeInTheDocument();
  });

  /* The slots say when; this says where. Above the schedule it would read as
     part of the class's name rather than as an answer to it. */
  it('sits below the schedule, not above it', async () => {
    await renderDashboard();
    await screen.findByRole('link', { name: /find LT-1 on the map/i });

    const text = card().textContent;
    expect(text.indexOf('Mon: 9-10')).toBeLessThan(text.indexOf('LT-1'));
  });

  it('shows one room when every slot is in the same one', async () => {
    await renderDashboard({ ...CLASS, room: 'LT-1, LT-1' });
    await screen.findByRole('link', { name: /find LT-1 on the map/i });

    expect(within(card()).getAllByText('LT-1')).toHaveLength(1);
  });

  it('shows both when the class moves between two', async () => {
    await renderDashboard({ ...CLASS, room: 'LT-1, CS-LAB-2' });

    await waitFor(() => expect(within(card()).getAllByRole('link')).toHaveLength(2));
    expect(within(card()).getByText('CS-LAB-2')).toBeInTheDocument();
  });

  it('says nothing for a class with no room allotted', async () => {
    await renderDashboard({ ...CLASS, room: '' });

    expect(ttRoomLocations).not.toHaveBeenCalled();
    expect(within(card()).queryByRole('link')).not.toBeInTheDocument();
  });
});

/**
 * The card was a `<button>`, and an anchor cannot live inside one — browsers
 * resolve that however they like. It is a div with a button's role now, so the
 * two things it must not lose are the ones below.
 */
describe('the card itself still behaves like a button', () => {
  it('opens the class when clicked', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(within(card()).getByText('Dr Sharma'));

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/learning/class/c1'));
  });

  it('opens the class from the keyboard', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    card().focus();
    await user.keyboard('{Enter}');

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/learning/class/c1'));
  });

  /* The pin is inside the card. Without stopping the click it would open the
     class as well as the map — losing the tab the map was opened in. */
  it('does not open the class when the pin is clicked', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    const pin = await screen.findByRole('link', { name: /find LT-1 on the map/i });
    await user.click(pin);

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
