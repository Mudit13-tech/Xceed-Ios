import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * What the publish dialog opens holding, and what its main button therefore
 * says.
 *
 * Two defects found while recording the Quizzes teacher videos, both hit rather
 * than read:
 *
 *  - Step 1 was seeded with `now`, so a first publish was always made through a
 *    button reading "Schedule & get link" — for a paper the server then
 *    published immediately, because it drops a publish time that is not in the
 *    future. Label and behaviour disagreed in the direction that matters: a
 *    teacher who wanted Friday's paper scheduled pressed Schedule and published
 *    to the class.
 *
 *  - Step 2 was seeded from the paper's stored start time even when that had
 *    already passed. Unpublish a paper to fix a typo, reopen Publish, and the
 *    stale start sat before the new publish moment: the ordering check fired and
 *    the footer was disabled, with no way out but noticing a field nobody had
 *    touched.
 */

const publishQuiz = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    publishQuiz: (...args) => publishQuiz(...args),
  },
}));

const HOUR = 60 * 60 * 1000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

const quiz = (overrides = {}) => ({
  _id: 'q1',
  title: 'Midterm',
  published: false,
  settings: {},
  ...overrides,
});

const open = async (q = quiz()) => {
  const { default: PublishQuizModal } = await import('../components/PublishQuizModal');
  return renderWithProviders(
    <PublishQuizModal isOpen onClose={() => {}} quiz={q} classId="c1" onPublished={() => {}} />,
  );
};

/** The two other questions the footer waits on, so a disabled button is ours. */
const answerTheRest = () => {
  fireEvent.click(screen.getByText('As each student submits'));
  fireEvent.click(screen.getByText('No room code'));
};

const publishButton = () => screen.getByRole('button', { name: /get link/i });

// Step 1 first, then step 2 — the order they are rendered in for a paper that
// has never been published. Queried off the document rather than the render
// container: Chakra's Modal renders through a portal, so the container is empty.
const dateInputs = () => document.querySelectorAll('input[type="datetime-local"]');

beforeEach(() => {
  vi.clearAllMocks();
  publishQuiz.mockResolvedValue({ link: '/learning/class/c1/quiz/q1', roomCode: '' });
});

describe('a paper that has never been published', () => {
  it('opens with the publish time empty, which is what "publish now" looks like', async () => {
    await open();

    expect(dateInputs()[0].value).toBe('');
    expect(screen.getByText('✓ Publishing now')).toBeTruthy();
    expect(screen.getByText(/Empty means now/i)).toBeTruthy();
  });

  it('names the action it will actually take', async () => {
    await open();

    expect(publishButton().textContent).toBe('Publish now & get link');
  });

  it('sends no publish time, so the class sees it straight away', async () => {
    await open();
    answerTheRest();

    fireEvent.click(publishButton());

    expect(publishQuiz).toHaveBeenCalledTimes(1);
    expect(publishQuiz.mock.calls[0][2]).toMatchObject({ publish: true, publishAt: null });
  });

  it('still schedules when a teacher types a date, and says so', async () => {
    await open();
    answerTheRest();

    const pad = (n) => String(n).padStart(2, '0');
    const localInput = (offsetMs) => {
      const d = new Date(Date.now() + offsetMs);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const local = localInput(48 * HOUR);
    fireEvent.change(dateInputs()[0], { target: { value: local } });
    // The start has to move with it. A link that goes live on Friday and a
    // Start button that unlocks in five minutes is genuinely out of order, and
    // the dialog is right to refuse it — so push the start past the publish.
    fireEvent.change(dateInputs()[1], { target: { value: localInput(49 * HOUR) } });

    expect(publishButton().textContent).toBe('Schedule & get link');
    expect(publishButton()).not.toBeDisabled();

    fireEvent.click(publishButton());
    expect(publishQuiz.mock.calls[0][2].publishAt).toBe(new Date(local).toISOString());
  });
});

describe('a paper that was published and then unpublished', () => {
  const unpublishedAfterRunning = quiz({
    published: false,
    announcedAt: iso(-72 * HOUR),
    settings: { availableFrom: iso(-48 * HOUR), availableTo: iso(-47 * HOUR) },
  });

  it('can be published again without editing a field nobody touched', async () => {
    await open(unpublishedAfterRunning);
    answerTheRest();

    expect(publishButton()).not.toBeDisabled();
  });

  it('clears the start time that has already gone by, rather than carrying it', async () => {
    await open(unpublishedAfterRunning);

    // Blank reads as "straight away", which is what a start time in the past
    // means in practice — and is what the field's own helper text describes.
    expect(dateInputs()[1].value).toBe('');
    expect(screen.getByText(/Leave blank to let them start straight away/i)).toBeTruthy();
  });

  it('keeps a start time that is still in the future', async () => {
    await open(
      quiz({ published: false, announcedAt: iso(-72 * HOUR), settings: { availableFrom: iso(24 * HOUR) } }),
    );

    expect(dateInputs()[1].value).not.toBe('');
  });
});

describe('a paper that is live', () => {
  it('keeps its stored start time, stale or not — it is ordered against its own publish moment', async () => {
    await open(
      quiz({
        published: true,
        announcedAt: iso(-72 * HOUR),
        settings: { availableFrom: iso(-48 * HOUR) },
      }),
    );

    // Step 1 is not rendered for a live paper, so the first date box is the
    // start time.
    expect(dateInputs()[0].value).not.toBe('');
  });
});
