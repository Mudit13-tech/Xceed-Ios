import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Link as RouterLinkStyle,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
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
  Wrap,
  WrapItem,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import * as XLSX from 'xlsx';

import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard, StatTile } from '../components/common';
import { LmIcon } from '../components/Icon';

/**
 * Student accounts and department-wise roster, for an lm-admin.
 *
 * Mirrors the structure of LmAdminFaculty.jsx while providing student-specific
 * fields (roll number, department-wise breakdowns, and class enrollment counts).
 *
 * Students receive an invitation email with a link to claim their account at
 * /forgot-password, then use class codes to join their respective classes.
 */

function ClaimBadge({ claimed }) {
  return (
    <Badge colorScheme={claimed ? 'green' : 'orange'} borderRadius="full" px={2}>
      {claimed ? 'active' : 'not claimed'}
    </Badge>
  );
}

function CreateStudentCard({ onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dept, setDept] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [branches, setBranches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    lmApi.ttBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await lmApi.adminCreateStudent({
        name,
        email,
        dept,
        rollNumber,
      });
      setName('');
      setEmail('');
      setDept('');
      setRollNumber('');
      toast({
        status: 'success',
        title: result.created ? 'Student account created' : 'Student role added',
        description: result.created
          ? `${result.student.email} can set a password from the email on its way to them.`
          : `${result.student.email} already had an account — it is now a student as well.`,
        duration: 8000,
        isClosable: true,
      });
      onCreated();
    } catch (err) {
      setError(err.message || 'Could not create the student account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Add a student"
      subtitle="Creates a platform account with the STUDENT role and emails them a link to set their password and join classes using class codes."
    >
      <form onSubmit={submit}>
        {error && (
          <Alert status="error" borderRadius="md" mb={4} fontSize="sm">
            <AlertIcon />
            {error}
          </Alert>
        )}

        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} mb={4}>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Full name</FormLabel>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Rahul Sharma"
              autoFocus
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Email</FormLabel>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@nitj.ac.in"
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
          <FormControl>
            <FormLabel fontSize="sm">Roll Number</FormLabel>
            <Input
              value={rollNumber}
              onChange={(event) => setRollNumber(event.target.value)}
              placeholder="e.g. 21103001"
            />
          </FormControl>
        </SimpleGrid>

        <Flex justify="space-between" align="center" gap={3} wrap="wrap">
          <Text fontSize="xs" color="lmFg.muted" maxW="620px">
            The student will receive an invitation email directing them to set their password.
            Once logged in, they can join their respective classes using the join codes provided by faculty.
          </Text>
          <Button type="submit" colorScheme="blue" isLoading={busy} isDisabled={!name || !email}>
            Create student account
          </Button>
        </Flex>
      </form>
    </SectionCard>
  );
}

/** Lower-cases and strips punctuation/spacing from a header cell, so "Roll
 *  No.", "Roll No", and "ROLL_NO" all resolve to the same lookup key. */
const normalizeHeaderKey = (key) => String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Every header spelling this screen accepts for each ERP column, normalized. */
const ROSTER_FIELD_CANDIDATES = {
  name: ['name', 'studentname', 'fullname'],
  rollNumber: ['rollno', 'rollnumber', 'rollnum'],
  dept: ['branchname', 'branch', 'department', 'dept'],
  email: ['officialemailid', 'officialemail', 'email', 'emailid', 'emailaddress'],
};

const pickRosterField = (normalizedRow, candidates) => {
  for (const candidate of candidates) {
    if (normalizedRow[candidate] !== undefined) return String(normalizedRow[candidate]).trim();
  }
  return '';
};

/**
 * Reads an ERP roster export (.xlsx) into `{ name, rollNumber, dept, email }`
 * rows. Column headers are matched loosely (see `ROSTER_FIELD_CANDIDATES`)
 * rather than by exact position, because the export's header text ("Roll
 * No.", "Official Email ID", ...) is ERP's to spell however it likes and
 * cannot be pinned down in code. The "Sr. No." column is simply never looked
 * up. Every sheet in the workbook is read, in case the export splits classes
 * across sheets; a row with no email at all is dropped rather than reported,
 * since a genuinely blank spreadsheet row is not a roster entry.
 */
