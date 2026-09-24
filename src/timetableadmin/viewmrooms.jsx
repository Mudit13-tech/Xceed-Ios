import React, { useState, useEffect } from 'react';
import getEnvironment from '../getenvironment';
import Footer from '../components/footer'
import {
  Box,
  Container,
  Input,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  chakra,
  Stack,
  VStack,
  Flex,
  Heading,
  Badge,
  Card,
  CardHeader,
  CardBody,
  InputGroup,
  InputLeftElement,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  HStack,
  IconButton,
} from "@chakra-ui/react";
import { FaMapMarkerAlt, FaSearch, FaSortUp, FaSortDown, FaSort } from 'react-icons/fa';
import { SearchIcon } from '@chakra-ui/icons';

import Header from '../components/header';
import { Helmet } from 'react-helmet-async';

/* Room records are typed into the timetable module by hand and a field can be
   missing. Every comparison and search below goes through this, so one row
   without a department cannot throw and blank the directory. */
const text = (value) => String(value ?? '');

/**
 * One classroom, for a phone.
 *
 * The directory is a six-column table, which on a phone is a horizontal
 * scroller: the room number and the map button are at opposite ends of it, so
 * finding a room means reading one side, scrolling, and hoping the row has not
 * been lost. The card puts the room number and the map in the same glance, and
 * the whole card is the link — the pin is a signpost, not the only target.
 *
 * A room with no location recorded is not a link and says so, rather than
 * being a card that appears to be one and opens a blank tab.
 */
function RoomCard({ room }) {
  const hasMap = Boolean(room.landMark);

  return (
    <Card
      as={hasMap ? 'a' : 'div'}
      href={hasMap ? room.landMark : undefined}
      target={hasMap ? '_blank' : undefined}
      rel={hasMap ? 'noopener noreferrer' : undefined}
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      shadow="sm"
      transition="all 0.15s"
      _hover={hasMap ? { shadow: 'md', borderColor: 'teal.300', textDecoration: 'none' } : undefined}
      _active={hasMap ? { transform: 'scale(0.995)' } : undefined}
    >
      <CardBody p={4}>
        <Flex align="center" gap={3}>
          <Box flex="1" minW={0}>
            <Heading size="md" wordBreak="break-word">
              {room.room}
            </Heading>
            <Flex wrap="wrap" gap={2} mt={2}>
              {room.type && (
                <Badge colorScheme="purple" fontSize="xs" px={2} py={1}>
                  {room.type}
                </Badge>
              )}
              {room.building && (
                <Badge colorScheme="blue" fontSize="xs" px={2} py={1}>
                  {room.building}
                </Badge>
              )}
              {room.floor ? (
                <Badge colorScheme="gray" fontSize="xs" px={2} py={1}>
                  Floor {room.floor}
                </Badge>
              ) : null}
            </Flex>
            {room.dept && (
              <Text fontSize="xs" color="gray.600" mt={2} noOfLines={2}>
                {room.dept}
              </Text>
            )}
          </Box>

          <Flex
            direction="column"
            align="center"
            justify="center"
            flexShrink={0}
            w="52px"
            py={2}
            borderRadius="lg"
            bg={hasMap ? 'red.50' : 'gray.50'}
            color={hasMap ? 'red.500' : 'gray.400'}
          >
            <Box as={FaMapMarkerAlt} boxSize="20px" aria-hidden="true" />
            <Text fontSize="10px" fontWeight="600" mt={1}>
              {hasMap ? 'Map' : 'No map'}
            </Text>
          </Flex>
        </Flex>
      </CardBody>
    </Card>
  );
}

