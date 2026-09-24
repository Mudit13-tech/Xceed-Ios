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
  Text,
  useToast,
} from '@chakra-ui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import getEnvironment from '../getenvironment';

/**
 * Date of birth, asked of every signed-in account.
 *
 * Mounted once, beside the Navbar, so it covers every route — including the
 * learning module and the attendance console, where the Navbar itself hides.
 * It reads the same `['user', 'details']` query the Navbar does, so it costs
 * no request of its own.
 *
 * Two modes:
 *  - **required** — the account has no date of birth. The dialog cannot be
 *    dismissed until one is saved: the forgot-password form checks it, so an
 *    account without one has a weaker way back in than everybody else.
 *  - **edit** — opened from an account menu (`openDobEditor()`), for the one
 *    correction an account gets, on the same terms as the one-time name edit.
 *
 * The server holds the rule (PUT /user/getuser/dob stamps the correction and
 * refuses a second); this only makes the terms plain before it is spent.
 */

const OPEN_EVENT = 'xceed:edit-dob';

/** Opens the one-time edit from anywhere — an account menu, a settings page. */
export const openDobEditor = () => window.dispatchEvent(new Event(OPEN_EVENT));

const USER_QUERY_KEY = ['user', 'details'];

const yearsAgo = (years) => {
  const now = new Date();
  now.setFullYear(now.getFullYear() - years);
  return now.toISOString().slice(0, 10);
};

/** "2004-05-06" → "6 May 2004", read as a calendar date with no timezone. */
export const formatDob = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export default function DobGate() {
  const apiUrl = getEnvironment();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isError } = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/user/getuser/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (response.status === 401) throw new Error('Unauthorized');
      if (!response.ok) throw new Error('Failed to fetch user details');
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const user = !isError ? data?.user : null;
  const savedDob = String(user?.dob || '');
  const hasDob = /^\d{4}-\d{2}-\d{2}$/.test(savedDob);
  const canEdit = hasDob && !user?.dobCorrectedAt;
  const required = Boolean(user) && !hasDob;

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const open = () => setEditing(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  const isOpen = required || (editing && Boolean(user));

  // Starts from what is saved, since a correction is usually one digit of it.
  useEffect(() => {
    if (isOpen) {
      setValue(savedDob);
      setError('');
    }
  }, [isOpen, savedDob]);

  const close = () => {
    if (!required) setEditing(false);
  };

  const save = async () => {
    setError('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setError('Enter your date of birth.');
      return;
    }
    if (canEdit && value !== savedDob) {
      // eslint-disable-next-line no-alert
      const sure = window.confirm(
        `Change your date of birth to ${formatDob(value)}? This is your only edit — after it, only an administrator can change it.`,
      );
      if (!sure) return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/user/getuser/dob`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dob: value }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Could not save your date of birth.');

      queryClient.setQueryData(USER_QUERY_KEY, (previous) =>
        previous?.user
          ? {
              ...previous,
              user: {
                ...previous.user,
                dob: body.dob,
                dobCorrectedAt: body.canEditDob ? previous.user.dobCorrectedAt || null : new Date().toISOString(),
              },
            }
          : previous,
      );
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
      setEditing(false);
      toast({ status: 'success', title: 'Date of birth saved', duration: 3000 });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      closeOnOverlayClick={!required}
      closeOnEsc={!required}
      isCentered
    >
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>{required ? 'Add your date of birth' : 'Edit your date of birth'}</ModalHeader>
        {!required && <ModalCloseButton />}
        <ModalBody>
          {required ? (
            <Text fontSize="sm" mb={4}>
              XCEED now asks every account for a date of birth. It is checked on the Forgot Password
              page together with your email, so only you can reset your password. You can correct it
              once afterwards.
            </Text>
          ) : canEdit ? (
            <Alert status="warning" borderRadius="md" fontSize="sm" mb={4}>
              <AlertIcon />
              You can change your date of birth only once. After that, only an administrator can
              change it.
            </Alert>
          ) : (
            <Alert status="info" borderRadius="md" fontSize="sm" mb={4}>
              <AlertIcon />
              Your date of birth is {formatDob(savedDob)}. You have already used your one-time edit —
              ask your administrator if it still needs correcting.
            </Alert>
          )}

          {(required || canEdit) && (
            <FormControl isRequired isInvalid={Boolean(error)}>
              <FormLabel htmlFor="dob-gate-input">Date of birth</FormLabel>
              <Input
                id="dob-gate-input"
                type="date"
                value={value}
                min="1920-01-01"
                max={yearsAgo(10)}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && save()}
              />
              {hasDob ? (
                <FormHelperText>Currently saved: {formatDob(savedDob)}</FormHelperText>
              ) : null}
            </FormControl>
          )}

          {error ? (
            <Alert status="error" borderRadius="md" fontSize="sm" mt={3}>
              <AlertIcon />
              {error}
            </Alert>
          ) : null}
        </ModalBody>
        <ModalFooter gap={2}>
          {!required && (
            <Button variant="ghost" onClick={close}>
              {canEdit ? 'Cancel' : 'Close'}
            </Button>
          )}
          {(required || canEdit) && (
            <Button colorScheme="cyan" onClick={save} isLoading={saving}>
              {required ? 'Save' : 'Use my one edit'}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
