/**
 * The Instagram bar pinned to the bottom of the home page.
 *
 * What is worth pinning is that it stays put — `fixed` is the whole point of
 * the request, and it is one class away from scrolling off with the footer —
 * and that dismissing it sticks without throwing where storage is blocked.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import InstagramFollowBar from '../home/InstagramFollowBar';

const KEY = 'xceed:instagram-bar-dismissed';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the Instagram follow bar', () => {
  it('links to the handle and stays fixed to the viewport', async () => {
    const { container } = render(<InstagramFollowBar />);

    const link = await screen.findByRole('link', { name: /Follow us/ });
    expect(link).toHaveAttribute('href', 'https://www.instagram.com/xceed_nitj/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText('@xceed_nitj')).toBeInTheDocument();

    // Fixed to the bottom of the viewport, not merely at the end of the page,
    // and against the left edge rather than centred.
    const bar = container.firstChild;
    expect(bar.className).toContain('tw-fixed');
    expect(bar.className).toContain('tw-bottom-0');
    expect(bar.className).toContain('tw-justify-start');
  });

  it('stays hidden once dismissed', async () => {
    const user = userEvent.setup();
    render(<InstagramFollowBar />);

    await screen.findByRole('link', { name: /Follow us/ });
    await user.click(screen.getByRole('button', { name: /Hide the Instagram bar/ }));

    expect(screen.queryByRole('link', { name: /Follow us/ })).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('does not come back on the next visit', () => {
    localStorage.setItem(KEY, '1');
    render(<InstagramFollowBar />);

    expect(screen.queryByRole('link', { name: /Follow us/ })).toBeNull();
  });

  it('still renders where storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const user = userEvent.setup();
    render(<InstagramFollowBar />);

    // Shown, and dismissable — it simply cannot remember the answer.
    await screen.findByRole('link', { name: /Follow us/ });
    await user.click(screen.getByRole('button', { name: /Hide the Instagram bar/ }));
    expect(screen.queryByRole('link', { name: /Follow us/ })).toBeNull();
  });
});

describe('opening the Instagram app', () => {
  const setUserAgent = (ua) =>
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);

  it('hands Android an intent URL naming the app, with a web fallback', async () => {
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
    );
    const assign = vi.fn();
    // jsdom refuses a real navigation, so the href setter is what we watch.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { get href() { return ''; }, set href(v) { assign(v); } },
    });

    const user = userEvent.setup();
    render(<InstagramFollowBar />);
    await user.click(await screen.findByRole('link', { name: /Follow us/ }));

    expect(assign).toHaveBeenCalledTimes(1);
    const url = assign.mock.calls[0][0];
    expect(url).toContain('intent://instagram.com/_u/xceed_nitj');
    expect(url).toContain('package=com.instagram.android');
    // Without the fallback an Android phone with no Instagram app goes nowhere.
    expect(url).toContain(
      `S.browser_fallback_url=${encodeURIComponent('https://www.instagram.com/xceed_nitj/')}`
    );
  });

  it('leaves iOS and desktop to the plain link', async () => {
    // iOS opens the app through Universal Links; a custom scheme would raise an
    // error dialog on an iPhone without Instagram installed.
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1'
    );
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { get href() { return ''; }, set href(v) { assign(v); } },
    });

    const user = userEvent.setup();
    render(<InstagramFollowBar />);
    await user.click(await screen.findByRole('link', { name: /Follow us/ }));

    expect(assign).not.toHaveBeenCalled();
  });
});
