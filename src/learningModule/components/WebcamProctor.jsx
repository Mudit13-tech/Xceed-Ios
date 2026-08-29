import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { acquireCamera, releaseCamera, hasLiveVideo, captureThumbnail, getFaceDetector } from '../webcam';
import { getQuizStageHost } from '../quizStage';

/**
 * The webcam watch, for a paper that requires one.
 *
 * It holds the camera for the length of the sitting, looks for a face on a slow
 * cadence, and hands each result to `onReport`. What travels is almost always
 * nothing but a number — the detection runs here, in the student's browser, so a
 * slow connection is never loaded with video. A thumbnail rides along only when a
 * frame is worth keeping: the first one, an empty or crowded frame where the
 * browser can actually tell, or the occasional frame for a human to read where it
 * cannot.
 *
 * A small self-view is shown rather than hiding the camera entirely: a student
 * should be able to see that they are on camera and roughly framed, and a visible
 * light-plus-preview is the honest version of "you are being watched".
 *
 * Like the rest of the proctoring here it decides nothing. It reports; Live
 * control raises the flag; a person looks.
 */

/* How long to wait before each attempt at the camera.
 *
 * The first attempt is immediate; the rest exist for Safe Exam Browser. SEB's
 * embedded Chromium hands the device back to the OS asynchronously, so the paper
 * asking for the camera in the same beat the instructions screen let go of it
 * gets `NotReadableError` — the device is not busy with another app, it is busy
 * with the previous screen for a few hundred milliseconds more. `acquireCamera`
 * makes that rare by handing the same stream on, and these retries cover what is
 * left: a browser that frees it on its own schedule, and a camera unplugged and
 * put back mid-paper. After the ramp it keeps trying on the long interval,
 * because a sitting lasts an hour and a camera that comes back should be picked
 * up rather than mourned.
 */
const RETRY_MS = [0, 700, 2000, 5000, 10000];

/** The reason, in words an invigilator standing at the desk can act on. */
const BLOCKED_WHY = {
  denied: 'blocked by this browser',
  notfound: 'none found',
  inuse: 'used by another app',
  insecure: 'site not on https',
  unsupported: 'browser cannot',
  lost: 'disconnected',
  error: 'error',
};
const RETRY_STEADY_MS = 15000;

