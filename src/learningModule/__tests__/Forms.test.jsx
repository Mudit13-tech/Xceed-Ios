import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The class's Forms list — a Google-Forms-like builder, entirely separate
 * from quizzes and tutorials. What matters here: a teacher gets a "New form"
 * button and Edit/Responses links, a student gets a Fill-in link instead and
 * sees whether they have already responded.
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ children, to }) => <a href={to}>{children}</a>,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({ classId: 'c1', isTeacher: mockIsTeacher.value }),
  };
});

const mockIsTeacher = { value: true };
const listForms = vi.fn();
const createForm = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    listForms: (...a) => listForms(...a),
    createForm: (...a) => createForm(...a),
  },
}));

const open = async () => {
  const { default: Forms } = await import('../pages/Forms');
  renderWithProviders(<Forms />);
  return screen.findByRole('heading', { name: /^forms$/i });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsTeacher.value = true;
});

describe('as a teacher', () => {
  it('offers a New form button and lists existing forms with an Edit/Responses pair', async () => {
    listForms.mockResolvedValue([
      { _id: 'f1', title: 'Feedback', published: true, questions: [{ }], responseCount: 3, settings: {} },
    ]);
    await open();
    expect(screen.getByRole('button', { name: /new form/i })).toBeInTheDocument();
    expect(await screen.findByText('Feedback')).toBeInTheDocument();
    expect(screen.getByText(/3 response/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^edit$/i })).toHaveAttribute('href', '/learning/class/c1/form/f1/edit');
    expect(screen.getByRole('link', { name: /responses/i })).toHaveAttribute(
      'href',
      '/learning/class/c1/form/f1/responses',
    );
  });

  it('creates a form and navigates to its editor', async () => {
    listForms.mockResolvedValue([]);
    createForm.mockResolvedValue({ _id: 'new1' });
    await open();
    fireEvent.click(screen.getByRole('button', { name: /new form/i }));
    await waitFor(() =>
      expect(createForm).toHaveBeenCalledWith('c1', expect.objectContaining({ title: 'Untitled form' })),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/learning/class/c1/form/new1/edit');
  });
});

describe('as a student', () => {
  beforeEach(() => {
    mockIsTeacher.value = false;
  });

  it('shows a Fill in link for an unanswered form and hides the New form button', async () => {
    listForms.mockResolvedValue([{ _id: 'f1', title: 'Poll', questionCount: 2, responded: false }]);
    await open();
    expect(screen.queryByRole('button', { name: /new form/i })).toBeNull();
    expect(screen.getByRole('link', { name: /fill in/i })).toHaveAttribute('href', '/learning/class/c1/form/f1');
  });

  it('shows a Responded badge and an edit-response link once already answered', async () => {
    listForms.mockResolvedValue([{ _id: 'f1', title: 'Poll', questionCount: 2, responded: true }]);
    await open();
    expect(screen.getByText(/^responded$/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view \/ edit response/i })).toBeInTheDocument();
  });
});

describe('with no forms', () => {
  it('shows an empty state', async () => {
    listForms.mockResolvedValue([]);
    await open();
    expect(await screen.findByText(/no forms yet/i)).toBeInTheDocument();
  });
});
