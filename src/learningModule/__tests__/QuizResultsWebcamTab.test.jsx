/**
 * The Webcam tab on a teacher's quiz results.
 *
 * The pictures were always being taken and stored; what was missing was any way
 * to look at them once the sitting was over. Live control only shows them while
 * a student is still writing or while a camera flag is standing, so a submitted
 * paper took its evidence off the screen with it — which is exactly when an
 * appeal starts. These tests pin the two things that fix has to keep true: a
 * submitted sitting's stills are still reachable, and they are reachable by the
 * roll number staff are holding rather than by scrolling.
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
    webcamSnapshot: vi.fn(),
  };
  return { __esModule: true, default: mockLmApi, lmApi: mockLmApi };
});

const sitting = (overrides) => ({
  _id: 'a1',
  studentName: 'Alice',
  studentEmail: 'alice@example.edu',
  rollNumber: '21EC102',
  // Submitted on purpose: this is the state Live control drops a student from,
  // and the whole point of the tab is that the pictures survive it.
  status: 'submitted',
  score: 10,
  webcam: {
    snapshots: [
      { at: '2026-09-16T04:10:00.000Z', file: 'a1-1-aaaa.jpg' },
      { at: '2026-09-16T04:25:00.000Z', file: 'a1-2-bbbb.jpg' },
    ],
    thumbnails: [],
  },
  ...overrides,
});

const baseResults = (attempts) => ({
  quiz: { title: 'Midterm', questions: [], totalMarks: 10, settings: {} },
  attempts,
  summary: { inProgress: 0, submitted: attempts.length, enrolled: attempts.length },
  perQuestion: [],
  perSection: [],
  distribution: [],
  resultsVisible: false,
});

// Listed and matched by text rather than by accessible name, and clicked with
// fireEvent rather than userEvent — on a page this size both the name
// computation and userEvent's pointer simulation are slow enough to blow the
// test budget before the tab is ever reached. Same bargain as the timing tests.
// Every panel is in the DOM at once, and a roll number appears in the student
// table as well, so the returned scope is the *visible* panel — the one the
// assertions must be about.
const openWebcamTab = async () => {
  const tabs = await screen.findAllByRole('tab', undefined, { timeout: 8000 });
  const tab = tabs.find((node) => /webcam/i.test(node.textContent));
  expect(tab).toBeDefined();
  fireEvent.click(tab);
  return within(await screen.findByRole('tabpanel', undefined, { timeout: 8000 }));
};

describe('QuizResults webcam tab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    lmApi.webcamSnapshot.mockImplementation(async (classId, attemptId, file) => `blob:${file}`);
  });

  it('lists a submitted sitting by roll number and loads its stills on request', async () => {
    lmApi.quizResults.mockResolvedValue(baseResults([sitting()]));
    renderWithProviders(<QuizResults />);
    const panel = await openWebcamTab();

    // The roll number is the handle, so it is on screen before anything is opened.
    expect(await panel.findByText('21EC102')).toBeInTheDocument();
    expect(panel.getByText(/2 stills/i)).toBeInTheDocument();

    // Nothing is fetched until someone asks: these are photographs of students.
    expect(lmApi.webcamSnapshot).not.toHaveBeenCalled();

    fireEvent.click(panel.getByRole('button', { name: /show images/i }));

    await waitFor(() => expect(lmApi.webcamSnapshot).toHaveBeenCalledTimes(2));
    expect(lmApi.webcamSnapshot).toHaveBeenCalledWith('c1', 'a1', 'a1-1-aaaa.jpg');
    const shots = await panel.findAllByAltText(/webcam still of Alice/i);
    expect(shots).toHaveLength(2);
  });

  it('narrows to one student by roll number', async () => {
    lmApi.quizResults.mockResolvedValue(
      baseResults([
        sitting(),
        sitting({ _id: 'a2', studentName: 'Bob', rollNumber: '21EC103', studentEmail: 'bob@example.edu' }),
      ]),
    );
    renderWithProviders(<QuizResults />);
    const panel = await openWebcamTab();

    expect(await panel.findByText('21EC102')).toBeInTheDocument();
    expect(panel.getByText('21EC103')).toBeInTheDocument();

    fireEvent.change(panel.getByPlaceholderText(/search roll number or name/i), {
      target: { value: '21EC103' },
    });

    await waitFor(() => expect(panel.queryByText('21EC102')).not.toBeInTheDocument());
    expect(panel.getByText('21EC103')).toBeInTheDocument();
  });

  it('says so plainly when a paper was not watched by camera', async () => {
    lmApi.quizResults.mockResolvedValue(
      baseResults([sitting({ webcam: { snapshots: [], thumbnails: [] } })]),
    );
    renderWithProviders(<QuizResults />);
    const panel = await openWebcamTab();

    expect(await panel.findByText(/no webcam images/i)).toBeInTheDocument();
    expect(lmApi.webcamSnapshot).not.toHaveBeenCalled();
  });
});
