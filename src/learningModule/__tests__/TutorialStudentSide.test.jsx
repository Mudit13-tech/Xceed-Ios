import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The student's side of a parameterised tutorial, after the authoring changes.
 *
 * Everything the teacher gained has a student-facing consequence, and each one
 * is a way the paper could have broken:
 *
 * - a data table is rendered into the prompt HTML, so it has to survive the
 *   sanitiser and appear as a real table;
 * - the required precision has to reach them *before* they submit;
 * - sub-questions are no longer auto-lettered, so an unlabelled part must not
 *   render a stray empty label;
 * - a tutorial with no pass mark must not tell them they failed;
 * - unlimited attempts must not read as "0 attempts left".
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

const getTutorial = vi.fn();
const myTutorialAttempt = vi.fn();
const submitTutorialAttempt = vi.fn();
const saveTutorialAttempt = vi.fn().mockResolvedValue({});
vi.mock('../api/lmApi', () => ({
  default: {
    getTutorial: (...a) => getTutorial(...a),
    myTutorialAttempt: (...a) => myTutorialAttempt(...a),
    saveTutorialAttempt: (...a) => saveTutorialAttempt(...a),
    submitTutorialAttempt: (...a) => submitTutorialAttempt(...a),
    checkTutorialAnswer: vi.fn(),
  },
}));

const tutorial = {
  _id: 't1',
  title: 'Resistive Networks',
  description: '',
  settings: { dueDate: null },
};

/** A paper as the server actually hands it over: prompt HTML already rendered. */
const attempt = (overrides = {}) => ({
  _id: 'att1',
  attemptNumber: 1,
  status: 'in_progress',
  score: 0,
  maxScore: 3,
  percent: 0,
  passed: null,
  instantFeedback: false,
  questions: [
    {
      questionId: 'q1',
      values: { R: 7, I: 2 },
      // The table is substituted into the prompt at generation time.
      prompt:
        '<p>From <table><caption>Given values</caption><thead><tr><th>Item</th><th>Value</th></tr></thead>' +
        '<tbody><tr><td>R</td><td>7 ohm</td></tr><tr><td>I</td><td>2 A</td></tr></tbody></table>' +
        ' find the power.</p>',
      // An unlabelled sub-question: no auto-lettering any more.
      parts: [{ label: '', prompt: 'Find the power dissipated.' }],
      hint: '',
      answers: [
        {
          key: 'p',
          label: 'Power',
          unit: 'W',
          marks: 3,
          partIndex: 0,
          partLabel: '',
          decimals: 2,
        },
      ],
    },
  ],
  responses: [],
  ...overrides,
});

const load = async () => {
  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);
  await waitFor(() => expect(screen.getByText('Resistive Networks')).toBeInTheDocument());
};

describe('a student sitting a tutorial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTutorial.mockResolvedValue(tutorial);
  });

  it('shows the data table as a real table, with their own numbers in it', async () => {
    myTutorialAttempt.mockResolvedValue({ attempt: attempt(), attemptsUsed: 1, attemptsAllowed: 0 });
    await load();

    // Survives the sanitiser as a table, not as escaped text or a flattened run
    // of paragraphs.
    expect(screen.getByText('Given values').tagName).toBe('CAPTION');
    expect(screen.getByText('Item').tagName).toBe('TH');
    expect(screen.getByText('7 ohm').tagName).toBe('TD');
    expect(screen.getByText('2 A').tagName).toBe('TD');
  });

  it('tells them the precision to give before they submit', async () => {
    myTutorialAttempt.mockResolvedValue({ attempt: attempt(), attemptsUsed: 1, attemptsAllowed: 0 });
    await load();
    expect(screen.getByText(/give your answer to 2 decimal places/i)).toBeInTheDocument();
  });

  it('does not print an empty label for an unlabelled sub-question', async () => {
    myTutorialAttempt.mockResolvedValue({ attempt: attempt(), attemptsUsed: 1, attemptsAllowed: 0 });
    await load();

    const partPrompt = screen.getByText('Find the power dissipated.');
    expect(partPrompt).toBeInTheDocument();
    // The label slot is a 30px-wide purple heading. With no label there should
    // be no such element at all, rather than a blank gutter.
    expect(screen.queryByText('(a)')).not.toBeInTheDocument();
  });

  it('reads "Attempt 1" rather than "Attempt 1 of 0" when attempts are unlimited', async () => {
    myTutorialAttempt.mockResolvedValue({ attempt: attempt(), attemptsUsed: 1, attemptsAllowed: 0 });
    await load();
    expect(screen.getByText(/Attempt 1$/)).toBeInTheDocument();
    expect(screen.queryByText(/of 0/)).not.toBeInTheDocument();
  });

  it('accepts an answer and submits it', async () => {
    myTutorialAttempt.mockResolvedValue({ attempt: attempt(), attemptsUsed: 1, attemptsAllowed: 0 });
    submitTutorialAttempt.mockResolvedValue({
      attempt: attempt({
        status: 'submitted',
        score: 3,
        percent: 100,
        passed: null,
        responses: [{ questionId: 'q1', answerKey: 'p', raw: '28', correct: true, awarded: 3 }],
      }),
    });
    await load();

    // Submitting is guarded by a native confirm; the student saying yes is the
    // path under test.
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await userEvent.type(screen.getByPlaceholderText('Your answer'), '28');
    // Two buttons match: the header's and the one at the foot of the paper.
    await userEvent.click(screen.getAllByRole('button', { name: /submit/i })[0]);

    await waitFor(() => expect(submitTutorialAttempt).toHaveBeenCalled());
    const [, , responses] = submitTutorialAttempt.mock.calls.at(-1);
    expect(responses).toEqual([{ questionId: 'q1', answerKey: 'p', raw: '28' }]);
  });

  it('says nothing about passing when the tutorial has no pass mark', async () => {
    myTutorialAttempt.mockResolvedValue({
      attempt: attempt({ status: 'submitted', score: 3, percent: 100, passed: null }),
      attemptsUsed: 1,
      attemptsAllowed: 0,
    });
    await load();

    expect(screen.getByText('3/3')).toBeInTheDocument();
    // A tutorial with no bar to clear must not render a verdict against one.
    expect(screen.queryByText('Not passed')).not.toBeInTheDocument();
    expect(screen.queryByText('Passed')).not.toBeInTheDocument();
  });

  it('still shows the verdict when a pass mark was set', async () => {
    myTutorialAttempt.mockResolvedValue({
      attempt: attempt({ status: 'submitted', score: 0, percent: 0, passed: false }),
      attemptsUsed: 1,
      attemptsAllowed: 0,
    });
    await load();
    expect(screen.getByText('Not passed')).toBeInTheDocument();
  });

  it('shows the correct answer at the precision that was asked for', async () => {
    myTutorialAttempt.mockResolvedValue({
      attempt: attempt({
        status: 'submitted',
        score: 0,
        percent: 0,
        questions: [
          {
            ...attempt().questions[0],
            answers: [{ ...attempt().questions[0].answers[0], expected: 27.999999, decimals: 2 }],
          },
        ],
      }),
      attemptsUsed: 1,
      attemptsAllowed: 0,
    });
    await load();
    expect(screen.getByText('28.00')).toBeInTheDocument();
  });
});
