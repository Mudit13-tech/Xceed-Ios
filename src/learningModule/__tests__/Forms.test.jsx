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
    Link: ({ children, to, ...rest }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
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

  it('shows how many of the class have filled a class-scoped form', async () => {
    listForms.mockResolvedValue([
      {
        _id: 'f1',
        title: 'Roll call',
        published: true,
        questions: [{}],
        responseCount: 12,
        enrolledCount: 30,
        settings: { accessMode: 'class' },
      },
    ]);
    await open();
    expect(await screen.findByText(/12\/30 students filled/i)).toBeInTheDocument();
  });

  it('shows a Closed badge and no countdown once a deadline has passed', async () => {
    listForms.mockResolvedValue([
      { _id: 'f1', title: 'Late poll', published: true, questions: [{}], settings: {}, closed: true, dueDate: new Date(Date.now() - 1000).toISOString() },
    ]);
    await open();
    expect(await screen.findByText(/^closed$/i)).toBeInTheDocument();
    expect(screen.queryByText(/closes in/i)).toBeNull();
  });

  it('shows a live countdown when a deadline is set and still open', async () => {
    listForms.mockResolvedValue([
      {
        _id: 'f1',
        title: 'Open poll',
        published: true,
        questions: [{}],
        settings: {},
        closed: false,
        dueDate: new Date(Date.now() + 3600_000).toISOString(),
      },
    ]);
    await open();
    expect(await screen.findByText(/closes in/i)).toBeInTheDocument();
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

  it('disables the action once a form has closed, rather than sending them to a page that will refuse them', async () => {
    listForms.mockResolvedValue([{ _id: 'f1', title: 'Poll', questionCount: 2, responded: false, closed: true }]);
    await open();
    const link = screen.getByRole('link', { name: /^closed$/i });
    expect(link).toHaveAttribute('disabled');
  });

  it('shows a live countdown to the deadline while the form is still open', async () => {
    listForms.mockResolvedValue([
      {
        _id: 'f1',
        title: 'Poll',
        questionCount: 2,
        responded: false,
        closed: false,
        dueDate: new Date(Date.now() + 3600_000).toISOString(),
      },
    ]);
    await open();
    expect(await screen.findByText(/closes in/i)).toBeInTheDocument();
  });
});

describe('with no forms', () => {
  it('shows an empty state', async () => {
    listForms.mockResolvedValue([]);
    await open();
    expect(await screen.findByText(/no forms yet/i)).toBeInTheDocument();
  });
});
