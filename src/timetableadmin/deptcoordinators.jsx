import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Flex,
  Badge,
  Button,
  Input,
  FormControl,
  FormLabel,
  Card,
  CardBody,
  CardHeader,
  Alert,
  AlertIcon,
  AlertDescription,
  Spinner,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  InputGroup,
  InputLeftElement,
  useToast,
  SimpleGrid,
  Divider,
  Tooltip,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { FiUsers, FiAlertCircle } from "react-icons/fi";
import getEnvironment from "../getenvironment";
import Header from "../components/header";

/**
 * Appointing department timetable coordinators.
 *
 * One row per department, taken from the master semester list so the page
 * cannot appoint anybody to a department that does not exist. Appointing
 * somebody to a department gives them every timetable that department owns,
 * across all sessions, and — this is the half that is easy to miss — stops them
 * changing any other department's.
 */
const DeptCoordinators = () => {
  const apiUrl = getEnvironment();
  const toast = useToast();

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  // Which department's Add form is being typed into, and what is in it. Keyed
  // by department so a half-typed address is not lost when the list refreshes.
  const [drafts, setDrafts] = useState({});
  const [savingFor, setSavingFor] = useState("");

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${apiUrl}/timetablemodule/deptcoordinator/`,
        { method: "GET", credentials: "include" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to load departments. This page is for institute timetable coordinators and admins."
        );
      }
      setDepartments(Array.isArray(data.departments) ? data.departments : []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [apiUrl]);

  const handleAdd = async (dept) => {
    const email = (drafts[dept] || "").trim();
    if (!email) return;

    setSavingFor(dept);
    try {
      const response = await fetch(
        `${apiUrl}/timetablemodule/deptcoordinator/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dept, email }),
          credentials: "include",
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to appoint the coordinator");
      }

      const who = data.coordinator?.name || email;
      toast({
        title: data.alreadyAppointed
          ? `Already a coordinator for ${dept}`
          : `Appointed to ${dept}`,
        // Granting the role is reported rather than done silently: it is the
        // one part of appointing that changes what the account can do beyond
        // this department.
        description: data.roleGranted
          ? `${who} was also given the Department Time Table Coordinator role. If they are signed in right now they must sign out and back in before they can edit ${dept}'s timetables — and only ${dept}'s.`
          : data.warning ||
            `${who} can now edit ${dept}'s timetables, and only ${dept}'s.`,
        status: data.warning ? "warning" : "success",
        duration: data.warning || data.roleGranted ? 9000 : 5000,
        isClosable: true,
      });

      setDrafts((current) => ({ ...current, [dept]: "" }));
      await fetchDepartments();
    } catch (err) {
      toast({
        title: "Could not appoint",
        description: err.message,
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setSavingFor("");
    }
  };

  const handleRemove = async (appointmentId, dept, name) => {
    try {
      const response = await fetch(
        `${apiUrl}/timetablemodule/deptcoordinator/${appointmentId}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to withdraw the appointment");
      }
      toast({
        title: `${name} is no longer a coordinator for ${dept}`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      await fetchDepartments();
    } catch (err) {
      toast({
        title: "Could not withdraw the appointment",
        description: err.message,
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    }
  };

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return departments;
    return departments.filter((row) => {
      if (row.dept.toLowerCase().includes(needle)) return true;
      return row.coordinators.some((entry) => {
        const name = (entry.user?.name || "").toLowerCase();
        const emails = (entry.user?.email || []).join(" ").toLowerCase();
        return name.includes(needle) || emails.includes(needle);
      });
    });
  }, [departments, filter]);

  const appointed = departments.reduce(
    (total, row) => total + row.coordinators.length,
    0
  );

  return (
    <Box bg="gray.50" minH="100vh" pb={{ base: 10, md: 16 }}>
      <Box
        bgGradient="linear(to-r, purple.600, blue.600, teal.500)"
        pt={0}
        pb={{ base: 16, md: 20 }}
        position="relative"
        overflow="hidden"
      >
        <Box position="relative" zIndex={2}>
          <Header />
        </Box>
        <Container maxW="6xl" position="relative" mt={{ base: 4, md: 6 }}>
          <VStack align={{ base: "center", lg: "start" }} spacing={3}>
            <Badge
              colorScheme="whiteAlpha"
              fontSize={{ base: "xs", md: "sm" }}
              px={3}
              py={1}
              borderRadius="full"
            >
              Timetable Administration
            </Badge>
            <Heading size={{ base: "lg", md: "xl" }} color="white">
              Department Coordinators
            </Heading>
            <Text color="whiteAlpha.900" maxW="3xl">
              Appoint the people who maintain each department&apos;s timetable. A
              coordinator sees every timetable of the departments listed against
              their name — across all sessions — and can change those and no
              others.
            </Text>
          </VStack>
        </Container>
      </Box>

      <Container maxW="6xl" mt={-10} position="relative" zIndex={1}>
        {error ? (
          <Alert status="error" borderRadius="xl" shadow="lg">
            <AlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : loading ? (
          <Flex justify="center" py={16}>
            <Spinner size="lg" color="purple.500" />
          </Flex>
        ) : (
          <VStack spacing={6} align="stretch">
            <Card borderRadius="2xl" shadow="xl">
              <CardBody>
                <Flex
                  direction={{ base: "column", md: "row" }}
                  gap={4}
                  align={{ base: "stretch", md: "center" }}
                  justify="space-between"
                >
                  <HStack spacing={6}>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="2xl" fontWeight="bold" color="purple.600">
                        {departments.length}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        Departments
                      </Text>
                    </VStack>
                    <Divider orientation="vertical" h="40px" />
                    <VStack align="start" spacing={0}>
                      <Text fontSize="2xl" fontWeight="bold" color="teal.600">
                        {appointed}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        Appointments
                      </Text>
                    </VStack>
                  </HStack>
                  <InputGroup maxW={{ base: "full", md: "sm" }}>
                    <InputLeftElement pointerEvents="none">
                      <SearchIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      placeholder="Search a department or a person"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      bg="white"
                    />
                  </InputGroup>
                </Flex>
              </CardBody>
            </Card>

            <Alert status="info" borderRadius="xl">
              <AlertIcon />
              <AlertDescription fontSize="sm">
                Appointing somebody also gives their account the Department Time
                Table Coordinator role (DTTI) if it does not already have one,
                and emails them to say so. Somebody who is signed in at the time
                must sign out and back in before the new role takes effect.
                Withdrawing an appointment does not take the role back — it only removes the department, and an
                account left with none falls back to the department recorded on
                it. Remove the role itself under User Management.
              </AlertDescription>
            </Alert>

            {visible.length === 0 ? (
              <Card borderRadius="2xl" shadow="lg">
                <CardBody>
                  <Alert status="info" borderRadius="md">
                    <AlertIcon />
                    <AlertDescription>
                      {departments.length === 0
                        ? "No departments on the master semester list yet. Add them under Master Semester first."
                        : "No department or person matches that search."}
                    </AlertDescription>
                  </Alert>
                </CardBody>
              </Card>
            ) : (
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5}>
                {visible.map((row) => (
                  <Card
                    key={row.dept}
                    borderRadius="2xl"
                    shadow="lg"
                    border="1px"
                    borderColor="gray.200"
                  >
                    <CardHeader
                      bg={row.onMasterList ? "purple.600" : "orange.500"}
                      color="white"
                      borderTopRadius="2xl"
                      py={3}
                    >
                      <Flex justify="space-between" align="center" gap={2}>
                        <HStack>
                          <FiUsers />
                          <Heading size="sm">{row.dept}</Heading>
                        </HStack>
                        <HStack spacing={2}>
                          {!row.onMasterList && (
                            <Tooltip
                              hasArrow
                              label="Not on the master semester list any more, but somebody still holds it"
                            >
                              <span>
                                <FiAlertCircle />
                              </span>
                            </Tooltip>
                          )}
                          <Badge colorScheme="whiteAlpha" fontSize="xs">
                            {row.coordinators.length}
                          </Badge>
                        </HStack>
                      </Flex>
                    </CardHeader>
                    <CardBody>
                      <VStack align="stretch" spacing={4}>
                        {row.coordinators.length ? (
                          <Wrap>
                            {row.coordinators.map((entry) => (
                              <WrapItem key={entry._id}>
                                <Tag
                                  size="lg"
                                  borderRadius="full"
                                  colorScheme={entry.canEdit ? "purple" : "orange"}
                                >
                                  <TagLabel>
                                    {entry.user?.name || "Unnamed"}
                                    {(entry.user?.email || []).length
                                      ? ` · ${entry.user.email.join(", ")}`
                                      : ""}
                                    {/* Appointing grants the role, so this only
                                        shows for an appointment made before that
                                        was so, or one whose account has since
                                        had the role taken away. */}
                                    {!entry.canEdit && " · no timetable role"}
                                  </TagLabel>
                                  <TagCloseButton
                                    onClick={() =>
                                      handleRemove(
                                        entry._id,
                                        row.dept,
                                        entry.user?.name || "That account"
                                      )
                                    }
                                  />
                                </Tag>
                              </WrapItem>
                            ))}
                          </Wrap>
                        ) : (
                          <Text fontSize="sm" color="gray.500">
                            Nobody appointed. Whoever holds this department&apos;s
                            timetables today keeps working from the department on
                            their own account.
                          </Text>
                        )}

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleAdd(row.dept);
                          }}
                        >
                          <FormControl>
                            <FormLabel fontSize="sm" color="gray.600">
                              Appoint by login email
                            </FormLabel>
                            <Flex gap={2}>
                              <Input
                                type="email"
                                size="sm"
                                borderRadius="md"
                                placeholder="coordinator@nitj.ac.in"
                                value={drafts[row.dept] || ""}
                                onChange={(e) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [row.dept]: e.target.value,
                                  }))
                                }
                                isDisabled={savingFor === row.dept}
                              />
                              <Button
                                type="submit"
                                size="sm"
                                colorScheme="purple"
                                isLoading={savingFor === row.dept}
                                isDisabled={!(drafts[row.dept] || "").trim()}
                              >
                                Add
                              </Button>
                            </Flex>
                          </FormControl>
                        </form>
                      </VStack>
                    </CardBody>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </VStack>
        )}
      </Container>
    </Box>
  );
};

export default DeptCoordinators;
