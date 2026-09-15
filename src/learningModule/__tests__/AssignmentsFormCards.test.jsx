import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * A form with the Assignment category is a document hand-in, and is listed on
 * the Assignments tab as well as the Forms tab — with the same card and
 * actions. A normal form is not.
 */

const mockNavigate = vi.fn();
const mockIsTeacher = { value: true };
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

const listAssignments = vi.fn();
const listForms = vi.fn();
const createForm = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    listAssignments: (...a) => listAssignments(...a),
    listForms: (...a) => listForms(...a),
    createForm: (...a) => createForm(...a),
  },
}));

const open = async () => {
  const { default: Assignments } = await import('../pages/Assignments');
  renderWithProviders(<Assignments />);
  return screen.findByRole('heading', { name: /numerical assignments/i });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsTeacher.value = true;
  listAssignments.mockResolvedValue([]);
});

it('lists assignment-category forms, and not normal forms', async () => {
  listForms.mockResolvedValue([
    { _id: 'f1', title: 'Lab report', category: 'assignment', published: true, questions: [{}], settings: {} },
    { _id: 'f2', title: 'Feedback poll', category: 'normal', published: true, questions: [{}], settings: {} },
  ]);
  await open();
  expect(await screen.findByText('Lab report')).toBeInTheDocument();
  expect(screen.queryByText('Feedback poll')).toBeNull();
  expect(screen.getByRole('link', { name: /^edit$/i })).toHaveAttribute('href', '/learning/class/c1/form/f1/edit');
  expect(screen.getByRole('link', { name: /responses/i })).toHaveAttribute('href', '/learning/class/c1/form/f1/responses');
});

it('creates a document assignment as an Assignment-category form', async () => {
  listForms.mockResolvedValue([]);
  createForm.mockResolvedValue({ _id: 'new1' });
  await open();
  fireEvent.click(screen.getByRole('button', { name: /new document assignment/i }));
  await waitFor(() =>
    expect(createForm).toHaveBeenCalledWith('c1', expect.objectContaining({ category: 'assignment' })),
  );
  expect(mockNavigate).toHaveBeenCalledWith('/learning/class/c1/form/new1/edit');
});

it('still lists numerical assignments when forms fail to load', async () => {
  listAssignments.mockResolvedValue([{ _id: 'a1', title: 'Ohm law', questions: [], totalMarks: 5 }]);
  listForms.mockRejectedValue(new Error('boom'));
  await open();
  expect(await screen.findByText('Ohm law')).toBeInTheDocument();
});

describe('as a student', () => {
  beforeEach(() => {
    mockIsTeacher.value = false;
  });

  it('gives a Fill in link to an assignment form', async () => {
    listForms.mockResolvedValue([{ _id: 'f1', title: 'Lab report', category: 'assignment', questionCount: 1, responded: false }]);
    await open();
    expect(await screen.findByRole('link', { name: /fill in/i })).toHaveAttribute('href', '/learning/class/c1/form/f1');
  });

  it('hides the section when there are no assignment forms', async () => {
    listForms.mockResolvedValue([]);
    await open();
    expect(screen.queryByText(/document submissions/i)).toBeNull();
  });
});
