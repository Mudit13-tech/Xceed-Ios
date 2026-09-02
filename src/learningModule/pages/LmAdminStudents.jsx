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
import { EditIcon } from '@chakra-ui/icons';
import { Link as RouterLink } from 'react-router-dom';
import Papa from 'papaparse';

import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard, StatTile } from '../components/common';
import FileDownloadButton from '../../filedownload/filedownload';

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

/**
 * Reads a CSV of student emails, tolerating both a header row ("email") and a
 * bare list of one address per line — whichever an admin happens to export.
 * The only column read is the first one; a name/roll-number column beside it,
 * if someone pastes one in, is ignored rather than rejected.
 */
function parseCsvEmails(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const values = (results.data || [])
          .map((row) => (Array.isArray(row) ? row[0] : ''))
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        // Drop a leading header cell ("email", "Email Address", ...) — the one
        // row here that isn't itself shaped like an address.
        if (values.length && !values[0].includes('@')) values.shift();
        resolve(values);
      },
      error: reject,
    });
  });
}

function BulkImportStudentsCard({ onImported }) {
  const [branches, setBranches] = useState([]);
  const [dept, setDept] = useState('');
  const [fileName, setFileName] = useState('');
  const [emails, setEmails] = useState([]);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    lmApi.ttBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  const reset = () => {
    setFileName('');
    setEmails([]);
    setPreview(null);
    setResult(null);
    setError('');
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    reset();
    setFileName(file.name);
    try {
      const parsed = await parseCsvEmails(file);
      if (!parsed.length) {
        setError('No email addresses found in that file.');
        return;
      }
      setEmails(parsed);
    } catch {
      setError('Could not read that file as a CSV.');
    }
  };

  const runPreview = async () => {
    setError('');
    setBusy(true);
    try {
      setPreview(await lmApi.adminPreviewStudentImport({ emails }));
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
      const data = await lmApi.adminImportStudents({ dept, emails });
      setResult(data);
      setPreview(null);
      toast({
        status: 'success',
        title: `${data.imported} student account${data.imported === 1 ? '' : 's'} created`,
        description: data.skippedExisting
          ? `${data.skippedExisting} address${data.skippedExisting === 1 ? '' : 'es'} already had an account and were skipped.`
          : undefined,
        duration: 8000,
        isClosable: true,
      });
      onImported();
    } catch (err) {
      setError(err.message || 'Could not import the CSV.');
    } finally {
      setBusy(false);
    }
  };

  const invalidSample = (preview?.rows || []).filter((row) => row.outcome === 'invalid').slice(0, 5);

  return (
    <SectionCard
      title="Bulk import via CSV"
      subtitle="Select a department, then upload a CSV of student email addresses. Name defaults to the email and can be corrected afterwards in the directory below."
    >
      <VStack align="stretch" spacing={4}>
        {error && (
          <Alert status="error" borderRadius="md" fontSize="sm">
            <AlertIcon />
            {error}
          </Alert>
        )}

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Department</FormLabel>
            <Select
              value={dept}
              onChange={(event) => {
                setDept(event.target.value);
                reset();
              }}
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
          <FormControl isRequired>
            <FormLabel fontSize="sm">CSV file (one email per row)</FormLabel>
            <Input type="file" accept=".csv,text/csv" onChange={handleFile} isDisabled={!dept} p={1} />
          </FormControl>
          <Flex align="flex-end">
            <FileDownloadButton fileUrl="/student_email_template.csv" fileName="student_email_template.csv" />
          </Flex>
        </SimpleGrid>

        {fileName && !result && (
          <Text fontSize="sm" color="lmFg.muted">
            {fileName} — {emails.length} email{emails.length === 1 ? '' : 's'} found.
          </Text>
        )}

        {!preview && !result && emails.length > 0 && (
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
                <Badge colorScheme="green" px={2} py={1}>New: {preview.counts.new}</Badge>
              </WrapItem>
              <WrapItem>
                <Badge colorScheme="gray" px={2} py={1}>Already exist (skip): {preview.counts.existing}</Badge>
              </WrapItem>
              <WrapItem>
                <Badge colorScheme="orange" px={2} py={1}>Duplicate in file: {preview.counts.duplicate}</Badge>
              </WrapItem>
              <WrapItem>
                <Badge colorScheme="red" px={2} py={1}>Invalid: {preview.counts.invalid}</Badge>
              </WrapItem>
            </Wrap>
            {invalidSample.length > 0 && (
              <Text fontSize="xs" color="lmFg.muted" mb={3}>
                e.g. invalid: {invalidSample.map((row) => row.email).join(', ')}
                {preview.counts.invalid > invalidSample.length ? ', …' : ''}
              </Text>
            )}
            <Flex justify="space-between" align="center" gap={3} wrap="wrap">
              <Text fontSize="xs" color="lmFg.muted" maxW="480px">
                {preview.counts.new} account{preview.counts.new === 1 ? '' : 's'} will be created under{' '}
                <strong>{dept}</strong> and emailed a link to set a password.
              </Text>
              <HStack>
                <Button variant="ghost" onClick={reset} isDisabled={busy}>
                  Start over
                </Button>
                <Button colorScheme="blue" onClick={confirmImport} isLoading={busy} isDisabled={!preview.counts.new}>
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
                {result.imported} account{result.imported === 1 ? '' : 's'} created
              </Text>
            </HStack>
            <Text>
              Skipped — already existed: {result.skippedExisting}, invalid: {result.skippedInvalid}, duplicate in
              file: {result.skippedDuplicate}
              {result.failed ? `, failed: ${result.failed}` : ''}.
            </Text>
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
            icon="🎓"
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
                        icon={<EditIcon />}
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
