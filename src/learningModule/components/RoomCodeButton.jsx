import React, { useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  useClipboard,
  useToast,
} from '@chakra-ui/react';

import lmApi from '../api/lmApi';
import { LmIcon } from './Icon';

/**
 * The room code, from the quiz list.
 *
 * The code answers "is this attempt being taken in my room?" — an invigilator
 * reads it out to the hall, and a student has to enter it on an on-screen
 * keyboard to start, so somebody sitting the paper remotely (a friend logged in
 * as the student) never hears it and cannot begin. It is the counter to the
 * classic "decoy in the room, real attempt elsewhere".
 *
 * Unlike the SEB access code next to it, the room code is *meant* to be read —
 * so the dialog shows it in the clear and keeps showing it, rather than once. It
 * is fetched fresh on open (the quiz list does not carry it), because whoever
 * walks in to start the sitting is the one who needs to read it out. Regenerating
 * replaces it, which retires a code that leaked outside the room the moment a new
 * one is read out.
 */
export default function RoomCodeButton({ classId, quiz, onDone }) {
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  // Seeded from the card, which now carries the code itself — the dialog opens
  // showing it instead of a spinner, and the fetch below only confirms it.
  const [code, setCode] = useState(quiz.settings?.roomCode || '');
  const clip = useClipboard(code);
  const toast = useToast();

  const open = async () => {
    setIsOpen(true);
    setLoading(true);
    try {
      // Re-read anyway: a card left open while somebody else regenerated the code
      // would otherwise read out a retired one.
      const full = await lmApi.getQuiz(classId, quiz._id);
      setCode(full.settings?.roomCode || '');
    } catch (err) {
      toast({ status: 'error', title: err.message || 'Could not read the room code', duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const run = async (body) => {
    setBusy(true);
    try {
      const result = await lmApi.setRoomCode(classId, quiz._id, body);
      setCode(result.roomCode || '');
      if (!result.roomCode) toast({ status: 'success', title: 'Room code turned off', duration: 4000 });
      if (onDone) onDone();
    } catch (err) {
      toast({ status: 'error', title: err.message || 'Could not change the room code', duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={open}>
        <LmIcon name="location" size={14} style={{ marginRight: 6 }} />
        Room code
      </Button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="md">Room code — {quiz.title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="lmFg.muted" mb={3}>
              Read this out to the room at the start of the sitting. Students enter it on an on-screen
              keyboard to begin — anyone trying to sit the paper from somewhere else never hears it,
              so it stops a friend taking the test remotely while a decoy runs in the hall. It is asked
              once, at the start; a dropped connection resuming is not asked again.
            </Text>

            {loading && !code ? (
              <HStack color="lmFg.muted" fontSize="sm">
                <Spinner size="sm" />
                <Text>Loading the current code…</Text>
              </HStack>
            ) : code ? (
              <Box borderWidth="1px" borderColor="lmHue.blue200" bg="lmHue.blue50" borderRadius="md" p={4}>
                <Text fontSize="xs" color="lmFg.muted" mb={1}>
                  Current room code — read this out
                </Text>
                <HStack>
                  <Text fontFamily="mono" fontSize="2xl" fontWeight="800" letterSpacing="0.15em">
                    {code}
                  </Text>
                  <Button size="xs" onClick={clip.onCopy}>
                    {clip.hasCopied ? 'Copied' : 'Copy'}
                  </Button>
                </HStack>
              </Box>
            ) : (
              <Text fontSize="sm" color="lmFg.subtle">
                No room code is set for this paper. Generate one when you are ready to start the sitting.
              </Text>
            )}
          </ModalBody>
          <ModalFooter gap={2}>
            {code && (
              <Button size="sm" variant="outline" colorScheme="red" isLoading={busy} onClick={() => run({ clear: true })}>
                Turn off
              </Button>
            )}
            <Button size="sm" colorScheme="blue" isLoading={busy} isDisabled={loading} onClick={() => run({})}>
              {code ? 'Generate a new code' : 'Generate a code'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
