import React, { useCallback, useEffect, useState } from 'react';
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
import { EmptyState, ErrorState, Loading, SectionCard, StatTile } from '../components/common';

/**
 * HOD Activity Dashboard — per-class activity for a department.
 *
 * Shows the department's headline counts (faculty, students, classrooms) and
 * then one row per class: how many students it holds and how much of each kind
 * of content it carries — announcements/posts, Shorts, Quizzes, Coding
 * exercises, Forms.
 *
 * Deliberately not a ranking. It used to sort classes by a weighted "activity
 * score" and hang 🥇🥈🥉 off the top three, which reads as a league table of the
 * faculty who own those classes — a single invented number standing in for how
 * well somebody teaches. The counts are what a head of department asked for, so
 * the counts are what the table shows, in the department's own order.
 *
 * Filters: department, semester and session. A head of department is scoped to
 * their own department by the server, and the department dropdown is then a
 * fixed label rather than a choice.
 */

/** One number cell — shows 0 in a muted colour so active counts stand out. */
function CountCell({ value }) {
  return (
    <Text fontSize="sm" color={value > 0 ? 'lmFg.body' : 'lmFg.subtle'} fontVariantNumeric="tabular-nums">
      {value}
    </Text>
  );
}

const STATUS_STYLE = {
  active: { colorScheme: 'green', label: 'Active' },
  archived: { colorScheme: 'gray', label: 'Archived' },
  completed: { colorScheme: 'blue', label: 'Completed' },
};

export default function LmAdminHodDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dept, setDept] = useState('');
  const [semester, setSemester] = useState('');
  const [session, setSession] = useState('');

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

  const handleDeptChange = (e) => setDept(e.target.value);
  const handleSemesterChange = (e) => setSemester(e.target.value);
  const handleSessionChange = (e) => setSession(e.target.value);

  if (loading) return <Loading label="Loading HOD dashboard…" />;
  if (error) return <ErrorState error={error} onRetry={() => load(dept, semester, session)} />;

  const { classes, filters, totals = {}, scope = {} } = data;
  // An HOD cannot widen the scope, so the department is shown as a fact rather
  // than offered as a dropdown that would silently ignore every other option.
  const deptLocked = Boolean(scope.locked);
  const filtered = Boolean(dept || semester || session);

  const totalPosts = classes.reduce((s, c) => s + c.activity.posts, 0);
  const totalShorts = classes.reduce((s, c) => s + c.activity.shorts, 0);
  const totalQuizzes = classes.reduce((s, c) => s + c.activity.quizzes, 0);
  const totalCoding = classes.reduce((s, c) => s + c.activity.coding, 0);
  const totalForms = classes.reduce((s, c) => s + c.activity.forms, 0);
  const activeClasses = classes.filter((c) => c.activity.total > 0).length;

  return (
    <VStack align="stretch" spacing={6}>
      {/* Header */}
      <Box>
        <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
          <Box>
            <Text fontSize="xl" fontWeight="700" color="lmFg.heading">
              HOD Activity Dashboard
            </Text>
            <Text fontSize="sm" color="lmFg.muted">
              {scope.dept ? `${scope.dept} — ` : ''}
              class-wise activity: how many students each classroom holds and how much
              content it carries.
            </Text>
          </Box>
          <RouterLinkStyle as={RouterLink} to="/learning/lm-admin/faculty" fontSize="sm" color="blue.600">
            ← Faculty directory
          </RouterLinkStyle>
        </Flex>
      </Box>

      {/* The three headline numbers, then what those classrooms contain. */}
      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3}>
        <StatTile label="Faculty" value={totals.faculty ?? 0} accent="purple.500" />
        <StatTile label="Students" value={totals.students ?? 0} accent="teal.500" />
        <StatTile
          label="Classrooms"
          value={totals.classrooms ?? classes.length}
          hint={`${activeClasses} with activity`}
          accent="blue.500"
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 3, md: 5 }} spacing={3}>
        <StatTile label="Posts" value={totalPosts} accent="gray.500" />
        <StatTile label="Shorts" value={totalShorts} accent="purple.500" />
        <StatTile label="Quizzes" value={totalQuizzes} accent="orange.500" />
        <StatTile label="Coding" value={totalCoding} accent="teal.500" />
        <StatTile label="Forms" value={totalForms} accent="cyan.500" />
      </SimpleGrid>

      {/* Filter bar */}
      <SectionCard
        title="Classrooms"
        subtitle={
          filtered
            ? `Filtered · ${classes.length} class${classes.length !== 1 ? 'es' : ''}`
            : `All classes · ${classes.length} total`
        }
        action={
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
                placeholder="All departments"
              >
                {(filters.departments || []).map((d) => (
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
        }
      >
        {classes.length === 0 ? (
          <EmptyState
            icon="📊"
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
                      <Td isNumeric><CountCell value={cls.activity.posts} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.shorts} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.quizzes} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.coding} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.forms} /></Td>
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
          one student sits in several classes. Click a class name to open its stream.
        </Text>
      </Box>
    </VStack>
  );
}
