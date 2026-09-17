import { expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

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
    students: [],
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
