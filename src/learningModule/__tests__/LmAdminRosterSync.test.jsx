import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The roster-sync console.
 *
 * The sync lives in services/rosterSync and already had a card on the admin
 * console — a department box, a preview, a run. That is the right size for "do
 * it now" and the wrong size for the question underneath it: *which* classrooms
 * have students waiting, and why the ones that do not, do not.
 *
 * This page is those same two endpoints with somewhere to read them, so what is
 * worth pinning is not arithmetic — the service does that and is tested beside
 * itself — but the three things a console can get wrong on its own:
 *
 *  - **"No email" carries its reason.** "No student record" and "a record with
 *    no address" are fixed by different people in different places, and a bare
 *    count sends somebody to the wrong one.
 *  - **The semester button refuses without a semester.** Enrolling every class
 *    in the institute behind one click is not something to do by accident.
 *  - **Unmatched classes are shown, not omitted.** "Why did nothing happen to
 *    my class" is the first question asked and the hardest to answer from a
 *    screen that silently left it out.
 */

const adminRosterSyncOptions = vi.fn();
const adminRosterSyncPreview = vi.fn();
const adminRosterSyncRun = vi.fn();
const adminRosterSyncRunStatus = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: {
    adminRosterSyncOptions: (...a) => adminRosterSyncOptions(...a),
    adminRosterSyncPreview: (...a) => adminRosterSyncPreview(...a),
    adminRosterSyncRun: (...a) => adminRosterSyncRun(...a),
    adminRosterSyncRunStatus: (...a) => adminRosterSyncRunStatus(...a),
  },
}));

/* The dropdowns, read before anything is planned. Both come from the classes
   that exist, spelled as the timetable's master list spells them — a class
   copies that string verbatim through the subject it was created from, so an
   option and a class hold the same value and the filter is an equality. */
const OPTIONS = {
  departments: ['CSE', 'ECE'],
  semesters: ['B.Tech-3', 'B.Tech-5'],
};

const entry = (over = {}) => ({
  classId: 'c1',
  className: 'Operating Systems',
  subject: 'Operating Systems',
  subjectCode: 'CS501',
  dept: 'CSE',
  semester: 'B.Tech-5',
  facultyName: 'Dr A',
  facultyEmail: 'a@nitj.ac.in',
  rosterSize: 60,
  erpSyncedAt: null,
  wouldAdd: 38,
  alreadyIn: 20,
  wouldFail: 0,
  failed: [],
  missingEmailCount: 2,
  missingEmail: [
    { rollNo: '21103003', name: '', reason: 'no student record for this roll number' },
    { rollNo: '21103004', name: 'D', reason: 'no email address on the student record' },
  ],
  previouslyRemoved: [],
  ...over,
});

const preview = (subjects, unmatched = []) => ({
  subjects,
  unmatched,
  totals: {
    classes: subjects.length,
    wouldAdd: subjects.reduce((s, e) => s + e.wouldAdd, 0),
    wouldFail: subjects.reduce((s, e) => s + e.wouldFail, 0),
    missingEmail: subjects.reduce((s, e) => s + e.missingEmailCount, 0),
    previouslyRemoved: 0,
    unmatched: unmatched.length,
  },
});

const renderPage = async (data = preview([entry()])) => {
  adminRosterSyncPreview.mockResolvedValue(data);
  const { default: LmAdminRosterSync } = await import('../pages/LmAdminRosterSync');
  renderWithProviders(<LmAdminRosterSync />);
  // Whatever the fixture holds: a table once the plan has arrived. `findAll`
  // because a plan spanning two semesters draws one table per semester.
  await screen.findAllByRole('table');
};

const classTable = () => screen.getAllByRole('table')[0];

const finishedRun = (totals, over = {}) => ({
  phase: 'done',
  message: 'Finished.',
  total: totals.added,
  completed: totals.added,
  events: [],
  error: null,
  result: { subjects: [], unmatched: [], totals },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  adminRosterSyncOptions.mockResolvedValue(OPTIONS);
  /* A run is started, not awaited: the POST hands back an id and the page polls
     it. Both halves are mocked, so a test that only cares about the outcome
     gets a run that is already finished. */
  adminRosterSyncRun.mockResolvedValue({ runId: 'run-1' });
  adminRosterSyncRunStatus.mockResolvedValue(finishedRun({ added: 38, failed: 0 }));
});

