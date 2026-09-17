import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

import WebcamProctor from '../components/WebcamProctor';

/**
 * How often the watch looks, and what it gets out of the way of.
 *
 * Three things are held here, and all three came out of the same complaint —
 * that saving an answer and moving on took a long time on a weak connection.
 *
 *   **Two minutes, not twenty seconds.** The check was the most frequent
 *   request a sitting made, more frequent than the heartbeat the server keeps
 *   deliberately thin. Nothing the watch is looking for — an empty chair, a
 *   second face, a covered camera — resolves in twenty seconds, so asking six
 *   times an hour instead of a hundred and eighty catches the same things.
 *
 *   **A kept frame on every browser.** The periodic frame used to be a fallback
 *   for browsers that cannot detect faces. Everywhere else the only pictures
 *   were the opening one and whatever a rule flagged, so a well-behaved student
 *   on a detecting browser could leave a single photograph for a whole paper.
 *   It runs everywhere now, alongside the random snapshots rather than instead
 *   of them.
 *
 *   **Pictures give way to answers.** A frame or a snapshot falling due while
 *   the student's own answer is on the wire is deferred, not dropped. On a slow
 *   uplink a few kilobytes of JPEG ahead of an answer is the pause the student
 *   reads as the paper hanging.
 */

const acquireCamera = vi.fn();
const captureThumbnail = vi.fn(() => 'data:image/jpeg;base64,AAAA');
const detect = vi.fn(async () => 1);
let detectorAvailable = true;

vi.mock('../webcam', () => ({
  acquireCamera: (...args) => acquireCamera(...args),
  releaseCamera: vi.fn(),
  hasLiveVideo: () => true,
  captureThumbnail: (...args) => captureThumbnail(...args),
  getFaceDetector: () => Promise.resolve({ get available() { return detectorAvailable; }, detect }),
}));

/** A stream object good enough for the component, which only asks about tracks. */
const fakeStream = { getVideoTracks: () => [{ readyState: 'live' }] };

/** Let every pending microtask settle — the tick is async throughout. */
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

/** Advance the fake clock by `ms`, letting each tick's promises resolve. */
const advance = async (ms) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await settle();
};

/**
 * One check interval at a time, settling in between.
 *
 * Not one long `advanceTimersByTime`: the tick awaits the detector, so jumping
 * several intervals at once fires them all before any of them gets past its
 * first `await`, and they then all read the same tick count. Two minutes apart
 * in a real sitting they never overlap; stepping keeps the test honest about
 * the thing it is measuring rather than about fake-timer interleaving.
 */
const TICK_MS = 120_000;
const advanceTicks = async (count) => {
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await advance(TICK_MS);
  }
};

const reportsOfType = (onReport, predicate) =>
  onReport.mock.calls.map(([body]) => body).filter(predicate);

describe('the webcam watch cadence', () => {
  let onReport;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    detectorAvailable = true;
    acquireCamera.mockResolvedValue(fakeStream);
    onReport = vi.fn();
    // jsdom has no canvas; the component's own video element reports no size,
    // so the capture is stubbed rather than exercised.
    captureThumbnail.mockReturnValue('data:image/jpeg;base64,AAAA');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks every two minutes, not every twenty seconds', async () => {
    render(<WebcamProctor active onReport={onReport} />);
    await settle();

    // The opening frame has gone out; nothing else yet.
    const opening = onReport.mock.calls.length;
    expect(opening).toBe(1);

    await advance(60_000);
    expect(onReport.mock.calls.length).toBe(opening); // half a period: silent

    await advance(60_000);
    expect(onReport.mock.calls.length).toBe(opening + 1);
  });

  it('keeps a periodic frame even where the browser can detect faces', async () => {
    // The regression this exists for: with detection available the `else`
    // branch never ran, so a student who did nothing wrong left one picture.
    detectorAvailable = true;
    detect.mockResolvedValue(1); // a face, every time — nothing to flag
    render(<WebcamProctor active onReport={onReport} reviewEveryTicks={2} />);
    await settle();

    await advanceTicks(2);

    const reviews = reportsOfType(onReport, (body) => body.type === 'review');
    expect(reviews).toHaveLength(1);
    expect(reviews[0].image).toBeTruthy();
    // And it is still honest about what the browser can do.
    expect(reviews[0].detectionAvailable).toBe(true);
  });

  it('sends nothing but numbers on an ordinary check', async () => {
    detect.mockResolvedValue(1);
    render(<WebcamProctor active onReport={onReport} reviewEveryTicks={5} />);
    await settle();

    await advance(120_000);

    const [body] = onReport.mock.calls.at(-1);
    expect(body.image).toBeUndefined();
    expect(body.type).toBeUndefined();
  });

  it('defers a periodic frame while the student is saving, then takes it', async () => {
    detect.mockResolvedValue(1);
    let busy = true;
    render(
      <WebcamProctor active onReport={onReport} reviewEveryTicks={1} isBusy={() => busy} />,
    );
    await settle();

    await advanceTicks(1);
    expect(reportsOfType(onReport, (b) => b.type === 'review')).toHaveLength(0);

    // The answer lands; the next tick takes the picture that was waiting.
    busy = false;
    await advanceTicks(1);
    expect(reportsOfType(onReport, (b) => b.type === 'review')).toHaveLength(1);
  });

  it('never defers a flagged frame — an empty chair is not made to wait', async () => {
    // The deferral is about bandwidth politeness for the routine record. A
    // frame the detector objected to is the thing the watch exists to send.
    detectorAvailable = true;
    detect.mockResolvedValue(0); // nobody there
    render(<WebcamProctor active onReport={onReport} isBusy={() => true} />);
    await settle();

    await advance(120_000);

    const [body] = onReport.mock.calls.at(-1);
    expect(body.faceCount).toBe(0);
    expect(body.image).toBeTruthy();
  });

  it('still takes its random snapshots, held back only while an answer is in flight', async () => {
    // The moment inside the band is random by design; pinned here so the test
    // is about the deferral rather than about where the draw landed. At 0 the
    // floor applies, so the snapshot is due eight seconds in.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let busy = true;
    render(
      <WebcamProctor
        active
        onReport={onReport}
        snapshotCount={1}
        snapshotWindowMs={600_000}
        isBusy={() => busy}
      />,
    );
    await settle();

    await advance(8_000);
    expect(reportsOfType(onReport, (b) => b.type === 'snapshot')).toHaveLength(0);

    busy = false;
    await advance(3_000);
    const snaps = reportsOfType(onReport, (b) => b.type === 'snapshot');
    expect(snaps).toHaveLength(1);
    // Still the larger capture: a face that must be recognised is worth pixels.
    expect(captureThumbnail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxWidth: 480 }),
    );
  });

  it('gives up deferring eventually, so a busy page still yields a snapshot', async () => {
    // Bounded on purpose: a page that reports busy forever must not silently
    // produce no record at all. Six holds of three seconds, then it is taken
    // regardless.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(
      <WebcamProctor
        active
        onReport={onReport}
        snapshotCount={1}
        snapshotWindowMs={600_000}
        isBusy={() => true}
      />,
    );
    await settle();

    await advance(8_000);
    expect(reportsOfType(onReport, (b) => b.type === 'snapshot')).toHaveLength(0);

    await advance(6 * 3_000);
    expect(reportsOfType(onReport, (b) => b.type === 'snapshot')).toHaveLength(1);
  });
});
