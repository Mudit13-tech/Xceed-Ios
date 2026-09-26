import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Flex,
  Select,
  Progress,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Text,
  Tooltip,
  Tr,
  useToast,
} from '@chakra-ui/react';

import lmApi from '../api/lmApi';
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  SectionCard,
  StatTile,
  TableSkeleton,
} from '../components/common';
import { LmIcon } from '../components/Icon';

/**
 * Filling classrooms from the attendance module's subject register, on a page
 * of its own.
 *
 * The sync itself lives in services/rosterSync and is reachable from a card on
 * the admin console — a department box, a preview and a run. That card is the
 * right size for "do it now" and the wrong size for the question underneath it:
 * *which* classrooms have students waiting, and why the ones that do not, do
 * not. Forty classrooms is a table, not a paragraph.
 *
 * So this is the same two endpoints with somewhere to read them. Nothing here
 * decides anything the service does not: every count comes off `planRosterSync`
 * and every button runs `runRosterSync` over a subset of the plan it just
 * showed.
 *
 * ## The numbers, in the order somebody asks for them
 *
 *  - **On the register** — roll numbers against the subject in the attendance
 *    module.
 *  - **Already in** — of those, already members of the classroom.
 *  - **Can be added** — the rest, with an address to enrol them at.
 *  - **No email** — roll numbers with no student record, or a record with no
 *    address. Never enrolled at a guessed `<roll>@nitj.ac.in`: that guess is
 *    what had the old roll-number import switched off, and the reason each one
 *    carries is what somebody needs to go and fix.
 *
 * ## One table, a semester at a time
 *
 * Every classroom in the plan appears under the semester it was created in,
 * with a **Remarks** column saying what will happen to it and why — and the
 * button that fills a whole semester sits on that semester's heading, so what
 * it writes is what the reader is looking at.
 *
 * This was two tables, split by whether a classroom matched a subject, and the
 * split put the answer in the layout rather than on the row: "what is the state
 * of my fifth semester?" could only be answered by reading both and matching
 * them up by eye, and a classroom that matched but had nobody to add said
 * nothing at all. A classroom that matched nothing is not a different kind of
 * thing — it is one of that semester's classrooms with a remark against it.
 *
 * Its counts are dashes rather than zeroes. There is no register behind it to
 * count, and a zero would say the register is empty, which is a different fact
 * and one somebody would go looking for in the wrong place.
 *
 * ## Adding, and watching it happen
 *
 * Enrolling somebody is an account, a membership row and their own mail, and a
 * semester is hundreds of them. Held open as one request that is a button that
 * spins for minutes, and a run that says nothing is indistinguishable from a
 * run that is stuck.
 *
 * So both buttons start a **background run** and poll it. What is shown is not
 * a percentage: it is the phase, the counts, and a line per student naming who
 * went into which classroom and whether their mail left — which is what makes a
 * run quietly enrolling the wrong people visible while it happens.
 */

/* The one option that widens the read back to the whole institute. A value of
   its own rather than the empty string, so the select can have no blank choice
   at all — a placeholder here would be a way to run the expensive plan by
   clearing a dropdown, which is how this page came to hang in the first place. */
const ALL_DEPARTMENTS = '__all__';

/* Classrooms saved before the create form asked for a semester. They group
   under a heading of their own, and the whole-semester button is withheld
   there: "" is what the server reads as "every semester", so a run scoped to
   this heading would be scoped to nothing at all. */
const NO_SEMESTER = 'No semester recorded';

/* How often the console asks a running sync what it is doing. A student takes
   longer than this to enrol, so asking faster would be polling for its own
   sake, and the server keeps a bounded tail of lines — a poll that arrives late
   loses nothing but the oldest of them. */
const POLL_MS = 1000;

/* What the server is doing, in words rather than a percentage. A spinner and a
   bar both say "wait"; only these say whether waiting is warranted. */
const PHASE_LABEL = {
  planning: 'Matching classrooms',
  enrolling: 'Enrolling students',
  mailing: 'Mailing faculty',
  done: 'Finished',
  failed: 'Stopped',
};

const num = (value) => (value ?? 0).toLocaleString();

