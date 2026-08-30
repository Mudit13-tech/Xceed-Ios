import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import QuizResults from '../pages/QuizResults';
import { lmApi } from '../api/lmApi';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ classId: 'c1', quizId: 'q1' }),
    useNavigate: () => vi.fn(),
    useOutletContext: () => ({ refreshNav: vi.fn() }),
  };
});

vi.mock('../api/lmApi', () => {
  const mockLmApi = {
    quizResults: vi.fn(),
    quizResultsCsvUrl: (classId, quizId) => `/api/classes/${classId}/quizzes/${quizId}/results.csv`,
    releaseQuizResults: vi.fn(),
  };
  return {
    __esModule: true,
    default: mockLmApi,
    lmApi: mockLmApi,
  };
});

describe('QuizResults Export CSV button', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('disables Export CSV button when 0 responses are present', async () => {
    lmApi.quizResults.mockResolvedValue({
      quiz: { title: 'Test Quiz', questions: [], totalMarks: 10, settings: {} },
      attempts: [],
      summary: { inProgress: 0, submitted: 0, enrolled: 0 },
      perQuestion: [],
      perSection: [],
      distribution: [],
      resultsVisible: false,
    });

    renderWithProviders(<QuizResults />);

    const exportBtn = await screen.findByRole('button', { name: /export csv/i });
    expect(exportBtn).toBeDisabled();
  });

  it('enables Export CSV button when at least 1 response is present', async () => {
    lmApi.quizResults.mockResolvedValue({
      quiz: { title: 'Test Quiz', questions: [], totalMarks: 10, settings: {} },
      attempts: [{ id: 'att1', studentName: 'Alice', status: 'submitted', score: 10 }],
      summary: { inProgress: 0, submitted: 1, enrolled: 1 },
      perQuestion: [],
      perSection: [],
      distribution: [],
      resultsVisible: false,
    });

    renderWithProviders(<QuizResults />);

    const exportBtn = await screen.findByRole('link', { name: /export csv/i });
    expect(exportBtn).not.toBeDisabled();
    expect(exportBtn).toHaveAttribute('href', '/api/classes/c1/quizzes/q1/results.csv');
  });

  it('hides reopen and restart actions after results are announced', async () => {
    lmApi.quizResults.mockResolvedValue({
      quiz: { title: 'Test Quiz', questions: [], totalMarks: 10, settings: {} },
      attempts: [{
        _id: 'att1',
        studentName: 'Alice',
        studentEmail: 'alice@example.com',
        rollNumber: '10',
        status: 'submitted',
        score: 8,
        maxScore: 10,
        percent: 80,
        passed: true,
        totalCorrect: 8,
        totalWrong: 0,
        totalUnattempted: 0,
        negativeApplied: 0,
        durationSec: 120,
      }],
      summary: { inProgress: 0, submitted: 1, enrolled: 1, average: 80, passRate: 100, avgDurationSec: 120 },
      perQuestion: [],
      perSection: [],
      distribution: [],
      results: { released: true, announcedAt: '2026-01-01T00:00:00Z' },
    });

    renderWithProviders(<QuizResults />);

    await screen.findByText(/student analysis/i);
    expect(screen.queryByRole('button', { name: /let back in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restart/i })).not.toBeInTheDocument();
  });

  it('adds sortable headers for roll number and score in student analysis', async () => {
    lmApi.quizResults.mockResolvedValue({
      quiz: { title: 'Test Quiz', questions: [], totalMarks: 10, settings: {} },
      attempts: [
        { _id: 'a2', studentName: 'Bob', rollNumber: '20', status: 'submitted', score: 5, maxScore: 10, percent: 50, passed: false, totalCorrect: 5, totalWrong: 5, totalUnattempted: 0, negativeApplied: 0, durationSec: 100 },
        { _id: 'a1', studentName: 'Alice', rollNumber: '10', status: 'submitted', score: 8, maxScore: 10, percent: 80, passed: true, totalCorrect: 8, totalWrong: 2, totalUnattempted: 0, negativeApplied: 0, durationSec: 90 },
      ],
      summary: { inProgress: 0, submitted: 2, enrolled: 2, average: 65, passRate: 50, avgDurationSec: 95 },
      perQuestion: [],
      perSection: [],
      distribution: [],
      results: { released: true, announcedAt: '2026-01-01T00:00:00Z' },
    });

    renderWithProviders(<QuizResults />);

    await screen.findByText(/results announced/i);
    await userEvent.click(screen.getByRole('tab', { name: /student analysis/i }));
    await screen.findByRole('button', { name: /sort by roll number/i });
    expect(screen.getByRole('button', { name: /sort by score/i })).toBeInTheDocument();
  });
});
