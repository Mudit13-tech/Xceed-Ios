import React, { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import getEnvironment from '../getenvironment';

/**
 * The signed-in account's own sign-ins: when, on what kind of device, from
 * which address.
 *
 * `LastLogin` is the one line an account menu shows; `LoginHistoryModal` is the
 * full list, mounted once in App.jsx and opened from any menu with
 * `openLoginHistory()` — the same pattern as the date-of-birth editor.
 *
 * The newest row is almost always the sign-in that opened this session, so the
 * menu line shows the one before it: that is the one worth checking.
 */

const OPEN_EVENT = 'xceed:login-history';

export const openLoginHistory = () => window.dispatchEvent(new Event(OPEN_EVENT));

const DEVICE_LABEL = {
  phone: 'Phone',
  tablet: 'Tablet',
  laptop: 'Laptop',
  computer: 'Laptop or desktop',
  unknown: 'Unknown device',
};

export const deviceLabel = (row) => {
  const kind = DEVICE_LABEL[row?.device] || DEVICE_LABEL.unknown;
  const detail = [row?.browser, row?.os && `on ${row.os}`].filter(Boolean).join(' ');
  return detail ? `${kind} · ${detail}` : kind;
};

export const formatWhen = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export function useLoginHistory(enabled = true) {
  const apiUrl = getEnvironment();
  return useQuery({
    queryKey: ['user', 'login-history'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/user/getuser/login-history?limit=50`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Could not load your login history.');
      const body = await response.json();
      return Array.isArray(body.logins) ? body.logins : [];
    },
    enabled,
    retry: false,
    staleTime: 60 * 1000,
  });
}

/** One line for an account menu: the sign-in before this one. */
export function LastLogin({ fontSize = 'xs', color }) {
  const { data, isPending, isError } = useLoginHistory();
  let line;
  if (isPending) line = 'Last login: loading…';
  else if (isError) line = 'Last login: unavailable';
  else if (!data[1]) line = 'Last login: none before this one';
  else line = `Last login: ${formatWhen(data[1].at)} · ${DEVICE_LABEL[data[1].device] || DEVICE_LABEL.unknown}`;
  return (
    <Text fontSize={fontSize} color={color} noOfLines={2}>
      {line}
    </Text>
  );
}

export default function LoginHistoryModal() {
  const [isOpen, setOpen] = useState(false);
  const { data, isPending, isError, refetch } = useLoginHistory(isOpen);

  useEffect(() => {
    const open = () => {
      setOpen(true);
      refetch();
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, [refetch]);

  return (
    <Modal isOpen={isOpen} onClose={() => setOpen(false)} size="2xl" scrollBehavior="inside" isCentered>
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Login history</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text fontSize="sm" mb={3}>
            Every sign-in to your account over the last year, newest first. If one was not you,
            change your password from the Forgot Password page straight away.
          </Text>
          {isPending ? (
            <Box textAlign="center" py={6}>
              <Spinner />
            </Box>
          ) : isError ? (
            <Text color="red.500" fontSize="sm">
              Could not load your login history. Please try again.
            </Text>
          ) : !data.length ? (
            <Text fontSize="sm">No sign-ins recorded yet.</Text>
          ) : (
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>When</Th>
                    <Th>Device</Th>
                    <Th>IP address</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {data.map((row, index) => (
                    <Tr key={row.id}>
                      <Td whiteSpace="nowrap">
                        {formatWhen(row.at)}
                        {index === 0 ? (
                          <Badge ml={2} colorScheme="green" fontSize="0.6rem">
                            Latest
                          </Badge>
                        ) : null}
                      </Td>
                      <Td>{deviceLabel(row)}</Td>
                      <Td fontFamily="mono">{row.ip || '—'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
          <Text fontSize="xs" color="gray.500" mt={3}>
            Laptops and desktops send the same browser details, so a computer is shown as a laptop
            only when its browser reported a battery at sign-in. The IP address is the one your network
            presents to XCEED; on campus Wi-Fi many people share it.
          </Text>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
