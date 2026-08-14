import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
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
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { FiUsers, FiBook, FiHome, FiDownload, FiCheckCircle } from 'react-icons/fi';
import { Helmet } from 'react-helmet-async';
import getEnvironment from '../getenvironment';
import downloadMergedPDF from '../filedownload/downloadmergedpdf';
import mergePdfs from '../filedownload/mergepdf';
import { generateSummary } from './timetableDataHelpers';
import {
  fetchCurrentSession,
  fetchSessionTimetables,
  fetchTTDetails,
  fetchSubjectData,
  fetchSemesters,
  fetchRooms,
  fetchFaculties,
  fetchSemLockTime,
  fetchSemTimetable,
  fetchFacultyTimetable,
  fetchRoomTimetable,
  fetchCommonLoad,
} from './timetableFetchHelpers';

// Each card drives the same pipeline; only the per-department item list and the
// per-item PDF build differ, so the three variants are described as data.
const DOWNLOAD_TYPES = {
  sem: {
    key: 'sem',
    label: 'All Semesters',
    unit: 'semester',
    icon: FiBook,
    gradient: 'linear(to-br, blue.600, blue.800)',
    fileName: (session) => `AllDepartments_Semesters_${session}.pdf`,
    description: 'Every semester timetable of every department, in one PDF.',
  },
  faculty: {
    key: 'faculty',
    label: 'All Faculty',
    unit: 'faculty',
    icon: FiUsers,
    gradient: 'linear(to-br, green.600, teal.800)',
    fileName: (session) => `AllDepartments_Faculty_${session}.pdf`,
    description: 'Every faculty timetable of every department, in one PDF.',
  },
  room: {
    key: 'room',
    label: 'All Rooms',
    unit: 'room',
    icon: FiHome,
    gradient: 'linear(to-br, orange.600, red.700)',
    fileName: (session) => `AllDepartments_Rooms_${session}.pdf`,
    description: 'Every room timetable of every department, in one PDF.',
  },
};

const safeSessionName = (session) => (session || 'session').replace(/[^a-zA-Z0-9._-]+/g, '_');