export default function WebcamProctor({
  active,
  onReport,
  intervalMs = 20000,
  reviewEveryTicks = 9,
  snapshotCount = 0,
  snapshotWindowMs = 0,
}) {
  const videoRef = useRef(null);
  const reportRef = useRef(onReport);
  reportRef.current = onReport;
  /* Whether this browser can detect faces at all, remembered so a snapshot
     report does not answer the question it was never asked: every report writes
     `detectionAvailable`, and a snapshot sent with a bare `false` would tell the
     server a browser that *can* detect faces cannot. */
  const detectionRef = useRef(false);
  /* What the corner is showing: 'starting' until a frame is flowing, 'live'
     once it is, 'blocked' when the camera could not be opened.

     It is state, and it is drawn, because the failure this replaces was silent:
     the acquire threw, the component reported `blocked` to the server and
     returned, and the student was left looking at an empty corner with no way to
     tell a camera that was off from a camera that was merely invisible. The
     invigilator saw the flag; the student saw nothing. Now the corner always
     holds something that says which of the two it is. */
  const [feed, setFeed] = useState('starting');
  /* Why the camera would not open, in the student's corner and in the words the
     rest of the module uses: 'denied', 'notfound', 'inuse', 'insecure',
     'unsupported', 'error'.

     Drawn because "no camera" is not one fault, it is six, and they are fixed by
     six different people. A camera Safe Exam Browser's config forbids reads as
     'denied' and is the invigilator's to fix; 'insecure' means the kiosk reached
     the site over http and is the administrator's; 'inuse' is another
     application on the machine and is the student's. A corner that only says
     "no camera" sends every one of them to the same wrong place. */
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!active) return undefined;
    let held = false;
    let timer = null;
    let retry = null;
    let cancelled = false;
    let ticks = 0;
    let attempts = 0;
    let reportedBlocked = false;

    const report = (payload) => {
      try {
        reportRef.current?.(payload);
      } catch {
        /* a report must never take the sitting down with it */
      }
    };

    /* Getting the picture onto the screen is its own small fight in an embedded
       browser: a `play()` called before the stream has metadata can reject, and a
       rejected play on a muted inline video is not retried by anything. So the
       element carries `autoPlay` as well, and the play is attempted again when
       metadata arrives. */
    const attach = (stream) => {
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      const play = () => {
        Promise.resolve(video.play())
          .then(() => setFeed('live'))
          .catch(() => {});
      };
      video.onloadedmetadata = play;
      play();
      // Even where play() never resolves, a live track is a live watch — the
      // reporting below does not depend on the element rendering.
      if (hasLiveVideo(stream)) setFeed('live');
    };

    const scheduleRetry = () => {
      if (cancelled) return;
      const wait = attempts < RETRY_MS.length ? RETRY_MS[attempts] : RETRY_STEADY_MS;
      attempts += 1;
      retry = setTimeout(start, wait);
    };

    const start = async () => {
      if (cancelled) return;
      let stream;
      try {
        stream = await acquireCamera();
        held = true;
      } catch (err) {
        // Not fatal, and not final. Reported once so Live control sees it, then
        // tried again — a camera that comes back mid-paper is picked up.
        if (!reportedBlocked) {
          reportedBlocked = true;
          report({ blocked: true });
        }
        setReason(err?.reason || 'error');
        setFeed('blocked');
        scheduleRetry();
        return;
      }
      if (cancelled) {
        releaseCamera();
        held = false;
        return;
      }
      attempts = 0;
      setReason('');
      attach(stream);
      const detector = await getFaceDetector();
      detectionRef.current = detector.available;

      const detect = async () => (detector.available ? detector.detect(videoRef.current) : null);

      // The opening frame — who sat down — always kept.
      report({
        faceCount: await detect(),
        detectionAvailable: detector.available,
        type: 'start',
        image: captureThumbnail(videoRef.current) || undefined,
      });

      const tick = async () => {
        if (cancelled) return;
        if (!hasLiveVideo(stream)) {
          /* The camera went away under a running watch. Say so, drop the dead
             stream, and go back round the retry ramp rather than giving up for
             the rest of the sitting. */
          report({ blocked: true });
          reportedBlocked = true;
          setReason('lost');
          setFeed('blocked');
          clearInterval(timer);
          timer = null;
          releaseCamera();
          held = false;
          scheduleRetry();
          return;
        }
        ticks += 1;
        const count = await detect();
        if (detector.available) {
          const flagged = count === 0 || count > 1;
          report({
            faceCount: count,
            detectionAvailable: true,
            image: flagged ? captureThumbnail(videoRef.current) || undefined : undefined,
          });
        } else {
          // No browser detection: send only the odd frame for a human to read,
          // never a guessed flag — and infrequently, so it stays cheap.
          const keep = ticks % reviewEveryTicks === 0;
          report({
            faceCount: null,
            detectionAvailable: false,
            ...(keep ? { type: 'review', image: captureThumbnail(videoRef.current) || undefined } : {}),
          });
        }
      };

      timer = setInterval(tick, intervalMs);
    };

    start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (retry) clearTimeout(retry);
      if (held) releaseCamera();
    };
  }, [active, intervalMs, reviewEveryTicks]);

  /**
   * The random snapshots — `webcamSnapshotCount` on the quiz, three by default.
   *
   * A different job from the watch above, which reports a number every twenty
   * seconds and keeps a picture only when something already looks wrong. These
   * are an unprompted record that the person who started the paper is the person
   * still sitting it, and their whole value is that nobody — invigilator
   * included — knows when they are coming. A fixed cadence would be learnable
   * within one sitting and shareable before the next.
   *
   * The window is split into equal bands and one picture is taken at a random
   * moment inside each, rather than N draws across the whole paper: uniform
   * draws leave a real chance of all three landing in the first ten minutes,
   * which is the arrangement a substitution would most like. Bands keep them
   * spread while leaving each one unpredictable.
   *
   * A frame that is not ready — the camera still starting, or briefly gone — is
   * retried a few times rather than dropped, because a missed snapshot is a hole
   * in the one record this exists to produce. They are captured larger and less
   * compressed than a flag thumbnail: a face that has to be recognised is worth
   * more pixels than a frame that only has to show whether anyone is there.
   */
  useEffect(() => {
    if (!active || snapshotCount <= 0) return undefined;
    const timers = [];
    let cancelled = false;

    const take = (tries = 0) => {
      if (cancelled) return;
      const image = captureThumbnail(videoRef.current, { maxWidth: 480, quality: 0.6 });
      if (!image) {
        // No frame yet. Try again shortly, a handful of times, then let it go.
        if (tries < 5) timers.push(setTimeout(() => take(tries + 1), 6000));
        return;
      }
      try {
        reportRef.current?.({
          type: 'snapshot',
          image,
          detectionAvailable: detectionRef.current,
        });
      } catch {
        /* a report must never take the sitting down with it */
      }
    };

    // A sitting whose length is unknown (an untimed paper, or a window that has
    // not been worked out yet) still gets its snapshots — spread over half an
    // hour, which is the length of an ordinary paper.
    const span = Math.max(60000, snapshotWindowMs || 30 * 60000);
    const band = span / snapshotCount;
    for (let i = 0; i < snapshotCount; i += 1) {
      // Never in the first few seconds: the camera is still opening, and a
      // picture of a black frame is not a record of anything.
      const at = Math.max(8000, Math.round(band * i + Math.random() * band));
      timers.push(setTimeout(() => take(), at));
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [active, snapshotCount, snapshotWindowMs]);

  if (!active) return null;

  /* Rendered into the quiz stage, not into the page under it.

     The stage is a `position:fixed; inset:0; z-index:1300` host appended to
     `document.body` (see quizStage.js), and it is also the element that gets
     `requestFullscreen`. A self-view left in the page tree loses to it twice
     over: at z-index 45 it is painted underneath the stage, and in real
     fullscreen it is not painted at all, because only the fullscreen element's
     own subtree is. Either way the student saw no camera — the stream was live,
     the frames were being reported, and the one part meant to reassure them they
     were on camera was the part behind the curtain.

     A portal puts it inside that subtree, so it survives both. */
  return createPortal(
    <div
      /* Top centre — not the bottom, and not the corner.

         The bottom-right corner is where a self-view conventionally goes, and it
         is the wrong place here for two reasons. Inside Safe Exam Browser the
         kiosk window is not the desktop: SEB draws its own task bar along the
         bottom edge, so a preview pinned 12px from the bottom of the viewport sat
         under it and the student saw no camera at all — the report from the hall.
         And an invigilator walking a row reads the top of a screen over a
         student's shoulder; the bottom is the part hidden by their head and
         hands.

         Top-*right* was the first fix and cost the clock: the paper's own header
         puts the countdown in that corner, so the preview sat on top of the one
         thing a student looks up at. Centred along the top edge clears it, keeps
         both halves of the header (question number on the left, timer on the
         right) readable, and is if anything easier to read from behind — the
         middle of a screen is the part a student's shoulders do not cover. */
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1400,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          position: 'relative',
          /* Half again the old 96x72. Small enough to keep out of the paper's
             way, large enough that whoever is in frame can be told apart at a
             glance from the aisle. */
          width: 168,
          height: 126,
          borderRadius: 8,
          overflow: 'hidden',
          background: '#000',
          border: feed === 'blocked' ? '2px solid #E53E3E' : '2px solid rgba(0,0,0,0.35)',
        }}
      >
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transform: 'scaleX(-1)',
          }}
        />
        {feed !== 'live' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 4,
              font: '600 12px/1.4 system-ui, sans-serif',
              color: '#fff',
              background: feed === 'blocked' ? 'rgba(197,48,48,0.92)' : 'rgba(0,0,0,0.75)',
            }}
          >
            {feed === 'blocked' ? `No camera (${BLOCKED_WHY[reason] || reason || 'error'}) — retrying` : 'Starting camera…'}
          </div>
        )}
      </div>
    </div>,
    getQuizStageHost(),
  );
}
