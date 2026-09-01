import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import WebcamProctor from '../components/WebcamProctor';
import { releaseCameraNow } from '../webcam';
import { getQuizStageHost } from '../quizStage';

/**
 * The self-view a student watches themselves in.
 *
 * It is the one visible part of the webcam watch, and the reason it is visible
 * at all: a student should be able to see that they are on camera. That makes
 * "the stream is live and the frames are going up" an insufficient pass — if the
 * picture is not on the screen, the feature has failed at the only job the
 * student can check.
 */

const fakeStream = () => ({
  getTracks: () => [{ stop: vi.fn(), readyState: 'live' }],
  getVideoTracks: () => [{ readyState: 'live' }],
});

beforeEach(() => {
  globalThis.navigator.mediaDevices = { getUserMedia: () => Promise.resolve(fakeStream()) };
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});
afterEach(() => {
  delete globalThis.navigator.mediaDevices;
  document.getElementById('lm-quiz-stage')?.remove();
  releaseCameraNow();
});

it('renders the self-view inside the quiz stage, not the page beneath it', async () => {
  /* The stage covers the viewport at z-index 1300 and is the element put into
     fullscreen. A self-view rendered as a sibling of it is painted underneath
     when the stage is a plain overlay, and not painted at all in real
     fullscreen, where only the fullscreen element's own subtree renders. Both
     look identical to a student: no camera in the corner. */
  const { container } = render(<WebcamProctor active onReport={() => {}} />);

  const stage = getQuizStageHost();
  await waitFor(() => expect(stage.querySelector('video')).toBeTruthy());
  // And specifically not left behind in the page tree.
  expect(container.querySelector('video')).toBeNull();
});

it('sits above the stage rather than behind it', async () => {
  render(<WebcamProctor active onReport={() => {}} />);
  const stage = getQuizStageHost();
  await waitFor(() => expect(stage.querySelector('video')).toBeTruthy());

  // 1300 is the stage's own z-index; the self-view has to clear it. The video
  // sits inside a frame, and the frame inside the positioned layer.
  const layer = stage.querySelector('video').closest('[style*="z-index"]');
  expect(Number(layer.style.zIndex)).toBeGreaterThan(1300);
});

it('renders nothing at all when the paper does not want a camera', () => {
  const getUserMedia = vi.fn();
  globalThis.navigator.mediaDevices = { getUserMedia };
  render(<WebcamProctor active={false} onReport={() => {}} />);

  expect(document.getElementById('lm-quiz-stage')?.querySelector('video') || null).toBeNull();
  expect(getUserMedia).not.toHaveBeenCalled();
});

it('sits along the top centre, clear of the paper\u2019s own clock', async () => {
  /* Top-right is where the paper puts the countdown. A self-view pinned there
     covered the one thing a student looks up at mid-exam, which is why this is
     centred rather than cornered — and top rather than bottom, because SEB
     draws its own task bar along the bottom edge and swallowed it whole. */
  render(<WebcamProctor active onReport={() => {}} />);
  const stage = getQuizStageHost();
  await waitFor(() => expect(stage.querySelector('video')).toBeTruthy());

  const layer = stage.querySelector('video').closest('[style*="z-index"]');
  expect(layer.style.top).toBe('12px');
  expect(layer.style.left).toBe('50%');
  expect(layer.style.transform).toContain('translateX(-50%)');
  expect(layer.style.right).toBe('');
});

describe('the random snapshots', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('takes exactly as many as the paper asks for, at moments spread across it', async () => {
    /* The whole value of these is that nobody — student or invigilator — knows
       when they are coming, so what is pinned here is the count and the spread,
       never the moments themselves. */
    const reports = [];
    // A frame is only produced when the video reports a size; without this the
    // capture returns null and the component (correctly) retries instead.
    Object.defineProperty(window.HTMLVideoElement.prototype, 'videoWidth', { value: 320, configurable: true });
    Object.defineProperty(window.HTMLVideoElement.prototype, 'videoHeight', { value: 240, configurable: true });
    // jsdom ships no 2d context; without these the capture returns null and the
    // component retries rather than reporting, which is its correct behaviour on
    // a machine whose camera has not produced a frame.
    window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
    window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,AAAA';

    render(
      <WebcamProctor
        active
        snapshotCount={3}
        snapshotWindowMs={30 * 60 * 1000}
        onReport={(body) => reports.push(body)}
      />,
    );
    await waitFor(() => expect(getQuizStageHost().querySelector('video')).toBeTruthy());

    // Nothing in the opening seconds: the camera is still coming up, and a
    // picture of a black frame records nothing.
    await vi.advanceTimersByTimeAsync(5000);
    expect(reports.filter((body) => body.type === 'snapshot')).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    const snaps = reports.filter((body) => body.type === 'snapshot');
    expect(snaps).toHaveLength(3);
    expect(snaps.every((body) => body.image.startsWith('data:image/'))).toBe(true);
  });

  it('takes none when the paper asks for none', async () => {
    const reports = [];
    render(<WebcamProctor active snapshotCount={0} snapshotWindowMs={60000} onReport={(body) => reports.push(body)} />);
    await waitFor(() => expect(getQuizStageHost().querySelector('video')).toBeTruthy());

    await vi.advanceTimersByTimeAsync(120000);
    expect(reports.filter((body) => body.type === 'snapshot')).toHaveLength(0);
  });
});
