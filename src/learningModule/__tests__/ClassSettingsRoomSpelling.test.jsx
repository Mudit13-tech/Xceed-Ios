import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The room a class carries is the room the timetable named.
 *
 * A room name is never typed twice on this platform. A department picks its
 * rooms from the master room list, a timetable slot is filled from that
 * department's list, and the class takes the slot's room — so `masterroom.room`
 * should reach a class character for character.
 *
 * It did not. This page read the room off the locked timetable and uppercased
 * it, which was the single place in the whole chain where the string changed:
 * a room recorded as "Lt-1" was stored on the class as "LT-1", and no longer
 * matched the record it had been copied from. Everything downstream that wants
 * to look the room up again — the map pin on the class header is the first
 * thing that did — then had to be taught to be tolerant of a difference this
 * page had invented.
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useOutletContext: () => outletContext };
});

const updateClass = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: {
    updateClass: (...a) => updateClass(...a),
    ttBranches: vi.fn(async () => [{ code: 'CSE', dept: 'Computer Science' }]),
    ttSemesters: vi.fn(async () => ['5']),
    ttSubjects: vi.fn(async () => []),
    ttRoomLocations: vi.fn(async () => ({})),
    regenerateCode: vi.fn(),
    archiveClass: vi.fn(),
    completeClass: vi.fn(),
    requestClassDeletion: vi.fn(),
    listTimetableRooms: vi.fn(async () => []),
    ttLockedRooms: vi.fn(async () => []),
  },
}));

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));

const CLASS = {
  _id: 'c1',
  name: 'Operating Systems',
  section: 'A',
  subject: 'Operating Systems',
  subjectCode: 'CS501',
  room: '',
  description: '',
  coverColor: '#1967d2',
  meetLink: '',
  academicYear: '2026-27',
  semester: '5',
  batch: '',
  dept: 'Computer Science',
  code: 'abc123',
  settings: {},
};

let outletContext;

/** A locked class timetable with the subject in two slots. */
const lockedTimetable = (rooms) => ({
  timetableData: {
    sem: '5',
    code: 'CSE',
    // slot → array of slot-data arrays → entries, which is the shape the
    // lock endpoint returns and the page walks.
    Monday: {
      '1': [rooms.map((room) => ({ subject: 'Operating Systems', room, faculty: 'X' }))],
    },
  },
});

const renderPage = async (rooms) => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('lockclasstt')) {
      return { ok: true, status: 200, json: async () => lockedTimetable(rooms) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });

  outletContext = {
    klass: CLASS,
    classId: CLASS._id,
    reloadClass: vi.fn(),
    toast: vi.fn(),
    isOwner: true,
    isTeacher: true,
  };
  const { default: ClassSettings } = await import('../pages/ClassSettings');
  render(
    <ChakraProvider>
      <ClassSettings />
    </ChakraProvider>,
  );
  await screen.findByText('Subject');
};

const roomField = () => screen.getByPlaceholderText('No rooms allotted');

beforeEach(() => {
  vi.clearAllMocks();
  updateClass.mockResolvedValue({});
});

describe('the room read off the timetable', () => {
  /* The bug. It used to arrive as "LT-1". */
  it('keeps the spelling the master room record uses', async () => {
    await renderPage(['Lt-1']);
    await waitFor(() => expect(roomField().value).toBe('Lt-1'));
  });

  it('keeps it through a save, so the class stores what the timetable said', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    await renderPage(['CSE Lab 2']);
    await waitFor(() => expect(roomField().value).toBe('CSE Lab 2'));

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(updateClass).toHaveBeenCalled());
    expect(updateClass.mock.calls[0][1].room).toBe('CSE Lab 2');
  });

  it('lists every room the subject is taught in', async () => {
    await renderPage(['Lt-1', 'CSE Lab 2']);
    await waitFor(() => expect(roomField().value).toBe('CSE Lab 2, Lt-1'));
  });

  /* Deduplicated by a folded key rather than by folding the value: the same
     room in two slots is one room, and that must not cost it its spelling —
     which is how the uppercase got there in the first place. */
  it('counts a room listed twice once, without rewriting it', async () => {
    await renderPage(['Lt-1', 'lt-1', 'Lt-1']);
    await waitFor(() => expect(roomField().value).toBe('Lt-1'));
  });
});
