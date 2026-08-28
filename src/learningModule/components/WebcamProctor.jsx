import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { requestCamera, stopStream, hasLiveVideo, captureThumbnail, getFaceDetector } from '../webcam';
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
export default function WebcamProctor({ active, onReport, intervalMs = 20000, reviewEveryTicks = 9 }) {
  const videoRef = useRef(null);
  const reportRef = useRef(onReport);
  reportRef.current = onReport;

  useEffect(() => {
    if (!active) return undefined;
    let stream = null;
    let timer = null;
    let cancelled = false;
    let ticks = 0;

    const report = (payload) => {
      try {
        reportRef.current?.(payload);
      } catch {
        /* a report must never take the sitting down with it */
      }
    };

    (async () => {
      try {
        stream = await requestCamera();
      } catch {
        // Lost between the pre-test grant and here — a camera unplugged, or
        // taken by another app. Reported as blocked so Live control sees it.
        report({ blocked: true });
        return;
      }
      if (cancelled) {
        stopStream(stream);
        return;
      }
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      const detector = await getFaceDetector();

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
          report({ blocked: true });
          clearInterval(timer);
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
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stopStream(stream);
    };
  }, [active, intervalMs, reviewEveryTicks]);

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
      style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 1400, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          width: 96,
          height: 72,
          objectFit: 'cover',
          borderRadius: 8,
          border: '2px solid rgba(0,0,0,0.35)',
          background: '#000',
          transform: 'scaleX(-1)',
        }}
      />
    </div>,
    getQuizStageHost(),
  );
}
