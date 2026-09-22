import React, { useState, useEffect } from 'react';
import getEnvironment from '../getenvironment';
import Header from '../components/header';
import {
  Box,
  Container,
  SimpleGrid,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Link,
  Select,
  VStack,
  Flex,
  Heading,
  Badge,
  Card,
  CardHeader,
  CardBody,
  FormControl,
  FormLabel,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  HStack,
  Button,
  IconButton,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
import { ExternalLinkIcon, DownloadIcon, CheckIcon } from '@chakra-ui/icons';
import { FaChalkboardTeacher, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { Helmet } from 'react-helmet-async';

/* The three links every department row carries.
   Stated once because the table and the phone layout both draw them, and a URL
   that drifts between the two is a link that works on a desktop and 404s on a
   phone. */
const ttHref = (code) => `${window.location.origin}/tt/${code}`;
const loadHref = (code) => `${ttHref(code)}/generatepdf/loadallocation`;
const pdfHref = (code) => `${ttHref(code)}/generatepdf`;

/* A saved/locked timestamp, or the reason there is not one. */
function TimeText({ value, color, empty }) {
  if (value === null || value === undefined) {
    return <Text color="gray.500" fontSize="xs">{empty}</Text>;
  }
  return (
    <Text color={color} fontWeight="medium" fontSize="2xs">
      {value}
    </Text>
  );
}

/* Published, with when — or the button that publishes it.

   One component rather than one per layout: this is the only control on the
   screen that changes anything, and the guard against double-publishing (which
   re-mails every faculty member) has to be the same in both. */
function PublishState({ item, publishingCode, onPublish }) {
  if (item.publish) {
    return (
      <VStack spacing={0} align="start">
        <HStack spacing={1}>
          <FaCheckCircle color="green" size={12} />
          <Text color="green.600" fontWeight="semibold" fontSize="xs">
            Published
          </Text>
        </HStack>
        <Text color="gray.600" fontSize="2xs">
          {new Date(item.datePublished).toLocaleString()}
        </Text>
      </VStack>
    );
  }
  return (
    <Button
      size="xs"
      colorScheme="green"
      leftIcon={<CheckIcon />}
      onClick={() => onPublish(item._id)}
      // Must compare against what handlePublish stores (_id). Comparing to
      // item.code left the button live during the request, so extra clicks
      // re-mailed every faculty.
      isLoading={publishingCode === item._id}
      isDisabled={publishingCode !== null}
      loadingText="Publishing..."
      fontSize="xs"
      px={3}
      py={1}
    >
      Publish
    </Button>
  );
}

/* One department, on a phone.

   The table this replaces below `md` was eight columns held to percentage
   widths by `tableLayout: fixed`, which on a 375px screen is about forty
   pixels each — and because a fixed-layout table at width 100% can never
   outgrow its container, the `overflowX` around it had nothing to scroll. So
   the columns did not overflow, they crushed: timestamps broke into one word
   per line and the three actions became unlabelled icons a thumb could not
   separate.

   A card gives each field a label beside its value and the actions their
   names, which is what there is room for when the width is spent vertically
   instead. */
function DepartmentCard({ item, savedTime, lockedTime, publishingCode, onPublish }) {
  const field = (label, node) => (
    <Flex justify="space-between" align="baseline" gap={3} w="100%">
      <Text fontSize="xs" color="gray.500" fontWeight="semibold" flexShrink={0}>
        {label}
      </Text>
      <Box textAlign="right" minW={0}>{node}</Box>
    </Flex>
  );

  return (
    <Box
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      p={4}
      bg="white"
      shadow="sm"
    >
      <Flex justify="space-between" align="center" gap={2} mb={3}>
        <Badge colorScheme="purple" fontSize="sm" px={2} py={1} borderRadius="md">
          {item.dept}
        </Badge>
        <Text fontSize="sm" fontWeight="semibold" color="gray.600">
          {item.code}
        </Text>
      </Flex>

      <VStack spacing={2} align="stretch" mb={3}>
        {field('Last Saved', (
          <TimeText value={savedTime} color="green.600" empty="Not saved yet" />
        ))}
        {field('Last Locked', (
          <TimeText value={lockedTime} color="orange.600" empty="Not locked yet" />
        ))}
        {field('Publish', (
          <PublishState item={item} publishingCode={publishingCode} onPublish={onPublish} />
        ))}
      </VStack>

      {/* Named, not iconned. The icons are fine in a table row where the column
          heading says what they are; on a card there is no heading, and three
          unlabelled squares in a row is a guess. */}
      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={2}>
        <Button
          as="a"
          href={ttHref(item.code)}
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          colorScheme="teal"
          variant="outline"
          leftIcon={<ExternalLinkIcon />}
        >
          View TT
        </Button>
        <Button
          as="a"
          href={loadHref(item.code)}
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          colorScheme="purple"
          variant="outline"
          leftIcon={<FaChalkboardTeacher />}
        >
          Load
        </Button>
        <Button
          as="a"
          href={pdfHref(item.code)}
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          colorScheme="blue"
          variant="outline"
          leftIcon={<DownloadIcon />}
        >
          PDF
        </Button>
      </SimpleGrid>
    </Box>
  );
}

function TimetableMasterView() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [lockedTimes, setLockedTimes] = useState({});
  const [savedTimes, setSavedTimes] = useState({});
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [publishingCode, setPublishingCode] = useState(null);
  const apiUrl = getEnvironment();
  const toast = useToast();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = () => {
    fetch(`${apiUrl}/timetablemodule/allotment/session`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }
        return response.json();
      })
      .then((sessionsData) => {
        setSessions(sessionsData);
        
        // Find current session and set as default
        const currentSession = sessionsData.find(session => {
          // You might need to adjust this logic based on how current session is marked
          // For now, selecting the first session as default
          return true;
        });
        
        if (sessionsData.length > 0) {
          setSelectedSession(sessionsData[0]); // Set first session as default
        }
      })
      .catch((error) => {
        console.error('Error fetching sessions:', error);
      });
  };

  const fetchLockedTime = async (currentCode) => {
    try {
      const response = await fetch(
        `${apiUrl}/timetablemodule/lock/viewsem/${currentCode}`,
        { credentials: "include" }
      );
      const lockedTimeData = await response.json();
      setLockedTimes(prevLockedTimes => ({
        ...prevLockedTimes,
        [currentCode]: lockedTimeData.updatedTime.lockTimeIST,
      }));
    } catch (error) {
      console.error("Error fetching locked time data:", error);
    }
  };

  const fetchSavedTime = async (currentCode) => {
    try {
      const response = await fetch(
        `${apiUrl}/timetablemodule/lock/viewsem/${currentCode}`,
        { credentials: "include" }
      );
      const savedTimeData = await response.json();
      setSavedTimes(prevSavedTimes => ({
        ...prevSavedTimes,
        [currentCode]: savedTimeData.updatedTime.saveTimeIST,
      }));
    } catch (error) {
      console.error("Error fetching saved time data:", error);
    }
  };

  const fetchData = () => {
    if (selectedSession) {
      setLoading(true);
      fetch(`${apiUrl}/timetablemodule/timetable/getallcodes/${selectedSession}`, { credentials: 'include' })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(jsonData => {
          const uniqueDepartments = new Set();
          const uniqueData = jsonData.map(item => {
            if (!uniqueDepartments.has(item.dept)) {
              uniqueDepartments.add(item.dept);
              return {
                ...item,
              };
            }
            return null;
          }).filter(Boolean);
          setData(uniqueData);

          jsonData.forEach(item => {
            fetchLockedTime(item.code);
          });
          jsonData.forEach(item => {
            fetchSavedTime(item.code);
          });
          setLoading(false);
        })
        .catch(error => {
          console.error('Error fetching data:', error);
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSession]);

  const handleSessionChange = (event) => {
    const newSession = event.target.value;
    setSelectedSession(newSession);
  };

  const handlePublish = async (id) => {
    // Ignore repeat clicks while a publish is in flight — each one would
    // re-run the server's notification loop and duplicate every email.
    if (publishingCode) return;
    setPublishingCode(id);
    try {
      const response = await fetch(
        `${apiUrl}/timetablemodule/timetable/publish/${id}`,
        {
          method: 'PUT',
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({
          title: data.alreadyPublished
            ? 'Already Published'
            : `Published Successfully & Mail sent to ${data.mailsSent ?? 'all'} faculty member(s)`,
          description: data.alreadyPublished
            ? 'No notification emails were re-sent.'
            : 'Timetable has been published.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        // Refresh data to show updated publish status
        fetchData();
      } else {
        throw new Error('Failed to publish');
      }
    } catch (error) {
      console.error('Error publishing timetable:', error);
      toast({
        title: 'Error',
        description: 'Failed to publish timetable.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setPublishingCode(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>Timetable Admin Master View | XCEED NITJ</title>
        <meta name='description' content="Admin view for timetable management" />
      </Helmet>

      <Box bg="white" minH="100vh">
        {/* Hero Header Section - Changed gradient */}
        <Box
          bgGradient="linear(to-r, purple.500, pink.500, orange.400)"
          pt={0}
          pb={{ base: 16, md: 20, lg: 24 }}
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

          {/* Header/Navbar integrated into hero */}
          <Box
            position="relative"
            zIndex={2}
            sx={{
              '& button[aria-label="Go back"]': { display: "none" },
              '& .chakra-button:first-of-type': { display: "none" },
            }}
          >
            <Header />
          </Box>

          <Container 
            maxW="7xl" 
            position="relative" 
            mt={{ base: 4, md: 6, lg: 8 }}
            px={{ base: 4, md: 6, lg: 8 }}
          >
            <VStack 
              spacing={{ base: 3, md: 4 }}
              align={{ base: "center", lg: "start" }}
              textAlign={{ base: "center", lg: "left" }}
            >
              <Badge
                colorScheme="whiteAlpha"
                fontSize="sm"
                px={{ base: 2, md: 3 }}
                py={1}
                borderRadius="full"
              >
                Admin Panel
              </Badge>
              <Heading 
                size={{ base: "xl", md: "2xl" }}
                color="white" 
                fontWeight="bold" 
                lineHeight="1.2"
              >
                Timetable Master View
              </Heading>
              <Text 
                color="whiteAlpha.900" 
                fontSize={{ base: "md", md: "lg" }}
                maxW={{ base: "full", lg: "2xl" }}
              >
                Manage and monitor all department timetables across sessions
              </Text>
            </VStack>
          </Container>
        </Box>

        <Container maxW="7xl" mt={-12} position="relative" zIndex={1} pb={16} px={{ base: 4, md: 6, lg: 8 }}>
          <VStack spacing={6} align="stretch">
            {/* Session Filter Card */}
            <Card
              bg="white"
              borderRadius="2xl"
              shadow="2xl"
              border="1px"
              borderColor="gray.300"
              overflow="hidden"
            >
              <CardHeader bg="purple.600" color="white" p={{ base: 3, md: 4 }}>
                <Heading size={{ base: "sm", md: "md" }}>Select Session</Heading>
              </CardHeader>
              <CardBody p={{ base: 4, md: 6 }}>
                <FormControl>
                  <FormLabel fontWeight="semibold" color="gray.700" fontSize="sm">
                    Academic Session
                  </FormLabel>
                  <Select
                    onChange={handleSessionChange}
                    value={selectedSession}
                    borderColor="purple.300"
                    _hover={{ borderColor: "purple.400" }}
                    _focus={{
                      borderColor: "purple.500",
                      boxShadow: "0 0 0 1px #805AD5",
                    }}
                    size="lg"
                  >
                    {sessions.map((session) => (
                      <option key={session} value={session}>
                        {session}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </CardBody>
            </Card>

            {/* Timetables Table Card */}
            {selectedSession && (
              <Card
                bg="white"
                borderRadius="2xl"
                shadow="2xl"
                border="1px"
                borderColor="gray.300"
                overflow="hidden"
              >
                <CardHeader bg="teal.600" color="white" p={{ base: 3, md: 4 }}>
                  <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                    <VStack align="start" spacing={0}>
                      <Heading size={{ base: "sm", md: "md" }}>Department Timetables</Heading>
                      <Text fontSize="xs" color="whiteAlpha.800" mt={1}>
                        Session: {selectedSession}
                      </Text>
                    </VStack>
                    <Badge colorScheme="orange" fontSize={{ base: "sm", md: "md" }} px={3} py={1}>
                      {data.length} Departments
                    </Badge>
                  </Flex>
                </CardHeader>
                <CardBody p={0}>
                  {loading ? (
                    <Box p={12} textAlign="center">
                      <Spinner
                        thickness="4px"
                        speed="0.65s"
                        emptyColor="gray.200"
                        color="teal.500"
                        size="xl"
                      />
                      <Text mt={4} color="gray.600">Loading timetable data...</Text>
                    </Box>
                  ) : data.length === 0 ? (
                    <Box p={6}>
                      <Alert status="info" borderRadius="md">
                        <AlertIcon />
                        <AlertDescription>
                          No timetables found for session "{selectedSession}".
                        </AlertDescription>
                      </Alert>
                    </Box>
                  ) : (
                    <>
                    {/* ── phones: one card per department ───────────────── */}
                    <VStack
                      display={{ base: 'flex', md: 'none' }}
                      spacing={3}
                      align="stretch"
                      p={4}
                    >
                      {data.map((item) => (
                        <DepartmentCard
                          key={item._id}
                          item={item}
                          savedTime={savedTimes[item.code]}
                          lockedTime={lockedTimes[item.code]}
                          publishingCode={publishingCode}
                          onPublish={handlePublish}
                        />
                      ))}
                    </VStack>

                    {/* ── the table, from a tablet up ───────────────────── */}
                    <Box
                      display={{ base: 'none', md: 'block' }}
                      overflowX="auto"
                      w="100%"
                      sx={{
                        '&::-webkit-scrollbar': {
                          height: '10px',
                        },
                        '&::-webkit-scrollbar-track': {
                          background: 'gray.100',
                          borderRadius: 'full',
                        },
                        '&::-webkit-scrollbar-thumb': {
                          background: 'teal.400',
                          borderRadius: 'full',
                        },
                        '&::-webkit-scrollbar-thumb:hover': {
                          background: 'teal.500',
                        },
                      }}
                    >
                      {/* `tableLayout: fixed` at width 100% was the bug: a
                          fixed-layout table cannot outgrow its container, so
                          the overflowX above it never had anything to scroll
                          and eight columns compressed instead. A minimum width
                          lets it overflow and the wrapper scroll, which is what
                          a table of this shape needs on a tablet. */}
                      <Table variant="simple" size="md" minW="900px">
                        <Thead bg="teal.50">
                          <Tr>
                            <Th
                              color="teal.700"
                              fontSize="sm"
                              fontWeight="bold"
                              borderBottom="2px"
                              borderColor="teal.200"
                              whiteSpace="normal"
                              wordBreak="break-word"
                            >
                              Department
                            </Th>
                            <Th
                              color="teal.700"
                              fontSize="sm"
                              fontWeight="bold"
                              borderBottom="2px"
                              borderColor="teal.200"
                              whiteSpace="normal"
                              wordBreak="break-word"
                            >
                              Code
                            </Th>
                            <Th
                              color="teal.700"
                              fontSize="sm"
                              fontWeight="bold"
                              borderBottom="2px"
                              borderColor="teal.200"
                              whiteSpace="normal"
                              wordBreak="break-word"
                            >
                              Last Saved
                            </Th>
                            <Th
                              color="teal.700"
                              fontSize="sm"
                              fontWeight="bold"
                              borderBottom="2px"
                              borderColor="teal.200"
                              whiteSpace="normal"
                              wordBreak="break-word"
                            >
                              Last Locked
                            </Th>
                            <Th
                              color="teal.700"
                              fontSize="sm"
                              fontWeight="bold"
                              borderBottom="2px"
                              borderColor="teal.200"
                              whiteSpace="normal"
                              wordBreak="break-word"
                            >
                              Publish Status
                            </Th>
                            <Th
                              color="teal.700"
                              fontSize="sm"
                              fontWeight="bold"
                              borderBottom="2px"
                              borderColor="teal.200"
                              textAlign="center"
                            >
                              View TT
                            </Th>
                            <Th
                              color="teal.700"
                              fontSize="sm"
                              fontWeight="bold"
                              borderBottom="2px"
                              borderColor="teal.200"
                              textAlign="center"
                            >
                              Faculty Load
                            </Th>
                            <Th
                              color="teal.700"
                              fontSize="sm"
                              fontWeight="bold"
                              borderBottom="2px"
                              borderColor="teal.200"
                              textAlign="center"
                            >
                              Download
                            </Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {data.map((item, index) => (
                            <Tr
                              key={item._id}
                              bg={index % 2 === 0 ? "white" : "gray.50"}
                              _hover={{ bg: "teal.50" }}
                              transition="background 0.2s"
                            >
                              <Td 
                                fontWeight="semibold" 
                                fontSize="sm"
                                whiteSpace="normal"
                                wordBreak="break-word"
                                p={3}
                              >
                                <Badge 
                                  colorScheme="purple" 
                                  fontSize="xs" 
                                  px={2} 
                                  py={1}
                                  whiteSpace="normal"
                                  wordBreak="break-word"
                                  display="block"
                                  textAlign="center"
                                >
                                  {item.dept}
                                </Badge>
                              </Td>
                              <Td 
                                fontSize="sm"
                                fontWeight="medium"
                                p={3}
                              >
                                {item.code}
                              </Td>
                              <Td 
                                fontSize="sm"
                                whiteSpace="normal"
                                wordBreak="break-word"
                                p={3}
                              >
                                <TimeText
                                  value={savedTimes[item.code]}
                                  color="green.600"
                                  empty="Not saved yet"
                                />
                              </Td>
                              <Td 
                                fontSize="sm"
                                whiteSpace="normal"
                                wordBreak="break-word"
                                p={3}
                              >
                                <TimeText
                                  value={lockedTimes[item.code]}
                                  color="orange.600"
                                  empty="Not locked yet"
                                />
                              </Td>
                              <Td 
                                fontSize="sm"
                                p={3}
                              >
                                <PublishState
                                  item={item}
                                  publishingCode={publishingCode}
                                  onPublish={handlePublish}
                                />
                              </Td>
                              <Td textAlign="center" p={3}>
                                <Tooltip label="View Timetable" placement="top" hasArrow bg="teal.600" fontSize="sm">
                                  <IconButton
                                    as="a"
                                    href={`${window.location.origin}/tt/${item.code}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    icon={<ExternalLinkIcon />}
                                    colorScheme="teal"
                                    size="sm"
                                    borderRadius="lg"
                                    boxShadow="md"
                                    _hover={{ transform: 'scale(1.05)', boxShadow: 'lg' }}
                                    transition="all 0.3s"
                                    aria-label="View Timetable"
                                  />
                                </Tooltip>
                              </Td>
                              <Td textAlign="center" p={3}>
                                <Tooltip label="View Faculty Load Allocation" placement="top" hasArrow bg="purple.600" fontSize="sm">
                                  <IconButton
                                    as="a"
                                    href={`${window.location.origin}/tt/${item.code}/generatepdf/loadallocation`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    icon={<FaChalkboardTeacher color="white" />}
                                    bg="purple.600"
                                    color="white"
                                    size="sm"
                                    borderRadius="lg"
                                    boxShadow="md"
                                    _hover={{ 
                                      transform: 'scale(1.05)', 
                                      boxShadow: 'lg',
                                      bg: 'purple.700'
                                    }}
                                    transition="all 0.3s"
                                    aria-label="View Faculty Load Allocation"
                                  />
                                </Tooltip>
                              </Td>
                              <Td textAlign="center" p={3}>
                                <Tooltip label="Download PDF" placement="top" hasArrow bg="blue.600" fontSize="sm">
                                  <IconButton
                                    as="a"
                                    href={`${window.location.origin}/tt/${item.code}/generatepdf`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    icon={<DownloadIcon />}
                                    colorScheme="blue"
                                    size="sm"
                                    borderRadius="lg"
                                    boxShadow="md"
                                    _hover={{ transform: 'scale(1.05)', boxShadow: 'lg' }}
                                    transition="all 0.3s"
                                    aria-label="Download PDF"
                                  />
                                </Tooltip>
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                    </>
                  )}
                </CardBody>
              </Card>
            )}
          </VStack>
        </Container>
      </Box>
    </>
  );
}

export default TimetableMasterView;