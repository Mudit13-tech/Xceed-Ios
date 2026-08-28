import React from 'react';
import { Box, Button, HStack, Text, Tooltip, useClipboard } from '@chakra-ui/react';

/**
 * The two codes a sitting runs on, shown in the clear wherever staff are
 * standing when they need them — the quiz card and the live control panel.
 *
 * Both used to live behind a dialog, and one of them behind a dialog that only
 * ever showed the code once. That is the wrong shape for what these are: an
 * invigilator reads the room code out to the hall at the start, and hands the
 * access code to whoever's laptop will not run Safe Exam Browser, both while
 * standing in front of a room full of people. A code you have to remember to
 * screenshot is a code that gets regenerated mid-sitting — retiring the one
 * already read out.
 *
 * Teacher surfaces only. Neither code is on any student-facing response:
 * `publicSettings` on the server strips both.
 */

/** One code, its label, and a one-tap copy. */
function CodeChip({ label, code, hint, tone }) {
  const clip = useClipboard(code);
  return (
    <Box
      borderWidth="1px"
      borderColor={`lmHue.${tone}200`}
      bg={`lmHue.${tone}50`}
      borderRadius="md"
      px={3}
      py={2}
      minW="fit-content"
    >
      <Text fontSize="10px" textTransform="uppercase" letterSpacing="0.06em" color="lmFg.muted" fontWeight="700">
        {label}
      </Text>
      <HStack spacing={2} align="center">
        <Tooltip label={hint} openDelay={400}>
          <Text
            fontFamily="mono"
            fontSize="lg"
            fontWeight="800"
            letterSpacing="0.12em"
            color={`lmHue.${tone}700`}
            /* Selectable on purpose — reading it out is the common case, but
               copying it into a message to one student is the other one. */
            userSelect="all"
          >
            {code}
          </Text>
        </Tooltip>
        <Button size="xs" variant="ghost" onClick={clip.onCopy} aria-label={`Copy the ${label.toLowerCase()}`}>
          {clip.hasCopied ? '✓' : '⧉'}
        </Button>
      </HStack>
    </Box>
  );
}

/**
 * @param {object} settings  the *manage* settings for the quiz — the student
 *                           copy carries neither code, so this renders nothing
 *                           there rather than half a row.
 */
export default function ExamCodes({ settings, spacing = 3, ...rest }) {
  const roomCode = settings?.roomCode || '';
  /* Only meaningful where SEB is actually required: a code that bypasses a
     lockdown nothing enforces unlocks a door that is already open, and showing
     it would invite a teacher to hand out something that does nothing. */
  const accessCode = settings?.requireSafeExamBrowser ? settings?.sebBypassCode || '' : '';
  /* A code minted before the plaintext was kept: the hash is all the server has,
     so there is nothing to show and the honest thing is to say so rather than
     leave a paper that has a working code looking like one that has none. */
  const accessCodeUnreadable = Boolean(
    settings?.requireSafeExamBrowser && settings?.sebBypassEnabled && !accessCode,
  );

  if (!roomCode && !accessCode && !accessCodeUnreadable) return null;

  return (
    <HStack spacing={spacing} flexWrap="wrap" {...rest}>
      {roomCode && (
        <CodeChip
          label="Room code"
          code={roomCode}
          tone="blue"
          hint="Read this out to the hall. Students tap it in to start."
        />
      )}
      {accessCode && (
        <CodeChip
          label="Access code"
          code={accessCode}
          tone="purple"
          hint="For a student whose machine cannot run Safe Exam Browser. Hand it out yourself."
        />
      )}
      {accessCodeUnreadable && (
        <Text fontSize="xs" color="lmFg.muted" alignSelf="center">
          An access code is active but was minted before codes were kept readable — generate a new one
          to see it here.
        </Text>
      )}
    </HStack>
  );
}
