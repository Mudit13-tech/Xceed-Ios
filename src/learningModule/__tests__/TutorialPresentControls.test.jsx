import { expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The live board's controls respond at once: opening a question shows it is
 * working and cannot be double-tapped into skipping one, and a hint switch moves
 * as soon as it is flipped without locking the other controls.
 */

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ tutorialId: 't1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: true }),
  };
});

const question = (index) => ({
  index,
  prompt: `<p>Question number ${index + 1}.</p>`,
  parts: [],
  variables: [],
  answers: [],
  hint: '<p>Think about it.</p>',
  solution: '',
  partCount: 0,
  slotCount: 1,
  hasHint: true,
});

// A stable module-level frame: a fresh object per render would spin the stream
// hook's "react to a new frame" effect forever.
const STREAM_RESULT = {
  state: {
    revision: 1,
    status: 'live',
    title: 'Circuits',
    openedCount: 1,
    questionCount: 2,
    participantCount: 0,
    hints: [false, false],
    // Only the students who joined this session; the server sends no one else.
    students: [
      { studentId: 's1', name: 'Asha', status: 'in_progress', perQuestion: [], totalCorrect: 0, totalSlots: 1 },
      { studentId: 's2', name: 'Ben', status: 'submitted', perQuestion: [], totalCorrect: 1, totalSlots: 1 },
    ],
    // Chen sat this tutorial with another section, so on this board they are
    // simply somebody who has not joined — as is Dev, who has never opened it.
    notJoined: [
      { studentId: 's3', name: 'Chen' },
      { studentId: 's4', name: 'Dev' },
    ],
    questions: [question(0), question(1)],
  },
  connection: 'live',
  error: '',
  merge: () => {},
};
vi.mock('../hooks/useShortStream', () => ({
  default: () => STREAM_RESULT,
}));

const presentTutorial = vi.fn();
const controlTutorialSession = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    presentTutorial: (...a) => presentTutorial(...a),
    tutorialPresenterStreamUrl: () => 'https://example.test/present/stream',
    tutorialSessionState: vi.fn(),
    controlTutorialSession: (...a) => controlTutorialSession(...a),
    endTutorialSession: vi.fn(),
  },
}));

let TutorialPresent;

beforeEach(async () => {
  vi.clearAllMocks();
  presentTutorial.mockResolvedValue({ session: { sessionId: 's1' } });
  ({ default: TutorialPresent } = await import('../pages/TutorialPresent'));
});

it('opens the next question once, however often it is tapped while in flight', async () => {
  let finish;
  controlTutorialSession.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  renderWithProviders(<TutorialPresent />);

  const button = await screen.findByRole('button', { name: /open next question \(Q2\)/i });
  fireEvent.click(button);
  fireEvent.click(button);

  expect(controlTutorialSession).toHaveBeenCalledTimes(1);
  expect(controlTutorialSession).toHaveBeenCalledWith('c1', 's1', { action: 'openNext' });

  await act(async () => finish({ session: STREAM_RESULT.state }));
});

it('moves a hint switch straight away and leaves the other switches usable', async () => {
  controlTutorialSession.mockReturnValue(new Promise(() => {}));
  renderWithProviders(<TutorialPresent />);

  const first = await screen.findByRole('checkbox', { name: /hint for question 1/i });
  const second = screen.getByRole('checkbox', { name: /hint for question 2/i });
  fireEvent.click(first);

  await waitFor(() => expect(first).toBeChecked());
  expect(controlTutorialSession).toHaveBeenCalledWith('c1', 's1', { action: 'setHint', index: 0, on: true });
  expect(second).not.toBeDisabled();
  expect(screen.getByRole('button', { name: /open next question/i })).not.toBeDisabled();
});

it('opens every remaining question at once after a confirmation', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  controlTutorialSession.mockResolvedValue({ session: STREAM_RESULT.state });
  renderWithProviders(<TutorialPresent />);

  fireEvent.click(await screen.findByRole('button', { name: /open all questions/i }));

  expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/open all 1 remaining question/i));
  await waitFor(() =>
    expect(controlTutorialSession).toHaveBeenCalledWith('c1', 's1', { action: 'openAll' }),
  );
});

it('gives a progress row to the students who joined, and only to them', async () => {
  renderWithProviders(<TutorialPresent />);

  const row = async (name) => within((await screen.findByText(name)).closest('tr'));
  expect((await row('Asha')).getByText('Working')).toBeInTheDocument();
  expect((await row('Ben')).getByText('Finished')).toBeInTheDocument();
  expect(screen.getByText('1 working · 1 finished')).toBeInTheDocument();
  expect(screen.getByRole('table').textContent).not.toMatch(/Chen|Dev/);
});

it('names the students who have not joined, under the board', async () => {
  renderWithProviders(<TutorialPresent />);

  // Still on the screen while there is time to chase them — they can only
  // start the tutorial while the session is running — just not as progress.
  expect(await screen.findByText(/2 students have not joined/i)).toBeInTheDocument();
  expect(screen.getByText('Chen')).toBeInTheDocument();
  expect(screen.getByText('Dev')).toBeInTheDocument();
  expect(screen.getByText('Chen').closest('tr')).toBeNull();
});
