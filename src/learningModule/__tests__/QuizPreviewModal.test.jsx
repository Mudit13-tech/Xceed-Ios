import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import QuizPreviewModal from '../components/QuizPreviewModal';

const sampleQuiz = {
  _id: 'quiz123',
  title: 'Sample Physics Quiz',
  description: 'Midterm preview',
  questions: [
    {
      _id: 'q1',
      question: '<p>What is the speed of light?</p>',
      type: 'mcq',
      options: ['3x10^8 m/s', '1500 m/s', '300 m/s'],
      correctAnswers: [0],
      marks: 2,
      difficulty: 'easy',
      explanation: 'Speed of light in vacuum is approximately 3x10^8 m/s.',
    },
    {
      _id: 'q2',
      question: '<p>Select all prime numbers</p>',
      type: 'msq',
      options: ['2', '4', '7', '9'],
      correctAnswers: [0, 2],
      marks: 3,
      difficulty: 'medium',
    },
  ],
  sections: [],
  settings: {
    deliveryMode: 'all_at_once',
  },
};

describe('QuizPreviewModal', () => {
  it('renders student preview banner and question details', () => {
    renderWithProviders(<QuizPreviewModal isOpen={true} onClose={() => {}} quiz={sampleQuiz} />);

    expect(screen.getByText(/Student Preview: Sample Physics Quiz/i)).toBeInTheDocument();
    expect(screen.getByText(/Student View Preview/i)).toBeInTheDocument();
    expect(screen.getByText(/What is the speed of light\?/i)).toBeInTheDocument();
    expect(screen.getByText('3x10^8 m/s')).toBeInTheDocument();
    expect(screen.getByText(/Select all prime numbers/i)).toBeInTheDocument();
  });

  it('toggles delivery mode between all-on-one-page and sequential', () => {
    renderWithProviders(<QuizPreviewModal isOpen={true} onClose={() => {}} quiz={sampleQuiz} />);

    // Click 'One at a time'
    const seqBtn = screen.getByRole('button', { name: /1️⃣ One at a time/i });
    fireEvent.click(seqBtn);

    expect(screen.getByText(/Question 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/What is the speed of light\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/Select all prime numbers/i)).not.toBeInTheDocument();

    // Click 'Next ->'
    const nextBtn = screen.getByRole('button', { name: /Next →/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Question 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Select all prime numbers/i)).toBeInTheDocument();
  });

  it('shows correct answer badges and explanations when answer key toggle is ON', () => {
    renderWithProviders(<QuizPreviewModal isOpen={true} onClose={() => {}} quiz={sampleQuiz} />);

    // Answer explanation is hidden initially
    expect(screen.queryByText(/Speed of light in vacuum is approximately/i)).not.toBeInTheDocument();

    // Toggle switch
    const switchEl = screen.getByLabelText(/Show answer key & explanations/i);
    fireEvent.click(switchEl);

    // Now correct answer badge and explanation should appear
    expect(screen.getAllByText(/✓ Correct/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Speed of light in vacuum is approximately/i)).toBeInTheDocument();
  });
});