function MasterRoomTable() {
  const [masterRoomData, setMasterRoomData] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [sortColumn, setSortColumn] = useState('room');
  const apiUrl = getEnvironment();

  useEffect(() => {
    fetch(`${apiUrl}/timetablemodule/masterroom`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        // Sort the data based on 'dept' in alphabetical order. Compared as
        // strings rather than by calling localeCompare on the field itself: a
        // row with no department threw here, and one bad row taking the whole
        // page down matters more now that this is where a phone looks.
        const sortedData = data.sort((a, b) => text(a.dept).localeCompare(text(b.dept)));
        setMasterRoomData(sortedData);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching master room data:', error);
        setLoading(false);
      });
  }, []);

  function sanitizeString(str) {
    // Remove special characters and spaces from the string
    return text(str).replace(/[^\w\d]/gi, '').toLowerCase();
  }

  useEffect(() => {
    // Filter rooms based on the search term
    const sanitizedSearchTerm = sanitizeString(searchTerm);

    const filteredRooms = masterRoomData.filter((room) => {
      const sanitizedRoom = sanitizeString(room.room);
      return sanitizedRoom.includes(sanitizedSearchTerm);
    });

    // Sort the filtered rooms based on the selected column and order
    const sortedRooms = filteredRooms.sort((a, b) => {
      const columnA = text(a[sortColumn]);
      const columnB = text(b[sortColumn]);

      if (sortOrder === 'asc') {
        return columnA.localeCompare(columnB);
      } else {
        return columnB.localeCompare(columnA);
      }
    });

    setFilteredRooms(sortedRooms);
  }, [searchTerm, masterRoomData, sortColumn, sortOrder]);

  const handleSort = (column) => {
    // Toggle between 'asc' and 'desc' when clicking on the column header
    if (sortColumn === column) {
      setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (column) => {
    if (sortColumn === column) {
      return sortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />;
    }
    return <FaSort opacity={0.3} />;
  };

  const redirectToMap = (landmark) => {
    // A room with no location recorded used to open an empty tab, which reads
    // as the map having failed rather than as there being nothing to show.
    if (!landmark) return;
    window.open(landmark, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Helmet>
        <title>Classroom Location | XCEED NITJ</title>
        <meta name='description' content="NITJ's official classroom locator" />
      </Helmet>

      <Box bg="white" minH="100vh">
        {/* Hero Header Section */}
        <Box
          bgGradient="linear(to-r, pink.500, orange.500, yellow.500)"
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
                fontSize={{ base: "xs", md: "sm" }}
                px={{ base: 2, md: 3 }}
                py={1}
                borderRadius="full"
              >
                Classroom Management
              </Badge>
              <Heading 
                size={{ base: "xl", md: "2xl" }}
                color="white" 
                fontWeight="bold" 
                lineHeight="1.2"
              >
                Classroom Information
              </Heading>
              <Text 
                color="whiteAlpha.900" 
                fontSize={{ base: "md", md: "lg" }}
                maxW={{ base: "full", lg: "2xl" }}
              >
                Search and locate classrooms across the campus with detailed building information
              </Text>
            </VStack>
          </Container>
        </Box>

        {/* Search Card - Centered */}
        <Container maxW="7xl" mt={-12} position="relative" zIndex={1} px={{ base: 4, md: 6, lg: 8 }}>
          <Card
            bg="white"
            borderRadius="2xl"
            shadow="2xl"
            border="1px"
            borderColor="gray.300"
            overflow="hidden"
            mb={6}
          >
            <CardHeader bg="teal.600" color="white" p={{ base: 3, md: 4 }}>
              <Heading size={{ base: "sm", md: "md" }}>Search Classrooms</Heading>
            </CardHeader>
            <CardBody p={{ base: 4, md: 6 }}>
              <InputGroup size="lg">
                <InputLeftElement pointerEvents="none">
                  <SearchIcon color="teal.400" />
                </InputLeftElement>
                <Input
                  type="text"
                  placeholder="Search by room number (e.g., LT1, 205, CSE Block...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  borderColor="teal.300"
                  _hover={{ borderColor: "teal.400" }}
                  _focus={{
                    borderColor: "teal.500",
                    boxShadow: "0 0 0 1px #319795",
                  }}
                  fontSize={{ base: "sm", md: "md" }}
                />
              </InputGroup>
            </CardBody>
          </Card>
        </Container>

        {/* Results Card - Full Width */}
        <Box w="100%" px={{ base: 4, md: 6, lg: 8 }} pb={6}>
          <Card
            bg="white"
            borderRadius="2xl"
            shadow="2xl"
            border="1px"
            borderColor="gray.300"
            overflow="hidden"
            w="100%"
          >
            <CardHeader bg="teal.600" color="white" p={{ base: 3, md: 4 }}>
              <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                <VStack align="start" spacing={0}>
                  <Heading size={{ base: "sm", md: "md" }}>Classroom Directory</Heading>
                  {/* The hint has to follow the layout: there are no column
                      headers to click on a phone, where this is a card list. */}
                  <Text fontSize="xs" color="whiteAlpha.800" mt={1} display={{ base: "none", md: "block" }}>
                    Click on column headers to sort
                  </Text>
                  <Text fontSize="xs" color="whiteAlpha.800" mt={1} display={{ base: "block", md: "none" }}>
                    Tap a classroom to open it on the map
                  </Text>
                </VStack>
                <Badge colorScheme="orange" fontSize={{ base: "sm", md: "md" }} px={3} py={1}>
                  {filteredRooms.length} / {masterRoomData.length} Rooms
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
                  <Text mt={4} color="gray.600">Loading classroom data...</Text>
                </Box>
              ) : filteredRooms.length === 0 ? (
                <Box p={6}>
                  <Alert status="info" borderRadius="md">
                    <AlertIcon />
                    <AlertDescription>
                      No classrooms found matching "{searchTerm}". Try a different search term.
                    </AlertDescription>
                  </Alert>
                </Box>
              ) : (
                <>
                {/* Cards on a phone, the table from md up. Both are rendered
                    and one is hidden: which layout is right is a question about
                    the viewport, and CSS answers it without the page having to
                    re-render on a rotation. */}
                <Stack
                  display={{ base: 'flex', md: 'none' }}
                  spacing={3}
                  p={4}
                >
                  {filteredRooms.map((room) => (
                    <RoomCard key={room._id} room={room} />
                  ))}
                </Stack>

                <Box
                  display={{ base: 'none', md: 'block' }}
                  overflowX="auto"
                  w="100%"
                  sx={{
                    '&::-webkit-scrollbar': {
                      height: '8px',
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
                  <Table 
                    variant="simple" 
                    size={{ base: "sm", md: "md" }}
                    sx={{
                      tableLayout: "fixed",
                      width: "100%",
                    }}
                  >
                    <Thead bg="teal.50">
                      <Tr>
                        {/* Room Column - 15% */}
                        <Th
                          color="teal.700"
                          fontSize={{ base: "xs", md: "sm" }}
                          fontWeight="bold"
                          borderBottom="2px"
                          borderColor="teal.200"
                          cursor="pointer"
                          onClick={() => handleSort('room')}
                          _hover={{ bg: "teal.100" }}
                          width={{ base: "20%", md: "15%" }}
                          whiteSpace="normal"
                          wordBreak="break-word"
                        >
                          <HStack spacing={1}>
                            <Text>Room</Text>
                            <Box>{getSortIcon('room')}</Box>
                          </HStack>
                        </Th>
                        
                        {/* Type Column - 10% */}
                        <Th
                          color="teal.700"
                          fontSize={{ base: "xs", md: "sm" }}
                          fontWeight="bold"
                          borderBottom="2px"
                          borderColor="teal.200"
                          width={{ base: "15%", md: "10%" }}
                          whiteSpace="normal"
                          wordBreak="break-word"
                        >
                          Type
                        </Th>
                        
                        {/* Building Column - 20% */}
                        <Th
                          color="teal.700"
                          fontSize={{ base: "xs", md: "sm" }}
                          fontWeight="bold"
                          borderBottom="2px"
                          borderColor="teal.200"
                          cursor="pointer"
                          onClick={() => handleSort('building')}
                          _hover={{ bg: "teal.100" }}
                          width={{ base: "20%", md: "20%" }}
                          whiteSpace="normal"
                          wordBreak="break-word"
                        >
                          <HStack spacing={1}>
                            <Text>Building</Text>
                            <Box>{getSortIcon('building')}</Box>
                          </HStack>
                        </Th>
                        
                        {/* Floor Column - 8% */}
                        <Th
                          color="teal.700"
                          fontSize={{ base: "xs", md: "sm" }}
                          fontWeight="bold"
                          borderBottom="2px"
                          borderColor="teal.200"
                          width={{ base: "12%", md: "8%" }}
                          whiteSpace="normal"
                          wordBreak="break-word"
                        >
                          Floor
                        </Th>
                        
                        {/* Department Column - 30% */}
                        <Th
                          color="teal.700"
                          fontSize={{ base: "xs", md: "sm" }}
                          fontWeight="bold"
                          borderBottom="2px"
                          borderColor="teal.200"
                          cursor="pointer"
                          onClick={() => handleSort('dept')}
                          _hover={{ bg: "teal.100" }}
                          width={{ base: "20%", md: "25%" }}
                          whiteSpace="normal"
                          wordBreak="break-word"
                        >
                          <HStack spacing={1}>
                            <Text>Department</Text>
                            <Box>{getSortIcon('dept')}</Box>
                          </HStack>
                        </Th>
                        
                        {/* Location Column - 10% */}
                        <Th
                          color="teal.700"
                          fontSize={{ base: "xs", md: "sm" }}
                          fontWeight="bold"
                          borderBottom="2px"
                          borderColor="teal.200"
                          textAlign="center"
                          width={{ base: "12%", md: "10%" }}
                        >
                          <Text display={{ base: "none", md: "block" }}>Location</Text>
                          <Text display={{ base: "block", md: "none" }}>Loc</Text>
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredRooms.map((room) => (
                        <Tr
                          key={room._id}
                          _hover={{ bg: "teal.50" }}
                          transition="background 0.2s"
                        >
                          <Td 
                            fontWeight="semibold" 
                            fontSize={{ base: "xs", md: "sm" }}
                            whiteSpace="normal"
                            wordBreak="break-word"
                          >
                            {room.room}
                          </Td>
                          <Td 
                            fontSize={{ base: "xs", md: "sm" }}
                            whiteSpace="normal"
                            wordBreak="break-word"
                          >
                            <Badge 
                              colorScheme="purple" 
                              fontSize="xs" 
                              px={2} 
                              py={1}
                              whiteSpace="normal"
                              textAlign="center"
                            >
                              {room.type}
                            </Badge>
                          </Td>
                          <Td 
                            fontSize={{ base: "xs", md: "sm" }}
                            whiteSpace="normal"
                            wordBreak="break-word"
                          >
                            <Badge 
                              colorScheme="blue" 
                              fontSize="xs" 
                              px={2} 
                              py={1}
                              whiteSpace="normal"
                              textAlign="center"
                            >
                              {room.building}
                            </Badge>
                          </Td>
                          <Td 
                            fontSize={{ base: "xs", md: "sm" }}
                            whiteSpace="normal"
                            wordBreak="break-word"
                          >
                            {room.floor}
                          </Td>
                          <Td 
                            fontSize={{ base: "xs", md: "sm" }}
                            whiteSpace="normal"
                            wordBreak="break-word"
                          >
                            <Badge 
                              colorScheme="green" 
                              fontSize="xs" 
                              px={2} 
                              py={1}
                              whiteSpace="normal"
                              textAlign="center"
                            >
                              {room.dept}
                            </Badge>
                          </Td>
                          <Td textAlign="center">
                            <IconButton
                              icon={<FaMapMarkerAlt />}
                              colorScheme="red"
                              variant="ghost"
                              size={{ base: "sm", md: "md" }}
                              onClick={() => redirectToMap(room.landMark)}
                              isDisabled={!room.landMark}
                              aria-label={
                                room.landMark
                                  ? `View ${room.room} on map`
                                  : `No location recorded for ${room.room}`
                              }
                              _hover={{ bg: "red.50", transform: "scale(1.1)" }}
                              transition="all 0.2s"
                            />
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
        </Box>

        {/* Credits Card - Centered */}
        <Container maxW="7xl" px={{ base: 4, md: 6, lg: 8 }} pb={6}>
          <Card
            bg="white"
            borderRadius="xl"
            shadow="md"
            border="1px"
            borderColor="gray.200"
            p={4}
          >
            <Text color="blue.600" fontSize={{ base: "xs", md: "sm" }} textAlign="center">
              <strong>CREDITS:</strong> Geo Location contributed by Nandhini, IPE (Batch of 2021-2025)
            </Text>
          </Card>
        </Container>

        <Footer />
      </Box>
    </>
  );
}

export default MasterRoomTable;