async function parseRosterFile(file) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const rawRows = workbook.SheetNames.flatMap((sheetName) =>
    XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }),
  );

  return rawRows
    .map((raw) => {
      const normalized = {};
      Object.entries(raw).forEach(([key, value]) => {
        normalized[normalizeHeaderKey(key)] = value;
      });
      return {
        name: pickRosterField(normalized, ROSTER_FIELD_CANDIDATES.name),
        rollNumber: pickRosterField(normalized, ROSTER_FIELD_CANDIDATES.rollNumber),
        dept: pickRosterField(normalized, ROSTER_FIELD_CANDIDATES.dept),
        email: pickRosterField(normalized, ROSTER_FIELD_CANDIDATES.email).toLowerCase(),
      };
    })
    .filter((row) => row.name || row.rollNumber || row.dept || row.email);
}

const OUTCOME_BADGE = {
  new: { label: 'New', color: 'green' },
  update: { label: 'Will update existing account', color: 'blue' },
  invalid: { label: 'Invalid email', color: 'red' },
  duplicate: { label: 'Duplicate in file', color: 'orange' },
};

function BulkImportStudentsCard({ onImported }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /* Whether the new accounts are told they exist.
   *
   * The accounts are created either way — the mail only carries the link that
   * lets somebody claim one. A roster loaded weeks before a term starts should
   * not necessarily announce itself the moment it lands, and until this
   * checkbox existed there was no way to say so. Defaults on, which is what the
   * button did before. */
  const [sendMail, setSendMail] = useState(true);
  /* Whether the admin mailbox is told what this import created.
   *
   * Off by default, which is what a roster import has always done: the
   * per-account "new user created" notification is deliberately not sent by
   * bulk imports, because a three-hundred-row roster would send three hundred
   * of them. Ticking this sends one mail for the whole batch instead — the
   * counts and the addresses — for an import somebody wants a record of. */
  const [notifyAdmin, setNotifyAdmin] = useState(false);
  const [mailProgress, setMailProgress] = useState(null);
  const toast = useToast();
  const pollRef = useRef(null);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  const reset = () => {
    clearTimeout(pollRef.current);
    setFileName('');
    setRows([]);
    setPreview(null);
    setResult(null);
    setError('');
    setMailProgress(null);
    setNotifyAdmin(false);
  };

  // Polls /admin/students/import-status/:batchId until every queued welcome
  // mail has an outcome — same pattern as People.jsx's class-invite progress.
  const pollMailStatus = (batchId) => {
    pollRef.current = setTimeout(async () => {
      let status;
      try {
        status = await lmApi.adminStudentImportStatus(batchId);
      } catch {
        pollMailStatus(batchId);
        return;
      }
      setMailProgress({ completed: status.completed, total: status.total });
      if (status.done) return;
      pollMailStatus(batchId);
    }, 1200);
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    reset();
    setFileName(file.name);
    try {
      const parsed = await parseRosterFile(file);
      if (!parsed.length) {
        setError('No student rows found in that file.');
        return;
      }
      setRows(parsed);
    } catch {
      setError('Could not read that file as an Excel workbook.');
    }
  };

  const runPreview = async () => {
    setError('');
    setBusy(true);
    try {
      setPreview(await lmApi.adminPreviewStudentImport({ rows }));
    } catch (err) {
      setError(err.message || 'Could not preview the import.');
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    setError('');
    setBusy(true);
    try {
      const data = await lmApi.adminImportStudents({ rows, sendMail, notifyAdmin, fileName });
      setResult(data);
      setPreview(null);
      toast({
        status: 'success',
        title: `${data.created} account${data.created === 1 ? '' : 's'} created, ${data.updated} updated`,
        description: [
          sendMail ? null : 'No student emails sent — they can be told later from the directory.',
          data.adminNotified ? 'A summary was mailed to the admin mailbox.' : null,
        ].filter(Boolean).join(' ') || undefined,
        duration: 8000,
        isClosable: true,
      });
      onImported();
      if (data.batchId) {
        setMailProgress({ completed: 0, total: data.mailQueued });
        pollMailStatus(data.batchId);
      }
    } catch (err) {
      setError(err.message || 'Could not import the roster.');
    } finally {
      setBusy(false);
    }
  };

  /* The mailbox the summary would go to, as the server names it — an
     environment can point ADMIN_NOTIFY_EMAIL somewhere other than the default,
     and a checkbox that names the wrong address is worse than one that names
     none. Known only once the preview has come back. */
  const adminMailbox = preview?.adminNotifyEmail || '';

  const invalidSample = (preview?.rows || []).filter((row) => row.outcome === 'invalid').slice(0, 5);

  return (
    <SectionCard
      title="Bulk import from ERP roster"
      subtitle="Upload the ERP export (.xlsx) — Name, Roll No., Branch Name, Official Email ID. A row whose email already has an account updates that account's name, roll number and department; a new email gets a new account, and — if you leave the email option ticked — a link to set their password."
    >
      <VStack align="stretch" spacing={4}>
        {error && (
          <Alert status="error" borderRadius="md" fontSize="sm">
            <AlertIcon />
            {error}
          </Alert>
        )}

        <FormControl isRequired maxW="420px">
          <FormLabel fontSize="sm">ERP roster file (.xlsx)</FormLabel>
          <Input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFile}
            p={1}
          />
        </FormControl>

        {fileName && !result && (
          <Text fontSize="sm" color="lmFg.muted">
            {fileName} — {rows.length} row{rows.length === 1 ? '' : 's'} found.
          </Text>
        )}

        {!result && rows.length > 0 && (
          <Checkbox
            isChecked={sendMail}
            onChange={(e) => setSendMail(e.target.checked)}
            isDisabled={busy}
          >
            <Text fontSize="sm">
              Email each new student that an account has been created for them
              <Text as="span" color="lmFg.muted">
                {' '}— the mail carries the link they use to set a password. Untick to create the
                accounts quietly; they can still claim one from “Forgot password”.
              </Text>
            </Text>
          </Checkbox>
        )}

        {!result && rows.length > 0 && (
          <Checkbox
            isChecked={notifyAdmin}
            onChange={(e) => setNotifyAdmin(e.target.checked)}
            isDisabled={busy}
          >
            <Text fontSize="sm">
              Also mail the admin mailbox{adminMailbox ? ` (${adminMailbox})` : ''} a summary of this import
              <Text as="span" color="lmFg.muted">
                {' '}— one mail listing the accounts this upload created. Off by default: a bulk
                import stays out of that mailbox unless somebody wants a record of it.
              </Text>
            </Text>
          </Checkbox>
        )}

        {!preview && !result && rows.length > 0 && (
          <Flex justify="flex-end">
            <Button colorScheme="blue" onClick={runPreview} isLoading={busy}>
              Preview import
            </Button>
          </Flex>
        )}

        {preview && !result && (
          <Box borderWidth="1px" borderColor="lmBorder.default" borderRadius="md" p={4}>
            <Wrap spacing={2} mb={3}>
              <WrapItem>
                <Badge colorScheme={OUTCOME_BADGE.new.color} px={2} py={1}>
                  {OUTCOME_BADGE.new.label}: {preview.counts.new}
                </Badge>
              </WrapItem>
              <WrapItem>
                <Badge colorScheme={OUTCOME_BADGE.update.color} px={2} py={1}>
                  {OUTCOME_BADGE.update.label}: {preview.counts.update}
                </Badge>
              </WrapItem>
              <WrapItem>
                <Badge colorScheme={OUTCOME_BADGE.duplicate.color} px={2} py={1}>
                  {OUTCOME_BADGE.duplicate.label}: {preview.counts.duplicate}
                </Badge>
              </WrapItem>
              <WrapItem>
                <Badge colorScheme={OUTCOME_BADGE.invalid.color} px={2} py={1}>
                  {OUTCOME_BADGE.invalid.label}: {preview.counts.invalid}
                </Badge>
              </WrapItem>
            </Wrap>
            {invalidSample.length > 0 && (
              <Text fontSize="xs" color="lmFg.muted" mb={3}>
                e.g. invalid: {invalidSample.map((row) => row.email || '(blank)').join(', ')}
                {preview.counts.invalid > invalidSample.length ? ', …' : ''}
              </Text>
            )}
            <Flex justify="space-between" align="center" gap={3} wrap="wrap">
              <Text fontSize="xs" color="lmFg.muted" maxW="480px">
                {preview.counts.new} new account{preview.counts.new === 1 ? '' : 's'} will be created
                {sendMail ? ' and emailed a link to set a password' : ', with no email sent'};
                {' '}{preview.counts.update} existing account
                {preview.counts.update === 1 ? '' : 's'} will be corrected to match this roster.
              </Text>
              <HStack>
                <Button variant="ghost" onClick={reset} isDisabled={busy}>
                  Start over
                </Button>
                <Button
                  colorScheme="blue"
                  onClick={confirmImport}
                  isLoading={busy}
                  isDisabled={!preview.counts.new && !preview.counts.update}
                >
                  Confirm import
                </Button>
              </HStack>
            </Flex>
          </Box>
        )}

        {result && (
          <Alert status="success" borderRadius="md" flexDirection="column" alignItems="flex-start" fontSize="sm">
            <HStack mb={1}>
              <AlertIcon />
              <Text fontWeight="600">
                {result.created} account{result.created === 1 ? '' : 's'} created, {result.updated} updated
              </Text>
            </HStack>
            <Text>
              Skipped — invalid: {result.skippedInvalid}, duplicate in file: {result.skippedDuplicate}
              {result.failed ? `, failed: ${result.failed}` : ''}.
            </Text>
            {/* Nothing to watch when the import was told not to mail, so the
                progress bar is replaced by the one line that says so. */}
            {!mailProgress && result.created > 0 && (
              <Text>No welcome emails sent — the students can be told later.</Text>
            )}
            {mailProgress && (
              <Box mt={3} w="100%">
                <Text fontSize="xs" color="lmFg.muted" mb={1}>
                  {mailProgress.completed >= mailProgress.total
                    ? `Welcome emails sent (${mailProgress.total}).`
                    : `Sending welcome emails: ${mailProgress.completed} of ${mailProgress.total}…`}
                </Text>
                <Progress
                  value={mailProgress.total ? (mailProgress.completed / mailProgress.total) * 100 : 0}
                  size="xs"
                  colorScheme="blue"
                  borderRadius="full"
                  isIndeterminate={!mailProgress.total}
                />
              </Box>
            )}
            <Button size="sm" mt={3} onClick={reset}>
              Import another file
            </Button>
          </Alert>
        )}
      </VStack>
    </SectionCard>
  );
}

