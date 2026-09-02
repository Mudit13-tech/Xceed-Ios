import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  Heading,
  ListItem,
  Select,
  Spinner,
  Stack,
  Text,
  Tooltip,
  UnorderedList,
  VStack,
} from '@chakra-ui/react';
import { RepeatIcon, TimeIcon } from '@chakra-ui/icons';
import lmApi from '../api/lmApi';
import getEnvironment from '../../getenvironment';
import { SectionCard } from '../components/common';
import ViewTimetable from '../../timetableadmin/viewtt';
import TimetableSummary from '../../timetableadmin/ttsummary';
import { generateInitialTimetableData } from '../../timetableadmin/timetableDataHelpers';
import TimetableWidget from '../components/TimetableWidget';
import SafeChild from '../components/SafeChild';
import { isStudentOnly } from '../roles';

/**
 * Standard department acronym mappings to bridge student class department names
 * with full timetable session department names.
 */
const DEPT_ACRONYMS = {
  ECE: ['Electronics & Communication Engineering', 'Electronics and Communication Engineering', 'ECE'],
  CSE: ['Computer Science & Engineering', 'Computer Science and Engineering', 'CSE'],
  ICE: ['Instrumentation & Control Engineering', 'Instrumentation and Control Engineering', 'ICE'],
  IT: ['Information Technology', 'IT'],
  ME: ['Mechanical Engineering', 'ME'],
  CE: ['Civil Engineering', 'CE'],
  CHE: ['Chemical Engineering', 'CHE'],
  IPE: ['Industrial & Production Engineering', 'Industrial and Production Engineering', 'IPE'],
  TT: ['Textile Technology', 'TT'],
  TXT: ['Textile Technology', 'TXT'],
  BT: ['Biotechnology', 'BT'],
  HM: ['Humanities & Management', 'Humanities and Management', 'HM'],
  MA: ['Mathematics', 'MA'],
  PH: ['Physics', 'PH'],
  CY: ['Chemistry', 'CY'],
};

/**
 * Helper to match department strings taking into account acronyms and substring matching.
 */
function matchDept(targetDept, availableDepts) {
  if (!targetDept || !availableDepts || !availableDepts.length) return targetDept;

  const targetLower = targetDept.trim().toLowerCase();

  // 1. Direct case-insensitive match
  const directMatch = availableDepts.find(
    (d) => d.toLowerCase() === targetLower || d.toLowerCase().includes(targetLower) || targetLower.includes(d.toLowerCase()),
  );
  if (directMatch) return directMatch;

  // 2. Acronym dictionary match
  const upper = targetDept.trim().toUpperCase();
  for (const [acronym, variations] of Object.entries(DEPT_ACRONYMS)) {
    const isTargetVariant = upper === acronym || variations.some((v) => v.toLowerCase() === targetLower);
    if (isTargetVariant) {
      const matched = availableDepts.find((d) =>
        variations.some((v) => v.toLowerCase() === d.toLowerCase() || d.toLowerCase().includes(v.toLowerCase())),
      );
      if (matched) return matched;
    }
  }

  return availableDepts[0] || targetDept;
}

/**
 * Authenticated fetch wrapper for mobile WebView/PWA environments.
 * Attaches the Bearer token from localStorage alongside cookies.
 */
async function fetchWithAuth(url) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Checks if raw timetable data contains any actual class entries.
 */
function hasRawClasses(rawData) {
  if (!rawData || typeof rawData !== 'object') return false;
  const grid = rawData.timetableData || rawData;
  if (!grid || typeof grid !== 'object') return false;

  return Object.values(grid).some((dayData) => {
    if (!dayData || typeof dayData !== 'object') return false;
    return Object.values(dayData).some((slots) => {
      if (!Array.isArray(slots)) return false;
      return slots.some((slot) => {
        if (Array.isArray(slot)) {
          return slot.some((cell) => cell && (cell.subject || cell.room || cell.faculty));
        }
        return slot && (slot.subject || slot.room || slot.faculty);
      });
    });
  });
}

/**
 * Sanitizes subject data to ensure it satisfies TimetableSummary expectations.
 */
