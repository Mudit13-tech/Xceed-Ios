import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  ListItem,
  Select,
  Spinner,
  Text,
  Tooltip,
  UnorderedList,
  VStack,
} from '@chakra-ui/react';
import { TimeIcon } from '@chakra-ui/icons';
import lmApi from '../api/lmApi';
import getEnvironment from '../../getenvironment';
import { SectionCard } from '../components/common';
import ViewTimetable from '../../timetableadmin/viewtt';
import TimetableSummary from '../../timetableadmin/ttsummary';
import { generateInitialTimetableData } from '../../timetableadmin/timetableDataHelpers';
import TimetableWidget from '../components/TimetableWidget';
import { isStudentOnly } from '../roles';

/**
 * The timetable tab.
 *
 * ## Student Timetable View (Issue #2065)
 *
 * Uses the official XCEED timetable design (`ViewTimetable` + `TimetableSummary` + notes)
 * from https://xceed.nitj.ac.in/timetable.
 *
 * - Auto-detects the student's primary registered department and semester from active enrolments.
 * - Handles normalization of raw batch/section names (e.g., "B.Tech-ICE-SectionA6" -> "6") so
 *   the dropdown always selects a valid timetable semester.
 * - Provides a "My Registered Semesters" quick dropdown as well as full Department and Semester
 *   selectors to view any registered or departmental semester timetable.
 * - Shows the official colored period badges, period timings (8:30 AM - 5:25 PM), lunch break,
 *   course credit breakdown, and coordinator notes.
 *
 * ## Faculty Timetable View
 *
 * Uses `TimetableWidget`, keyed by faculty name against the active session.
 */
