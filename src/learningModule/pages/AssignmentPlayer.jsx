import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Flex,
  HStack,
  Heading,
  Input,
  InputGroup,
  InputRightAddon,
  Progress,
  Spinner,
  Text,
  Tooltip,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { ErrorState, Loading, SectionCard, StatTile } from '../components/common';
import RichText from '../components/RichText';
import ChoiceAnswerInput from '../components/ChoiceAnswerInput';
import QuestionTypeBadge from '../components/QuestionTypeBadge';
import { hasAnswer, isChoiceQuestion } from '../questionTypes';
import AssignmentUploads from '../components/AssignmentUploads';
import { decimalPlacesHint, formatAnswerValue, formatDateTime } from '../format';
import { LmIcon } from '../components/Icon';

const answerId = (questionId, key) => `${questionId}:${key}`;

/**
 * The tick, cross or "checks spent" beside an answer being typed.
 *
 * Deliberately says nothing about *how* wrong a wrong answer is. No difference,
 * no "you are close" — each of those narrows the search on the next try, and the
 * whole reason instant feedback is a per-assignment setting is that a numeric
 * answer with feedback is brute-forceable. Orange rather than red, because
 * before submission this is a nudge and not a mark.
 */
function LiveVerdict({ verdict, busy }) {
  if (busy) return <Spinner size="xs" color="lmFg.faint" />;
  if (!verdict) return null;

  if (verdict.checkable === false) {
    return (
      <Tooltip label={verdict.message || ''}>
        <Badge colorScheme="gray" fontSize="0.65rem">no checks left</Badge>
      </Tooltip>
    );
  }

  const remaining = Math.max(0, (verdict.checksAllowed || 0) - (verdict.checksUsed || 0));

  return verdict.correct ? (
    <Tooltip label="Correct — this is what the marking will award.">
      <Badge colorScheme="green" fontSize="0.8rem" px={2}>✓</Badge>
    </Tooltip>
  ) : (
    <Tooltip
      label={
        remaining
          ? `Not right yet. ${remaining} check${remaining === 1 ? '' : 's'} left on this answer.`
          : 'Not right yet, and that was your last check. You can still submit.'
      }
    >
      <Badge colorScheme="orange" fontSize="0.65rem">
        not yet{remaining ? ` · ${remaining} left` : ''}
      </Badge>
    </Tooltip>
  );
}

/**
 * Splits a question's answer slots into the groups a student reads: the stem's
 * own answers first, then one group per sub-question with its prompt above it.
 *
 * Driven off `partIndex` on each slot rather than off the parts array, so a slot
 * whose part was deleted after the attempt was generated still renders — under
 * its stored label — instead of disappearing from a paper the student has
 * already been marked on.
 */
function answerGroups(question) {
  const groups = [];
  const stem = (question.answers || []).filter((answer) => answer.partIndex === null || answer.partIndex === undefined);
  if (stem.length) groups.push({ key: 'stem', label: '', prompt: '', answers: stem });

  const parts = question.parts || [];
  const byPart = new Map();
  (question.answers || []).forEach((answer) => {
    if (answer.partIndex === null || answer.partIndex === undefined) return;
    if (!byPart.has(answer.partIndex)) byPart.set(answer.partIndex, []);
    byPart.get(answer.partIndex).push(answer);
  });

  [...byPart.keys()].sort((a, b) => a - b).forEach((partIndex) => {
    const answers = byPart.get(partIndex);
    groups.push({
      key: `part-${partIndex}`,
      label: parts[partIndex]?.label || answers[0]?.partLabel || '',
      prompt: parts[partIndex]?.prompt || '',
      answers,
    });
  });

  return groups;
}

/**
 * The student's sitting of a parameterised assignment. Their variable values
 * come from the server and are fixed for this attempt, so the paper is stable
 * across reloads.
 */