describe('what a row says', () => {
  it('shows the four counts the page exists to answer', async () => {
    await renderPage();

    const row = within(classTable()).getAllByRole('row')[1];
    expect(within(row).getByText('60')).toBeInTheDocument();
    expect(within(row).getByText('20')).toBeInTheDocument();
    expect(within(row).getByText('38')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
  });

  it('puts the number it will add on the button', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: 'Add 38' })).toBeInTheDocument();
  });

  /* A bare count sends somebody to the wrong place: a missing student record is
     the ERP's to fix, a record with no address is the student office's. */
  it('carries the reason each roll number cannot be enrolled', async () => {
    await renderPage();

    const badge = within(classTable()).getByText('2');
    await userEvent.hover(badge);

    expect(await screen.findByText(/no student record for this roll number/)).toBeInTheDocument();
  });

  it('offers nothing to press for a subject with an empty register', async () => {
    await renderPage(preview([entry({ rosterSize: 0, wouldAdd: 0, alreadyIn: 0, missingEmailCount: 0, missingEmail: [] })]));

    expect(screen.getByText('Empty register')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add \d/ })).not.toBeInTheDocument();
  });

  /* A class where everybody is in and a class where nobody can be added are
     different situations for the administrator chasing missing students, so
     they are two tests rather than one with a re-render in the middle. */
  it('says "all enrolled" when there is nobody left to add', async () => {
    await renderPage(preview([entry({ wouldAdd: 0, missingEmailCount: 0, missingEmail: [] })]));
    expect(screen.getByText('All enrolled')).toBeInTheDocument();
  });

  it('says "nobody addable" when the ones left have no address', async () => {
    await renderPage(preview([entry({ wouldAdd: 0 })]));
    expect(screen.getByText('Nobody addable')).toBeInTheDocument();
  });
});

describe('adding one class', () => {
  it('runs the sync for that class alone, and re-reads', async () => {
    await renderPage();
    adminRosterSyncPreview.mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'Add 38' }));

    await waitFor(() =>
      expect(adminRosterSyncRun).toHaveBeenCalledWith({ classId: 'c1', background: true }));
    await waitFor(() => expect(adminRosterSyncPreview).toHaveBeenCalled());
  });

  it('says how many it added', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Add 38' }));

    expect(await screen.findByText(/Operating Systems: 38 added/)).toBeInTheDocument();
  });

  it('says so when it failed', async () => {
    adminRosterSyncRun.mockRejectedValue(new Error('Subject lookup failed'));
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Add 38' }));

    expect(await screen.findByText(/Subject lookup failed/)).toBeInTheDocument();
  });
});

const semesterButtonFor = (name = /Add all/) => screen.getByRole('button', { name });

describe('adding a whole semester', () => {
  const semesterButton = semesterButtonFor;

  /* The button sits under the heading of the semester it fills, so what it
     writes is what that section shows. It used to sit in the toolbar and mean
     "every class currently listed", which meant something different depending
     on a dropdown several inches away — and, with no semester chosen, an
     institute-wide write behind one click. */
  it('sends the semester it sits under, with the department in force', async () => {
    await renderPage();

    await userEvent.click(semesterButton());

    await waitFor(() => expect(adminRosterSyncRun).toHaveBeenCalled());
    expect(adminRosterSyncRun.mock.calls.at(-1)[0]).toMatchObject({
      semester: 'B.Tech-5',
      dept: 'CSE',
    });
  });

  it('fills one semester without touching the other', async () => {
    await renderPage(
      preview([
        entry(),
        entry({ classId: 'c2', className: 'Databases', semester: 'B.Tech-3', wouldAdd: 7 }),
      ]),
    );

    await userEvent.click(semesterButton('Add all (7)'));

    await waitFor(() => expect(adminRosterSyncRun).toHaveBeenCalled());
    expect(adminRosterSyncRun.mock.calls.at(-1)[0]).toMatchObject({ semester: 'B.Tech-3' });
  });

  /* An empty semester is what the server reads as "every semester", so a run
     scoped to this heading would be scoped to the whole institute. */
  it('does not offer to fill the classrooms that record no semester', async () => {
    await renderPage(preview([entry({ semester: '', wouldAdd: 4 })]));

    expect(screen.getByText('No semester recorded')).toBeInTheDocument();
    expect(semesterButton()).toBeDisabled();
  });

  it('is refused when the semester has nobody to add', async () => {
    await renderPage(preview([entry({ wouldAdd: 0 })]));
    expect(semesterButton()).toBeDisabled();
  });

  it('warns rather than congratulates when some could not be enrolled', async () => {
    adminRosterSyncRunStatus.mockResolvedValue(finishedRun({ added: 10, failed: 3, studentsMailed: 10 }));
    await renderPage();

    await userEvent.click(semesterButton());

    expect(await screen.findByText(/3 could not be enrolled/)).toBeInTheDocument();
  });
});