function EditStudentModal({ student, isOpen, onClose, onSaved }) {
  const [branches, setBranches] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dept, setDept] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    lmApi.ttBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (student) {
      setName(student.name || '');
      setEmail(student.email || '');
      setDept(student.dept || '');
      setError('');
    }
  }, [student]);

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      await lmApi.adminUpdateStudent(student._id, { name, email, dept });
      toast({ status: 'success', title: 'Student updated', duration: 4000, isClosable: true });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not update the student.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit student</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {error && (
            <Alert status="error" borderRadius="md" mb={4} fontSize="sm">
              <AlertIcon />
              {error}
            </Alert>
          )}
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel fontSize="sm">Full name</FormLabel>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Email</FormLabel>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Department</FormLabel>
              <Select value={dept} onChange={(event) => setDept(event.target.value)} placeholder="Select department">
                {branches.map((branch) => (
                  <option key={branch.code} value={branch.dept}>
                    {branch.dept}
                  </option>
                ))}
                {dept && !branches.some((branch) => branch.dept === dept) && <option value={dept}>{dept}</option>}
              </Select>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={busy}>
            Cancel
          </Button>
          <Button colorScheme="blue" isLoading={busy} onClick={save} isDisabled={!name || !email}>
            Save changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function LmAdminStudents() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const editModal = useDisclosure();
  const [normalizing, setNormalizing] = useState(false);
  const toast = useToast();

  const load = useCallback(async (q, dept) => {
    setError(null);
    try {
      setData(await lmApi.adminListStudents({ q, dept }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search, selectedDept), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search, selectedDept]);

  if (loading) return <Loading label="Loading student data…" />;
  if (error) return <ErrorState error={error} onRetry={() => load(search, selectedDept)} />;

  const { totals, students, truncated } = data;
  const departments = totals?.departments || [];

  const fixDepartmentCasing = async () => {
    setNormalizing(true);
    try {
      const result = await lmApi.adminNormalizeStudentDepartments();
      toast({
        status: 'success',
        title: result.updated ? 'Department names merged' : 'Nothing to merge',
        description: result.updated
          ? `Corrected ${result.updated} of ${result.checked} student accounts.`
          : 'Every student account already matches the timetable’s spelling.',
        duration: 6000,
        isClosable: true,
      });
      await load(search, selectedDept);
    } catch (err) {
      toast({ status: 'error', title: 'Could not merge departments', description: err.message, duration: 6000, isClosable: true });
    } finally {
      setNormalizing(false);
    }
  };

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
          <Box>
            <Text fontSize="xl" fontWeight="700" color="lmFg.heading">
              Student accounts & enrollment
            </Text>
            <Text fontSize="sm" color="lmFg.muted">
              Invite students to the module, monitor department-wise distribution, and track class participation.
            </Text>
          </Box>
          <RouterLinkStyle as={RouterLink} to="/learning/lm-admin" fontSize="sm" color="blue.600">
            ← Admin dashboard
          </RouterLinkStyle>
        </Flex>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        <StatTile label="Total students" value={totals.students} accent="teal.500" />
        <StatTile label="Active (Claimed)" value={totals.activeStudents} accent="green.500" />
        <StatTile label="Total classes" value={totals.classes} accent="blue.500" />
        <StatTile label="Departments" value={departments.length} accent="purple.500" />
      </SimpleGrid>

      {/* Department-wise Overview & Quick Filters */}
      {departments.length > 0 && (
        <SectionCard
          title="Department-wise distribution"
          subtitle="Click on any department to quickly filter the student roster below."
          action={
            <Button size="xs" variant="outline" isLoading={normalizing} onClick={fixDepartmentCasing}>
              Merge duplicate departments
            </Button>
          }
        >
          <Wrap spacing={2}>
            <WrapItem>
              <Button
                size="xs"
                variant={selectedDept === '' ? 'solid' : 'outline'}
                colorScheme={selectedDept === '' ? 'blue' : 'gray'}
                borderRadius="full"
                onClick={() => setSelectedDept('')}
              >
                All departments ({totals.students})
              </Button>
            </WrapItem>
            {departments.map((deptItem) => {
              const isSelected = selectedDept === deptItem.dept;
              return (
                <WrapItem key={deptItem.dept}>
                  <Button
                    size="xs"
                    variant={isSelected ? 'solid' : 'outline'}
                    colorScheme={isSelected ? 'blue' : 'gray'}
                    borderRadius="full"
                    onClick={() => setSelectedDept(isSelected ? '' : deptItem.dept)}
                  >
                    {deptItem.dept} ({deptItem.count})
                  </Button>
                </WrapItem>
              );
            })}
          </Wrap>
        </SectionCard>
      )}

      <CreateStudentCard onCreated={() => load(search, selectedDept)} />

      <BulkImportStudentsCard onImported={() => load(search, selectedDept)} />

      <SectionCard
        title="Directory"
        subtitle="Search and verify enrolled students by name, email, roll number, or department."
        action={
          <HStack spacing={2} wrap="wrap">
            <Select
              size="sm"
              maxW="200px"
              value={selectedDept}
              onChange={(event) => setSelectedDept(event.target.value)}
              placeholder="All departments"
            >
              {departments.map((d) => (
                <option key={d.dept} value={d.dept}>
                  {d.dept} ({d.count})
                </option>
              ))}
            </Select>
            <Input
              size="sm"
              maxW="240px"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, roll..."
            />
          </HStack>
        }
      >
        {students.length === 0 ? (
          <EmptyState
            icon="people"
            title={search || selectedDept ? 'Nobody matches those filters' : 'No student accounts yet'}
            description={
              search || selectedDept
                ? 'Try adjusting your search terms or clearing the department filter.'
                : 'Invite the first student using the form above.'
            }
          />
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Roll Number</Th>
                  <Th>Department</Th>
                  <Th isNumeric>Classes Enrolled</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {students.map((student) => (
                  <Tr key={student._id}>
                    <Td fontWeight="600">{student.name || '—'}</Td>
                    <Td>{student.email}</Td>
                    <Td>{student.rollNumber || '—'}</Td>
                    <Td>{student.dept || '—'}</Td>
                    <Td isNumeric>
                      <Badge colorScheme={student.classCount > 0 ? 'blue' : 'gray'}>
                        {student.classCount}
                      </Badge>
                    </Td>
                    <Td>
                      <ClaimBadge claimed={student.claimed} />
                    </Td>
                    <Td>
                      <IconButton
                        aria-label="Edit student"
                        icon={<LmIcon name="edit" size={15} />}
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setEditingStudent(student);
                          editModal.onOpen();
                        }}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {truncated && (
              <Text fontSize="xs" color="lmFg.muted" mt={3}>
                Showing the 200 most recent records. Use search or department filters to narrow the list.
              </Text>
            )}
          </Box>
        )}
      </SectionCard>

      <EditStudentModal
        student={editingStudent}
        isOpen={editModal.isOpen}
        onClose={editModal.onClose}
        onSaved={() => load(search, selectedDept)}
      />
    </VStack>
  );
}
