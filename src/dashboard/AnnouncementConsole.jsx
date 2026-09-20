// client/src/dashboard/AnnouncementConsole.jsx
//
// One message, typed here, pushed to every device with the app installed. At
// /superadmin/announce.
//
// It is a page of its own rather than a card on the roles page because of what
// it does: there is no recipient list to narrow, no draft saved anywhere, and
// no way to take a message back once it is sent. A control like that should be
// somewhere an admin arrives on purpose, not something they can fire off while
// picking which workspace to open.
//
// Underneath the box is what has already gone out. A sent message is still
// unrecallable, but an admin who wants to know whether Sunday's maintenance
// notice actually left — and how many phones it reached — no longer has only a
// toast they dismissed. The history is read-only by design: nothing in it can
// be edited or re-sent, because a row here is an account of something that
// already happened.

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  Input,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { FiArrowLeft, FiSend } from 'react-icons/fi';
import getEnvironment from '../getenvironment';

const apiUrl = getEnvironment();

// What a notification tray will actually show. The server enforces the same two
// numbers; they are repeated here so the count runs out under the box rather
// than coming back as a 400.
const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 240;

// "4 Mar 2026, 3:00 pm" — the date and the time both matter for a notice whose
// whole point was often a window that has since passed.
const formatSentAt = (value) => {
  if (!value) return '—';
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return '—';
  return when.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const AnnouncementConsole = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const iconBg = useColorModeValue('orange.50', 'orange.900');
  const iconColor = useColorModeValue('orange.600', 'orange.300');
  const previewBg = useColorModeValue('gray.100', 'gray.700');
  const headBg = useColorModeValue('gray.50', 'gray.700');
  const rowHover = useColorModeValue('gray.50', 'whiteAlpha.50');

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/superadmin');
  };

  // Also called after a send, so the row an admin just created appears without
  // a reload — with the delivery counts the server recorded rather than the
  // ones the toast happened to quote.
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/announcements`, {
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setHistoryError(data.error || 'Could not load the messages sent so far.');
        return;
      }
      setHistoryError('');
      setHistory(Array.isArray(data.announcements) ? data.announcements : []);
    } catch (err) {
      console.error(err);
      setHistoryError('The server could not be reached.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSend = async (event) => {
    event.preventDefault();
    setIsSending(true);

    try {
      const response = await fetch(`${apiUrl}/api/v1/announcements/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast({
          title: 'Message sent',
          description: data.message || 'Every registered device has been notified.',
          status: 'success',
          duration: 6000,
          isClosable: true,
        });
        setTitle('');
        setBody('');
        loadHistory();
      } else {
        toast({
          title: 'Could not send the message',
          description: data.error || 'Please check the server logs.',
          status: 'error',
          duration: 8000,
          isClosable: true,
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: 'Could not send the message',
        description: 'The server could not be reached.',
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Box bg={pageBg} minH="100vh" py={{ base: 8, md: 14 }}>
      <Container maxW="4xl">
        <Flex align="center" gap={4} mb={{ base: 6, md: 10 }} flexWrap="wrap">
          <Flex
            align="center"
            justify="center"
            boxSize={12}
            borderRadius="lg"
            bg={iconBg}
            color={iconColor}
          >
            <Icon as={FiSend} boxSize={6} />
          </Flex>
          <Box>
            <Heading as="h1" size="lg">
              Message All Users
            </Heading>
            <Text color={subColor}>
              A push notification to every device with the app installed.
            </Text>
          </Box>
          <Button leftIcon={<FiArrowLeft />} variant="outline" size="sm" ml="auto" onClick={goBack}>
            Back
          </Button>
        </Flex>

        <Box
          as="form"
          onSubmit={handleSend}
          bg={cardBg}
          borderWidth="1px"
          borderColor={border}
          borderRadius="xl"
          p={{ base: 5, md: 6 }}
        >
          <Text fontSize="sm" color={subColor} mb={5}>
            This reaches everyone who has the app installed and notifications turned
            on — students and faculty alike. It cannot be edited or taken back once
            sent; the table below is a record of what went out, not a way to undo it.
          </Text>

          <FormControl isRequired mb={4}>
            <FormLabel fontSize="sm" mb={1}>
              Title
            </FormLabel>
            <Input
              placeholder="Portal down for maintenance"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE_LENGTH}
            />
            <Text fontSize="xs" color={subColor} mt={1}>
              {title.length}/{MAX_TITLE_LENGTH} — the line people read on a lock screen
            </Text>
          </FormControl>

          <FormControl mb={5}>
            <FormLabel fontSize="sm" mb={1}>
              Message
            </FormLabel>
            <Textarea
              placeholder="XCEED will be unavailable on Sunday from 2 to 4 PM."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_BODY_LENGTH}
              rows={4}
              resize="vertical"
            />
            <Text fontSize="xs" color={subColor} mt={1}>
              {body.length}/{MAX_BODY_LENGTH} — optional
            </Text>
          </FormControl>

          {/* What the message will look like sitting in a tray. Worth the few
              lines: a title that reads fine in a form field is often the one
              that turns out to be a paragraph on a phone. */}
          {title.trim() && (
            <Box bg={previewBg} borderRadius="lg" p={4} mb={5}>
              <Text fontSize="xs" color={subColor} textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                Preview
              </Text>
              <Text fontWeight="semibold" fontSize="sm" noOfLines={1}>
                {title.trim()}
              </Text>
              {body.trim() && (
                <Text fontSize="sm" color={subColor} noOfLines={2}>
                  {body.trim()}
                </Text>
              )}
            </Box>
          )}

          <Button
            type="submit"
            colorScheme="orange"
            leftIcon={<FiSend />}
            isLoading={isSending}
            loadingText="Sending"
            isDisabled={!title.trim()}
          >
            Send to everyone
          </Button>
        </Box>

        <Box
          bg={cardBg}
          borderWidth="1px"
          borderColor={border}
          borderRadius="xl"
          mt={{ base: 6, md: 8 }}
          overflow="hidden"
        >
          <Flex
            align="center"
            justify="space-between"
            gap={3}
            px={{ base: 5, md: 6 }}
            py={4}
            borderBottomWidth="1px"
            borderColor={border}
            flexWrap="wrap"
          >
            <Box>
              <Heading as="h2" size="sm">
                Messages sent
              </Heading>
              <Text fontSize="sm" color={subColor}>
                Delivery counts are as of the moment each message left.
              </Text>
            </Box>
            {isLoadingHistory && <Spinner size="sm" color={iconColor} />}
          </Flex>

          {historyError ? (
            <Box px={{ base: 5, md: 6 }} py={8} textAlign="center">
              <Text fontSize="sm" color={subColor} mb={3}>
                {historyError}
              </Text>
              <Button size="sm" variant="outline" onClick={loadHistory}>
                Try again
              </Button>
            </Box>
          ) : !history.length && !isLoadingHistory ? (
            <Box px={{ base: 5, md: 6 }} py={10} textAlign="center">
              <Text fontSize="sm" color={subColor}>
                No messages have been sent yet. The first one will appear here.
              </Text>
            </Box>
          ) : (
            <TableContainer>
              <Table size="sm" variant="simple">
                <Thead bg={headBg}>
                  <Tr>
                    <Th>Message</Th>
                    <Th>Sent by</Th>
                    <Th>Sent</Th>
                    <Th isNumeric>Delivered</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {history.map((item) => (
                    <Tr key={item.id} _hover={{ bg: rowHover }}>
                      <Td maxW={{ base: '200px', md: '360px' }} whiteSpace="normal">
                        <Text fontSize="sm" fontWeight="medium">
                          {item.title}
                        </Text>
                        {item.body && (
                          <Text fontSize="xs" color={subColor} noOfLines={2}>
                            {item.body}
                          </Text>
                        )}
                      </Td>
                      <Td fontSize="sm" color={subColor} whiteSpace="nowrap">
                        {item.sentByName || 'Unknown admin'}
                      </Td>
                      <Td fontSize="sm" color={subColor} whiteSpace="nowrap">
                        {formatSentAt(item.sentAt)}
                      </Td>
                      <Td isNumeric whiteSpace="nowrap">
                        <Text fontSize="sm">
                          {item.sent}/{item.devices}
                        </Text>
                        {/* Only worth a line when some devices were missed —
                            on a clean send the fraction above already says so. */}
                        {item.failed > 0 && (
                          <Badge colorScheme="red" variant="subtle" fontSize="0.65rem">
                            {item.failed} failed
                          </Badge>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Container>
    </Box>
  );
};

export default AnnouncementConsole;
