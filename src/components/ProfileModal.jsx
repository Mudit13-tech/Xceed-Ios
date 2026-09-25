import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import useUserDetails from './useUserDetails';
import { openDobEditor, formatDob } from './DobGate';

/**
 * "Edit profile": the account's name, roll number, email and date of birth in
 * one place, each with the edit it is allowed.
 *
 * The date of birth is shown here and nowhere else — not on the account menu,
 * where anybody glancing at the screen would read it.
 *
 * Mounted once in App.jsx and opened from any account menu with
 * `openProfile()`. Name and roll number use the learning module's one-time
 * correction (EditIdentityModal), so they are editable here only for accounts
 * that module serves; the date of birth uses DobGate's one-time edit.
 */

const OPEN_EVENT = 'xceed:open-profile';
/** Fired after a change here, so a screen holding its own copy (the learning
 *  module's header) can re-read it. */
export const PROFILE_UPDATED_EVENT = 'xceed:profile-updated';

export const openProfile = () => window.dispatchEvent(new Event(OPEN_EVENT));

const EditIdentityModal = lazy(() => import('../learningModule/components/EditIdentityModal'));

// Mirrors LEARNING_ROLES on the server (helpdesk accountSnapshot / lmAuth).
const LEARNING_ROLES = ['STUDENT', 'FACULTY', 'ADMIN', 'LM-ADMIN'];

function Row({ label, value, badge, action }) {
  return (
    <HStack align="flex-start" justify="space-between" spacing={4} py={2}>
      <Box minW={0}>
        <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">
          {label}
          {badge}
        </Text>
        <Text fontSize="md" wordBreak="break-word">
          {value || '—'}
        </Text>
      </Box>
      {action}
    </HStack>
  );
}

export default function ProfileModal() {
  const queryClient = useQueryClient();
  const [isOpen, setOpen] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);

  const { user } = useUserDetails();

  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  if (!user) return null;

  const roles = (Array.isArray(user.role) ? user.role : [user.role]).map((role) => String(role || '').trim().toUpperCase());
  const isStudent = roles.includes('STUDENT');
  // The name/roll correction belongs to the learning module, so other accounts
  // have no such edit at all — neither available nor used.
  const hasIdentityEdit = roles.some((role) => LEARNING_ROLES.includes(role));
  const canEditIdentity = hasIdentityEdit && !user.lmIdentityCorrectedAt;
  const emails = (Array.isArray(user.email) ? user.email : [user.email]).filter(Boolean);
  const hasDob = /^\d{4}-\d{2}-\d{2}$/.test(String(user.dob || ''));
  const canEditDob = hasDob && !user.dobCorrectedAt;

  const oneTime = (available) => (
    <Badge ml={2} colorScheme={available ? 'orange' : 'gray'} fontSize="0.6rem" borderRadius="full">
      {available ? 'One-time edit' : 'Edit used'}
    </Badge>
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user', 'details'] });
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={() => setOpen(false)} isCentered size="md">
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader>Edit profile</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={0} divider={<Divider />}>
              <Row
                label="Name"
                value={user.name && !String(user.name).includes('@') ? user.name : ''}
                badge={hasIdentityEdit ? oneTime(canEditIdentity) : null}
                action={
                  canEditIdentity ? (
                    <Button size="sm" variant="outline" onClick={() => setEditingIdentity(true)}>
                      Edit
                    </Button>
                  ) : null
                }
              />
              {isStudent || user.rollNumber ? (
                <Row
                  label="Roll number"
                  value={user.rollNumber}
                  action={
                    canEditIdentity ? (
                      <Button size="sm" variant="outline" onClick={() => setEditingIdentity(true)}>
                        Edit
                      </Button>
                    ) : null
                  }
                />
              ) : null}
              <Row label="Email" value={emails.join(', ')} />
              <Row
                label="Date of birth"
                value={hasDob ? formatDob(user.dob) : 'Not added yet'}
                badge={hasDob ? oneTime(canEditDob) : null}
                action={
                  canEditDob || !hasDob ? (
                    <Button size="sm" variant="outline" onClick={openDobEditor}>
                      {hasDob ? 'Edit' : 'Add'}
                    </Button>
                  ) : null
                }
              />
            </VStack>
            <Text fontSize="xs" color="gray.500" mt={3}>
              Name, roll number and date of birth can each be corrected once. After that, or to
              change your email address, ask your administrator.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Loaded only when opened: it belongs to the learning module's chunk. */}
      {editingIdentity && (
        <Suspense fallback={null}>
          <EditIdentityModal isOpen onClose={() => setEditingIdentity(false)} onSaved={refresh} />
        </Suspense>
      )}
    </>
  );
}
