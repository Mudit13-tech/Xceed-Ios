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
  Select,
  Spinner,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { SectionCard } from '../components/common';
import TimetableGrid from '../components/TimetableGrid';
import TimetableWidget from '../components/TimetableWidget';
import { isStudentOnly } from '../roles';

/**
 * The timetable tab.
 *
 * ## What was wrong for students
 *
 * The widget this replaces passed the class's *department* where the timetable API
 * wanted a **session code**, so `ClassTable.find({ sem, code: "ECE" })` matched
 * nothing and every student saw "No timetable available" with no explanation. It
 * also read `classes[0]` — whichever class happened to be touched most recently —
 * so even with the right parameter it would have been the right timetable only by
 * luck.
 *
 * ## Department and semester
 *
 * Both are dropdowns, pre-filled from the student's own enrolments: the server
 * counts their subjects per (department, semester) and suggests the group with the
 * most. Five ECE-6 subjects and one ME elective opens the ECE-6 timetable. It is a
 * default, not a lock — a student whose enrolments are incomplete, or who wants to
 * look at another semester, changes either dropdown.
 *
 * The lists come from sessions that are actually current, and the semesters from
 * grids that actually exist, so every combination the dropdowns offer can be
 * fetched. Offering an empty one is how a student concludes the page is broken.
 *
 * ## Faculty
 *
 * Left on the existing widget. A faculty timetable is keyed by name against the
 * session rather than by department and semester, that path already resolved its
 * session correctly, and it was not what was reported. Rewriting it here would be
 * changing something that works.
 */
export default function Timetable() {
  const { me } = useOutletContext();
  const isStudent = isStudentOnly(me?.roles);

  const [options, setOptions] = useState(null);
  const [dept, setDept] = useState('');
  const [sem, setSem] = useState('');
  const [grid, setGrid] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [error, setError] = useState(null);

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
        // Pre-filled from the count. Falls back to the first department that has a
        // live session, so the dropdowns are never both empty on a student whose
        // classes carry no department yet.
        setDept(fetched.suggested?.dept || fetched.depts?.[0] || '');
        setSem(fetched.suggested?.sem || '');
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

  /**
   * Keep the semester answerable when the department changes.
   *
   * Semester 7 exists in one department and not another, and leaving a stale value
   * selected produces a confident "not filled in" for a combination that was never
   * offered. So it moves to the suggestion where that fits this department, and
   * otherwise to the first semester the department actually has.
   */
  useEffect(() => {
    if (!semsForDept.length) return;
    if (semsForDept.includes(sem)) return;
    const suggested = options?.suggested;
    setSem(suggested && suggested.dept === dept && semsForDept.includes(suggested.sem)
      ? suggested.sem
      : semsForDept[0]);
  }, [dept, semsForDept, sem, options]);

  const loadGrid = useCallback(async () => {
    if (!dept || !sem) return;
    setLoadingGrid(true);
    setError(null);
    try {
      setGrid(await lmApi.timetableGrid(dept, sem));
    } catch (err) {
      setError(err.message);
      setGrid(null);
    } finally {
      setLoadingGrid(false);
    }
  }, [dept, sem]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

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

  return (
    <Box>
      <Header />

      <SectionCard mb={4}>
        <Flex gap={3} align="flex-end" wrap="wrap">
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
              {!options?.depts?.length && <option value="">No live timetable sessions</option>}
              {(options?.depts || []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Box>

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

          <Button size="sm" onClick={loadGrid} isLoading={loadingGrid} variant="outline">
            Refresh
          </Button>

          {/* Why it opened where it did. A student looking at the wrong timetable can
              see the reasoning instead of assuming the page is broken — and the
              reasoning is usually that a class is missing its department. */}
          {suggestion && (
            <Tooltip
              label={
                basis.length
                  ? basis
                    .map((row) => `${row.dept} sem ${row.sem}: ${row.subjects} subject(s)`)
                    .join('\n')
                  : 'No enrolled class carries a department and semester yet.'
              }
              whiteSpace="pre-line"
            >
              <Badge colorScheme="purple" alignSelf="center" cursor="help">
                from your {options.enrolledCount} class{options.enrolledCount === 1 ? '' : 'es'}
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
          grid?.found
            ? `${grid.dept} · Semester ${grid.sem}${grid.session?.session ? ` · ${grid.session.session}` : ''}`
            : 'Weekly Timetable'
        }
      >
        {loadingOptions || loadingGrid ? (
          <VStack py={8} spacing={3}>
            <Spinner color="purple.500" />
            <Text color="lmFg.muted" fontSize="sm">
              Loading your timetable…
            </Text>
          </VStack>
        ) : error ? (
          <Alert status="error" borderRadius="md" fontSize="sm">
            <AlertIcon />
            <Box>{error}</Box>
          </Alert>
        ) : grid?.found ? (
          <>
            {grid.session && !grid.session.published && (
              // Worth saying: an unpublished session is a draft the department is
              // still editing, and a student comparing it with a noticeboard needs
              // to know which one to trust.
              <Alert status="warning" borderRadius="md" fontSize="sm" mb={3}>
                <AlertIcon />
                <Box>This timetable has not been published yet, so it may still change.</Box>
              </Alert>
            )}
            <TimetableGrid days={grid.days} slots={grid.slots} cells={grid.cells} />
          </>
        ) : (
          <Alert status="info" borderRadius="md" fontSize="sm">
            <AlertIcon />
            <Box>{grid?.message || 'No timetable available for that department and semester.'}</Box>
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
