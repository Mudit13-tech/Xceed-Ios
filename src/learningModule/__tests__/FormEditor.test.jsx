import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The form builder. What matters here: adding a question type actually adds
 * a card for it, an empty required title blocks Save with a clear message
 * rather than silently posting a broken question, and publishing shows the
 * share link the server minted.
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ formId: 'f1' }),
    useOutletContext: () => ({ classId: 'c1' }),
  };
});

const getForm = vi.fn();
const updateForm = vi.fn();
const publishForm = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    getForm: (...a) => getForm(...a),
    updateForm: (...a) => updateForm(...a),
    publishForm: (...a) => publishForm(...a),
    formShareUrl: (code) => `https://api.test/learning/form/link/${code}`,
  },
}));

const baseForm = (overrides = {}) => ({
  _id: 'f1',
  title: 'Feedback',
  description: '',
  published: false,
  shareCode: '',
  settings: { accessMode: 'class', oneResponsePerPerson: true },
  questions: [{ _id: 'q1', type: 'short_answer', title: 'Your name', required: false, options: [] }],
  ...overrides,
});

const open = async (form = baseForm()) => {
  getForm.mockResolvedValue(form);
  const { default: FormEditor } = await import('../pages/FormEditor');
  renderWithProviders(<FormEditor />);
  return screen.findByDisplayValue(form.title);
};

beforeEach(() => vi.clearAllMocks());

it('adds a new question card of the chosen type', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: /\+ multiple choice/i }));
  expect(await screen.findByText(/pick one from a list/i)).toBeInTheDocument();
});

it('opens student preview modal when Preview button is clicked', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: /preview/i }));
  expect(await screen.findByText(/Student Preview: Feedback/i)).toBeInTheDocument();
  expect(screen.getByText('Your name')).toBeInTheDocument();
});

it('blocks Save and explains why when a question has no title', async () => {
  await open(baseForm({ questions: [{ _id: 'q1', type: 'short_answer', title: '', required: false, options: [] }] }));
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  // The same problem is shown twice — once in the persistent warning banner,
  // once as the toast Save popped up — so this only asserts it appeared, not
  // where.
  await waitFor(() => expect(screen.getAllByText(/give it a title/i).length).toBeGreaterThan(0));
  expect(updateForm).not.toHaveBeenCalled();
});

it('blocks Save when a choice question has fewer than two options', async () => {
  await open(
    baseForm({
      questions: [{ _id: 'q1', type: 'multiple_choice', title: 'Pick', required: false, options: ['Only one'] }],
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(screen.getAllByText(/add at least two options/i).length).toBeGreaterThan(0));
  expect(updateForm).not.toHaveBeenCalled();
});

it('saves with the edited title', async () => {
  updateForm.mockResolvedValue(baseForm({ title: 'Renamed' }));
  await open();
  fireEvent.change(screen.getByDisplayValue('Feedback'), { target: { value: 'Renamed' } });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() =>
    expect(updateForm).toHaveBeenCalledWith('c1', 'f1', expect.objectContaining({ title: 'Renamed' })),
  );
});

it('shows the share link once published', async () => {
  publishForm.mockResolvedValue({ published: true, shareCode: 'abc123' });
  updateForm.mockResolvedValue(baseForm());
  getForm.mockResolvedValueOnce(baseForm()).mockResolvedValueOnce(baseForm({ published: true, shareCode: 'abc123' }));
  const { default: FormEditor } = await import('../pages/FormEditor');
  renderWithProviders(<FormEditor />);
  await screen.findByDisplayValue('Feedback');

  fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));
  await waitFor(() => expect(publishForm).toHaveBeenCalledWith('c1', 'f1', { publish: true }));
  expect(await screen.findByDisplayValue('https://api.test/learning/form/link/abc123')).toBeInTheDocument();
});

it('does not offer a share link before the form is published', async () => {
  await open();
  expect(screen.queryByText(/^share$/i)).toBeNull();
});

describe('submission deadline', () => {
  it('hides the after-deadline choice until a deadline is actually set', async () => {
    await open();
    expect(screen.queryByLabelText(/after the deadline/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/submission deadline/i), { target: { value: '2099-01-01T10:00' } });
    expect(await screen.findByLabelText(/after the deadline/i)).toBeInTheDocument();
  });

  it('defaults the after-deadline choice to stopping responses', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/submission deadline/i), { target: { value: '2099-01-01T10:00' } });
    expect(await screen.findByLabelText(/after the deadline/i)).toHaveValue('stop');
  });

  it('saves the deadline and the chosen late-response behaviour', async () => {
    updateForm.mockResolvedValue(baseForm());
    await open();
    fireEvent.change(screen.getByLabelText(/submission deadline/i), { target: { value: '2099-01-01T10:00' } });
    fireEvent.change(await screen.findByLabelText(/after the deadline/i), { target: { value: 'allow' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateForm).toHaveBeenCalled());
    const [, , body] = updateForm.mock.calls[0];
    expect(body.settings.allowLateResponses).toBe(true);
    expect(new Date(body.settings.dueDate).getFullYear()).toBe(2099);
  });

  it('shows the existing deadline pre-filled when editing a form that already has one', async () => {
    await open(baseForm({ settings: { accessMode: 'class', dueDate: '2099-06-15T09:30:00.000Z' } }));
    expect(await screen.findByLabelText(/after the deadline/i)).toBeInTheDocument();
  });
});
