import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
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
import { ClassShellSkeleton, ErrorState, Loading } from '../components/common';
import { LmIcon } from '../components/Icon';
import useStableNavigate from '../hooks/useStableNavigate';
import NotificationPreferencesModal from '../components/NotificationPreferencesModal';
import SubjectAttendanceStrip from '../components/SubjectAttendanceStrip';
import ClassHeaderCard from '../components/ClassHeaderCard';
import RoomWithMap from '../components/RoomWithMap';
import { preloadPath } from '../../routePreload';

// People and Settings are about the class rather than its work, so they sit in
// the header beside the class code instead of competing with the teaching tabs.
// Insights is up there too: it is what a teacher opens the class to check —
// who is behind, what needs chasing — not another kind of coursework.
// Exported so the iOS header (ClassLayout.mobile.jsx) draws its tab row from
// this same list: a tab added here appears on the phone without a second
// edit, and a role's tabs cannot drift between the two.
// eslint-disable-next-line react-refresh/only-export-components
export const TABS = [
  { path: '', label: 'Stream', end: true },
  { path: 'material', label: 'Material' },
  // Beside Material: both are things to watch or read before the work, so they
  // belong together rather than with the things you hand in.
  { path: 'shorts', label: 'Shorts' },
  { path: 'quizzes', label: 'Quizzes' },
  { path: 'tutorials', label: 'Tutorials' },
  { path: 'assignments', label: 'Assignments' },
  { path: 'forms', label: 'Forms' },
  { path: 'notebooks', label: 'Coding' },
  { path: 'grades', label: 'Grades' },
  { path: 'studio', label: 'AI Studio' },
  { path: 'playground', label: 'AI Playground', studentOnly: true },
  { path: 'discussions', label: 'Forum' },
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
  const [prefsOpen, setPrefsOpen] = useState(false);

  const { data: klass, isLoading: loading, error, refetch: load } = useQuery({
    queryKey: ['learning', 'class', classId],
    queryFn: () => lmApi.getClass(classId),
    retry: false, // Don't retry on 401s so we can redirect immediately
    // The class name, cover colour and settings don't change mid-session.
    // 2 min keeps the header instant on every tab switch without hiding a
    // rename or cover-colour change for longer than a meeting lasts.
    staleTime: 2 * 60 * 1000,
  });

  const { onCopy, hasCopied } = useClipboard(klass?.code || '');

  useEffect(() => {
    if (error?.status === 401) {
      navigate(loginPathFor(window.location), { replace: true });
    }
  }, [error, navigate]);

  // The moment a class opens, the user is very likely to click one of the
  // first few tabs (Stream → Material → Shorts are the most-visited). Kick
  // off the chunk fetches now — before the hover — so the download is
  // already done (or well under way) by the time the click arrives.
  useEffect(() => {
    if (!classId) return;
    const tabs = ['', 'material', 'shorts', 'quizzes', 'tutorials', 'assignments'];
    tabs.forEach((tab) => {
      preloadPath(`/learning/class/${classId}${tab ? `/${tab}` : ''}`);
    });
  }, [classId]);

  /* Keep the tab you are on where you can see it.
     The row scrolls sideways on a phone, and the browser does not scroll it for
     you: opening Grades from a link, or coming back to a class you had left on
     a later tab, left the highlighted tab somewhere off the right-hand edge —
     so the one thing on the row that says where you are was the one thing you
     could not see. `nearest` rather than `center` so a tab already in view does
     not jump under the finger about to tap it, and the row is only scrolled
     once the tabs are actually on screen — before that there is nothing to
     find. */
  const tabRowRef = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const active = tabRowRef.current?.querySelector('.active');
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [pathname, loading]);

  if (loading) return <Loading label="Opening class…" minH="360px" skeleton={<ClassShellSkeleton />} />;
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
        color="lmFg.onAccent"
        borderRadius="lg"
        px={{ base: 4, md: 5 }}
        /* The phone card is a card — a heading, three tiles and the join code —
           and 8px around it reads as cramped. The wide row is a row, and is
           unchanged. */
        py={{ base: 4, md: 2 }}
        mb={4}
        position="relative"
        overflow="hidden"
      >
        {/* Two compositions, not one reflowed. Below `md` the row broke into a
            wrap of unlabelled icon buttons with the class name no larger than
            anything beside it, so a phone gets its own card — see
            ClassHeaderCard. */}
        <ClassHeaderCard
          klass={klass}
          classId={classId}
          isTeacher={isTeacher}
          onCopyCode={onCopy}
          hasCopiedCode={hasCopied}
          onOpenPrefs={() => setPrefsOpen(true)}
          onPreload={() => preloadPath(`/learning/class/${classId}/people`)}
        />

        {/* One row, fixed height: the class identity scrolls out of the way as
            the window narrows, but the actions on the right stay put. */}
        <Flex
          display={{ base: 'none', md: 'flex' }}
          align="center"
          justify="space-between"
          wrap="wrap"
          gap={3}
        >
          <Box flex="1 1 220px" minW="180px">
            <Flex align="center" gap={2} wrap="wrap">
              <Heading size="sm">{klass.name}</Heading>
              {klass.status === 'archived' && <Badge colorScheme="orange">Archived</Badge>}
            </Flex>
            {/* The room is held out of the join so it can carry its pin — the
                same treatment the phone's card gives it. See RoomWithMap. */}
            <Text fontSize="sm" opacity={0.9} mt={0.5}>
              {[klass.section, klass.subject].filter(Boolean).join(' · ')}
              {(klass.section || klass.subject) && klass.room ? ' · ' : ''}
              <RoomWithMap room={klass.room} />
            </Text>
            <HStack fontSize="sm" opacity={0.85} mt={0.5} spacing={3} wrap="wrap">
              <Text whiteSpace="nowrap" display="flex" alignItems="center" gap={1.5}>
                <LmIcon name="user" size={13} />
                {klass.ownerName}
              </Text>
              <Text whiteSpace="nowrap" display="flex" alignItems="center" gap={1.5}>
                <LmIcon name="coursework" size={13} />
                {klass.counts?.courseworkCount ?? 0} items
              </Text>
            </HStack>
          </Box>

          <HStack spacing={2} flexShrink={0} flexWrap="wrap" rowGap={2}>
            <Button
              as={NavLink}
              to={`/learning/class/${classId}/people`}
              size="sm"
              leftIcon={<LmIcon name="people" size={16} />}
              {...headerLinkStyles}
            >
              People · {klass.counts?.studentCount ?? 0}
            </Button>

            {isTeacher && (
              <Button
                as={NavLink}
                to={`/learning/class/${classId}/insights`}
                size="sm"
                leftIcon={<LmIcon name="insights" size={16} />}
                {...headerLinkStyles}
              >
                Insights
              </Button>
            )}

            <Button
              as={NavLink}
              to={`/learning/class/${classId}/leaderboard`}
              size="sm"
              leftIcon={<LmIcon name="leaderboard" size={16} />}
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
            <Tooltip label="Notification preferences">
              <IconButton
                onClick={() => setPrefsOpen(true)}
                size="sm"
                aria-label="Notification preferences"
                icon={<LmIcon name="notifications" size={16} />}
                {...headerLinkStyles}
              />
            </Tooltip>
            {isTeacher && (
              <Tooltip label="Class settings">
                <IconButton
                  as={NavLink}
                  to={`/learning/class/${classId}/settings`}
                  size="sm"
                  aria-label="Class settings"
                  icon={<LmIcon name="settings" size={16} />}
                  {...headerLinkStyles}
                />
              </Tooltip>
            )}
          </HStack>
        </Flex>
      </Box>

      <NotificationPreferencesModal
        isOpen={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        classId={classId}
        className={klass.name}
        isTeacher={isTeacher}
      />

      {/* ── Single-Line Subject Attendance Strip for Enrolled Students (Issue #1928) ── */}
      {!isTeacher && (
        <SubjectAttendanceStrip klass={klass} />
      )}

      <Flex
        ref={tabRowRef}
        gap={1}
        borderBottomWidth="1px"
        borderColor="lmBorder.base"
        mb={5}
        overflowX="auto"
        bg="lmBg.surface"
        borderTopRadius="lg"
        px={2}
        /* Thirteen tabs do not fit a phone, so the row scrolls. Hide the bar
           itself — it sits on the tabs' own underline and reads as a second,
           broken one — and let the fade at the right edge say there is more.
           Momentum scrolling on iOS, where a bare overflow row feels stuck. */
        sx={{
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
        position="relative"
        _after={{
          content: '""',
          position: 'sticky',
          right: 0,
          flex: '0 0 24px',
          alignSelf: 'stretch',
          marginLeft: '-24px',
          pointerEvents: 'none',
          bgGradient: 'linear(to-r, transparent, lmBg.surface)',
        }}
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