/**
 * Watching a run rather than waiting on one.
 *
 * Enrolling somebody is an account, a membership row and their own mail, and a
 * semester is hundreds of them. Held open as one request that is a button that
 * spins for minutes — and a run that says nothing is indistinguishable from a
 * run that is stuck, which is what was reported.
 */
describe('while a run is going', () => {
  const running = (over = {}) => ({
    phase: 'enrolling',
    message: 'Matched 3 classrooms. Enrolling 40 students…',
    total: 40,
    completed: 12,
    failed: 0,
    events: [{ at: 1, text: 'Asha (21103001) → Operating Systems · mailed', ok: true }],
    result: null,
    error: null,
    ...over,
  });

  it('starts a background run instead of holding the request open', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Add 38' }));

    await waitFor(() =>
      expect(adminRosterSyncRun.mock.calls.at(-1)[0]).toMatchObject({ background: true }));
  });

  it('says what the server is doing, not just that it is busy', async () => {
    adminRosterSyncRunStatus
      .mockResolvedValueOnce(running())
      .mockResolvedValue(finishedRun({ added: 38, failed: 0 }));
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Add 38' }));

    expect(await screen.findByText('Enrolling students')).toBeInTheDocument();
    expect(await screen.findByText(/Enrolling 40 students/)).toBeInTheDocument();
    expect(await screen.findByText(/12 of 40/)).toBeInTheDocument();
  });

  /* The lines are the point. A bar says how far along a run is and nothing
     about whether it is doing the right thing; these name the student and the
     classroom, so a run enrolling the wrong people is visible while it
     happens. */
  it('names each student and the classroom they went into', async () => {
    adminRosterSyncRunStatus
      .mockResolvedValueOnce(running())
      .mockResolvedValue(finishedRun({ added: 38, failed: 0 }));
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Add 38' }));

    expect(
      await screen.findByText(/Asha \(21103001\) → Operating Systems · mailed/),
    ).toBeInTheDocument();
  });

  it('reports a run that stopped rather than leaving the page waiting', async () => {
    adminRosterSyncRunStatus.mockResolvedValue({
      ...running(),
      phase: 'failed',
      error: 'The register could not be read',
    });
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Add 38' }));

    // On the panel, so the reason stays readable after the toast has gone.
    expect(await screen.findByText('Stopped')).toBeInTheDocument();
    expect(await screen.findAllByText(/The register could not be read/)).not.toHaveLength(0);
  });

  /* Both halves, because they fail independently and did: the students were
     being told while their teachers were not, and a summary saying only
     "mailed" would have read as though both had gone. */
  it('says who was mailed once it is done — students and faculty', async () => {
    adminRosterSyncRunStatus.mockResolvedValue(
      finishedRun({ added: 38, failed: 0, studentsMailed: 36, facultyMailed: 2 }),
    );
    await renderPage();

    await userEvent.click(semesterButtonFor(/Add all/));

    expect(await screen.findByText(/36 students and 2 faculty were mailed/)).toBeInTheDocument();
  });

  it('warns when a faculty member could not be told, even with nothing else wrong', async () => {
    adminRosterSyncRunStatus.mockResolvedValue(
      finishedRun({ added: 38, failed: 0, studentsMailed: 38, facultyMailed: 0, facultyUnreachable: 1 }),
    );
    await renderPage();

    await userEvent.click(semesterButtonFor(/Add all/));

    expect(await screen.findByText(/1 faculty could not be told/)).toBeInTheDocument();
  });
});