function sanitizeSubjectData(rawSubjects) {
  if (!Array.isArray(rawSubjects)) return [];
  return rawSubjects
    .filter(Boolean)
    .map((sub) => ({
      subCode: String(sub.subCode || ''),
      subName: String(sub.subName || sub.subCode || ''),
      subjectFullName: String(sub.subjectFullName || sub.subFullName || sub.subName || sub.subCode || ''),
      type: String(sub.type || sub.subType || 'Theory'),
      sem: String(sub.sem || ''),
    }));
}

/**
 * The timetable tab in Learning Module.
 *
 * ## Student Timetable View (Issue #2065)
 * Uses the official XCEED timetable design (`ViewTimetable` + `TimetableSummary` + notes).
 * - Auto-detects student registered department & semester from active enrolments.
 * - Provides quick "My Registered Semesters" picker and manual department/semester selectors.
 * - Dual-fetch with live fallback: Reads locked timetable (`/lockclasstt`), falling back to
 *   active saved class timetable (`/viewclasstt`) if the coordinator has saved without locking.
 * - Token-authenticated requests for robust mobile app / WebView / PWA compatibility.
 * - Local `<SafeChild>` error boundaries to guarantee app stability without modifying `timetableadmin`.
 */
export default function Timetable() {
  const { me } = useOutletContext();
  const isStudent = isStudentOnly(me?.roles);

  // Faculty can switch between their personal schedule and student semester timetable
  const [viewStudentSchedule, setViewStudentSchedule] = useState(isStudent);

  const [options, setOptions] = useState(null);
  const [dept, setDept] = useState('');
  const [sem, setSem] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingTT, setLoadingTT] = useState(false);
  const [error, setError] = useState(null);

  // Timetable and summary state for XCEED design
  const [timetableData, setTimetableData] = useState({});
  const [subjectData, setSubjectData] = useState([]);
  const [ttData, setTTData] = useState(null);
  const [semNotes, setSemNotes] = useState([]);
  const [lockedTime, setLockedTime] = useState('');
  const [isSavedFallback, setIsSavedFallback] = useState(false);

  const apiUrl = getEnvironment();

  useEffect(() => {
    if (isStudent) {
      setViewStudentSchedule(true);
    }
  }, [isStudent]);

  /* Fetch timetable options (enrolment suggestions, active departments, semesters) */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fetched = await lmApi.timetableOptions();
        if (cancelled) return;
        setOptions(fetched);

        const validDepts = fetched?.depts || [];
        const semsMap = fetched?.semsByDept || {};

        // Resolve initial department matching suggestion or first available
        let initialDept = '';
        if (fetched?.suggested?.dept) {
          initialDept = matchDept(fetched.suggested.dept, validDepts);
        } else if (validDepts.length > 0) {
          initialDept = validDepts[0];
        }

        // Resolve initial semester for that department
        const availableSems = semsMap[initialDept] || [];
        let initialSem = '';
        if (fetched?.suggested?.sem && availableSems.includes(String(fetched.suggested.sem))) {
          initialSem = String(fetched.suggested.sem);
        } else {
          const digit = String(fetched?.suggested?.sem || '').match(/\d+/)?.[0];
          if (digit && availableSems.includes(digit)) {
            initialSem = digit;
          } else if (availableSems.length > 0) {
            initialSem = availableSems[0];
          }
        }

        setDept(initialDept);
        setSem(initialSem);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const semsForDept = useMemo(
    () => (dept && options?.semsByDept?.[dept]) || [],
    [dept, options],
  );

  const sessionObj = useMemo(
    () => (dept && options?.sessions?.find((s) => s.dept === dept)) || null,
    [dept, options],
  );

  /**
   * Keep the semester valid whenever the department changes.
   */
  useEffect(() => {
    if (!semsForDept.length) {
      setSem('');
      return;
    }
    if (semsForDept.includes(sem)) return;

    const digit = String(sem || options?.suggested?.sem || '').match(/\d+/)?.[0];
    if (digit && semsForDept.includes(digit)) {
      setSem(digit);
    } else {
      setSem(semsForDept[0]);
    }
  }, [dept, semsForDept, sem, options]);

  /**
   * Load the locked class timetable and subject summary for the chosen dept & sem.
   * Seamlessly falls back to active saved class timetable if the timetable has not been locked.
   */
  const loadTimetable = useCallback(async () => {
    if (!dept || !sem) {
      setTimetableData({});
      setSubjectData([]);
      setTTData(null);
      setSemNotes([]);
      setLockedTime('');
      setIsSavedFallback(false);
      return;
    }
    const currentCode = sessionObj?.code;
    if (!currentCode) {
      setTimetableData({});
      setSubjectData([]);
      setTTData(null);
      setSemNotes([]);
      setLockedTime('');
      setIsSavedFallback(false);
      return;
    }

    setLoadingTT(true);
    setError(null);
    setIsSavedFallback(false);

    try {
      // 1. Fetch locked timetable first
      let ttResult = await fetchWithAuth(
        `${apiUrl}/timetablemodule/lock/lockclasstt/${currentCode}/${sem}`,
      );

      let rawData = ttResult?.timetableData || ttResult;
      let notes = ttResult?.notes || [];
      let isFallback = false;

      // 2. If locked timetable is empty, fallback to saved class timetable
      if (!hasRawClasses(rawData)) {
        const savedResult = await fetchWithAuth(
          `${apiUrl}/timetablemodule/tt/viewclasstt/${currentCode}/${sem}`,
        );
        if (hasRawClasses(savedResult)) {
          rawData = savedResult?.timetableData || savedResult;
          notes = savedResult?.notes || notes || [];
          isFallback = true;
        }
      }

      setIsSavedFallback(isFallback);

      if (rawData && typeof rawData === 'object') {
        const gridObj = rawData.timetableData || rawData;
        const initialData = generateInitialTimetableData(gridObj, 'sem');
        setTimetableData(initialData);
        setSemNotes(Array.isArray(notes) ? notes : []);
      } else {
        setTimetableData({});
        setSemNotes([]);
      }

      // 3. Concurrently fetch subject details, timetable details, and lock time
      const [subResult, detailsResult, timeResult] = await Promise.all([
        fetchWithAuth(`${apiUrl}/timetablemodule/subject/subjectdetails/${currentCode}`),
        fetchWithAuth(`${apiUrl}/timetablemodule/timetable/alldetails/${currentCode}`),
        fetchWithAuth(`${apiUrl}/timetablemodule/lock/viewsem/${currentCode}`),
      ]);

      setSubjectData(sanitizeSubjectData(subResult));
      setTTData(detailsResult && typeof detailsResult === 'object' ? detailsResult : null);
      setLockedTime(timeResult?.updatedTime?.lockTimeIST || timeResult?.updatedTime || '');
    } catch (err) {
      console.error('Error fetching timetable data:', err);
      setError(err.message || 'Failed to load timetable data');
      setTimetableData({});
    } finally {
      setLoadingTT(false);
    }
  }, [apiUrl, dept, sem, sessionObj]);

  useEffect(() => {
    if (viewStudentSchedule) {
      loadTimetable();
    }
  }, [loadTimetable, viewStudentSchedule]);

  const basis = options?.basis || [];
  const suggestion = options?.suggested;

  // Normalized registered semester options
  const registeredOptions = useMemo(() => {
    if (!basis.length || !options) return [];
    const validDepts = options.depts || [];
    const semsMap = options.semsByDept || {};

    return basis.map((item) => {
      const matchedDept = matchDept(item.dept, validDepts);
      const availableSems = semsMap[matchedDept] || [];
      let matchedSem = String(item.sem);

      if (!availableSems.includes(matchedSem)) {
        const digit = String(item.sem).match(/\d+/)?.[0];
        if (digit && availableSems.includes(digit)) {
          matchedSem = digit;
        } else if (availableSems.length > 0) {
          matchedSem = availableSems[0];
        }
      }

      const isPrimary =
        (suggestion?.dept === item.dept || matchedDept === matchDept(suggestion?.dept, validDepts)) &&
        String(suggestion?.sem) === String(item.sem);

      return {
        key: `${matchedDept}|${matchedSem}`,
        targetDept: matchedDept,
        targetSem: matchedSem,
        subjects: item.subjects,
        isPrimary,
        label: `${matchedDept} · Semester ${matchedSem} (${item.subjects} subject${
          item.subjects === 1 ? '' : 's'
        })${isPrimary ? ' ⭐ (Primary)' : ''}`,
      };
    });
  }, [basis, options, suggestion]);

  const hasClasses = Object.values(timetableData || {}).some((day) =>
    Object.values(day || {}).some(
      (slots) =>
        Array.isArray(slots) &&
        slots.some(
          (slot) =>
            Array.isArray(slot) &&
            slot.some((cell) => cell && (cell.subject || cell.room || cell.faculty)),
        ),
    ),
  );

  const currentSelectionKey = `${dept}|${sem}`;
  const isRegisteredMatch = registeredOptions.some((r) => r.key === currentSelectionKey);

  // Loading state while user profile is in flight
  if (!me) {
    return (
      <Box py={12} textAlign="center">
        <Spinner size="xl" color="purple.500" />
        <Text mt={3} color="lmFg.muted" fontSize="sm">
          Loading timetable...
        </Text>
      </Box>
    );
  }

  /* `isStudent` stays in the condition rather than leaning on the effect that
     forces `viewStudentSchedule` true: the effect runs after the render in which
     `me` first arrives, so without it a student would flash the faculty widget
     for one frame. */
  const showMySchedule = !isStudent && !viewStudentSchedule;

  const header = (
    <PageHeader
      isStudent={isStudent}
      showMySchedule={showMySchedule}
      onViewChange={setViewStudentSchedule}
    />
  );

  if (showMySchedule) {
    return (
      <Box>
        {header}
        <SectionCard title="My Weekly Schedule">
          <TimetableWidget me={me} />
        </SectionCard>
      </Box>
    );
  }

  return (
    <Box>
      {header}

      <SectionCard mb={4} p={{ base: 4, md: 5 }}>
        {/* One row on a wide screen; on a phone the picker and department each
            take a line and the narrow semester select shares the last one with
            Refresh, rather than the four controls wrapping wherever they land. */}
        <Stack
          direction={{ base: 'column', lg: 'row' }}
          spacing={3}
          align={{ base: 'stretch', lg: 'flex-end' }}
        >
          {/* Quick picker for student's registered semesters */}
          {registeredOptions.length > 0 && (
            <FilterField label="My Registered Semesters" flex={{ lg: '1 1 280px' }}>
              <Select
                size="sm"
                value={isRegisteredMatch ? currentSelectionKey : ''}
                onChange={(event) => {
                  const val = event.target.value;
                  if (val) {
                    const [d, s] = val.split('|');
                    setDept(d);
                    setSem(s);
                  }
                }}
                isDisabled={loadingOptions}
              >
                {!isRegisteredMatch && (
                  <option value="">Other / Custom Selection</option>
                )}
                {registeredOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </FilterField>
          )}

          <FilterField label="Department" flex={{ lg: '1 1 200px' }}>
            <Select
              size="sm"
              value={dept}
              onChange={(event) => setDept(event.target.value)}
              isDisabled={loadingOptions}
            >
              {!options?.depts?.length && (
                <option value="">No live timetable sessions</option>
              )}
              {(options?.depts || []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FilterField>

          <Stack direction="row" spacing={3} align="flex-end" flex={{ lg: '0 0 auto' }}>
            <FilterField label="Semester" flex={{ base: '1 1 auto', lg: '0 0 110px' }}>
              <Select
                size="sm"
                value={sem}
                onChange={(event) => setSem(event.target.value)}
                isDisabled={loadingOptions || !semsForDept.length}
              >
                {!semsForDept.length && <option value="">—</option>}
                {semsForDept.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </FilterField>

            <Button
              size="sm"
              onClick={loadTimetable}
              isLoading={loadingTT}
              variant="outline"
              colorScheme="purple"
              leftIcon={<RepeatIcon />}
              flexShrink={0}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>

        {suggestion && (
          <Tooltip
            label={
              basis.length
                ? basis
                    .map(
                      (row) =>
                        `${row.dept} sem ${row.sem}: ${row.subjects} subject(s)`,
                    )
                    .join('\n')
                : 'No enrolled class carries a department and semester yet.'
            }
            whiteSpace="pre-line"
          >
            <Badge colorScheme="purple" mt={3} cursor="help">
              from your {options.enrolledCount} class
              {options.enrolledCount === 1 ? '' : 'es'}
            </Badge>
          </Tooltip>
        )}

        {!loadingOptions && !suggestion && (
          <Alert status="info" mt={3} borderRadius="md" fontSize="sm">
            <AlertIcon />
            <Box>
              None of your classes has a department and semester set yet, so nothing could be
              pre-filled. Pick them above, or ask a teacher to set them on the class.
            </Box>
          </Alert>
        )}
      </SectionCard>

      <SectionCard
        p={{ base: 3, md: 5 }}
        title={
          sessionObj && sem
            ? `${dept} · Semester ${sem}${
                sessionObj.session ? ` · ${sessionObj.session}` : ''
              }`
            : 'Weekly Timetable'
        }
      >
        {loadingOptions || loadingTT ? (
          <VStack py={8} spacing={3}>
            <Spinner size="lg" color="purple.500" />
            <Text color="lmFg.muted" fontSize="sm">
              Loading timetable…
            </Text>
          </VStack>
        ) : error ? (
          <Alert status="error" borderRadius="md" fontSize="sm">
            <AlertIcon />
            <Box>{error}</Box>
          </Alert>
        ) : !sessionObj ? (
          <Alert status="info" borderRadius="md" fontSize="sm">
            <AlertIcon />
            <Box>
              No live timetable session found for {dept}. The department must mark a session as
              current before it can be viewed.
            </Box>
          </Alert>
        ) : !sem ? (
          <Alert status="info" borderRadius="md" fontSize="sm">
            <AlertIcon />
            <Box>
              Please select a semester from the dropdown to view the timetable.
            </Box>
          </Alert>
        ) : hasClasses ? (
          <>
            {sessionObj && !sessionObj.published && (
              <Alert status="warning" borderRadius="md" fontSize="sm" mb={4}>
                <AlertIcon />
                <Box>
                  This timetable has not been published yet, so it may still change.
                </Box>
              </Alert>
            )}

            {isSavedFallback && (
              <Alert status="info" borderRadius="md" fontSize="sm" mb={4}>
                <AlertIcon />
                <Box>
                  Showing active saved class schedule from the department timetable coordinator.
                </Box>
              </Alert>
            )}

            {lockedTime && (
              <HStack spacing={2} mb={4}>
                <TimeIcon color="green.500" />
                <Text fontSize="sm" fontWeight="semibold" color="green.600">
                  Last saved: {lockedTime}
                </Text>
              </HStack>
            )}

            {/* Official XCEED Timetable Grid protected by SafeChild */}
            <SafeChild title="Timetable Grid">
              <ViewTimetable timetableData={timetableData} />
            </SafeChild>

            {/* Official XCEED Timetable Summary protected by SafeChild */}
            <SafeChild title="Timetable Summary">
              {Array.isArray(subjectData) && subjectData.length > 0 ? (
                <TimetableSummary
                  timetableData={timetableData}
                  type={'sem'}
                  code={sessionObj.code}
                  time={lockedTime}
                  headTitle={sem}
                  subjectData={subjectData}
                  TTData={ttData}
                  notes={semNotes}
                />
              ) : (
                <Flex justify="center" align="center" p={4}>
                  <Spinner size="md" color="purple.500" mr={2} />
                  <Text color="lmFg.subtle" fontWeight="bold">
                    Loading Timetable Summary...
                  </Text>
                </Flex>
              )}
            </SafeChild>

            {/* Notes Section */}
            {semNotes && semNotes.length > 0 && (
              <Box
                mt={4}
                p={4}
                bg="lmHue.yellow50"
                borderRadius="md"
                borderWidth="1px"
                borderColor="lmHue.yellow200"
              >
                <Text fontSize="md" fontWeight="bold" color="lmHue.yellow800" mb={2}>
                  Notes:
                </Text>
                {semNotes.map((noteItem, index) => (
                  <UnorderedList key={index} color="lmHue.yellow700" spacing={1}>
                    {(Array.isArray(noteItem) ? noteItem : [noteItem]).map(
                      (note, noteIndex) => (
                        <ListItem key={noteIndex} fontSize="sm">
                          {typeof note === 'object' && note !== null
                            ? JSON.stringify(note)
                            : String(note || '')}
                        </ListItem>
                      ),
                    )}
                  </UnorderedList>
                ))}
              </Box>
            )}
          </>
        ) : (
          <Alert status="info" borderRadius="md" fontSize="sm">
            <AlertIcon />
            <Box>
              No timetable entries available for {dept} Semester {sem}.
            </Box>
          </Alert>
        )}
      </SectionCard>
    </Box>
  );
}

/**
 * The two schedules this page can show, in the order the control lays them out.
 *
 * `mine` was labelled "My Faculty Schedule", which named the role rather than
 * the schedule: everyone who can see the control is faculty, so the word was
 * carrying no information the user did not already have.
 */
const SCHEDULE_VIEWS = [
  { id: 'mine', label: 'My Schedule' },
  { id: 'student', label: 'Student Schedule' },
];

/**
 * Segmented control for switching between the two schedules.
 *
 * What stood here was a pair of ordinary buttons that read as a toggle only
 * because their `solid`/`outline` variants were swapped between the two
 * branches of the render — the selected one stayed a live button that set the
 * state it was already in, so half the control did nothing when clicked and
 * said nothing to a screen reader either.
 *
 * One attached group in a track states the selection once. `aria-pressed`
 * rather than `role="tablist"`, because these are toggle buttons and not a tab
 * widget: the panel below is the whole page, and a tablist would promise arrow
 * key navigation that nothing here implements.
 */
function ScheduleToggle({ value, onChange }) {
  return (
    <ButtonGroup
      size="sm"
      /* Deliberately not `isAttached`: it zeroes the inner border radii, which
         joins the two halves into one bar. The selected half should read as a
         pill sitting inside the track, so they stay rounded with a hairline gap. */
      spacing="2px"
      p="3px"
      bg="lmBg.track"
      borderRadius="lg"
      w={{ base: '100%', sm: 'auto' }}
      role="group"
      aria-label="Schedule view"
    >
      {SCHEDULE_VIEWS.map((view) => {
        const isSelected = value === view.id;
        return (
          <Button
            key={view.id}
            onClick={() => onChange(view.id)}
            aria-pressed={isSelected}
            /* Even split on a phone, content width once there is room for it. */
            flex={{ base: '1 1 0', sm: '0 0 auto' }}
            minW={0}
            px={{ base: 3, sm: 5 }}
            borderRadius="md"
            fontSize={{ base: 'xs', sm: 'sm' }}
            fontWeight="600"
            colorScheme={isSelected ? 'purple' : 'gray'}
            variant={isSelected ? 'solid' : 'ghost'}
            /* The module states its own button colour: a global
               `button { color: #fff }` in timetableadmin/Timetable.css matches
               these elements directly and would otherwise win. */
            color={isSelected ? 'lmFg.onAccent' : 'lmFg.subtle'}
            shadow={isSelected ? 'sm' : 'none'}
            _hover={isSelected ? undefined : { bg: 'lmBg.hover', color: 'lmFg.heading' }}
          >
            {view.label}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

/** Title, one line of context for whichever schedule is showing, and the toggle. */
function PageHeader({ isStudent, showMySchedule, onViewChange }) {
  const subtitle = isStudent
    ? 'Your weekly schedule of classes, from the department’s current session.'
    : showMySchedule
      ? 'Your own weekly teaching schedule for the current session.'
      : 'The weekly class schedule for a department and semester.';

  return (
    <Flex
      direction={{ base: 'column', md: 'row' }}
      justify="space-between"
      align={{ base: 'stretch', md: 'center' }}
      mb={{ base: 4, md: 5 }}
      gap={{ base: 3, md: 4 }}
    >
      <Box minW={0}>
        <Heading size={{ base: 'md', md: 'lg' }}>Timetable</Heading>
        <Text color="lmFg.muted" fontSize="sm" mt={1}>
          {subtitle}
        </Text>
      </Box>

      {/* Students have no teaching schedule behind the other half of the
          control, so they are given the semester timetable and no toggle. */}
      {!isStudent && (
        <ScheduleToggle
          value={showMySchedule ? 'mine' : 'student'}
          onChange={(id) => onViewChange(id === 'student')}
        />
      )}
    </Flex>
  );
}

/**
 * A labelled control in the filter row. Three of these were spelled out inline,
 * which is where the row's uneven label sizing and spacing came from.
 */
function FilterField({ label, children, ...rest }) {
  return (
    <Box minW={0} {...rest}>
      <Text fontSize="xs" color="lmFg.muted" mb={1} fontWeight="600">
        {label}
      </Text>
      {children}
    </Box>
  );
}
