import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
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
});
