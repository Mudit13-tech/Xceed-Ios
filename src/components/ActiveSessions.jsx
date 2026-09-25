import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
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
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import getEnvironment from '../getenvironment';
import { deviceLabel, formatWhen } from './LoginHistory';

/**
 * "Active devices": where this account is signed in right now, with a
 * separate Log out for each, and one to sign out everywhere else.
 *
 * Mounted once in App.jsx and opened from the account menus with
 * `openActiveSessions()`. The current device is marked rather than given a
 * button — it signs out with the menu's own Logout, which also clears this
 * browser. The server holds the rule (sessionRegistry.js): a session signed
 * out here stops working on its next request.
 */

const OPEN_EVENT = 'xceed:active-sessions';
const QUERY_KEY = ['user', 'sessions'];

export const openActiveSessions = () => window.dispatchEvent(new Event(OPEN_EVENT));

export default function ActiveSessions() {
  const apiUrl = getEnvironment();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isOpen, setOpen] = useState(false);
  const [busy, setBusy] = useState('');

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/user/getuser/sessions`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Could not load your active devices.');
      return response.json();
    },
    enabled: isOpen,
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    const open = () => {
      setOpen(true);
      refetch();
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, [refetch]);

  const post = async (path, key, success) => {
    setBusy(key);
    try {
      const response = await fetch(`${apiUrl}/user/getuser/sessions/${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Could not sign that device out.');
      toast({ status: 'success', title: success(body), duration: 3000 });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['user', 'login-history'] });
    } catch (failure) {
      toast({ status: 'error', title: failure.message, duration: 4000 });
    } finally {
      setBusy('');
    }
  };

  const sessions = data?.sessions || [];
  const others = sessions.filter((row) => !row.current);

  return (
    <Modal isOpen={isOpen} onClose={() => setOpen(false)} size="xl" scrollBehavior="inside" isCentered>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Active devices</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text fontSize="sm" mb={3}>
            Everywhere your account is signed in right now. If you do not recognise one, log it out
            and change your password from the Forgot Password page.
          </Text>
          {isPending ? (
            <Box textAlign="center" py={6}>
              <Spinner />
            </Box>
          ) : isError ? (
            <Text color="red.500" fontSize="sm">
              Could not load your active devices. Please try again.
            </Text>
          ) : (
            <VStack align="stretch" spacing={3}>
              {data?.currentKnown === false ? (
                <Alert status="info" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  This device signed in before device tracking started, so it is not listed. Log out
                  and back in to see it here.
                </Alert>
              ) : null}
              {!sessions.length ? (
                <Text fontSize="sm">No active sessions are recorded.</Text>
              ) : (
                sessions.map((row) => (
                  <HStack
                    key={row.id}
                    borderWidth="1px"
                    borderRadius="md"
                    px={3}
                    py={2}
                    justify="space-between"
                    align="center"
                    spacing={3}
                  >
                    <Box minW={0}>
                      <Text fontSize="sm" fontWeight="600" wordBreak="break-word">
                        {deviceLabel(row)}
                        {row.app === 'app' ? (
                          <Badge ml={2} colorScheme="purple" fontSize="0.6rem">
                            XCEED app
                          </Badge>
                        ) : null}
                        {row.current ? (
                          <Badge ml={2} colorScheme="green" fontSize="0.6rem">
                            This device
                          </Badge>
                        ) : null}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Signed in {formatWhen(row.createdAt)} · last active {formatWhen(row.lastSeenAt)}
                        {row.ip ? ` · ${row.ip}` : ''}
                      </Text>
                    </Box>
                    {row.current ? null : (
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="red"
                        flexShrink={0}
                        isLoading={busy === row.id}
                        isDisabled={Boolean(busy) && busy !== row.id}
                        onClick={() => post(`${encodeURIComponent(row.id)}/logout`, row.id, () => 'Device logged out')}
                      >
                        Log out
                      </Button>
                    )}
                  </HStack>
                ))
              )}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          {others.length > 1 ? (
            <Button
              colorScheme="red"
              variant="ghost"
              isLoading={busy === 'others'}
              isDisabled={Boolean(busy) && busy !== 'others'}
              onClick={() =>
                post('logout-others', 'others', (body) =>
                  `${body.count} other ${body.count === 1 ? 'device' : 'devices'} logged out`,
                )
              }
            >
              Log out all other devices
            </Button>
          ) : null}
          <Button onClick={() => setOpen(false)}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
