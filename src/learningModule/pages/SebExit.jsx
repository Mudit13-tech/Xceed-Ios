import React from 'react';
import { Box, Heading, Text } from '@chakra-ui/react';
import { LmIcon } from '../components/Icon';

/**
 * Where Safe Exam Browser is sent to quit.
 *
 * Reaching this URL is what closes SEB — it is the `quitURL` in the settings
 * file, and the only exit a student has, since the exit keys are disabled and
 * the quit button in SEB's taskbar asks for the invigilator's password.
 *
 * The page itself is therefore usually seen for a fraction of a second, or not
 * at all. It exists for the two cases where it *is* seen: SEB declining to quit
 * for any reason, and somebody reaching this URL in an ordinary browser. Both
 * want the same thing — plain words saying the paper is submitted and it is safe
 * to close the window. It deliberately renders no navigation back into the
 * module: a student here is finished.
 */
export default function SebExit() {
  return (
    <Box maxW="520px" mx="auto" py={16} px={6} textAlign="center">
      <Text fontSize="3xl" mb={2} aria-hidden="true">
        <LmIcon name="success" size={34} strokeWidth={1.5} />
      </Text>
      <Heading size="md" mb={3}>
        Your test is submitted
      </Heading>
      <Text fontSize="sm" color="lmFg.subtle">
        You can close Safe Exam Browser now. If it is still open, use the quit button in the bar at
        the bottom of the screen, or ask your invigilator.
      </Text>
    </Box>
  );
}
