import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The platform gate on the class chrome.
 *
 * Every redesigned screen in this pair ships to Android too — one bundle serves
 * both stores — so the only thing keeping the Android app where it is, is a
 * runtime check. That check is worth a test of its own: nothing in an iOS
 * screenshot will ever reveal that Android quietly moved with it.
 *
 * UpcomingCard reads the platform once at import, so each case resets the
 * module registry and imports again against a different Capacitor.
 */
const asPlatform = async (platform, path) => {
  vi.resetModules();
  vi.doMock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform } }));
  return (await import(path)).default;
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('@capacitor/core');
  vi.resetModules();
});

describe('learningModule iOS class chrome', () => {
  it('collapses the Upcoming card to one line on iOS', async () => {
    const UpcomingCard = await asPlatform('ios', '../components/UpcomingCard');
    renderWithProviders(<UpcomingCard classId="c1" />);

    expect(screen.getByText(/No work due soon/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'To-do' })).toHaveAttribute('href', '/learning/todo');
    // The material button is furniture on a phone: the Material tab is a
    // thumb's reach up the same screen.
    expect(screen.queryByRole('link', { name: 'View class material' })).not.toBeInTheDocument();
  });

  it.each(['android', 'web'])('leaves the Upcoming card alone on %s', async (platform) => {
    const UpcomingCard = await asPlatform(platform, '../components/UpcomingCard');
    renderWithProviders(<UpcomingCard classId="c1" />);

    expect(screen.getByText(/Track due dates on the/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'To-do page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View class material' })).toHaveAttribute(
      'href',
      '/learning/class/c1/material',
    );
    expect(screen.queryByText(/No work due soon/)).not.toBeInTheDocument();
  });

  it('reports the platform it was given', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
    const { isIosApp, isAndroidApp, nativePlatform } = await import('../../mobile/platform');
    expect(nativePlatform()).toBe('ios');
    expect(isIosApp()).toBe(true);
    expect(isAndroidApp()).toBe(false);
  });

  it('falls back to web when Capacitor is not initialised', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({
      Capacitor: {
        getPlatform: () => {
          throw new Error('not initialised');
        },
      },
    }));
    const { isIosApp, nativePlatform } = await import('../../mobile/platform');
    expect(nativePlatform()).toBe('web');
    expect(isIosApp()).toBe(false);
  });
});
