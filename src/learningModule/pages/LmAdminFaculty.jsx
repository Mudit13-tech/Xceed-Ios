import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Link as RouterLinkStyle,
  Select,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard, StatTile } from '../components/common';

/**
 * Faculty accounts, for an lm-admin.
 *
 * Its own page rather than a card on the admin dashboard, because it is the one
 * screen in the module that *writes* to the platform's user collection. FACULTY
 * is now the only role that opens a class, sets a paper or reads an answer key
 * (see middleware/lmAuth.js), so everything on this page hands out all of that
 * at once — and a form that does that should not share a scroll with a feedback
 * inbox.
 *
 * No password field, deliberately. The account is created with one nobody ever
 * learns and claimed through the platform's existing OTP flow at
 * /forgot-password, which is also what the welcome mail links to. An
 * administrator typing a password here would mean mailing it, or telling it to
 * somebody down a corridor — and an unclaimed account that nobody can sign into
 * is the safer thing to leave lying around.
 */

/** The directory row's one piece of state worth colouring. */
function ClaimBadge({ claimed }) {
  return (
    <Badge colorScheme={claimed ? 'green' : 'orange'} borderRadius="full" px={2}>
      {claimed ? 'active' : 'not claimed'}
    </Badge>
  );
}

function CreateFacultyCard({ onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dept, setDept] = useState('');
  const [branches, setBranches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    // The same list the create-class form picks a branch from, so a faculty
    // account and the classes they will open are filed under one spelling of
    // the department rather than two.
    lmApi.ttBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await lmApi.adminCreateFaculty({ name, email, dept });
      setName('');
      setEmail('');
      setDept('');
      toast({
        status: 'success',
        title: result.created ? 'Faculty account created' : 'Faculty role added',
        description: result.created
          ? `${result.faculty.email} can set a password from the email on its way to them.`
          : `${result.faculty.email} already had an account — it is now faculty as well.`,
        duration: 8000,
        isClosable: true,
      });
      onCreated();
    } catch (err) {
      // Inline rather than a toast: every one of these is about a field on this
      // form, and the form is what the administrator is looking at.
      setError(err.message || 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Add a faculty member"
      subtitle="Creates a platform account with the FACULTY role and emails them a link to set their own password."
    >
      <form onSubmit={submit}>
        {error && (
          <Alert status="error" borderRadius="md" mb={4} fontSize="sm">
            <AlertIcon />
            {error}
          </Alert>
        )}

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={4}>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Full name</FormLabel>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Dr. A. Sharma"
              autoFocus
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Email</FormLabel>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@nitj.ac.in"
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Department</FormLabel>
            <Select
              value={dept}
              onChange={(event) => setDept(event.target.value)}
              placeholder={branches.length ? 'Select department' : 'No timetable branches'}
              isDisabled={!branches.length}
            >
              {branches.map((branch) => (
                <option key={branch.code} value={branch.dept}>
                  {branch.dept}
                </option>
              ))}
            </Select>
          </FormControl>
        </SimpleGrid>

        <Flex justify="space-between" align="center" gap={3} wrap="wrap">
          <Text fontSize="xs" color="lmFg.muted" maxW="620px">
            The name is what appears on their class cards and on every paper they set, so it is
            worth getting right here. If the address already has an account, it keeps its name and
            department and simply gains the faculty role.
          </Text>
          <Button type="submit" colorScheme="blue" isLoading={busy} isDisabled={!name || !email}>
            Create account
          </Button>
        </Flex>
      </form>
    </SectionCard>
  );
}

export default function LmAdminFaculty() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (q) => {
    setError(null);
    try {
      setData(await lmApi.adminListFaculty(q));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Debounced: the box filters a directory on the server, and a query per
    // keystroke would be a query per keystroke.
    const timer = setTimeout(() => load(search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  if (loading) return <Loading label="Loading faculty…" />;
  if (error) return <ErrorState error={error} onRetry={() => load(search)} />;

  const { totals, faculty, truncated } = data;

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
          <Box>
            <Text fontSize="xl" fontWeight="700" color="lmFg.heading">
              Faculty accounts
            </Text>
            <Text fontSize="sm" color="lmFg.muted">
              Everyone who can open a class, set coursework and run tests.
            </Text>
          </Box>
          <RouterLinkStyle as={RouterLink} to="/learning/lm-admin" fontSize="sm" color="blue.600">
            ← Admin dashboard
          </RouterLinkStyle>
        </Flex>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 2 }} spacing={4}>
        {/* Accounts holding the role — not teaching memberships, which count
            somebody teaching four classes four times and a new faculty member
            with no class yet not at all. */}
        <StatTile label="Total faculty" value={totals.faculty} accent="orange.500" />
        <StatTile
          label="Total classes"
          value={totals.classes}
          hint={`${totals.activeClasses} active`}
          accent="blue.500"
        />
      </SimpleGrid>

      <CreateFacultyCard onCreated={() => load(search)} />

      <SectionCard
        title="Directory"
        subtitle="Check a name here before adding it — an address that already has an account is not created twice."
        action={
          <Input
            size="sm"
            maxW="240px"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email or dept"
          />
        }
      >
        {faculty.length === 0 ? (
          <EmptyState
            icon="🎓"
            title={search ? 'Nobody matches that' : 'No faculty accounts yet'}
            description={
              search
                ? 'Try part of an email address instead.'
                : 'Add the first one with the form above.'
            }
          />
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Department</Th>
                  <Th isNumeric>Classes</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {faculty.map((person) => (
                  <Tr key={person._id}>
                    <Td fontWeight="600">{person.name || '—'}</Td>
                    <Td>{person.email}</Td>
                    <Td>{person.dept || '—'}</Td>
                    <Td isNumeric>{person.classCount}</Td>
                    <Td>
                      <ClaimBadge claimed={person.claimed} />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {truncated && (
              <Text fontSize="xs" color="lmFg.muted" mt={3}>
                Showing the 100 most recent. Use the search box to find anyone else.
              </Text>
            )}
          </Box>
        )}
      </SectionCard>
    </VStack>
  );
}
