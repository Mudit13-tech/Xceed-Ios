import React, { useEffect, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Stack,
  Text,
} from '@chakra-ui/react';

/**
 * The question asked before a Short goes live: does the class get mailed?
 *
 * Starting a session mails every member the join code, and that is the half of
 * the launch the teacher cannot see happen — a rehearsal, a re-run of the same
 * deck in the next hour, or a room already sitting in front of them all used to
 * put an unwanted mail in everyone's inbox with no way to take it back. So the
 * deck's own "Email the class when I start it" setting is now an *offer* rather
 * than a decision: it picks the option this dialog opens on, and the teacher
 * confirms or flips it for this run.
 *
 * Shared by the Shorts list and the editor so the two ways into presenting
 * cannot start asking different questions.
 */
export default function StartShortModal({ isOpen, onClose, short, onConfirm, isBusy }) {
  // `emailOnStart` is on unless explicitly turned off — decks saved before the
  // setting existed must read as on, the same rule the editor's switch uses.
  const deckDefault = short?.settings?.emailOnStart !== false;
  const [choice, setChoice] = useState('email');

  // Re-arm on each opening, so a teacher who suppressed mail for one run does
  // not silently carry that choice into the next deck they present.
  useEffect(() => {
    if (isOpen) setChoice(deckDefault ? 'email' : 'quiet');
  }, [isOpen, deckDefault]);

  if (!short) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Start &quot;{short.title}&quot;</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text fontSize="sm" mb={3}>
            The class always gets an in-app notification with the join code. Should they be emailed
            as well?
          </Text>
          <RadioGroup value={choice} onChange={setChoice}>
            <Stack spacing={3}>
              <Radio value="email">
                <Text fontSize="sm">Email the class the join code</Text>
                <Text fontSize="xs" color="gray.600">
                  One mail per member, sent as the session starts. It cannot be recalled.
                </Text>
              </Radio>
              <Radio value="quiet">
                <Text fontSize="sm">Start without emailing</Text>
                <Text fontSize="xs" color="gray.600">
                  For a rehearsal, a re-run, or a room already in front of you.
                </Text>
              </Radio>
            </Stack>
          </RadioGroup>
          <Text fontSize="xs" color="gray.500" mt={4}>
            {deckDefault
              ? 'This deck is set to email on start (Edit → “Email the class when I start it”).'
              : 'This deck is set not to email on start (Edit → “Email the class when I start it”).'}
          </Text>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose} isDisabled={isBusy}>
            Cancel
          </Button>
          <Button
            colorScheme="purple"
            onClick={() => onConfirm(choice === 'email')}
            isLoading={isBusy}
          >
            {choice === 'email' ? 'Start & email' : 'Start without email'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
