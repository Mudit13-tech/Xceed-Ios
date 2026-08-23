import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The teacher's results page: a per-question summary, the individual
 * responses, a CSV export link, and deleting one response.
 */

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ children, to }) => <a href={to}>{children}</a>,
    useParams: () => ({ formId: 'f1' }),
    useOutletContext: () => ({ classId: 'c1' }),
  };
});

const listFormResponses = vi.fn();
const getFormSummary = vi.fn();
const deleteFormResponse = vi.fn();
const formResponsesCsvUrl = vi.fn(() => 'https://api.test/classes/c1/forms/f1/responses.csv');
vi.mock('../api/lmApi', () => ({
  default: {
    listFormResponses: (...a) => listFormResponses(...a),
    getFormSummary: (...a) => getFormSummary(...a),
    deleteFormResponse: (...a) => deleteFormResponse(...a),
    formResponsesCsvUrl: (...a) => formResponsesCsvUrl(...a),
  },
}));

const form = {
  _id: 'f1',
  title: 'Class survey',
  settings: { accessMode: 'class' },
  questions: [
    { _id: 'q1', type: 'multiple_choice', title: 'Favourite topic', options: ['Circuits', 'Signals'] },
  ],
};

const response = (overrides = {}) => ({
  _id: 'r1',
  respondent: { name: 'Asha', email: 'asha@example.com', rollNumber: '21EC01', isGuest: false },
  answers: [{ questionId: 'q1', selectedOptions: ['Circuits'] }],
  submittedAt: new Date().toISOString(),
  ...overrides,
});

const open = async () => {
  const { default: FormResponses } = await import('../pages/FormResponses');
  renderWithProviders(<FormResponses />);
  return screen.findByRole('heading', { name: /class survey/i });
};

beforeEach(() => {
  vi.clearAllMocks();
  listFormResponses.mockResolvedValue({ form, responses: [response()] });
  getFormSummary.mockResolvedValue({
    totalResponses: 1,
    summary: [{ questionId: 'q1', title: 'Favourite topic', type: 'multiple_choice', counts: { Circuits: 1, Signals: 0 }, answered: 1 }],
  });
});

it('shows the CSV export link pointing at the form', async () => {
  await open();
  const link = screen.getByRole('link', { name: /download csv/i });
  expect(link).toHaveAttribute('href', 'https://api.test/classes/c1/forms/f1/responses.csv');
});

it('renders the per-option counts in the summary tab', async () => {
  await open();
  // Chakra keeps every TabPanel mounted (just hidden), and the same question
  // title/option text also appears in the collapsed "individual responses"
  // detail — so this is scoped to the Summary panel specifically rather than
  // an ambiguous page-wide query.
  const summaryPanel = (await screen.findAllByRole('tabpanel'))[0];
  expect(within(summaryPanel).getByText('Favourite topic')).toBeInTheDocument();
  expect(within(summaryPanel).getByText('Circuits')).toBeInTheDocument();
});

describe('individual responses', () => {
  it('lists the respondent and their answer once expanded', async () => {
    await open();
    fireEvent.click(screen.getByRole('tab', { name: /individual responses/i }));
    // Chakra hides the inactive TabPanel, and getByRole excludes hidden
    // elements by default — so there is only ever one accessible tabpanel at
    // a time, whichever tab is now active. Scoping to it is what tells this
    // "Circuits" apart from the identical text sitting in the (now hidden)
    // Summary panel.
    const responsesPanel = within((await screen.findAllByRole('tabpanel'))[0]);
    fireEvent.click(await responsesPanel.findByText('Asha'));
    expect(await responsesPanel.findByText('Circuits')).toBeInTheDocument();
  });

  it('deletes a response after confirmation and reloads the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteFormResponse.mockResolvedValue({ deleted: true });
    await open();
    fireEvent.click(screen.getByRole('tab', { name: /individual responses/i }));
    fireEvent.click(await screen.findByText('Asha'));
    fireEvent.click(await screen.findByRole('button', { name: /delete this response/i }));
    await waitFor(() => expect(deleteFormResponse).toHaveBeenCalledWith('c1', 'f1', 'r1'));
    expect(listFormResponses).toHaveBeenCalledTimes(2);
  });

  it('does not delete when the teacher cancels the confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await open();
    fireEvent.click(screen.getByRole('tab', { name: /individual responses/i }));
    fireEvent.click(await screen.findByText('Asha'));
    fireEvent.click(await screen.findByRole('button', { name: /delete this response/i }));
    expect(deleteFormResponse).not.toHaveBeenCalled();
  });
});

it('shows an empty state when nobody has responded yet', async () => {
  listFormResponses.mockResolvedValue({ form, responses: [] });
  getFormSummary.mockResolvedValue({ totalResponses: 0, summary: [] });
  await open();
  fireEvent.click(screen.getByRole('tab', { name: /individual responses/i }));
  expect(await screen.findByText(/no responses yet/i)).toBeInTheDocument();
});