/**
 * One table, semester by semester.
 *
 * The page used to show what matched in one table and what did not in another,
 * so "what is the state of my fifth semester?" could only be answered by
 * reading both and matching them up by eye. A classroom that matched nothing is
 * not a different kind of thing; it is one of that semester's classrooms with a
 * remark against it.
 */
describe('reading a semester', () => {
  it('puts each semester under its own heading', async () => {
    await renderPage(
      preview([entry(), entry({ classId: 'c2', className: 'Databases', semester: 'B.Tech-3' })]),
    );

    expect(screen.getByRole('heading', { name: 'B.Tech-3' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'B.Tech-5' })).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(2);
  });

  /* "B.Tech-10" sorts between 1 and 2 as text, which is exactly the range a
     list of semesters covers. */
  it('orders the headings by semester number', async () => {
    await renderPage(
      preview([
        entry({ classId: 'a', className: 'Ten', semester: 'B.Tech-10' }),
        entry({ classId: 'b', className: 'Two', semester: 'B.Tech-2' }),
      ]),
    );

    const headings = screen.getAllByRole('heading', { name: /B\.Tech-/ }).map((h) => h.textContent);
    expect(headings).toEqual(['B.Tech-2', 'B.Tech-10']);
  });

  it('lists a classroom that matched nothing beside the ones that did', async () => {
    await renderPage(
      preview(
        [entry()],
        [
          {
            classId: 'c9',
            className: 'Compilers',
            subject: 'Compilers',
            dept: 'CSE',
            semester: 'B.Tech-5',
            reason: '2 attendance subjects match this class — nothing was added',
          },
        ],
      ),
    );

    // One table, holding both.
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(within(classTable()).getAllByRole('row')).toHaveLength(3); // header + both
    expect(within(classTable()).getAllByText('Compilers').length).toBeGreaterThan(0);
    expect(screen.getByText(/2 attendance subjects match this class/)).toBeInTheDocument();
  });

  /* A dash, not a zero. A zero would say the register is empty, which is a
     different fact and one somebody would go looking for in the wrong place. */
  it('counts nothing for a classroom with no subject to count', async () => {
    await renderPage(
      preview([], [{ classId: 'c9', className: 'Compilers', semester: 'B.Tech-5', reason: 'no subject' }]),
    );

    const row = within(classTable()).getAllByRole('row')[1];
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });

  it('says on the row itself why there is nothing to add', async () => {
    await renderPage(preview([entry({ wouldAdd: 0, alreadyIn: 60, missingEmailCount: 0 })]));

    expect(
      within(classTable()).getByText(/Everybody on the register is already in/),
    ).toBeInTheDocument();
  });

  it('names the students it cannot reach in the same remark', async () => {
    await renderPage();

    expect(within(classTable()).getByText(/2 have no address on record/)).toBeInTheDocument();
  });

  /* Left alone on purpose — somebody took them out of this class, and putting
     them back quietly is the one thing this feature must never do. Saying so is
     how that decision stays visible. */
  it('says when somebody was removed earlier and is being left alone', async () => {
    await renderPage(
      preview([entry({ previouslyRemoved: [{ rollNo: '21103009', name: 'E' }] })]),
    );

    expect(within(classTable()).getByText(/1 removed earlier, left alone/)).toBeInTheDocument();
  });
});

/**
 * Opening on one department.
 *
 * Planning the whole institute compares every class against every subject and
 * then reads a roster and a membership list per match. It is minutes of work,
 * and the page used to ask for it simply by being opened — which is what made
 * it hang. It now opens on a single department, and the institute-wide read is
 * a choice somebody makes.
 */
