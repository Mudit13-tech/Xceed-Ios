import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  IconButton,
  Text,
  Tooltip,
  useClipboard,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { loginPathFor } from '../../authRedirect';
import { ErrorState, Loading } from '../components/common';
import useStableNavigate from '../hooks/useStableNavigate';

// People and Settings are about the class rather than its work, so they sit in
// the header beside the class code instead of competing with the teaching tabs.
const TABS = [
  { path: '', label: 'Stream', end: true },
  { path: 'material', label: 'Material' },
  { path: 'quizzes', label: 'Quizzes' },
  { path: 'tutorials', label: 'Tutorials' },
  { path: 'assignments', label: 'Assignments' },
  { path: 'labs', label: 'Virtual Lab' },
  { path: 'shorts', label: 'Shorts' },
  { path: 'discussions', label: 'Forum' },
  { path: 'notebooks', label: 'Coding' },
  { path: 'grades', label: 'Grades' },
  { path: 'studio', label: 'AI Studio' },
  { path: 'playground', label: 'AI Playground', studentOnly: true },
  { path: 'insights', label: 'Insights', teacherOnly: true },
  // Last, and in its own colour. It is not another kind of classwork — it runs
  // the other way, from the class to the teacher — and sitting it mid-row in
  // the same grey as Quizzes made it read as one more thing to submit. The
  // purple is the tell that this tab plays by different rules.
  { path: 'feedback', label: 'Anonymous Feedback', accent: 'purple' },
];

// Sits on the coloured header, so the active state has to read against the
// class colour rather than the usual blue-on-white.
const headerLinkStyles = {
  bg: 'whiteAlpha.300',
  color: 'white',
  fontWeight: '500',
  _hover: { bg: 'whiteAlpha.400', textDecoration: 'none' },
  _active: { bg: 'whiteAlpha.500' },
  sx: { '&.active': { bg: 'white', color: 'gray.800', fontWeight: '600' } },
};

