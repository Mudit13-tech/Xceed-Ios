import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { looksLikeEmail, EMAIL_AS_NAME_MESSAGE } from '../displayName';

/**
 * The one correction an account may make to the name and roll number it gave.
 *
 * `CompleteProfile` asks for both once, on a first sign-in, and then locks
 * them: they are printed on rosters, gradebooks and result sheets, and a
 * teacher marking by them has to be able to trust that last week's row is this
 * week's person. That still holds — but it left a student who transposed two
 * digits of their own roll number with no route but an administrator, for a
 * typo they can see and nobody else can.
 *
 * So this is offered exactly once, and every part of it says so: the menu item
 * that opens it, the badge in the header, the warning above the fields, the
 * confirm on the button. Somebody about to spend their only edit should not be
 * able to miss that that is what they are doing.
 *
 * The server holds the actual rule — it stamps the account and refuses a second
 * correction — so nothing here is load-bearing beyond making the terms plain.
 */
export default function EditIdentityModal({ isOpen, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  // Staff have no roll number to correct; the server decides which of them this
  // account is asked for, exactly as it does for the first-time form.
  const [needsRoll, setNeedsRoll] = useState(false);
  // A roll number the institute uploaded is shown back but not editable — the
  // server refuses a change to it either way, and a field that takes a value it
  // will not keep is worse than one that says why it is closed.
  const [rollLocked, setRollLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  // Opens with what is stored, because a correction is nearly always one
  // character of it: retyping a whole name to fix a roll number invites a
  // second mistake in the field that was right.
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setError('');
    setLoading(true);
    lmApi
      .myIdentity()
      .then((identity) => {
        if (cancelled) return;
        setName(identity.name || '');
        setRollNumber(identity.rollNumber || '');
        setNeedsRoll(Boolean(identity.required));
        setRollLocked(Boolean(identity.rollNumberLocked));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load your details.');
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
    if (needsRoll && !rollLocked && !trimmedRoll) {
      setError('Your roll number is required.');
      return;
    }
    // The edit is spent whether or not it changed anything, so it is worth one
    // question — this is the only point at which it can still be called off.
    const confirmed = window.confirm(
      needsRoll && !rollLocked
        ? `Save "${trimmedName}" and roll number "${trimmedRoll}"?\n\nThis is your one-time edit. After this, only an administrator can change them.`
        : `Save "${trimmedName}"?\n\nThis is your one-time edit. After this, only an administrator can change it.`,
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      await lmApi.correctIdentity({ name: trimmedName, rollNumber: trimmedRoll });
      toast({
        title: 'Details updated',
        description: 'Your one-time edit has been used.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      // The shell re-reads the profile: that is what takes the menu item away.
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save your details. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={2} align="center">
            <Text>{rollLocked ? 'Edit name' : 'Edit name & roll number'}</Text>
            <Badge colorScheme="orange" borderRadius="full" px={2}>
              One-time only
            </Badge>
          </HStack>
        </ModalHeader>
        <ModalCloseButton isDisabled={saving} />
        <ModalBody>
          {loading ? (
            <VStack py={6}>
              <Spinner />
            </VStack>
          ) : (
            <VStack align="stretch" spacing={4}>
              <Alert status="warning" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {rollLocked
                  ? 'You can correct your name once. Once saved, only an administrator can change it again — check the spelling before you save.'
                  : 'You can correct these once. Once saved, only an administrator can change them again — check the spelling before you save.'}
              </Alert>

              {error && (
                <Alert status="error" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              <FormControl isRequired>
                <FormLabel>Full name</FormLabel>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="As it should appear on results"
                  maxLength={80}
                />
                <FormHelperText fontSize="xs">
                  Your name, not your email address — this is what appears on rosters and
                  result sheets.
                </FormHelperText>
              </FormControl>

              {needsRoll && (
                <FormControl isRequired>
                  <FormLabel>Roll number</FormLabel>
                  <Input
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !saving && submit()}
                    placeholder="e.g. 21103078"
                    maxLength={40}
                    isReadOnly={rollLocked}
                    isDisabled={rollLocked}
                  />
                  <FormHelperText fontSize="xs">
                    {rollLocked
                      ? 'From your institute’s student records. Tell your teacher or the office if it is wrong — it cannot be changed here.'
                      : 'Exactly as your institute issued it. Your teachers find your marks by this.'}
                  </FormHelperText>
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
            Save — uses my one edit
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
