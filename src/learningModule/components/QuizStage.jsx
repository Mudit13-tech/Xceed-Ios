import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Button } from '@chakra-ui/react';
import {
  fullscreenSupported,
  getQuizStageHost,
  isInFullscreen,
  onFullscreenChange,
  openQuizStage,
  requestQuizFullscreen,
} from '../quizStage';
import StageBar from './StageBar';
import ExamPulse from './ExamPulse';

/**
 * The canvas a quiz runs on — the brief and the sitting alike.
 *
 * Both screens render into one host element that outlives either of them, so
 * fullscreen taken on the instructions carries straight through into the paper
 * (see `../quizStage` for why that has to live outside the route tree). The
 * stage carries the only chrome a test is allowed: which paper this is, for
 * which subject, set by whom.
 */
export default function QuizStage({
  subject,
  faculty,
  title,
  children,
  autoFullscreen = true,
  pulse = false,
  autoPulse = false,
  pulseColor,
  manualPulseAt = null,
}) {
  const [host] = useState(getQuizStageHost);
  // Through `quizStage`'s helpers, never `document.fullscreenElement` directly:
  // WebKit before Safari 16.4 spells all of this with a `webkit` prefix, and a
  // screen that reads the unprefixed name alone decides it is never in
  // fullscreen. See the note on `onFullscreenChange`.
  const [isFullscreen, setIsFullscreen] = useState(isInFullscreen);

  useEffect(() => onFullscreenChange(() => setIsFullscreen(isInFullscreen())), []);

  useEffect(() => openQuizStage({ autoFullscreen }), [autoFullscreen]);

  /**
   * Second chance at fullscreen, taken from the student's next click.
   *
   * `requestFullscreen` is only granted while a user gesture is in hand, and the
   * request on mount has none in the two cases that matter: a paper opened from
   * a pasted link in a fresh tab, and a tab reloaded mid-brief. Waiting for the
   * student to notice a button in the corner is how a test that is supposed to
   * put itself fullscreen ends up not being in one — so the first click anywhere
   * on the stage does it instead, whatever they were clicking on.
   *
   * Only while the screen is asking for fullscreen: once the paper is over, or
   * the sitting has been closed by leaving, `autoFullscreen` is false and a click
   * must not drag the student back into a fullscreen they are done with.
   */
  useEffect(() => {
    if (!autoFullscreen || isFullscreen) return undefined;
    const onGesture = () => requestQuizFullscreen();
    const node = host;
    node.addEventListener('pointerdown', onGesture);
    return () => node.removeEventListener('pointerdown', onGesture);
  }, [autoFullscreen, isFullscreen, host]);

  const enter = useCallback(() => {
    requestQuizFullscreen();
  }, []);

  return createPortal(
    <Box minH="100%">
      <StageBar
        subject={subject}
        faculty={faculty}
        title={title}
        action={
          /* Only shown when the browser refused the automatic request, or the
             student pressed Escape — one press away from putting it back. A
             browser with no Fullscreen API at all is not offered it: a button
             that cannot work reads as the test being broken, and the sitting
             lets that browser through rather than gating on it. */
          !isFullscreen && fullscreenSupported() && (
            <Button size="xs" variant="outline" onClick={enter} leftIcon={<span aria-hidden="true">⛶</span>}>
              Fullscreen
            </Button>
          )
        }
      />

      <Box maxW="960px" mx="auto" px={{ base: 3, md: 6 }} py={5}>
        {children}
      </Box>

      {/* The invigilation pulse — mounted whenever a paper is actually being
          sat, painted over everything with no pointer events, so it is on the
          same fullscreened canvas the student cannot escape. `autoPulse` is the
          teacher's per-quiz toggle for the standing 30s ring; a manual "pulse
          now" reaches it through `manualPulseAt` either way. See ExamPulse. */}
      {pulse && <ExamPulse auto={autoPulse} color={pulseColor} manualPulseAt={manualPulseAt} />}
    </Box>,
    host,
  );
}
