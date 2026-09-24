/**
 * The explainer page inside the installed app.
 *
 * ExplainersPage.test.jsx is AMS's, and it checks the web: players point at the
 * site-relative url the catalogue returns. In the app that url would resolve
 * against the WebView's own origin, i.e. into the bundle, and the bundle
 * deliberately no longer carries these files (scripts/otaManifest.cjs). So on
 * native, `mediaUrl` in nativeCapabilities.mobile.js anchors them to the API
 * host. That branch only runs when Capacitor says it is native, which it never
 * does under jsdom, so it is forced here.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import ExplainersPage from '../ExplainersPage';

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));
vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => true, getPlatform: () => 'android' },
  };
});

const catalogue = (url) => ({
  total: 1,
  sections: [
    {
      id: 'getting-started',
      title: 'Getting started',
      videos: [{ id: 'v', title: 'A video', audience: 'teacher', url, missing: false }],
    },
  ],
});

const serve = (body) => {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
};

const sourceSrc = async () => {
  await screen.findByRole('heading', { name: 'Getting started' });
  return document.querySelector('video source').getAttribute('src');
};

describe('ExplainersPage in the app', () => {
  it('anchors each player to the api origin, not the app origin', async () => {
    serve(catalogue('/explainer-videos/class-creation-teacher-demo.mp4'));
    render(<ExplainersPage />);

    expect(await sourceSrc()).toBe('http://api.test/explainer-videos/class-creation-teacher-demo.mp4');
  });

  it('passes an absolute url from the catalogue through untouched', async () => {
    serve(catalogue('https://cdn.example/explainer-videos/x.mp4'));
    render(<ExplainersPage />);

    expect(await sourceSrc()).toBe('https://cdn.example/explainer-videos/x.mp4');
  });
});
