import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Select,
  Spinner,
  Table,
  Tab,
  TabList,
  Tabs,
  Tag,
  TagCloseButton,
  TagLabel,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { FiArrowLeft, FiSearch, FiUserPlus, FiUsers } from 'react-icons/fi';
import getEnvironment from '../getenvironment';

const apiUrl = getEnvironment();

/* The screen used to fetch every account in one response and filter it in the
   browser. On an institute-sized database that is megabytes of JSON, nearly
   all of it students, rendered as thousands of table rows each carrying a
   select and a menu — the reason this page took so long to open.

   Now the server does the filtering (GET /user/getuser/all?role=&search=&page=)
   and the screen asks for one role at a time, a page at a time. */
const PAGE_SIZE = 50;

/* Two tabs that are not roles. Prefixed so they cannot collide with a role
   somebody types into the database. */
const ALL_TAB = '__all__';
const NO_ROLE_TAB = '__norole__';

/* Students outnumber every other kind of account together, so their tab is
   last and — because no tab fetches until it is opened — their rows are never
   fetched at all unless somebody goes looking for them. */
const STUDENT_ROLE = 'student';

const roleKey = (value) => String(value || '').trim().toLowerCase();

/* Tab order: All, then the roles in the order the Add Role dropdown lists
   them (which is the order they are meant to be read in), then any role held
   in the database that the dropdown does not offer, then the accounts with no
   role, and Student last. */
const orderTabs = (counts) => {
  const byKey = new Map(counts.map((entry) => [roleKey(entry.role), entry]));
  const known = ROLE_OPTIONS.map((option) => roleKey(option.value));
  const student = byKey.get(STUDENT_ROLE);

  const ordered = [];
  for (const key of known) {
    if (key === STUDENT_ROLE) continue;
    const entry = byKey.get(key);
    if (entry) ordered.push(entry);
  }
  for (const entry of counts) {
    const key = roleKey(entry.role);
    if (key === STUDENT_ROLE || known.includes(key)) continue;
    ordered.push(entry);
  }
  return { ordered, student };
};

/* The dropdown's own wording where it has one, so a tab reads "Head of
   Department" rather than whichever casing that role was typed in. */
const roleLabel = (entry) => {
  const match = ROLE_OPTIONS.find((option) => roleKey(option.value) === roleKey(entry.role));
  return match ? match.label : (entry.label || entry.role);
};

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'ITTC', label: 'Institute Time Table Coordinator' },
  { value: 'DTTI', label: 'Department Time Table Coordinator' },
  { value: 'CM', label: 'Certificate Manager' },
  { value: 'EO', label: 'Event Organiser' },
  { value: 'editor', label: 'Editor' },
  { value: 'PRM', label: 'PRM' },
  { value: 'FACULTY', label: 'Faculty' },
  /* Spelled STUDENT, and it has to be. Most of the platform folds role case
     when it reads, but the places that decide whether somebody IS a student do
     not: studentRoute's `user.role.includes("STUDENT")`, the learning module's
     `User.find({ role: "STUDENT" })` roster queries, and the help desk's
     account snapshot are all exact matches. A lowercase `student` here would
     assign a role that looked right on this screen and made the account
     invisible to every one of them.

     Beside Faculty because that is the pair: the two roles the learning module
     is built around. It was the one missing from this list — accounts got it
     from enrolment (accountProvisioning) or the ERP import, and an
     administrator with somebody in front of them had no way to grant it. */
  { value: 'STUDENT', label: 'Student' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'patient', label: 'Patient' },
  { value: 'dm-admin', label: 'Diabetics Module Admin' },
  { value: 'iams-admin', label: 'iLEED Admin' },
  { value: 'iams-dept-admin', label: 'iLEED Department Admin' },
  { value: 'lm-admin', label: 'LM Admin' },
  /* Department-scoped: the server refuses any of the three to an account with
     no primary department, because every module that reads them answers "which
     department?" from that field. Set the department in the same row first.

     `HOD` is the appointment and says nothing about what a head may open; the
     two below are the dashboards, one each, so a department can be given the
     Learning view without the attendance one or the other way round. Assigning
     a head from /superadmin/hods grants all three — these rows are for adding
     a dashboard back, or taking one away, without ending the appointment. */
  { value: 'HOD', label: 'Head of Department' },
  { value: 'hod-learning', label: 'HOD — Xceed Learning Dashboard' },
  { value: 'hod-ileed', label: 'HOD — iLEED Dashboard' },
  /* Institute-wide, so unlike HOD above it needs no department — there is
     nothing to scope it to. /superadmin/deans is the usual way to grant it and
     shows who holds it; this row is so the role can be seen and taken away from
     the screen that manages every other one. */
  { value: 'DEAN', label: 'Dean (Academic)' },
];

