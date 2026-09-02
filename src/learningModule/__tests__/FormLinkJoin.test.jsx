import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * Public link-mode form entry.
 * Tests guest join flow when accessMode is "anyone", prompt for guest name,
 * and redirect to login when form access requires class membership (LOGIN_REQUIRED).
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ shareCode: 'code123' }),
    useLocation: () => ({ pathname: '/learning/form/link/code123', search: '', hash: '' }),
  };
});

const joinFormByLink = vi.fn();
const getFormByLink = vi.fn();
const submitFormResponseByLink = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: {
    joinFormByLink: (...a) => joinFormByLink(...a),
    getFormByLink: (...a) => getFormByLink(...a),
    submitFormResponseByLink: (...a) => submitFormResponseByLink(...a),
    formGuest: {
      save: vi.fn(),
      token: () => null,
    },
  },
}));

const sampleForm = {
  _id: 'f1',
  title: 'Public Feedback Form',
  description: 'Open to everyone',
  questions: [
    { _id: 'q1', type: 'short_answer', title: 'Your Feedback', required: true, options: [] },
  ],
  settings: { accessMode: 'anyone' },
};

const open = async () => {
  const { default: FormLinkJoin } = await import('../pages/FormLinkJoin');
  renderWithProviders(<FormLinkJoin />);
};

beforeEach(() => vi.clearAllMocks());

describe('FormLinkJoin', () => {
  it('opens form directly when guest join succeeds', async () => {
    joinFormByLink.mockResolvedValue({ formId: 'f1', guestToken: 'token123' });
    getFormByLink.mockResolvedValue({ form: sampleForm, existingResponse: null });

    await open();

    expect((await screen.findAllByText('Public Feedback Form')).length).toBeGreaterThan(0);
    expect(screen.getByText('Your Feedback')).toBeInTheDocument();
  });

  it('prompts for name when NAME_REQUIRED error is returned', async () => {
    joinFormByLink.mockRejectedValue({ payload: { code: 'NAME_REQUIRED' } });

    await open();

    expect(await screen.findByText(/what should we call you\?/i)).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/your name/i);
    expect(input).toBeInTheDocument();

    joinFormByLink.mockResolvedValue({ formId: 'f1', guestToken: 'token123' });
    getFormByLink.mockResolvedValue({ form: sampleForm, existingResponse: null });

    fireEvent.change(input, { target: { value: 'Guest User' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect((await screen.findAllByText('Public Feedback Form')).length).toBeGreaterThan(0);
  });

  it('redirects to login when form requires class membership (LOGIN_REQUIRED)', async () => {
    joinFormByLink.mockRejectedValue({ payload: { code: 'LOGIN_REQUIRED' } });

    await open();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('/login?redirect=%2Flearning%2Fform%2Flink%2Fcode123'),
        { replace: true },
      );
    });
  });
});