export default function AssignmentPlayer() {
  const { classId } = useOutletContext();
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [assignment, setAssignment] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [inputs, setInputs] = useState({});
  /**
   * Per-answer verdicts from the server, keyed the same way as `inputs`.
   *
   * Only ever populated when the teacher turned instant feedback on for this
   * assignment. The verdict is a boolean and a remaining-tries count — the server
   * deliberately never sends the expected value, because one request that leaked
   * it would be the answer key.
   */
  const [verdicts, setVerdicts] = useState({});
  const [checking, setChecking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const submittedRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detail, sitting] = await Promise.all([
        lmApi.getAssignment(classId, assignmentId),
        lmApi.myAssignmentAttempt(classId, assignmentId),
      ]);
      setAssignment(detail);
      setAttempt(sitting.attempt);
      setUploads(sitting.attempt?.uploads || []);

      // Re-hydrate a saved draft so a student can leave and come back.
      const restored = {};
      (sitting.attempt?.responses || []).forEach((response) => {
        // A choice answer comes back as the options ticked; anything else as typed.
        restored[answerId(response.questionId, response.answerKey)] = response.selected?.length
          ? response.selected.map(String)
          : response.raw;
      });
      setInputs(restored);
      submittedRef.current = sitting.attempt?.status !== 'in_progress';
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const responses = useMemo(
    () =>
      Object.entries(inputs)
        .filter(([, value]) => hasAnswer(value))
        .map(([composite, value]) => {
          const separator = composite.lastIndexOf(':');
          return {
            questionId: composite.slice(0, separator),
            answerKey: composite.slice(separator + 1),
            // A choice question's answer is the options ticked; anything else is typed.
            ...(Array.isArray(value) ? { selected: value } : { raw: value }),
          };
        }),
    [inputs],
  );

  const totalSlots = useMemo(
    () => (attempt?.questions || []).reduce((sum, question) => sum + question.answers.length, 0),
    [attempt],
  );

  // Declared before checkOne below, which closes over it: hooks run
  // unconditionally on every render, before the `!attempt` early return, so
  // this cannot be pushed down next to its other use without a
  // temporal-dead-zone crash on first render.
  const submitted = attempt?.status !== 'in_progress';
  // Neutral when the assignment sets no pass mark: green/red would be a verdict
  // on a test the teacher never set.
  const passAccent =
    attempt?.passed === null || attempt?.passed === undefined
      ? undefined
      : attempt.passed
        ? 'green.500'
        : 'red.500';

  const saveDraft = async () => {
    if (!attempt || attempt.status !== 'in_progress') return;
    setBusy('save');
    try {
      const result = await lmApi.saveAssignmentAttempt(classId, attempt._id, responses);
      setSavedAt(result.savedAt);
      toast({ status: 'success', title: 'Progress saved', duration: 1500 });
    } catch (err) {
      toast({ status: 'error', title: err.message });
    } finally {
      setBusy('');
    }
  };

  /**

   * Asks the server whether one answer is right.

   *

   * Fired on blur rather than on every keystroke: a check costs a request and

   * spends one of the student's tries, and checking half-typed numbers would

   * burn the budget before they had finished the first one.

   */

  const checkOne = useCallback(

    async (question, answer) => {

      if (!attempt?.instantFeedback || submitted) return;

      const id = answerId(question.questionId, answer.key);

      const raw = inputs[id];

      if (!hasAnswer(raw)) return;

      // Nothing to learn from re-checking a value already called correct, and it

      // would spend another try.

      if (verdicts[id]?.correct) return;

  

      setChecking(id);

      try {

        const result = await lmApi.checkAssignmentAnswer(classId, assignmentId, attempt._id, {

          questionId: question.questionId,

          answerKey: answer.key,

          ...(Array.isArray(raw) ? { selected: raw } : { raw }),

        });

        setVerdicts((prev) => ({ ...prev, [id]: result }));

      } catch {

        // Silent. A failed check must not read as a wrong answer, and the student

        // can still submit — marking happens server-side either way.

      } finally {

        setChecking(null);

      }

    },

    [attempt, classId, assignmentId, inputs, verdicts, submitted],

  );


  const submit = async () => {
    if (submittedRef.current) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm('Submit this assignment? Your answers will be marked immediately.')) return;

    submittedRef.current = true;
    setBusy('submit');
    try {
      const result = await lmApi.submitAssignmentAttempt(classId, attempt._id, responses);
      setAttempt(result.attempt);
      toast({
        status: result.attempt.passed === false ? 'info' : 'success',
        title: `Scored ${result.attempt.score}/${result.attempt.maxScore} (${result.attempt.percent}%)`,
      });
    } catch (err) {
      submittedRef.current = false;
      toast({ status: 'error', title: err.message });
    } finally {
      setBusy('');
    }
  };

  if (loading) return <Loading label="Preparing your questions…" />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!assignment) return null;

  if (!attempt) {
    return (
      <SectionCard title={assignment.title}>
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          This assignment is not open for you right now.
        </Alert>
        <Button mt={4} size="sm" onClick={() => navigate(`/learning/class/${classId}/assignments`)}>
          Back to assignments
        </Button>
      </SectionCard>
    );
  }

  const answeredCount = responses.length;
  const byKey = new Map((attempt.responses || []).map((r) => [answerId(r.questionId, r.answerKey), r]));
  // Whether any question draws its own numbers — the note about unique figures
  // and typed expressions is only true of those.
  const anyParametric = (attempt.questions || []).some((question) => !question.type || question.type === 'parametric');

  // Writing an answer clears its old verdict: a tick describes the value it was
  // given for, not one the student has since changed.
  const setAnswer = (id, value) => {
    setInputs((prev) => ({ ...prev, [id]: value }));
    if (verdicts[id]) {
      setVerdicts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <Box>
      <Button size="sm" variant="ghost" mb={2} onClick={() => navigate(`/learning/class/${classId}/assignments`)}>
        ← Back to assignments
      </Button>

      <Flex justify="space-between" align="flex-start" gap={3} mb={4} wrap="wrap">
        <Box>
          <Heading size="md">{assignment.title}</Heading>
          {assignment.description && (
            <Text fontSize="sm" color="lmFg.subtle">
              {assignment.description}
            </Text>
          )}
          <HStack fontSize="xs" color="lmFg.muted" mt={1} wrap="wrap">
            {assignment.settings?.dueDate && <Text>Due {formatDateTime(assignment.settings.dueDate)}</Text>}
            {attempt.late && <Badge colorScheme="red">Late</Badge>}
          </HStack>
        </Box>
        {!submitted && (
          <HStack>
            <Button size="sm" variant="outline" onClick={saveDraft} isLoading={busy === 'save'}>
              Save progress
            </Button>
            <Button size="sm" colorScheme="teal" onClick={submit} isLoading={busy === 'submit'}>
              Submit
            </Button>
          </HStack>
        )}
      </Flex>

      {anyParametric && (
        <Alert status="info" borderRadius="md" mb={4} fontSize="sm">
          <AlertIcon />
          <Box>
            Your figures are unique to you — comparing final answers with a classmate will not help, but
            comparing <em>method</em> will. You may type an expression such as <Code fontSize="xs">2*pi*3</Code>{' '}
            instead of a decimal.{' '}
            {/* Written out because there is no way to discover it: ∠ is the form the
                teacher's own reference shows, and it is on no keyboard a student has. */}
            A complex answer goes in as <Code fontSize="xs">3+4i</Code> (<Code fontSize="xs">j</Code> works
            too) or in polar form as <Code fontSize="xs">polar(5, 45)</Code> — magnitude, then angle in
            degrees.
          </Box>
        </Alert>
      )}

      {submitted && (
        <Flex gap={3} mb={5} wrap="wrap">
          <StatTile label="Score" value={`${attempt.score}/${attempt.maxScore}`} />
          <StatTile
            label="Percent"
            value={`${attempt.percent}%`}
            accent={passAccent}
          />
          {/* Only where there is a bar to clear. An assignment with no pass mark
              set says nothing about passing rather than saying "not passed". */}
          {attempt.passed !== null && attempt.passed !== undefined && (
            <StatTile label="Outcome" value={attempt.passed ? 'Passed' : 'Not passed'} accent={passAccent} />
          )}
        </Flex>
      )}

      {attempt.teacherFeedback && (
        <Alert status="success" borderRadius="md" mb={4} fontSize="sm">
          <AlertIcon />
          <Box>
            <Text fontWeight="600">Teacher feedback</Text>
            <Text>{attempt.teacherFeedback}</Text>
          </Box>
        </Alert>
      )}

      {attempt.allowFileUpload && (
        <AssignmentUploads
          classId={classId}
          attemptId={attempt._id}
          uploads={uploads}
          // Editable while the deadline has not passed — a student may add their
          // working before or after submitting the numbers, but the server closes
          // it at the deadline, so the widget stops offering it there too.
          canEdit={!(assignment.settings?.dueDate && new Date() > new Date(assignment.settings.dueDate))}
          onChange={setUploads}
        />
      )}

      {!submitted && totalSlots > 0 && (
        <Progress
          value={(answeredCount / totalSlots) * 100}
          size="xs"
          colorScheme="teal"
          borderRadius="full"
          mb={4}
        />
      )}

      {attempt.questions.map((question, index) => (
        <SectionCard key={question.questionId} mb={4}>
          <Flex justify="space-between" gap={3} mb={2}>
            <HStack spacing={2}>
              <Heading size="sm">Question {index + 1}</Heading>
              <QuestionTypeBadge question={question} />
            </HStack>
            <Badge colorScheme="gray">
              {question.answers.reduce((sum, a) => sum + a.marks, 0)} marks
            </Badge>
          </Flex>

          <Box mb={3}>
            <RichText>{question.prompt}</RichText>
          </Box>

          {Object.keys(question.values || {}).length > 0 && (
            <HStack fontSize="xs" color="lmFg.muted" mb={3} wrap="wrap">
              <Text>Your values:</Text>
              {Object.entries(question.values).map(([name, value]) => (
                <Code key={name} fontSize="xs">
                  {name} = {String(value)}
                </Code>
              ))}
            </HStack>
          )}

          {question.hint && !submitted && (
            <Flex fontSize="xs" color="blue.600" mb={3} gap={1}>
              <Box color="orange.400">
                <LmIcon name="tip" size={18} />
              </Box>
              <RichText fontSize="xs" color="blue.600">
                {question.hint}
              </RichText>
            </Flex>
          )}

          {/* Grouped by sub-question when the question has parts. The answer
              slots are untouched — each still carries its own marks and its own
              graded verdict — so a parts question and a flat one mark
              identically and only read differently. */}
          {answerGroups(question).map((group) => (
            <Box key={group.key} mb={group.prompt ? 4 : 0}>
              {group.prompt ? (
                <Flex gap={2} mb={2} align="baseline">
                  {/* Only when the teacher named the part. Parts are no longer
                      auto-lettered, and an empty label would otherwise indent
                      every unlabelled sub-question behind a blank gutter. */}
                  {group.label && (
                    <Text fontSize="sm" fontWeight="700" color="purple.600" minW="30px">
                      {group.label}
                    </Text>
                  )}
                  <Box flex="1">
                    <RichText fontSize="sm">{group.prompt}</RichText>
                  </Box>
                </Flex>
              ) : null}
              <Box pl={group.prompt ? 8 : 0}>
          {group.answers.map((answer) => {
            const id = answerId(question.questionId, answer.key);
            const graded = byKey.get(id);
            const choice = isChoiceQuestion(question);
            return (
              <Box key={answer.key} mb={3}>
                {choice && (
                  <Box mb={2}>
                    <ChoiceAnswerInput
                      name={id}
                      type={question.type}
                      options={question.options || []}
                      value={Array.isArray(inputs[id]) ? inputs[id] : []}
                      readOnly={submitted}
                      correct={submitted ? answer.correct : undefined}
                      onChange={(next) => setAnswer(id, next)}
                    />
                  </Box>
                )}
                <Flex align="center" gap={3} wrap="wrap">
                  {!choice && (
                    <>
                  <Text fontSize="sm" fontWeight="500" minW="110px">
                    {answer.label}
                  </Text>
                  <InputGroup size="sm" maxW="240px">
                    <Input
                      value={inputs[id] ?? ''}
                      isReadOnly={submitted}
                      placeholder="Your answer"
                      borderColor={
                        submitted
                          ? (graded?.correct ? 'green.400' : 'red.400')
                          // Before submitting, the border follows the live check
                          // when there is one. Green only for a confirmed right
                          // answer — an unchecked box stays neutral rather than
                          // implying anything.
                          : verdicts[id]?.checkable === false
                            ? undefined
                            : verdicts[id]?.correct === true
                              ? 'green.400'
                              : verdicts[id]?.correct === false
                                ? 'orange.400'
                                : undefined
                      }
                      onChange={(event) => setAnswer(id, event.target.value)}
                    />
                    {answer.unit && <InputRightAddon>{answer.unit}</InputRightAddon>}
                  </InputGroup>
                    </>
                  )}

                  {/* The tick. Only ever present when the teacher switched instant
                      feedback on for this assignment. */}
                  {!submitted && attempt.instantFeedback && (
                    <>
                      {/* Checking is deliberate, not incidental.
                       *
                       * This used to fire on blur, so tabbing out of a field —
                       * or clicking anywhere else — silently spent one of a
                       * small number of tries on a half-typed number. A button
                       * spends a try only when the student meant to. */}
                      <Button
                        size="xs"
                        variant="outline"
                        colorScheme="blue"
                        isLoading={checking === id}
                        isDisabled={
                          !hasAnswer(inputs[id]) ||
                          Boolean(verdicts[id]?.correct) ||
                          verdicts[id]?.checkable === false
                        }
                        onClick={() => checkOne(question, answer)}
                      >
                        Check
                      </Button>
                      <LiveVerdict verdict={verdicts[id]} busy={checking === id} />
                    </>
                  )}
                  <Text fontSize="xs" color="lmFg.muted">
                    {answer.marks} mark{answer.marks === 1 ? '' : 's'}
                  </Text>
                  {/* The precision the teacher asked for. Shown while the paper is
                      still open — being told to round *after* submitting is no use. */}
                  {decimalPlacesHint(answer.decimals) && (
                    <Text fontSize="xs" color="lmFg.muted" fontStyle="italic">
                      give your answer {decimalPlacesHint(answer.decimals)}
                    </Text>
                  )}
                  {submitted && graded && (
                    <Badge colorScheme={graded.correct ? 'green' : 'red'}>
                      {graded.correct ? `+${graded.awarded}` : '0'}
                    </Badge>
                  )}
                  {answer.unavailable && (
                    <Badge colorScheme="orange">Not markable — tell your teacher</Badge>
                  )}
                </Flex>
                {/* A choice question shows its key on the options themselves. */}
                {submitted && !choice && answer.expected !== undefined && (
                  <Text fontSize="xs" color="lmFg.subtle" mt={1} ml="122px">
                    Correct answer: <b>{formatAnswerValue(answer.expected, answer.decimals)}</b> {answer.unit}
                  </Text>
                )}
              </Box>
            );
          })}
              </Box>
            </Box>
          ))}

          {submitted && question.solution && (
            <>
              <Divider my={3} />
              <Text fontSize="xs" fontWeight="600" color="lmFg.subtle" mb={1}>
                Worked solution
              </Text>
              <RichText>{question.solution}</RichText>
            </>
          )}
        </SectionCard>
      ))}

      {!submitted && (
        <>
          {savedAt && (
            <Text fontSize="xs" color="lmFg.muted" mb={2}>
              Draft saved {formatDateTime(savedAt)}
            </Text>
          )}
          <Button colorScheme="teal" size="lg" w="100%" onClick={submit} isLoading={busy === 'submit'}>
            Submit assignment ({answeredCount}/{totalSlots} answered)
          </Button>
        </>
      )}
    </Box>
  );
}
