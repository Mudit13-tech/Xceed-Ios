import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import getEnvironment from "../../getenvironment";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Flex,
  Heading,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useToast,
} from '@chakra-ui/react';
import { AddIcon, ExternalLinkIcon, LockIcon, RepeatIcon, SearchIcon, UnlockIcon } from '@chakra-ui/icons';

const GRANT_TOAST_ID = 'cm-grant-access';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB');
};

const EventRegistration = () => {
  const toast = useToast();
  const apiUrl = getEnvironment();
  const navigate = useNavigate();

  const [cmUsers, setCmUsers] = useState([]);
  const [eventsByUser, setEventsByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyEventId, setBusyEventId] = useState(null);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');

  const fetchEventsForUser = useCallback(async (userId) => {
    const response = await fetch(`${apiUrl}/certificatemodule/addevent/getevents/${userId}`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error(response.statusText);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }, [apiUrl]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/user/getuser/all`, { credentials: 'include' });
      const data = await response.json();
      const allUsers = data.user || [];
      const cm = allUsers.filter((user) => user.role.includes('CM'));
      setCmUsers(cm);

      const results = await Promise.all(
        cm.map(async (user) => {
          try {
            return [user._id, await fetchEventsForUser(user._id)];
          } catch (error) {
            console.error('Error fetching events for', user._id, error);
            return [user._id, []];
          }
        })
      );
      setEventsByUser(Object.fromEntries(results));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Could not load certificate module users.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [apiUrl, fetchEventsForUser, toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // One email address is all this screen asks for: the person it belongs to
  // gets the Event Certificate Manager role — and an XCEED account, if they have
  // none — and then creates their own events, so no event fields are collected
  // here. The server seeds them a premium "Test Event" to start from.
  const handleGrantAccess = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const address = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(address)) {
      toast({
        title: 'Invalid email',
        description: 'Enter a valid email address.',
        status: 'warning',
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    // The request is only done once the welcome mail has left, and that is the
    // slow part — so the toast stays up as "Sending email…" for the wait and is
    // updated in place with what actually happened, rather than claiming the
    // person was emailed the moment the button was clicked.
    const finish = (options) => {
      if (toast.isActive(GRANT_TOAST_ID)) {
        toast.update(GRANT_TOAST_ID, { duration: 6000, isClosable: true, ...options });
      } else {
        toast({ id: GRANT_TOAST_ID, duration: 6000, isClosable: true, ...options });
      }
    };

    setSubmitting(true);
    toast.close(GRANT_TOAST_ID);
    toast({
      id: GRANT_TOAST_ID,
      title: 'Sending email…',
      description: `Setting up ${address} and emailing them.`,
      status: 'loading',
      duration: null,
      isClosable: false,
    });

    try {
      const response = await fetch(`${apiUrl}/certificatemodule/addevent/assignCmUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: address }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        finish({
          title: 'Could not create certificate manager',
          description: data.message || 'Request failed',
          status: 'error',
        });
        return;
      }

      if (!data.roleAdded) {
        finish({
          title: 'Already a certificate manager',
          description: `${address} already had event access, so no email was sent.`,
          status: 'info',
        });
      } else if (data.emailSent) {
        finish({
          title: data.created ? 'Account created and emailed' : 'Access given and emailed',
          description: data.created
            ? `${address} now has an XCEED account with event access, and has been emailed a link to set a password.`
            : `${address} can now create events, and has been emailed.`,
          status: 'success',
        });
      } else {
        // Role is in place either way — only the mail failed, so say so instead
        // of reporting a clean success the admin would never follow up on.
        finish({
          title: 'Access given, but the email failed',
          description: `${address} can now create events, but the notification email could not be sent. Ask them to sign in${data.created ? ' and set a password via Forgot Password' : ''}.`,
          status: 'warning',
          duration: null,
        });
      }

      setIsModalOpen(false);
      setEmail('');
      await loadAll();
    } catch (error) {
      console.error('Error creating certificate manager:', error);
      finish({
        title: 'Could not create certificate manager',
        description: 'Request failed',
        status: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLock = async (userId, event) => {
    const endpoint = event.lock ? 'unlock' : 'lock';
    setBusyEventId(event._id);
    try {
      const response = await fetch(`${apiUrl}/certificatemodule/addevent/${endpoint}/${event._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lock: !event.lock }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setEventsByUser((prev) => ({
          ...prev,
          [userId]: (prev[userId] || []).map((item) =>
            item._id === event._id ? { ...item, lock: !event.lock } : item
          ),
        }));
        toast({
          title: event.lock ? 'Event unlocked' : 'Event locked',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || data.message || `Could not ${endpoint} the event`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: 'Error',
        description: `Could not ${endpoint} the event`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setBusyEventId(null);
    }
  };

  const handleOpenModal = () => {
    setEmail('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEmail('');
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cmUsers;
    return cmUsers.filter((user) => {
      const events = eventsByUser[user._id] || [];
      return (
        (user.email || '').toLowerCase().includes(term) ||
        events.some((event) => (event.name || '').toLowerCase().includes(term))
      );
    });
  }, [cmUsers, eventsByUser, search]);

  const totals = useMemo(() => {
    const allEvents = Object.values(eventsByUser).flat();
    return {
      users: cmUsers.length,
      events: allEvents.length,
      locked: allEvents.filter((event) => event.lock).length,
      issued: allEvents.reduce((sum, event) => sum + (event.certificatesIssued || 0), 0),
    };
  }, [cmUsers, eventsByUser]);

  const statCard = (label, value, color) => (
    <Stat
      borderWidth="1px"
      borderColor="gray.100"
      borderRadius="xl"
      px={4}
      py={3}
      bg="white"
      boxShadow="sm"
    >
      <StatLabel fontSize="xs" textTransform="uppercase" letterSpacing="wide" color="gray.500">
        {label}
      </StatLabel>
      <StatNumber fontSize="2xl" color={color}>{value}</StatNumber>
    </Stat>
  );

  return (
    <Container maxW="7xl" pb={10}>
      <Box
        mt={4}
        mb={5}
        px={{ base: 5, md: 8 }}
        py={{ base: 6, md: 7 }}
        borderRadius="2xl"
        bgGradient="linear(to-r, teal.600, blue.600)"
        color="white"
        boxShadow="lg"
      >
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ md: 'center' }}
          justify="space-between"
          gap={4}
        >
          <Box>
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="widest" opacity={0.85}>
              Certificate Module
            </Text>
            <Heading size="lg" mt={1}>Certificate Admin</Heading>
            <Text mt={2} fontSize="sm" opacity={0.9}>
              Certificate managers, the events assigned to them, and how many certificates each has issued.
            </Text>
          </Box>
          <Button
            leftIcon={<AddIcon />}
            bg="white"
            color="teal.700"
            _hover={{ bg: 'gray.100' }}
            alignSelf={{ base: 'stretch', md: 'center' }}
            onClick={handleOpenModal}
          >
            Create Certificate Manager
          </Button>
        </Flex>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={5}>
        {statCard('CM Users', totals.users, 'teal.600')}
        {statCard('Events', totals.events, 'blue.600')}
        {statCard('Certificates Issued', totals.issued, 'purple.600')}
        {statCard('Locked Events', totals.locked, 'red.500')}
      </SimpleGrid>

      <Flex gap={3} mb={4} direction={{ base: 'column', md: 'row' }}>
        <InputGroup maxW={{ md: '360px' }}>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search by email or event name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            bg="white"
          />
        </InputGroup>
        <Button
          leftIcon={<RepeatIcon />}
          variant="outline"
          onClick={loadAll}
          isLoading={loading}
          ms={{ md: 'auto' }}
        >
          Refresh
        </Button>
      </Flex>

      {loading ? (
        <Flex justify="center" py={12}><Spinner size="xl" color="teal.500" /></Flex>
      ) : filteredUsers.length === 0 ? (
        <Box borderWidth="1px" borderRadius="lg" py={12} textAlign="center" color="gray.500">
          No certificate module users match this search.
        </Box>
      ) : (
        <Accordion allowMultiple>
          {filteredUsers.map((user) => {
            const events = eventsByUser[user._id] || [];
            const issued = events.reduce((sum, event) => sum + (event.certificatesIssued || 0), 0);
            const lockedCount = events.filter((event) => event.lock).length;

            return (
              <AccordionItem key={user._id} borderWidth="1px" borderRadius="lg" mb={3} bg="white">
                <AccordionButton px={4} py={3} _hover={{ bg: 'gray.50' }} borderRadius="lg">
                  <Box flex="1" textAlign="left">
                    <Text fontWeight="semibold">{user.email}</Text>
                    <HStack spacing={2} mt={1} flexWrap="wrap">
                      <Badge colorScheme="blue">{events.length} events</Badge>
                      <Badge colorScheme="purple">{issued} issued</Badge>
                      {lockedCount > 0 && <Badge colorScheme="red">{lockedCount} locked</Badge>}
                    </HStack>
                  </Box>
                  <Button
                    as="span"
                    size="sm"
                    variant="ghost"
                    mr={3}
                    onClick={(e) => { e.stopPropagation(); navigate(`/cm/userevents/${user._id}`); }}
                  >
                    Manage
                  </Button>
                  <AccordionIcon />
                </AccordionButton>

                <AccordionPanel px={4} pb={4}>
                  <Divider mb={3} />
                  {events.length === 0 ? (
                    <Text color="gray.500" py={4} textAlign="center">
                      No events assigned to this user yet.
                    </Text>
                  ) : (
                    <TableContainer>
                      <Table size="sm" variant="simple">
                        <Thead>
                          <Tr>
                            <Th>Event</Th>
                            <Th>Date</Th>
                            <Th>Plan</Th>
                            <Th>Certificates Issued</Th>
                            <Th>Status</Th>
                            <Th textAlign="right">Action</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {events.map((event) => {
                            const total = event.totalCertificates || 0;
                            const issuedCount = event.certificatesIssued || 0;
                            const percent = total ? Math.round((issuedCount / total) * 100) : 0;

                            return (
                              <Tr key={event._id}>
                                <Td>
                                  <Link
                                    as={RouterLink}
                                    to={`/cm/userevents/${user._id}`}
                                    color="teal.600"
                                    fontWeight="medium"
                                  >
                                    {event.name} <ExternalLinkIcon mx="2px" mb="2px" />
                                  </Link>
                                  <Text fontSize="xs" color="gray.500">
                                    all events for this user
                                  </Text>
                                </Td>
                                <Td whiteSpace="nowrap">{formatDate(event.ExpiryDate)}</Td>
                                <Td>
                                  <Badge colorScheme={event.plan === 'premium' ? 'yellow' : 'gray'}>
                                    {event.plan}
                                  </Badge>
                                </Td>
                                <Td minW="180px">
                                  <Text fontSize="sm" mb={1}>
                                    {issuedCount} / {total}
                                  </Text>
                                  <Progress
                                    value={percent}
                                    size="xs"
                                    borderRadius="full"
                                    colorScheme={percent === 100 ? 'green' : 'teal'}
                                  />
                                </Td>
                                <Td>
                                  <Badge
                                    colorScheme={event.lock ? 'red' : 'green'}
                                    display="inline-flex"
                                    alignItems="center"
                                    gap={1}
                                    px={2}
                                    py={1}
                                    borderRadius="md"
                                  >
                                    <Icon as={event.lock ? LockIcon : UnlockIcon} boxSize={3} />
                                    {event.lock ? 'Locked' : 'Unlocked'}
                                  </Badge>
                                </Td>
                                <Td textAlign="right">
                                  <Tooltip label={event.lock ? 'Unlock this event' : 'Lock this event'}>
                                    <Button
                                      size="xs"
                                      colorScheme={event.lock ? 'green' : 'red'}
                                      variant="outline"
                                      isLoading={busyEventId === event._id}
                                      onClick={() => handleToggleLock(user._id, event)}
                                    >
                                      {event.lock ? 'Unlock' : 'Lock'}
                                    </Button>
                                  </Tooltip>
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  )}
                </AccordionPanel>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Certificate Manager</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <form onSubmit={handleGrantAccess}>
              <FormControl isRequired>
                <FormLabel>Email address</FormLabel>
                <Input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="person@nitj.ac.in"
                  autoFocus
                />
                <FormHelperText>
                  If XCEED has no account for this address, one is created with the
                  Event Certificate Manager role and the person is emailed a link to
                  set their password. A premium &ldquo;Test Event&rdquo; is added for
                  them to start from — they create the rest themselves.
                </FormHelperText>
              </FormControl>
              {/* Submits on Enter; the visible button lives in the footer. */}
              <Button type="submit" display="none" />
            </form>
          </ModalBody>

          <ModalFooter>
            <Button
              colorScheme="teal"
              onClick={handleGrantAccess}
              isLoading={submitting}
              loadingText="Sending email…"
            >
              Create
            </Button>
            <Button onClick={handleCloseModal} ml={3} isDisabled={submitting}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default EventRegistration;