/**
 * The one line that says what will happen to this classroom, and why.
 *
 * The page used to say it by putting the row in one table or the other, which
 * meant the answer was in the layout rather than on the row — a classroom that
 * matched nothing sat in a second table with a "why" column, and one that
 * matched but had nobody to add said nothing at all. Both are now remarks
 * against the classroom, in the one table.
 *
 * Ordered by what a reader would act on first: something that cannot be fixed
 * from this page at all, then something waiting on them, then the ordinary
 * "there is nothing to do here".
 */
function remarkFor(entry) {
  if (!entry.matched) return entry.reason || 'Matched no subject in the attendance module';
  if (!entry.rosterSize) return 'The matched subject has no roll numbers against it';

  const notes = [];
  if (entry.wouldAdd) notes.push(`${num(entry.wouldAdd)} ready to add`);
  else if (entry.alreadyIn) notes.push('Everybody on the register is already in');
  if (entry.missingEmailCount) {
    notes.push(`${num(entry.missingEmailCount)} have no address on record`);
  }
  if (entry.previouslyRemoved?.length) {
    // Left alone on purpose — somebody took them out of this class, and putting
    // them back quietly is the one thing this feature must never do.
    notes.push(`${num(entry.previouslyRemoved.length)} removed earlier, left alone`);
  }
  if (entry.wouldFail) notes.push(`${num(entry.wouldFail)} would fail`);

  return notes.join(' · ') || '—';
}

/**
 * What the run is doing, while it does it.
 *
 * Deliberately not a bare percentage bar. A bar says how far along something is
 * and nothing about whether it is doing the right thing; these lines name the
 * student, the classroom they went into and whether their mail left, so an
 * administrator watching a run that is enrolling the wrong people can see it
 * happening rather than read about it afterwards.
 *
 * Newest first, because the interesting line is the one that just arrived and
 * scrolling to find it defeats the purpose.
 */
function RunProgress({ run }) {
  if (!run) return null;

  const total = run.total || 0;
  const completed = run.completed || 0;
  const failed = run.failed || 0;
  const finished = run.phase === 'done' || run.phase === 'failed';
  const events = [...(run.events || [])].reverse();

  return (
    <SectionCard
      mb={4}
      title={PHASE_LABEL[run.phase] || 'Working'}
      subtitle={run.error || run.message || ''}
      action={
        total ? (
          <Text fontSize="sm" fontWeight="600" color="lmFg.muted">
            {num(completed)} of {num(total)}
            {failed ? ` · ${num(failed)} failed` : ''}
          </Text>
        ) : null
      }
    >
      <Progress
        size="sm"
        borderRadius="full"
        mb={events.length ? 3 : 0}
        colorScheme={run.phase === 'failed' ? 'red' : 'purple'}
        /* Indeterminate until there is a total to be a fraction of. Planning
           has no count — it is one query over the classes in scope — and a bar
           sitting at 0% through it reads as a run that has stalled. */
        isIndeterminate={!total && !finished}
        value={total ? Math.round((completed / total) * 100) : 100}
      />

      {events.length > 0 && (
        <Box
          maxH="220px"
          overflowY="auto"
          borderWidth="1px"
          borderColor="lmBorder.base"
          borderRadius="md"
          p={2}
        >
          {events.map((event) => (
            <Text
              key={`${event.at}-${event.text}`}
              fontSize="xs"
              fontFamily="mono"
              color={event.ok ? 'lmFg.muted' : 'red.400'}
              py="1px"
            >
              {event.ok ? '·' : '×'} {event.text}
            </Text>
          ))}
        </Box>
      )}
    </SectionCard>
  );
}

function AddButton({ entry, busy, onAdd }) {
  if (!entry.rosterSize) {
    return (
      <Tooltip label="The matched subject has no roll numbers against it in the attendance module">
        <Text fontSize="xs" color="lmFg.faint">
          Empty register
        </Text>
      </Tooltip>
    );
  }

  if (!entry.wouldAdd) {
    return (
      <Text fontSize="xs" color="lmFg.muted">
        {entry.missingEmailCount ? 'Nobody addable' : 'All enrolled'}
      </Text>
    );
  }

  return (
    <Button size="xs" colorScheme="purple" isLoading={busy} loadingText="Adding" onClick={() => onAdd(entry)}>
      Add {entry.wouldAdd}
    </Button>
  );
}

