import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  Link as RouterLinkStyle,
  Select,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

import lmApi from '../api/lmApi';
import { csvFilename, exportCsv } from '../csv';
import { EmptyState, ErrorState, Loading, SectionCard, StatTile, StatTileSkeleton } from '../components/common';
import {
  ActivityTrendChart,
  DonutChart,
  ProportionBar,
  SemesterCohortChart,
  SemesterContentChart,
  SemesterEngagementChart,
  SemesterOutcomeChart,
} from '../components/hodCharts';
import { useChartTheme } from '../chartTheme';

/**
 * HOD Dashboard — what a department looks like right now, and how it got here.
 *
 * Four questions, in the order a head of department asks them:
 *
 *  1. How big is the department, and how much of it is actually running? —
 *     the headline tiles and the coverage bars.
 *  2. How does it break down by semester? — the semester charts and the
 *     semester table, because a semester is the unit a department plans in.
 *  3. Where is it going? — six months of publishing against six months of
 *     students doing the work.
 *  4. Which classroom is which? — the per-class table, unchanged in spirit.
 *
 * Deliberately not a ranking. It used to sort classes by a weighted "activity
 * score" and hang medals off the top three, which reads as a league table of the
 * faculty who own those classes — a single invented number standing in for how
 * well somebody teaches. Everything added since keeps that rule: the numbers are
 * counts and rates that name their own units, faculty are never ordered against
 * each other, and where a figure is about a colleague ("faculty running a
 * classroom") it is a coverage number the HOD can act on, not a score.
 *
 * Filters: department, semester and session, applied once at the top and honoured
 * by every tile, chart and table below. A head of department is scoped to their
 * own department by the server, and the department dropdown is then a fixed
 * label rather than a choice.
 */

/** One number cell — shows 0 in a muted colour so active counts stand out. */
function CountCell({ value }) {
  return (
    <Text fontSize="sm" color={value > 0 ? 'lmFg.body' : 'lmFg.subtle'} fontVariantNumeric="tabular-nums">
      {value}
    </Text>
  );
}

/** A rate cell — an em dash where there is nothing to take a percentage of. */
function RateCell({ value }) {
  return (
    <Text
      fontSize="sm"
      color={value == null ? 'lmFg.faint' : 'lmFg.body'}
      fontVariantNumeric="tabular-nums"
    >
      {value == null ? '—' : `${value}%`}
    </Text>
  );
}

const STATUS_STYLE = {
  active: { colorScheme: 'green', label: 'Active' },
  archived: { colorScheme: 'gray', label: 'Archived' },
  completed: { colorScheme: 'blue', label: 'Completed' },
};

/** A chart in a card, with the sentence that says how to read it. */
function ChartCard({ title, subtitle, children }) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      <Box mt={1}>{children}</Box>
    </SectionCard>
  );
}

