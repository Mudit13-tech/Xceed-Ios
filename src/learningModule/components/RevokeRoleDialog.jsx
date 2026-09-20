import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  UnorderedList,
  ListItem,
  VStack,
} from '@chakra-ui/react';

import lmApi from '../api/lmApi';
import { LmIcon } from './Icon';

/**
 * Taking FACULTY or STUDENT back off one account, from either directory.
 *
 * One component for both roles because the decision an administrator is making
 * is the same one, and the thing that makes it a decision rather than a button
 * is the part people get wrong: this removes a *role*, not a person. The copy
 * below is most of the component for that reason — it says what stays, not just
 * what goes, because "delete" next to somebody's name reads as "delete
 * somebody" and this has never been that.
 *
 * The typed-name confirmation is the same one the class deletion on the admin
 * dashboard asks for, and for the same reason: the row under the pointer is one
 * of two hundred in a table that regroups itself as it loads.
 */

const ROLE_COPY = {
  FACULTY: {
    title: 'Remove the FACULTY role',
    what: 'They will no longer be able to open a class, set a paper or read an answer key.',
    // The one thing an administrator reliably expects this to do and it does
    // not. Stated before the button rather than in the toast afterwards.
    keeps: [
      'Their account, and every other role on it.',
      'Classes they already own — they keep teaching those, because a class hands its owner a teacher role directly. Archive or delete those from the class itself if they should end too.',
      'Everything students have handed in to them, and every grade they have given.',
    ],
  },
  STUDENT: {
    title: 'Remove the STUDENT role',
    what: 'They will no longer be able to join a class with a joining code.',
    keeps: [
      'Their account, and every other role on it.',
      'Classes they have already joined, unless you also end those below.',
      'Their submissions, grades and past quiz attempts, which stay on the record either way.',
    ],
  },
};

export default function RevokeRoleDialog({ role, person, isOpen, onClose, onDone }) {
  const [typed, setTyped] = useState('');
  const [endEnrolments, setEndEnrolments] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A dialog reopened on a different row must not carry the last row's typed
  // confirmation — that is exactly how the wrong account loses a role.
  useEffect(() => {
    if (isOpen) {
      setTyped('');
      setEndEnrolments(false);
      setError('');
    }
  }, [isOpen, person?._id]);

  if (!person) return null;

  const copy = ROLE_COPY[role];
  // The name is what the table shows and so what there is to type; an account
  // created by an invite has the address there instead.
  const confirmWith = person.name || person.email || '';
  const enrolled = person.classCount || 0;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const result = role === 'STUDENT'
        ? await lmApi.adminRevokeStudent(person._id, { endEnrolments })
        : await lmApi.adminRevokeFaculty(person._id);
      onDone(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not remove the role.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">{copy.title}</ModalHeader>
        <ModalCloseButton isDisabled={busy} />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <Box>
              <Text fontSize="sm" fontWeight="600">
                {person.name || '—'}
              </Text>
              <Text fontSize="xs" color="lmFg.muted">
                {person.email}
                {person.dept ? ` · ${person.dept}` : ''}
              </Text>
            </Box>

            <Text fontSize="sm">{copy.what}</Text>

            <Box>
              <Text fontSize="sm" fontWeight="600" mb={1}>
                What this does not touch
              </Text>
              <UnorderedList fontSize="sm" color="lmFg.muted" spacing={1}>
                {copy.keeps.map((line) => (
                  <ListItem key={line}>{line}</ListItem>
                ))}
              </UnorderedList>
            </Box>

            {/* Only on the student side, because it is only there that it
                works: a faculty member's standing in the classes they own
                comes off the class, not a membership, so a checkbox here
                would promise something it could not carry out. */}
            {role === 'STUDENT' && (
              <Box borderWidth="1px" borderColor="lmBorder.default" borderRadius="md" p={3}>
                <Checkbox
                  isChecked={endEnrolments}
                  onChange={(event) => setEndEnrolments(event.target.checked)}
                  isDisabled={busy}
                >
                  <Text fontSize="sm">
                    Also remove them from the {enrolled} class{enrolled === 1 ? '' : 'es'} they have joined
                    <Text as="span" color="lmFg.muted">
                      {' '}— without this they keep reaching those classes, because being enrolled is
                      enough on its own. Their name stays on what they have already handed in.
                    </Text>
                  </Text>
                </Checkbox>
              </Box>
            )}

            <Alert status="warning" borderRadius="md" fontSize="xs" alignItems="flex-start">
              <AlertIcon boxSize={3} mt={1} />
              <Box>
                If this is the account&apos;s only role it will be left holding none, and will see no
                module at all until one is granted again. Re-granting it is the form at the top of
                this page.
              </Box>
            </Alert>

            <Box>
              <Text fontSize="sm" mb={1}>
                Type <strong>{confirmWith}</strong> to confirm.
              </Text>
              <Input
                size="sm"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={confirmWith}
                isDisabled={busy}
              />
            </Box>

            {error && (
              <Alert status="error" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={busy}>
            Cancel
          </Button>
          <Button
            colorScheme="red"
            leftIcon={<LmIcon name="delete" size={15} />}
            onClick={submit}
            isLoading={busy}
            isDisabled={typed.trim() !== confirmWith.trim()}
          >
            Remove {role}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
