/**
 * The class shell, with an iOS-only header.
 *
 * Both app stores are served by one bundle, so this override runs on Android
 * too — and on Android it renders the AMS component untouched. The redesign is
 * iOS's alone: the Android app is the one that ships today, its header already
 * fits its screens, and moving it to fix a layout problem it does not have
 * would be trading a working app for an untested one. Same reasoning as
 * src/mobile/statusBar.js: the guard is the platform, not merely "is native".
 *
 * Why an override rather than an edit to ClassLayout.jsx: the iOS path replaces
 * the header wholesale rather than adjusting it, and a rewrite living in the
 * AMS copy is what turns every upstream touch of that file into a conflict
 * nobody can resolve without knowing both intentions. The AMS copy beside this
 * one keeps exactly one addition — `export` on TABS, so the tab row is defined
 * in one place and a tab added upstream appears here for free. Run
 * `npm run drift` to see what has changed in it.
 *
 * The cost of the override is that this copy stops inheriting upstream work
 * on the data layer, and that cost is real: the AMS sync that landed with this
 * merge added a staleTime to the class query, a preload of the first few tabs'
 * chunks, and a skeleton for the loading state -- three performance changes
 * that would simply not have reached iOS. They are carried across by hand
 * below. `npm run drift` reports what has changed in the AMS copy since, and
 * it is worth reading before every release rather than after one.
 *
 * The tab row is rebuilt here rather than reused because the desktop row is
 * sized for a pointer: 14px labels in a strip that a thumb has to land on
 * between two others. Its behaviour — which tabs a role sees, the accent that
 * sets Anonymous Feedback apart — comes from the shared TABS, so only the
 * measurements differ.
 */
import React, { useEffect } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Flex, useToast } from '@chakra-ui/react';
import AmsClassLayout, { TABS } from './ClassLayout';
import lmApi from '../api/lmApi';
import { loginPathFor } from '../../authRedirect';
import { isIosApp } from '../../mobile/platform';
import { preloadPath } from '../../routePreload';
import { ClassShellSkeleton, ErrorState, Loading } from '../components/common';
import IosClassHeader from '../components/IosClassHeader';
import SubjectAttendanceStrip from '../components/SubjectAttendanceStrip';
import useStableNavigate from '../hooks/useStableNavigate';

const IOS = isIosApp();

function IosClassLayout() {
  const { classId } = useParams();
  const navigate = useStableNavigate();
  const toast = useToast();

  const { data: klass, isLoading: loading, error, refetch: load } = useQuery({
    queryKey: ['learning', 'class', classId],
    queryFn: () => lmApi.getClass(classId),
    retry: false, // Don't retry on 401s so we can redirect immediately
    // The class name, cover colour and settings don't change mid-session.
    // 2 min keeps the header instant on every tab switch without hiding a
    // rename or cover-colour change for longer than a meeting lasts.
    staleTime: 2 * 60 * 1000,
  });

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
      <IosClassHeader klass={klass} classId={classId} isTeacher={isTeacher} />

      {!isTeacher && <SubjectAttendanceStrip klass={klass} />}

      <Flex
        gap={1}
        borderBottomWidth="1px"
        borderColor="lmBorder.base"
        mb={5}
        overflowX="auto"
        bg="lmBg.surface"
        borderTopRadius="lg"
        px={2}
        sx={{
          // A flung tab row should coast and settle like every other scroller on
          // the phone, and the scrollbar that appears mid-fling is a desktop
          // affordance with nothing to drag it.
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {visibleTabs.map((tab) => {
          const accent = tab.accent || 'blue';
          return (
            <Box
              key={tab.path || 'stream'}
              as={NavLink}
              to={tab.path ? `/learning/class/${classId}/${tab.path}` : `/learning/class/${classId}`}
              end={tab.end}
              // Wider and taller than the desktop tab: the target is a thumb,
              // and the row scrolls, so there is no width to save by crowding.
              px={4}
              py={3.5}
              ml={tab.accent ? 'auto' : undefined}
              fontSize="15px"
              fontWeight={tab.accent ? '600' : '500'}
              color={tab.accent ? `${accent}.600` : 'lmFg.subtle'}
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

// Re-exported so the override presents the same module surface as the file it
// stands in for; anything importing TABS gets it whichever copy resolves.
export { TABS };

export default function ClassLayout() {
  return IOS ? <IosClassLayout /> : <AmsClassLayout />;
}
