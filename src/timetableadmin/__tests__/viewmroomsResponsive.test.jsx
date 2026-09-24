import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import MasterRoomTable from '../viewmrooms';

/**
 * The classroom directory on a phone.
 *
 * It was a six-column table inside a horizontal scroller, and the two things
 * anybody opens this page for — the room number and the way to the room — sat
 * at opposite ends of a row. Finding a classroom on a phone meant reading the
 * left edge, scrolling right, and trusting you were still on the same row.
 *
 * Below `md` it is now a card per room, and the whole card is the link to the
 * map: the pin is a signpost rather than a forty-pixel target. The table stays
 * from `md` up, where its sortable columns are worth having.
 *
 * ## Which layout these tests see
 *
 * jsdom parses media queries but never matches them, so every responsive style
 * resolves to its `base` branch — the phone one. The table is therefore
 * `display: none` here, and Testing Library's *role* queries skip what CSS has
 * hidden, so `getByRole` sees the cards and nothing else. `getByText` ignores
 * visibility and sees both, which is what proves the table is still there. The
 * two kinds of query are used deliberately below.
 */

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));
vi.mock('../../components/header', () => ({ default: () => <div>header</div> }));
vi.mock('../../components/footer', () => ({ default: () => <div>footer</div> }));

const ROOMS = [
  {
    _id: 'r1',
    room: 'LT1',
    type: 'Lecture Theatre',
    building: 'Main Block',
    floor: 'Ground',
    dept: 'Computer Science and Engineering',
    landMark: 'https://maps.example.com/lt1',
  },
  {
    _id: 'r2',
    room: 'CR205',
    type: 'Classroom',
    building: 'Academic Block',
    floor: '2',
    dept: 'Electronics',
    // Recorded without a location, which the timetable module allows.
    landMark: '',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ROOMS.map((room) => ({ ...room })),
  }));
});

afterEach(() => {
  delete global.fetch;
});

const settled = async () => {
  render(
    <HelmetProvider>
      <ChakraProvider>
        <MemoryRouter>
          <MasterRoomTable />
        </MemoryRouter>
      </ChakraProvider>
    </HelmetProvider>,
  );
  await waitFor(() => expect(screen.getAllByText('LT1').length).toBeGreaterThan(0));
};

/** The card for a room — the link, at jsdom's width the only visible one. */
const cardFor = (roomName) =>
  screen.getAllByRole('link').find((link) => within(link).queryByText(roomName));

describe('the phone layout', () => {
  it('gives each room a card whose whole surface opens the map', async () => {
    await settled();

    const card = cardFor('LT1');
    expect(card).toBeDefined();
    expect(card).toHaveAttribute('href', 'https://maps.example.com/lt1');
    expect(card).toHaveAttribute('target', '_blank');
  });

  /* A window opened with target=_blank can reach back through `opener`. */
  it('does not hand the map tab a handle on this one', async () => {
    await settled();
    expect(cardFor('LT1')).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('keeps the room and the way to it in one glance', async () => {
    await settled();

    const card = cardFor('LT1');
    expect(within(card).getByText('LT1')).toBeInTheDocument();
    expect(within(card).getByText('Map')).toBeInTheDocument();
    expect(within(card).getByText('Lecture Theatre')).toBeInTheDocument();
    expect(within(card).getByText('Main Block')).toBeInTheDocument();
  });

  /* Otherwise it is a card that looks like a link, opens a blank tab, and
     reads as the map having broken rather than as nothing being recorded. */
  it('does not pretend a room with no location is a link', async () => {
    await settled();

    expect(cardFor('CR205')).toBeUndefined();
    expect(screen.getByText('No map')).toBeInTheDocument();
  });

  it('tells you what to do with a card, since there are no column headers', async () => {
    await settled();
    expect(screen.getByText(/tap a classroom to open it on the map/i)).toBeInTheDocument();
  });
});

describe('the table, which is still there from md up', () => {
  it('is rendered, just not shown at this width', async () => {
    await settled();

    const table = document.querySelector('table');
    expect(table).toBeTruthy();
    expect(within(table).getByText('Department')).toBeInTheDocument();
    // Both layouts carry the room, which is how we know neither was dropped.
    expect(screen.getAllByText('LT1').length).toBeGreaterThan(1);
  });

  it('names the room in its map button rather than repeating one label', async () => {
    await settled();

    const table = document.querySelector('table');
    expect(within(table).getByLabelText(/view LT1 on map/i)).toBeInTheDocument();
    expect(within(table).getByLabelText(/no location recorded for CR205/i)).toBeDisabled();
  });
});

/* One room typed in without a department used to throw inside the sort and
   blank the whole directory — which matters more now that this is where a
   phone looks for a room two minutes before a class. */
describe('a record with a field missing', () => {
  it('does not take the page down with it', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ _id: 'r3', room: 'X1', landMark: 'https://maps.example.com/x1' }],
    }));

    render(
      <HelmetProvider>
        <ChakraProvider>
          <MemoryRouter>
            <MasterRoomTable />
          </MemoryRouter>
        </ChakraProvider>
      </HelmetProvider>,
    );

    expect(await screen.findAllByText('X1')).not.toHaveLength(0);
  });
});
