import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Code,
  Collapse,
  Divider,
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
import QuestionTypeBadge from '../components/QuestionTypeBadge';
import { decimalPlacesHint } from '../format';
import { LmIcon } from '../components/Icon';

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

/**
 * The question in full, with its answer key, for the teacher at the front.
 *
 * Values are not filled in and cannot be: every student in the room has their
 * own draw, so there is no single number to put on the board. What is common to
 * the class — the wording, the placeholders, the formula behind each answer, the
 * marks it carries and the worked solution's explanation of how you get there —
 * is exactly what a teacher talking the room through a question needs, and it is
 * what this shows.
 */
function QuestionDetail({ question }) {
  return (
    <Box mt={2} p={3} bg="lmBg.sunken" borderRadius="md">
      <RichText fontSize="sm">{question.prompt}</RichText>

      {/* The options of an MCQ/MSQ, lettered to match the answer key below. */}
      {(question.options || []).length > 0 && (
        <Box mt={2}>
          {question.options.map((option, optionIndex) => (
            <Flex key={optionIndex} gap={2} fontSize="sm" align="baseline">
              <Text fontWeight="700">{String.fromCharCode(65 + optionIndex)}.</Text>
              <RichText fontSize="sm">{option}</RichText>
            </Flex>
          ))}
        </Box>
      )}

      {(question.parts || []).map((part, partIndex) => (
        <Box key={partIndex} mt={3} pl={3} borderLeftWidth="2px" borderColor="lmHue.purple200">
          {part.label && (
            <Text fontSize="sm" fontWeight="700" color="lmHue.purple700">
              {part.label}
            </Text>
          )}
          <RichText fontSize="sm">{part.prompt}</RichText>
        </Box>
      ))}

      {(question.variables || []).length > 0 && (
        <HStack fontSize="xs" color="lmFg.muted" mt={3} wrap="wrap">
          <Text fontWeight="600">Each student draws:</Text>
          {question.variables.map((variable) => (
            <Code key={variable.name} fontSize="xs">
              {variable.name}
              {variable.type === 'set'
                ? ` ∈ {${(variable.values || []).join(', ')}}`
                : ` = ${variable.min}…${variable.max}`}
              {variable.unit ? ` ${variable.unit}` : ''}
            </Code>
          ))}
        </HStack>
      )}

      <Divider my={3} />
      <Text fontSize="xs" fontWeight="700" color="lmFg.body" mb={1}>
        Answer key
      </Text>
      {(question.answers || []).map((answer) => (
        <Flex key={answer.key} fontSize="sm" gap={2} align="baseline" wrap="wrap" mb={1}>
          {answer.partLabel && (
            <Text fontWeight="700" color="lmHue.purple700">
              {answer.partLabel}
            </Text>
          )}
          <Text fontWeight="600" minW="90px">
            {answer.label}
          </Text>
          <Code fontSize="sm">
            {answer.formula}
            {answer.unit ? ` ${answer.unit}` : ''}
          </Code>
          <Text fontSize="xs" color="lmFg.muted">
            {answer.marks} mark{answer.marks === 1 ? '' : 's'}
            {decimalPlacesHint(answer.decimals) ? ` · ${decimalPlacesHint(answer.decimals)}` : ''}
          </Text>
        </Flex>
      ))}

      {question.solution && (
        <>
          <Divider my={3} />
          <Text fontSize="xs" fontWeight="700" color="lmFg.body" mb={1}>
            Worked solution
          </Text>
          <RichText fontSize="sm">{question.solution}</RichText>
        </>
      )}

      {question.hint && (
        <Text fontSize="xs" color="blue.600" mt={2}>
          <LmIcon name="tip" size={13} style={{ marginRight: 4 }} />
          Hint (shown only when you switch it on): {question.hint.replace(/<[^>]*>/g, ' ').trim()}
        </Text>
      )}
    </Box>
  );
}

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
  // Which questions the teacher has expanded. Local, not on the session: it is
  // what *this* teacher is reading, not something the room should follow.
  const [shown, setShown] = useState({});

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
            <Box
              key={question.index}
              py={2}
              borderTopWidth={index === 0 ? 0 : '1px'}
              borderColor="lmBorder.subtle"
            >
              <Flex align="center" gap={3} opacity={open ? 1 : 0.5}>
              <Badge colorScheme={open ? 'green' : 'gray'} minW="34px" textAlign="center">
                Q{index + 1}
              </Badge>
              <QuestionTypeBadge type={question.type} flexShrink={0} />
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
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setShown((open) => ({ ...open, [index]: !open[index] }))}
                >
                  {shown[index] ? 'Hide question' : 'Show question'}
                </Button>
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
              {/* Outside the row, so the full prompt gets the card's width
                  rather than the sliver left beside the controls. */}
              <Collapse in={Boolean(shown[index])} animateOpacity>
                <QuestionDetail question={question} />
              </Collapse>
            </Box>
          );
        })}
        {!ended && openedCount < questionCount && (
          <Text fontSize="xs" color="lmFg.muted" mt={2}>
            {questionCount - openedCount} question{questionCount - openedCount === 1 ? '' : 's'} still to open.
          </Text>
        )}
      </SectionCard>

      {/* Who is not in the room. Worth chasing before you end the session: the
          tutorial is entered here, so anyone still listed will not be able to
          start it afterwards. */}
      {(state.notJoined || []).length > 0 && (
        <SectionCard
          title={`Not joined (${state.notJoined.length})`}
          subtitle="On the roster but not in this session. They can only start the tutorial while you are presenting — anyone still here when you end it will need you to present again."
          mb={4}
        >
          <HStack wrap="wrap" spacing={2}>
            {state.notJoined.map((student) => (
              <Badge key={student.studentId} colorScheme="orange" variant="subtle">
                {student.name || student.email}
              </Badge>
            ))}
          </HStack>
        </SectionCard>
      )}

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
