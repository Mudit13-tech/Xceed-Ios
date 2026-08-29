import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import WebcamProctor from '../components/WebcamProctor';
import { acquireCamera, releaseCamera, releaseCameraNow } from '../webcam';

/**
 * The camera surviving the hop from the instructions screen to the paper.
 *
 * This is the Safe Exam Browser bug, and it is invisible on a normal desktop
 * browser: the brief opened a camera, stopped it on unmount, and the paper asked
 * for its own a moment later. Chrome hands it back instantly, so nobody saw
 * anything. SEB's embedded browser does not — the second request landed while the
 * device was still being released and came back `NotReadableError`, the watch
 * gave up on the single failure, and the corner of the paper was empty for the
 * whole sitting.
 *
 * So the two things worth pinning down are: one stream is handed on rather than
 * reopened, and a failure to open one is retried rather than final.
 */

const track = () => ({ stop: vi.fn(), readyState: 'live' });

const fakeStream = () => {
  const video = track();
  return { getTracks: () => [video], getVideoTracks: () => [video] };
};

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  releaseCameraNow();
  vi.useRealTimers();
  delete globalThis.navigator.mediaDevices;
  document.getElementById('lm-quiz-stage')?.remove();
});

describe('the shared camera', () => {
  it('hands the brief’s stream to the paper instead of reopening the device', async () => {
    const getUserMedia = vi.fn().mockImplementation(() => Promise.resolve(fakeStream()));
    globalThis.navigator.mediaDevices = { getUserMedia };

    // The brief takes the camera, then lets go of it on its way to the paper.
    const briefStream = await acquireCamera();
    releaseCamera();

    // The paper, mounting in the next beat, gets the same live stream — the one
    // request is the one prompt, and the device is never closed in between.
    render(<WebcamProctor active onReport={() => {}} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    const stage = getStageVideo();
    await waitFor(() => expect(stage.srcObject).toBe(briefStream));
    expect(briefStream.getVideoTracks()[0].stop).not.toHaveBeenCalled();
  });

  it('puts the device down once nobody is holding it', async () => {
    // The grace period is measured in seconds, so this one test drives the clock.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const stream = fakeStream();
    globalThis.navigator.mediaDevices = { getUserMedia: () => Promise.resolve(stream) };

    await acquireCamera();
    releaseCamera();
    // Not immediately — that is the window the handover needs.
    expect(stream.getTracks()[0].stop).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    expect(stream.getTracks()[0].stop).toHaveBeenCalled();
  });
});

describe('a camera that will not open', () => {
  it('says so in the corner and keeps trying, rather than leaving it empty', async () => {
    const denied = Object.assign(new Error('busy'), { name: 'NotReadableError' });
    /* Two calls per attempt now: the narrow constraints, then the bare retry
       behind them. The first attempt fails both, the second succeeds on the
       first. */
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(denied)
      .mockRejectedValueOnce(denied)
      .mockImplementation(() => Promise.resolve(fakeStream()));
    globalThis.navigator.mediaDevices = { getUserMedia };
    const onReport = vi.fn();

    render(<WebcamProctor active onReport={onReport} />);

    // The student is told which of "camera off" and "camera invisible" this is,
    // and the invigilator is told once.
    // And named: 'inuse' is another application on the machine, which is a
    // different person's problem from a camera SEB's config forbids.
    await waitFor(() => expect(getStage().textContent).toMatch(/used by another app/i));
    await waitFor(() => expect(onReport).toHaveBeenCalledWith({ blocked: true }));

    /* And then it comes back on its own — no reload, no restart of the paper.
       The second attempt is 700ms behind the first, so this waits it out rather
       than driving the clock: the retry is scheduled from inside an async chain
       the test cannot synchronise with. */
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(3), { timeout: 4000 });
    await waitFor(() => expect(getStage().textContent).not.toMatch(/no camera/i), {
      timeout: 4000,
    });
  });
});

it('sits at the top of the screen, clear of the Safe Exam Browser task bar', async () => {
  globalThis.navigator.mediaDevices = { getUserMedia: () => Promise.resolve(fakeStream()) };
  render(<WebcamProctor active onReport={() => {}} />);

  const video = await waitFor(getStageVideo);
  const layer = video.closest('[style*="z-index"]');
  /* Pinned to the top edge, not the bottom: SEB draws its own bar along the
     bottom of the kiosk window, which swallowed the old corner entirely. */
  expect(layer.style.top).toBe('12px');
  expect(layer.style.bottom).toBe('');
});

const getStage = () => document.getElementById('lm-quiz-stage');
const getStageVideo = () => {
  const video = getStage()?.querySelector('video');
  if (!video) throw new Error('no self-view yet');
  return video;
};
