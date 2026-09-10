import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  HStack,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Text,
  Tooltip,
  Wrap,
  WrapItem,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import {
  ClassCardPreview,
  ClassCardGridSkeleton,
  ColorPicker,
  EmptyState,
  ErrorState,
  Loading,
  StatTile,
  StatTileSkeleton,
} from '../components/common';
import { LmIcon } from '../components/Icon';
import { CLASS_COLORS } from '../format';
import { canCreateClass } from '../roles';

// getDay() is 0=Sunday..6=Saturday; the timetable itself never schedules
// Sunday (see server's ttInternals.DAYS), so that index is left unmapped.
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ClassCard({ klass, onOpen }) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const ownerColor = useColorModeValue('gray.600', 'gray.300');
  const metaColor = useColorModeValue('gray.500', 'gray.400');
  const todayBorder = 'blue.500';
  const todayBg = 'white';
  const todayColor = 'blue.700';

  const isTeacher = ['teacher', 'co-teacher'].includes(klass.myRole);
  const todayName = WEEKDAY_NAMES[new Date().getDay()];
  return (
    <Box
      as="button"
      textAlign="left"
      onClick={() => onOpen(klass)}
      bg={cardBg}
      borderWidth="1px"
      borderColor={cardBorder}
      borderRadius="lg"
      overflow="hidden"
      transition="all 0.15s"
      _hover={{ boxShadow: 'md', transform: 'translateY(-2px)' }}
    >
      <Box bg={klass.coverColor || '#1967d2'} px={5} pt={5} pb={4} color="lmFg.onAccent" position="relative">
        <Heading size="md" noOfLines={2} pr={16}>
          {klass.name}
        </Heading>
        <Text fontSize="sm" opacity={0.9} noOfLines={1}>
          {[klass.section, klass.subject].filter(Boolean).join(' · ') || ' '}
        </Text>
        <Badge
          position="absolute"
          top={4}
          right={4}
          colorScheme={isTeacher ? 'yellow' : 'whiteAlpha'}
          borderRadius="full"
          fontSize="0.65rem"
        >
          {isTeacher ? 'Teaching' : 'Student'}
        </Badge>
      </Box>
      <Box px={5} py={4}>
        <Text fontSize="sm" color={ownerColor} noOfLines={1}>
          {klass.ownerName}
        </Text>
        <HStack mt={3} spacing={4} fontSize="xs" color={metaColor}>
          <Text display="flex" alignItems="center" gap={1}>
            <LmIcon name="people" size={13} />
            {klass.stats?.studentCount ?? 0}
          </Text>
          <Text display="flex" alignItems="center" gap={1}>
            <LmIcon name="coursework" size={13} />
            {klass.stats?.courseworkCount ?? 0}
          </Text>
          {isTeacher && (
            <Text display="flex" alignItems="center" gap={1}>
              <LmIcon name="key" size={13} />
              {klass.code}
            </Text>
          )}
        </HStack>

        {/* Points and badges, students only. A teacher's card showing a score
            would suggest they are playing the same game, and the leaderboard
            deliberately leaves staff off it. */}
        {!isTeacher && (klass.myPoints > 0 || klass.myBadgeCount > 0) && (
          <Flex mt={3} align="center" gap={2} wrap="wrap">
            <Badge
              colorScheme="purple"
              borderRadius="full"
              px={2}
              fontSize="0.7rem"
              display="inline-flex"
              alignItems="center"
              gap={1}
            >
              <LmIcon name="star" size={11} />
              {klass.myPoints} pts
            </Badge>
            {klass.myWeeklyPoints > 0 && (
              <Badge colorScheme="green" borderRadius="full" px={2} fontSize="0.7rem">
                +{klass.myWeeklyPoints} this week
              </Badge>
            )}
            {klass.myBadges?.length > 0 && (
              <Tooltip label={klass.myBadges.map((badge) => badge.name).join(' · ')}>
                <HStack spacing={0.5} fontSize="sm">
                  {klass.myBadges.map((badge) => (
                    <Text key={badge.id} as="span" aria-label={badge.name}>
                      {badge.emoji}
                    </Text>
                  ))}
                  {klass.myBadgeCount > klass.myBadges.length && (
                    <Text as="span" fontSize="xs" color="lmFg.muted">
                      +{klass.myBadgeCount - klass.myBadges.length}
                    </Text>
                  )}
                </HStack>
              </Tooltip>
            )}
          </Flex>
        )}

        {/* Timetable schedule display — the slot(s) falling on today get a
            blue border and a white background so a student/teacher can spot
            "am I in this class today" at a glance without opening the class. */}
        {klass.schedule && klass.schedule.length > 0 && (
          <Wrap mt={3} spacing={1} align="center">
            <WrapItem>
              <Text fontSize="xs" color={metaColor}>📅</Text>
            </WrapItem>
            {klass.schedule.map((item, idx) => {
              const isToday = item.day === todayName;
              return (
                <WrapItem key={`${item.day}-${item.label}-${idx}`}>
                  <Tag
                    size="sm"
                    fontSize="0.7rem"
                    colorScheme="gray"
                    variant="subtle"
                    bg={isToday ? todayBg : undefined}
                    color={isToday ? todayColor : undefined}
                    fontWeight={isToday ? 'bold' : 'normal'}
                    borderWidth={isToday ? '2px' : '1px'}
                    borderColor={isToday ? todayBorder : 'transparent'}
                  >
                    {item.label}
                  </Tag>
                </WrapItem>
              );
            })}
          </Wrap>
        )}

        {/* Quiz marks released and not yet read. Deliberately on the subject
            card rather than only in the notification bell: a student who was in
            a lecture when the announcement went out has a read bell and no idea
            their marks are waiting. It clears itself the moment they open the
            result — see quizController.getAttempt. */}
        {!isTeacher && klass.myNewResults > 0 && (
          <Badge mt={3} colorScheme="green" borderRadius="full" px={2}>
            {klass.myNewResults} quiz result{klass.myNewResults === 1 ? '' : 's'} announced
          </Badge>
        )}

        {klass.myStatus === 'pending' && (
          <Badge mt={3} colorScheme="orange">
            Waiting for approval
          </Badge>
        )}
      </Box>
    </Box>
  );
}

