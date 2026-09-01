import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Switch,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import useShortStream from '../hooks/useShortStream';
import { ErrorState, Loading, SectionCard } from '../components/common';
import RichText from '../components/RichText';

/**
 * The teacher's live board for a teacher-paced tutorial.
 *
 * Presenting is what pushes the room forward: the teacher opens questions one at
 * a time, and this screen shows — per student, per opened question — how many
 * answer slots they have turned green, the same "answer now" progress a quiz
 * gives. The reveal is cumulative, so opening question 3 leaves 1 and 2 open for
 * anyone still working them.
 */

/** A short, tag-free preview of a question prompt for the control list. */
const previewText = (html, max = 90) => {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

function ProgressCell({ cell }) {
  if (!cell) return <Td textAlign="center" color="lmFg.faint">·</Td>;
  const done = cell.complete;
  return (
    <Td
      textAlign="center"
      bg={done ? 'green.50' : cell.answered ? 'orange.50' : undefined}
      fontWeight={done ? '700' : '400'}
      color={done ? 'green.700' : undefined}
    >
      {cell.correct}/{cell.total}
      {done ? ' ✓' : ''}
    </Td>
  );
}

export default function TutorialPresent() {
  const { classId } = useOutletContext();
  const { tutorialId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [sessionId, setSessionId] = useState(null);
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Presenting creates (or resumes) the live session, then we stream its board.
  const start = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      const { session } = await lmApi.presentTutorial(classId, tutorialId);
      setSessionId(session.sessionId);
    } catch (err) {
      setStartError(err);
    } finally {
      setStarting(false);
    }
  }, [classId, tutorialId]);

  useEffect(() => {
    start();
  }, [start]);

  const streamUrl = useMemo(
    () => (sessionId ? lmApi.tutorialPresenterStreamUrl(classId, sessionId) : null),
    [classId, sessionId],
  );
  const pollState = useCallback(async () => {
    const { session } = await lmApi.tutorialSessionState(classId, sessionId);
    return session;
  }, [classId, sessionId]);
  const { state, error, merge } = useShortStream(streamUrl, {
    fetchState: pollState,
    enabled: Boolean(streamUrl),
  });

  const control = async (action, extra) => {
    setBusy(true);
    try {
      const { session } = await lmApi.controlTutorialSession(classId, sessionId, { action, ...extra });
      merge(session);
    } catch (err) {
      toast({ status: 'error', title: err.message });
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('End this live session? Students keep whatever they have answered.')) return;
    try {
      await lmApi.endTutorialSession(classId, sessionId);
      navigate(`/learning/class/${classId}/tutorial/${tutorialId}/results`);
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  if (starting) return <Loading label="Starting the live session…" />;
  if (startError) return <ErrorState error={startError} onRetry={start} />;
  if (!state) return <Loading label="Connecting to the board…" />;

  const openedCount = state.openedCount || 0;
  const questionCount = state.questionCount || 0;
  const openedQuestions = (state.questions || []).slice(0, openedCount);
  const ended = state.status === 'ended';

  return (
    <Box>
      <Button size="sm" variant="ghost" mb={2} onClick={() => navigate(`/learning/class/${classId}/tutorials`)}>
        ← Back to tutorials
      </Button>

      <Flex justify="space-between" align="flex-start" gap={3} mb={4} wrap="wrap">
        <Box>
          <HStack>
            <Heading size="md">{state.title}</Heading>
            <Badge colorScheme={ended ? 'gray' : 'red'} variant="solid">
              {ended ? 'Ended' : 'Live'}
            </Badge>
          </HStack>
          <Text fontSize="sm" color="lmFg.muted">
            {openedCount} of {questionCount} questions opened · {state.participantCount || 0} student
            {state.participantCount === 1 ? '' : 's'} joined
          </Text>
        </Box>
        <HStack>
          <Button
            size="sm"
            colorScheme="teal"
            onClick={() => control('openNext')}
            isDisabled={busy || ended || openedCount >= questionCount}
          >
            {openedCount === 0 ? 'Open first question' : 'Open next question'}
          </Button>
          {!ended && (
            <Button size="sm" variant="outline" colorScheme="red" onClick={end}>
              End session
            </Button>
          )}
        </HStack>
      </Flex>

      {/* The question list: what is open, and a per-question hint switch the
          teacher flips live for the one part the room is stuck on. */}
      <SectionCard title="Questions" mb={4}>
        {(state.questions || []).map((question, index) => {
          const open = index < openedCount;
          return (
            <Flex
              key={question.index}
              align="center"
              gap={3}
              py={2}
              borderTopWidth={index === 0 ? 0 : '1px'}
              borderColor="lmBorder.subtle"
              opacity={open ? 1 : 0.5}
            >
              <Badge colorScheme={open ? 'green' : 'gray'} minW="34px" textAlign="center">
                Q{index + 1}
              </Badge>
              <Box flex="1" minW={0}>
                <Text fontSize="sm" noOfLines={1}>
                  {previewText(question.prompt) || <em>(no preview)</em>}
                </Text>
                <Text fontSize="xs" color="lmFg.muted">
                  {question.slotCount} answer{question.slotCount === 1 ? '' : 's'}
                  {question.partCount ? ` · ${question.partCount} parts` : ''}
                </Text>
              </Box>
              <HStack>
                <Text fontSize="xs" color="lmFg.muted">
                  Hint
                </Text>
                <Switch
                  size="sm"
                  colorScheme="blue"
                  isChecked={Boolean((state.hints || [])[index])}
                  isDisabled={busy || ended || !question.hasHint}
                  onChange={(e) => control('setHint', { index, on: e.target.checked })}
                />
              </HStack>
            </Flex>
          );
        })}
        {!ended && openedCount < questionCount && (
          <Text fontSize="xs" color="lmFg.muted" mt={2}>
            {questionCount - openedCount} question{questionCount - openedCount === 1 ? '' : 's'} still to open.
          </Text>
        )}
      </SectionCard>

      {/* Per-student progress across the opened questions — the live "answer now"
          board. Each cell is correct/total answer slots, green when complete. */}
      <SectionCard title="Student progress">
        {openedCount === 0 ? (
          <Text fontSize="sm" color="lmFg.muted">
            Open the first question to start the board.
          </Text>
        ) : (state.students || []).length === 0 ? (
          <Text fontSize="sm" color="lmFg.muted">
            No students have opened the tutorial yet.
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>Student</Th>
                  {openedQuestions.map((question, index) => (
                    <Th key={question.index} textAlign="center">
                      Q{index + 1}
                    </Th>
                  ))}
                  <Th textAlign="center">Total</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(state.students || []).map((student) => {
                  const byIndex = new Map((student.perQuestion || []).map((cell) => [cell.index, cell]));
                  return (
                    <Tr key={String(student.studentId)}>
                      <Td>
                        <Text fontSize="sm" noOfLines={1}>
                          {student.name}
                        </Text>
                      </Td>
                      {openedQuestions.map((question) => (
                        <ProgressCell key={question.index} cell={byIndex.get(question.index)} />
                      ))}
                      <Td textAlign="center" fontWeight="600">
                        {student.totalCorrect}/{student.totalSlots}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </SectionCard>

      {error && (
        <Text fontSize="xs" color="orange.500" mt={2}>
          {error}
        </Text>
      )}
    </Box>
  );
}
