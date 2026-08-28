/**
 * The plumbing behind the webcam watch — asking for the camera, grabbing a small
 * frame, and counting faces in it.
 *
 * All of it degrades rather than throws: a browser with no camera API, a student
 * who says no, a browser that cannot detect faces — each resolves to a clear
 * state the caller can act on, never an exception mid-exam. Detection in
 * particular is best-effort: where the browser cannot do it, the watch falls back
 * to keeping the odd thumbnail for a human to read, and never raises an automatic
 * "no face" it cannot stand behind.
 */

/**
 * Ask for the camera. Resolves to a MediaStream, or throws an Error whose
 * `reason` names what to tell the student: 'denied' (said no, or the site is
 * blocked), 'notfound' (no camera), 'inuse' (another app has it), 'insecure'
 * (not https, so the API is unavailable), 'unsupported', or 'error'.
 */
export async function requestCamera() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const err = new Error('camera unavailable');
    // The API is absent on http: origins as well as truly old browsers; name the
    // https case on its own, because it is the one a teacher can actually fix.
    err.reason = typeof window !== 'undefined' && window.isSecureContext === false ? 'insecure' : 'unsupported';
    throw err;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
      audio: false,
    });
  } catch (raw) {
    const err = new Error(raw?.message || 'camera error');
    err.reason =
      raw?.name === 'NotAllowedError' || raw?.name === 'SecurityError'
        ? 'denied'
        : raw?.name === 'NotFoundError' || raw?.name === 'DevicesNotFoundError'
          ? 'notfound'
          : raw?.name === 'NotReadableError' || raw?.name === 'TrackStartError'
            ? 'inuse'
            : 'error';
    throw err;
  }
}

/** Stop every track on a stream — the light goes off the moment it is not needed. */
export function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => {
    try {
      track.stop();
    } catch {
      /* already gone */
    }
  });
}

/** Whether the stream still has a live video track — false once a camera is unplugged or blocked. */
export function hasLiveVideo(stream) {
  return Boolean(stream?.getVideoTracks?.().some((track) => track.readyState === 'live'));
}

/**
 * A small JPEG data URI of the current video frame, or null if the frame is not
 * ready. Deliberately low resolution and quality — a few kilobytes, enough for an
 * invigilator to see who (if anyone) is there, cheap enough not to load a slow
 * connection.
 */
export function captureThumbnail(video, { maxWidth = 240, quality = 0.5 } = {}) {
  const w = video?.videoWidth || 0;
  const h = video?.videoHeight || 0;
  if (!w || !h) return null;
  const scale = Math.min(1, maxWidth / w);
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, cw, ch);
  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

let detectorPromise = null;

/**
 * A face detector, resolved once and reused. Uses the browser's built-in
 * Shape Detection API where it exists; everywhere else it reports itself
 * unavailable, and the watch keeps thumbnails for a human instead of guessing.
 *
 * `detect(video)` returns the number of faces, or null when it could not tell —
 * which the caller treats as "no opinion", never as "no face".
 */
export function getFaceDetector() {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        // eslint-disable-next-line no-undef
        const native = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
        return {
          available: true,
          detect: async (video) => {
            try {
              const faces = await native.detect(video);
              return Array.isArray(faces) ? faces.length : null;
            } catch {
              return null;
            }
          },
        };
      } catch {
        /* constructor threw — fall through to unavailable */
      }
    }
    return { available: false, detect: async () => null };
  })();
  return detectorPromise;
}

/** Reset the memoised detector — tests only. */
export function __resetFaceDetector() {
  detectorPromise = null;
}
