import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * "Show question" on the live control panel.
 *
 * The teacher presenting has no paper in front of them, so this panel is the
 * whole question: prompt, answer key, and — the part this covers — the worked
 * solution's explanation of how you get from one to the other. Without it the
 * teacher can read out the formula but not the reasoning behind it.
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

// A stable module-level frame: a fresh object per render would spin the stream
// hook's "react to a new frame" effect forever.
const STREAM_RESULT = {
  state: {
    revision: 1,
    status: 'live',
    openedCount: 1,
    questionCount: 1,
    participantCount: 0,
    students: [],
    questions: [
      {
        index: 0,
        prompt: '<p>Find the power dissipated by the resistor.</p>',
        parts: [],
        variables: [],
        answers: [{ key: 'P', label: 'Power', formula: 'I^2*R', unit: 'W', marks: 2, decimals: 2 }],
        hint: '',
        solution: '<p>Power is current squared times resistance, so P = I²R.</p>',
        partCount: 0,
        slotCount: 1,
        hasHint: false,
      },
    ],
  },
  connection: 'live',
  error: '',
  merge: () => {},
};
vi.mock('../hooks/useShortStream', () => ({
  default: () => STREAM_RESULT,
}));

const presentTutorial = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    presentTutorial: (...a) => presentTutorial(...a),
    tutorialPresenterStreamUrl: () => 'https://example.test/present/stream',
    tutorialSessionState: vi.fn(),
    controlTutorialSession: vi.fn(),
    endTutorialSession: vi.fn(),
  },
}));

let TutorialPresent;

beforeEach(async () => {
  vi.clearAllMocks();
  presentTutorial.mockResolvedValue({ session: { sessionId: 's1' } });
  ({ default: TutorialPresent } = await import('../pages/TutorialPresent'));
});

describe('TutorialPresent — Show question', () => {
  it('reveals the worked solution alongside the answer key', async () => {
    renderWithProviders(<TutorialPresent />);

    const toggle = await screen.findByRole('button', { name: /show question/i });
    fireEvent.click(toggle);

    // The panel is open — the toggle now offers to close it again.
    expect(await screen.findByRole('button', { name: /hide question/i })).toBeInTheDocument();
    expect(screen.getByText('Answer key')).toBeInTheDocument();
    expect(screen.getByText('Worked solution')).toBeInTheDocument();
    expect(screen.getByText(/current squared times resistance/i)).toBeInTheDocument();
  });
});
