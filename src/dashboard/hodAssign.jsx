import React, { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Icon,
  IconButton,
  Input,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { FiArrowLeft, FiTrash2, FiUserCheck, FiUserPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import getEnvironment from '../getenvironment';
import DeanAssignPanel from './deanAssign';
import DashboardSectionsPanel from './dashboardSections';
import EditableName from './editableName';

const apiUrl = getEnvironment();

/**
 * Academic leadership: who reads which department, and what they are shown.
 *
 * Three panels, in the order the decisions are made — heads of department, the
 * Dean (Academic), and then what each of their dashboards carries. They sit on
 * one screen because they are one subject: the dean's appointment is the HOD's
 * at a wider scope, and the panel settings are meaningless without knowing who
 * is reading them. Kept apart, the second and third were things an
 * administrator had to remember existed.
 *
 * The first panel is below; the other two are `deanAssign` and
 * `dashboardSections`, each owning its own reads and writes so a failure in one
 * cannot take the screen down with it.
 *
 * ── Heads of department — the platform's department → person mapping.
 *
 * The HOD role and a `dept` on an account answered "is this person a head of
 * department?" but never "who is the head of ECE?", which is the question every
 * other module actually asks. This screen writes the mapping that answers it,
 * and the learning module's HOD dashboard and subject screens read it.
 *
 * One head per department, refused rather than replaced: handing a department's
 * screens to somebody new is a decision with a person on the other end of it,
 * so it is made by removing the current head and then assigning, never as a
 * side effect of typing an address into a form.
 *
 * Assigning also puts the HOD role on the account and sets its department, and
 * removing takes the role away again — unless the same person still heads
 * another department, in which case the role stays and this screen says so.
 *
 * No name is asked for. The person being appointed is not the person filling in
 * this form, so any name typed here is a guess at somebody else's spelling, and
 * an administrator working through a round of appointments should not have to
 * make six of them. A created account is named for the post instead —
 * `Head-CSE` — which is the one thing the appointment already knows for certain
 * and reads correctly wherever a name is shown. The name column below is
 * editable in place, permanently, for when the real one is learned.
 */

const departmentKey = (value) =>
  String(value || '').trim().replace(/[\s_.-]+/g, '').toUpperCase();

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const HodAssignPage = () => {
  const [email, setEmail] = useState('');
  const [dept, setDept] = useState('');
  const [departments, setDepartments] = useState([]);
  const [heads, setHeads] = useState([]);
  const [loadingHeads, setLoadingHeads] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/superadmin');
  };

  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const iconBg = useColorModeValue('purple.50', 'purple.900');
  const iconColor = useColorModeValue('purple.600', 'purple.300');

  const fetchHeads = async () => {
    setLoadingHeads(true);
    try {
      const res = await fetch(`${apiUrl}/user/getuser/hods`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load heads of department');
      setHeads(data.heads || []);
    } catch (err) {
      toast({
        title: 'Could not load heads of department',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoadingHeads(false);
    }
  };

  useEffect(() => {
    fetchHeads();
    // The timetable owns the department list, and the server checks the choice
    // against the same table — so the dropdown cannot offer a department the
    // assignment would then reject.
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/timetablemodule/timetable/sess/allsessanddept`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to load departments');
        const data = await res.json();
        setDepartments(
          Array.from(new Set((data.uniqueDept || []).map((d) => d?.trim()).filter(Boolean)))
            .sort((a, b) => a.localeCompare(b)),
        );
      } catch (err) {
        toast({
          title: 'Could not load departments',
          description: err.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which departments already have somebody, so the form can say so before the
  // server has to refuse it.
  const takenDepartments = new Set(heads.map((head) => departmentKey(head.dept)));
  const chosenIsTaken = Boolean(dept) && takenDepartments.has(departmentKey(dept));

  const handleAssign = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/user/getuser/assign-hod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), dept }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to assign');
      toast({
        title: data.created ? 'Account created and head assigned' : 'Head of Department assigned',
        description: `${email.trim()} now heads ${data.head?.dept || dept}.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      setEmail('');
      setDept('');
      fetchHeads();
    } catch (err) {
      toast({
        title: 'Assignment failed',
        description: err.message,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Renaming is open for the life of the appointment, not only just after it is
  // made: the address is known on day one and the name very often is not. It
  // rethrows so the cell can stay open on what was typed.
  const handleRename = async (head, name) => {
    try {
      const res = await fetch(`${apiUrl}/user/getuser/rename-hod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dept: head.dept, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename');
      toast({
        title: 'Name updated',
        description: `The head of ${head.dept} is now shown as ${name}.`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      fetchHeads();
    } catch (err) {
      toast({
        title: 'Could not rename',
        description: err.message,
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
      throw err;
    }
  };

  const handleRemove = async (head) => {
    setRemoving(head.dept);
    try {
      const res = await fetch(`${apiUrl}/user/getuser/remove-hod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dept: head.dept }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove');
      toast({
        title: `${head.dept} has no head assigned`,
        description: data.roleRemoved
          ? 'The HOD role has been removed from the account.'
          : 'The account keeps the HOD role — it still heads another department.',
        status: 'success',
        duration: 6000,
        isClosable: true,
      });
      fetchHeads();
    } catch (err) {
      toast({
        title: 'Could not remove',
        description: err.message,
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Box bg={pageBg} minH="100vh" py={{ base: 8, md: 14 }}>
      <Container maxW="6xl">
        <Flex align="center" gap={4} mb={{ base: 6, md: 10 }} flexWrap="wrap">
          <Flex align="center" justify="center" boxSize={12} borderRadius="lg" bg={iconBg} color={iconColor}>
            <Icon as={FiUserCheck} boxSize={6} />
          </Flex>
          <Box>
            <Heading as="h1" size="lg">
              Academic Leadership
            </Heading>
            <Text color={subColor}>
              Who heads each department, who is Dean (Academic), and what each of their
              dashboards shows.
            </Text>
          </Box>
          <Button leftIcon={<FiArrowLeft />} variant="outline" size="sm" ml="auto" onClick={goBack}>
            Back
          </Button>
        </Flex>

        <Box
          as="form"
          onSubmit={handleAssign}
          bg={cardBg}
          borderWidth="1px"
          borderColor={border}
          borderRadius="xl"
          p={6}
          mb={8}
        >
          <Flex gap={4} direction={{ base: 'column', md: 'row' }} align={{ md: 'flex-start' }}>
            <FormControl isRequired>
              <FormLabel>Email ID</FormLabel>
              <Input
                type="email"
                placeholder="faculty@nitj.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <FormHelperText>
                An address with no account gets one, named for the post (Head-{dept || 'CSE'})
                and claimed through the usual OTP flow. The name is editable below.
              </FormHelperText>
            </FormControl>
            <FormControl isRequired isInvalid={chosenIsTaken}>
              <FormLabel>Department</FormLabel>
              <Select value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Select department">
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
              <FormHelperText color={chosenIsTaken ? 'red.500' : undefined}>
                {chosenIsTaken
                  ? 'This department already has a head. Remove them below first.'
                  : 'Departments come from the timetable.'}
              </FormHelperText>
            </FormControl>
            <Button
              type="submit"
              colorScheme="purple"
              leftIcon={<FiUserPlus />}
              isLoading={submitting}
              isDisabled={chosenIsTaken}
              px={8}
              flexShrink={0}
              mt={{ base: 0, md: 8 }}
            >
              {/* Named for what it assigns, not just "Assign": the dean panel
                  below has its own, and two buttons reading the same word on
                  one page is a coin flip for anyone navigating by label. */}
              Assign head
            </Button>
          </Flex>
        </Box>

        <Box bg={cardBg} borderWidth="1px" borderColor={border} borderRadius="xl" p={6} mb={8}>
          <Flex justify="space-between" align="center" gap={3} wrap="wrap" mb={4}>
            <Heading as="h2" size="md">
              Current Heads of Department
            </Heading>
            <Text fontSize="sm" color={subColor}>
              {heads.length} of {departments.length || '—'} departments
            </Text>
          </Flex>
          {loadingHeads ? (
            <Flex justify="center" py={8}>
              <Spinner />
            </Flex>
          ) : heads.length === 0 ? (
            <Text color={subColor}>No heads of department assigned yet.</Text>
          ) : (
            <Box overflowX="auto">
              <Table size="md" variant="simple">
                <Thead>
                  <Tr>
                    <Th>Department</Th>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Assigned</Th>
                    <Th width="1%">Remove</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {heads.map((head) => (
                    <Tr key={head._id || head.dept}>
                      <Td>
                        <Badge colorScheme="purple" borderRadius="full" px={3} py={1}>
                          {head.dept}
                        </Badge>
                      </Td>
                      {/* Editable in place. An account opened by this screen is
                          named for the post it holds, `Head-CSE`, because no
                          name was asked for — this is where that becomes a
                          person's name, whenever it is learned. Accounts that
                          predate the post naming carry the address as their
                          name, which is not one, so the cell shows nothing. */}
                      <Td>
                        <EditableName
                          value={head.name && head.name !== head.email ? head.name : ''}
                          label={`the head of ${head.dept}`}
                          onSave={(name) => handleRename(head, name)}
                        />
                      </Td>
                      <Td>{head.email || '—'}</Td>
                      <Td>{formatDate(head.assignedAt)}</Td>
                      <Td>
                        <IconButton
                          aria-label={`Remove the head of ${head.dept}`}
                          icon={<FiTrash2 />}
                          size="sm"
                          colorScheme="red"
                          variant="ghost"
                          isLoading={removing === head.dept}
                          onClick={() => handleRemove(head)}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </Box>

        {/* The same decision at institute scope. Its own panel with its own
            reads, so a failure fetching deans cannot blank the mapping above. */}
        <DeanAssignPanel />

        {/* And what the two dashboards those appointments open actually carry. */}
        <DashboardSectionsPanel />
      </Container>
    </Box>
  );
};

export default HodAssignPage;
