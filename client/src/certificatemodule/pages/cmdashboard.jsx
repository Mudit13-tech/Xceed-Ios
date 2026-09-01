import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import getEnvironment from '../../getenvironment';
import {
  Badge,
  Box,
  Container,
  Flex,
  Heading,
  Icon,
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
  Th,
  Thead,
  Tr,
  Button,
  Center,
  Wrap,
  WrapItem,
  useToast,
} from '@chakra-ui/react';
import { Tooltip, Text } from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { FiEdit, FiUsers, FiLock, FiUnlock } from 'react-icons/fi';
import { useDisclosure } from '@chakra-ui/react';

function CMDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [table, setTable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  // const [isEventLocked, setEventLocked] = useState(false);
  // const [areAllEventsLocked, setAllEventsLocked] = useState(false); // New state to track if all events are locked

  const { isOpen, onOpen, onClose } = useDisclosure();
  const apiUrl = getEnvironment();

  const areAllEventsLocked =
    table.length === 0 || table.every((event) => event.lock);

  //ORIGINAL
  // const fetchEvents = async () => {
  //   try {
  //     const response = await fetch(
  //       `${apiUrl}/certificatemodule/addevent/getevents`,
  //       {
  //         method: 'GET',
  //         headers: {
  //           'Content-Type': 'application/json',
  //         },
  //         credentials: 'include',
  //       }
  //     );

  //     if (response.ok) {
  //       const data = await response.json();
  //       setTable(data);
  //       try {
  //         for (let i = 0; i < data.length; i++) {
  //           const response = await fetch(
  //             `${apiUrl}/certificatemodule/addevent/getCertificateCount/${data[i]._id}`,
  //             {
  //               method: 'GET',
  //               headers: {
  //                 'Content-Type': 'application/json',
  //               },
  //               credentials: 'include',
  //             }
  //           );
  //           const { issuedCount, totalCount } = await response.json();
  //           data[i].totalCertificates = totalCount;
  //           data[i].certificatesIssued = issuedCount;
  //           setTable(data);
  //         }
  //       } catch (error) {
  //         /* empty */
  //       }

  //       if (data.length > 0) {
  //         const lastEventLocked = data[data.length - 1].lock;
  //         setEventLocked(lastEventLocked);

  //         // Check if all events are locked
  //         const allLocked = data.every((event) => event.lock);
  //         setAllEventsLocked(allLocked);
  //       } else {
  //         // If no events, allow adding a new one
  //         setAllEventsLocked(true);
  //       }
  //     } else {
  //       console.error('Failed to fetch events');
  //     }
  //   } catch (error) {
  //     console.error('Error:', error);
  //   }
  // };


  
  {
    /*testing to solve lock event problem */
  }
  const fetchEvents = async () => {
    setEventsLoading(true);

    try {
      const response = await fetch(
        `${apiUrl}/certificatemodule/addevent/getevents`,
        { credentials: 'include' }
      );

      if (!response.ok) throw new Error('Failed');

      const events = await response.json();

      const enrichedEvents = await Promise.all(
        events.map(async (event) => {
          const res = await fetch(
            `${apiUrl}/certificatemodule/addevent/getCertificateCount/${event._id}`,
            { credentials: 'include' }
          );
          const { issuedCount, totalCount } = await res.json();

          // Which certificate types already have a saved design, so the row can
          // show them as cards instead of a single "edit" button that says
          // nothing about whether the design work is done.
          let designedTypes = [];
          try {
            const typesRes = await fetch(
              `${apiUrl}/certificatemodule/certificate/designedtypes/${event._id}`,
              { credentials: 'include' }
            );
            if (typesRes.ok) {
              const payload = await typesRes.json();
              designedTypes = Array.isArray(payload.types) ? payload.types : [];
            }
          } catch (error) {
            console.error('Could not load designed certificate types:', error);
          }

          // How many participants have been added, and under which category,
          // so the row can say whether that step is still pending.
          let participantSummary = { total: 0, byType: [] };
          try {
            const summaryRes = await fetch(
              `${apiUrl}/certificatemodule/participant/summary/${event._id}`,
              { credentials: 'include' }
            );
            if (summaryRes.ok) {
              const payload = await summaryRes.json();
              participantSummary = {
                total: payload.total || 0,
                byType: Array.isArray(payload.byType) ? payload.byType : [],
              };
            }
          } catch (error) {
            console.error('Could not load participant summary:', error);
          }

          return {
            ...event,
            totalCertificates: totalCount,
            certificatesIssued: issuedCount,
            designedTypes,
            participantSummary,
          };
        })
      );

      setTable(enrichedEvents);
    } catch (err) {
      console.error(err);
    } finally {
      setEventsLoading(false);
    }
  };

  //ORIGINAL
  // const lockEvent = async (id) => {
  //   try {
  //     const confirmed = window.confirm(
  //       'Sure? You wont be able to edit any content once locked!'
  //     );

  //     if (!confirmed) {
  //       // If the user cancels, do nothing
  //       return;
  //     }

  //     const response = await fetch(
  //       `${apiUrl}/certificatemodule/addevent/lock/${id}`,
  //       {
  //         method: 'POST',
  //         headers: {
  //           'Content-Type': 'application/json',
  //         },
  //         credentials: 'include',
  //         body: JSON.stringify({ lock: true }),
  //       }
  //     );

  //     if (response.ok) {
  //       // Find the index of the event to lock
  //       const eventIndex = table.findIndex((event) => event._id === id);
  //       if (eventIndex !== -1) {
  //         const updatedTable = [...table];
  //         updatedTable[eventIndex].lock = true;
  //         setTable(updatedTable);

  //         // Update the state for whether all events are locked
  //         const allLocked = updatedTable.every((event) => event.lock);
  //         setAllEventsLocked(allLocked);

  //         toast({
  //           title: 'Event Locked',
  //           description: 'The event has been locked successfully.',
  //           status: 'success',
  //           duration: 3000,
  //           isClosable: true,
  //           position: 'middle',
  //         });
  //       }
  //     } else {
  //       console.error('Failed to lock the event');
  //     }
  //   } catch (error) {
  //     console.error('Error locking the event:', error);
  //   }
  // };

  {
    /*testing to solve lock event problem */
  }
  const lockEvent = async (id) => {
    const confirmed = window.confirm(
      'Sure? You wont be able to edit any content once locked!'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(
        `${apiUrl}/certificatemodule/addevent/lock/${id}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!res.ok) throw new Error('Lock failed');

      setTable((prev) =>
        prev.map((e) => (e._id === id ? { ...e, lock: true } : e))
      );

      toast({
        title: 'Event Locked',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'middle',
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [apiUrl]);

  const handleAddEvent = () => {
    if (areAllEventsLocked) {
      navigate('/cm/useraddevent');
    } else {
      toast({
        title: 'Action Required',
        description: 'Please lock all previous events before adding a new one.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
        position: 'top',
      });
    }
  };

  const totals = {
    events: table.length,
    locked: table.filter((event) => event.lock).length,
    certificates: table.reduce((sum, e) => sum + (e.totalCertificates || 0), 0),
    issued: table.reduce((sum, e) => sum + (e.certificatesIssued || 0), 0),
  };

  const openEvents = totals.events - totals.locked;

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
      <StatNumber fontSize="2xl" color={color}>
        {value}
      </StatNumber>
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
          align={{ md: 'flex-start' }}
          justify="space-between"
          gap={4}
        >
          <Box>
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="widest" opacity={0.85}>
              Certificate Module
            </Text>
            <Heading size="lg" mt={1}>
              My Events
            </Heading>
            <Text mt={2} fontSize="sm" opacity={0.9}>
              Design certificates, manage participants, and track how many certificates each event
              has issued.
            </Text>
          </Box>

          <Box textAlign={{ md: 'right' }} minW={{ md: '260px' }}>
            <Flex gap={3} justify={{ md: 'flex-end' }} wrap="wrap">
              <Button
                variant="outline"
                color="white"
                borderColor="whiteAlpha.700"
                _hover={{ bg: 'whiteAlpha.200' }}
                onClick={() =>
                  window.open('/certificate-manual', '_blank', 'noopener,noreferrer')
                }
              >
                Help &amp; Manual
              </Button>
              <Button
                leftIcon={<AddIcon />}
                bg="white"
                color="teal.700"
                _hover={{ bg: 'gray.100' }}
                onClick={handleAddEvent}
                isDisabled={!areAllEventsLocked}
              >
                Add New Event
              </Button>
            </Flex>

            <Flex
              mt={2}
              align="flex-start"
              justify={{ md: 'flex-end' }}
              gap={2}
              fontSize="xs"
              color={areAllEventsLocked ? 'whiteAlpha.800' : 'yellow.200'}
            >
              <Icon as={areAllEventsLocked ? FiUnlock : FiLock} mt="2px" />
              <Text textAlign={{ md: 'right' }}>
                {areAllEventsLocked
                  ? 'All events are locked — you can create a new event.'
                  : `Lock your ${openEvents} unlocked event${openEvents === 1 ? '' : 's'} before you can create a new one.`}
              </Text>
            </Flex>
          </Box>
        </Flex>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={5}>
        {statCard('Events', totals.events, 'blue.600')}
        {statCard('Locked', totals.locked, 'red.500')}
        {statCard('Participants', totals.certificates, 'teal.600')}
        {statCard('Certificates Issued', totals.issued, 'purple.600')}
      </SimpleGrid>

      {eventsLoading ? (
        <Center py={12}>
          <Spinner size="xl" color="teal.500" />
        </Center>
      ) : table.length === 0 ? (
        <Box
          borderWidth="1px"
          borderColor="gray.100"
          borderRadius="xl"
          bg="white"
          py={12}
          textAlign="center"
        >
          <Text color="gray.600" fontWeight="medium">
            No events yet.
          </Text>
          <Text color="gray.500" fontSize="sm" mt={1}>
            Use “Add New Event” above to create your first event.
          </Text>
        </Box>
      ) : (
        <Box
          borderWidth="1px"
          borderColor="gray.100"
          borderRadius="xl"
          bg="white"
          boxShadow="sm"
          overflow="hidden"
        >
          <TableContainer>
            <Table size="md" variant="simple">
              <Thead bg="gray.50">
                <Tr>
                  <Th>Event</Th>
                  <Th>Date</Th>
                  <Th textAlign="center">Certificate Design</Th>
                  <Th textAlign="center">Participant Details</Th>
                  <Th>Issued</Th>
                  <Th textAlign="center">Status</Th>
                </Tr>
              </Thead>

              <Tbody>
                {table.map((event) => {
                  const total = event.totalCertificates || 0;
                  const issued = event.certificatesIssued || 0;
                  const percent = total ? Math.round((issued / total) * 100) : 0;

                  return (
                    <Tr key={event._id} _hover={{ bg: 'gray.50' }}>
                      <Td fontWeight="medium">{event.name}</Td>

                      <Td whiteSpace="nowrap" color="gray.600">
                        {new Date(event.ExpiryDate).toLocaleDateString('en-GB')}
                      </Td>

                      {/* Certificate design: one card per designed type */}
                      <Td>
                        {event.designedTypes && event.designedTypes.length > 0 ? (
                          <Wrap spacing={2} justify="center">
                            {event.designedTypes.map((type) => (
                              <WrapItem key={type}>
                                <Tooltip label="Open the certificate design" hasArrow>
                                  <Box
                                    as={RouterLink}
                                    to={`/cm/${event._id}`}
                                    px={3}
                                    py={2}
                                    borderWidth="1px"
                                    borderColor="teal.200"
                                    borderRadius="md"
                                    bg="teal.50"
                                    minW="96px"
                                    textAlign="center"
                                    _hover={{ bg: 'teal.100', borderColor: 'teal.300' }}
                                  >
                                    <Text
                                      fontSize="sm"
                                      fontWeight="medium"
                                      color="teal.800"
                                      textTransform="capitalize"
                                    >
                                      {type}
                                    </Text>
                                    <Text fontSize="xs" color="teal.600">
                                      {event.lock ? 'View' : 'Edit design'}
                                    </Text>
                                  </Box>
                                </Tooltip>
                              </WrapItem>
                            ))}
                          </Wrap>
                        ) : event.lock ? (
                          <Text fontSize="sm" color="gray.400" textAlign="center">
                            Design not completed
                          </Text>
                        ) : (
                          <Center>
                            <Tooltip label="Start designing this certificate" hasArrow>
                              <Button
                                as={RouterLink}
                                to={`/cm/${event._id}`}
                                size="sm"
                                variant="outline"
                                colorScheme="orange"
                                leftIcon={<FiEdit />}
                              >
                                Design not completed
                              </Button>
                            </Tooltip>
                          </Center>
                        )}
                      </Td>

                      {/* Participant details: how many, in which category */}
                      <Td>
                        {(event.participantSummary?.total || 0) > 0 ? (
                          <Tooltip
                            label={event.lock ? 'View participants' : 'Edit participant details'}
                            hasArrow
                          >
                            <Box
                              as={RouterLink}
                              to={`/cm/${event._id}/addparticipant`}
                              display="block"
                              px={3}
                              py={2}
                              borderWidth="1px"
                              borderColor="teal.200"
                              borderRadius="md"
                              bg="teal.50"
                              _hover={{ bg: 'teal.100', borderColor: 'teal.300' }}
                            >
                              <Text fontSize="sm" fontWeight="medium" color="teal.800" textAlign="center">
                                {event.participantSummary.total}{' '}
                                {event.participantSummary.total === 1
                                  ? 'participant'
                                  : 'participants'}
                              </Text>
                              <Wrap spacing={1} justify="center" mt={1}>
                                {event.participantSummary.byType.map((row) => (
                                  <WrapItem key={row.certiType}>
                                    <Badge colorScheme="teal" textTransform="capitalize">
                                      {row.certiType}: {row.count}
                                    </Badge>
                                  </WrapItem>
                                ))}
                              </Wrap>
                            </Box>
                          </Tooltip>
                        ) : event.lock ? (
                          <Text fontSize="sm" color="gray.400" textAlign="center">
                            Participant details pending
                          </Text>
                        ) : (
                          <Center>
                            <Tooltip label="Add participants for this event" hasArrow>
                              <Button
                                as={RouterLink}
                                to={`/cm/${event._id}/addparticipant`}
                                size="sm"
                                variant="outline"
                                colorScheme="orange"
                                leftIcon={<FiUsers />}
                              >
                                Participant details pending
                              </Button>
                            </Tooltip>
                          </Center>
                        )}
                      </Td>

                      {/* Issued */}
                      <Td minW="170px">
                        <Text fontSize="sm" mb={1}>
                          {issued} / {total}
                        </Text>
                        <Progress
                          value={percent}
                          size="xs"
                          borderRadius="full"
                          colorScheme={percent === 100 ? 'green' : 'teal'}
                        />
                      </Td>

                      {/* Lock status */}
                      <Td textAlign="center">
                        {!event.lock ? (
                          <Tooltip label="Lock this event" hasArrow>
                            <Button
                              size="sm"
                              leftIcon={<FiLock />}
                              colorScheme="red"
                              variant="outline"
                              onClick={() => lockEvent(event._id)}
                            >
                              Lock
                            </Button>
                          </Tooltip>
                        ) : (
                          <Box>
                            <Badge colorScheme="red" borderRadius="md" px={2} py={1}>
                              Locked
                            </Badge>
                            <Text fontSize="xs" color="gray.500" mt={1}>
                              {new Date(event.updated_at).toLocaleDateString('en-GB')}
                            </Text>
                          </Box>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {loading && <p>Loading...</p>}
    </Container>
  );
}

export default CMDashboard;