export default function ClassLayout() {
  const { classId } = useParams();
  const navigate = useStableNavigate();
  const toast = useToast();

  const { data: klass, isLoading: loading, error, refetch: load } = useQuery({
    queryKey: ['learning', 'class', classId],
    queryFn: () => lmApi.getClass(classId),
    retry: false, // Don't retry on 401s so we can redirect immediately
  });

  const { onCopy, hasCopied } = useClipboard(klass?.code || '');

  useEffect(() => {
    if (error?.status === 401) {
      navigate(loginPathFor(window.location), { replace: true });
    }
  }, [error, navigate]);

  if (loading) return <Loading label="Opening class…" minH="360px" />;
  if (error) {
    return (
      <Box>
        <ErrorState error={error} onRetry={load} />
        <Button size="sm" onClick={() => navigate('/learning')}>
          Back to classes
        </Button>
      </Box>
    );
  }
  if (!klass) return null;

  const isTeacher = klass.isTeacher;
  const visibleTabs = TABS.filter(
    (tab) => (!tab.teacherOnly || isTeacher) && (!tab.studentOnly || !isTeacher),
  );

  return (
    <Box>
      <Box
        bg={klass.coverColor || '#1967d2'}
        color="white"
        borderRadius="lg"
        px={{ base: 4, md: 5 }}
        py={2}
        mb={4}
        position="relative"
        overflow="hidden"
      >
        {/* One row, fixed height: the class identity scrolls out of the way as
            the window narrows, but the actions on the right stay put. */}
        <Flex
          direction={{ base: 'column', sm: 'row' }}
          align={{ base: 'stretch', sm: 'center' }}
          justify="space-between"
          wrap="wrap"
          gap={3}
        >
          <Box flex={{ base: '0 1 auto', sm: '1 1 220px' }} minW={{ base: 0, sm: '180px' }}>
            <Flex align="center" gap={2} wrap="wrap">
              <Heading size="sm">{klass.name}</Heading>
              {klass.status === 'archived' && <Badge colorScheme="orange">Archived</Badge>}
            </Flex>
            <Text fontSize="sm" opacity={0.9} mt={0.5}>
              {[klass.section, klass.subject, klass.room].filter(Boolean).join(' · ')}
            </Text>
            <HStack fontSize="sm" opacity={0.85} mt={0.5} spacing={3} wrap="wrap">
              <Text whiteSpace="nowrap">👤 {klass.ownerName}</Text>
              <Text whiteSpace="nowrap">📄 {klass.counts?.courseworkCount ?? 0} items</Text>
            </HStack>
          </Box>

          <HStack spacing={2} flexShrink={0} flexWrap="wrap" rowGap={2}>
            <IconButton
              as={NavLink}
              to={`/learning/class/${classId}/people`}
              size="sm"
              aria-label="People"
              icon={<span>👥 {klass.counts?.studentCount ?? 0}</span>}
              display={{ base: 'flex', md: 'none' }}
              {...headerLinkStyles}
            />
            <Button
              as={NavLink}
              to={`/learning/class/${classId}/people`}
              size="sm"
              leftIcon={<span>👥</span>}
              display={{ base: 'none', md: 'flex' }}
              {...headerLinkStyles}
            >
              People · {klass.counts?.studentCount ?? 0}
            </Button>

            <IconButton
              as={NavLink}
              to={`/learning/class/${classId}/leaderboard`}
              size="sm"
              aria-label="Leaderboard"
              icon={<span>🏆</span>}
              display={{ base: 'flex', md: 'none' }}
              {...headerLinkStyles}
            />
            <Button
              as={NavLink}
              to={`/learning/class/${classId}/leaderboard`}
              size="sm"
              leftIcon={<span>🏆</span>}
              display={{ base: 'none', md: 'flex' }}
              {...headerLinkStyles}
            >
              Leaderboard
            </Button>

            {isTeacher && (
              <Tooltip label={hasCopied ? 'Copied!' : 'Click to copy class code'}>
                <Button
                  onClick={onCopy}
                  size="sm"
                  fontFamily="mono"
                  letterSpacing="wider"
                  borderRadius="full"
                  px={4}
                  {...headerLinkStyles}
                >
                  {klass.code}
                </Button>
              </Tooltip>
            )}
            {isTeacher && (
              <Tooltip label="Class settings">
                <IconButton
                  as={NavLink}
                  to={`/learning/class/${classId}/settings`}
                  size="sm"
                  aria-label="Class settings"
                  icon={<span>⚙️</span>}
                  {...headerLinkStyles}
                />
              </Tooltip>
            )}
          </HStack>
        </Flex>
      </Box>

      <Flex
        gap={1}
        borderBottomWidth="1px"
        borderColor="gray.200"
        mb={5}
        overflowX="auto"
        bg="white"
        borderTopRadius="lg"
        px={2}
      >
        {visibleTabs.map((tab) => {
          // Blue is the module's default tab accent; a tab may claim its own to
          // say it is a different kind of thing rather than the next item in a
          // sequence. `ml="auto"` pushes an accented tab to the far end of the
          // row, away from the teaching tabs it does not belong with.
          const accent = tab.accent || 'blue';
          return (
            <Box
              key={tab.path || 'stream'}
              as={NavLink}
              to={tab.path ? `/learning/class/${classId}/${tab.path}` : `/learning/class/${classId}`}
              end={tab.end}
              px={4}
              py={3}
              ml={tab.accent ? 'auto' : undefined}
              fontSize="sm"
              fontWeight={tab.accent ? '600' : '500'}
              color={tab.accent ? `${accent}.600` : 'gray.600'}
              whiteSpace="nowrap"
              borderBottomWidth="3px"
              borderColor="transparent"
              _hover={{ color: `${accent}.600`, bg: tab.accent ? `${accent}.50` : undefined }}
              sx={{
                '&.active': {
                  color: `${accent}.600`,
                  borderColor: `${accent}.500`,
                  fontWeight: '600',
                  ...(tab.accent ? { bg: `${accent}.50` } : {}),
                },
              }}
            >
              {tab.label}
            </Box>
          );
        })}
      </Flex>

      <Outlet context={{ klass, isTeacher, classId, reloadClass: load, toast }} />
    </Box>
  );
}
