// The head-of-department timetable report: semester by semester, who teaches
// what and where.
//
// Why this page exists: a head who wanted to see their department's load had to
// be given `DTTI`, the department coordinator's role — which is the role that
// edits the timetable, locks it and mails every affected teacher. This is the
// read that makes that unnecessary. Everything here comes from one endpoint,
// `/timetablemodule/hod/load`, which resolves the department from the
// signed-in account: no department is ever named by this page.

import React, { useCallback, useEffect, useState } from 'react';
import getEnvironment from '../getenvironment';
import {
  Alert,
  AlertIcon,
  AlertDescription,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Link,
  Select,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  TableContainer,
  Tag,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';

const apiUrl = getEnvironment();

/**
 * A semester's table.
 *
 * `source` is the one thing this component must not lose: a semester the
 * coordinator has locked is the timetable everything else on the platform runs
 * on, and a semester still in draft is a plan that may change before it means
 * anything. Both are worth showing; showing them as the same thing is not.
 */
function SemesterTable({ semester, timetableCode }) {
  const isDraft = semester.source === 'draft';

  return (
    <Card mb={6} variant="outline">
      <CardHeader pb={2}>
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ base: 'flex-start', md: 'center' }}
          justify="space-between"
          gap={3}
        >
          <HStack spacing={3} flexWrap="wrap">
            <Heading as="h3" size="md">
              {semester.sem}
            </Heading>
            <Badge colorScheme={isDraft ? 'orange' : 'green'}>
              {isDraft ? 'Not locked yet — working copy' : 'Locked'}
            </Badge>
          </HStack>

          <HStack spacing={4} flexWrap="wrap">
            <Stat size="sm" minW="24">
              <StatLabel fontSize="xs">Subjects</StatLabel>
              <StatNumber fontSize="lg">{semester.rows.length}</StatNumber>
            </Stat>
            <Stat size="sm" minW="24">
              <StatLabel fontSize="xs">Faculty</StatLabel>
              <StatNumber fontSize="lg">{semester.facultyCount}</StatNumber>
            </Stat>
            <Stat size="sm" minW="28">
              <StatLabel fontSize="xs">Hours / week</StatLabel>
              <StatNumber fontSize="lg">{semester.totalHours}</StatNumber>
            </Stat>
          </HStack>
        </Flex>

        {isDraft && (
          <Alert status="warning" mt={3} borderRadius="md" fontSize="sm">
            <AlertIcon />
            <AlertDescription>
              This semester has not been locked, so these rows are the
              coordinator&apos;s working copy and may still change.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardBody pt={2}>
        <TableContainer>
          <Table size="sm" variant="striped">
            <Thead>
              <Tr>
                <Th>Subject code</Th>
                <Th>Subject</Th>
                <Th>Faculty</Th>
                <Th>Classroom</Th>
                <Th isNumeric>Hours / week</Th>
              </Tr>
            </Thead>
            <Tbody>
              {semester.rows.map((row) => (
                <Tr key={`${row.subCode}-${row.subName}`}>
                  <Td whiteSpace="nowrap" fontWeight="semibold">
                    {row.subCode || '—'}
                  </Td>
                  <Td>
                    <Text fontWeight="medium">{row.subName}</Text>
                    {row.subjectFullName && row.subjectFullName !== row.subName && (
                      <Text fontSize="xs" color="gray.600">
                        {row.subjectFullName}
                      </Text>
                    )}
                    {row.type && (
                      <Tag size="sm" mt={1} colorScheme="purple">
                        {row.type}
                      </Tag>
                    )}
                  </Td>
                  <Td>
                    {/* A subject taught by two people lists both. That is a real
                        arrangement, and picking one would misreport the load. */}
                    {row.faculty.length ? (
                      <Wrap spacing={1}>
                        {row.faculty.map((name) => (
                          <WrapItem key={name}>
                            <Tag size="sm" colorScheme="blue">
                              {name}
                            </Tag>
                          </WrapItem>
                        ))}
                      </Wrap>
                    ) : (
                      <Text color="orange.600" fontSize="sm">
                        Not allotted
                      </Text>
                    )}
                  </Td>
                  <Td>
                    {row.rooms.length ? (
                      <Wrap spacing={1}>
                        {row.rooms.map((room) => (
                          <WrapItem key={room}>
                            <Tag size="sm" colorScheme="green">
                              {room}
                            </Tag>
                          </WrapItem>
                        ))}
                      </Wrap>
                    ) : (
                      <Text color="orange.600" fontSize="sm">
                        Not allotted
                      </Text>
                    )}
                  </Td>
                  <Td isNumeric>{row.hours}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>

        {timetableCode && (
          <HStack mt={4} spacing={3} flexWrap="wrap">
            {/* The locked timetable grid for the whole department, which is
                where a head goes to see this semester laid out by day and
                period. Read-only, and it opens in its own tab so the report
                stays where it was. */}
            <Button
              as={Link}
              href={`/tt/${timetableCode}/lockedsummary`}
              isExternal
              size="sm"
              colorScheme="blue"
              variant="outline"
              rightIcon={<ExternalLinkIcon />}
            >
              View timetable
            </Button>
            <Button
              as={Link}
              href={`/tt/${timetableCode}/generatepdf`}
              isExternal
              size="sm"
              variant="ghost"
              rightIcon={<ExternalLinkIcon />}
            >
              Printable summary
            </Button>
          </HStack>
        )}
      </CardBody>
    </Card>
  );
}

export default function TimetableHodDashboard() {
  const [departments, setDepartments] = useState([]);
  const [allDepts, setAllDepts] = useState(false);
  const [selectedDept, setSelectedDept] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Which departments this account may report on. A head normally heads one;
  // the switcher below only appears when there is something to switch between.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`${apiUrl}/timetablemodule/hod/departments`, {
          credentials: 'include',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Unable to load department access.');
        }
        setDepartments(data.departments || []);
        setAllDepts(Boolean(data.allDepts));
        setSelectedDept((data.departments || [])[0] || '');
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const loadReport = useCallback(async (dept, signal) => {
    setLoading(true);
    setError('');
    try {
      const query = dept ? `?dept=${encodeURIComponent(dept)}` : '';
      const response = await fetch(`${apiUrl}/timetablemodule/hod/load${query}`, {
        credentials: 'include',
        signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to load the timetable report.');
      }
      setReport(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // An institute coordinator has no department of their own, so nothing is
    // fetched until they pick one. A head always has one by now.
    if (allDepts && !selectedDept) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    loadReport(selectedDept, controller.signal);
    return () => controller.abort();
  }, [selectedDept, allDepts, loadReport]);

  const timetableCode = report?.timetables?.[0]?.code || '';

  return (
    <Container maxW="8xl" px={{ base: 3, md: 6 }} py={6}>
      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'flex-start', md: 'flex-end' }}
        gap={4}
        mb={6}
      >
        <Box>
          <Heading as="h1" size={{ base: 'lg', md: 'xl' }}>
            Department Timetable Load
          </Heading>
          <Text color="gray.600" mt={1}>
            {report?.dept
              ? `${report.dept}${report.session ? ` · ${report.session}` : ''}`
              : 'Semester-wise subjects, faculty and classrooms'}
          </Text>
          {report?.lockedAt && (
            <Text fontSize="sm" color="gray.500" mt={1}>
              Locked copy last updated {report.lockedAt}
            </Text>
          )}
        </Box>

        {(allDepts || departments.length > 1) && (
          <FormControl maxW="sm">
            <FormLabel fontSize="sm" mb={1}>
              Department
            </FormLabel>
            <Select
              value={selectedDept}
              onChange={(event) => setSelectedDept(event.target.value)}
              placeholder={allDepts ? 'Select a department' : undefined}
              bg="white"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </Select>
          </FormControl>
        )}
      </Flex>

      {error && (
        <Alert status="error" borderRadius="md" mb={6}>
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <Flex justify="center" py={16}>
          <Spinner size="lg" thickness="3px" color="blue.500" />
        </Flex>
      )}

      {!loading && !error && report && (
        <>
          {report.message && (
            <Alert status="info" borderRadius="md" mb={6}>
              <AlertIcon />
              <AlertDescription>{report.message}</AlertDescription>
            </Alert>
          )}

          {report.semesters?.length > 0 && (
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={8}>
              <Card variant="filled">
                <CardBody>
                  <Stat>
                    <StatLabel>Semesters</StatLabel>
                    <StatNumber>{report.semesters.length}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card variant="filled">
                <CardBody>
                  <Stat>
                    <StatLabel>Faculty teaching</StatLabel>
                    <StatNumber>
                      {
                        new Set(
                          report.semesters.flatMap((sem) =>
                            sem.rows.flatMap((row) => row.faculty)
                          )
                        ).size
                      }
                    </StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card variant="filled">
                <CardBody>
                  <Stat>
                    <StatLabel>Total hours / week</StatLabel>
                    <StatNumber>
                      {report.semesters.reduce((sum, sem) => sum + sem.totalHours, 0)}
                    </StatNumber>
                  </Stat>
                </CardBody>
              </Card>
            </SimpleGrid>
          )}

          {report.semesters?.length === 0 && !report.message && (
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <AlertDescription>
                {report.dept} has a timetable but no slots have been allotted in
                it yet.
              </AlertDescription>
            </Alert>
          )}

          <VStack align="stretch" spacing={0}>
            {report.semesters?.map((semester) => (
              <SemesterTable
                key={semester.sem}
                semester={semester}
                timetableCode={timetableCode}
              />
            ))}
          </VStack>
        </>
      )}
    </Container>
  );
}
