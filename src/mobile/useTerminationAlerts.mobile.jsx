import React, { useCallback, useRef } from 'react';
import { Alert, AlertIcon, Box, Button, ModalCloseButton, Text, useToast } from '@chakra-ui/react';

import lmApi from '../learningModule/api/lmApi';
import { minutesLostSinceTermination, nameOf } from '../learningModule/components/liveExam';

/**
 * Tells the invigilator when a paper terminates itself, and offers the undo.
 *
 * The results page already polls every few seconds; this watches what comes
 * back for attempts that have just gone to `terminated` and raises a toast that
 * stays up until dismissed, with the one action worth taking from it. Without
 * it a termination is only visible to someone already looking at the right row
 * of the right table — and the student is sitting there in the meantime.
 *
 * It lives here rather than in QuizResults.jsx because that file is AMS's, and
 * upstream has touched it in eleven of the last fifty-six syncs. Sixty-seven
 * lines of ours in the middle of it was a conflict on a schedule.
 *
 * Moving it also fixed it: the version living inline called
 * `minutesLostSinceTermination` without importing it, so "Let back in now"
 * threw a ReferenceError rather than doing anything. It is imported here.
 *
 * @param classId  the class the quiz belongs to, for the reopen call
 * @param onReload asked for a refresh once an attempt has been reopened
 * @returns `announce(fetched, quiet)` — call it with each poll's payload
 */
export function useTerminationAlerts({ classId, onReload }) {
  const toast = useToast();
  const knownTerminatedRef = useRef(new Set());

  // Held in a ref so the announcer below does not have to be rebuilt every time
  // the page re-renders a new reload closure — it is called from a toast that
  // may have been on screen since several renders ago.
  const reloadRef = useRef(onReload);
  reloadRef.current = onReload;

  const letBackIn = useCallback(
    async (attempt, quiz, closeToast) => {
      const minutes = minutesLostSinceTermination(quiz, attempt, new Date()) || 30;
      try {
        await lmApi.reopenQuizAttempt(classId, attempt._id, {
          mode: 'continue',
          minutes,
          sebExempt: false,
        });
        toast({
          title: `${nameOf(attempt)} let back in`,
          description: `They have ${minutes} minutes from now.`,
          status: 'success',
          duration: 5000,
        });
        if (closeToast) closeToast();
        // The poll would pick this up on its own, but not for another cycle,
        // and the row the invigilator is watching should change now. Delayed a
        // moment so the write has landed before it is read back.
        setTimeout(() => reloadRef.current && reloadRef.current(), 1000);
      } catch (err) {
        toast({ title: err.message || 'Could not let them back in', status: 'error', duration: 6000 });
      }
    },
    [classId, toast],
  );

  return useCallback(
    (fetched, quiet) => {
      if (!fetched || !fetched.attempts) return;
      const terminated = fetched.attempts.filter((attempt) => attempt.status === 'terminated');

      // Only on a background poll. On the first load every termination already
      // on the paper is history, and announcing all of them at once would bury
      // the page under toasts for events that may be hours old.
      if (quiet) {
        terminated
          .filter((attempt) => !knownTerminatedRef.current.has(attempt._id))
          .forEach((attempt) => {
            toast({
              duration: null,
              isClosable: true,
              position: 'top-right',
              render: ({ onClose }) => (
                <Alert status="error" variant="solid" borderRadius="md" boxShadow="lg" alignItems="start" pe={8}>
                  <AlertIcon />
                  <Box flex="1">
                    <Text fontWeight="bold" fontSize="sm">Exam Terminated</Text>
                    <Text fontSize="sm">{nameOf(attempt)}&apos;s exam was terminated.</Text>
                    <Button
                      mt={2}
                      size="xs"
                      colorScheme="whiteAlpha"
                      onClick={() => letBackIn(attempt, fetched.quiz, onClose)}
                    >
                      Let back in now
                    </Button>
                  </Box>
                  <ModalCloseButton position="absolute" right={1} top={1} onClick={onClose} />
                </Alert>
              ),
            });
          });
      }

      terminated.forEach((attempt) => knownTerminatedRef.current.add(attempt._id));
    },
    [letBackIn, toast],
  );
}

export default useTerminationAlerts;
