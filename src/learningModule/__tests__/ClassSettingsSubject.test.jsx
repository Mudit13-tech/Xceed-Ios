import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Changing a class's subject after it has been created.
 *
 * The control was already on the settings page and could not be used. The
 * subject list is drawn from the timetable, which is addressed by branch code,
 * and the page resolved the class's branch with `b.dept === klass.dept` — an
 * exact string comparison against a field that is typed by hand in half a
 * dozen places and reaches the database as "Computer Science and Engineering",
 * "computer science & engineering" and "Computer_Science". When it missed,
 * `branchCode` stayed null; with no branch there are no semesters and no
 * subjects, so the dropdown rendered empty and disabled with nothing to say
 * why. Creation never hit it, because there the teacher picks the branch.
 *
 * Four things hold this now:
 *
 *  - the department is matched folded, the way the rest of the module does it
 *  - the subject already on the class stays visible even when the list does
 *    not carry it, so the field never reads blank for a class that has one
 *  - an empty list says why it is empty
 *  - a class whose department matches no branch can still be pointed at one,
 *    rather than being stuck for ever
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useOutletContext: () => outletContext };
});

const updateClass = vi.fn();
const ttBranches = vi.fn();
const ttSemesters = vi.fn();
const ttSubjects = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: {
    updateClass: (...a) => updateClass(...a),
    ttBranches: (...a) => ttBranches(...a),
    ttSemesters: (...a) => ttSemesters(...a),
    ttSubjects: (...a) => ttSubjects(...a),
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
  name: 'Thermodynamics',
  section: 'A',
  subject: 'Heat Transfer',
  subjectCode: 'ME301',
  room: '',
  description: '',
  coverColor: '#1967d2',
  meetLink: '',
  academicYear: '2026-27',
  semester: '5',
  batch: '',
  // Spelled differently from the timetable's branch below — the whole bug.
  dept: 'Computer_Science and Engineering',
  code: 'abc123',
  settings: {},
};

let outletContext;

const SUBJECTS = [
  { id: 'row-1', subCode: 'CS501', subName: 'Operating Systems', type: 'Theory' },
  { id: 'row-2', subCode: 'CS502', subName: 'Databases', type: 'Theory' },
];

/* What the timetable actually holds, and what the dropdown could not cope with:
   a lab split across batches is one row per batch, sharing subCode and
   differing only in subName (see the server's listSubjects, which says so), and
   a row whose code was never filled in. */
const BATCHED_SUBJECTS = [
  { id: 'row-1', subCode: 'CS501', subName: 'Operating Systems', type: 'Theory' },
  { id: 'row-2', subCode: 'CS599', subName: 'OS lab(B3a)', type: 'Lab' },
  { id: 'row-3', subCode: 'CS599', subName: 'OS lab(B3b)', type: 'Lab' },
  { id: 'row-4', subCode: '', subName: 'Open Elective', type: 'Theory' },
];

const renderPage = async (klass = CLASS) => {
  // `reloadClass` is the name ClassLayout actually puts on the context, and the
  // save path calls it — with the wrong name a successful save threw and was
  // caught as a failure, which passed these tests for the wrong reason.
  outletContext = {
    klass,
    classId: klass._id,
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

/** The subject dropdown, found by the option its class already carries. */
const subjectSelect = () =>
  screen.getAllByRole('combobox').find((select) =>
    Array.from(select.options).some((o) => /ME301|CS501/.test(o.textContent)));

beforeEach(() => {
  vi.clearAllMocks();
  ttBranches.mockResolvedValue([
    { code: 'CSE', dept: 'computer science and engineering' },
    { code: 'ECE', dept: 'Electronics' },
  ]);
  ttSemesters.mockResolvedValue(['3', '5', '7']);
  ttSubjects.mockResolvedValue(SUBJECTS);
  updateClass.mockResolvedValue({});
});

describe('resolving the class to a timetable branch', () => {
  /* "Computer_Science and Engineering" on the class against "computer science
     and engineering" in the timetable — underscores and case, which is what
     the folding is for. Deliberately not "&" against "and": the server's
     deptKeyOf does not fold that either, and inventing a stronger rule here
     would have the two disagree about which branch a class belongs to. */
  it('matches a department spelled differently from the timetable', async () => {
    await renderPage();
    await waitFor(() => expect(ttSemesters).toHaveBeenCalledWith('CSE'));
    await waitFor(() => expect(ttSubjects).toHaveBeenCalledWith('CSE', '5'));
  });

  it('lists the branch subjects once it resolves', async () => {
    await renderPage();
    await waitFor(() => expect(ttSubjects).toHaveBeenCalled());

    const select = await waitFor(() => {
      const found = subjectSelect();
      expect(found).toBeDefined();
      return found;
    });
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels.some((l) => l.includes('CS501'))).toBe(true);
    expect(labels.some((l) => l.includes('CS502'))).toBe(true);
  });
});

describe('the subject already on the class', () => {
  /* A class plainly has a subject; a field that reads blank invites somebody
     to "fix" it, and saving then clears it. */
  it('stays visible when the timetable list does not carry it', async () => {
    await renderPage();
    const select = await waitFor(() => {
      const found = subjectSelect();
      expect(found).toBeDefined();
      return found;
    });

    // Checked by what the field reads, not by the option's value: the value is
    // a sentinel now, because the subject's own code could collide with a row's
    // or — for a subject with no code — with the placeholder's empty one.
    expect(select.selectedOptions[0].textContent).toMatch(/ME301.*current/i);
  });

  it('is still selected when the branch cannot be resolved at all', async () => {
    ttBranches.mockResolvedValue([{ code: 'ECE', dept: 'Electronics' }]);
    await renderPage();

    const select = await waitFor(() => {
      const found = screen.getAllByRole('combobox').find((s) =>
        Array.from(s.options).some((o) => o.textContent.includes('ME301')));
      expect(found).toBeDefined();
      return found;
    });
    expect(select.selectedOptions[0].textContent).toMatch(/ME301/);
  });
});

describe('changing it', () => {
  it('saves the chosen subject and its code', async () => {
    const user = userEvent.setup();
    await renderPage();
    const select = await waitFor(() => {
      const found = subjectSelect();
      expect(found).toBeDefined();
      return found;
    });

    await user.selectOptions(select, 'row-2');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(updateClass).toHaveBeenCalled());
    const [, payload] = updateClass.mock.calls[0];
    expect(payload.subjectCode).toBe('CS502');
    expect(payload.subject).toBe('Databases');
  });
});

