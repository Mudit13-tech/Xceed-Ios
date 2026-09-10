import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * A student answering the multiple-choice and multiple-answer questions a
 * tutorial can now hold. The attempt below is the shape `attemptForStudent`
 * sends (pinned server-side in learningModuleTutorialChoiceDelivery.test.js):
 * the options arrive as rich text on the question, with one answer slot keyed
 * "answer".
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
vi.mock('../api/lmApi', () => ({
  default: {
    getTutorial: (...a) => getTutorial(...a),
    myTutorialAttempt: (...a) => myTutorialAttempt(...a),
    saveTutorialAttempt: vi.fn().mockResolvedValue({}),
    submitTutorialAttempt: (...a) => submitTutorialAttempt(...a),
    checkTutorialAnswer: vi.fn(),
  },
}));

const slot = (marks) => ({ key: 'answer', label: 'Answer', unit: '', marks, partIndex: null, partLabel: '', decimals: null });

const attempt = (overrides = {}) => ({
  _id: 'att1',
  attemptNumber: 1,
  status: 'in_progress',
  score: 0,
  maxScore: 5,
  percent: 0,
  passed: null,
  instantFeedback: false,
  questions: [
    {
      questionId: 'q1',
      type: 'mcq',
      options: ['<p>Volt</p>', '<p>Ohm</p>', '<p>Amp</p>'],
      values: {},
      prompt: '<p>Unit of resistance?</p>',
      parts: [],
      hint: '',
      answers: [slot(2)],
    },
    {
      questionId: 'q2',
      type: 'msq',
      options: ['<p>metre</p>', '<p>newton</p>', '<p>kelvin</p>'],
      values: {},
      prompt: '<p>Which are SI base units?</p>',
      parts: [],
      hint: '',
      answers: [slot(3)],
    },
  ],
  responses: [],
  ...overrides,
});

const load = async () => {
  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);
  await waitFor(() => expect(screen.getByText('Unit of resistance?')).toBeInTheDocument());
};

const submit = async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent.click(screen.getAllByRole('button', { name: /submit/i })[0]);
  await waitFor(() => expect(submitTutorialAttempt).toHaveBeenCalled());
  return submitTutorialAttempt.mock.calls.at(-1)[2];
};

describe('a student answering choice questions in a tutorial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTutorial.mockResolvedValue({ _id: 't1', title: 'Units', description: '', settings: {} });
    submitTutorialAttempt.mockResolvedValue({ attempt: attempt({ status: 'submitted' }) });
  });

  it('shows every option, lettered, with radio buttons or checkboxes by type', async () => {
    myTutorialAttempt.mockResolvedValue({ attempt: attempt(), attemptsUsed: 1, attemptsAllowed: 0 });
    await load();

    ['Volt', 'Ohm', 'Amp', 'metre', 'newton', 'kelvin'].forEach((text) =>
      expect(screen.getByText(text)).toBeInTheDocument(),
    );
    expect(screen.getAllByText('B.')).toHaveLength(2);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);

    // The type is named on the question, so nobody has to guess one tick or many.
    expect(screen.getByText('Multiple choice')).toBeInTheDocument();
    expect(screen.getByText('Multiple answers')).toBeInTheDocument();

    // No typed box and no "your values" row: nothing is drawn for these.
    expect(screen.queryByPlaceholderText('Your answer')).not.toBeInTheDocument();
    expect(screen.queryByText('Your values:')).not.toBeInTheDocument();
  });

  it('submits the ticked options as indices', async () => {
    myTutorialAttempt.mockResolvedValue({ attempt: attempt(), attemptsUsed: 1, attemptsAllowed: 0 });
    await load();

    await userEvent.click(screen.getByText('Volt'));
    // A second pick replaces the first on a single-answer question.
    await userEvent.click(screen.getByText('Ohm'));
    await userEvent.click(screen.getByText('metre'));
    await userEvent.click(screen.getByText('kelvin'));

    const responses = await submit();
    expect(responses).toHaveLength(2);
    expect(responses).toEqual(
      expect.arrayContaining([
        { questionId: 'q1', answerKey: 'answer', selected: ['1'] },
        { questionId: 'q2', answerKey: 'answer', selected: ['0', '2'] },
      ]),
    );
  });

  it('brings back options ticked in a saved draft', async () => {
    myTutorialAttempt.mockResolvedValue({
      attempt: attempt({ responses: [{ questionId: 'q2', answerKey: 'answer', raw: 'A, C', selected: ['0', '2'] }] }),
      attemptsUsed: 1,
      attemptsAllowed: 0,
    });
    await load();

    const [metre, newton, kelvin] = screen.getAllByRole('checkbox');
    expect(metre).toBeChecked();
    expect(newton).not.toBeChecked();
    expect(kelvin).toBeChecked();
  });

  it('marks the right option once the key is released', async () => {
    const marked = attempt({
      status: 'submitted',
      questions: attempt().questions.map((question) => ({
        ...question,
        answers: [{ ...question.answers[0], correct: question.type === 'mcq' ? ['1'] : ['0', '2'] }],
      })),
      responses: [{ questionId: 'q1', answerKey: 'answer', raw: 'A', selected: ['0'], correct: false, awarded: 0 }],
    });
    myTutorialAttempt.mockResolvedValue({ attempt: marked, attemptsUsed: 1, attemptsAllowed: 0 });
    await load();

    // Ohm on the first question, metre and kelvin on the second.
    expect(screen.getAllByText('correct')).toHaveLength(3);
    // Their wrong pick is still shown as theirs.
    expect(screen.getAllByRole('radio')[0]).toBeChecked();
  });
});
