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
  /* Asked twice, narrow then bare.
   *
   * The first form asks for a small front-facing picture, which is what this
   * wants and what every ordinary browser gives. The bare `{ video: true }`
   * behind it is for the embedded browsers — Safe Exam Browser's Chromium among
   * them — where a constraint a desktop webcam cannot describe is answered with
   * a refusal rather than a best effort: a fixed-focus lens that reports no
   * `facingMode` at all, or a driver that will not negotiate a size. The refusal
   * arrives as `OverconstrainedError`, or in older embeds as a plain
   * `NotReadableError`, and it looks exactly like a camera that is not there.
   *
   * Retrying without constraints costs one extra call on a machine that was
   * going to fail anyway, and the second call reuses the grant, so the student
   * is never prompted twice. The reason reported is the *second* failure, since
   * the first no longer says anything true about the device.
   */
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
      audio: false,
    });
  } catch (constrained) {
    if (constrained?.name === 'NotAllowedError' || constrained?.name === 'SecurityError') {
      // A refusal is a refusal — asking again with weaker constraints only
      // produces a second dialog, or a second silent no.
      const err = new Error(constrained?.message || 'camera denied');
      err.reason = 'denied';
      throw err;
    }
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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

/* ------------------------------------------------------------------ *
 * The shared camera — one stream, held across the brief → paper hop.
 * ------------------------------------------------------------------ */

/**
 * Why a holder instead of two independent `requestCamera()` calls.
 *
 * The brief opens a camera to prove the grant and show a preview, stops it on
 * unmount, and the paper opens its own a moment later. On an ordinary desktop
 * browser that is invisible. Inside Safe Exam Browser it is not: SEB renders in
 * an embedded Chromium that hands the device back to the OS on `track.stop()`,
 * and the release does not complete before the paper asks again — the second
 * `getUserMedia` comes back `NotReadableError`. To the student the camera worked
 * on the instructions screen and then the corner of the paper was empty, which is
 * exactly the report from the hall.
 *
 * So the stream is opened once and handed on. Callers take a reference and drop
 * it; the device is only released when the last reference has been gone for
 * `RELEASE_GRACE_MS` — long enough for a screen to unmount and the next to mount,
 * short enough that a student who leaves the exam does not sit with the light on.
 */
const RELEASE_GRACE_MS = 4000;

let shared = null; // the live MediaStream, or null
let sharedPending = null; // an in-flight request, so two callers share one prompt
let refs = 0;
let releaseTimer = null;

const cancelRelease = () => {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
};

/**
 * Take a reference to the shared camera. Resolves to the stream, or throws the
 * same `reason`-carrying error as `requestCamera`.
 *
 * A held stream whose track has since died (camera unplugged, another app took
 * it) is not handed out — it is dropped and asked for again, so a caller never
 * receives a stream that will never produce a frame.
 */
export async function acquireCamera() {
  cancelRelease();
  if (shared && hasLiveVideo(shared)) {
    refs += 1;
    return shared;
  }
  if (shared) {
    stopStream(shared);
    shared = null;
  }
  if (!sharedPending) {
    sharedPending = requestCamera()
      .then((stream) => {
        shared = stream;
        return stream;
      })
      .finally(() => {
        sharedPending = null;
      });
  }
  const stream = await sharedPending;
  refs += 1;
  return stream;
}

/** Drop a reference. The device goes back after the grace period, not before. */
export function releaseCamera() {
  refs = Math.max(0, refs - 1);
  if (refs > 0) return;
  cancelRelease();
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (refs > 0) return;
    stopStream(shared);
    shared = null;
  }, RELEASE_GRACE_MS);
}

/** Stop the camera now, whoever holds it — leaving the module, and tests. */
export function releaseCameraNow() {
  cancelRelease();
  refs = 0;
  stopStream(shared);
  shared = null;
}
