import React, { useState } from 'react';
import {
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
 * The code itself now lives on the card, beside the room code — this dialog is
 * where it is turned on, replaced and turned off, not the only place it can be
 * read. It used to be shown once and never again (only a hash was kept), which
 * meant a teacher who closed this dialog could only get back to a code by
 * minting a replacement, silently retiring the one already handed out.
 */
export default function AccessCodeButton({ classId, quiz, onDone }) {
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Seeded from the card's own copy of the settings — the code is stored in the
  // clear now, so opening this needs no fetch to know what is set.
  const [code, setCode] = useState(quiz.settings?.sebBypassCode || '');
  const [enabled, setEnabled] = useState(Boolean(quiz.settings?.sebBypassEnabled));
  const clip = useClipboard(code);
  const toast = useToast();

  const close = () => setIsOpen(false);

  const run = async (body) => {
    setBusy(true);
    try {
      const result = await lmApi.setSebBypassCode(classId, quiz._id, body);
      setEnabled(Boolean(result.settings?.sebBypassEnabled));
      setCode(result.settings?.sebBypassCode || '');
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
              <Box borderWidth="1px" borderColor="lmHue.purple200" bg="lmHue.purple50" borderRadius="md" p={4}>
                <Text fontSize="xs" color="lmFg.muted" mb={1}>
                  Current access code — also on the quiz card and in Live control
                </Text>
                <HStack>
                  <Text fontFamily="mono" fontSize="2xl" fontWeight="800" letterSpacing="0.15em" userSelect="all">
                    {code}
                  </Text>
                  <Button size="xs" onClick={clip.onCopy}>
                    {clip.hasCopied ? 'Copied' : 'Copy'}
                  </Button>
                </HStack>
                <Text fontSize="xs" color="lmFg.muted" mt={1}>
                  Generating a new one replaces it — the old code stops working the moment you do.
                </Text>
              </Box>
            ) : (
              <Text fontSize="sm" color={enabled ? 'lmFg.muted' : 'lmFg.subtle'}>
                {enabled
                  ? 'A code is active but was minted before codes were kept readable, so it cannot be shown. Generate a new one to see it here.'
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
