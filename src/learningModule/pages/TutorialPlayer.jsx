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
import { formatDateTime } from '../format';

const answerId = (questionId, key) => `${questionId}:${key}`;

/**
 * The tick, cross or "checks spent" beside an answer being typed.
 *
 * Deliberately says nothing about *how* wrong a wrong answer is. No difference,
 * no "you are close" — each of those narrows the search on the next try, and the
 * whole reason instant feedback is a per-tutorial setting is that a numeric
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
 * The student's sitting of a parameterised tutorial. Their variable values
 * come from the server and are fixed for this attempt, so the paper is stable
 * across reloads.
 */
export default function TutorialPlayer() {
  const { classId } = useOutletContext();
  const { tutorialId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [tutorial, setTutorial] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [meta, setMeta] = useState({ attemptsUsed: 0, attemptsAllowed: 1, exhausted: false });
  const [inputs, setInputs] = useState({});
  /**
   * Per-answer verdicts from the server, keyed the same way as `inputs`.
   *
   * Only ever populated when the teacher turned instant feedback on for this
   * tutorial. The verdict is a boolean and a remaining-tries count — the server
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
        lmApi.getTutorial(classId, tutorialId),
        lmApi.myTutorialAttempt(classId, tutorialId),
      ]);
      setTutorial(detail);
      setAttempt(sitting.attempt);
      setMeta({
        attemptsUsed: sitting.attemptsUsed,
        attemptsAllowed: sitting.attemptsAllowed,
        exhausted: Boolean(sitting.exhausted),
      });

      // Re-hydrate a saved draft so a student can leave and come back.
      const restored = {};
      (sitting.attempt?.responses || []).forEach((response) => {
        restored[answerId(response.questionId, response.answerKey)] = response.raw;
      });
      setInputs(restored);
      submittedRef.current = sitting.attempt?.status !== 'in_progress';
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, tutorialId]);

  useEffect(() => {
    load();
  }, [load]);

  const responses = useMemo(
    () =>
      Object.entries(inputs)
        .map(([composite, raw]) => {
          const separator = composite.lastIndexOf(':');
          return {
            questionId: composite.slice(0, separator),
            answerKey: composite.slice(separator + 1),
            raw,
          };
        })
        .filter((response) => String(response.raw ?? '').trim() !== ''),
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

  const saveDraft = async () => {
    if (!attempt || attempt.status !== 'in_progress') return;
    setBusy('save');
    try {
      const result = await lmApi.saveTutorialAttempt(classId, attempt._id, responses);
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

      if (!String(raw ?? '').trim()) return;

      // Nothing to learn from re-checking a value already called correct, and it

      // would spend another try.

      if (verdicts[id]?.correct) return;

  

      setChecking(id);

      try {

        const result = await lmApi.checkTutorialAnswer(classId, tutorialId, attempt._id, {

          questionId: question.questionId,

          answerKey: answer.key,

          raw,

        });

        setVerdicts((prev) => ({ ...prev, [id]: result }));

      } catch {

        // Silent. A failed check must not read as a wrong answer, and the student

        // can still submit — marking happens server-side either way.

      } finally {

        setChecking(null);

      }

    },

    [attempt, classId, tutorialId, inputs, verdicts, submitted],

  );


  const submit = async () => {
    if (submittedRef.current) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm('Submit this tutorial? Your answers will be marked immediately.')) return;

    submittedRef.current = true;
    setBusy('submit');
    try {
      const result = await lmApi.submitTutorialAttempt(classId, attempt._id, responses);
      setAttempt(result.attempt);
      toast({
        status: result.attempt.passed ? 'success' : 'info',
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
  if (!tutorial) return null;

  if (!attempt) {
    return (
      <SectionCard title={tutorial.title}>
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          This tutorial is not open for you right now.
        </Alert>
        <Button mt={4} size="sm" onClick={() => navigate(`/learning/class/${classId}/tutorials`)}>
          Back to tutorials
        </Button>
      </SectionCard>
    );
  }

  const answeredCount = responses.length;
  const byKey = new Map((attempt.responses || []).map((r) => [answerId(r.questionId, r.answerKey), r]));

  return (
    <Box>
      <Button size="sm" variant="ghost" mb={2} onClick={() => navigate(`/learning/class/${classId}/tutorials`)}>
        ← Back to tutorials
      </Button>

      <Flex justify="space-between" align="flex-start" gap={3} mb={4} wrap="wrap">
        <Box>
          <Heading size="md">{tutorial.title}</Heading>
          {tutorial.description && (
            <Text fontSize="sm" color="lmFg.subtle">
              {tutorial.description}
            </Text>
          )}
          <HStack fontSize="xs" color="lmFg.muted" mt={1} wrap="wrap">
            <Text>
              Attempt {attempt.attemptNumber} of {meta.attemptsAllowed}
            </Text>
            {tutorial.settings?.dueDate && <Text>Due {formatDateTime(tutorial.settings.dueDate)}</Text>}
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

      <Alert status="info" borderRadius="md" mb={4} fontSize="sm">
        <AlertIcon />
        <Box>
          Your figures are unique to you — comparing final answers with a classmate will not help, but
          comparing <em>method</em> will. You may type an expression such as <Code fontSize="xs">2*pi*3</Code>{' '}
          instead of a decimal.
        </Box>
      </Alert>

      {submitted && (
        <Flex gap={3} mb={5} wrap="wrap">
          <StatTile label="Score" value={`${attempt.score}/${attempt.maxScore}`} />
          <StatTile
            label="Percent"
            value={`${attempt.percent}%`}
            accent={attempt.passed ? 'green.500' : 'red.500'}
          />
          <StatTile
            label="Outcome"
            value={attempt.passed ? 'Passed' : 'Not passed'}
            accent={attempt.passed ? 'green.500' : 'red.500'}
          />
          {meta.attemptsUsed < meta.attemptsAllowed && (
            <Box>
              <Button
                mt={2}
                size="sm"
                colorScheme="teal"
                variant="outline"
                onClick={async () => {
                  submittedRef.current = false;
                  setLoading(true);
                  await load();
                }}
              >
                Start attempt {meta.attemptsUsed + 1}
              </Button>
            </Box>
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
            <Heading size="sm">Question {index + 1}</Heading>
            <Badge colorScheme="gray">
              {question.answers.reduce((sum, a) => sum + a.marks, 0)} marks
            </Badge>
          </Flex>

          <Box mb={3}>
            <RichText>{question.prompt}</RichText>
          </Box>

          <HStack fontSize="xs" color="lmFg.muted" mb={3} wrap="wrap">
            <Text>Your values:</Text>
            {Object.entries(question.values).map(([name, value]) => (
              <Code key={name} fontSize="xs">
                {name} = {String(value)}
              </Code>
            ))}
          </HStack>

          {question.hint && !submitted && (
            <Flex fontSize="xs" color="blue.600" mb={3} gap={1}>
              <Text>💡</Text>
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
                  <Text fontSize="sm" fontWeight="700" color="purple.600" minW="30px">
                    {group.label}
                  </Text>
                  <Box flex="1">
                    <RichText fontSize="sm">{group.prompt}</RichText>
                  </Box>
                </Flex>
              ) : null}
              <Box pl={group.prompt ? 8 : 0}>
          {group.answers.map((answer) => {
            const id = answerId(question.questionId, answer.key);
            const graded = byKey.get(id);
            return (
              <Box key={answer.key} mb={3}>
                <Flex align="center" gap={3} wrap="wrap">
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
                      onChange={(event) => {
                        setInputs((prev) => ({ ...prev, [id]: event.target.value }));
                        // The old verdict describes the old value. Clearing it as
                        // soon as they type stops a green tick sitting beside a
                        // number they have since changed.
                        if (verdicts[id]) {
                          setVerdicts((prev) => {
                            const next = { ...prev };
                            delete next[id];
                            return next;
                          });
                        }
                      }}
                      onBlur={() => checkOne(question, answer)}
                    />
                    {answer.unit && <InputRightAddon>{answer.unit}</InputRightAddon>}
                  </InputGroup>

                  {/* The tick. Only ever present when the teacher switched instant
                      feedback on for this tutorial. */}
                  {!submitted && attempt.instantFeedback && (
                    <LiveVerdict verdict={verdicts[id]} busy={checking === id} />
                  )}
                  <Text fontSize="xs" color="lmFg.muted">
                    {answer.marks} mark{answer.marks === 1 ? '' : 's'}
                  </Text>
                  {submitted && graded && (
                    <Badge colorScheme={graded.correct ? 'green' : 'red'}>
                      {graded.correct ? `+${graded.awarded}` : '0'}
                    </Badge>
                  )}
                  {answer.unavailable && (
                    <Badge colorScheme="orange">Not markable — tell your teacher</Badge>
                  )}
                </Flex>
                {submitted && answer.expected !== undefined && (
                  <Text fontSize="xs" color="lmFg.subtle" mt={1} ml="122px">
                    Correct answer: <b>{Math.round(answer.expected * 1e6) / 1e6}</b> {answer.unit}
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
            Submit tutorial ({answeredCount}/{totalSlots} answered)
          </Button>
        </>
      )}
    </Box>
  );
}
