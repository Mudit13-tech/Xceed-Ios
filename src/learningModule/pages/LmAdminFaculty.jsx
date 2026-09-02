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
  HStack,
  Input,
  Link as RouterLinkStyle,
  Select,
  SimpleGrid,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Wrap,
  WrapItem,
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

/** The one-line summary of what an import actually did, for the toast. */
function importSummary(result) {
  const parts = [];
  if (result.imported) parts.push(`${result.imported} invited`);
  if (result.roleAdded) parts.push(`${result.roleAdded} existing account${result.roleAdded === 1 ? '' : 's'} made faculty`);
  if (result.alreadyInvited) parts.push(`${result.alreadyInvited} already invited`);
  if (result.skippedDuplicates) parts.push(`${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? '' : 's'} skipped`);
  if (result.skippedWithoutEmail) parts.push(`${result.skippedWithoutEmail} without an email address`);
  if (result.failed) parts.push(`${result.failed} failed`);
  return parts.length ? `${parts.join(', ')}.` : 'Nothing left to import — everyone already has an account.';
}

/**
 * Opening accounts from the timetable module's master faculty table.
 *
 * That table is the institute's real list of who teaches here — the timetable
 * office maintains it and every timetable is built off it — so re-typing three
 * hundred of the same names into the form below is work nobody should be doing.
 *
 * The card leads with one button that imports every department, because that is
 * what an administrator setting the module up actually wants, and offers a
 * button per department underneath for the ordinary case afterwards: one
 * department has hired somebody and the rest have not changed.
 *
 * Pressing any of them twice is safe and the copy says so. An address that
 * already has a faculty account is skipped rather than mailed a second time,
 * and the master table's habit of listing one person under two departments is
 * collapsed before anything is created — which is the whole reason this is a
 * button and not a spreadsheet paste.
 */
