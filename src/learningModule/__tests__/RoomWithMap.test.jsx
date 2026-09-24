import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The pin beside a class's room number.
 *
 * "CR205" is the least useful thing on a class card for anybody who does not
 * already know the campus, and the map that would fix that sat behind the
 * classroom directory, in another module, two navigations away. The timetable
 * has held a Google Maps link per room all along.
 *
 * Three things decide whether this works in practice:
 *
 *  - a class's `room` is whatever the timetable allotted it, and a subject
 *    taught in a theatre and a lab arrives as one string, "LT1, CS-LAB-2"
 *  - plenty of rooms have no location recorded, and a pin that goes nowhere is
 *    worse than no pin
 *  - the class header renders twice, a card below `md` and a row above it, and
 *    both want the same answer
 */

const ttRoomLocations = vi.fn();
vi.mock('../api/lmApi', () => ({ default: { ttRoomLocations: (...a) => ttRoomLocations(...a) } }));

const LOCATIONS = {
  LT1: { mapUrl: 'https://maps.google.com/?q=lt1', building: 'Main Block', floor: 'Ground' },
  'CS-LAB-2': { mapUrl: 'https://maps.google.com/?q=cslab2', building: 'CSE Block', floor: '1' },
};

const renderRoom = async (room) => {
  const { forgetRoomLocations } = await import('../hooks/useRoomLocations');
  forgetRoomLocations();
  const { default: RoomWithMap } = await import('../components/RoomWithMap');
  render(
    <ChakraProvider>
      <RoomWithMap room={room} />
    </ChakraProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  ttRoomLocations.mockImplementation(async (rooms) => {
    const found = {};
    rooms.split(',').forEach((name) => {
      if (LOCATIONS[name]) found[name] = LOCATIONS[name];
    });
    return found;
  });
});

describe('the room on a class card', () => {
  it('opens the room on the map', async () => {
    await renderRoom('LT1');

    const pin = await screen.findByRole('link', { name: /find LT1 on the map/i });
    expect(pin).toHaveAttribute('href', 'https://maps.google.com/?q=lt1');
  });

  /* Chakra's isExternal, which is what carries target and rel. A map opening
     over the class the student was looking at is not what they asked for. */
  it('opens it in its own tab, without a handle on this one', async () => {
    await renderRoom('LT1');

    const pin = await screen.findByRole('link', { name: /find LT1 on the map/i });
    expect(pin).toHaveAttribute('target', '_blank');
    expect(pin.getAttribute('rel')).toContain('noopener');
  });

  it('still names the room', async () => {
    await renderRoom('LT1');
    expect(screen.getByText('LT1')).toBeInTheDocument();
  });

  /* A class allotted a theatre and a lab. One pin for the pair would have to
     pick one of them. */
  it('gives every room its own pin', async () => {
    await renderRoom('LT1, CS-LAB-2');

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2));
    expect(screen.getByRole('link', { name: /find CS-LAB-2 on the map/i })).toHaveAttribute(
      'href',
      'https://maps.google.com/?q=cslab2',
    );
  });

  it('asks for the rooms it was given, trimmed', async () => {
    await renderRoom('LT1,  CS-LAB-2 ');
    await waitFor(() => expect(ttRoomLocations).toHaveBeenCalled());
    expect(ttRoomLocations.mock.calls[0][0]).toBe('CS-LAB-2,LT1');
  });
});

/**
 * Every slot of a class carries a room, and most classes meet in the same one
 * all week. The card's list is therefore collapsed: one room when every slot is
 * in it, one entry per room when they are not.
 */
describe('a class that meets in the same room all week', () => {
  it('names the room once, not once per slot', async () => {
    await renderRoom('LT1, LT1, LT1');

    await waitFor(() => expect(screen.getAllByText('LT1')).toHaveLength(1));
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  /* Collapsed by a folded key rather than by folding the value: the spelling is
     what the map lookup matches on, so it must survive being deduplicated. */
  it('collapses a room written two ways without rewriting it', async () => {
    await renderRoom('LT1, lt1');

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(1));
    expect(screen.getByText('LT1')).toBeInTheDocument();
    expect(ttRoomLocations.mock.calls[0][0]).toBe('LT1');
  });

  it('still lists both when the class really does move', async () => {
    await renderRoom('LT1, CS-LAB-2, LT1');

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2));
    expect(screen.getAllByText('LT1')).toHaveLength(1);
    expect(screen.getAllByText('CS-LAB-2')).toHaveLength(1);
  });
});

describe('a room the timetable has no location for', () => {
  it('keeps the room and shows no pin', async () => {
    await renderRoom('NOWHERE-9');

    await waitFor(() => expect(ttRoomLocations).toHaveBeenCalled());
    expect(screen.getByText('NOWHERE-9')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the one it does know in a pair', async () => {
    await renderRoom('LT1, NOWHERE-9');

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(1));
    expect(screen.getByText('NOWHERE-9')).toBeInTheDocument();
  });

  /* A timetable that is down costs the card its pins; it must not cost it the
     room number, which is the part people already relied on. */
  it('keeps the room number when the lookup fails', async () => {
    ttRoomLocations.mockRejectedValue(new Error('timetable down'));
    await renderRoom('LT1');

    await waitFor(() => expect(ttRoomLocations).toHaveBeenCalled());
    expect(screen.getByText('LT1')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders nothing at all for a class with no room', async () => {
    const { default: RoomWithMap } = await import('../components/RoomWithMap');
    const { container } = render(
      <ChakraProvider>
        <RoomWithMap room="" />
      </ChakraProvider>,
    );

    expect(container.textContent).toBe('');
    expect(ttRoomLocations).not.toHaveBeenCalled();
  });
});

describe('asking once', () => {
  /* The class header renders twice — a card below `md` and a row above it —
     and every hop between a class's tabs re-renders both. Without the cache
     that is a request per render. */
  it('does not ask again for a room it has already looked up', async () => {
    await renderRoom('LT1');
    await waitFor(() => expect(ttRoomLocations).toHaveBeenCalledTimes(1));

    const { default: RoomWithMap } = await import('../components/RoomWithMap');
    render(
      <ChakraProvider>
        <RoomWithMap room="LT1" />
      </ChakraProvider>,
    );

    await waitFor(() => expect(screen.getAllByText('LT1').length).toBeGreaterThan(1));
    expect(ttRoomLocations).toHaveBeenCalledTimes(1);
  });

  /* Including the rooms that came back with nothing: that is the answer, and
     asking again will not change it before the page is reloaded. */
  it('does not ask again for a room it found nothing for', async () => {
    await renderRoom('NOWHERE-9');
    await waitFor(() => expect(ttRoomLocations).toHaveBeenCalledTimes(1));

    const { default: RoomWithMap } = await import('../components/RoomWithMap');
    render(
      <ChakraProvider>
        <RoomWithMap room="NOWHERE-9" />
      </ChakraProvider>,
    );

    await waitFor(() => expect(screen.getAllByText('NOWHERE-9').length).toBeGreaterThan(1));
    expect(ttRoomLocations).toHaveBeenCalledTimes(1);
  });
});
