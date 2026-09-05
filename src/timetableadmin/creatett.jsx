import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import getEnvironment from "../getenvironment";
import {
  Container,
  Box,
  Heading,
  Text,
  VStack,
  Stack,
  Flex,
  Badge,
  SimpleGrid,
} from "@chakra-ui/react";
import {
  FormControl,
  FormLabel,
  Input,
  Select,
  Alert,
  AlertIcon,
  AlertDescription,
  Card,
  CardHeader,
  CardBody,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
  useToast,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  Spinner,
  Divider,
  Tooltip,
} from '@chakra-ui/react';
import {
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { Button } from "@chakra-ui/react";
import { ArrowBackIcon, ExternalLinkIcon, AddIcon } from "@chakra-ui/icons";
import { FaGlobe, FaUserPlus } from "react-icons/fa";
import Header from "../components/header";

function CreateTimetable() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  // The "who else can work on this timetable" dialog. Separate disclosure from
  // the create-timetable modal above so opening one never closes the other.
  const {
    isOpen: isShareOpen,
    onOpen: onShareOpen,
    onClose: onShareClose,
  } = useDisclosure();
  const [formData, setFormData] = useState({
    name: "",
    dept: "",
    session: "",
    code: "",
  });
  const [table, setTable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [apiUrl] = useState(getEnvironment());
  const [sessions, setSessions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currUser, setCurrUser] = useState(null);
  const [unReadCount, setUnreadCount] = useState(0);
  // The timetable whose access is being edited, plus that dialog's own state.
  const [shareTarget, setShareTarget] = useState(null);
  const [shareData, setShareData] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareSaving, setShareSaving] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(
        `${apiUrl}/timetablemodule/message/myMessages`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch messages");

      const json = await res.json();
      const msgs = Array.isArray(json.data.messages) ? json.data.messages : [];
      const user = json.user || {};

      const unread = msgs.filter(m => {
        if (!Array.isArray(m.readBy) || m.readBy.length === 0) {
          return true;
        }
        const hasRead = m.readBy.some(entry => entry.user === user._id);
        return !hasRead;
      }).length;

      setMessages(msgs);
      setCurrUser(user);
      setUnreadCount(unread);

      console.log("Fetched", msgs.length, "messages for user", user._id);
      console.log("Computed unread count:", unread);
    } catch (err) {
      console.error("Error in fetchMessages:", err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/timetablemodule/allotment/session`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: 'include',
          }
        );
        if (response.ok) {
          const data = await response.json();
          setSessions(data);
        } else {
          console.error("Failed to fetch sessions");
        }
      } catch (error) {
        console.error("Error:", error);
      }
    };

    const fetchDepartments = async () => {
      try {
        const response = await fetch(`${apiUrl}/timetablemodule/mastersem/dept`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setDepartments(data);
        } else {
          console.error("Failed to fetch departments");
        }
      } catch (error) {
        console.error("Error:", error);
      }
    };

    fetchSessions();
    fetchDepartments();
  }, [apiUrl]);

  const fetchTimetables = async () => {
    try {
      const response = await fetch(`${apiUrl}/timetablemodule/timetable/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch timetables");
      }

      const data = await response.json();

      // Sort by createdAt (newest first) - this ensures latest timetables appear at top
      const sortedData = Array.isArray(data)
        ? data.sort((a, b) => {
            // Primary sort: createdAt date (newest first)
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            
            if (dateB !== dateA) {
              return dateB - dateA; // Descending order (newest first)
            }
            
            // Secondary sort: session year (newest first) - only if createdAt is the same
            if (a.session && b.session) {
              const yearA = parseInt(a.session.split("-")[0]);
              const yearB = parseInt(b.session.split("-")[0]);
              return yearB - yearA;
            }

            return 0;
          })
        : [];

      console.log("Sorted timetables:", sortedData.map(t => ({ 
        name: t.name, 
        createdAt: t.createdAt, 
        session: t.session 
      })));

      setTable(sortedData);
    } catch (error) {
      console.error("Error fetching timetables:", error);
    }
  };

  useEffect(() => {
    fetchTimetables();
  }, [apiUrl]);

  // --- Sharing a timetable with a second account -------------------------
  //
  // A timetable belongs to the account that created it — usually the head of
  // department — and until now only that account could see it on this
  // dashboard. The department's timetable coordinator had to borrow the head's
  // login to do the work. These handlers let the owner name a second account,
  // by the email it signs in with, after which the table appears on that
  // person's own dashboard and they carry on from there.

  const loadCoordinators = async (timetable) => {
    setShareLoading(true);
    setShareData(null);
    try {
      const response = await fetch(
        `${apiUrl}/timetablemodule/timetable/${timetable._id}/coordinators`,
        { method: "GET", credentials: "include" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load the access list");
      }
      setShareData(data);
    } catch (error) {
      toast({
        title: "Could not load who this timetable is shared with",
        description: error.message,
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setShareLoading(false);
    }
  };

  const openShareModal = (timetable) => {
    setShareTarget(timetable);
    setShareEmail("");
    onShareOpen();
    loadCoordinators(timetable);
  };

  const handleAddCoordinator = async (e) => {
    e.preventDefault();
    const email = shareEmail.trim();
    if (!email || !shareTarget) return;

    setShareSaving(true);
    try {
      const response = await fetch(
        `${apiUrl}/timetablemodule/timetable/${shareTarget._id}/coordinators`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          credentials: "include",
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to share the timetable");
      }

      toast({
        title: data.alreadyLinked
          ? "That account already had access"
          : "Timetable shared",
        // The server warns when the account it just linked holds no timetable
        // role, because such a person can open the table but cannot save it.
        description:
          data.warning ||
          `${data.coordinator?.name || email} can now open this timetable from their own dashboard.`,
        status: data.warning ? "warning" : "success",
        duration: data.warning ? 9000 : 5000,
        isClosable: true,
      });

      setShareEmail("");
      await loadCoordinators(shareTarget);
    } catch (error) {
      toast({
        title: "Could not share the timetable",
        description: error.message,
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setShareSaving(false);
    }
  };

  const handleRemoveCoordinator = async (userId) => {
    if (!shareTarget) return;
    setShareSaving(true);
    try {
      const response = await fetch(
        `${apiUrl}/timetablemodule/timetable/${shareTarget._id}/coordinators/${userId}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to remove access");
      }
      toast({
        title: "Access removed",
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      await loadCoordinators(shareTarget);
    } catch (error) {
      toast({
        title: "Could not remove access",
        description: error.message,
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setShareSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.dept || !formData.session) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/timetablemodule/timetable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const generatedLink = data.code;
        setGeneratedLink(generatedLink);
        setSubmitted(true);
        
        // Close modal and refresh table
        onClose();
        fetchTimetables();
        
        // Reset form
        setFormData({
          name: "",
          dept: "",
          session: "",
          code: "",
        });

        const redirectTo = `/tt/${generatedLink}`;
        navigate(redirectTo);
      } else {
        console.error("Error submitting the form");
        alert("Error creating timetable. Please try again.");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error creating timetable. Please try again.");
    }
  };

  const currentUrl = window.location.href;
  const urlParts = currentUrl.split("/");
  const domainName = urlParts[2];

  return (
    <Box bg="white" minH="100vh">
      {/* Hero Header Section */}
      <Box
        bgGradient="linear(to-r, cyan.400, teal.500, green.500)"
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
          <Flex 
            direction={{ base: "column", lg: "row" }}
            justify="space-between" 
            align={{ base: "stretch", lg: "center" }}
            w="full" 
            gap={{ base: 6, md: 6, lg: 4 }}
          >
            <VStack 
              spacing={{ base: 3, md: 4 }}
              align={{ base: "center", lg: "start" }}
              flex="1"
              textAlign={{ base: "center", lg: "left" }}
            >
              <Badge
                colorScheme="whiteAlpha"
                fontSize={{ base: "xs", md: "sm" }}
                px={{ base: 2, md: 3 }}
                py={1}
                borderRadius="full"
              >
                Timetable Management
              </Badge>
              <Heading 
                size={{ base: "xl", md: "2xl" }}
                color="white" 
                fontWeight="bold" 
                lineHeight="1.2"
              >
                Timetable Dashboard
              </Heading>
              <Text 
                color="whiteAlpha.900" 
                fontSize={{ base: "md", md: "lg" }}
                maxW={{ base: "full", lg: "2xl" }}
              >
                Create and manage timetables for different departments and sessions.
              </Text>
            </VStack>

            {/* Action Buttons */}
            <Stack
              direction={{ base: "column", md: "row" }}
              spacing={{ base: 2, md: 3 }}
              w={{ base: "100%", lg: "auto" }}
              align="stretch"
            >
              {/* Create Timetable Button */}
              <Button
                leftIcon={<AddIcon />}
                colorScheme="whiteAlpha"
                bg="rgba(255, 255, 255, 0.2)"
                color="white"
                size={{ base: "md", md: "lg" }}
                onClick={onOpen}
                _hover={{ bg: "rgba(255, 255, 255, 0.3)" }}
                _active={{ bg: "rgba(255, 255, 255, 0.4)" }}
                borderRadius="full"
                boxShadow="lg"
                border="2px solid"
                borderColor="whiteAlpha.400"
                w={{ base: "100%", lg: "auto" }}
                fontSize={{ base: "sm", md: "md" }}
              >
                Create Timetable
              </Button>

              {/* Messages Button with Notification Badge */}
              <Box position="relative" w={{ base: "100%", lg: "auto" }}>
                <Button
                  leftIcon={<FaGlobe />}
                  colorScheme="whiteAlpha"
                  bg="rgba(255, 255, 255, 0.2)"
                  color="white"
                  size={{ base: "md", md: "lg" }}
                  onClick={() => navigate("/tt/viewmessages")}
                  _hover={{ bg: "rgba(255, 255, 255, 0.3)" }}
                  _active={{ bg: "rgba(255, 255, 255, 0.4)" }}
                  borderRadius="full"
                  boxShadow="lg"
                  border="2px solid"
                  borderColor="whiteAlpha.400"
                  w={{ base: "100%", lg: "auto" }}
                  fontSize={{ base: "sm", md: "md" }}
                >
                  View Messages
                </Button>
                {unReadCount > 0 && (
                  <Box
                    position="absolute"
                    top={{ base: "-1", md: "-2" }}
                    right={{ base: "-1", md: "-2" }}
                    bg="red.500"
                    color="white"
                    borderRadius="full"
                    minW={{ base: "20px", md: "24px" }}
                    h={{ base: "20px", md: "24px" }}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize={{ base: "2xs", md: "xs" }}
                    fontWeight="bold"
                    px={2}
                    boxShadow="lg"
                  >
                    {unReadCount}
                  </Box>
                )}
              </Box>
            </Stack>
          </Flex>
        </Container>
      </Box>

      <Container maxW="7xl" mt={-12} position="relative" zIndex={1} pb={{ base: 10, md: 16 }} px={{ base: 4, md: 6, lg: 8 }}>
        {/* Create Timetable Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader bg="purple.600" color="white" borderTopRadius="md">
              Create New Timetable
            </ModalHeader>
            <ModalCloseButton color="white" />
            <ModalBody p={6}>
              <form onSubmit={handleSubmit} id="create-timetable-form">
                <VStack spacing={4} align="stretch">
                  <FormControl isRequired>
                    <FormLabel fontWeight="semibold" color="gray.700">
                      Name of the Time Table Coordinator
                    </FormLabel>
                    <Input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Enter coordinator name"
                      borderColor="purple.300"
                      _hover={{ borderColor: "purple.400" }}
                      _focus={{
                        borderColor: "purple.500",
                        boxShadow: "0 0 0 1px #805AD5",
                      }}
                      size="lg"
                    />
                  </FormControl>

                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl isRequired>
                      <FormLabel fontWeight="semibold" color="gray.700">
                        Department
                      </FormLabel>
                      {departments.length === 0 ? (
                        <Alert status="warning" borderRadius="md">
                          <AlertIcon />
                          <AlertDescription fontSize="sm">
                            No departments available.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Select
                          name="dept"
                          value={formData.dept}
                          onChange={handleInputChange}
                          placeholder="Select a Department"
                          borderColor="purple.300"
                          _hover={{ borderColor: "purple.400" }}
                          _focus={{
                            borderColor: "purple.500",
                            boxShadow: "0 0 0 1px #805AD5",
                          }}
                          size="lg"
                        >
                          {departments.map((department, index) => (
                            <option key={index} value={department}>
                              {department}
                            </option>
                          ))}
                        </Select>
                      )}
                    </FormControl>

                    <FormControl isRequired>
                      <FormLabel fontWeight="semibold" color="gray.700">
                        Session
                      </FormLabel>
                      {sessions.length === 0 ? (
                        <Alert status="warning" borderRadius="md">
                          <AlertIcon />
                          <AlertDescription fontSize="sm">
                            No sessions available.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Select
                          name="session"
                          value={formData.session}
                          onChange={handleInputChange}
                          placeholder="Select a Session"
                          borderColor="purple.300"
                          _hover={{ borderColor: "purple.400" }}
                          _focus={{
                            borderColor: "purple.500",
                            boxShadow: "0 0 0 1px #805AD5",
                          }}
                          size="lg"
                        >
                          {sessions.map((session, index) => (
                            <option key={index} value={session}>
                              {session}
                            </option>
                          ))}
                        </Select>
                      )}
                    </FormControl>
                  </SimpleGrid>
                </VStack>
              </form>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-timetable-form"
                colorScheme="teal"
                // leftIcon={<AddIcon />}
                isDisabled={departments.length === 0 || sessions.length === 0}
              >
                Create Timetable
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Manage Access Modal — who, besides the owner, may work on a timetable */}
        <Modal isOpen={isShareOpen} onClose={onShareClose} size="lg" isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader bg="purple.600" color="white" borderTopRadius="md">
              Timetable Access
              {shareTarget && (
                <Text fontSize="sm" fontWeight="normal" color="whiteAlpha.900">
                  {shareTarget.dept} · {shareTarget.session}
                </Text>
              )}
            </ModalHeader>
            <ModalCloseButton color="white" />
            <ModalBody p={6}>
              {shareLoading ? (
                <Flex justify="center" py={8}>
                  <Spinner color="purple.500" />
                </Flex>
              ) : (
                <VStack spacing={5} align="stretch">
                  <Box>
                    <Text fontSize="sm" fontWeight="bold" color="gray.600" mb={1}>
                      Owner
                    </Text>
                    <Text>
                      {shareData?.owner
                        ? `${shareData.owner.name || "Unnamed account"} (${
                            (shareData.owner.email || []).join(", ") || "no email on record"
                          })`
                        : "This timetable has no owner account on record."}
                    </Text>
                  </Box>

                  <Divider />

                  <Box>
                    <Text fontSize="sm" fontWeight="bold" color="gray.600" mb={2}>
                      Also has access
                    </Text>
                    {shareData?.coordinators?.length ? (
                      <Wrap>
                        {shareData.coordinators.map((person) => (
                          <WrapItem key={person._id}>
                            <Tag size="lg" colorScheme="purple" borderRadius="full">
                              <TagLabel>
                                {person.name || "Unnamed"} ·{" "}
                                {(person.email || []).join(", ")}
                              </TagLabel>
                              {shareData?.canManage && (
                                <TagCloseButton
                                  isDisabled={shareSaving}
                                  onClick={() => handleRemoveCoordinator(person._id)}
                                />
                              )}
                            </Tag>
                          </WrapItem>
                        ))}
                      </Wrap>
                    ) : (
                      <Text color="gray.500" fontSize="sm">
                        Nobody else yet — only the owner can see this timetable on
                        their dashboard.
                      </Text>
                    )}
                  </Box>

                  {shareData?.canManage ? (
                    <>
                      <Divider />
                      <form onSubmit={handleAddCoordinator}>
                        <FormControl>
                          <FormLabel fontWeight="semibold" color="gray.700">
                            Add a coordinator by login email
                          </FormLabel>
                          <Flex gap={2}>
                            <Input
                              type="email"
                              value={shareEmail}
                              onChange={(e) => setShareEmail(e.target.value)}
                              placeholder="coordinator@nitj.ac.in"
                              borderColor="purple.300"
                              isDisabled={shareSaving}
                            />
                            <Button
                              type="submit"
                              colorScheme="purple"
                              isLoading={shareSaving}
                              isDisabled={!shareEmail.trim()}
                            >
                              Add
                            </Button>
                          </Flex>
                        </FormControl>
                      </form>
                      <Alert status="info" borderRadius="md" fontSize="sm">
                        <AlertIcon />
                        <AlertDescription>
                          The person signs in with their own account and finds this
                          timetable on their dashboard. Saving changes still needs
                          the department timetable role (DTTI) on their account.
                        </AlertDescription>
                      </Alert>
                    </>
                  ) : (
                    <Alert status="info" borderRadius="md" fontSize="sm">
                      <AlertIcon />
                      <AlertDescription>
                        Only the owner of this timetable, or an institute timetable
                        coordinator, can change who it is shared with.
                      </AlertDescription>
                    </Alert>
                  )}
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={onShareClose}>
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <VStack spacing={6} align="stretch">
          {/* Existing Timetables Table Card */}
          <Card
            bg="white"
            borderRadius="2xl"
            shadow="2xl"
            border="1px"
            borderColor="gray.300"
            overflow="hidden"
          >
            <CardHeader bg="teal.600" color="white" p={{ base: 3, md: 4 }}>
              <Flex justify="space-between" align="center">
                <VStack align="start" spacing={0}>
                  <Heading size={{ base: "sm", md: "md" }}>Existing Timetables</Heading>
                  <Text fontSize="xs" color="whiteAlpha.800" mt={1}>
                    Sorted by latest first
                  </Text>
                </VStack>
                <Badge colorScheme="orange" fontSize="md" px={3} py={1}>
                  {table.length} Total
                </Badge>
              </Flex>
            </CardHeader>
            <CardBody p={0}>
              {table.length === 0 ? (
                <Box p={6}>
                  <Alert status="info" borderRadius="md">
                    <AlertIcon />
                    <AlertDescription>
                      No timetables created yet. Create your first timetable above.
                    </AlertDescription>
                  </Alert>
                </Box>
              ) : (
                <Box
                  overflowX="auto"
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
                  <Table variant="simple" size={{ base: "sm", md: "md" }}>
                    <Thead bg="teal.50">
                      <Tr>
                        <Th
                          color="teal.700"
                          fontSize="sm"
                          fontWeight="bold"
                          borderBottom="2px"
                          borderColor="teal.200"
                        >
                          Coordinator Name
                        </Th>
                        <Th
                          color="teal.700"
                          fontSize="sm"
                          fontWeight="bold"
                          borderBottom="2px"
                          borderColor="teal.200"
                        >
                          Session
                        </Th>
                        <Th
                          color="teal.700"
                          fontSize="sm"
                          fontWeight="bold"
                          borderBottom="2px"
                          borderColor="teal.200"
                        >
                          Department
                        </Th>
                       
                        <Th
                          color="teal.700"
                          fontSize="sm"
                          fontWeight="bold"
                          borderBottom="2px"
                          borderColor="teal.200"
                        >
                          Link
                        </Th>
                        <Th
                          color="teal.700"
                          fontSize="sm"
                          fontWeight="bold"
                          borderBottom="2px"
                          borderColor="teal.200"
                        >
                          Access
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {table.map((timetable) => (
                        <Tr
                          key={timetable._id}
                          _hover={{ bg: "teal.50" }}
                          transition="background 0.2s"
                        >
                          <Td fontWeight="medium">
                            <Flex align="center" gap={2} wrap="wrap">
                              <Text>{timetable.name}</Text>
                              {/* `isOwner` is false on a table somebody else
                                  created and shared with this account. Older
                                  responses omit the field entirely, in which
                                  case nothing is shown — the same as before. */}
                              {timetable.isOwner === false && (
                                <Badge
                                  colorScheme={timetable.viaDepartment ? "teal" : "green"}
                                  fontSize="xs"
                                >
                                  {timetable.viaDepartment
                                    ? `${timetable.dept} coordinator`
                                    : "Shared with me"}
                                </Badge>
                              )}
                            </Flex>
                          </Td>
                          <Td>
                            <Badge colorScheme="purple" fontSize="sm" px={2} py={1}>
                              {timetable.session}
                            </Badge>
                          </Td>
                          <Td>
                            <Badge colorScheme="blue" fontSize="sm" px={2} py={1}>
                              {timetable.dept}
                            </Badge>
                          </Td>
                        
                          <Td>
                            <Button
                              as="a"
                              href={`http://${domainName}/tt/${timetable.code}`}
                              target="_blank"
                              size="sm"
                              colorScheme="teal"
                              variant="outline"
                              rightIcon={<ExternalLinkIcon />}
                            >
                              {timetable.code}
                            </Button>
                          </Td>
                          <Td>
                            <Tooltip
                              label="Let a department coordinator open and edit this timetable from their own login"
                              hasArrow
                            >
                              <Button
                                size="sm"
                                colorScheme="purple"
                                variant="ghost"
                                leftIcon={<FaUserPlus />}
                                onClick={() => openShareModal(timetable)}
                              >
                                Manage
                              </Button>
                            </Tooltip>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}
            </CardBody>
          </Card>
        </VStack>
      </Container>

      {loading && (
        <Box
          position="fixed"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          bg="white"
          p={6}
          borderRadius="lg"
          boxShadow="2xl"
        >
          <Text>Loading...</Text>
        </Box>
      )}
    </Box>
  );
}

export default CreateTimetable;