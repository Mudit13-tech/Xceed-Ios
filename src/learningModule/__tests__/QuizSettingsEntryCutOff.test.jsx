import { describe, expect, it, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * What the settings page says about when entry closes.
 *
 * The cut-off a teacher sets while publishing is stored as an absolute moment,
 * `settings.startDeadline`, and that is the field the exam engine reads first.
 * This page offered a box for the older relative spelling only —
 * `marginMinutes` — which is 0 on every quiz published through that dialog. So a
 * paper whose entry closed at 10:30 reported a flat 0 here, indistinguishable
 * from a paper anyone may join at any time, and saving the page wrote that 0
 * back over nothing at all.
 */

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ classId: 'c1', quizId: 'q1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: true }),
  };
});

const getQuiz = vi.fn();
const updateQuiz = vi.fn(async () => ({}));
vi.mock('../api/lmApi', () => ({
  default: {
    getQuiz: (...args) => getQuiz(...args),
    updateQuiz: (...args) => updateQuiz(...args),
    getSharedSebConfig: vi.fn(async () => ({ ready: false })),
    LmApiError: class LmApiError extends Error {},
  },
}));

const QuizEditor = (await import('../pages/QuizEditor')).default;

// 09:30 local, written the way `toLocalInput` renders it back into the field.
const CUT_OFF = new Date(2026, 8, 1, 9, 30);
const localValue = (date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const render = async (settings) => {
  getQuiz.mockResolvedValue({
    _id: 'q1',
    title: 'Midterm',
    description: '',
    instructions: [],
    sections: [],
    questions: [],
    collaborators: [],
    settings: {
      deliveryMode: 'all_at_once',
      perQuestionTiming: false,
      timeLimitMinutes: 45,
      defaultQuestionSec: 0,
      marginMinutes: 0,
      startDeadline: null,
      ...settings,
    },
    window: {},
    publish: {},
    canManage: true,
  });
  renderWithProviders(<QuizEditor mode="settings" />);
  await screen.findByText(/When students may sit it/i);
};

describe('the quiz settings page', () => {
  it('shows the cut-off that was set when the quiz was published', async () => {
    await render({ startDeadline: CUT_OFF.toISOString() });
    expect((await screen.findByLabelText(/Entry closes at/i)).value).toBe(localValue(CUT_OFF));
    // The legacy box stays out of the way: an absolute moment supersedes it, and
    // two boxes for one rule is how the 0 read as an answer in the first place.
    expect(screen.queryByLabelText(/Late-entry window/i)).toBeNull();
  });

  it('sends the cut-off back untouched when something else is saved', async () => {
    await render({ startDeadline: CUT_OFF.toISOString() });
    fireEvent.change(screen.getByLabelText(/Overall time limit/i), { target: { value: '60' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^Save$/ })[0]);
    await waitFor(() => expect(updateQuiz).toHaveBeenCalled());
    const sent = updateQuiz.mock.calls[0][2].settings;
    expect(sent.startDeadline).toBe(CUT_OFF.toISOString());
    expect(sent.timeLimitMinutes).toBe(60);
  });

  it('still offers the relative window to a quiz that only carries one', async () => {
    await render({ marginMinutes: 15 });
    expect(screen.getByLabelText(/Late-entry window/i).value).toBe('15');
  });
});
