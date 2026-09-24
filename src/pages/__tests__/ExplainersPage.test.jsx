/**
 * The explainer catalogue page.
 *
 * The rule worth pinning hardest is that nothing preloads. Twenty-two
 * recordings at 4-21 MB each is 222 MB, and a `preload` attribute lost in a
 * refactor would not break a single render — it would just make the page
 * unopenable on the connection most of its readers are on, silently, for
 * everyone. Everything else here is ordinary: sections render, the filter
 * narrows without stranding an empty heading, and a failed fetch says so
 * instead of showing an empty page that looks like "no videos exist".
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import ExplainersPage from '../ExplainersPage';

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));

const CATALOGUE = {
  total: 3,
  sections: [
    {
      id: 'getting-started',
      title: 'Getting started',
      blurb: 'Creating a class and getting your students into it.',
      videos: [
        {
          id: 'class-creation-teacher',
          title: 'Creating a class',
          audience: 'teacher',
          summary: 'Setting up a class and finding the class code.',
          url: '/explainer-videos/class-creation-teacher-demo.mp4',
          missing: false,
        },
        {
          id: 'class-joining-student',
          title: 'Joining a class',
          audience: 'student',
          summary: 'Entering a class code.',
          url: '/explainer-videos/class-joining-student-demo.mp4',
          missing: false,
        },
      ],
    },
    {
      id: 'quizzes',
      title: 'Quizzes and tests',
      blurb: 'Writing a paper and running a sitting.',
      videos: [
        {
          id: 'quizzes-student',
          title: 'Taking a quiz',
          audience: 'student',
          summary: 'Starting an attempt.',
          url: '/explainer-videos/quizzes-student-demo.mp4',
          missing: false,
        },
      ],
    },
  ],
};

const players = () => document.querySelectorAll('video');

/* Section titles appear twice on this page — once as the section's own heading
   and once as a jump link — so every assertion about a section has to say which
   one it means, or it matches both and throws. */
const heading = (name) => screen.findByRole('heading', { name });

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(CATALOGUE) }));
});

describe('ExplainersPage', () => {
  it('renders every section with its videos', async () => {
    render(<ExplainersPage />);

    expect(await heading('Getting started')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quizzes and tests' })).toBeInTheDocument();
    expect(screen.getByText('Creating a class')).toBeInTheDocument();
    expect(screen.getByText('Joining a class')).toBeInTheDocument();
    expect(screen.getByText('Taking a quiz')).toBeInTheDocument();
    expect(players()).toHaveLength(3);
  });

  it('never preloads a video', async () => {
    render(<ExplainersPage />);
    await heading('Getting started');

    // 222 MB of MP4 sits behind these. If this assertion ever fails, the page
    // is fetching some of it before anybody asked to watch anything.
    for (const player of players()) {
      expect(player.getAttribute('preload')).toBe('none');
    }
  });

  it('points each player at the url the catalogue gave it', async () => {
    render(<ExplainersPage />);
    await heading('Getting started');

    const sources = [...document.querySelectorAll('video source')]
      .map((el) => el.getAttribute('src'));
    expect(sources).toEqual([
      '/explainer-videos/class-creation-teacher-demo.mp4',
      '/explainer-videos/class-joining-student-demo.mp4',
      '/explainer-videos/quizzes-student-demo.mp4',
    ]);
  });

  it('counts what is on screen', async () => {
    render(<ExplainersPage />);
    expect(await screen.findByText('3 videos')).toBeInTheDocument();
  });

  describe('audience filter', () => {
    it('narrows to one audience and updates the count', async () => {
      const user = userEvent.setup();
      render(<ExplainersPage />);
      await heading('Getting started');

      await user.click(screen.getByRole('button', { name: 'For teachers' }));

      expect(screen.getByText('Creating a class')).toBeInTheDocument();
      expect(screen.queryByText('Joining a class')).not.toBeInTheDocument();
      expect(screen.getByText('1 video')).toBeInTheDocument();
    });

    it('drops a section whose videos all filtered out', async () => {
      const user = userEvent.setup();
      render(<ExplainersPage />);
      await heading('Quizzes and tests');

      // Quizzes holds only a student video here, so filtering to teachers must
      // remove the heading too rather than leave it over an empty grid.
      await user.click(screen.getByRole('button', { name: 'For teachers' }));
      expect(screen.queryByRole('heading', { name: 'Quizzes and tests' }))
        .not.toBeInTheDocument();
    });

    it('comes back when the filter is cleared', async () => {
      const user = userEvent.setup();
      render(<ExplainersPage />);
      await heading('Getting started');

      await user.click(screen.getByRole('button', { name: 'For students' }));
      expect(screen.queryByText('Creating a class')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Everything' }));
      expect(screen.getByText('Creating a class')).toBeInTheDocument();
      expect(screen.getByText('3 videos')).toBeInTheDocument();
    });
  });

  it('offers a jump link per visible section', async () => {
    render(<ExplainersPage />);
    const nav = await screen.findByRole('navigation', { name: /jump to a section/i });

    expect(within(nav).getByRole('link', { name: 'Getting started' }))
      .toHaveAttribute('href', '#getting-started');
    expect(within(nav).getByRole('link', { name: 'Quizzes and tests' }))
      .toHaveAttribute('href', '#quizzes');
  });

  it('says a recording is unavailable rather than showing a dead player', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        total: 1,
        sections: [{
          id: 'quizzes',
          title: 'Quizzes and tests',
          blurb: '',
          videos: [{
            id: 'quizzes-student',
            title: 'Taking a quiz',
            audience: 'student',
            summary: 'Starting an attempt.',
            url: '/explainer-videos/quizzes-student-demo.mp4',
            missing: true,
          }],
        }],
      }),
    }));

    render(<ExplainersPage />);
    expect(await screen.findByText(/not available right now/i)).toBeInTheDocument();
  });

  describe('when the catalogue cannot be fetched', () => {
    it('says so and offers a retry', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: false, status: 503, statusText: 'Service Unavailable' }));

      render(<ExplainersPage />);

      // An empty page would read as "there are no videos", which is a different
      // and wrong answer.
      expect(await screen.findByText(/could not load the video list/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('refetches when retry is pressed', async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' })
        .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(CATALOGUE) });

      render(<ExplainersPage />);
      await screen.findByRole('button', { name: /try again/i });

      await user.click(screen.getByRole('button', { name: /try again/i }));

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Getting started' })).toBeInTheDocument());
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
