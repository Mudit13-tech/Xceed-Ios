import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  requestCamera,
  stopStream,
  hasLiveVideo,
  captureThumbnail,
  getFaceDetector,
  __resetFaceDetector,
} from '../webcam';

/**
 * The webcam plumbing degrades rather than throws — a missing API, a refusal, a
 * browser that cannot detect faces each resolves to a state the caller can act
 * on. These pin that mapping so the pre-test gate and the watch read it right.
 */

const origNavigator = globalThis.navigator;
const origWindow = globalThis.window;

afterEach(() => {
  globalThis.navigator = origNavigator;
  globalThis.window = origWindow;
  __resetFaceDetector();
  vi.restoreAllMocks();
});

describe('requestCamera maps failures to a reason the student can act on', () => {
  it('unsupported when there is no camera API', async () => {
    globalThis.navigator = {};
    globalThis.window = { isSecureContext: true };
    await expect(requestCamera()).rejects.toMatchObject({ reason: 'unsupported' });
  });

  it('insecure when the API is missing on a non-secure origin', async () => {
    globalThis.navigator = {};
    globalThis.window = { isSecureContext: false };
    await expect(requestCamera()).rejects.toMatchObject({ reason: 'insecure' });
  });

  it('denied when the student says no', async () => {
    globalThis.navigator = { mediaDevices: { getUserMedia: () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })) } };
    await expect(requestCamera()).rejects.toMatchObject({ reason: 'denied' });
  });

  it('notfound when there is no camera', async () => {
    globalThis.navigator = { mediaDevices: { getUserMedia: () => Promise.reject(Object.assign(new Error('no'), { name: 'NotFoundError' })) } };
    await expect(requestCamera()).rejects.toMatchObject({ reason: 'notfound' });
  });

  it('inuse when another app holds the camera', async () => {
    globalThis.navigator = { mediaDevices: { getUserMedia: () => Promise.reject(Object.assign(new Error('busy'), { name: 'NotReadableError' })) } };
    await expect(requestCamera()).rejects.toMatchObject({ reason: 'inuse' });
  });

  it('asks again without constraints when the first shape is refused', async () => {
    /* The Safe Exam Browser case: a desktop webcam that cannot describe a
       facingMode, behind an embedded Chromium that answers an unmeetable
       constraint with a refusal rather than a best effort. The bare retry is
       what actually opens it, and the student sees one prompt, not two. */
    const stream = { id: 's1' };
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('over'), { name: 'OverconstrainedError' }))
      .mockResolvedValueOnce(stream);
    globalThis.navigator = { mediaDevices: { getUserMedia } };

    await expect(requestCamera()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { video: true, audio: false });
  });

  it('does not ask twice when the refusal was a refusal', async () => {
    // A second prompt for a student who has just said no is noise, and a site
    // already blocked will not produce one at all.
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
    globalThis.navigator = { mediaDevices: { getUserMedia } };

    await expect(requestCamera()).rejects.toMatchObject({ reason: 'denied' });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('resolves to the stream on success', async () => {
    const stream = { id: 's1' };
    globalThis.navigator = { mediaDevices: { getUserMedia: () => Promise.resolve(stream) } };
    await expect(requestCamera()).resolves.toBe(stream);
  });
});

describe('stream helpers', () => {
  it('stopStream stops every track and never throws', () => {
    const a = { stop: vi.fn() };
    const b = { stop: vi.fn() };
    stopStream({ getTracks: () => [a, b] });
    expect(a.stop).toHaveBeenCalled();
    expect(b.stop).toHaveBeenCalled();
    expect(() => stopStream(null)).not.toThrow();
  });

  it('hasLiveVideo is true only while a video track is live', () => {
    expect(hasLiveVideo({ getVideoTracks: () => [{ readyState: 'live' }] })).toBe(true);
    expect(hasLiveVideo({ getVideoTracks: () => [{ readyState: 'ended' }] })).toBe(false);
    expect(hasLiveVideo(null)).toBe(false);
  });
});

describe('captureThumbnail', () => {
  it('returns null for a video with no dimensions yet', () => {
    expect(captureThumbnail({ videoWidth: 0, videoHeight: 0 })).toBeNull();
  });
});

describe('getFaceDetector falls back cleanly', () => {
  it('reports unavailable when the browser has no FaceDetector', async () => {
    globalThis.window = {};
    const detector = await getFaceDetector();
    expect(detector.available).toBe(false);
    expect(await detector.detect({})).toBeNull();
  });

  it('uses the native detector when present', async () => {
    class FakeFaceDetector {
      // eslint-disable-next-line class-methods-use-this
      detect() {
        return Promise.resolve([{}, {}]); // two faces
      }
    }
    globalThis.window = { FaceDetector: FakeFaceDetector };
    const detector = await getFaceDetector();
    expect(detector.available).toBe(true);
    expect(await detector.detect({})).toBe(2);
  });
});