const InstituteMergedDownload = () => {
  const apiUrl = getEnvironment();
  const toast = useToast();

  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [departments, setDepartments] = useState([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  // Progress for the in-flight download, or null when idle.
  const [job, setJob] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  // Set when the user asks to stop; the generation loop checks it between items.
  const cancelRef = useRef(false);

  const bgGradient = useColorModeValue('linear(to-br, blue.50, purple.50, pink.50)', 'gray.900');
  // Tinted rather than white so the panels read as distinct from the page.
  const cardBg = useColorModeValue('#eef2fb', 'gray.800');
  const borderColor = useColorModeValue('blue.200', 'gray.700');
  const subtleText = useColorModeValue('gray.600', 'gray.400');

  useEffect(() => {
    let cancelled = false;

    const loadMeta = async () => {
      setIsLoadingMeta(true);
      setMetaError('');
      try {
        const [session, allSessions] = await Promise.all([
          fetchCurrentSession(apiUrl),
          fetch(`${apiUrl}/timetablemodule/allotment/session`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
        ]);
        if (cancelled) return;
        setCurrentSession(session);
        setSessions(Array.isArray(allSessions) ? allSessions : []);
        setSelectedSession(session);
      } catch (error) {
        if (!cancelled) {
          setMetaError(error.message || 'Could not load the current session.');
        }
      } finally {
        if (!cancelled) setIsLoadingMeta(false);
      }
    };

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  // Department list follows whichever session is selected.
  useEffect(() => {
    let cancelled = false;
    if (!selectedSession) {
      setDepartments([]);
      return undefined;
    }

    const loadDepartments = async () => {
      try {
        const timetables = await fetchSessionTimetables(apiUrl, selectedSession);
        if (cancelled) return;
        const sorted = [...timetables].sort((a, b) =>
          String(a.dept || '').localeCompare(String(b.dept || ''))
        );
        setDepartments(sorted);
      } catch (error) {
        if (!cancelled) {
          setDepartments([]);
          setMetaError(error.message || 'Could not load departments for this session.');
        }
      }
    };

    loadDepartments();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, selectedSession]);

  const listItemsForDept = async (type, code) => {
    if (type === 'sem') return fetchSemesters(apiUrl, code);
    if (type === 'room') return fetchRooms(apiUrl, code);
    return fetchFaculties(apiUrl, code);
  };

  // Builds one timetable PDF and pushes its bytes into `buffers`.
  const buildItemPdf = async (type, { code, ttDetails, subjects, semLockTime, item, buffers }) => {
    if (type === 'sem') {
      const { initialData, notes } = await fetchSemTimetable(apiUrl, code, item);
      const summary = generateSummary(initialData, subjects, 'sem', item);
      await downloadMergedPDF(initialData, summary, 'sem', ttDetails, semLockTime, item, notes, buffers);
      return;
    }

    if (type === 'room') {
      const { initialData, updateTime, notes } = await fetchRoomTimetable(apiUrl, code, item);
      const summary = generateSummary(initialData, subjects, 'room', item);
      await downloadMergedPDF(initialData, summary, 'room', ttDetails, updateTime, item, notes, buffers);
      return;
    }

    const { initialData, updateTime, notes } = await fetchFacultyTimetable(apiUrl, code, item);
    const projectLoad = await fetchCommonLoad(apiUrl, code, item);
    const summary = generateSummary(initialData, subjects, 'faculty', item, projectLoad);
    await downloadMergedPDF(initialData, summary, 'faculty', ttDetails, updateTime, item, notes, buffers);
  };

  const runDownload = async (type) => {
    const config = DOWNLOAD_TYPES[type];
    if (!selectedSession) {
      toast({
        title: 'No session selected',
        description: 'Pick a session before downloading.',
        status: 'warning',
        duration: 4000,
        isClosable: true,
        position: 'top',
      });
      return;
    }
    if (departments.length === 0) {
      toast({
        title: 'No departments in this session',
        description: `No timetables exist for ${selectedSession}.`,
        status: 'warning',
        duration: 4000,
        isClosable: true,
        position: 'top',
      });
      return;
    }

    cancelRef.current = false;
    setLastResult(null);
    setJob({
      type,
      phase: 'collecting',
      done: 0,
      total: 0,
      currentDept: '',
      currentItem: '',
      deptIndex: 0,
      deptTotal: departments.length,
      skipped: [],
    });

    const buffers = [];
    const skipped = [];

    try {
      // Phase 1 — resolve each department's item list up front so the progress
      // bar can be determinate rather than crawling department by department.
      const plans = [];
      for (let i = 0; i < departments.length; i += 1) {
        if (cancelRef.current) throw new Error('cancelled');
        const dept = departments[i];
        setJob((prev) => ({
          ...prev,
          phase: 'collecting',
          currentDept: dept.dept,
          deptIndex: i + 1,
        }));
        try {
          const [items, subjects, ttDetails] = await Promise.all([
            listItemsForDept(type, dept.code),
            fetchSubjectData(apiUrl, dept.code),
            fetchTTDetails(apiUrl, dept.code),
          ]);
          const semLockTime = type === 'sem' ? await fetchSemLockTime(apiUrl, dept.code) : null;
          if (!items || items.length === 0) {
            skipped.push(`${dept.dept} (no ${config.unit} data)`);
            continue;
          }
          plans.push({ dept, items, subjects, ttDetails, semLockTime });
        } catch (error) {
          skipped.push(`${dept.dept} (${error.message || 'fetch failed'})`);
        }
      }

      const total = plans.reduce((sum, plan) => sum + plan.items.length, 0);
      if (total === 0) {
        throw new Error(`No ${config.unit} timetables found in ${selectedSession}.`);
      }

      setJob((prev) => ({ ...prev, phase: 'generating', total, done: 0, skipped }));

      // Phase 2 — build every PDF. Sequential on purpose: pdfMake holds the
      // whole document in memory and an institute-wide run is large.
      let done = 0;
      for (let i = 0; i < plans.length; i += 1) {
        const { dept, items, subjects, ttDetails, semLockTime } = plans[i];
        for (const item of items) {
          if (cancelRef.current) throw new Error('cancelled');
          setJob((prev) => ({
            ...prev,
            phase: 'generating',
            currentDept: dept.dept,
            currentItem: String(item),
            deptIndex: i + 1,
            done,
          }));
          try {
            await buildItemPdf(type, {
              code: dept.code,
              ttDetails,
              subjects,
              semLockTime,
              item,
              buffers,
            });
          } catch (error) {
            skipped.push(`${dept.dept} / ${item} (${error.message || 'generation failed'})`);
          }
          done += 1;
          // Yield to the browser so the progress bar actually repaints.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      setJob((prev) => ({ ...prev, phase: 'merging', done: total, currentItem: '' }));
      await mergePdfs(buffers, config.fileName(safeSessionName(selectedSession)));

      setLastResult({
        type,
        generated: buffers.length,
        skipped,
        session: selectedSession,
      });
      toast({
        title: 'Download ready',
        description: `${buffers.length} ${config.unit} timetable(s) merged into a single PDF.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    } catch (error) {
      if (error.message === 'cancelled') {
        toast({
          title: 'Download cancelled',
          status: 'info',
          duration: 3000,
          isClosable: true,
          position: 'top',
        });
      } else {
        console.error('Institute-wide merged download failed:', error);
        toast({
          title: 'Download failed',
          description: error.message || 'Something went wrong while building the PDF.',
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
  const activeConfig = job ? DOWNLOAD_TYPES[job.type] : null;
  const progressValue =
    job && job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;

  const phaseMessage = () => {
    if (!job) return '';
    if (job.phase === 'collecting') {
      return `Collecting ${activeConfig.unit} list — ${job.currentDept || '...'} (${job.deptIndex}/${job.deptTotal} departments)`;
    }
    if (job.phase === 'merging') {
      return 'Merging every page into a single PDF...';
    }
    return `Generating ${job.currentDept} — ${job.currentItem} (${job.done}/${job.total})`;
  };

  return (
    <Box bgGradient={bgGradient} minH="100vh" pb={{ base: 10, md: 16 }} overflowX="hidden">
      <Helmet>
        <title>Institute-wide Timetable Download</title>
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
              Institute-wide Download
            </Badge>
            <Heading size={{ base: 'lg', md: 'xl', lg: '2xl' }} color="white" fontWeight="bold">
              Merged Timetable PDFs
            </Heading>
            <Text color="whiteAlpha.900" fontSize={{ base: 'sm', md: 'lg' }} maxW="3xl">
              Download every department&apos;s timetables for a session as one merged PDF —
              by semester, by faculty, or by room.
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
                  Defaults to the current session. Every department in it is included.
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
              <>
                <Select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  size={{ base: 'md', md: 'lg' }}
                  placeholder="Select session..."
                  maxW={{ base: 'full', md: 'md' }}
                  isDisabled={isBusy}
                >
                  {sessions.map((session) => (
                    <option key={session} value={session}>
                      {session}
                      {session === currentSession ? ' (current)' : ''}
                    </option>
                  ))}
                </Select>

                <HStack spacing={{ base: 2, md: 3 }} flexWrap="wrap" rowGap={2}>
                  <Badge colorScheme="purple" fontSize={{ base: 'xs', md: 'sm' }} px={3} py={1} borderRadius="lg">
                    {departments.length} department(s)
                  </Badge>
                  {departments.map((dept) => (
                    <Badge key={dept.code} colorScheme="gray" fontSize={{ base: 'xs', md: 'sm' }} px={2} py={1}>
                      {dept.dept}
                    </Badge>
                  ))}
                </HStack>
              </>
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
                <Heading size={{ base: 'sm', md: 'md' }}>Preparing {activeConfig.label} PDF</Heading>
              </HStack>

              <Text color={subtleText} fontSize={{ base: 'sm', md: 'md' }}>{phaseMessage()}</Text>

              <Progress
                value={job.phase === 'collecting' ? undefined : progressValue}
                isIndeterminate={job.phase !== 'generating'}
                size={{ base: 'md', md: 'lg' }}
                borderRadius="full"
                colorScheme="blue"
                hasStripe
                isAnimated
              />

              {job.phase === 'generating' && (
                <Text fontSize={{ base: 'xs', md: 'sm' }} color={subtleText}>
                  {job.done} of {job.total} timetables rendered ({progressValue}%)
                </Text>
              )}

              <Alert status="info" borderRadius="lg">
                <AlertIcon />
                <AlertDescription fontSize={{ base: 'xs', md: 'sm' }}>
                  Keep this tab open — the PDFs are built in your browser. A large institute
                  can take a few minutes.
                </AlertDescription>
              </Alert>

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

        {lastResult && (
          <Box
            bg={cardBg}
            borderRadius="2xl"
            shadow="xl"
            p={{ base: 4, md: 6 }}
            mb={{ base: 5, md: 8 }}
            border="2px"
            borderColor="green.300"
          >
            <VStack align="start" spacing={3}>
              <HStack align="start">
                <Icon as={FiCheckCircle} color="green.500" boxSize={{ base: 5, md: 6 }} flexShrink={0} />
                <Heading size={{ base: 'sm', md: 'md' }} color="green.700">
                  {DOWNLOAD_TYPES[lastResult.type].label} downloaded
                </Heading>
              </HStack>
              <Text color={subtleText} fontSize={{ base: 'sm', md: 'md' }}>
                {lastResult.generated} timetable(s) merged for session {lastResult.session}.
              </Text>
              {lastResult.skipped.length > 0 && (
                <Alert status="warning" borderRadius="lg">
                  <AlertIcon />
                  <AlertDescription fontSize={{ base: 'xs', md: 'sm' }} wordBreak="break-word">
                    Skipped {lastResult.skipped.length} entr(y/ies): {lastResult.skipped.join('; ')}
                  </AlertDescription>
                </Alert>
              )}
            </VStack>
          </Box>
        )}

        <Box
          bg={cardBg}
          borderRadius="2xl"
          shadow="xl"
          p={{ base: 4, md: 8 }}
          border="1px"
          borderColor={borderColor}
        >
          <VStack align="stretch" spacing={{ base: 4, md: 6 }}>
            <VStack align="start" spacing={1}>
              <Heading size={{ base: 'sm', md: 'md' }}>Downloads</Heading>
              <Text color={subtleText} fontSize={{ base: 'xs', md: 'sm' }}>
                Each option produces a single PDF covering all departments in the session.
              </Text>
            </VStack>
            <Divider />
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={{ base: 4, md: 6 }}>
              {Object.values(DOWNLOAD_TYPES).map((config) => (
                <Box
                  key={config.key}
                  bgGradient={config.gradient}
                  p={{ base: 4, md: 6 }}
                  borderRadius="xl"
                  shadow="lg"
                  border="2px solid"
                  borderColor="whiteAlpha.300"
                >
                  <VStack spacing={4} align="stretch">
                    <HStack spacing={3}>
                      <Box
                        bg="whiteAlpha.400"
                        p={3}
                        borderRadius="lg"
                        border="2px solid"
                        borderColor="whiteAlpha.500"
                      >
                        <Icon as={config.icon} boxSize={{ base: 5, md: 6 }} color="white" />
                      </Box>
                      <Text
                        color="white"
                        fontWeight="bold"
                        fontSize={{ base: 'md', md: 'lg' }}
                        textShadow="0 2px 10px rgba(0,0,0,0.6)"
                      >
                        {config.label}
                      </Text>
                    </HStack>
                    <Text color="whiteAlpha.900" fontSize={{ base: 'xs', md: 'sm' }} minH={{ base: 'auto', md: '40px' }}>
                      {config.description}
                    </Text>
                    <Button
                      leftIcon={<Icon as={FiDownload} />}
                      size={{ base: 'sm', md: 'md' }}
                      whiteSpace="normal"
                      height="auto"
                      py={{ base: 2.5, md: 2 }}
                      bg="whiteAlpha.900"
                      color="gray.800"
                      _hover={{ bg: 'white' }}
                      onClick={() => runDownload(config.key)}
                      isDisabled={isBusy || isLoadingMeta || !selectedSession}
                      isLoading={isBusy && job.type === config.key}
                      loadingText="Preparing..."
                    >
                      Download merged PDF
                    </Button>
                  </VStack>
                </Box>
              ))}
            </SimpleGrid>
          </VStack>
        </Box>
      </Container>
    </Box>
  );
};

export default InstituteMergedDownload;
