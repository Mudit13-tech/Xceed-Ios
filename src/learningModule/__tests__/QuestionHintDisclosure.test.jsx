import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * A hint is offered, not given.
 *
 * "Show hints" defaults on, and the hint used to be printed into the question
 * card the moment it opened. Whatever the teacher typed there — for most of
 * them, the method worked through — was therefore in front of every student
 * before they had tried anything, which is the paper explaining itself to
 * someone who came to answer it. It is still one press away.
 */

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ classId: 'c1', tutorialId: 't1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Circuits' }, isTeacher: false }),
  };
});

vi.mock('../hooks/useShortStream', () => ({
  default: () => ({ state: null, connection: 'live', error: '', merge: () => {} }),
}));

const getTutorial = vi.fn();
const myTutorialAttempt = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    getTutorial: (...a) => getTutorial(...a),
    myTutorialAttempt: (...a) => myTutorialAttempt(...a),
    saveTutorialAttempt: vi.fn(),
    checkTutorialAnswer: vi.fn(),
    submitTutorialAttempt: vi.fn(),
    tutorialLiveStreamUrl: () => null,
    tutorialLiveState: vi.fn(),
    addTutorialUploads: vi.fn(),
    removeTutorialUpload: vi.fn(),
  },
}));

const HINT = 'Use I = V/R, so the current is 10/5 = 2 A.';

const tutorial = { _id: 't1', title: 'Resistive Networks', description: '', settings: { dueDate: null } };

const sitting = (status = 'in_progress') => ({
  attempt: {
    _id: 'att1',
    attemptNumber: 1,
    status,
    score: 2,
    maxScore: 3,
    percent: 67,
    passed: null,
    instantFeedback: false,
    allowFileUpload: false,
    uploads: [],
    responses: [],
    teacherFeedback: '',
    live: null,
    questions: [
      {
        questionId: 'q1',
        open: true,
        prompt: '<p>Find the current.</p>',
        values: {},
        parts: [],
        hint: HINT,
        solution: '',
        answers: [{ key: 'i', label: 'Current', unit: 'A', marks: 3, partIndex: null, partLabel: '' }],
      },
    ],
  },
  attemptsUsed: 1,
  attemptsAllowed: 0,
});

const load = async () => {
  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);
  await waitFor(() => expect(screen.getByText('Resistive Networks')).toBeInTheDocument());
};

describe('a hint on a tutorial question', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTutorial.mockResolvedValue(tutorial);
  });

  it('is not on screen until the student asks for it', async () => {
    myTutorialAttempt.mockResolvedValue(sitting());
    await load();

    // Present but hidden, so the press has a region to name — and hidden is out
    // of the accessibility tree, not merely small or grey.
    expect(screen.getByText(HINT)).not.toBeVisible();
    expect(screen.getByRole('button', { name: /show hint/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('appears on the press, and the press says so', async () => {
    myTutorialAttempt.mockResolvedValue(sitting());
    await load();

    const toggle = screen.getByRole('button', { name: /show hint/i });
    await userEvent.click(toggle);

    expect(screen.getByText(HINT)).toBeVisible();
    const open = screen.getByRole('button', { name: /hide hint/i });
    expect(open).toHaveAttribute('aria-expanded', 'true');
    // The press names the region it opened, so a screen reader can be taken to it.
    expect(document.getElementById(open.getAttribute('aria-controls'))).toHaveTextContent(HINT);

    await userEvent.click(open);
    expect(screen.getByText(HINT)).not.toBeVisible();
  });

  it('is not offered at all once the paper is submitted', async () => {
    myTutorialAttempt.mockResolvedValue(sitting('submitted'));
    await load();

    expect(screen.queryByRole('button', { name: /show hint/i })).not.toBeInTheDocument();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});
