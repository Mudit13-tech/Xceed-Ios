import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Flex,
  VStack,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { looksLikeEmail, EMAIL_AS_NAME_MESSAGE } from '../displayName';

/**
 * The way an account already in use fixes the name it is being shown under.
 *
 * Every account is created with its email address in the name field, and until
 * now only students were ever asked to replace it — through `CompleteProfile`,
 * the one-time gate that also collects a roll number. Staff never met that gate
 * at all, and a student who had already pushed past it by accepting the
 * prefilled address had no second chance either: their name read
 * `21103078@nitj.ac.in` on every roster, gradebook and exported result sheet
 * with nothing anywhere to change it.
 *
 * So this is the menu-reachable version of the same question: a dialog rather
 * than a page, because unlike the first-run gate it is a correction someone
 * chose to make and can abandon. It posts to the same endpoint, which does the
 * same refusing — the browser only says so sooner.
 *
 * Students are still asked for their roll number here, because the endpoint
 * requires one and an account that never gave it would otherwise be unable to
 * save. `required` comes from the server rather than being guessed from roles.
 */
export default function EditNameDialog({ isOpen, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [needsRoll, setNeedsRoll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  // Re-read every time it opens: the identity may have changed in another tab,
  // and a dialog that opens on a stale answer invites overwriting a good name
  // with an older one.
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    lmApi
      .myIdentity()
      .then((identity) => {
        if (cancelled) return;
        // Blank when the stored name is really an email address — the field
        // should ask, not offer the placeholder back for another click.
        setName(identity.name || '');
        setRollNumber(identity.rollNumber || '');
        setNeedsRoll(Boolean(identity.required));
      })
      .catch(() => {
        // A failed prefill is not a failed form: it opens empty instead.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const submit = async () => {
    setError('');
    const trimmedName = name.trim();
    const trimmedRoll = rollNumber.trim();
    if (trimmedName.length < 2) {
      setError('Enter your full name as it should appear on results.');
      return;
    }
    if (looksLikeEmail(trimmedName)) {
      setError(EMAIL_AS_NAME_MESSAGE);
      return;
    }
    if (needsRoll && !trimmedRoll) {
      setError('Your roll number is required.');
      return;
    }
    setSaving(true);
    try {
      await lmApi.saveIdentity({ name: trimmedName, rollNumber: trimmedRoll });
      toast({
        title: 'Your name has been updated.',
        description: 'Rosters and result sheets now show it instead of your email address.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save your name. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit your name</ModalHeader>
        <ModalCloseButton isDisabled={saving} />
        <ModalBody>
          {loading ? (
            <Flex justify="center" py={6}>
              <Spinner />
            </Flex>
          ) : (
            <VStack spacing={4} align="stretch">
              {error && (
                <Alert status="error" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              <FormControl isRequired>
                <FormLabel>Full Name</FormLabel>
                <Input
                  placeholder="As it should appear on results"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !saving && submit()}
                  maxLength={80}
                  autoFocus
                />
                <FormHelperText fontSize="xs">
                  Your name, not your email address — this is what your teachers see
                  on rosters and result sheets.
                </FormHelperText>
              </FormControl>

              {needsRoll && (
                <FormControl isRequired>
                  <FormLabel>Roll Number</FormLabel>
                  <Input
                    placeholder="e.g. 21103078"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !saving && submit()}
                    maxLength={40}
                  />
                </FormControl>
              )}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button
            colorScheme="cyan"
            onClick={submit}
            isLoading={saving}
            loadingText="Saving"
            isDisabled={loading}
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
