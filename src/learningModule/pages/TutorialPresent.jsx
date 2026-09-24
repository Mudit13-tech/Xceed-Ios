import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import { BusyDots, ErrorState, Loading, SectionCard, SectionCardSkeleton } from '../components/common';
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
const QuestionDetail = memo(function QuestionDetail({ question }) {
  return (
    <Box mt={2} p={3} bg="lmBg.sunken" borderRadius="md" overflowX="auto">
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
          <Code fontSize="sm" whiteSpace="pre-wrap" wordBreak="break-word" maxW="100%">
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
});

/**
 * The same value back for as long as its content is unchanged.
 *
 * Every frame from the board stream is freshly parsed JSON, so a student
 * pressing Check hands back a new object for every question and every row even
 * though almost nothing changed. Keying on the serialised form lets the memoised
 * rows below skip the re-render, which is most of the page.
 */
const useStableValue = (value) => {
  const key = JSON.stringify(value ?? null);
  return useMemo(() => JSON.parse(key), [key]);
};

function ProgressCell({ cell }) {
  if (!cell) {
    return (
      <Td textAlign="center" color="lmFg.faint" px={2}>
        ·
      </Td>
    );
  }
  const done = cell.complete;
  return (
    <Td
      textAlign="center"
      px={2}
      whiteSpace="nowrap"
      bg={done ? 'green.50' : cell.answered ? 'orange.50' : undefined}
      fontWeight={done ? '700' : '400'}
      color={done ? 'green.700' : undefined}
    >
      {cell.correct}/{cell.total}
      {done ? ' ✓' : ''}
    </Td>
  );
}

// The name column stays put while the question columns scroll sideways, so a
// wide board on a narrow screen still says whose row you are reading.
const stickyColumn = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  bg: 'lmBg.surface',
  minW: { base: '110px', md: '160px' },
  maxW: { base: '140px', md: '240px' },
};

/**
 * Where a student is in the session.
 *
 * Only students who joined this run are on the board, so there are just the two
 * states: still answering, or finished. Anyone who has not joined is named
 * under the board instead of carrying a row of their own — they have no
 * progress in this room to report.
 */
const STUDENT_STATUS = {
  working: { label: 'Working', colorScheme: 'blue' },
  finished: { label: 'Finished', colorScheme: 'green' },
};

const statusOf = (student) => (student.status === 'in_progress' ? 'working' : 'finished');

function StatusBadge({ status }) {
  const meta = STUDENT_STATUS[status];
  return (
    <Badge colorScheme={meta.colorScheme} variant="subtle" textTransform="none" whiteSpace="nowrap">
      {meta.label}
    </Badge>
  );
}

/** One student's row. Re-rendered only when that student's numbers change. */
const StudentRowView = memo(function StudentRowView({ student, openedIndexes }) {
  const byIndex = new Map((student.perQuestion || []).map((cell) => [cell.index, cell]));
  const status = statusOf(student);
  return (
    <Tr>
      <Td {...stickyColumn} px={2}>
        <Text fontSize="sm" noOfLines={1} title={student.name || student.email}>
          {student.name || student.email}
        </Text>
      </Td>
      <Td px={2}>
        <StatusBadge status={status} />
      </Td>
      {openedIndexes.map((index) => (
        <ProgressCell key={index} cell={byIndex.get(index)} />
      ))}
      <Td textAlign="center" fontWeight="600" px={2} whiteSpace="nowrap">
        {student.totalCorrect}/{student.totalSlots}
      </Td>
    </Tr>
  );
});

/**
 * Stabilises the row's data first: the object is new on every frame of the
 * stream, so comparing by identity alone would re-render every row every time.
 */
function StudentRow({ student, openedIndexes }) {
  const stable = useStableValue(student);
  return <StudentRowView student={stable} openedIndexes={openedIndexes} />;
}

/**
 * The question list's columns. Fixed widths on a wide screen, so every prompt
 * starts at the same place whatever its type badge says; on a phone each row
 * stacks instead — badges, then the prompt at full width, then the controls.
 */
const questionGrid = {
  display: 'grid',
  columnGap: 3,
  rowGap: 1,
  alignItems: 'center',
  gridTemplateColumns: { base: 'auto minmax(0, 1fr)', md: '44px 210px minmax(0, 1fr) 230px' },
  gridTemplateAreas: {
    base: `"num type" "prompt prompt" "controls controls"`,
    md: `"num type prompt controls"`,
  },
};

