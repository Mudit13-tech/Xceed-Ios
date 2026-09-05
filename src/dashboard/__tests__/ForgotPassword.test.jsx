/**
 * The forgot-password form's captcha behaviour.
 *
 * Mirrors client/src/components/login/__tests__/LoginForm.test.jsx: the
 * challenge must stay off screen for an ordinary reset request, appear only
 * once the server asks for one, and render through an <img> rather than
 * inline markup — an inline SVG can carry a <script>, and this is a page
 * anonymous traffic reaches.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import ForgotPassword from '../ForgotPassword';

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));

const CHALLENGE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><text>A</text></svg>';

const renderForm = () =>
  render(
    <ChakraProvider>
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    </ChakraProvider>,
  );

/** Queues fetch replies in order, so a test reads as the exchange it describes. */
const queueFetch = (...replies) => {
  const fetchMock = vi.fn();
  replies.forEach(({ ok = true, body = {} }) => {
    fetchMock.mockResolvedValueOnce({ ok, json: () => Promise.resolve(body) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const requestOtp = async (user) => {
  await user.type(screen.getByPlaceholderText('you@nitj.ac.in'), 'asha@nitj.ac.in');
  await user.click(screen.getByRole('button', { name: 'Send OTP' }));
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ForgotPassword captcha', () => {
  it('shows no captcha on an ordinary request', async () => {
    queueFetch({ ok: true, body: { success: true, message: 'OTP sent successfully' } });
    const user = userEvent.setup();
    renderForm();

    await requestOtp(user);

    await screen.findByText(/If an account with this email exists/);
    expect(screen.queryByAltText('Characters to type')).not.toBeInTheDocument();
  });

  it('fetches and shows a challenge once the server asks for one', async () => {
    const fetchMock = queueFetch(
      { ok: false, body: { success: false, message: 'The characters did not match. Please try again.', captchaRequired: true, captchaStale: true } },
      { ok: true, body: { token: 'tok-1', svg: CHALLENGE_SVG } },
    );
    const user = userEvent.setup();
    renderForm();

    await requestOtp(user);

    const image = await screen.findByAltText('Characters to type');
    expect(image).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/auth/captcha');
  });

  it('renders the challenge as an image, never as inline markup', async () => {
    queueFetch(
      { ok: false, body: { success: false, message: 'nope', captchaRequired: true, captchaStale: true } },
      { ok: true, body: { token: 'tok-1', svg: CHALLENGE_SVG } },
    );
    const user = userEvent.setup();
    const { container } = renderForm();

    await requestOtp(user);

    const image = await screen.findByAltText('Characters to type');
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(container.querySelector('svg text')).toBeNull();
  });

  it('sends the token and the answer on the next attempt', async () => {
    const fetchMock = queueFetch(
      { ok: false, body: { success: false, message: 'nope', captchaRequired: true, captchaStale: true } },
      { ok: true, body: { token: 'tok-1', svg: CHALLENGE_SVG } },
      { ok: true, body: { success: true, message: 'OTP sent successfully' } },
    );
    const user = userEvent.setup();
    renderForm();

    await requestOtp(user);
    await screen.findByAltText('Characters to type');

    await user.type(screen.getByPlaceholderText('Characters from the image'), 'ac4kp');
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const sent = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(sent.captchaToken).toBe('tok-1');
    expect(sent.captchaAnswer).toBe('ac4kp');
  });

  it('keeps the same image after a wrong answer', async () => {
    const fetchMock = queueFetch(
      { ok: false, body: { success: false, message: 'nope', captchaRequired: true, captchaStale: true } },
      { ok: true, body: { token: 'tok-1', svg: CHALLENGE_SVG } },
      { ok: false, body: { success: false, message: 'The characters did not match. Please try again.', captchaRequired: true, captchaStale: false } },
    );
    const user = userEvent.setup();
    renderForm();

    await requestOtp(user);
    await screen.findByAltText('Characters to type');
    await user.type(screen.getByPlaceholderText('Characters from the image'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    // Three calls, not four: no new challenge was requested for a plain typo.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByPlaceholderText('Characters from the image')).toHaveValue('');
  });

  it('moves to the OTP step once the request finally succeeds', async () => {
    const fetchMock = queueFetch(
      { ok: false, body: { success: false, message: 'nope', captchaRequired: true, captchaStale: true } },
      { ok: true, body: { token: 'tok-1', svg: CHALLENGE_SVG } },
      { ok: true, body: { success: true, message: 'OTP sent successfully' } },
    );
    const user = userEvent.setup();
    renderForm();

    await requestOtp(user);
    await screen.findByAltText('Characters to type');
    await user.type(screen.getByPlaceholderText('Characters from the image'), 'ac4kp');
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await screen.findByText(/Enter the OTP you received/);
    expect(screen.queryByAltText('Characters to type')).not.toBeInTheDocument();
  });
});

describe('ForgotPassword help desk link', () => {
  it('offers the help desk instead of a support mailbox', async () => {
    queueFetch();
    renderForm();

    const link = screen.getByRole('link', { name: /open the help desk/i });
    expect(link).toHaveAttribute('href', '/help');

    // The support address it replaced must be gone, not merely demoted: two
    // routes to the same question is how one of them goes stale.
    expect(
      document.querySelector('a[href^="mailto:"]'),
    ).toBeNull();
  });

  it('hides the help desk once the password has been reset', async () => {
    const user = userEvent.setup();
    queueFetch(
      { body: { message: 'sent' } },
      { body: { message: 'Password updated' } },
    );
    renderForm();

    await requestOtp(user);
    await screen.findByText(/An OTP has been sent to/i);

    // Still on offer while the visitor is mid-reset and might need it.
    expect(
      screen.getByRole('link', { name: /open the help desk/i }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText('Enter new password'),
      'Sup3rSecret!',
    );
    await user.type(
      screen.getByPlaceholderText('Re-enter new password'),
      'Sup3rSecret!',
    );
    // The OTP is six separate PinInput fields, so it is typed digit by digit.
    const otpFields = screen.getAllByLabelText('Please enter your pin code');
    for (const [i, field] of otpFields.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await user.type(field, String(i + 1));
    }
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: /open the help desk/i }),
      ).not.toBeInTheDocument(),
    );
  });
});
