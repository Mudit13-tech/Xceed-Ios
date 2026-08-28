import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * Asking for the room code where the decision actually gets made.
 *
 * The room code is the check that the person sitting the paper is in the room
 * being invigilated — the invigilator reads it out, and a friend elsewhere never
 * hears it. It existed only as a button on the quiz card, which made it a thing
 * a teacher had to remember about; the moment they remember is the moment the
 * hall has already started, and by then the paper has gone out without it.
 *
 * Publishing is where every other decision about how the paper is sat is made,
 * so the question is asked there, it has to be answered before the link exists,
 * and the code that comes back is put in front of the teacher to read out.
 */

const publishQuiz = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    publishQuiz: (...args) => publishQuiz(...args),
  },
}));

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

// Everything but the room code answered, so a disabled Publish button can only
// be the room-code question.
const answerTheRest = () => {
  fireEvent.click(screen.getByText('As each student submits'));
};

beforeEach(() => {
  vi.clearAllMocks();
  publishQuiz.mockResolvedValue({ link: '/learning/class/c1/quiz/q1', roomCode: '' });
});

describe('the question', () => {
  it('is asked, unanswered, on a paper that has never been published', async () => {
    await open();

    expect(await screen.findByText('Room code')).toBeTruthy();
    expect(screen.getByText('Require a room code')).toBeTruthy();
    expect(screen.getByText('No room code')).toBeTruthy();
  });

  it('will not let the paper be published until it is answered', async () => {
    await open();
    answerTheRest();

    const publish = screen.getByRole('button', { name: /get link/i });
    expect(publish).toBeDisabled();
    expect(screen.getByText(/choose whether this paper needs a room code/i)).toBeTruthy();

    fireEvent.click(screen.getByText('No room code'));
    await waitFor(() => expect(publish).not.toBeDisabled());
  });

  it('comes pre-answered on a paper that already has a code', async () => {
    // Answered once already; a re-save should not re-ask it. The quiz list
    // serialises the student-facing settings, so all that survives is the flag.
    await open(quiz({ published: true, settings: { roomCodeRequired: true } }));

    await screen.findByText('Room code');
    expect(screen.queryByText(/choose whether this paper needs a room code/i)).toBeNull();
  });
});

describe('what publishing sends', () => {
  it('asks the server to mint one — never picks a code itself', async () => {
    await open();
    answerTheRest();
    fireEvent.click(screen.getByText('Require a room code'));
    fireEvent.click(screen.getByRole('button', { name: /get link/i }));

    await waitFor(() =>
      expect(publishQuiz).toHaveBeenCalledWith('c1', 'q1', expect.objectContaining({ roomCode: 'generate' })),
    );
  });

  it('clears the code when the teacher says no room code', async () => {
    await open();
    answerTheRest();
    fireEvent.click(screen.getByText('No room code'));
    fireEvent.click(screen.getByRole('button', { name: /get link/i }));

    await waitFor(() =>
      expect(publishQuiz).toHaveBeenCalledWith('c1', 'q1', expect.objectContaining({ roomCode: 'none' })),
    );
  });

  it('leaves an existing code alone on a re-save, rather than silently replacing it', async () => {
    // The trap this closes: a teacher fixing the closing time would otherwise
    // retire the code they had already read out to the hall.
    await open(quiz({ published: true, settings: { roomCodeRequired: true, resultReleaseAt: null } }));
    answerTheRest();
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(publishQuiz).toHaveBeenCalled());
    expect(publishQuiz.mock.calls[0][2]).not.toHaveProperty('roomCode');
  });

  it('replaces it only when the teacher asks for a new one', async () => {
    await open(quiz({ published: true, settings: { roomCodeRequired: true } }));
    answerTheRest();
    fireEvent.click(screen.getByText(/generate a new code, retiring the current one/i));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(publishQuiz).toHaveBeenCalledWith('c1', 'q1', expect.objectContaining({ roomCode: 'generate' })),
    );
  });
});

describe('the code that comes back', () => {
  it('is shown in the clear, to be read out', async () => {
    publishQuiz.mockResolvedValue({ link: '/learning/class/c1/quiz/q1', roomCode: 'K7PQR' });
    await open();
    answerTheRest();
    fireEvent.click(screen.getByText('Require a room code'));
    fireEvent.click(screen.getByRole('button', { name: /get link/i }));

    expect(await screen.findByText('K7PQR')).toBeTruthy();
    expect(screen.getByText(/read this out to the hall/i)).toBeTruthy();
  });

  it('is absent when the teacher chose not to have one', async () => {
    await open();
    answerTheRest();
    fireEvent.click(screen.getByText('No room code'));
    fireEvent.click(screen.getByRole('button', { name: /get link/i }));

    await screen.findByText(/share this link/i);
    expect(screen.queryByText(/read this out to the hall/i)).toBeNull();
  });
});