/* Roles are typed by hand, so the same role is stored `HOD`, `hod` and `Hod`.
   Compared on the key, or the dropdown offers a role the account already holds
   in another spelling — and adding it writes a duplicate. */
const roleHeld = (roles, role) =>
  (Array.isArray(roles) ? roles : [roles])
    .filter(Boolean)
    .some((held) => String(held).trim().toLowerCase() === String(role).trim().toLowerCase());

const userEmails = (user) =>
  (Array.isArray(user.email) ? user.email : [user.email]).filter(Boolean).map(String);

const userEmail = (user) => userEmails(user).join(', ');

const departmentKey = (value) =>
  String(value || '').trim().replace(/[\s_-]+/g, '').toUpperCase();

const uniqueDepartments = (values) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter((value) => {
      const key = departmentKey(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const assignedDepartments = (user) =>
  uniqueDepartments([user.dept, ...(user.attendanceDepartments || [])]);

const sameDepartments = (left, right) => {
  const leftKeys = uniqueDepartments(left).map(departmentKey).sort();
  const rightKeys = uniqueDepartments(right).map(departmentKey).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index]);
};

const UserManagementPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  // The term actually sent to the server. `search` is what is typed; this
  // trails it by a beat so a nine-character address is one query, not nine.
  const [query, setQuery] = useState('');
  const [roleCounts, setRoleCounts] = useState([]);
  const [withoutRole, setWithoutRole] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeTab, setActiveTab] = useState(ALL_TAB);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState({});
  const [assigning, setAssigning] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [departmentDrafts, setDepartmentDrafts] = useState({});
  const [attendanceDepartmentDrafts, setAttendanceDepartmentDrafts] = useState({});
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [savingDepartment, setSavingDepartment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { userId, role, email }
  const [deleting, setDeleting] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef();

  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const headBg = useColorModeValue('gray.50', 'gray.900');
  const iconBg = useColorModeValue('teal.50', 'teal.900');
  const iconColor = useColorModeValue('teal.600', 'teal.300');

  /* Every page of rows lands here. Department drafts are seeded per row as it
     arrives rather than for the whole collection up front, because the whole
     collection is no longer what arrives. */
  const absorb = (rows, append) => {
    setUsers((current) => (append ? [...current, ...rows] : rows));
    setDepartmentDrafts((current) => ({
      ...current,
      ...Object.fromEntries(rows.map((u) => [u._id, u.dept || ''])),
    }));
    setAttendanceDepartmentDrafts((current) => ({
      ...current,
      ...Object.fromEntries(rows.map((u) => [u._id, assignedDepartments(u)])),
    }));
  };

  const listUrl = (tab, term, pageNumber) => {
    const params = new URLSearchParams({
      page: String(pageNumber),
      limit: String(PAGE_SIZE),
    });
    if (tab === NO_ROLE_TAB) params.set('noRole', '1');
    else if (tab !== ALL_TAB) params.set('role', tab);
    if (term) params.set('search', term);
    return `${apiUrl}/user/getuser/all?${params.toString()}`;
  };

  /* The tab strip, and the department list behind the two selects in each row.
     Both are per-screen rather than per-tab, so they are read once here; the
     rows themselves are read by the effect below, per tab. */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/user/getuser/rolecounts`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to fetch roles: ${res.statusText}`);
        const data = await res.json();
        setRoleCounts(data.roles || []);
        setWithoutRole(data.withoutRole || 0);
        setTotalUsers(data.total || 0);
      } catch (err) {
        toast({ title: 'Could not load roles', description: err.message, status: 'error', duration: 6000, isClosable: true });
      }
    })();

    (async () => {
      try {
        const res = await fetch(
          `${apiUrl}/timetablemodule/timetable/sess/allsessanddept`,
          { credentials: 'include' },
        );
        if (!res.ok) throw new Error('Failed to load departments');
        const data = await res.json();
        const unique = Array.from(
          new Set((data.uniqueDept || []).map((d) => d?.trim()).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b));
        setDepartments(unique);
      } catch (err) {
        toast({ title: 'Could not load departments', description: err.message, status: 'error', duration: 6000, isClosable: true });
      } finally {
        setDepartmentsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typing is not a query. 300ms is below the point a search feels laggy and
  // above the point where every keystroke is a round trip.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  /* The first page of whichever tab is open, refetched when the tab or the
     search term changes. A stale-response guard rather than an abort: two tabs
     clicked quickly can otherwise settle in the order they answered rather
     than the order they were asked. */
  useEffect(() => {
    let current = true;
    setIsLoading(true);
    setPage(1);
    (async () => {
      try {
        const res = await fetch(listUrl(activeTab, query, 1), { credentials: 'include' });
        if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);
        const data = await res.json();
        if (!current) return;
        absorb(data.user || [], false);
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        if (!current) return;
        setUsers([]);
        setHasMore(false);
        toast({ title: 'Could not load users', description: err.message, status: 'error', duration: 6000, isClosable: true });
      } finally {
        if (current) setIsLoading(false);
      }
    })();
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, query]);

  const loadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    try {
      const res = await fetch(listUrl(activeTab, query, next), { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);
      const data = await res.json();
      absorb(data.user || [], true);
      setHasMore(Boolean(data.hasMore));
      setPage(next);
    } catch (err) {
      toast({ title: 'Could not load more users', description: err.message, status: 'error', duration: 6000, isClosable: true });
    } finally {
      setLoadingMore(false);
    }
  };

  /* The tabs, in reading order with Student last. An account holding two roles
     is counted in — and listed under — both, because the server matches the
     role array and a person really is both things. */
  const tabs = useMemo(() => {
    const { ordered, student } = orderTabs(roleCounts);
    const strip = [
      { key: ALL_TAB, label: 'All users', count: totalUsers },
      ...ordered.map((entry) => ({
        key: roleKey(entry.role),
        label: roleLabel(entry),
        count: entry.count,
      })),
    ];
    if (withoutRole > 0) strip.push({ key: NO_ROLE_TAB, label: 'No role', count: withoutRole });
    if (student) {
      strip.push({ key: STUDENT_ROLE, label: roleLabel(student), count: student.count });
    }
    return strip;
  }, [roleCounts, withoutRole, totalUsers]);

  const activeIndex = Math.max(tabs.findIndex((tab) => tab.key === activeTab), 0);

  /* Removing the last account holding a role takes its tab away. Without this
     the strip would highlight All users while the table still showed the rows
     of the tab that no longer exists. */
  useEffect(() => {
    if (tabs.length && !tabs.some((tab) => tab.key === activeTab)) setActiveTab(ALL_TAB);
  }, [tabs, activeTab]);

  /* Assigning or removing a role moves an account between tabs. Adjusted here
     rather than by refetching the counts: the counts are several indexed
     counts on the server, and one of them is every student in the institute. */
  const shiftRoleCount = (role, delta) => {
    const key = roleKey(role);
    setRoleCounts((current) => {
      const seen = current.some((entry) => roleKey(entry.role) === key);
      if (!seen) return delta > 0 ? [...current, { role: key, label: role, count: 1 }] : current;
      return current
        .map((entry) => (roleKey(entry.role) === key
          ? { ...entry, count: Math.max(0, entry.count + delta) }
          : entry))
        .filter((entry) => entry.count > 0);
    });
  };

  const replaceUser = (updated) =>
    setUsers((current) => current.map((u) => (u._id === updated._id ? updated : u)));

  const handleAssignRole = async (user) => {
    const role = selectedRoles[user._id];
    if (!role) return;
    if (user.role.includes(role)) {
      toast({ title: 'Role already assigned', status: 'info', duration: 3000, isClosable: true });
      return;
    }
    setAssigning(user._id);
    try {
      const res = await fetch(`${apiUrl}/user/getuser/assignrole`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user._id, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign role');
      replaceUser(data.user);
      shiftRoleCount(role, 1);
      setSelectedRoles((s) => ({ ...s, [user._id]: '' }));
      toast({ title: `Role "${role}" assigned`, status: 'success', duration: 3000, isClosable: true });
    } catch (err) {
      toast({ title: 'Could not assign role', description: err.message, status: 'error', duration: 6000, isClosable: true });
    } finally {
      setAssigning(null);
    }
  };

  const confirmDeleteRole = (user, role) => {
    setDeleteTarget({ userId: user._id, role, email: userEmail(user) });
    onOpen();
  };

  const handleDeleteRole = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiUrl}/user/getuser/deleterole`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: deleteTarget.userId, role: deleteTarget.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove role');
      replaceUser(data.user);
      shiftRoleCount(deleteTarget.role, -1);
      /* Losing the role that names the open tab means losing the row: it is no
         longer one of the accounts this tab asked for, and leaving it there
         would say the removal had not worked. */
      if (roleKey(deleteTarget.role) === roleKey(activeTab)) {
        setUsers((current) => current.filter((u) => u._id !== deleteTarget.userId));
      }
      toast({ title: `Role "${deleteTarget.role}" removed`, status: 'success', duration: 3000, isClosable: true });
      onClose();
    } catch (err) {
      toast({ title: 'Could not remove role', description: err.message, status: 'error', duration: 6000, isClosable: true });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const setPrimaryDepartmentDraft = (userId, department) => {
    setDepartmentDrafts((current) => ({ ...current, [userId]: department }));
    setAttendanceDepartmentDrafts((current) => ({
      ...current,
      [userId]: uniqueDepartments([department, ...(current[userId] || [])]),
    }));
  };

  const setAssignedDepartmentDraft = (user, values) => {
    const primaryDepartment = departmentDrafts[user._id] ?? user.dept ?? '';
    setAttendanceDepartmentDrafts((current) => ({
      ...current,
      [user._id]: uniqueDepartments([
        primaryDepartment,
        ...(Array.isArray(values) ? values : [values]),
      ]),
    }));
  };

  const handleDepartmentUpdate = async (user) => {
    const dept = departmentDrafts[user._id] || '';
    const attendanceDepartments = uniqueDepartments([
      dept,
      ...(attendanceDepartmentDrafts[user._id] || assignedDepartments(user)),
    ]);
    setSavingDepartment(user._id);
    try {
      const res = await fetch(`${apiUrl}/user/getuser/department`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user._id,
          dept,
          attendanceDepartments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to update department');
      replaceUser(data.user);
      setDepartmentDrafts((d) => ({ ...d, [user._id]: data.user.dept || '' }));
      setAttendanceDepartmentDrafts((current) => ({
        ...current,
        [user._id]: assignedDepartments(data.user),
      }));
      toast({ title: 'Department access updated', status: 'success', duration: 3000, isClosable: true });
    } catch (err) {
      toast({ title: 'Could not update department', description: err.message, status: 'error', duration: 6000, isClosable: true });
    } finally {
      setSavingDepartment(null);
    }
  };

  return (
    <Box bg={pageBg} minH="100vh" py={{ base: 6, md: 10 }}>
      <Container maxW="6xl">
        {/* Header */}
        <Flex
          align={{ base: 'flex-start', md: 'center' }}
          justify="space-between"
          direction={{ base: 'column', md: 'row' }}
          gap={4}
          mb={8}
        >
          <Flex align="center" gap={4}>
            <IconButton
              aria-label="Go back"
              icon={<FiArrowLeft />}
              variant="ghost"
              onClick={() => navigate(-1)}
            />
            <Flex align="center" justify="center" boxSize={12} borderRadius="lg" bg={iconBg} color={iconColor}>
              <Icon as={FiUsers} boxSize={6} />
            </Flex>
            <Box>
              <Heading as="h1" size="lg">
                User Management
              </Heading>
              <Text color={subColor} fontSize="sm">
                {totalUsers} user{totalUsers === 1 ? '' : 's'} — manage roles and departments
              </Text>
            </Box>
          </Flex>
          <Button
            colorScheme="teal"
            leftIcon={<FiUserPlus />}
            onClick={() => navigate('/register')}
            flexShrink={0}
          >
            Create New User
          </Button>
        </Flex>

        {/* One tab per role, Student last. Selecting one asks the server for
            that role's accounts; nothing else is fetched. An account holding
            two roles appears under both. */}
        <Tabs
          index={activeIndex}
          onChange={(index) => setActiveTab(tabs[index]?.key ?? ALL_TAB)}
          variant="soft-rounded"
          colorScheme="teal"
          mb={5}
        >
          <TabList flexWrap="wrap" gap={2} borderBottom="none">
            {tabs.map((tab) => (
              <Tab key={tab.key} fontSize="sm" fontWeight="600">
                {tab.label}
                <Badge ml={2} borderRadius="full" px={2} colorScheme="teal" variant="subtle">
                  {tab.count}
                </Badge>
              </Tab>
            ))}
          </TabList>
        </Tabs>

        {/* Search */}
        <InputGroup mb={6} maxW="md">
          <InputLeftElement pointerEvents="none">
            <Icon as={FiSearch} color={subColor} />
          </InputLeftElement>
          <Input
            placeholder="Search by email, name or department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            bg={cardBg}
          />
        </InputGroup>
        {/* The search runs on the server, over the whole collection rather than
            the page on screen — but within the open tab, so say which. */}
        <Text color={subColor} fontSize="xs" mt={-4} mb={6}>
          {activeTab === ALL_TAB
            ? 'Searching every account.'
            : `Searching accounts with the ${tabs[activeIndex]?.label ?? ''} role. Use All users to search everyone.`}
        </Text>

        {/* Table */}
        <Box bg={cardBg} borderWidth="1px" borderColor={border} borderRadius="xl" overflow="hidden">
          {isLoading ? (
            <Flex justify="center" py={16}>
              <Spinner size="lg" />
            </Flex>
          ) : users.length === 0 ? (
            <Text color={subColor} textAlign="center" py={16}>
              {query ? 'No users match your search.' : 'No users found.'}
            </Text>
          ) : (
            <Box overflowX="auto">
              <Table size="md" variant="simple">
                <Thead bg={headBg}>
                  <Tr>
                    <Th>Email</Th>
                    <Th minW="300px">Department Access</Th>
                    <Th>Roles</Th>
                    <Th minW="260px">Add Role</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {users.map((user) => (
                    <Tr key={user._id}>
                      <Td wordBreak="break-all">
                        <Flex align="flex-start" gap={2}>
                          <Box>
                            {userEmails(user).map((address) => (
                              <Text key={address} fontWeight="500">
                                {address}
                              </Text>
                            ))}
                          </Box>
                          <Badge
                            colorScheme={userEmails(user).length > 1 ? 'purple' : 'gray'}
                            borderRadius="full"
                            px={2}
                            flexShrink={0}
                            title={`${userEmails(user).length} email address(es) attached to this account`}
                          >
                            {userEmails(user).length}
                          </Badge>
                        </Flex>
                      </Td>
                      <Td>
                        <Flex direction="column" align="stretch" gap={2}>
                          <Text fontSize="xs" color={subColor} fontWeight="600">
                            Primary dashboard department
                          </Text>
                          <Select
                            size="sm"
                            value={departmentDrafts[user._id] ?? user.dept ?? ''}
                            onChange={(e) => setPrimaryDepartmentDraft(user._id, e.target.value)}
                            isDisabled={departmentsLoading}
                          >
                            <option value="">No department</option>
                            {user.dept &&
                              !departments.some(
                                (d) => d.toLowerCase() === user.dept.toLowerCase(),
                              ) && <option value={user.dept}>{user.dept}</option>}
                            {departments.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </Select>
                          <Text fontSize="xs" color={subColor} fontWeight="600" mt={1}>
                            Ground Truth + Roll Assignment
                          </Text>
                          <Menu closeOnSelect={false}>
                            <MenuButton
                              as={Button}
                              size="sm"
                              variant="outline"
                              textAlign="left"
                              fontWeight="normal"
                              isDisabled={departmentsLoading}
                            >
                              {(attendanceDepartmentDrafts[user._id]
                                || assignedDepartments(user)).length
                                ? `${(attendanceDepartmentDrafts[user._id]
                                  || assignedDepartments(user)).length} department(s) selected`
                                : 'No departments selected'}
                            </MenuButton>
                            <MenuList maxH="280px" overflowY="auto">
                              <MenuOptionGroup
                                type="checkbox"
                                value={attendanceDepartmentDrafts[user._id]
                                  || assignedDepartments(user)}
                                onChange={(values) => setAssignedDepartmentDraft(user, values)}
                              >
                                {uniqueDepartments([
                                  ...departments,
                                  ...assignedDepartments(user),
                                ]).map((department) => (
                                  <MenuItemOption key={department} value={department}>
                                    {department}
                                  </MenuItemOption>
                                ))}
                              </MenuOptionGroup>
                            </MenuList>
                          </Menu>
                          <Button
                            size="sm"
                            variant="outline"
                            colorScheme="teal"
                            isLoading={savingDepartment === user._id}
                            isDisabled={
                              departmentsLoading ||
                              (
                                (departmentDrafts[user._id] ?? user.dept ?? '') ===
                                  (user.dept || '')
                                && sameDepartments(
                                  attendanceDepartmentDrafts[user._id]
                                    || assignedDepartments(user),
                                  assignedDepartments(user),
                                )
                              )
                            }
                            onClick={() => handleDepartmentUpdate(user)}
                          >
                            Save
                          </Button>
                        </Flex>
                      </Td>
                      <Td>
                        {user.role?.length ? (
                          <Wrap spacing={2}>
                            {user.role.map((role) => (
                              <WrapItem key={role}>
                                <Tag size="md" colorScheme="teal" variant="subtle" borderRadius="full">
                                  <TagLabel>{role}</TagLabel>
                                  <TagCloseButton
                                    aria-label={`Remove role ${role}`}
                                    onClick={() => confirmDeleteRole(user, role)}
                                  />
                                </Tag>
                              </WrapItem>
                            ))}
                          </Wrap>
                        ) : (
                          <Text fontSize="sm" color={subColor}>
                            No roles
                          </Text>
                        )}
                      </Td>
                      <Td>
                        <Flex align="center" gap={2}>
                          <Select
                            size="sm"
                            minW="170px"
                            placeholder="Select role"
                            value={selectedRoles[user._id] || ''}
                            onChange={(e) =>
                              setSelectedRoles((s) => ({ ...s, [user._id]: e.target.value }))
                            }
                          >
                            {ROLE_OPTIONS.filter((r) => !roleHeld(user.role, r.value)).map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </Select>
                          <Button
                            size="sm"
                            colorScheme="blue"
                            isDisabled={!selectedRoles[user._id]}
                            isLoading={assigning === user._id}
                            onClick={() => handleAssignRole(user)}
                          >
                            Assign
                          </Button>
                        </Flex>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
          {/* Paging rather than an infinite list: the count above says how many
              there are, this says how many are on screen. */}
          {!isLoading && users.length > 0 && (
            <Flex
              align="center"
              justify="space-between"
              gap={3}
              px={5}
              py={4}
              borderTopWidth="1px"
              borderColor={border}
              flexWrap="wrap"
            >
              <Text fontSize="sm" color={subColor}>
                Showing {users.length}
                {hasMore ? ' so far' : ''}
                {tabs[activeIndex] && !query ? ` of ${tabs[activeIndex].count}` : ''}
              </Text>
              {hasMore && (
                <Button size="sm" variant="outline" onClick={loadMore} isLoading={loadingMore}>
                  Load more
                </Button>
              )}
            </Flex>
          )}
        </Box>
      </Container>

      {/* Delete role confirmation */}
      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Remove Role
            </AlertDialogHeader>
            <AlertDialogBody>
              Remove the role <strong>{deleteTarget?.role}</strong> from{' '}
              <strong>{deleteTarget?.email}</strong>?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteRole} isLoading={deleting} ml={3}>
                Remove
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default UserManagementPage;
