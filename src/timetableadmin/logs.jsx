import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
  useToast,
  useColorModeValue,
  Icon,
  Button,
  Select,
  Flex,
  Menu,
  MenuButton,
  MenuList,
  IconButton,
  useDisclosure,
  Collapse,
  Divider,
  List,
  ListItem,
  ListIcon,
  Tag,
  TagLabel,
  Tooltip,
  Spinner,
  Wrap,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
} from '@chakra-ui/react';
import {
  FiList,
  FiChevronLeft,
  FiChevronRight,
  FiFilter,
  FiTrash2,
  FiPlusCircle,
  FiMinusCircle,
  FiEdit,
  FiClock,
  FiMapPin,
  FiChevronDown,
  FiChevronUp,
  FiSend,
  FiCheckCircle,
  FiAlertCircle,
  FiSlash,
} from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';
import getEnvironment from '../getenvironment.js';

const SLOT_TIME_MAP = {
  period1: '08:30 AM',
  period2: '09:30 AM',
  period3: '10:30 AM',
  period4: '11:30 AM',
  period5: '01:30 PM',
  period6: '02:30 PM',
  period7: '03:30 PM',
  period8: '04:30 PM',
};

const TimetableLockLog = ({ facultyChanges }) => {
  const { isOpen, onToggle } = useDisclosure();

  // Summary counts for the "Short Form"
  const totalAdded = facultyChanges.reduce(
    (acc, f) => acc + (f.changes.addedSubjects?.length || 0),
    0
  );
  const totalRemoved = facultyChanges.reduce(
    (acc, f) => acc + (f.changes.removedSubjects?.length || 0),
    0
  );
  const totalUpdated = facultyChanges.reduce(
    (acc, f) => acc + (f.changes.updatedSubjects?.length || 0),
    0
  );

  return (
    <Box>
      {/* Summary View (Short Form) */}
      <HStack wrap="wrap" spacing={2} mb={isOpen ? 4 : 0} maxW="100%">
        {totalAdded > 0 && (
          <Tag size="sm" colorScheme="green" variant="subtle">
            <TagLabel>+{totalAdded} Added</TagLabel>
          </Tag>
        )}
        {totalUpdated > 0 && (
          <Tag size="sm" colorScheme="blue" variant="subtle">
            <TagLabel>~{totalUpdated} Updated</TagLabel>
          </Tag>
        )}
        {totalRemoved > 0 && (
          <Tag size="sm" colorScheme="red" variant="subtle">
            <TagLabel>-{totalRemoved} Removed</TagLabel>
          </Tag>
        )}

        <Button
          size="xs"
          variant="ghost"
          colorScheme="purple"
          onClick={onToggle}
          rightIcon={isOpen ? <FiChevronUp /> : <FiChevronDown />}
        >
          {isOpen ? 'Show Less' : 'View Details'}
        </Button>
      </HStack>

      {/* Expanded View */}
      <Collapse in={isOpen} animateOpacity>
        <VStack
          align="stretch"
          spacing={4}
          mt={4}
          p={3}
          bg="gray.50"
          borderRadius="md"
          border="1px"
          borderColor="gray.100"
        >
          {facultyChanges.map(({ faculty, changes }, idx) => (
            <Box key={idx} pb={idx !== facultyChanges.length - 1 ? 3 : 0}>
              <Text
                fontWeight="bold"
                fontSize="sm"
                color="gray.700"
                mb={2}
                borderBottom="1px solid"
                borderColor="gray.200"
              >
                Faculty: {faculty}
              </Text>

              <VStack align="stretch" spacing={3} pl={2}>
                {/* ADDED SECTION */}
                {changes.addedSubjects?.map((s, i) => (
                  <Box key={`add-${i}`}>
                    <HStack fontSize="xs" fontWeight="bold" color="green.600">
                      <Icon as={FiPlusCircle} />
                      <Text>
                        {s.subject} ({s.sem})
                      </Text>
                    </HStack>
                    <List spacing={1} ml={5} mt={1}>
                      {s.entries.map((e, j) => (
                        <ListItem key={j} fontSize="xs" color="gray.600">
                          <Icon as={FiClock} mr={1} /> {e.day},{' '}
                          {SLOT_TIME_MAP[e.slot]}
                          <Icon as={FiMapPin} ml={2} mr={1} /> Room {e.room}
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ))}

                {/* UPDATED SECTION */}
                {changes.updatedSubjects?.map((u, i) => (
                  <Box key={`upd-${i}`}>
                    <HStack fontSize="xs" fontWeight="bold" color="blue.600">
                      <Icon as={FiEdit} />
                      <Text>
                        {u.subject} ({u.sem})
                      </Text>
                    </HStack>
                    <VStack align="stretch" ml={5} mt={1} spacing={1}>
                      {u.changes.room && (
                        <Text fontSize="xs" color="gray.600">
                          <b>Room:</b> {u.changes.room.from.join(', ')} →{' '}
                          <b>{u.changes.room.to.join(', ')}</b>
                        </Text>
                      )}
                      {u.changes.slots?.added?.length > 0 && (
                        <Text fontSize="xs" color="gray.600">
                          <Text as="span" color="green.600" fontWeight="bold">
                            Added:
                          </Text>{' '}
                          {u.changes.slots.added.join(', ')}
                        </Text>
                      )}
                      {u.changes.slots?.removed?.length > 0 && (
                        <Text fontSize="xs" color="gray.600">
                          <Text as="span" color="red.600" fontWeight="bold">
                            Removed:
                          </Text>{' '}
                          {u.changes.slots.removed.join(', ')}
                        </Text>
                      )}
                    </VStack>
                  </Box>
                ))}

                {/* REMOVED SECTION */}
                {changes.removedSubjects?.map((s, i) => (
                  <HStack
                    key={`rem-${i}`}
                    fontSize="xs"
                    color="red.500"
                    fontWeight="medium"
                  >
                    <Icon as={FiMinusCircle} />
                    <Text strikeThrough>
                      {s.subject} ({s.sem}) Removed
                    </Text>
                  </HStack>
                ))}
              </VStack>
              {idx !== facultyChanges.length - 1 && <Divider mt={4} />}
            </Box>
          ))}
        </VStack>
      </Collapse>
    </Box>
  );
};

/** Absolute local time, to the minute — the timestamp a coordinator quotes. */
const formatTimestamp = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/**
 * Counts per delivery status.
 *
 * The server sends these as `mailSummary`, but a resend replies with the
 * updated notifications only, so the same arithmetic has to exist here to
 * refresh the badge without refetching the page.
 */
const summariseNotifications = (notifications = []) => {
  const summary = {
    total: notifications.length,
    sent: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
    lastSentAt: null,
  };

  notifications.forEach((n) => {
    if (summary[n.status] === undefined) summary[n.status] = 0;
    summary[n.status] += 1;
    if (
      n.sentAt &&
      (!summary.lastSentAt ||
        new Date(n.sentAt) > new Date(summary.lastSentAt))
    ) {
      summary.lastSentAt = n.sentAt;
    }
  });

  return summary;
};

const STATUS_STYLE = {
  sent: { colorScheme: 'green', icon: FiCheckCircle, label: 'Delivered' },
  failed: { colorScheme: 'red', icon: FiAlertCircle, label: 'Failed' },
  pending: { colorScheme: 'yellow', icon: FiClock, label: 'Not sent yet' },
  // Not a failure: mail is turned off for this person on their faculty record.
  skipped: { colorScheme: 'gray', icon: FiSlash, label: 'Mail off' },
};

/**
 * Whether each teacher actually got the mail about this change, and a way to
 * send it again when they did not.
 *
 * Worth being explicit about what "Delivered" claims here, because a delivery
 * report that overstates itself is what this whole panel exists to replace: it
 * means the mail server accepted the message for that address at the timestamp
 * shown. It cannot mean the teacher read it, and it cannot see a message that
 * the receiving end later filed as spam. What it does rule out — and what used
 * to be reported as success regardless — is a refused login, a blocked port, a
 * rejected recipient, and a name that matched no faculty record at all.
 */
const MailDelivery = ({ log, apiUrl, onNotificationsUpdated, defaultOpen }) => {
  const { isOpen, onToggle, onOpen } = useDisclosure({ defaultIsOpen: defaultOpen });
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  // The row arrives after the first render (the logs are fetched), so the
  // deep-linked panel has to be opened once the flag turns true rather than
  // only at mount.
  useEffect(() => {
    if (defaultOpen) onOpen();
  }, [defaultOpen, onOpen]);

  const notifications = log.notifications || [];
  const summary = log.mailSummary || summariseNotifications(notifications);
  const unsent = notifications.filter(
    (n) => n.status !== 'sent' && n.status !== 'skipped'
  );
  const optedOut = notifications.filter((n) => n.status === 'skipped');

  const resend = async (notificationId) => {
    setBusy(notificationId || 'all');
    try {
      const res = await fetch(
        `${apiUrl}/timetablemodule/logs/${log._id}/resend`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(notificationId ? { notificationId } : {}),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Resend failed');

      onNotificationsUpdated(log._id, data.notifications || []);
      toast({
        title: data.failed ? 'Some mails still failed' : 'Mail resent',
        description: data.message,
        status: data.failed ? 'warning' : 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (e) {
      toast({
        title: 'Could not resend',
        description: e.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setBusy(null);
    }
  };

  if (!notifications.length) {
    return (
      <Tooltip
        label="Either the teachers were not informed for this change, or it predates delivery tracking."
        hasArrow
      >
        <Tag size="sm" colorScheme="gray" variant="subtle">
          <TagLabel>No mail record</TagLabel>
        </Tag>
      </Tooltip>
    );
  }

  return (
    <Box>
      <Wrap spacing={2} shouldWrapChildren>
        {summary.sent > 0 && (
          <Tag size="sm" colorScheme="green" variant="subtle">
            <ListIcon as={FiCheckCircle} mr={1} mb={0} />
            <TagLabel>{summary.sent} delivered</TagLabel>
          </Tag>
        )}
        {summary.failed > 0 && (
          <Tag size="sm" colorScheme="red" variant="subtle">
            <ListIcon as={FiAlertCircle} mr={1} mb={0} />
            <TagLabel>{summary.failed} failed</TagLabel>
          </Tag>
        )}
        {summary.pending > 0 && (
          <Tag size="sm" colorScheme="yellow" variant="subtle">
            <TagLabel>{summary.pending} not sent</TagLabel>
          </Tag>
        )}
        {summary.skipped > 0 && (
          <Tooltip
            label="Email notifications are turned off for these faculty members on the Add Faculty page."
            hasArrow
          >
            <Tag size="sm" colorScheme="gray" variant="subtle">
              <ListIcon as={FiSlash} mr={1} mb={0} />
              <TagLabel>{summary.skipped} mail off</TagLabel>
            </Tag>
          </Tooltip>
        )}

        <Button
          size="xs"
          variant="ghost"
          colorScheme="purple"
          onClick={onToggle}
          rightIcon={isOpen ? <FiChevronUp /> : <FiChevronDown />}
        >
          {isOpen ? 'Hide' : 'Mail status'}
        </Button>
      </Wrap>

      {summary.lastSentAt && !isOpen && (
        <Text fontSize="2xs" color="gray.500" mt={1}>
          Last delivered {formatTimestamp(summary.lastSentAt)}
        </Text>
      )}

      <Collapse in={isOpen} animateOpacity>
        <VStack
          align="stretch"
          spacing={3}
          mt={3}
          p={3}
          bg="gray.50"
          borderRadius="md"
          border="1px"
          borderColor="gray.100"
        >
          {unsent.length > 0 && (
            <Button
              size="xs"
              colorScheme="purple"
              alignSelf="flex-start"
              leftIcon={<FiSend />}
              isLoading={busy === 'all'}
              isDisabled={Boolean(busy)}
              onClick={() => resend()}
            >
              Resend all {unsent.length} unsent
            </Button>
          )}

          {unsent.length === 0 && optedOut.length > 0 && (
            <Text fontSize="xs" color="gray.500">
              Nothing to resend. {optedOut.length}{' '}
              {optedOut.length === 1 ? 'recipient has' : 'recipients have'} email
              notifications turned off.
            </Text>
          )}

          {notifications.map((n) => {
            const style = STATUS_STYLE[n.status] || STATUS_STYLE.pending;
            return (
              <Box
                key={n._id}
                borderBottom="1px solid"
                borderColor="gray.200"
                pb={2}
                _last={{ borderBottom: 'none', pb: 0 }}
              >
                <HStack justify="space-between" align="start" spacing={2}>
                  <Box minW={0}>
                    <Text fontSize="xs" fontWeight="bold" color="gray.700">
                      {n.facultyName}
                    </Text>
                    <Text fontSize="xs" color="gray.600" wordBreak="break-all">
                      {n.email || 'no address on record'}
                    </Text>

                    <HStack spacing={2} mt={1} wrap="wrap">
                      <Tag size="sm" colorScheme={style.colorScheme} variant="subtle">
                        <ListIcon as={style.icon} mr={1} mb={0} />
                        <TagLabel>{style.label}</TagLabel>
                      </Tag>
                      {n.status === 'sent' ? (
                        <Text fontSize="2xs" color="gray.500">
                          <Icon as={FiClock} mr={1} />
                          {formatTimestamp(n.sentAt)}
                        </Text>
                      ) : (
                        n.lastAttemptAt && (
                          <Text fontSize="2xs" color="gray.500">
                            last tried {formatTimestamp(n.lastAttemptAt)}
                          </Text>
                        )
                      )}
                      {n.resendCount > 0 && (
                        <Tooltip
                          label={`Resent by ${n.lastResendBy || 'unknown'}`}
                          hasArrow
                        >
                          <Text fontSize="2xs" color="purple.500">
                            resent ×{n.resendCount}
                          </Text>
                        </Tooltip>
                      )}
                    </HStack>

                    {n.status !== 'sent' && n.error && (
                      <Text fontSize="2xs" color="red.500" mt={1}>
                        {n.error}
                      </Text>
                    )}
                    {n.status === 'sent' && n.messageId && (
                      <Text
                        fontSize="2xs"
                        color="gray.400"
                        mt={1}
                        wordBreak="break-all"
                      >
                        {n.messageId}
                      </Text>
                    )}
                  </Box>

                  <Tooltip
                    label={
                      n.status === 'skipped'
                        ? 'Email notifications are turned off for this faculty member. Turn them back on from the Add Faculty page.'
                        : n.email
                        ? n.status === 'sent'
                          ? 'Send this notification again'
                          : 'Try this notification again'
                        : 'Add an email address to this faculty record first'
                    }
                    hasArrow
                  >
                    <IconButton
                      size="xs"
                      variant="ghost"
                      colorScheme="purple"
                      aria-label={`Resend to ${n.facultyName}`}
                      icon={busy === n._id ? <Spinner size="xs" /> : <FiSend />}
                      isDisabled={
                        Boolean(busy) || !n.email || n.status === 'skipped'
                      }
                      onClick={() => resend(n._id)}
                    />
                  </Tooltip>
                </HStack>
              </Box>
            );
          })}
        </VStack>
      </Collapse>
    </Box>
  );
};

const Logs = () => {
  const apiUrl = getEnvironment();
  const toast = useToast();

  // `/tt/logs?log=<id>` is where the timetable page sends a coordinator whose
  // notification mails did not all go out. The row is opened and outlined so
  // they land on the failures rather than having to find the change again.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusLogId = searchParams.get('log');
  // `/tt/logs?dept=CSE` is the department view, linked from a department's own
  // timetable page. It is a starting filter, not a permission: the server
  // decides what this account may actually read and says so in `scope`.
  const deptParam = searchParams.get('dept') || '';

  // What the server will let this account see. `allDepts: false` means a
  // department coordinator, so the department filter is theirs already and
  // showing a picker would only offer choices it would refuse.
  const [scope, setScope] = useState({ allDepts: true, depts: [] });

  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [allDepts, setAllDepts] = useState([]);
  const [deptFilter, setDeptFilter] = useState(deptParam);
  const [sessionFilter, setSessionFilter] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState('');
  const [limit, setLimit] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const bgGradient = useColorModeValue(
    'linear(to-br, blue.50, purple.50, pink.50)',
    'gray.900'
  );
  const cardBg = useColorModeValue('rgba(255, 255, 255, 0.95)', 'gray.800');
  const borderColor = useColorModeValue('gray.300', 'gray.700');

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/timetablemodule/allotment/session`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data || []);
    } catch (e) {
      console.error(e);
    }
  }, [apiUrl]);

  const fetchTotal = useCallback(async () => {
    try {
      // Same department filter as the listing: a header reading "412 total
      // logs" over a table of eleven CSE rows is just wrong.
      const params = new URLSearchParams();
      if (deptFilter) params.set('dept', deptFilter);
      const res = await fetch(
        `${apiUrl}/timetablemodule/logs/total?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const data = await res.json();
      setTotalLogs(data.totalLogs || 0);
    } catch (e) {
      console.error(e);
    }
  }, [apiUrl, deptFilter]);

  const fetchLogs = useCallback(async () => {
    try {
      // One endpoint for every combination now: `/logs/get` takes both filters
      // as query parameters, so the three near-identical URLs this used to
      // build (and the two that could not express dept+session together) are
      // gone. The department-scoped routes are kept on the server for callers
      // that still use them.
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(limit),
      });
      if (deptFilter) params.set('dept', deptFilter);
      if (sessionFilter) params.set('session', sessionFilter);

      const res = await fetch(
        `${apiUrl}/timetablemodule/logs/get?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        // 403 is its own case: the account may not read these logs at all, or
        // asked for a department that is not theirs. Saying "error fetching
        // logs" would send a coordinator hunting for a fault that is not one.
        let detail = '';
        try {
          detail = (await res.json())?.error || '';
        } catch (parseError) {
          detail = '';
        }
        toast({
          title: res.status === 403 ? 'Not available' : 'Error fetching logs',
          description: detail || undefined,
          status: res.status === 403 ? 'warning' : 'error',
          duration: 6000,
          isClosable: true,
        });
        setLogs([]);
        setTotalLogs(0);
        return;
      }
      const data = await res.json();
      // support both older array responses and new { logs, totalLogs } shape
      const receivedLogs = Array.isArray(data) ? data : data.logs || [];
      const receivedTotal = Array.isArray(data)
        ? receivedLogs.length
        : data.totalLogs || 0;
      setLogs(receivedLogs);
      setTotalLogs(receivedTotal);
      if (data.scope) setScope(data.scope);
      if (!deptFilter)
        setAllDepts([
          ...new Set(receivedLogs.map((l) => l.dept).filter(Boolean)),
        ]);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error fetching logs',
        description: e.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  }, [apiUrl, currentPage, limit, deptFilter, sessionFilter, toast]);

  useEffect(() => {
    fetchSessions();
    fetchTotal();
  }, [fetchSessions, fetchTotal]);
  useEffect(() => {
    setCurrentPage(1);
    fetchLogs();
  }, [deptFilter, sessionFilter, limit, fetchLogs]);

  /**
   * Fold a resend's result back into the row it came from.
   *
   * Patching in place rather than refetching keeps whichever detail panels the
   * coordinator has expanded open — a refetch would collapse the row they are
   * working through, which is the row they still have failures in.
   */
  const applyNotifications = useCallback((logId, notifications) => {
    setLogs((prev) =>
      prev.map((log) =>
        log._id === logId
          ? {
              ...log,
              notifications,
              mailSummary: {
                ...summariseNotifications(notifications),
                requested: log.mailSummary?.requested ?? true,
              },
            }
          : log
      )
    );
  }, []);

  const focusRow = focusLogId
    ? logs.find((log) => log._id === focusLogId)
    : null;
  const focusUnsent = focusRow
    ? (focusRow.notifications || []).filter((n) => n.status !== 'sent').length
    : 0;

  const deleteSessionLogs = async (session) => {
    if (!session)
      return toast({
        title: 'Select a session first',
        status: 'warning',
        duration: 2500,
        isClosable: true,
      });
    if (
      !window.confirm(
        `Delete all logs for session "${session}"? This cannot be undone.`
      )
    )
      return;
    try {
      const res = await fetch(
        `${apiUrl}/timetablemodule/logs/session/${encodeURIComponent(session)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (!res.ok)
        return toast({
          title: 'Failed to delete logs',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      const data = await res.json();
      toast({
        title: `Deleted ${data.deletedCount || 0} logs`,
        status: 'success',
        duration: 2500,
        isClosable: true,
      });
      fetchLogs();
      fetchTotal();
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error deleting logs',
        description: e.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <Box bgGradient={bgGradient} minH="100vh" pb={{ base: 10, md: 16 }} overflowX="hidden">
      <Box
        bgGradient="linear(to-r, purple.600, blue.600, teal.500)"
        pt={{ base: 5, md: 8 }}
        pb={{ base: 16, md: 20 }}
        position="relative"
        overflow="hidden"
      >
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          opacity="0.1"
          bgImage="radial-gradient(circle, white 1px, transparent 1px)"
          bgSize="30px 30px"
        />
        <Container maxW="7xl" position="relative" px={{ base: 4, md: 6, lg: 8 }}>
          <VStack spacing={{ base: 2, md: 3 }} align="start">
            <Badge
              colorScheme="whiteAlpha"
              fontSize={{ base: "xs", md: "sm" }}
              px={3}
              py={1}
              borderRadius="full"
            >
              Logs
            </Badge>
            <Heading size={{ base: "lg", md: "xl", lg: "2xl" }} color="white" fontWeight="bold">
              Timetable Change Logs
            </Heading>
            <Text color="whiteAlpha.900" fontSize={{ base: "sm", md: "lg" }} maxW="2xl">
              {scope.allDepts
                ? deptFilter
                  ? `Changes made to the ${deptFilter} timetable.`
                  : 'View all changes made to the timetable system.'
                : `Changes made to the ${
                    scope.depts.join(', ') || 'your department'
                  } timetable.`}
            </Text>
          </VStack>
        </Container>
      </Box>

      <Container maxW="7xl" mt={-12} position="relative" zIndex={1} px={{ base: 4, md: 6, lg: 8 }}>
        <Box
          bg={cardBg}
          borderRadius="2xl"
          shadow="xl"
          overflow="hidden"
          border="1px"
          borderColor={borderColor}
        >
          <Box bgGradient="linear(to-r, gray.700, gray.800)" p={{ base: 4, md: 6 }}>
            <HStack justify="space-between" align="center" spacing={2}>
              <HStack spacing={3} align="center" minW={0}>
                <Box bg="whiteAlpha.200" p={2} borderRadius="lg">
                  <Icon as={FiList} boxSize={5} color="white" />
                </Box>
                <VStack align="start" spacing={0}>
                  <Heading size={{ base: "sm", md: "md" }} color="white">
                    Change Logs
                  </Heading>
                  <Text color="whiteAlpha.800" fontSize={{ base: "xs", md: "sm" }}>
                    {totalLogs} total logs
                  </Text>
                </VStack>
              </HStack>

              <HStack spacing={{ base: 1, md: 3 }} flexShrink={0}>
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<Icon as={FiFilter} />}
                    aria-label="Open filters"
                    variant="ghost"
                    color="white"
                    size="md"
                    _hover={{ bg: 'gray.700' }}
                    _active={{ bg: 'gray.700' }}
                    _focus={{ boxShadow: 'none' }}
                  />
                  <MenuList p={3} bg={cardBg} borderColor={borderColor}>
                    <VStack align="stretch" spacing={3}>
                      {scope.allDepts ? (
                        <Select
                          size="sm"
                          value={deptFilter}
                          onChange={(e) => setDeptFilter(e.target.value)}
                          variant="unstyled"
                          focusBorderColor="transparent"
                          border="none"
                        >
                          <option value="">All Depts</option>
                          {(allDepts.length
                            ? allDepts
                            : [
                                ...new Set(
                                  logs.map((l) => l.dept).filter(Boolean)
                                ),
                              ]
                          ).map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        /* The server confines this account to its own
                           department, so a picker here would only ever offer
                           choices it would refuse. */
                        <Text fontSize="xs" color="gray.500" px={1}>
                          Showing {scope.depts.join(', ')} only
                        </Text>
                      )}

                      <Select
                        size="sm"
                        value={sessionFilter}
                        onChange={(e) => setSessionFilter(e.target.value)}
                        variant="unstyled"
                        focusBorderColor="transparent"
                        border="none"
                      >
                        <option value="">All Sessions</option>
                        {sessions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </VStack>
                  </MenuList>
                </Menu>

                {/* Delete session: visible on all sizes */}
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<Icon as={FiTrash2} />}
                    aria-label="Select session to delete"
                    variant="ghost"
                    color="white"
                    size="md"
                    _hover={{ bg: 'gray.700' }}
                    _active={{ bg: 'gray.700' }}
                    _focus={{ boxShadow: 'none' }}
                  />
                  <MenuList p={3} bg={cardBg} borderColor={borderColor}>
                    <VStack align="stretch" spacing={3}>
                      <Select
                        size="sm"
                        value={sessionToDelete}
                        onChange={(e) => setSessionToDelete(e.target.value)}
                        placeholder="Select session"
                        variant="unstyled"
                        focusBorderColor="transparent"
                        border="none"
                      >
                        <option value="">Select session</option>
                        {sessions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        colorScheme="red"
                        onClick={() => deleteSessionLogs(sessionToDelete)}
                      >
                        Delete Logs
                      </Button>
                    </VStack>
                  </MenuList>
                </Menu>
              </HStack>
            </HStack>
          </Box>

          {focusRow && focusUnsent > 0 && (
            <Alert
              status="warning"
              alignItems="flex-start"
              flexDirection={{ base: 'column', md: 'row' }}
              gap={2}
            >
              <AlertIcon />
              <Box flex="1">
                <AlertTitle fontSize={{ base: 'sm', md: 'md' }}>
                  {focusUnsent} faculty {focusUnsent === 1 ? 'was' : 'were'} not
                  notified
                </AlertTitle>
                <AlertDescription
                  display="block"
                  fontSize={{ base: 'xs', md: 'sm' }}
                >
                  The timetable for {focusRow.dept} was locked, but the change
                  mail did not reach {focusUnsent} of{' '}
                  {focusRow.mailSummary?.total ?? focusUnsent}{' '}
                  {focusUnsent === 1 ? 'recipient' : 'recipients'}. The reason
                  for each is on the highlighted row below, where you can send
                  it again.
                </AlertDescription>
              </Box>
              <CloseButton
                alignSelf="flex-start"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('log');
                  setSearchParams(next, { replace: true });
                }}
              />
            </Alert>
          )}

          <Box overflowX="auto" w="100%" maxW="100%">
            <Table variant="simple" size={{ base: "sm", md: "md" }}>
              <Thead bg="gray.50">
                <Tr>
                  <Th fontSize={{ base: "2xs", md: "xs" }}>Time</Th>
                  <Th fontSize={{ base: "2xs", md: "xs" }}>User</Th>
                  <Th fontSize={{ base: "2xs", md: "xs" }}>Department & Session</Th>
                  <Th fontSize={{ base: "2xs", md: "xs" }}>Changes</Th>
                  <Th fontSize={{ base: "2xs", md: "xs" }}>Faculty Mail</Th>
                </Tr>
              </Thead>
              <Tbody>
                {logs.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} textAlign="center" py={8}>
                      <Text color="gray.500">No logs found.</Text>
                    </Td>
                  </Tr>
                ) : (
                  logs.map((log, i) => (
                    <Tr
                      key={log._id || i}
                      _hover={{ bg: 'gray.50' }}
                      bg={log._id === focusLogId ? 'purple.50' : undefined}
                      boxShadow={
                        log._id === focusLogId
                          ? 'inset 3px 0 0 var(--chakra-colors-purple-500)'
                          : undefined
                      }
                    >
                      <Td py={{ base: 3, md: 5 }}>
                        <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">
                          {formatTimestamp(log.time)}
                        </Text>
                      </Td>
                      <Td py={{ base: 3, md: 5 }}>
                        <Text fontSize={{ base: "xs", md: "sm" }} color="gray.800" wordBreak="break-word">
                          {log.userEmail}
                        </Text>
                      </Td>
                      <Td py={{ base: 3, md: 5 }}>
                        <Badge colorScheme="blue" variant="subtle" whiteSpace="normal">
                          {log.dept} - {log.session}
                        </Badge>
                      </Td>
                      <Td py={{ base: 3, md: 5 }} minW={{ base: "240px", md: "auto" }}>
                        <TimetableLockLog
                          facultyChanges={(() => {
                            try {
                              return JSON.parse(log.changes);
                            } catch {
                              return [];
                            }
                          })()}
                        />
                      </Td>
                      <Td py={{ base: 3, md: 5 }} minW={{ base: "220px", md: "260px" }}>
                        <MailDelivery
                          log={log}
                          apiUrl={apiUrl}
                          onNotificationsUpdated={applyNotifications}
                          defaultOpen={log._id === focusLogId}
                        />
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </Box>

          <Box p={{ base: 4, md: 6 }} bg="gray.50" borderTop="1px" borderColor={borderColor}>
            <Flex
              align={{ base: "stretch", md: "center" }}
              justify="space-between"
              direction={{ base: "column", md: "row" }}
              gap={{ base: 3, md: 0 }}
            >
              <HStack spacing={4}>
                <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">
                  Show per page:
                </Text>
                <Select
                  size="sm"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                  width="80px"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </Select>
              </HStack>

              <HStack spacing={2} justify={{ base: "center", md: "flex-end" }}>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<FiChevronLeft />}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  isDisabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Text
                  fontSize={{ base: "xs", md: "sm" }}
                  color="gray.600"
                  minW={{ base: "80px", md: "100px" }}
                  textAlign="center"
                >
                  Page {currentPage} of{' '}
                  {Math.max(1, Math.ceil(totalLogs / limit))}
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  rightIcon={<FiChevronRight />}
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(p + 1, Math.max(1, Math.ceil(totalLogs / limit)))
                    )
                  }
                  isDisabled={
                    currentPage === Math.max(1, Math.ceil(totalLogs / limit))
                  }
                >
                  Next
                </Button>
              </HStack>
            </Flex>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Logs;