function ImportFromMasterCard({ onImported }) {
  const [preview, setPreview] = useState(null);
  const [failed, setFailed] = useState(false);
  // The department currently importing, or '*' for the all-departments button.
  // One at a time: the buttons write to the same collection, and two imports
  // racing would each report counts the other invalidated.
  const [busy, setBusy] = useState('');
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      setPreview(await lmApi.adminFacultyImportPreview());
      setFailed(false);
    } catch {
      // A missing or empty master table is not this screen's failure — the rest
      // of the page still works, and the card simply says it has nothing.
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runImport = async (dept) => {
    setBusy(dept || '*');
    try {
      const result = await lmApi.adminImportFaculty(dept);
      toast({
        status: result.imported || result.roleAdded ? 'success' : 'info',
        title: dept ? `${dept} imported` : 'Master faculty imported',
        description: importSummary(result),
        duration: 9000,
        isClosable: true,
      });
      // Both lists move: the directory gains the new accounts, and the preview's
      // "to invite" counts fall to zero for what was just imported.
      await Promise.all([refresh(), onImported()]);
    } catch (err) {
      toast({
        status: 'error',
        title: 'Import failed',
        description: err.message || 'Could not import from the master faculty list.',
        duration: 9000,
        isClosable: true,
      });
    } finally {
      setBusy('');
    }
  };

  if (failed) return null;

  if (!preview) {
    return (
      <SectionCard title="Import from timetable master faculty">
        <HStack spacing={3} color="lmFg.muted" fontSize="sm">
          <Spinner size="sm" />
          <Text>Reading the master faculty list…</Text>
        </HStack>
      </SectionCard>
    );
  }

  const { departments = [], totals = {} } = preview;
  const pending = totals.pending || 0;

  return (
    <SectionCard
      title="Import from timetable master faculty"
      subtitle="Opens a faculty account for everyone in the timetable module's master list and emails them a link to set their own password."
      action={
        <Button
          size="sm"
          colorScheme="purple"
          onClick={() => runImport('')}
          isLoading={busy === '*'}
          isDisabled={Boolean(busy) || pending === 0}
        >
          {pending ? `Import all ${pending} faculty` : 'Everyone imported'}
        </Button>
      }
    >
      <Text fontSize="sm" color="lmFg.muted" mb={4}>
        {totals.total || 0} people in the master list have an email address
        {totals.withoutEmail ? `, ${totals.withoutEmail} do not and cannot be invited` : ''}
        {totals.duplicates ? `, and ${totals.duplicates} repeated address${totals.duplicates === 1 ? '' : 'es'} will be imported once` : ''}
        . {totals.alreadyInvited || 0} already have an account and are skipped, so running this
        again invites only whoever is new.
      </Text>

      {departments.length === 0 ? (
        <EmptyState
          icon="📋"
          title="The master faculty list is empty"
          description="Add faculty in the timetable module first, or use the form below for one-off accounts."
        />
      ) : (
        <Wrap spacing={2}>
          {departments.map((row) => (
            <WrapItem key={row.dept}>
              <Button
                size="xs"
                borderRadius="full"
                variant={row.pending ? 'outline' : 'ghost'}
                colorScheme={row.pending ? 'purple' : 'gray'}
                onClick={() => runImport(row.dept)}
                isLoading={busy === row.dept}
                // Nothing to do rather than nothing there: a department whose
                // people all have accounts stays visible and greyed, so the
                // absence of a button reads as "done", not "missing".
                isDisabled={Boolean(busy) || row.pending === 0}
                title={`${row.alreadyInvited} of ${row.total} already invited`}
              >
                {row.dept} {row.pending ? `· ${row.pending} to invite` : '· all invited'}
              </Button>
            </WrapItem>
          ))}
        </Wrap>
      )}
    </SectionCard>
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

/** The date the directory shows, short enough to sit in a table cell. */
const joinedOn = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * The directory rows, split into one block per department.
 *
 * The server already sorts by department and then by account age, so this only
 * has to cut the list where the department changes — which keeps the two
 * orderings in one place instead of having the client re-sort what the server
 * just sorted, and means the department headings agree with the rows under them
 * even when the 200-row cap truncates the list.
 */
const groupByDept = (faculty) => {
  const groups = [];
  faculty.forEach((person) => {
    const dept = person.dept || 'Unassigned';
    const last = groups[groups.length - 1];
    if (last && last.dept === dept) last.people.push(person);
    else groups.push({ dept, people: [person] });
  });
  return groups;
};

export default function LmAdminFaculty() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (q, dept) => {
    setError(null);
    try {
      setData(await lmApi.adminListFaculty({ q, dept }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Debounced: the box filters a directory on the server, and a query per
    // keystroke would be a query per keystroke. The department is not typed, so
    // it does not wait.
    const timer = setTimeout(() => load(search, selectedDept), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search, selectedDept]);

  if (loading) return <Loading label="Loading faculty…" />;
  if (error) return <ErrorState error={error} onRetry={() => load(search, selectedDept)} />;

  const { totals, faculty, truncated } = data;
  const departments = totals.departments || [];
  const groups = groupByDept(faculty);

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
          <Flex gap={4} align="center" wrap="wrap">
            <RouterLinkStyle as={RouterLink} to="/learning/lm-admin/hod-dashboard" fontSize="sm" color="purple.600">
              HOD Activity Dashboard →
            </RouterLinkStyle>
            <RouterLinkStyle as={RouterLink} to="/learning/lm-admin" fontSize="sm" color="blue.600">
              ← Admin dashboard
            </RouterLinkStyle>
          </Flex>
        </Flex>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        {/* Accounts holding the role — not teaching memberships, which count
            somebody teaching four classes four times and a new faculty member
            with no class yet not at all. */}
        <StatTile label="Total faculty" value={totals.faculty} accent="orange.500" />
        <StatTile
          label="Claimed"
          value={totals.claimedFaculty ?? 0}
          hint={`${Math.max(0, totals.faculty - (totals.claimedFaculty ?? 0))} still to claim`}
          accent="green.500"
        />
        <StatTile label="Departments" value={departments.length} accent="purple.500" />
        <StatTile
          label="Total classes"
          value={totals.classes}
          hint={`${totals.activeClasses} active`}
          accent="blue.500"
        />
      </SimpleGrid>

      <ImportFromMasterCard onImported={() => load(search, selectedDept)} />

      {departments.length > 0 && (
        <SectionCard
          title="Department-wise distribution"
          subtitle="Click a department to filter the directory below. The second number is how many have claimed their account."
        >
          <Wrap spacing={2}>
            <WrapItem>
              <Button
                size="xs"
                borderRadius="full"
                variant={selectedDept === '' ? 'solid' : 'outline'}
                colorScheme={selectedDept === '' ? 'blue' : 'gray'}
                onClick={() => setSelectedDept('')}
              >
                All departments ({totals.faculty})
              </Button>
            </WrapItem>
            {departments.map((row) => {
              const isSelected = selectedDept === row.dept;
              return (
                <WrapItem key={row.dept}>
                  <Button
                    size="xs"
                    borderRadius="full"
                    variant={isSelected ? 'solid' : 'outline'}
                    colorScheme={isSelected ? 'blue' : 'gray'}
                    onClick={() => setSelectedDept(isSelected ? '' : row.dept)}
                  >
                    {row.dept} ({row.claimed}/{row.count})
                  </Button>
                </WrapItem>
              );
            })}
          </Wrap>
        </SectionCard>
      )}

      <CreateFacultyCard onCreated={() => load(search, selectedDept)} />

      <SectionCard
        title="Directory"
        subtitle="Grouped by department, and within each one the accounts opened first come first. Check a name here before adding it — an address that already has an account is not created twice."
        action={
          <HStack spacing={2} wrap="wrap">
            <Select
              size="sm"
              maxW="220px"
              value={selectedDept}
              onChange={(event) => setSelectedDept(event.target.value)}
              placeholder="All departments"
            >
              {departments.map((row) => (
                <option key={row.dept} value={row.dept}>
                  {row.dept} ({row.count})
                </option>
              ))}
            </Select>
            <Input
              size="sm"
              maxW="240px"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email or dept"
            />
          </HStack>
        }
      >
        {faculty.length === 0 ? (
          <EmptyState
            icon="🎓"
            title={search || selectedDept ? 'Nobody matches that' : 'No faculty accounts yet'}
            description={
              search || selectedDept
                ? 'Try part of an email address, or clear the department filter.'
                : 'Import the master faculty list above, or add one with the form.'
            }
          />
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Added</Th>
                  <Th isNumeric>Classes</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              {/* One tbody per department rather than a Department column: the
                  rows are already contiguous by department, and a heading a
                  reader can scroll to beats the same string repeated forty
                  times down a column. */}
              {groups.map((group) => (
                <Tbody key={group.dept}>
                  <Tr>
                    <Td colSpan={5} bg="blackAlpha.50" py={2}>
                      <HStack spacing={2}>
                        <Text fontWeight="700" fontSize="sm" color="lmFg.heading">
                          {group.dept}
                        </Text>
                        <Text fontSize="xs" color="lmFg.muted">
                          {group.people.length} shown ·{' '}
                          {group.people.filter((person) => person.claimed).length} claimed
                        </Text>
                      </HStack>
                    </Td>
                  </Tr>
                  {group.people.map((person) => (
                    <Tr key={person._id}>
                      <Td fontWeight="600">{person.name || '—'}</Td>
                      <Td>{person.email}</Td>
                      <Td whiteSpace="nowrap">{joinedOn(person.createdAt)}</Td>
                      <Td isNumeric>
                        <RouterLinkStyle
                          as={RouterLink}
                          to={`/learning/lm-admin/faculty/${person._id}/classes`}
                          color="blue.600"
                          fontWeight="600"
                        >
                          {person.classCount}
                        </RouterLinkStyle>
                      </Td>
                      <Td>
                        <ClaimBadge claimed={person.claimed} />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              ))}
            </Table>
            {truncated && (
              <Text fontSize="xs" color="lmFg.muted" mt={3}>
                Showing the first 200 accounts. Filter by department or use the search box to find
                anyone else.
              </Text>
            )}
          </Box>
        )}
      </SectionCard>
    </VStack>
  );
}