export default function Timetable() {
  const { me } = useOutletContext();
  const isStudent = isStudentOnly(me?.roles);

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

  const apiUrl = getEnvironment();

  /* Which timetable is theirs, and what else they could pick. */
  useEffect(() => {
    if (!isStudent) {
      setLoadingOptions(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const fetched = await lmApi.timetableOptions();
        if (cancelled) return;
        setOptions(fetched);

        const validDepts = fetched.depts || [];
        const semsMap = fetched.semsByDept || {};

        // Resolve initial department
        let initialDept = '';
        if (fetched.suggested?.dept && validDepts.includes(fetched.suggested.dept)) {
          initialDept = fetched.suggested.dept;
        } else if (validDepts.length > 0) {
          initialDept = validDepts[0];
        }

        // Resolve initial semester for that department
        const availableSems = semsMap[initialDept] || [];
        let initialSem = '';
        if (fetched.suggested?.sem && availableSems.includes(fetched.suggested.sem)) {
          initialSem = fetched.suggested.sem;
        } else {
          // Normalize if suggested sem is a batch/section code like "B.Tech-ICE-SectionA6"
          const digit = String(fetched.suggested?.sem || '').match(/\d+/)?.[0];
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
  }, [isStudent]);

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

    // Check if the current sem or suggested sem number matches an available semester
    const digit = String(sem || options?.suggested?.sem || '').match(/\d+/)?.[0];
    if (digit && semsForDept.includes(digit)) {
      setSem(digit);
    } else {
      setSem(semsForDept[0]);
    }
  }, [dept, semsForDept, sem, options]);

  /**
   * Load the locked class timetable and subject summary for the chosen dept & sem.
   */
  const loadTimetable = useCallback(async () => {
    if (!dept || !sem) {
      setTimetableData({});
      setSubjectData([]);
      setTTData(null);
      setSemNotes([]);
      setLockedTime('');
      return;
    }
    const currentCode = sessionObj?.code;
    if (!currentCode) {
      setTimetableData({});
      setSubjectData([]);
      setTTData(null);
      setSemNotes([]);
      setLockedTime('');
      return;
    }

    setLoadingTT(true);
    setError(null);

    try {
      // 1. Fetch locked timetable
      const ttPromise = fetch(
        `${apiUrl}/timetablemodule/lock/lockclasstt/${currentCode}/${sem}`,
        { credentials: 'include' },
      ).then((res) => (res.ok ? res.json() : null));

      // 2. Fetch subject details for summary
      const subPromise = fetch(
        `${apiUrl}/timetablemodule/subject/subjectdetails/${currentCode}`,
        { credentials: 'include' },
      ).then((res) => (res.ok ? res.json() : []));

      // 3. Fetch timetable all details
      const detailsPromise = fetch(
        `${apiUrl}/timetablemodule/timetable/alldetails/${currentCode}`,
        { credentials: 'include' },
      ).then((res) => (res.ok ? res.json() : null));

      // 4. Fetch locked time
      const timePromise = fetch(
        `${apiUrl}/timetablemodule/lock/viewsem/${currentCode}`,
        { credentials: 'include' },
      ).then((res) => (res.ok ? res.json() : null));

      const [ttResult, subResult, detailsResult, timeResult] = await Promise.all([
        ttPromise,
        subPromise,
        detailsPromise,
        timePromise,
      ]);

      if (ttResult) {
        const rawData = ttResult.timetableData || ttResult;
        const initialData = generateInitialTimetableData(rawData, 'sem');
        setTimetableData(initialData);
        setSemNotes(ttResult.notes || []);
      } else {
        setTimetableData({});
        setSemNotes([]);
      }

      setSubjectData(Array.isArray(subResult) ? subResult : []);
      setTTData(detailsResult);
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
    loadTimetable();
  }, [loadTimetable]);

  if (!isStudent) {
    return (
      <Box>
        <Header />
        <SectionCard title="Weekly Timetable">
          <TimetableWidget me={me} />
        </SectionCard>
      </Box>
    );
  }

  const basis = options?.basis || [];
  const suggestion = options?.suggested;

  // Normalized registered semester options
  const registeredOptions = useMemo(() => {
    if (!basis.length || !options) return [];
    const validDepts = options.depts || [];
    const semsMap = options.semsByDept || {};

    return basis.map((item) => {
      // Find matching live department
      const matchedDept =
        validDepts.find(
          (d) =>
            d.toLowerCase() === item.dept.toLowerCase() ||
            d.toLowerCase().includes(item.dept.toLowerCase()) ||
            item.dept.toLowerCase().includes(d.toLowerCase()),
        ) || item.dept;

      // Find matching valid semester in that department
      const availableSems = semsMap[matchedDept] || [];
      let matchedSem = item.sem;
      if (!availableSems.includes(matchedSem)) {
        const digit = String(item.sem).match(/\d+/)?.[0];
        if (digit && availableSems.includes(digit)) {
          matchedSem = digit;
        } else if (availableSems.length > 0) {
          matchedSem = availableSems[0];
        }
      }

      const isPrimary =
        suggestion?.dept === item.dept &&
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
  const isRegisteredMatch = registeredOptions.some(
    (r) => r.key === currentSelectionKey,
  );

  return (
    <Box>
      <Header />

      <SectionCard mb={4}>
        <Flex gap={3} align="flex-end" wrap="wrap">
          {/* Quick picker for student's registered semesters */}
          {registeredOptions.length > 0 && (
            <Box minW={{ base: '100%', md: '260px' }} flex="1 1 260px">
              <Text fontSize="xs" color="lmFg.muted" mb={1} fontWeight="600">
                My Registered Semesters
              </Text>
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
            </Box>
          )}

          {/* Department selector */}
          <Box minW="150px" flex="1 1 150px">
            <Text fontSize="xs" color="lmFg.muted" mb={1} fontWeight="600">
              Department
            </Text>
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
          </Box>

          {/* Semester selector */}
          <Box minW="120px" flex="0 1 140px">
            <Text fontSize="xs" color="lmFg.muted" mb={1} fontWeight="600">
              Semester
            </Text>
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
          </Box>

          <Button
            size="sm"
            onClick={loadTimetable}
            isLoading={loadingTT}
            variant="outline"
          >
            Refresh
          </Button>

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
              <Badge colorScheme="purple" alignSelf="center" cursor="help">
                from your {options.enrolledCount} class
                {options.enrolledCount === 1 ? '' : 'es'}
              </Badge>
            </Tooltip>
          )}
        </Flex>

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

            {lockedTime && (
              <HStack spacing={2} mb={4}>
                <TimeIcon color="green.500" />
                <Text fontSize="sm" fontWeight="semibold" color="green.600">
                  Last saved: {lockedTime}
                </Text>
              </HStack>
            )}

            {/* Official XCEED Timetable Grid */}
            <ViewTimetable timetableData={timetableData} />

            {/* Official XCEED Timetable Summary */}
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
                <Text color="gray.600" fontWeight="bold">
                  Loading Timetable Summary...
                </Text>
              </Flex>
            )}

            {/* Notes Section */}
            {semNotes && semNotes.length > 0 && (
              <Box
                mt={4}
                p={4}
                bg="yellow.50"
                borderRadius="md"
                borderWidth="1px"
                borderColor="yellow.200"
              >
                <Text fontSize="md" fontWeight="bold" color="yellow.800" mb={2}>
                  Notes:
                </Text>
                {semNotes.map((noteArray, index) => (
                  <UnorderedList key={index} color="yellow.700" spacing={1}>
                    {(Array.isArray(noteArray) ? noteArray : [noteArray]).map(
                      (note, noteIndex) => (
                        <ListItem key={noteIndex} fontSize="sm">
                          {note}
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

function Header() {
  return (
    <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
      <Box>
        <Heading size="lg">Timetable</Heading>
        <Text color="lmFg.muted" fontSize="sm">
          Your weekly schedule of classes, from the department&rsquo;s current session.
        </Text>
      </Box>
    </Flex>
  );
}
