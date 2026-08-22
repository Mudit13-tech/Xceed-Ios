import React, { useState } from 'react';
import {
  Alert,
  AlertIcon,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useClipboard,
  useToast,
} from '@chakra-ui/react';

import lmApi from '../api/lmApi';

/**
 * The Safe Exam Browser access code, from the quiz list.
 *
 * The code is the answer to a question asked at the worst possible moment: a
 * student is in front of you, minutes before the paper opens, on a machine SEB
 * will not run on. Answering it used to mean opening the editor, finding the
 * Access tab and scrolling past the .seb file setup — authoring furniture, on a
 * paper that was finished being authored. So the control also sits on the card,
 * next to the rest of what a published paper can be told to do.
 *
 * Only for a paper that requires SEB: a code that bypasses a lockdown nothing
 * enforces would unlock a door that is already open.
 *
 * The code itself is shown once and never again — only its hash is kept — which
 * is why this is a dialog rather than an inline toggle: there has to be somewhere
 * for "copy this now" to live.
 */
export default function AccessCodeButton({ classId, quiz, onDone }) {
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [enabled, setEnabled] = useState(Boolean(quiz.settings?.sebBypassEnabled));
  const clip = useClipboard(code);
  const toast = useToast();

  const close = () => {
    setIsOpen(false);
    // Never left on screen for the next person to open the dialog and read.
    setCode('');
  };

  const run = async (body) => {
    setBusy(true);
    try {
      const result = await lmApi.setSebBypassCode(classId, quiz._id, body);
      setEnabled(Boolean(result.settings?.sebBypassEnabled));
      setCode(result.code || '');
      if (!result.code) toast({ status: 'success', title: 'Access code turned off', duration: 4000 });
      if (onDone) onDone();
    } catch (err) {
      toast({ status: 'error', title: err.message || 'Could not change the access code', duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setIsOpen(true)}>
        🔑 Access code
      </Button>
      <Modal isOpen={isOpen} onClose={close} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="md">Access code — {quiz.title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="lmFg.muted" mb={3}>
              Safe Exam Browser only runs on Windows and macOS, and has to be installed beforehand —
              real, known reasons a student cannot use it. One shared code lets you get a specific
              student into this test from an ordinary browser when that happens; hand it out
              yourself, to whoever actually needs it. Every use is still recorded on the attempt it
              unlocks.
            </Text>

            {code ? (
              <Alert status="success" borderRadius="md" fontSize="sm" flexDirection="column" alignItems="flex-start">
                <HStack>
                  <AlertIcon />
                  <Text fontWeight="600">Copy this now — it will not be shown again.</Text>
                </HStack>
                <HStack mt={2}>
                  <Text fontFamily="mono" fontSize="lg" fontWeight="700" letterSpacing="0.1em">
                    {code}
                  </Text>
                  <Button size="xs" onClick={clip.onCopy}>
                    {clip.hasCopied ? 'Copied' : 'Copy'}
                  </Button>
                </HStack>
              </Alert>
            ) : (
              <Text fontSize="sm" color={enabled ? 'lmFg.muted' : 'lmFg.subtle'}>
                {enabled
                  ? 'A code is active. Generating a new one replaces it — the old code stops working the moment you do.'
                  : 'No code is active for this paper.'}
              </Text>
            )}
          </ModalBody>
          <ModalFooter gap={2}>
            {enabled && (
              <Button size="sm" variant="outline" colorScheme="red" isLoading={busy} onClick={() => run({ clear: true })}>
                Turn off
              </Button>
            )}
            <Button size="sm" colorScheme="purple" isLoading={busy} onClick={() => run({})}>
              {enabled ? 'Generate a new code' : 'Enable and generate a code'}
            </Button>
            <Button size="sm" variant="ghost" onClick={close}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
