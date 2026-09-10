import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { FiChevronDown } from 'react-icons/fi';

import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard, ShortsListSkeleton } from '../components/common';
import StartShortModal from '../components/StartShortModal';
import { relativeTime } from '../format';
import { LmIcon } from '../components/Icon';

/**
 * The class's Shorts — decks of instant questions run live from the front of the
 * room.
 *
 * Deliberately separate from Quizzes: a quiz has a window, an attempt cap and a
 * gradebook row, and none of that applies to a thirty-second temperature check
 * in the middle of a lecture. Mixing them would mean every warm-up poll asking
 * the teacher to pick a due date.
 */

const SLIDE_TYPE_LABEL = {
  mcq: 'Multiple choice',
  msq: 'Multiple answer',
  truefalse: 'True / false',
  wordcloud: 'Word cloud',
  scale: 'Scale',
  open: 'Open text',
  ranking: 'Ranking',
  numeric: 'Numeric estimate',
};

export default function Shorts() {
  const { classId, isTeacher } = useOutletContext();
  const [shorts, setShorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  // The deck waiting on the mail question, or null when nothing is being started.
  const [pendingStart, setPendingStart] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(async () => {
    setError(null);
    try {
      setShorts(await lmApi.listShorts(classId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy('new');
    try {
      const created = await lmApi.createShort(classId, {
        title: 'Untitled short',
        slides: [
          {
            type: 'mcq',
            question: 'Which of these did we cover today?',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswers: [],
            timeLimitSec: 30,
          },
        ],
      });
      navigate(`/learning/class/${classId}/short/${created._id}/edit`);
    } catch (err) {
      toast({ status: 'error', title: err.message });
    } finally {
      setBusy('');
    }
  };

  /**
   * `email` left undefined presents the deck the way it is configured
   * (Edit → "Email the class when I start it"); passing it overrides that
   * setting for this run only.
   *
   * Starting a *fresh* session never takes the undefined path from here: the
   * mail question is put to the teacher first (`StartShortModal`), because a
   * launch mail cannot be recalled. Rejoining a live session notifies nobody,
   * so that one goes straight through.
   */
  const present = async (short, { email } = {}) => {
    setBusy(short._id);
    try {
      const { session, resumed, emailed } = await lmApi.presentShort(classId, short._id, { email });
      // Resuming does not notify anyone a second time, so only a fresh session
      // has anything to report — and mail is worth confirming either way, since
      // it is the half of the launch the teacher cannot see happen.
      if (!resumed) {
        toast({
          status: 'success',
          title: emailed ? 'Live — the class has been emailed' : 'Live — no email sent',
          description: emailed ? undefined : 'The class still gets the in-app notification.',
          duration: 3000,
        });
      }
      navigate(`/learning/class/${classId}/short/${short._id}/present/${session.sessionId}`);
    } catch (err) {
      // The deck-level validation errors are the useful ones — show the first,
      // since the editor will show all of them in place.
      toast({
        status: 'error',
        title: err.message,
        description: err.payload?.errors?.slice(1).join(' '),
      });
    } finally {
      setBusy('');
      setPendingStart(null);
    }
  };

  /**
   * Ending from here saves the teacher a trip through the presenter view just to
   * shut a session down — the join code stops working either way.
   */
  const endSession = async (short) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`End the live session for "${short.title}"? The join code stops working.`)) return;
    setBusy(short._id);
    try {
      await lmApi.endShortSession(classId, short.liveSession._id);
      toast({ status: 'success', title: 'Session ended' });
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    } finally {
      setBusy('');
    }
  };

  const remove = async (short) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${short.title}" and every session's answers?`)) return;
    try {
      await lmApi.deleteShort(classId, short._id);
      toast({ status: 'success', title: 'Short deleted' });
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  if (loading) return <ShortsListSkeleton />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  const live = shorts.filter((short) => short.liveSession);

  return (
    <VStack align="stretch" spacing={5}>
      <Flex align="center" gap={3} wrap="wrap">
        <Box>
          <Heading size="md">Shorts</Heading>
          <Text fontSize="sm" opacity={0.7}>
            Instant questions the room answers on their phones, live.
          </Text>
        </Box>
        <Box flex="1" />
        <Button as={RouterLink} to="/learning/short/join" variant="outline" size="sm">
          Join with a code
        </Button>
        {isTeacher && (
          <>
            <Button as="a" href="/learning/shortsmanual" target="_blank" rel="noreferrer" variant="ghost" size="sm">
              <LmIcon name="manual" size={14} style={{ marginRight: 6 }} />
            Manual
            </Button>
            <Button colorScheme="purple" size="sm" onClick={create} isLoading={busy === 'new'}>
              New short
            </Button>
          </>
        )}
      </Flex>

      {live.length > 0 && (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Box flex="1">
            <Text fontWeight="600">
              {live.length === 1 ? 'A short is live now' : `${live.length} shorts are live now`}
            </Text>
            <Text fontSize="sm">
              {isTeacher
                ? 'Open the presenter view to keep driving it.'
                : `Join with code ${live[0].liveSession.joinCode}.`}
            </Text>
          </Box>
          {!isTeacher && (
            <Button
              as={RouterLink}
              to={`/learning/short/join/${live[0].liveSession.joinCode}`}
              size="sm"
              colorScheme="blue"
            >
              Join
            </Button>
          )}
        </Alert>
      )}

      {shorts.length === 0 ? (
        <EmptyState
          icon="short"
          title="No shorts yet"
          description={
            isTeacher
              ? 'Build a deck of quick questions, put the join code on the projector and watch the answers land.'
              : 'Your teacher has not created any shorts for this class yet.'
          }
          action={isTeacher ? <Button colorScheme="purple" onClick={create}>New short</Button> : null}
        />
      ) : (
        <VStack align="stretch" spacing={3}>
          {shorts.map((short) => (
            <SectionCard key={short._id}>
              <Flex gap={4} wrap="wrap" align="flex-start">
                <Box flex="1" minW="220px">
                  <HStack spacing={2} mb={1} wrap="wrap">
                    <Text fontWeight="700">{short.title}</Text>
                    {short.liveSession && (
                      <Badge colorScheme="red" variant="solid">
                        live · {short.liveSession.joinCode}
                      </Badge>
                    )}
                    {short.settings?.graded && <Badge colorScheme="purple">graded</Badge>}
                    {short.settings?.anonymous && <Badge>anonymous</Badge>}
                    {/* Only the off state is worth a badge — mail on start is
                        the default, and every deck saying so is just noise. */}
                    {isTeacher && short.settings?.emailOnStart === false && (
                      <Badge colorScheme="orange">no launch email</Badge>
                    )}
                  </HStack>

                  {short.description ? (
                    <Text fontSize="sm" opacity={0.75} noOfLines={2}>
                      {short.description}
                    </Text>
                  ) : null}

                  <Text fontSize="xs" opacity={0.6} mt={1}>
                    {short.slideCount} {short.slideCount === 1 ? 'slide' : 'slides'}
                    {short.runCount ? ` · presented ${short.runCount}×` : ' · never presented'}
                    {short.lastRunAt ? ` · last ${relativeTime(short.lastRunAt)}` : ''}
                  </Text>

                  {isTeacher && short.slides?.length ? (
                    <HStack spacing={1} mt={2} wrap="wrap">
                      {[...new Set(short.slides.map((slide) => slide.type))].map((type) => (
                        <Badge key={type} variant="subtle" fontSize="2xs">
                          {SLIDE_TYPE_LABEL[type] || type}
                        </Badge>
                      ))}
                    </HStack>
                  ) : null}
                </Box>

                {isTeacher ? (
                  <HStack spacing={2} wrap="wrap">
                    {/* Split button: the main half asks the mail question and
                        then starts, the caret answers it in one click for a
                        teacher who already knows. Rejoining a live session
                        notifies nobody, so it starts immediately — and its
                        caret carries the way out, so ending a session does not
                        mean opening the presenter view first. */}
                    <HStack spacing={0}>
                      <Button
                        size="sm"
                        colorScheme={short.liveSession ? 'red' : 'purple'}
                        onClick={() =>
                          short.liveSession ? present(short) : setPendingStart(short)
                        }
                        isLoading={busy === short._id}
                        borderRightRadius={0}
                      >
                        {short.liveSession ? 'Back to presenting' : 'Present'}
                      </Button>
                      <Menu placement="bottom-end">
                        <MenuButton
                          as={IconButton}
                          aria-label={short.liveSession ? 'Session options' : 'Presenting options'}
                          icon={<FiChevronDown />}
                          size="sm"
                          colorScheme={short.liveSession ? 'red' : 'purple'}
                          borderLeftRadius={0}
                          borderLeftWidth="1px"
                          borderLeftColor="whiteAlpha.400"
                          isDisabled={busy === short._id}
                        />
                        <MenuList>
                          {short.liveSession ? (
                            <MenuItem color="red.500" onClick={() => endSession(short)}>
                              End session
                            </MenuItem>
                          ) : (
                            <>
                              <MenuItem onClick={() => present(short, { email: true })}>
                                Present and email the class
                              </MenuItem>
                              <MenuItem onClick={() => present(short, { email: false })}>
                                Present without emailing
                              </MenuItem>
                            </>
                          )}
                        </MenuList>
                      </Menu>
                    </HStack>
                    <Button
                      size="sm"
                      variant="outline"
                      colorScheme="yellow"
                      as={RouterLink}
                      to={`/learning/class/${classId}/short/${short._id}/preview`}
                    >
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      as={RouterLink}
                      to={`/learning/class/${classId}/short/${short._id}/edit`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      as={RouterLink}
                      to={`/learning/class/${classId}/short/${short._id}/sessions`}
                    >
                      Reports
                    </Button>
                    <Button size="sm" variant="ghost" colorScheme="red" onClick={() => remove(short)}>
                      Delete
                    </Button>
                  </HStack>
                ) : (
                  short.liveSession ? (
                    <Button
                      as={RouterLink}
                      to={`/learning/short/join/${short.liveSession.joinCode}`}
                      size="sm"
                      colorScheme="blue"
                    >
                      Join
                    </Button>
                  ) : short.runCount > 0 && short.participated === false && (
                    <Badge
                      colorScheme="red"
                      variant="subtle"
                      px={3}
                      py={1.5}
                      borderRadius="full"
                      fontSize="xs"
                      fontWeight="700"
                      letterSpacing="0.5px"
                      textTransform="uppercase"
                      border="1.5px solid"
                      borderColor="red.300"
                    >
                      Missed
                    </Badge>
                  )
                )}
              </Flex>
            </SectionCard>
          ))}
        </VStack>
      )}

      <StartShortModal
        isOpen={Boolean(pendingStart)}
        short={pendingStart}
        isBusy={Boolean(pendingStart) && busy === pendingStart._id}
        onClose={() => setPendingStart(null)}
        onConfirm={(email) => present(pendingStart, { email })}
      />
    </VStack>
  );
}
