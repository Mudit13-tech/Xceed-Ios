import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * A class member filling in a form. What matters here: every question type
 * renders something a respondent can actually answer, a required question
 * left blank blocks the submit instead of silently posting it, and a
 * previous response pre-fills the form for editing.
 */

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ formId: 'f1' }),
    useOutletContext: () => ({ classId: 'c1' }),
  };
});

const getFormForFill = vi.fn();
const submitFormResponse = vi.fn();
const uploadFiles = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    getFormForFill: (...a) => getFormForFill(...a),
    submitFormResponse: (...a) => submitFormResponse(...a),
    uploadFiles: (...a) => uploadFiles(...a),
  },
}));

const q = (type, extra = {}) => ({ _id: `q-${type}`, type, title: `Question (${type})`, required: false, ...extra });

const open = async (form, existingResponse = null) => {
  getFormForFill.mockResolvedValue({ form, existingResponse });
  const { default: FormFill } = await import('../pages/FormFill');
  renderWithProviders(<FormFill />);
  return screen.findByText(form.title);
};

beforeEach(() => vi.clearAllMocks());

describe('rendering each question type', () => {
  it('renders a text box for short_answer and paragraph', async () => {
    await open({ _id: 'f1', title: 'Feedback', questions: [q('short_answer'), q('paragraph')], settings: {} });
    expect(screen.getByLabelText(/question \(short_answer\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/question \(paragraph\)/i).tagName).toBe('TEXTAREA');
  });

  it('renders radios for multiple_choice and a select for dropdown', async () => {
    await open({
      _id: 'f1',
      title: 'Poll',
      questions: [
        q('multiple_choice', { options: ['Red', 'Blue'] }),
        q('dropdown', { options: ['A', 'B'] }),
      ],
      settings: {},
    });
    expect(screen.getByRole('radio', { name: 'Red' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Blue' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders a checkbox per option for checkboxes', async () => {
    await open({
      _id: 'f1',
      title: 'Poll',
      questions: [q('checkboxes', { options: ['X', 'Y', 'Z'] })],
      settings: {},
    });
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('renders a date input for date and a scale for linear_scale', async () => {
    await open({
      _id: 'f1',
      title: 'Survey',
      questions: [q('date'), q('linear_scale', { scaleMin: 1, scaleMax: 3 })],
      settings: {},
    });
    expect(document.querySelector('input[type="date"]')).not.toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });
});

describe('required validation', () => {
  it('refuses to submit when a required question is left blank', async () => {
    await open({
      _id: 'f1',
      title: 'Feedback',
      questions: [q('short_answer', { required: true, title: 'Your name' })],
      settings: {},
    });
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByText(/"Your name" is required/i)).toBeInTheDocument());
    expect(submitFormResponse).not.toHaveBeenCalled();
  });

  it('submits once the required question is answered', async () => {
    await open({
      _id: 'f1',
      title: 'Feedback',
      questions: [q('short_answer', { required: true, title: 'Your name' })],
      settings: {},
    });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Asha' } });
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));
    await waitFor(() => expect(submitFormResponse).toHaveBeenCalled());
    const [, , answers] = submitFormResponse.mock.calls[0];
    expect(answers[0]).toMatchObject({ text: 'Asha' });
    expect(await screen.findByText(/thanks/i)).toBeInTheDocument();
  });
});

describe('re-opening a form already answered', () => {
  it('pre-fills the previous answer and offers an update button', async () => {
    await open(
      { _id: 'f1', title: 'Feedback', questions: [q('short_answer', { title: 'Your name' })], settings: { oneResponsePerPerson: true } },
      { answers: [{ questionId: 'q-short_answer', text: 'Ravi' }] },
    );
    expect(screen.getByLabelText(/your name/i)).toHaveValue('Ravi');
    expect(screen.getByRole('button', { name: /update response/i })).toBeInTheDocument();
  });
});

describe('a form that has closed', () => {
  it('shows a closed notice instead of the form, and does not offer a Submit button', async () => {
    await open({
      _id: 'f1',
      title: 'Feedback',
      questions: [q('short_answer', { title: 'Your name' })],
      settings: {},
      closed: true,
      dueDate: new Date('2020-01-01T00:00:00Z').toISOString(),
    });
    expect(await screen.findByText(/no longer accepting responses/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/your name/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /^submit$/i })).toBeNull();
  });

  it('shows a live countdown while the form is still open', async () => {
    await open({
      _id: 'f1',
      title: 'Feedback',
      questions: [q('short_answer', { title: 'Your name' })],
      settings: {},
      closed: false,
      dueDate: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(await screen.findByText(/closes in/i)).toBeInTheDocument();
  });
});