/** Column headings, shown only where the row is laid out as columns. */
function QuestionListHeader() {
  return (
    <Box
      {...questionGrid}
      display={{ base: 'none', md: 'grid' }}
      pb={2}
      borderBottomWidth="1px"
      borderColor="lmBorder.subtle"
      fontSize="xs"
      fontWeight="700"
      color="lmFg.muted"
      textTransform="uppercase"
      letterSpacing="wide"
    >
      <Text gridArea="num">#</Text>
      <Text gridArea="type">Type</Text>
      <Text gridArea="prompt">Question</Text>
      <Text gridArea="controls" textAlign="right">
        Controls
      </Text>
    </Box>
  );
}

/** One row of the question list. */
const QuestionRow = memo(function QuestionRow({
  question,
  index,
  open,
  shown,
  hintOn,
  hintPending,
  hintDisabled,
  onToggle,
  onHint,
}) {
  const dim = open ? 1 : 0.5;
  return (
    <Box py={2} borderTopWidth={index === 0 ? 0 : '1px'} borderColor="lmBorder.subtle">
      <Box {...questionGrid}>
        <Badge gridArea="num" colorScheme={open ? 'green' : 'gray'} w="38px" textAlign="center" opacity={dim}>
          Q{index + 1}
        </Badge>
        <Box gridArea="type" minW={0} opacity={dim}>
          <QuestionTypeBadge
            type={question.type}
            maxW="100%"
            overflow="hidden"
            textOverflow="ellipsis"
            verticalAlign="middle"
          />
        </Box>
        <Box gridArea="prompt" minW={0} opacity={dim}>
          <Text fontSize="sm" noOfLines={{ base: 2, md: 1 }} title={previewText(question.prompt, 400)}>
            {previewText(question.prompt) || <em>(no preview)</em>}
          </Text>
          <Text fontSize="xs" color="lmFg.muted">
            {question.slotCount} answer{question.slotCount === 1 ? '' : 's'}
            {question.partCount ? ` · ${question.partCount} parts` : ''}
          </Text>
        </Box>
        <HStack gridArea="controls" spacing={2} justify={{ base: 'space-between', md: 'flex-end' }}>
          <Button size="xs" variant="ghost" onClick={() => onToggle(index)} aria-expanded={shown}>
            {shown ? 'Hide question' : 'Show question'}
          </Button>
          <HStack spacing={2}>
            <Text fontSize="xs" color="lmFg.muted">
              Hint
            </Text>
            {hintPending && <BusyDots size="4px" color="blue.400" label="Saving the hint switch" />}
            <Switch
              size="sm"
              colorScheme="blue"
              aria-label={`Hint for question ${index + 1}`}
              isChecked={hintOn}
              isDisabled={hintDisabled}
              onChange={(e) => onHint(index, e.target.checked)}
            />
          </HStack>
        </HStack>
      </Box>
      {/* Below the row, so the full prompt gets the card's width rather than
          one column of it. Unmounted while closed: a hidden panel would
          otherwise re-render with every frame of the board. */}
      <Collapse in={shown} animateOpacity unmountOnExit>
        <QuestionDetail question={question} />
      </Collapse>
    </Box>
  );
});

const withoutKey = (object, key) => {
  const next = { ...object };
  delete next[key];
  return next;
};

