import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Badge,
  Select,
  Icon,
  Progress,
  Alert,
  AlertIcon,
  AlertDescription,
  Spinner,
  Divider,
  Table,
  TableContainer,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { FiDownload, FiCheckCircle, FiAlertTriangle, FiUsers } from 'react-icons/fi';
import { Helmet } from 'react-helmet-async';
import getEnvironment from '../getenvironment';
import { fetchCurrentSession } from './timetableFetchHelpers';

const ALL_SESSIONS = '__all__';
const PREVIEW_LIMIT = 200;

const CSV_COLUMNS = [
  { key: 'sem', label: 'Sem' },
  { key: 'subjectCode', label: 'Subject Code' },
  { key: 'subjectName', label: 'Subject Name' },
  { key: 'courseType', label: 'Course Type' },
  { key: 'facultyName', label: 'Faculty Name' },
  { key: 'facultyDept', label: 'Faculty Department' },
  { key: 'facultyEmail', label: 'Faculty Email' },
];

const csvCell = (value) => {
  let text = String(value ?? '');
  // Keep spreadsheet apps from reading a cell as a formula.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const buildCsv = (rows) =>
  [CSV_COLUMNS.map((c) => c.label), ...rows.map((r) => CSV_COLUMNS.map((c) => r[c.key]))]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');

const safeName = (value) => String(value || 'session').replace(/[^a-zA-Z0-9._-]+/g, '_');

const downloadCsv = (session, rows) => {
  // The BOM makes Excel read the file as UTF-8.
  const blob = new Blob([`﻿${buildCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `FirstYear_Faculty_${safeName(session)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

// GETs a JSON endpoint, turning a failure into an Error carrying the server's
// reason (the role guard answers `message`, the handlers answer `error`).
const getJson = async (url) => {
  const response = await fetch(url, { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason =
      body.error ||
      body.message ||
      (response.status === 401 || response.status === 403
        ? 'You need the ITTC role for this export.'
        : `Request failed (${response.status}).`);
    const error = new Error(reason);
    error.status = response.status;
    throw error;
  }
  return body;
};

const FirstYearFacultyExport = () => {
  const apiUrl = getEnvironment();
  const toast = useToast();

  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  // Progress of the running extraction, or null when idle.
  const [job, setJob] = useState(null);
  // One entry per session processed in the last run.
  const [results, setResults] = useState([]);
  const cancelRef = useRef(false);

  const bgGradient = useColorModeValue('linear(to-br, blue.50, purple.50, pink.50)', 'gray.900');
  const cardBg = useColorModeValue('#eef2fb', 'gray.800');
  const borderColor = useColorModeValue('blue.200', 'gray.700');
  const subtleText = useColorModeValue('gray.600', 'gray.400');
  const tableBg = useColorModeValue('white', 'gray.700');

  useEffect(() => {
    let cancelled = false;
    const loadMeta = async () => {
      setIsLoadingMeta(true);
      setMetaError('');
      try {
        const [session, allSessions] = await Promise.all([
          fetchCurrentSession(apiUrl).catch(() => ''),
          fetch(`${apiUrl}/timetablemodule/allotment/session`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
        ]);
        if (cancelled) return;
        setCurrentSession(session || '');
        setSessions(Array.isArray(allSessions) ? allSessions : []);
        setSelectedSession(session || '');
      } catch (error) {
        if (!cancelled) setMetaError(error.message || 'Could not load sessions.');
      } finally {
        if (!cancelled) setIsLoadingMeta(false);
      }
    };
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const base = `${apiUrl}/timetablemodule/lock/first-year-faculty`;

  // Extracts one session semester by semester, reporting progress as it goes.
  const extractSession = async (session, sessionIndex, sessionTotal) => {
    setJob((prev) => ({
      ...prev,
      phase: 'semesters',
      session,
      sessionIndex,
      sessionTotal,
      semDone: 0,
      semTotal: 0,
      currentSem: '',
      rowCount: 0,
      semLog: [],
    }));

    const { sems } = await getJson(`${base}/semesters?session=${encodeURIComponent(session)}`);

    const result = {
      session,
      rows: [],
      semesters: [],
      unmatchedFaculty: new Set(),
      unmatchedSubjects: new Set(),
    };

    setJob((prev) => ({ ...prev, phase: 'filtering', semTotal: sems.length }));

    for (let i = 0; i < sems.length; i += 1) {
      if (cancelRef.current) throw new Error('cancelled');
      const sem = sems[i];
      setJob((prev) => ({ ...prev, currentSem: sem }));

      let entry;
      try {
        const data = await getJson(
          `${base}/rows?session=${encodeURIComponent(session)}&sem=${encodeURIComponent(sem)}`
        );
        result.rows.push(...data.rows);
        data.unmatchedFaculty.forEach((name) => result.unmatchedFaculty.add(name));
        data.unmatchedSubjects.forEach((name) => result.unmatchedSubjects.add(name));
        entry = { sem, source: data.source, count: data.rows.length };
      } catch (error) {
        if (error.status === 401 || error.status === 403) throw error;
        entry = { sem, error: error.message };
      }
      result.semesters.push(entry);

      setJob((prev) => ({
        ...prev,
        semDone: i + 1,
        rowCount: (prev.rowCount || 0) + (entry.count || 0),
        semLog: [...prev.semLog, entry],
      }));
    }

    return {
      ...result,
      unmatchedFaculty: [...result.unmatchedFaculty],
      unmatchedSubjects: [...result.unmatchedSubjects],
    };
  };

  const runExport = async () => {
    const targets =
      selectedSession === ALL_SESSIONS ? [...sessions] : [selectedSession].filter(Boolean);
    if (!targets.length) {
      toast({ title: 'Pick a session first', status: 'warning', duration: 4000, isClosable: true, position: 'top' });
      return;
    }

    cancelRef.current = false;
    setResults([]);
    setJob({ phase: 'semesters', rowCount: 0, semLog: [] });

    const done = [];
    try {
      for (let s = 0; s < targets.length; s += 1) {
        if (cancelRef.current) throw new Error('cancelled');
        const session = targets[s];
        try {
          const result = await extractSession(session, s + 1, targets.length);
          done.push(result);
        } catch (error) {
          if (error.message === 'cancelled' || error.status === 401 || error.status === 403) throw error;
          // A session with no first year timetable is normal when exporting
          // them all; note it and carry on.
          done.push({ session, error: error.message, rows: [], semesters: [] });
        }
        setResults([...done]);
      }

      setResults([...done]);
      const withRows = done.filter((r) => r.rows.length);
      // A single session downloads straight away; several are offered as
      // buttons, since browsers block a burst of automatic downloads.
      if (targets.length === 1 && withRows.length === 1) {
        downloadCsv(withRows[0].session, withRows[0].rows);
      }
      toast({
        title: 'Extraction complete',
        description: `${withRows.reduce((n, r) => n + r.rows.length, 0)} row(s) across ${withRows.length} session(s).`,
        status: withRows.length ? 'success' : 'warning',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    } catch (error) {
      setResults([...done]);
      if (error.message === 'cancelled') {
        toast({ title: 'Extraction cancelled', status: 'info', duration: 3000, isClosable: true, position: 'top' });
      } else {
        toast({
          title: 'Extraction failed',
          description: error.message,
          status: 'error',
          duration: 8000,
          isClosable: true,
          position: 'top',
        });
      }
    } finally {
      cancelRef.current = false;
      setJob(null);
    }
  };

  const isBusy = job !== null;
  const semProgress = job && job.semTotal > 0 ? Math.round((job.semDone / job.semTotal) * 100) : 0;

  const phaseMessage = () => {
    if (!job) return '';
    const prefix =
      job.sessionTotal > 1 ? `Session ${job.session} (${job.sessionIndex}/${job.sessionTotal}) — ` : '';
    if (job.phase === 'semesters') return `${prefix}Finding first year semesters...`;
    return `${prefix}Filtering ${job.currentSem || '...'} (${job.semDone}/${job.semTotal} semesters)`;
  };

  return (
    <Box bgGradient={bgGradient} minH="100vh" pb={{ base: 10, md: 16 }} overflowX="hidden">
      <Helmet>
        <title>First Year Faculty Export</title>
      </Helmet>

      <Box
        bgGradient="linear(to-r, purple.600, blue.600, teal.500)"
        pt={{ base: 5, md: 8 }}
        pb={{ base: 16, md: 20 }}
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
        <Container maxW="7xl" position="relative" px={{ base: 4, md: 6, lg: 8 }}>
          <VStack spacing={{ base: 2, md: 3 }} align="start">
            <Badge colorScheme="whiteAlpha" fontSize={{ base: 'xs', md: 'sm' }} px={3} py={1} borderRadius="full">
              ITTC Export
            </Badge>
            <Heading size={{ base: 'lg', md: 'xl', lg: '2xl' }} color="white" fontWeight="bold">
              First Year Faculty
            </Heading>
            <Text color="whiteAlpha.900" fontSize={{ base: 'sm', md: 'lg' }} maxW="3xl">
              Extract every faculty teaching first year — semester, subject code, subject name,
              course type, faculty name, department and email — as a CSV for each session.
            </Text>
          </VStack>
        </Container>
      </Box>

      <Container maxW="7xl" mt={-12} position="relative" zIndex={1} px={{ base: 4, md: 6, lg: 8 }}>
        <Box
          bg={cardBg}
          borderRadius="2xl"
          shadow="2xl"
          p={{ base: 4, md: 8 }}
          mb={{ base: 5, md: 8 }}
          border="1px"
          borderColor={borderColor}
        >
          <VStack align="stretch" spacing={{ base: 4, md: 6 }}>
            <HStack justify="space-between" flexWrap="wrap" gap={{ base: 2, md: 4 }}>
              <VStack align="start" spacing={1}>
                <Heading size={{ base: 'md', md: 'lg' }} bgGradient="linear(to-r, purple.600, blue.600)" bgClip="text">
                  Session
                </Heading>
                <Text color={subtleText} fontSize={{ base: 'xs', md: 'sm' }}>
                  Reads the session&apos;s first year (Basic Sciences) timetable. Locked semesters are
                  used where available, otherwise the working copy.
                </Text>
              </VStack>
              {currentSession && (
                <Badge colorScheme="green" fontSize={{ base: 'xs', md: 'md' }} px={3} py={2} borderRadius="lg">
                  Current: {currentSession}
                </Badge>
              )}
            </HStack>

            {isLoadingMeta ? (
              <HStack color={subtleText}>
                <Spinner size="sm" />
                <Text>Loading sessions...</Text>
              </HStack>
            ) : (
              <HStack spacing={3} flexWrap="wrap" rowGap={3}>
                <Select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  size={{ base: 'md', md: 'lg' }}
                  placeholder="Select session..."
                  maxW={{ base: 'full', md: 'md' }}
                  isDisabled={isBusy}
                >
                  {sessions.length > 1 && (
                    <option value={ALL_SESSIONS}>All sessions (one CSV each)</option>
                  )}
                  {sessions.map((session) => (
                    <option key={session} value={session}>
                      {session}
                      {session === currentSession ? ' (current)' : ''}
                    </option>
                  ))}
                </Select>
                <Button
                  leftIcon={<Icon as={FiDownload} />}
                  colorScheme="purple"
                  size={{ base: 'md', md: 'lg' }}
                  onClick={runExport}
                  isDisabled={isBusy || !selectedSession}
                  isLoading={isBusy}
                  loadingText="Extracting..."
                >
                  Extract &amp; download CSV
                </Button>
              </HStack>
            )}

            {metaError && (
              <Alert status="error" borderRadius="lg">
                <AlertIcon />
                <AlertDescription>{metaError}</AlertDescription>
              </Alert>
            )}
          </VStack>
        </Box>

        {isBusy && (
          <Box
            bg={cardBg}
            borderRadius="2xl"
            shadow="xl"
            p={{ base: 4, md: 8 }}
            mb={{ base: 5, md: 8 }}
            border="2px"
            borderColor="blue.300"
          >
            <VStack align="stretch" spacing={4}>
              <HStack spacing={3}>
                <Spinner color="blue.500" thickness="3px" />
                <Heading size={{ base: 'sm', md: 'md' }}>Filtering first year faculty</Heading>
              </HStack>

              <Text color={subtleText} fontSize={{ base: 'sm', md: 'md' }}>{phaseMessage()}</Text>

              <Progress
                value={semProgress}
                isIndeterminate={job.phase !== 'filtering'}
                size={{ base: 'md', md: 'lg' }}
                borderRadius="full"
                colorScheme="blue"
                hasStripe
                isAnimated
              />

              {job.phase === 'filtering' && (
                <Text fontSize={{ base: 'xs', md: 'sm' }} color={subtleText}>
                  {job.semDone} of {job.semTotal} semesters filtered ({semProgress}%) —{' '}
                  {job.rowCount || 0} faculty row(s) found so far
                </Text>
              )}

              {job.semLog?.length > 0 && (
                <HStack spacing={2} flexWrap="wrap" rowGap={2}>
                  {job.semLog.map((entry) => (
                    <Badge
                      key={entry.sem}
                      colorScheme={entry.error ? 'red' : entry.source === 'draft' ? 'orange' : 'green'}
                      px={2}
                      py={1}
                      borderRadius="md"
                    >
                      {entry.sem}: {entry.error ? 'failed' : `${entry.count} row(s)`}
                    </Badge>
                  ))}
                </HStack>
              )}

              <Button
                variant="outline"
                colorScheme="red"
                size={{ base: 'sm', md: 'md' }}
                alignSelf="flex-start"
                onClick={() => {
                  cancelRef.current = true;
                }}
              >
                Cancel
              </Button>
            </VStack>
          </Box>
        )}

        {results.map((result) => (
          <Box
            key={result.session}
            bg={cardBg}
            borderRadius="2xl"
            shadow="xl"
            p={{ base: 4, md: 6 }}
            mb={{ base: 5, md: 8 }}
            border="2px"
            borderColor={result.error ? 'red.300' : result.rows.length ? 'green.300' : 'orange.300'}
          >
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between" flexWrap="wrap" gap={3}>
                <HStack align="start">
                  <Icon
                    as={result.error || !result.rows.length ? FiAlertTriangle : FiCheckCircle}
                    color={result.error ? 'red.500' : result.rows.length ? 'green.500' : 'orange.500'}
                    boxSize={{ base: 5, md: 6 }}
                    flexShrink={0}
                  />
                  <Heading size={{ base: 'sm', md: 'md' }}>
                    {result.session} — {result.rows.length} row(s)
                  </Heading>
                </HStack>
                {result.rows.length > 0 && (
                  <Button
                    leftIcon={<Icon as={FiDownload} />}
                    colorScheme="green"
                    size="sm"
                    onClick={() => downloadCsv(result.session, result.rows)}
                  >
                    Download CSV
                  </Button>
                )}
              </HStack>

              {result.error && (
                <Alert status="error" borderRadius="lg">
                  <AlertIcon />
                  <AlertDescription fontSize={{ base: 'xs', md: 'sm' }}>{result.error}</AlertDescription>
                </Alert>
              )}

              {result.semesters.length > 0 && (
                <HStack spacing={2} flexWrap="wrap" rowGap={2}>
                  {result.semesters.map((entry) => (
                    <Badge
                      key={entry.sem}
                      colorScheme={entry.error ? 'red' : entry.source === 'draft' ? 'orange' : 'green'}
                      px={2}
                      py={1}
                      borderRadius="md"
                      title={entry.error || (entry.source === 'draft' ? 'Not locked yet — read from the working timetable' : 'Locked timetable')}
                    >
                      {entry.sem}: {entry.error ? 'failed' : `${entry.count}${entry.source === 'draft' ? ' (not locked)' : ''}`}
                    </Badge>
                  ))}
                </HStack>
              )}

              {result.unmatchedFaculty?.length > 0 && (
                <Alert status="warning" borderRadius="lg">
                  <AlertIcon />
                  <AlertDescription fontSize={{ base: 'xs', md: 'sm' }} wordBreak="break-word">
                    No master faculty record (department/email left blank) for:{' '}
                    {result.unmatchedFaculty.join('; ')}
                  </AlertDescription>
                </Alert>
              )}
              {result.unmatchedSubjects?.length > 0 && (
                <Alert status="warning" borderRadius="lg">
                  <AlertIcon />
                  <AlertDescription fontSize={{ base: 'xs', md: 'sm' }} wordBreak="break-word">
                    No subject record (subject code left blank) for:{' '}
                    {result.unmatchedSubjects.join('; ')}
                  </AlertDescription>
                </Alert>
              )}

              {result.rows.length > 0 && (
                <>
                  <Divider />
                  <TableContainer bg={tableBg} borderRadius="lg" maxH="420px" overflowY="auto">
                    <Table size="sm">
                      <Thead position="sticky" top={0} bg={tableBg} zIndex={1}>
                        <Tr>
                          {CSV_COLUMNS.map((c) => (
                            <Th key={c.key}>{c.label}</Th>
                          ))}
                        </Tr>
                      </Thead>
                      <Tbody>
                        {result.rows.slice(0, PREVIEW_LIMIT).map((row, i) => (
                          <Tr key={`${row.sem}-${row.subjectName}-${row.facultyName}-${i}`}>
                            {CSV_COLUMNS.map((c) => (
                              <Td key={c.key}>{row[c.key] || '—'}</Td>
                            ))}
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                  {result.rows.length > PREVIEW_LIMIT && (
                    <Text fontSize="xs" color={subtleText}>
                      Showing the first {PREVIEW_LIMIT} rows; the CSV has all {result.rows.length}.
                    </Text>
                  )}
                </>
              )}
            </VStack>
          </Box>
        ))}

        {!isBusy && results.length === 0 && (
          <Box
            bg={cardBg}
            borderRadius="2xl"
            shadow="xl"
            p={{ base: 4, md: 8 }}
            border="1px"
            borderColor={borderColor}
          >
            <HStack spacing={3} color={subtleText}>
              <Icon as={FiUsers} boxSize={6} />
              <Text fontSize={{ base: 'sm', md: 'md' }}>
                Choose a session and press “Extract &amp; download CSV”. Columns: Sem, Subject Code,
                Subject Name, Course Type, Faculty Name, Faculty Department, Faculty Email.
              </Text>
            </HStack>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default FirstYearFacultyExport;
