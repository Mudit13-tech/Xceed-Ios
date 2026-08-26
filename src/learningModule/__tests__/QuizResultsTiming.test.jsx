/**
 * The Timing tab on a teacher's quiz results.
 *
 * The behaviour worth pinning is not that a table renders — it is that the two
 * ways of having no flags stay distinguishable. "Nobody stood out" and "nothing
 * here could be measured" are opposite conclusions, and an all-at-once paper
 * always produces the second one.
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
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
  return { __esModule: true, default: mockLmApi, lmApi: mockLmApi };
});

const baseResults = (timingAnomalies) => ({
  quiz: { title: 'Midterm', questions: [], totalMarks: 10, settings: {} },
  attempts: [{ id: 'a1', studentName: 'Alice', status: 'submitted', score: 10 }],
  summary: { inProgress: 0, submitted: 1, enrolled: 1 },
  perQuestion: [],
  perSection: [],
  distribution: [],
  resultsVisible: false,
  timingAnomalies,
});

// Found by listing the tabs and matching their text rather than by accessible
// name, and clicked with fireEvent rather than userEvent: on a page this size
// both the name computation and userEvent's pointer simulation are slow enough
// to blow the test budget before the tab is ever reached.
const openTimingTab = async () => {
  const tabs = await screen.findAllByRole('tab', undefined, { timeout: 8000 });
  const tab = tabs.find((node) => /timing/i.test(node.textContent));
  expect(tab).toBeDefined();
  fireEvent.click(tab);
};

describe('QuizResults timing tab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('names the student who answered far faster than the cohort', async () => {
    lmApi.quizResults.mockResolvedValue(
      baseResults({
        thresholds: { fastThreshold: 2.5, minSample: 5, absoluteFastSeconds: 2 },
        coverage: { totalResponses: 14, timedResponses: 14, clientTimedOnly: false },
        questionStats: [],
        flags: [
          {
            studentId: 's9',
            questionId: 'q1',
            studentName: 'Rusher',
            rollNumber: '21EC999',
            question: '2 + 2?',
            seconds: 1,
            medianSeconds: 32,
            deviations: -7.4,
            kind: 'fast',
            correct: true,
            severity: 'high',
            reason: '1s against a cohort median of 32s',
          },
        ],
        studentSummary: [
          {
            studentId: 's9',
            studentName: 'Rusher',
            rollNumber: '21EC999',
            fastCount: 1,
            fastCorrectCount: 1,
            slowCount: 0,
          },
        ],
      }),
    );

    renderWithProviders(<QuizResults />);
    await openTimingTab();

    expect(await screen.findByText(/stood out against the cohort/i)).toBeInTheDocument();
    // Named in both tables: once on the flagged submission, once on the
    // repeat-offender roll-up.
    expect(screen.getAllByText('Rusher')).toHaveLength(2);
    expect(screen.getAllByText('21EC999')).toHaveLength(2);
    expect(screen.getByText('Review')).toBeInTheDocument();
    // The cohort figure the judgement rests on is shown, not just the verdict.
    expect(screen.getByText('32s')).toBeInTheDocument();
  }, 20000);

  it('says nobody stood out when the cohort was measured and came back clean', async () => {
    lmApi.quizResults.mockResolvedValue(
      baseResults({
        thresholds: { fastThreshold: 2.5, minSample: 5, absoluteFastSeconds: 2 },
        coverage: { totalResponses: 20, timedResponses: 20, clientTimedOnly: false },
        questionStats: [],
        flags: [],
        studentSummary: [],
      }),
    );

    renderWithProviders(<QuizResults />);
    await openTimingTab();

    expect(await screen.findByText(/no submission stood out/i)).toBeInTheDocument();
    expect(screen.queryByText(/one-at-a-time delivery/i)).not.toBeInTheDocument();
  }, 20000);

  it('explains that an all-at-once paper cannot be judged, rather than implying it was clean', async () => {
    lmApi.quizResults.mockResolvedValue(
      baseResults({
        thresholds: { fastThreshold: 2.5, minSample: 5, absoluteFastSeconds: 2 },
        coverage: { totalResponses: 20, timedResponses: 0, clientTimedOnly: true },
        questionStats: [],
        flags: [],
        studentSummary: [],
      }),
    );

    renderWithProviders(<QuizResults />);
    await openTimingTab();

    expect(await screen.findByText(/need one-at-a-time delivery/i)).toBeInTheDocument();
    // The reassuring message must not appear on a paper nothing could be measured on.
    expect(screen.queryByText(/no submission stood out/i)).not.toBeInTheDocument();
  }, 20000);
});
