import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import QuizPreviewPage from '../pages/QuizPreviewPage';
import lmApi from '../api/lmApi';

vi.mock('../api/lmApi', () => ({
  default: {
    getQuiz: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ classId: 'c123', isTeacher: true }),
    useParams: () => ({ quizId: 'q456' }),
    useNavigate: () => vi.fn(),
  };
});

const sampleQuiz = {
  _id: 'q456',
  title: 'Quantum Mechanics Midterm',
  description: 'Full screen test preview',
  questions: [
    {
      _id: 'q1',
      question: '<p>What is Planck constant approx?</p>',
      type: 'mcq',
      options: ['6.626x10^-34 J s', '3x10^8 m/s', '9.8 m/s^2'],
      correctAnswers: [0],
      marks: 5,
      difficulty: 'hard',
      explanation: 'h is approx 6.626x10^-34 J s.',
    },
    {
      _id: 'q2',
      question: '<p>Enter number of dimensions</p>',
      type: 'numerical',
      options: [],
      correctAnswers: ['3'],
      marks: 2,
    },
  ],
  sections: [],
  settings: {
    deliveryMode: 'all_at_once',
  },
};

describe('QuizPreviewPage', () => {
  it('loads quiz data and renders full screen student preview page', async () => {
    lmApi.getQuiz.mockResolvedValueOnce(sampleQuiz);

    renderWithProviders(<QuizPreviewPage />);

    expect(screen.getByText(/Loading quiz preview/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Quiz Preview: Quantum Mechanics Midterm/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Full Screen Student View Preview/i)).toBeInTheDocument();
    expect(screen.getByText(/What is Planck constant approx\?/i)).toBeInTheDocument();
    expect(screen.getByText('6.626x10^-34 J s')).toBeInTheDocument();
  });

  it('switches delivery mode and toggles answer key on the page', async () => {
    lmApi.getQuiz.mockResolvedValueOnce(sampleQuiz);

    renderWithProviders(<QuizPreviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/Quiz Preview: Quantum Mechanics Midterm/i)).toBeInTheDocument();
    });

    // Explanation hidden by default
    expect(screen.queryByText(/h is approx 6.626x10\^-34 J s/i)).not.toBeInTheDocument();

    // Toggle Answer Key
    const switchEl = screen.getByLabelText(/Show answer key & explanations/i);
    fireEvent.click(switchEl);

    expect(screen.getByText(/h is approx 6.626x10\^-34 J s/i)).toBeInTheDocument();

    // Switch to 'One at a time'
    const seqBtn = screen.getByRole('button', { name: /1️⃣ One at a time/i });
    fireEvent.click(seqBtn);

    expect(screen.getByText(/Question 1 of 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/Enter number of dimensions/i)).not.toBeInTheDocument();

    // Advance to question 2
    const nextBtn = screen.getByRole('button', { name: /Next →/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Question 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter number of dimensions/i)).toBeInTheDocument();
  });
});
