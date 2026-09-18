/**
 * The one report that has to survive the page going away.
 *
 * Three violation types end a paper on sight — `tab_switch`, `blur` and
 * `fullscreen_exit` — and all three fire at the exact moment the document may be
 * unloading, because one of the ways a student leaves the test screen is by
 * closing the tab or navigating off it. An ordinary `fetch` is aborted when the
 * document unloads, so that departure never reached the server.
 *
 * What that produced was the worst possible split. The client latches a
 * departure locally and tells the student their test is closed without waiting
 * for a reply — deliberately, so that pulling the network cannot buy a paper
 * that stays open — while the server still had the attempt `in_progress`. So the
 * student was missing from the teacher's shut-out list, counted as still
 * writing, and the brief offered them a live Start button, because `startAttempt`
 * resumes an attempt that is in progress rather than refusing it.
 *
 * `keepalive` is the browser's answer to exactly this: the request is handed to
 * the browser to finish on its own after the page is gone. Pinned here because
 * it is one word in an options object, invisible in review, and the failure it
 * prevents only shows up in a hall.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../getenvironment', () => ({ default: () => 'https://exams.example.edu' }));
vi.mock('../serverClock', () => ({ sync: () => {} }));

import lmApi from '../api/lmApi';

const okResponse = () => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  // `request` reads the body as text and parses it itself, so that a non-JSON
  // error page becomes a message rather than a parse failure.
  text: async () => JSON.stringify({ ok: true }),
});

/** The options `fetch` was called with on the last request. */
const lastOptions = () => global.fetch.mock.calls.at(-1)[1];

describe('the departure report', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => okResponse());
    localStorage.clear();
  });

  it('is sent keepalive, so a closing tab still delivers it', async () => {
    await lmApi.recordViolation('c1', 'a1', 'fullscreen_exit', '2026-03-01T10:00:00.000Z');

    const [url, options] = global.fetch.mock.calls.at(-1);
    expect(url).toContain('/classes/c1/attempts/a1/violation');
    expect(options.method).toBe('POST');
    expect(options.keepalive).toBe(true);
    expect(JSON.parse(options.body)).toEqual({
      type: 'fullscreen_exit',
      at: '2026-03-01T10:00:00.000Z',
    });
  });

  it('is keepalive whichever kind of violation it carries', async () => {
    // The queue replays whatever it was holding when the connection came back,
    // and a keypress report races the same unload as a departure does.
    await lmApi.recordViolation('c1', 'a1', 'key_press', undefined, 'Meta');
    expect(lastOptions().keepalive).toBe(true);

    await lmApi.recordViolation('c1', 'a1', 'blur');
    expect(lastOptions().keepalive).toBe(true);
  });

  it('leaves the autosave to ask for keepalive itself', async () => {
    /* The draft save takes it per call — the periodic one does not need it and
       the one fired as the paper closes does. Chrome caps the *total* body of
       in-flight keepalive requests at 64KB, so it stays an opt-in there rather
       than becoming the default for a request that carries every answer. */
    await lmApi.saveAttemptDraft('c1', 'a1', [{ questionId: 'q1', selected: ['0'] }]);
    expect(lastOptions().keepalive).toBe(false);

    await lmApi.saveAttemptDraft('c1', 'a1', [{ questionId: 'q1', selected: ['0'] }], {
      keepalive: true,
    });
    expect(lastOptions().keepalive).toBe(true);
  });
});