export default function TutorialPresent() {
  const { classId } = useOutletContext();
  const { tutorialId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [sessionId, setSessionId] = useState(null);
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState(null);
  // What is in flight. Opening a question and ending are exclusive; hint
  // switches are tracked per question so flipping one never locks the rest.
  const [pending, setPending] = useState('');
  const [hintPending, setHintPending] = useState({});
  // The hint state the teacher just asked for, shown until the server answers
  // so the switch moves under their finger instead of a round trip later.
  const [hintWanted, setHintWanted] = useState({});
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

  const control = useCallback(
    async (action, extra) => {
      try {
        const { session } = await lmApi.controlTutorialSession(classId, sessionId, { action, ...extra });
        merge(session);
      } catch (err) {
        toast({ status: 'error', title: err.message });
      }
    },
    [classId, sessionId, merge, toast],
  );

  const openNext = async () => {
    // Guarded as well as disabled: a double tap must not skip a question.
    if (pending) return;
    setPending('openNext');
    await control('openNext');
    setPending('');
  };

  const openAll = async () => {
    if (pending) return;
    const closed = (state?.questionCount || 0) - (state?.openedCount || 0);
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Open all ${closed} remaining question${closed === 1 ? '' : 's'} to every student now?`)) return;
    setPending('openAll');
    await control('openAll');
    setPending('');
  };

  const toggleShown = useCallback((index) => setShown((prev) => ({ ...prev, [index]: !prev[index] })), []);

  const setHint = useCallback(
    async (index, on) => {
      setHintWanted((prev) => ({ ...prev, [index]: on }));
      setHintPending((prev) => ({ ...prev, [index]: true }));
      await control('setHint', { index, on });
      // Success or not, the board is the truth from here: the merged session on
      // success, the unchanged one on failure (which snaps the switch back).
      setHintWanted((prev) => withoutKey(prev, index));
      setHintPending((prev) => withoutKey(prev, index));
    },
    [control],
  );

  const end = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('End this live session? Students keep whatever they have answered.')) return;
    setPending('end');
    try {
      await lmApi.endTutorialSession(classId, sessionId);
      navigate(`/learning/class/${classId}/tutorial/${tutorialId}/results`);
    } catch (err) {
      toast({ status: 'error', title: err.message });
      setPending('');
    }
  };

  // Stabilised before any early return, so the hooks run in the same order on
  // every render.
  const questions = useStableValue(state?.questions || []);
  const hints = useStableValue(state?.hints || []);
  const openedCount = state?.openedCount || 0;
  const openedIndexes = useMemo(
    () => questions.slice(0, openedCount).map((question) => question.index),
    [questions, openedCount],
  );

  if (starting) return <Loading label="Starting the live session…" skeleton={<SectionCardSkeleton lines={4} />} />;
  if (startError) return <ErrorState error={startError} onRetry={start} />;
  if (!state) return <Loading label="Connecting to the board…" skeleton={<SectionCardSkeleton lines={4} />} />;

  const questionCount = state.questionCount || 0;
  const ended = state.status === 'ended';
  // The board is the room: one row per student who joined this session. The
  // rest of the roster is named under it, where "has not started" cannot be
  // mistaken for "started and has answered nothing".
  const board = state.students || [];
  const notJoined = state.notJoined || [];
  const statusCounts = board.reduce((counts, student) => {
    const status = statusOf(student);
    return { ...counts, [status]: (counts[status] || 0) + 1 };
  }, {});
  const statusSummary = Object.keys(STUDENT_STATUS)
    .filter((status) => statusCounts[status])
    .map((status) => `${statusCounts[status]} ${STUDENT_STATUS[status].label.toLowerCase()}`)
    .join(' · ');
  const allOpen = openedCount >= questionCount;
  const cardPadding = { base: 3, md: 5 };

  return (
    <Box>
      <Button size="sm" variant="ghost" mb={2} onClick={() => navigate(`/learning/class/${classId}/tutorials`)}>
        ← Back to tutorials
      </Button>

      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'stretch', md: 'flex-start' }}
        gap={3}
        mb={4}
      >
        <Box minW={0}>
          <HStack align="center" wrap="wrap">
            <Heading size="md" wordBreak="break-word">
              {state.title}
            </Heading>
            <Badge colorScheme={ended ? 'gray' : 'red'} variant="solid">
              {ended ? 'Ended' : 'Live'}
            </Badge>
          </HStack>
          <Text fontSize="sm" color="lmFg.muted">
            {openedCount} of {questionCount} questions opened · {state.participantCount || 0} student
            {state.participantCount === 1 ? '' : 's'} joined
          </Text>
        </Box>
        <Flex gap={2} flexShrink={0} wrap="wrap">
          <Button
            size={{ base: 'md', md: 'sm' }}
            flex={{ base: 1, md: 'initial' }}
            colorScheme="teal"
            onClick={openNext}
            aria-label={
              openedCount > 0 && openedCount < questionCount
                ? `Open next question (Q${openedCount + 1})`
                : undefined
            }
            isLoading={pending === 'openNext'}
            loadingText="Opening…"
            isDisabled={Boolean(pending) || ended || allOpen}
          >
            {openedCount === 0
              ? 'Open first question'
              : openedCount >= questionCount
                ? 'All questions open'
                : (
                  <>
                    {/* Half a phone's width fits "Open Q5" but not the full label. */}
                    <Box as="span" display={{ base: 'none', md: 'inline' }}>
                      Open next question (Q{openedCount + 1})
                    </Box>
                    <Box as="span" display={{ base: 'inline', md: 'none' }}>
                      Open Q{openedCount + 1}
                    </Box>
                  </>
                )}
          </Button>
          {/* For when the paced part is over: everything still closed goes out
              at once, so the class can work through the rest on their own. */}
          {!ended && !allOpen && (
            <Button
              size={{ base: 'md', md: 'sm' }}
              flex={{ base: 1, md: 'initial' }}
              variant="outline"
              colorScheme="teal"
              onClick={openAll}
              aria-label="Open all questions"
              isLoading={pending === 'openAll'}
              loadingText="Opening…"
              isDisabled={Boolean(pending)}
            >
              <Box as="span" display={{ base: 'none', md: 'inline' }}>
                Open all questions
              </Box>
              <Box as="span" display={{ base: 'inline', md: 'none' }}>
                Open all
              </Box>
            </Button>
          )}
          {!ended && (
            <Button
              size={{ base: 'md', md: 'sm' }}
              flex={{ base: 1, md: 'initial' }}
              variant="outline"
              colorScheme="red"
              onClick={end}
              isLoading={pending === 'end'}
              isDisabled={Boolean(pending)}
            >
              End session
            </Button>
          )}
        </Flex>
      </Flex>

      {/* The question list: what is open, and a per-question hint switch the
          teacher flips live for the one part the room is stuck on. */}
      <SectionCard title="Questions" mb={4} p={cardPadding}>
        <QuestionListHeader />
        {questions.map((question, index) => (
          <QuestionRow
            key={question.index}
            question={question}
            index={index}
            open={index < openedCount}
            shown={Boolean(shown[index])}
            hintOn={index in hintWanted ? hintWanted[index] : Boolean(hints[index])}
            hintPending={Boolean(hintPending[index])}
            hintDisabled={Boolean(hintPending[index]) || ended || !question.hasHint}
            onToggle={toggleShown}
            onHint={setHint}
          />
        ))}
        {!ended && openedCount < questionCount && (
          <Text fontSize="xs" color="lmFg.muted" mt={2}>
            {questionCount - openedCount} question{questionCount - openedCount === 1 ? '' : 's'} still to open.
          </Text>
        )}
      </SectionCard>

      {/* Per-student progress across the opened questions — the live "answer now"
          board. Each cell is correct/total answer slots, green when complete. */}
      <SectionCard
        title={`Student progress${board.length ? ` (${board.length})` : ''}`}
        subtitle={statusSummary || undefined}
        p={cardPadding}
      >
        {openedCount === 0 ? (
          <Text fontSize="sm" color="lmFg.muted">
            Open the first question to start the board.
          </Text>
        ) : board.length === 0 ? (
          <Text fontSize="sm" color="lmFg.muted">
            No students have joined yet.
          </Text>
        ) : (
          // Scrolls inside its own box with the header pinned, so a long roster
          // does not push the controls above off screen.
          <Box overflow="auto" maxH={{ base: '60vh', md: '70vh' }}>
            <Table size="sm" variant="simple">
              <Thead position="sticky" top={0} zIndex={2} bg="lmBg.surface">
                <Tr>
                  <Th {...stickyColumn} px={2} zIndex={3}>
                    Student
                  </Th>
                  <Th px={2}>Status</Th>
                  {openedIndexes.map((index) => (
                    <Th key={index} textAlign="center" px={2}>
                      Q{index + 1}
                    </Th>
                  ))}
                  <Th textAlign="center" px={2}>
                    Total
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {board.map((student) => (
                  <StudentRow key={String(student.studentId)} student={student} openedIndexes={openedIndexes} />
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
        {/* Worth chasing before you end the session: the tutorial is entered
            here, so anyone not joined when it ends cannot start it afterwards. */}
        {!ended && notJoined.length > 0 && (
          <Box mt={3}>
            <Text fontSize="xs" color="orange.600">
              {notJoined.length} student{notJoined.length === 1 ? ' has' : 's have'} not joined. They can only start
              the tutorial while you are presenting — anyone who has not joined when you end it will need you to
              present again.
            </Text>
            {/* Named, not tabulated: a register to read down while there is
                still time to chase someone, kept clear of the progress rows. */}
            <Flex wrap="wrap" gap={1} mt={2}>
              {notJoined.map((student) => (
                <Badge
                  key={String(student.studentId)}
                  colorScheme="orange"
                  variant="subtle"
                  textTransform="none"
                  fontWeight="500"
                >
                  {student.name || student.email}
                </Badge>
              ))}
            </Flex>
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