describe('what the page asks for when it opens', () => {
  it('plans one department, not the institute', async () => {
    await renderPage();

    expect(adminRosterSyncPreview).toHaveBeenCalledTimes(1);
    expect(adminRosterSyncPreview.mock.calls[0][0]).toMatchObject({ dept: 'CSE' });
  });

  /* The whole reason the options are their own read: to open on a department
     the page has to know the departments, and asking the plan for that would
     run the thing being avoided. */
  it('reads the departments without planning anything first', async () => {
    adminRosterSyncPreview.mockImplementation(() => new Promise(() => {}));
    const { default: LmAdminRosterSync } = await import('../pages/LmAdminRosterSync');
    renderWithProviders(<LmAdminRosterSync />);

    await waitFor(() => expect(adminRosterSyncOptions).toHaveBeenCalledTimes(1));
    // Nothing to narrow by yet: which department to open on is what this asks.
    expect(adminRosterSyncOptions.mock.calls[0][0]).toEqual({});
  });

  /* The semesters belong to the department. "Semester 1" of a B.Tech and of an
     M.Tech are different semesters holding different subjects, so the list is
     asked for again once there is a department to ask about — otherwise the
     dropdown offers every degree in the institute, nearly all of them options
     that cannot match one class in the department being looked at. */
  it('asks again for the semesters once it knows the department', async () => {
    await renderPage();

    await waitFor(() =>
      expect(adminRosterSyncOptions).toHaveBeenCalledWith({ dept: 'CSE' }),
    );
  });

  /* No blank choice at all, so the expensive read cannot be reached by
     clearing a dropdown. */
  it('offers no empty department, only real ones and an explicit all', async () => {
    await renderPage();

    const values = within(screen.getByLabelText('Department'))
      .getAllByRole('option')
      .map((option) => option.value);

    expect(values).not.toContain('');
    expect(values.slice(0, 2)).toEqual(['CSE', 'ECE']);
  });

  it('names what the institute-wide read costs', async () => {
    await renderPage();
    expect(screen.getByRole('option', { name: /Every department \(slow\)/ })).toBeInTheDocument();
  });

  /* Blank is what the server reads as "everything" — the same thing the admin
     console's own card sends — so choosing it must send no department at all. */
  it('drops the department entirely when every department is chosen', async () => {
    await renderPage();
    adminRosterSyncPreview.mockClear();

    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Every department (slow)');

    await waitFor(() => expect(adminRosterSyncPreview).toHaveBeenCalled());
    expect(adminRosterSyncPreview.mock.calls[0][0].dept).toBeUndefined();
  });
});

describe('the semester list', () => {
  /**
   * Read from the server, spelled as the timetable's master list spells it.
   *
   * Not collected from the rows in view, which was the first attempt: those are
   * already narrowed by the semester filter, so the list lost every other
   * option the moment one was picked — including the one that had to clear it.
   */
  it('offers the semesters the server gave it', async () => {
    await renderPage();

    const options = within(screen.getByLabelText('Filter by semester'))
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(options).toContain('B.Tech-3');
    expect(options).toContain('B.Tech-5');
  });

  it('keeps every semester after one is chosen', async () => {
    await renderPage();

    await userEvent.selectOptions(screen.getByLabelText('Filter by semester'), 'B.Tech-5');

    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Filter by semester')).getAllByRole('option'),
      ).toHaveLength(3),
    );
  });

  /* A semester the new department does not teach filters to nothing and reads
     as "no classrooms here", which is a different thing from the truth. */
  it('drops a chosen semester the next department does not teach', async () => {
    await renderPage();
    await userEvent.selectOptions(screen.getByLabelText('Filter by semester'), 'B.Tech-5');

    adminRosterSyncOptions.mockResolvedValue({ departments: ['CSE', 'ECE'], semesters: ['M.Tech-1'] });
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'ECE');

    await waitFor(() =>
      expect(screen.getByLabelText('Filter by semester')).toHaveValue(''));
  });
});

describe('the filters', () => {
  it('re-reads the plan when one changes', async () => {
    await renderPage();
    adminRosterSyncPreview.mockClear();

    await userEvent.selectOptions(screen.getByLabelText('Filter by semester'), 'B.Tech-5');

    await waitFor(() =>
      expect(adminRosterSyncPreview).toHaveBeenCalledWith({ dept: 'CSE', semester: 'B.Tech-5' }));
  });
});
