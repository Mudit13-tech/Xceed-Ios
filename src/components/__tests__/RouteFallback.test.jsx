import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RouteFallback from '../RouteFallback';

/**
 * What fills the page while a route's chunk is in flight.
 *
 * This used to be a 4px shimmer bar directly under the navbar, which read as a
 * stray horizontal rule the page had grown rather than as loading. It is a
 * skeleton of a page now, and four things about it are worth holding still:
 *
 *  - **It waits before appearing.** Most chunks land well inside the delay, and
 *    a skeleton that flashes for three frames is a flicker, not progress.
 *  - **It is page-shaped.** A heading, tiles and rows — enough that the navbar
 *    stops looking like the whole application.
 *  - **It carries its own CSS.** This renders before Chakra, before the theme,
 *    before anything: a component library here would need bytes that have not
 *    arrived. That includes the dark-mode branch, which has to be a plain
 *    `[data-theme="dark"]` rule rather than a token.
 *  - **It announces itself once.** One live region saying "Loading page", not
 *    nine empty divs for a screen reader to count.
 */

const styleText = () =>
  Array.from(document.head.querySelectorAll('style'))
    .map((tag) => tag.textContent)
    .join('\n');

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Renders, then lets the appearance delay elapse. */
const showSkeleton = () => {
  render(<RouteFallback />);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
};

describe('the route loading skeleton', () => {
  it('shows nothing while a chunk might still land in time', () => {
    render(<RouteFallback />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('appears once the wait has been long enough to be worth reporting', () => {
    showSkeleton();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('is a page shape, not a single bar', () => {
    showSkeleton();
    const blocks = screen.getByRole('status').querySelectorAll('._rfBlock');
    // A heading, a subtitle, a row of tiles and some content rows. The number
    // is not the point; that it is a layout rather than one element is.
    expect(blocks.length).toBeGreaterThan(5);
    expect(screen.getByRole('status').querySelector('._rfTile')).not.toBeNull();
    expect(screen.getByRole('status').querySelector('._rfRow')).not.toBeNull();
  });

  /* The bar that this replaced was the complaint: 4px tall, directly under the
     navbar, indistinguishable from a border. Nothing here should be that. */
  it('leaves behind no 4px bar', () => {
    showSkeleton();
    expect(screen.getByRole('status').querySelector('._rfBar')).toBeNull();
    expect(styleText()).not.toContain('height: 4px');
  });

  it('says what is happening, once, rather than per shape', () => {
    showSkeleton();
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-label', 'Loading page');
    expect(region).toHaveAttribute('aria-live', 'polite');
    // The shapes themselves are decoration.
    expect(region.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('brings its own stylesheet, because nothing else has loaded yet', () => {
    showSkeleton();
    const css = styleText();
    expect(css).toContain('_rfShimmer');
    expect(css).toContain('._rfBlock');
  });

  it('has a dark branch keyed off the attribute Chakra sets on the document', () => {
    showSkeleton();
    expect(styleText()).toContain('[data-theme="dark"] ._rfBlock');
  });

  /* An animation that never stops is exactly what this setting is for. The
     shapes stay — they are the point — they just hold still. */
  it('stops shimmering for a reader who asked for less motion', () => {
    showSkeleton();
    const css = styleText();
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css.slice(css.indexOf('prefers-reduced-motion'))).toContain('animation: none');
  });

  it('injects its stylesheet once however many times it renders', () => {
    showSkeleton();
    const before = document.head.querySelectorAll('style').length;
    showSkeleton();
    expect(document.head.querySelectorAll('style').length).toBe(before);
  });
});
