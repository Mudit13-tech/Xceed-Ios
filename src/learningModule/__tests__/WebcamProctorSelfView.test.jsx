import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import WebcamProctor from '../components/WebcamProctor';
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

  // 1300 is the stage's own z-index; the self-view has to clear it.
  const layer = stage.querySelector('video').parentElement;
  expect(Number(layer.style.zIndex)).toBeGreaterThan(1300);
});

it('renders nothing at all when the paper does not want a camera', () => {
  const getUserMedia = vi.fn();
  globalThis.navigator.mediaDevices = { getUserMedia };
  render(<WebcamProctor active={false} onReport={() => {}} />);

  expect(document.getElementById('lm-quiz-stage')?.querySelector('video') || null).toBeNull();
  expect(getUserMedia).not.toHaveBeenCalled();
});