/**
 * Why the options are keyed by the timetable row id and not by the subject
 * code, which is what they were.
 *
 * A subject code does not identify a row. The server's own listSubjects says
 * so: a lab split across batches is stored as one row per batch, sharing
 * subjectFullName and subCode and differing only in subName — the very field
 * the dropdown renders. Keyed by code, the select carried several options with
 * the same value, so the browser selected the first of them whatever was
 * clicked; the second batch of a lab could not be chosen at all, and saving
 * wrote back the first batch's name.
 *
 * And a row whose code was never filled in rendered as value="", which is the
 * placeholder's value — so picking it read as "No subject" and cleared the
 * field rather than setting it.
 *
 * Creation never had either problem: it has always keyed by `item.id`.
 */
describe('subjects that share a code, and subjects with none', () => {
  beforeEach(() => {
    ttSubjects.mockResolvedValue(BATCHED_SUBJECTS);
  });

  it('gives every option its own value', async () => {
    await renderPage();
    const select = await waitFor(() => {
      const found = screen.getAllByRole('combobox').find((s) =>
        Array.from(s.options).some((o) => /OS lab/.test(o.textContent)));
      expect(found).toBeDefined();
      return found;
    });

    const values = Array.from(select.options).map((o) => o.value).filter(Boolean);
    expect(new Set(values).size).toBe(values.length);
  });

  it('selects the batch that was clicked, not the first one sharing its code', async () => {
    const user = userEvent.setup();
    await renderPage();
    const select = await waitFor(() => {
      const found = screen.getAllByRole('combobox').find((s) =>
        Array.from(s.options).some((o) => /OS lab\(B3b\)/.test(o.textContent)));
      expect(found).toBeDefined();
      return found;
    });

    await user.selectOptions(select, 'row-3');

    expect(select.value).toBe('row-3');

    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(updateClass).toHaveBeenCalled());
    const [, payload] = updateClass.mock.calls[0];
    expect(payload.subject).toBe('OS lab(B3b)');
    expect(payload.subjectCode).toBe('CS599');
  });

  /* It used to land on the placeholder's value and read as "No subject". */
  it('can pick a subject the timetable has no code for', async () => {
    const user = userEvent.setup();
    await renderPage();
    const select = await waitFor(() => {
      const found = screen.getAllByRole('combobox').find((s) =>
        Array.from(s.options).some((o) => /Open Elective/.test(o.textContent)));
      expect(found).toBeDefined();
      return found;
    });

    await user.selectOptions(select, 'row-4');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(updateClass).toHaveBeenCalled());
    const [, payload] = updateClass.mock.calls[0];
    expect(payload.subject).toBe('Open Elective');
    expect(payload.subjectCode).toBe('');
  });

  /* Opening the page on a class already taught to one batch must not quietly
     move it to another the moment anything else is saved. */
  it('comes back to its own batch, not the first with the same code', async () => {
    await renderPage({ ...CLASS, subject: 'OS lab(B3b)', subjectCode: 'CS599' });

    const select = await waitFor(() => {
      const found = screen.getAllByRole('combobox').find((s) =>
        Array.from(s.options).some((o) => /OS lab\(B3b\)/.test(o.textContent)));
      expect(found).toBeDefined();
      return found;
    });

    await waitFor(() => expect(select.value).toBe('row-3'));
  });
});

describe('when the list cannot be built', () => {
  it('says why, rather than showing a dead control', async () => {
    ttBranches.mockResolvedValue([{ code: 'ECE', dept: 'Electronics' }]);
    await renderPage();

    expect(
      await screen.findByText(/no timetable branch matches/i),
    ).toBeInTheDocument();
  });

  /* Otherwise a class whose department is blank, or spelled in a way the
     timetable does not carry, could never have its subject changed at all. */
  it('lets the branch be chosen by hand so the class is not stuck', async () => {
    const user = userEvent.setup();
    ttBranches.mockResolvedValue([{ code: 'ECE', dept: 'Electronics' }]);
    await renderPage();

    const branchSelect = await screen.findByLabelText(/subject list from/i);
    await user.selectOptions(branchSelect, 'ECE');

    await waitFor(() => expect(ttSemesters).toHaveBeenCalledWith('ECE'));
  });

  it('says the class stays in its own department', async () => {
    ttBranches.mockResolvedValue([{ code: 'ECE', dept: 'Electronics' }]);
    await renderPage();

    expect(await screen.findByText(/only decides which subjects are offered/i)).toBeInTheDocument();
  });

  it('offers no branch picker when the department resolved on its own', async () => {
    await renderPage();
    await waitFor(() => expect(ttSubjects).toHaveBeenCalled());

    expect(screen.queryByLabelText(/subject list from/i)).not.toBeInTheDocument();
  });
});