export default function LmAdminHodDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dept, setDept] = useState('');
  const [semester, setSemester] = useState('');
  const [session, setSession] = useState('');
  const { series } = useChartTheme();

  const load = useCallback(async (deptValue, sem, sess) => {
    setLoading(true);
    setError(null);
    try {
      setData(await lmApi.getHodDashboard({ dept: deptValue, semester: sem, session: sess }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(dept, semester, session);
  }, [load, dept, semester, session]);

  // Memoised so the rollups below do not recompute on every render: a fresh
  // `[]` from the fallback is a new array each time and would defeat them.
  const classes = useMemo(() => data?.classes ?? [], [data]);
  const totals = data?.totals ?? {};

  /* The department's content mix, summed from the rows in view rather than
     asked of the server a second time — the table is already the truth of what
     is on screen, and a second source could disagree with it. */
  const contentMix = useMemo(() => {
    const sum = (pick) => classes.reduce((acc, c) => acc + pick(c), 0);
    return [
      { name: 'Posts', value: sum((c) => c.activity.posts) },
      { name: 'Shorts', value: sum((c) => c.activity.shorts) },
      { name: 'Quizzes', value: sum((c) => c.activity.quizzes) },
      { name: 'Coding', value: sum((c) => c.activity.coding) },
      { name: 'Forms', value: sum((c) => c.activity.forms) },
    ];
  }, [classes]);

  const statusMix = useMemo(
    () => [
      { name: 'Active', value: totals.active ?? 0, color: series[2] },
      { name: 'Completed', value: totals.completed ?? 0, color: series[0] },
      { name: 'Archived', value: totals.archived ?? 0, color: series[4] },
    ],
    [totals.active, totals.completed, totals.archived, series],
  );

  const handleDeptChange = (e) => setDept(e.target.value);
  const handleSemesterChange = (e) => setSemester(e.target.value);
  const handleSessionChange = (e) => setSession(e.target.value);

  if (loading) {
    return (
      <VStack align="stretch" spacing={6}>
        <Box>
          <Text fontSize="xl" fontWeight="700" color="lmFg.heading">
            HOD Activity Dashboard
          </Text>
          <Text fontSize="sm" color="lmFg.muted">
            Semester-wise class activity ranked by engagement.
          </Text>
        </Box>
        <SimpleGrid columns={{ base: 3, md: 6 }} spacing={3}>
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
        </SimpleGrid>
        <Loading label="Loading HOD dashboard…" minH="120px" />
      </VStack>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => load(dept, semester, session)} />;

  const { filters, scope = {}, semesters = [], trend = [] } = data;
  /* An HOD cannot widen the scope, so a head of one department is shown that
     department as a fact rather than offered a dropdown that would silently
     ignore every other option. A head of two — which happens during a vacancy —
     still gets a dropdown, but one holding only the departments they head. */
  const headedDepartments = scope.departments || [];
  const deptLocked = Boolean(scope.locked) && headedDepartments.length <= 1;
  const deptOptions = scope.locked ? headedDepartments : (filters.departments || []);
  const filtered = Boolean(dept || semester || session);
  const windowDays = totals.engagementWindowDays ?? 30;
  const totalContent = contentMix.reduce((sum, slice) => sum + slice.value, 0);

  /* Both tables download exactly what is on screen — the same rows in the same
     order, under the filters in force — because a spreadsheet that disagrees
     with the page it came from is worse than no spreadsheet. The filename
     carries the department and the filters for the same reason: these files end
     up in a folder together. */
  const exportSemesters = () => {
    exportCsv(
      csvFilename('semesters', scope.dept, semester && `sem-${semester}`, session),
      [
        'Semester', 'Classes', 'Faculty', 'Enrolled', `Active (${windowDays}d)`,
        'Engaged %', 'Content items', 'Classwork', 'Handed in', 'On time %',
        'Marked %', 'Quiz attempts', 'Avg quiz %', 'Pass rate %',
      ],
      semesters.map((s) => [
        s.label,
        s.classes,
        s.faculty,
        s.enrolments,
        s.activeStudents,
        s.engagementRate ?? '',
        s.content,
        s.coursework,
        s.submissions.turnedIn,
        s.submissions.onTimeRate ?? '',
        s.submissions.gradedRate ?? '',
        s.quiz.attempts,
        s.quiz.avgPercent ?? '',
        s.quiz.passRate ?? '',
      ]),
    );
  };

  const exportClasses = () => {
    exportCsv(
      csvFilename('classrooms', scope.dept, semester && `sem-${semester}`, session),
      [
        'Class', 'Subject', 'Subject code', 'Section', 'Faculty', 'Faculty email',
        'Department', 'Semester', 'Session', 'Status', 'Students',
        `Active (${windowDays}d)`, 'Posts', 'Shorts', 'Quizzes', 'Coding', 'Forms',
        'Classwork', 'Handed in', 'Marked', 'Late', 'Avg grade %', 'Quiz attempts',
        'Avg quiz %',
      ],
      classes.map((cls) => [
        cls.name,
        cls.subject,
        cls.subjectCode,
        cls.section,
        cls.ownerName,
        cls.ownerEmail,
        cls.dept,
        cls.semester,
        cls.session,
        cls.status,
        cls.studentCount,
        cls.activeStudents ?? 0,
        cls.activity.posts,
        cls.activity.shorts,
        cls.activity.quizzes,
        cls.activity.coding,
        cls.activity.forms,
        cls.coursework ?? 0,
        cls.submissions?.turnedIn ?? 0,
        cls.submissions?.graded ?? 0,
        cls.submissions?.late ?? 0,
        cls.submissions?.avgGradePercent ?? '',
        cls.quiz?.attempts ?? 0,
        cls.quiz?.avgPercent ?? '',
      ]),
    );
  };

  const filterBar = (
    <Flex gap={2} wrap="wrap">
      {deptLocked ? (
        <Badge colorScheme="purple" borderRadius="full" px={3} py={1} alignSelf="center">
          {scope.dept}
        </Badge>
      ) : (
        <Select
          size="sm"
          maxW="200px"
          value={dept}
          onChange={handleDeptChange}
          placeholder={scope.locked ? 'Both my departments' : 'All departments'}
        >
          {deptOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      )}
      <Select
        size="sm"
        maxW="180px"
        value={semester}
        onChange={handleSemesterChange}
        placeholder="All semesters"
      >
        {filters.semesters.map((s) => (
          <option key={s} value={s}>
            Semester {s}
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        maxW="180px"
        value={session}
        onChange={handleSessionChange}
        placeholder="All sessions"
      >
        {filters.sessions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      {filtered && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setDept(''); setSemester(''); setSession(''); }}
        >
          Clear
        </Button>
      )}
    </Flex>
  );

  return (
    <VStack align="stretch" spacing={6}>
      {/* Header */}
      <Box>
        <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
          <Box>
            <Text fontSize="xl" fontWeight="700" color="lmFg.heading">
              HOD Dashboard
            </Text>
            <Text fontSize="sm" color="lmFg.muted">
              {scope.dept ? `${scope.dept} — ` : ''}
              the department at a glance: who is in it, what is being taught, what
              students are doing with it, semester by semester.
            </Text>
          </Box>
          <Flex gap={4} align="center" wrap="wrap">
            <RouterLinkStyle as={RouterLink} to="/learning/hod-subjects" fontSize="sm" color="blue.600">
              Subjects &amp; faculty →
            </RouterLinkStyle>
            {/* The faculty directory is behind the lm-admin gate, so offering it
                to a head of department is offering them a 403. */}
            {!deptLocked && (
              <RouterLinkStyle as={RouterLink} to="/learning/lm-admin/faculty" fontSize="sm" color="blue.600">
                ← Faculty directory
              </RouterLinkStyle>
            )}
          </Flex>
        </Flex>
      </Box>

      {/* One filter bar for the whole page — every number below obeys it. */}
      <Flex
        justify="space-between"
        align="center"
        gap={3}
        wrap="wrap"
        bg="lmBg.surface"
        borderWidth="1px"
        borderColor="lmBorder.base"
        borderRadius="lg"
        px={4}
        py={3}
      >
        <Text fontSize="sm" color="lmFg.subtle">
          {filtered
            ? `Filtered view · ${classes.length} class${classes.length !== 1 ? 'es' : ''}`
            : `Whole department · ${classes.length} class${classes.length !== 1 ? 'es' : ''}`}
        </Text>
        {filterBar}
      </Flex>

      {/* People and classrooms. */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        <StatTile
          label="Faculty"
          value={totals.faculty ?? 0}
          hint={`${totals.teachingFaculty ?? 0} running a classroom`}
          accent="purple.500"
        />
        <StatTile
          label="Students"
          value={totals.students ?? 0}
          hint={`${totals.activeStudents ?? 0} active in ${windowDays} days`}
          accent="teal.500"
        />
        <StatTile
          label="Classrooms"
          value={totals.classrooms ?? classes.length}
          hint={`${totals.classesWithActivity ?? 0} with activity`}
          accent="blue.500"
        />
        <StatTile
          label="Enrolments"
          value={totals.enrolments ?? 0}
          hint="seats across all classrooms"
          accent="cyan.500"
        />
      </SimpleGrid>

      {/* Teaching and learning. */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        <StatTile
          label="Classwork set"
          value={totals.coursework ?? 0}
          hint={`${totalContent} content items in total`}
          accent="orange.500"
        />
        <StatTile
          label="Handed in"
          value={totals.turnedIn ?? 0}
          hint={
            totals.onTimeRate == null
              ? 'nothing handed in yet'
              : `${totals.onTimeRate}% before the deadline`
          }
          accent="green.500"
        />
        <StatTile
          label="Avg quiz score"
          value={totals.avgQuizPercent == null ? '—' : `${totals.avgQuizPercent}%`}
          hint={`${totals.quizAttempts ?? 0} attempts · ${
            totals.quizPassRate == null ? 'no pass mark met' : `${totals.quizPassRate}% passed`
          }`}
          accent="pink.500"
        />
        <StatTile
          label="Awaiting marking"
          value={totals.awaitingGrading ?? 0}
          hint={
            totals.gradedRate == null
              ? 'nothing to mark yet'
              : `${totals.gradedRate}% of submissions marked`
          }
          accent="red.500"
        />
      </SimpleGrid>

      {/* ── semester-wise analysis ─────────────────────────────────────────── */}
      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
        <ChartCard
          title="Cohort size by semester"
          subtitle={`Enrolled seats against the students who did something in the last ${windowDays} days. The gap is the cohort you are not reaching.`}
        >
          <SemesterCohortChart semesters={semesters} windowDays={windowDays} />
        </ChartCard>

        <ChartCard
          title="Content by semester"
          subtitle="What each semester's classrooms carry, by kind of content."
        >
          <SemesterContentChart semesters={semesters} />
        </ChartCard>

        <ChartCard
          title="Outcomes by semester"
          subtitle="Average quiz score, work handed in before the deadline, and how much of what came in has been marked."
        >
          <SemesterOutcomeChart semesters={semesters} />
        </ChartCard>

        <ChartCard
          title="Student engagement by semester"
          subtitle={`Share of each semester's enrolments active in the last ${windowDays} days.`}
        >
          <SemesterEngagementChart semesters={semesters} />
        </ChartCard>
      </SimpleGrid>

      <ChartCard
        title="The last six months"
        subtitle="What the department published each month, against what students did with it. Two lines drifting apart is the thing to look at."
      >
        <ActivityTrendChart trend={trend} />
      </ChartCard>

      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
        <ChartCard title="Content mix" subtitle="Every item the department's classrooms carry.">
          <DonutChart data={contentMix} emptyMessage="No content has been created yet." />
        </ChartCard>

        <ChartCard title="Classroom status" subtitle="Where the department's classrooms stand.">
          <DonutChart data={statusMix} emptyMessage="No classrooms in view." />
        </ChartCard>

        <SectionCard
          title="Department coverage"
          subtitle="How much of the department is actually using the module."
        >
          <VStack align="stretch" spacing={4} mt={2}>
            <ProportionBar
              label="Faculty running a classroom"
              value={totals.teachingFaculty ?? 0}
              total={totals.faculty ?? 0}
              hint="the rest have accounts but no class yet"
              colorIndex={0}
            />
            <ProportionBar
              label="Classrooms with content"
              value={totals.classesWithActivity ?? 0}
              total={totals.classrooms ?? 0}
              colorIndex={2}
            />
            <ProportionBar
              label="Submissions marked"
              value={totals.graded ?? 0}
              total={totals.turnedIn ?? 0}
              hint={`${totals.awaitingGrading ?? 0} still waiting on a grade`}
              colorIndex={3}
            />
            <ProportionBar
              label={`Students active in ${windowDays} days`}
              value={totals.activeStudents ?? 0}
              total={totals.students ?? 0}
              colorIndex={4}
            />
          </VStack>
        </SectionCard>
      </SimpleGrid>

      {/* The charts above in numbers — also the readable fallback for anyone
          who cannot separate the lighter series colours by eye. */}
      <SectionCard
        title="Semester analysis"
        subtitle="Every figure the charts plot, per semester."
        action={
          <Button size="sm" variant="outline" onClick={exportSemesters} isDisabled={!semesters.length}>
            Download CSV
          </Button>
        }
      >
        {semesters.length === 0 ? (
          <EmptyState
            icon="insights"
            title="No semesters in view"
            description="No classes match the selected filters."
          />
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Semester</Th>
                  <Th isNumeric>Classes</Th>
                  <Th isNumeric>Faculty</Th>
                  <Th isNumeric>Enrolled</Th>
                  <Tooltip label={`Distinct students active in the last ${windowDays} days`} placement="top">
                    <Th isNumeric cursor="help">Active</Th>
                  </Tooltip>
                  <Th isNumeric>Engaged</Th>
                  <Tooltip label="Posts, shorts, quizzes, coding and forms" placement="top">
                    <Th isNumeric cursor="help">Content</Th>
                  </Tooltip>
                  <Th isNumeric>Classwork</Th>
                  <Th isNumeric>Handed in</Th>
                  <Th isNumeric>On time</Th>
                  <Th isNumeric>Marked</Th>
                  <Th isNumeric>Quiz attempts</Th>
                  <Th isNumeric>Avg score</Th>
                  <Th isNumeric>Pass rate</Th>
                </Tr>
              </Thead>
              <Tbody>
                {semesters.map((s) => (
                  <Tr key={s.semester || 'unlabelled'} _hover={{ bg: 'lmBg.hover' }}>
                    <Td>
                      <Text fontSize="sm" fontWeight="600" color="lmFg.heading">
                        {s.label}
                      </Text>
                    </Td>
                    <Td isNumeric><CountCell value={s.classes} /></Td>
                    <Td isNumeric><CountCell value={s.faculty} /></Td>
                    <Td isNumeric><CountCell value={s.enrolments} /></Td>
                    <Td isNumeric><CountCell value={s.activeStudents} /></Td>
                    <Td isNumeric><RateCell value={s.engagementRate} /></Td>
                    <Td isNumeric><CountCell value={s.content} /></Td>
                    <Td isNumeric><CountCell value={s.coursework} /></Td>
                    <Td isNumeric><CountCell value={s.submissions.turnedIn} /></Td>
                    <Td isNumeric><RateCell value={s.submissions.onTimeRate} /></Td>
                    <Td isNumeric><RateCell value={s.submissions.gradedRate} /></Td>
                    <Td isNumeric><CountCell value={s.quiz.attempts} /></Td>
                    <Td isNumeric><RateCell value={s.quiz.avgPercent} /></Td>
                    <Td isNumeric><RateCell value={s.quiz.passRate} /></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </SectionCard>

      {/* ── the classrooms themselves ──────────────────────────────────────── */}
      <SectionCard
        title="Classrooms"
        subtitle={
          filtered
            ? `Filtered · ${classes.length} class${classes.length !== 1 ? 'es' : ''}`
            : `All classes · ${classes.length} total`
        }
        action={
          <Button size="sm" variant="outline" onClick={exportClasses} isDisabled={!classes.length}>
            Download CSV
          </Button>
        }
      >
        {classes.length === 0 ? (
          <EmptyState
            icon="insights"
            title="No classes found"
            description={
              filtered
                ? 'No classes match the selected filters.'
                : 'No classes have been created yet.'
            }
          />
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Class / Subject</Th>
                  <Th>Faculty</Th>
                  {!deptLocked && <Th>Dept</Th>}
                  <Th>Sem</Th>
                  <Th>Status</Th>
                  <Tooltip label="Students enrolled in this class" placement="top">
                    <Th isNumeric cursor="help">Students</Th>
                  </Tooltip>
                  <Tooltip label={`Enrolled students active in the last ${windowDays} days`} placement="top">
                    <Th isNumeric cursor="help">Active</Th>
                  </Tooltip>
                  <Tooltip label="Stream announcements & posts" placement="top">
                    <Th isNumeric cursor="help">Posts</Th>
                  </Tooltip>
                  <Tooltip label="Shorts (live polls) created" placement="top">
                    <Th isNumeric cursor="help">Shorts</Th>
                  </Tooltip>
                  <Tooltip label="Quizzes created" placement="top">
                    <Th isNumeric cursor="help">Quizzes</Th>
                  </Tooltip>
                  <Tooltip label="Coding exercises (published notebooks)" placement="top">
                    <Th isNumeric cursor="help">Coding</Th>
                  </Tooltip>
                  <Tooltip label="Published forms" placement="top">
                    <Th isNumeric cursor="help">Forms</Th>
                  </Tooltip>
                  <Tooltip label="Published classwork items — assignments, questions, materials" placement="top">
                    <Th isNumeric cursor="help">Classwork</Th>
                  </Tooltip>
                  <Tooltip label="Submissions handed in (including work already returned)" placement="top">
                    <Th isNumeric cursor="help">Handed in</Th>
                  </Tooltip>
                  <Tooltip label="Average score across finished quiz attempts" placement="top">
                    <Th isNumeric cursor="help">Avg quiz</Th>
                  </Tooltip>
                </Tr>
              </Thead>
              <Tbody>
                {classes.map((cls) => {
                  const status = STATUS_STYLE[cls.status] || { colorScheme: 'gray', label: cls.status };
                  return (
                    <Tr
                      key={cls._id}
                      _hover={{ bg: 'lmBg.hover' }}
                      opacity={cls.status === 'archived' ? 0.65 : 1}
                    >
                      <Td>
                        <RouterLinkStyle
                          as={RouterLink}
                          to={`/learning/class/${cls._id}`}
                          color="blue.600"
                          fontWeight="600"
                          fontSize="sm"
                        >
                          {cls.name}
                        </RouterLinkStyle>
                        {cls.subject && (
                          <Text fontSize="xs" color="lmFg.muted" mt={0.5}>
                            {cls.subjectCode ? `${cls.subjectCode} · ` : ''}
                            {cls.subject}
                            {cls.section ? ` · §${cls.section}` : ''}
                          </Text>
                        )}
                        {cls.session && (
                          <Text fontSize="xs" color="lmFg.subtle">
                            {cls.session}
                          </Text>
                        )}
                      </Td>
                      <Td>
                        <Text fontSize="sm">{cls.ownerName || '—'}</Text>
                        {cls.ownerEmail && (
                          <Text fontSize="xs" color="lmFg.muted">
                            {cls.ownerEmail}
                          </Text>
                        )}
                      </Td>
                      {!deptLocked && (
                        <Td>
                          <Text fontSize="sm" color="lmFg.body">
                            {cls.dept || '—'}
                          </Text>
                        </Td>
                      )}
                      <Td>
                        <Text fontSize="sm" color="lmFg.body">
                          {cls.semester || '—'}
                        </Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={status.colorScheme} borderRadius="full" px={2} fontSize="xs">
                          {status.label}
                        </Badge>
                      </Td>
                      <Td isNumeric><CountCell value={cls.studentCount} /></Td>
                      <Td isNumeric><CountCell value={cls.activeStudents ?? 0} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.posts} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.shorts} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.quizzes} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.coding} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.forms} /></Td>
                      <Td isNumeric><CountCell value={cls.coursework ?? 0} /></Td>
                      <Td isNumeric><CountCell value={cls.submissions?.turnedIn ?? 0} /></Td>
                      <Td isNumeric><RateCell value={cls.quiz?.avgPercent ?? null} /></Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </SectionCard>

      <Box>
        <Text fontSize="xs" color="lmFg.subtle">
          Faculty and student counts are the accounts on record for the departments in view,
          including anyone who has not opened a class yet. Students are counted once per
          department here and once per classroom in the table, so the two do not add up —
          one student sits in several classes; the same is true of a semester’s enrolments,
          where “active” counts people and “enrolled” counts seats. Rates are shares of what
          exists: “on time” and “marked” are both of the work handed in, and quiz averages
          cover finished attempts only. Click a class name to open its stream.
        </Text>
      </Box>
    </VStack>
  );
}
