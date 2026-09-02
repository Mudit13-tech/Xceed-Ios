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
 * HOD Activity Dashboard — platform-wide per-class activity breakdown.
 *
 * Shows semester-wise subjects (classes) with post counts broken down by type:
 * announcements/posts, Shorts, Quizzes, Coding exercises, Forms.
 * Classes are ranked by a weighted activity score so HODs can immediately see
 * which classrooms are most (and least) active.
 *
 * Score formula: posts×1 + shorts×2 + quizzes×3 + coding×3 + forms×2
 * (interactive content weighted higher than plain announcements)
 */

/** A medal for the top 3 positions. */
function RankBadge({ rank }) {
  if (rank === 1) return <Text fontSize="lg" title="1st">🥇</Text>;
  if (rank === 2) return <Text fontSize="lg" title="2nd">🥈</Text>;
  if (rank === 3) return <Text fontSize="lg" title="3rd">🥉</Text>;
  return (
    <Text fontSize="sm" color="lmFg.muted" fontVariantNumeric="tabular-nums" minW="20px" textAlign="center">
      {rank}
    </Text>
  );
}

/** Color-coded activity score pill. */
function ScoreBadge({ score, max }) {
  let colorScheme = 'gray';
  if (max > 0) {
    const ratio = score / max;
    if (ratio >= 0.66) colorScheme = 'green';
    else if (ratio >= 0.33) colorScheme = 'orange';
    else if (score > 0) colorScheme = 'red';
  }
  return (
    <Badge colorScheme={colorScheme} borderRadius="full" px={2} fontSize="xs">
      {score}
    </Badge>
  );
}

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
  const [semester, setSemester] = useState('');
  const [session, setSession] = useState('');

  const load = useCallback(async (sem, sess) => {
    setLoading(true);
    setError(null);
    try {
      setData(await lmApi.adminGetHodDashboard({ semester: sem, session: sess }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(semester, session);
  }, [load, semester, session]);

  const handleSemesterChange = (e) => setSemester(e.target.value);
  const handleSessionChange = (e) => setSession(e.target.value);

  if (loading) return <Loading label="Loading HOD dashboard…" />;
  if (error) return <ErrorState error={error} onRetry={() => load(semester, session)} />;

  const { classes, filters } = data;
  const maxScore = classes.length > 0 ? classes[0].activity.score : 0;

  const totalPosts = classes.reduce((s, c) => s + c.activity.posts, 0);
  const totalShorts = classes.reduce((s, c) => s + c.activity.shorts, 0);
  const totalQuizzes = classes.reduce((s, c) => s + c.activity.quizzes, 0);
  const totalCoding = classes.reduce((s, c) => s + c.activity.coding, 0);
  const totalForms = classes.reduce((s, c) => s + c.activity.forms, 0);
  const activeClasses = classes.filter((c) => c.activity.score > 0).length;

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
              Semester-wise class activity ranked by engagement. Higher score = more interactive
              content (quizzes, coding, forms) vs. plain posts.
            </Text>
          </Box>
          <RouterLinkStyle as={RouterLink} to="/learning/lm-admin/faculty" fontSize="sm" color="blue.600">
            ← Faculty directory
          </RouterLinkStyle>
        </Flex>
      </Box>

      {/* Summary stats */}
      <SimpleGrid columns={{ base: 3, md: 6 }} spacing={3}>
        <StatTile label="Classes" value={classes.length} accent="blue.500" />
        <StatTile label="Active" value={activeClasses} hint="with any activity" accent="green.500" />
        <StatTile label="Posts" value={totalPosts} accent="gray.500" />
        <StatTile label="Shorts" value={totalShorts} accent="purple.500" />
        <StatTile label="Quizzes" value={totalQuizzes} accent="orange.500" />
        <StatTile label="Coding" value={totalCoding + totalForms} hint="+ forms" accent="teal.500" />
      </SimpleGrid>

      {/* Filter bar */}
      <SectionCard
        title="Class rankings"
        subtitle={
          semester || session
            ? `Filtered · ${classes.length} class${classes.length !== 1 ? 'es' : ''}`
            : `All classes · ${classes.length} total`
        }
        action={
          <Flex gap={2} wrap="wrap">
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
            {(semester || session) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setSemester(''); setSession(''); }}
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
              semester || session
                ? 'No classes match the selected filters.'
                : 'No classes have been created yet.'
            }
          />
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th w="40px">#</Th>
                  <Th>Class / Subject</Th>
                  <Th>Faculty</Th>
                  <Th>Sem</Th>
                  <Th>Status</Th>
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
                  <Tooltip
                    label="Activity score: Posts×1 + Shorts×2 + Quizzes×3 + Coding×3 + Forms×2"
                    placement="top"
                  >
                    <Th isNumeric cursor="help">Score ↕</Th>
                  </Tooltip>
                </Tr>
              </Thead>
              <Tbody>
                {classes.map((cls, idx) => {
                  const status = STATUS_STYLE[cls.status] || { colorScheme: 'gray', label: cls.status };
                  return (
                    <Tr
                      key={cls._id}
                      _hover={{ bg: 'lmBg.hover' }}
                      opacity={cls.status === 'archived' ? 0.65 : 1}
                    >
                      <Td>
                        <RankBadge rank={idx + 1} />
                      </Td>
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
                      <Td isNumeric><CountCell value={cls.activity.posts} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.shorts} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.quizzes} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.coding} /></Td>
                      <Td isNumeric><CountCell value={cls.activity.forms} /></Td>
                      <Td isNumeric>
                        <ScoreBadge score={cls.activity.score} max={maxScore} />
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </SectionCard>

      {/* Score legend */}
      <Box>
        <Text fontSize="xs" color="lmFg.subtle">
          Score formula: Posts × 1 + Shorts × 2 + Quizzes × 3 + Coding × 3 + Forms × 2.
          Interactive content is weighted higher than plain announcements. Classes are ranked highest
          score first. Click a class name to open its stream.
        </Text>
      </Box>
    </VStack>
  );
}