// A class is always "a subject, taught to one semester of one branch", and the
// timetable module already holds that catalogue — so the form picks from it
// rather than asking the teacher to retype names and codes. Everything else
// (room, description, meeting link) is left to class settings.
function CreateClassModal({ isOpen, onClose, onCreated, me }) {
  const [branches, setBranches] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingSemesters, setLoadingSemesters] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [catalogueError, setCatalogueError] = useState(null);

  const [branchCode, setBranchCode] = useState('');
  const [semester, setSemester] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [name, setName] = useState('');
  const [coverColor, setCoverColor] = useState(CLASS_COLORS[0]);
  const [saving, setSaving] = useState(false);
  // Once the teacher edits the name themselves, stop overwriting it when they
  // change the subject.
  const [nameTouched, setNameTouched] = useState(false);
  const toast = useToast();

  const branch = branches.find((item) => item.code === branchCode) || null;
  const subject = subjects.find((item) => item.id === subjectId) || null;
  const section = semester ? `Sem ${semester}` : '';

  const reset = useCallback(() => {
    setBranchCode('');
    setSemester('');
    setSubjectId('');
    setName('');
    setNameTouched(false);
    setCoverColor(CLASS_COLORS[0]);
  }, []);

  // Branches of the current academic session.
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setLoadingBranches(true);
    setCatalogueError(null);
    lmApi
      .ttBranches()
      .then((list) => {
        if (cancelled) return;
        setBranches(list);
        if (list.length > 0) {
          setBranchCode(list[0].code);
        }
      })
      .catch((error) => !cancelled && setCatalogueError(error))
      .finally(() => !cancelled && setLoadingBranches(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    setSemester('');
    setSubjectId('');
    setSemesters([]);
    if (!branchCode) return undefined;
    let cancelled = false;
    setLoadingSemesters(true);
    lmApi
      .ttSemesters(branchCode)
      .then((list) => !cancelled && setSemesters(list))
      .catch(() => !cancelled && setSemesters([]))
      .finally(() => !cancelled && setLoadingSemesters(false));
    return () => {
      cancelled = true;
    };
  }, [branchCode]);

  useEffect(() => {
    setSubjectId('');
    setSubjects([]);
    if (!branchCode || !semester) return undefined;
    let cancelled = false;
    setLoadingSubjects(true);
    lmApi
      .ttSubjects(branchCode, semester)
      .then((list) => !cancelled && setSubjects(list))
      .catch(() => !cancelled && setSubjects([]))
      .finally(() => !cancelled && setLoadingSubjects(false));
    return () => {
      cancelled = true;
    };
  }, [branchCode, semester]);

  // The subject name is the sensible class name; keep it in step until edited.
  useEffect(() => {
    if (nameTouched) return;
    setName(subject ? subject.name : '');
  }, [subject, nameTouched]);

  const submit = async () => {
    if (!subject || !name.trim()) return;
    setSaving(true);
    try {
      const created = await lmApi.createClass({
        name: name.trim(),
        section,
        subject: subject.subName || subject.name,
        subjectCode: subject.subCode,
        semester,
        dept: branch?.dept || '',
        coverColor,
      });
      toast({
        status: 'success',
        title: `"${created.name}" created`,
        description: `Class code: ${created.code}`,
      });
      reset();
      onCreated(created);
    } catch (error) {
      toast({ status: 'error', title: 'Could not create class', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Create a class</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <ErrorState error={catalogueError} />
          {!catalogueError && !loadingBranches && branches.length === 0 && (
            <Alert status="warning" borderRadius="md" mb={4} fontSize="sm">
              <AlertIcon />
              No timetable is set up for the current session yet, so there are no branches to pick
              from. Ask the timetable admin to publish one.
            </Alert>
          )}

          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4} mb={4}>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Branch</FormLabel>
              <Select
                value={branchCode}
                onChange={(event) => setBranchCode(event.target.value)}
                placeholder={loadingBranches ? 'Loading…' : 'Select branch'}
                isDisabled={loadingBranches}
                autoFocus
              >
                {branches.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.dept}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Semester</FormLabel>
              <Select
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                placeholder={loadingSemesters ? 'Loading…' : 'Select semester'}
                isDisabled={!branchCode || loadingSemesters}
              >
                {semesters.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
              {branchCode && !loadingSemesters && semesters.length === 0 && (
                <FormHelperText color="orange.600">
                  No subjects are registered for this branch yet.
                </FormHelperText>
              )}
            </FormControl>
          </SimpleGrid>

          <FormControl isRequired mb={4}>
            <FormLabel fontSize="sm">Subject</FormLabel>
            <Select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              placeholder={loadingSubjects ? 'Loading…' : 'Select subject'}
              isDisabled={!semester || loadingSubjects}
            >
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {[item.subCode, item.subName || item.name].filter(Boolean).join(' — ')}
                  {item.type ? ` (${item.type})` : ''}
                </option>
              ))}
            </Select>
            {semester && !loadingSubjects && subjects.length === 0 && (
              <FormHelperText color="orange.600">
                No subjects found for this branch and semester in the timetable.
              </FormHelperText>
            )}
          </FormControl>

          <FormControl isRequired mb={4}>
            <FormLabel fontSize="sm">Class name</FormLabel>
            <Input
              value={name}
              onChange={(event) => {
                setNameTouched(true);
                setName(event.target.value);
              }}
              placeholder="Picked from the subject — edit if you want"
            />
          </FormControl>

          <FormControl mb={4}>
            <FormLabel fontSize="sm">Theme colour</FormLabel>
            <ColorPicker value={coverColor} options={CLASS_COLORS} onChange={setCoverColor} />
          </FormControl>

          <Box>
            <Text fontSize="xs" color="lmFg.muted" mb={2}>
              Preview
            </Text>
            <ClassCardPreview
              color={coverColor}
              title={name || 'Class name'}
              subtitle={
                [section, subject?.subName || subject?.name].filter(Boolean).join(' · ') ||
                'Semester · Subject'
              }
            />
          </Box>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={submit}
            isLoading={saving}
            isDisabled={!subject || !name.trim()}
          >
            Create class
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function JoinClassModal({ isOpen, onClose, onJoined }) {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Peek at the class as soon as a full-length code is typed, so a student
  // knows what they are about to join.
  useEffect(() => {
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const found = await lmApi.previewCode(trimmed);
        if (!cancelled) setPreview(found);
      } catch {
        if (!cancelled) setPreview(null);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code]);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await lmApi.joinByCode(code.trim());
      toast({
        status: 'success',
        title: result.status === 'pending' ? 'Request sent' : 'Joined',
        description:
          result.status === 'pending'
            ? 'The teacher will review your request.'
            : `You are now in ${result.className || 'the class'}.`,
      });
      setCode('');
      setPreview(null);
      onJoined(result);
    } catch (error) {
      toast({ status: 'error', title: 'Could not join', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Join a class</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel fontSize="sm">Class code</FormLabel>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="e.g. k3mq9xt"
              autoFocus
              onKeyDown={(event) => event.key === 'Enter' && code.trim() && submit()}
            />
            <FormHelperText>Ask your teacher for the 7-character class code.</FormHelperText>
          </FormControl>
          {preview && (
            <Box mt={4} p={3} borderWidth="1px" borderRadius="md" borderLeftWidth="4px" borderLeftColor={preview.coverColor}>
              <Text fontWeight="600">{preview.name}</Text>
              <Text fontSize="sm" color="lmFg.subtle">
                {[preview.section, preview.subject].filter(Boolean).join(' · ')}
              </Text>
              <Text fontSize="xs" color="lmFg.muted">
                Taught by {preview.ownerName}
              </Text>
            </Box>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={submit} isLoading={busy} isDisabled={code.trim().length < 4}>
            Join
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/**
 * The banner for a paper that is open, or about to be.
 *
 * Its own component because of the countdown: a ticking clock re-renders every
 * second, and left inline it would re-render the whole dashboard — every class
 * card, every list — sixty times a minute.
 *
 * This is the screen Safe Exam Browser lands on. The settings file's Start URL
 * is the module home and cannot be a single paper, so a student arrives here
 * inside a kiosk with no address bar, no reload and a locked keyboard. Whatever
 * gets them into their exam has to be on this row.
 */
function OpenExamBanner({ exam, muted }) {
  const [now, setNow] = useState(() => Date.now());
  const [sebLaunch, setSebLaunch] = useState('');

  const opensAt = exam.opensAt ? new Date(exam.opensAt).getTime() : 0;
  const waiting = exam.notYetOpen && opensAt > now;

  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  /* The launch address, if this paper is sat in Safe Exam Browser.
     Fetched rather than assembled: it carries a short-lived token, because SEB
     follows the link with its own network stack and none of this session. It
     opens SEB on this same dashboard — the Start URL is fixed in the settings
     file — from where the button below is one click away, this time inside the
     kiosk. */
  useEffect(() => {
    if (!exam.requiresSeb) return undefined;
    let cancelled = false;
    lmApi
      .sebLaunchToken(exam.classId, exam._id)
      .then((result) => {
        if (!cancelled && result?.token) setSebLaunch(lmApi.sebLaunchUrlFromToken(result.token));
      })
      // No token, no button. The test page still offers both the launch and the
      // file download, so nothing here is the only way through.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [exam.requiresSeb, exam.classId, exam._id]);

  const left = Math.max(0, Math.round((opensAt - now) / 1000));
  const countdown = [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');

  return (
    <Alert
      status={waiting ? 'info' : 'success'}
      borderRadius="lg"
      mb={4}
      py={3}
      flexDirection={{ base: 'column', md: 'row' }}
      alignItems={{ base: 'stretch', md: 'center' }}
      gap={3}
    >
      <Flex flex="1" minW={0} align="flex-start">
        <AlertIcon mt={0.5} flexShrink={0} />
        <Box minW={0}>
          <Text fontWeight="700" overflowWrap="anywhere">
            {exam.inProgress
              ? 'You have a test in progress'
              : waiting
                ? `Starts in ${countdown}`
                : 'A test is open now'}
            {exam.className ? ` — ${exam.className}` : ''}
          </Text>
          <Text fontSize="sm" color={muted} overflowWrap="anywhere">
            {exam.title}
            {exam.requiresSeb ? ' · Safe Exam Browser' : ''}
          </Text>
        </Box>
      </Flex>
      <Flex
        flexShrink={0}
        gap={2}
        width={{ base: '100%', md: 'auto' }}
        direction={{ base: 'column', sm: 'row' }}
      >
        {sebLaunch && (
          <Button
            as="a"
            href={sebLaunch}
            size="sm"
            colorScheme="purple"
            variant="outline"
            width={{ base: '100%', sm: 'auto' }}
            whiteSpace="normal"
          >
            Open Safe Exam Browser
          </Button>
        )}
        <Button
          as={RouterLink}
          to={`/learning/class/${exam.classId}/quiz/${exam._id}`}
          colorScheme={waiting ? 'blue' : 'green'}
          size="sm"
          width={{ base: '100%', sm: 'auto' }}
          whiteSpace="normal"
        >
          {exam.inProgress ? 'Continue' : waiting ? 'View details' : 'Open the test'}
        </Button>
      </Flex>
    </Alert>
  );
}


export default function Dashboard() {
  const { me, overview, reloadOverview } = useOutletContext() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Creating a class is faculty-only on the server, so a student never sees
  // the entry points — nor the modal if they land on ?create=1 by hand.
  const mayCreateClass = canCreateClass(me?.roles);
  const showCreate = mayCreateClass && searchParams.get('create') === '1';
  const showJoin = searchParams.get('join') === '1';
  const closeModals = () => setSearchParams({}, { replace: true });

  const {
    data: classes = [],
    isLoading: loadingClasses,
    error: activeError,
    refetch: refetchActive,
  } = useQuery({
    queryKey: ['learning', 'classes', 'active'],
    queryFn: () => lmApi.listClasses(),
  });

  const {
    data: archived = [],
    isLoading: loadingArchived,
    error: archivedError,
    refetch: refetchArchived,
  } = useQuery({
    queryKey: ['learning', 'classes', 'archived'],
    queryFn: () => lmApi.listClasses('archived'),
  });

  const {
    data: completed = [],
    isLoading: loadingCompleted,
    error: completedError,
    refetch: refetchCompleted,
  } = useQuery({
    queryKey: ['learning', 'classes', 'completed'],
    queryFn: () => lmApi.listClasses('completed'),
  });

  const loading = loadingClasses || loadingArchived || loadingCompleted;
  const error = activeError || archivedError || completedError;

  const load = useCallback(async () => {
    await Promise.all([refetchActive(), refetchArchived(), refetchCompleted()]);
  }, [refetchActive, refetchArchived, refetchCompleted]);

  useEffect(() => {
    reloadOverview?.();
  }, [reloadOverview]);

  const openClass = (klass) => navigate(`/learning/class/${klass._id}`);

  const afterChange = async () => {
    closeModals();
    await load();
    reloadOverview?.();
  };

  const headingColor = useColorModeValue('gray.800', 'white');
  const secondaryTextColor = useColorModeValue('gray.500', 'gray.300');


  return (
    <Box>
      {/* An exam that is open right now, above everything else on the page.

          This is the screen Safe Exam Browser lands on: the settings file's Start
          URL is the module home and cannot be a single paper, so a student
          arrives here inside a kiosk with no address bar, no reload and a locked
          keyboard. Anything that is not on this page is unreachable to them. It
          matters outside SEB too — an exam that has started is the only thing on
          this dashboard anybody needs in that moment — but SEB is what makes its
          absence a dead end rather than an inconvenience. */}
      {(overview?.openExams || []).map((exam) => (
        <OpenExamBanner key={exam._id} exam={exam} muted={secondaryTextColor} />
      ))}

      <Flex justify="space-between" align="center" mb={5} wrap="wrap" gap={3}>
        <Box>
          <Heading size="lg" color={headingColor}>
            Your classes
          </Heading>
          <Text color={secondaryTextColor} fontSize="sm">
            Everything you teach or are enrolled in.
          </Text>
        </Box>
        {/* Creating a class lives only in the module header, so it is not
            offered twice on the same screen. Joining stays here: it is the
            action a student came for. */}
        <HStack wrap="wrap" w={{ base: '100%', md: 'auto' }}>
          {/* The introduction to the whole module. Public, so a teacher who has
              not set anything up yet can also forward it to a colleague. */}
          <Button as="a" href="/learning/manual" target="_blank" rel="noreferrer" variant="ghost">
            <LmIcon name="manual" size={14} style={{ marginRight: 6 }} />
            Getting started
          </Button>
          <Button variant="outline" onClick={() => setSearchParams({ join: '1' })}>
            Join class
          </Button>
          {mayCreateClass && (
            <Button colorScheme="blue" onClick={() => setSearchParams({ create: '1' })}>
              Create class
            </Button>
          )}
        </HStack>
      </Flex>

      {overview ? (
        <Grid templateColumns={{ base: '1fr 1fr', md: 'repeat(4, 1fr)' }} gap={4} mb={6}>
          <StatTile label="Classes" value={overview.classCount} hint={`${overview.teachingCount} teaching`} />
          <StatTile label="Pending work" value={overview.pendingWork} accent="orange.500" hint="Not turned in" />
          <StatTile label="To review" value={overview.awaitingReview} accent="purple.500" hint="Student submissions" />
          <StatTile label="Due this week" value={overview.dueThisWeek} accent="red.500" />
        </Grid>
      ) : (
        <Grid templateColumns={{ base: '1fr 1fr', md: 'repeat(4, 1fr)' }} gap={4} mb={6}>
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
        </Grid>
      )}

      <ErrorState error={error} onRetry={load} />

      {loading ? (
        <ClassCardGridSkeleton count={6} />
      ) : (
        <Tabs colorScheme="blue" variant="soft-rounded">
          <TabList mb={4}>
            <Tab fontSize="sm">Active ({classes.length})</Tab>
            <Tab fontSize="sm">Completed ({completed.length})</Tab>
            <Tab fontSize="sm">Archived ({archived.length})</Tab>
          </TabList>
          <TabPanels>
            <TabPanel px={0}>
              {classes.length === 0 ? (
                <EmptyState
                  icon="classes"
                  title="No classes yet"
                  description={
                    mayCreateClass
                      ? 'Use Create in the header if you teach, or join one with the code your teacher shared.'
                      : 'Join one with the code your teacher shared.'
                  }
                  action={
                    <Button size="sm" variant="outline" onClick={() => setSearchParams({ join: '1' })}>
                      Join a class
                    </Button>
                  }
                />
              ) : (
                <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5}>
                  {classes.map((klass) => (
                    <ClassCard key={klass._id} klass={klass} onOpen={openClass} />
                  ))}
                </SimpleGrid>
              )}
            </TabPanel>
            <TabPanel px={0}>
              {completed.length === 0 ? (
                <EmptyState icon="trophy" title="Nothing completed yet" description="Classes marked as completed will show up here." />
              ) : (
                <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5}>
                  {completed.map((klass) => (
                    <ClassCard key={klass._id} klass={klass} onOpen={openClass} />
                  ))}
                </SimpleGrid>
              )}
            </TabPanel>
            <TabPanel px={0}>
              {archived.length === 0 ? (
                <EmptyState icon="archive" title="Nothing archived" description="Archived classes stay readable but are hidden from the main list." />
              ) : (
                <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5}>
                  {archived.map((klass) => (
                    <ClassCard key={klass._id} klass={klass} onOpen={openClass} />
                  ))}
                </SimpleGrid>
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}

      <CreateClassModal isOpen={showCreate} onClose={closeModals} onCreated={afterChange} me={me} />
      <JoinClassModal isOpen={showJoin} onClose={closeModals} onJoined={afterChange} />
    </Box>
  );
}