export default function LmAdminRosterSync() {
  const toast = useToast();

  const [dept, setDept] = useState('');
  const [semester, setSemester] = useState('');

  const [options, setOptions] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyRow, setBusyRow] = useState(null);
  // The semester whose "Add all" is running, so only that button shows busy.
  const [busySemester, setBusySemester] = useState(null);
  // What the run in flight is doing, or the last one's final state until the
  // next run replaces it — a finished run's tally is worth reading after the
  // button has stopped spinning.
  const [progress, setProgress] = useState(null);

  /**
   * One department, chosen before anything is planned.
   *
   * Planning the whole institute compares every class against every subject and
   * then reads a roster and a membership list for each pair that matches. It is
   * minutes of work, and nobody asked for it by opening a page — so the console
   * opens on a single department and the institute-wide read is a deliberate
   * choice further down the dropdown.
   *
   * That is why the departments are fetched separately: to open on one, the
   * page has to know which ones exist, and asking the plan for that would run
   * the very thing being avoided. Two `distinct` reads, so it is immediate.
   */
  /* Asked again whenever the department changes, because the semesters belong
     to the department. "Semester 1" of a B.Tech and of an M.Tech are different
     semesters with different subjects, and the institute-wide list offered
     every degree's — most of them options that could not match a single class
     in the department being looked at. */
  useEffect(() => {
    let cancelled = false;
    lmApi
      .adminRosterSyncOptions(dept && dept !== ALL_DEPARTMENTS ? { dept } : {})
      .then((result) => {
        if (cancelled) return;
        setOptions(result);
        setDept((current) => current || result.departments?.[0] || ALL_DEPARTMENTS);
        // A semester this department does not teach filters to nothing and
        // reads as "no classes here", which is a different thing from the truth.
        setSemester((current) => (!current || result.semesters?.includes(current) ? current : ''));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dept]);

  const load = useCallback(async (scope) => {
    setLoading(true);
    setError(null);
    try {
      setData(await lmApi.adminRosterSyncPreview(scope));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Blank means "every department" to the server, which is what the admin
     console's own card sends. The console never sends it by accident: `dept` is
     empty only before the options have arrived, and this waits for them. */
  const scopeOf = (department, sem) => ({
    dept: department && department !== ALL_DEPARTMENTS ? department : undefined,
    semester: sem || undefined,
  });

  useEffect(() => {
    if (!dept) return;
    load(scopeOf(dept, semester));
  }, [load, dept, semester]);

  const refresh = () => load(scopeOf(dept, semester));

  const subjects = useMemo(() => data?.subjects || [], [data]);
  const unmatched = useMemo(() => data?.unmatched || [], [data]);
  const totals = data?.totals || {};

  const deptOptions = options?.departments || [];
  /* The semesters this department actually teaches, spelled exactly as the
     timetable's master list spells them — a class copies that value verbatim
     through the subject it was created from, so the option and the class hold
     the same string and the filter is an equality, not a guess.

     Read from the server rather than collected from the rows in view: those are
     already narrowed by the semester filter, so a list built from them would
     lose every option the moment one was picked. */
  const semesterOptions = options?.semesters || [];

  /**
   * Every classroom in the plan, under the semester it was created in.
   *
   * One table, not two. The page used to show the classrooms that matched a
   * subject in one table and the ones that matched nothing in another, and an
   * administrator reading it could not answer the question they came with —
   * "what is the state of my fifth semester?" — without reading both and
   * matching them up by eye. A classroom that matched nothing is not a separate
   * kind of thing; it is one of that semester's classrooms with a remark
   * against it.
   *
   * Grouped rather than sorted so a semester's totals mean something: the
   * button that fills a whole semester sits on the group it fills.
   */
  const semesterGroups = useMemo(() => {
    const groups = new Map();
    const into = (name, row) => {
      // A class saved before the create form asked for a semester. Grouped
      // under its own heading rather than dropped: it is somebody's classroom
      // and the reason it can never match is exactly what they need told.
      const key = name || NO_SEMESTER;
      if (!groups.has(key)) groups.set(key, { semester: key, rows: [] });
      groups.get(key).rows.push(row);
    };

    subjects.forEach((entry) => into(entry.semester, { ...entry, matched: true }));
    unmatched.forEach((entry) => into(entry.semester, { ...entry, matched: false }));

    return [...groups.values()]
      .map((group) => ({
        ...group,
        // "B.Tech-2" before "B.Tech-10", and a classroom with something to add
        // above one with nothing.
        rows: group.rows.sort(
          (a, b) =>
            (b.wouldAdd || 0) - (a.wouldAdd || 0) ||
            String(a.className || '').localeCompare(String(b.className || '')),
        ),
        addable: group.rows.reduce((sum, row) => sum + (row.wouldAdd || 0), 0),
        unmatched: group.rows.filter((row) => !row.matched).length,
      }))
      .sort((a, b) => a.semester.localeCompare(b.semester, undefined, { numeric: true }));
  }, [subjects, unmatched]);

  /**
   * Start a run and watch it, rather than holding a request open until it ends.
   *
   * Enrolling somebody is an account, a membership row and a mail, and a
   * semester is hundreds of them — minutes during which the old code showed a
   * spinning button and nothing else. A run that says nothing is
   * indistinguishable from a run that is stuck, which is exactly what was
   * reported.
   *
   * So the server hands back an id and this polls it. What comes back is not a
   * percentage: it is the phase, the counts, and a line per student naming who
   * went into which classroom and whether their mail left — so a run quietly
   * enrolling the wrong people is visible while it happens rather than
   * afterwards.
   *
   * Every second. Faster would be polling for its own sake — a student takes
   * longer than that to enrol — and the server holds a bounded tail of lines,
   * so a poll that arrives late loses nothing but the oldest of them.
   */
  /* Stops the poll loop when the page goes away. Without it a run that is
     still going keeps asking after the screen it was drawn on has gone —
     forever, since only `done` or `failed` ends the loop — and each answer
     writes state into a component that no longer exists. */
  const live = useRef(true);
  useEffect(() => () => {
    live.current = false;
  }, []);

  const watchRun = useCallback(
    async (scope) => {
      const { runId } = await lmApi.adminRosterSyncRun({ ...scope, background: true });
      if (!runId) throw new Error('The server did not start a run.');

      setProgress({ phase: 'planning', message: 'Starting…', completed: 0, total: 0, events: [] });

      while (live.current) {
        /* Asked before the first wait, not after it. One classroom can be done
           inside a second, and sleeping first would spend that second showing
           "Starting…" for a run that had already finished. */
        // eslint-disable-next-line no-await-in-loop
        const status = await lmApi.adminRosterSyncRunStatus(runId);
        if (!live.current) break;
        setProgress(status);

        if (status.phase === 'failed') throw new Error(status.error || 'The run failed.');
        if (status.phase === 'done') return status.result || {};

        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }

      /* Only reachable once the page has gone. The run carries on server-side —
         it is not the page's to cancel — so this says nothing happened here,
         not that nothing happened. */
      return {};
    },
    [],
  );

  const addOne = async (entry) => {
    setBusyRow(entry.classId);
    try {
      const outcome = await watchRun({ classId: entry.classId });
      /* Nothing to say to a screen that has gone, and `refresh` would be a read
         whose answer lands nowhere. The run itself is server-side and carried
         on regardless. */
      if (!live.current) return;
      const added = outcome?.totals?.added ?? outcome?.added ?? 0;
      toast({
        status: 'success',
        title: `${entry.className}: ${num(added)} added`,
        duration: 6000,
      });
      await refresh();
    } catch (err) {
      if (live.current) {
        toast({ status: 'error', title: `${entry.className}: ${err.message}`, duration: 8000 });
      }
    } finally {
      setBusyRow(null);
    }
  };

  /* Named, never "everything on this page". The run is scoped to the semester
     whose heading the button sits under and to the department in the filter, so
     what it writes is what that section shows. A button that meant "every class
     currently listed" would mean something different depending on a dropdown
     several inches away, and with no semester chosen it would be an
     institute-wide write behind one click — the card on the admin console is
     where a deliberate whole-institute run belongs. */
  const addSemester = async (target) => {
    setBusySemester(target);
    try {
      const outcome = await watchRun({
        dept: dept && dept !== ALL_DEPARTMENTS ? dept : undefined,
        semester: target,
      });
      if (!live.current) return;
      const added = outcome?.totals?.added ?? outcome?.added ?? 0;
      const failed = outcome?.totals?.failed ?? 0;
      const mailed = outcome?.totals?.studentsMailed ?? 0;
      const facultyMailed = outcome?.totals?.facultyMailed ?? 0;
      /* Both halves of the mail, because they fail independently and did: the
         students were being told while their teachers were not, and a summary
         that said only "mailed" would have read as though both had gone. */
      const unreachable = outcome?.totals?.facultyUnreachable ?? 0;
      toast({
        status: failed || unreachable ? 'warning' : 'success',
        title: `${num(added)} students added across ${target}`,
        description: [
          `${num(mailed)} students and ${num(facultyMailed)} faculty were mailed.`,
          unreachable ? `${num(unreachable)} faculty could not be told.` : '',
          failed ? `${num(failed)} could not be enrolled.` : '',
        ]
          .filter(Boolean)
          .join(' '),
        duration: 8000,
      });
      await refresh();
    } catch (err) {
      if (live.current) toast({ status: 'error', title: err.message, duration: 8000 });
    } finally {
      setBusySemester(null);
    }
  };

  if (error) return <ErrorState error={error} onRetry={refresh} />;

  return (
    <Box>
      <PageHeader
        title="Fill classrooms from the subject register"
        subtitle="Which classrooms have students waiting in the attendance module, how many are already enrolled, and who cannot be added at all."
        action={
          <Button as={RouterLink} to="/learning/lm-admin" size="sm" variant="outline">
            ← Admin console
          </Button>
        }
      />

      <Flex gap={2} wrap="wrap" mb={4} align="center">
        <Select
          size="sm"
          maxW="260px"
          value={dept}
          onChange={(event) => setDept(event.target.value)}
          aria-label="Department"
          isDisabled={!options}
        >
          {deptOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          {/* Last, and named for what it costs. Reading every department
              compares every class against every subject; it is a thing to ask
              for, not to land on. */}
          <option value={ALL_DEPARTMENTS}>Every department (slow)</option>
        </Select>
        <Select
          size="sm"
          maxW="180px"
          value={semester}
          onChange={(event) => setSemester(event.target.value)}
          placeholder="All semesters"
          aria-label="Filter by semester"
        >
          {semesterOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Box flex="1" />

        <Button size="sm" variant="outline" onClick={refresh} isDisabled={loading}>
          Refresh
        </Button>
      </Flex>

      <RunProgress run={progress} />

      {loading ? (
        <Loading label="Reading the register…" skeleton={<TableSkeleton rows={8} columns={7} />} />
      ) : (
        <>
          <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4} mb={5}>
            <StatTile label="Classrooms" value={num(totals.classes)} hint={`${num(totals.unmatched)} matched nothing`} />
            <StatTile label="Can be added" value={num(totals.wouldAdd)} accent="purple.500" />
            <StatTile
              label="No email on record"
              value={num(totals.missingEmail)}
              hint="cannot be enrolled anywhere"
              accent="orange.500"
            />
            <StatTile label="Would fail" value={num(totals.wouldFail)} accent="red.500" />
            <StatTile
              label="Previously removed"
              value={num(totals.previouslyRemoved)}
              hint="taken out of a class, left alone"
              accent="gray.500"
            />
          </SimpleGrid>

          {semesterGroups.length === 0 ? (
            <SectionCard title="Classrooms">
              <EmptyState
                icon="empty"
                title="No classrooms here"
                description="Nothing was found for this department and semester. Widen the filters above."
              />
            </SectionCard>
          ) : (
            semesterGroups.map((group) => (
              <SectionCard
                key={group.semester}
                mt={4}
                title={group.semester}
                subtitle={`${num(group.rows.length)} classroom${group.rows.length === 1 ? '' : 's'}${
                  group.unmatched ? ` · ${num(group.unmatched)} matched no subject` : ''
                }`}
                action={
                  /* The count is on the button because the button writes:
                     nobody should have to add up a column to know what they are
                     about to do. */
                  <Button
                    size="sm"
                    colorScheme="purple"
                    isDisabled={!group.addable || group.semester === NO_SEMESTER}
                    isLoading={busySemester === group.semester}
                    loadingText="Adding"
                    onClick={() => addSemester(group.semester)}
                    leftIcon={<LmIcon name="people" size={15} />}
                  >
                    Add all{group.addable ? ` (${num(group.addable)})` : ''}
                  </Button>
                }
              >
                <Box overflowX="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Class / Subject</Th>
                        <Th>Dept</Th>
                        <Th>Faculty</Th>
                        <Tooltip label="Roll numbers against this subject in the attendance module" placement="top">
                          <Th isNumeric cursor="help">On register</Th>
                        </Tooltip>
                        <Tooltip label="Already members of this classroom" placement="top">
                          <Th isNumeric cursor="help">Already in</Th>
                        </Tooltip>
                        <Tooltip label="On the register, not in the class, and with an address to enrol them at" placement="top">
                          <Th isNumeric cursor="help">Can add</Th>
                        </Tooltip>
                        <Tooltip label="No student record, or a record with no address — cannot be enrolled" placement="top">
                          <Th isNumeric cursor="help">No email</Th>
                        </Tooltip>
                        <Th>Remarks</Th>
                        <Th />
                      </Tr>
                    </Thead>
                    <Tbody>
                      {group.rows.map((entry) => (
                        <Tr key={entry.classId} _hover={{ bg: 'lmBg.hover' }}>
                          <Td>
                            <Text fontSize="sm" fontWeight="600">
                              {entry.className}
                            </Text>
                            <Text fontSize="xs" color="lmFg.muted">
                              {[entry.subjectCode, entry.subject].filter(Boolean).join(' · ')}
                            </Text>
                          </Td>
                          <Td fontSize="xs">{entry.dept || '—'}</Td>
                          <Td fontSize="xs">{entry.facultyName || '—'}</Td>
                          {/* A classroom that matched no subject has no register
                              to count. A dash says that; a zero would say the
                              register is empty, which is a different fact and
                              one somebody would go looking for in the wrong
                              place. */}
                          {entry.matched ? (
                            <>
                              <Td isNumeric fontSize="sm">{num(entry.rosterSize)}</Td>
                              <Td isNumeric fontSize="sm" color="lmFg.muted">{num(entry.alreadyIn)}</Td>
                              <Td isNumeric fontSize="sm" fontWeight={entry.wouldAdd ? '700' : '400'}>
                                {num(entry.wouldAdd)}
                              </Td>
                              <Td isNumeric>
                                {entry.missingEmailCount ? (
                                  /* The reason, not just the count: "no student
                                     record" and "record with no address" are
                                     fixed in different places by different
                                     people. */
                                  <Tooltip
                                    label={entry.missingEmail
                                      .map((row) => `${row.rollNo} — ${row.reason}`)
                                      .join('\n')}
                                    placement="top"
                                    whiteSpace="pre-line"
                                  >
                                    <Badge colorScheme="orange" cursor="help">
                                      {num(entry.missingEmailCount)}
                                    </Badge>
                                  </Tooltip>
                                ) : (
                                  <Text fontSize="sm" color="lmFg.faint">0</Text>
                                )}
                              </Td>
                            </>
                          ) : (
                            <>
                              <Td isNumeric color="lmFg.faint">—</Td>
                              <Td isNumeric color="lmFg.faint">—</Td>
                              <Td isNumeric color="lmFg.faint">—</Td>
                              <Td isNumeric color="lmFg.faint">—</Td>
                            </>
                          )}
                          <Td fontSize="xs" color="lmFg.muted" maxW="260px" whiteSpace="normal">
                            {remarkFor(entry)}
                          </Td>
                          <Td textAlign="right">
                            {entry.matched ? (
                              <AddButton entry={entry} busy={busyRow === entry.classId} onAdd={addOne} />
                            ) : null}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </SectionCard>
            ))
          )}
        </>
      )}
    </Box>
  );
}
