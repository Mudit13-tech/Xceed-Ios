import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Input,
  Select,
  Text,
  Tooltip,
  VStack,
  useToast,
} from '@chakra-ui/react';

import lmApi from '../api/lmApi';
import RichText from '../components/RichText';
import RichTextEditor from '../components/RichTextEditor';
import { ErrorState, Loading, SectionCard } from '../components/common';
import { formatAnswerValue } from '../format';
import { LmIcon } from '../components/Icon';

/**
 * Building a parameterised tutorial from a photographed or scanned paper.
 *
 * Four stages, with the teacher between each pair: read the paper, choose the
 * variables, derive the answers, merge. Nothing here publishes anything — the
 * merge produces an unpublished tutorial that still has to be reviewed and
 * released like any other.
 *
 * The screen is built around the verification badges. Everything the model
 * produces is a proposal, and the one thing that separates a usable proposal
 * from a plausible-looking wrong one is whether the formula reproduced the
 * paper's own answer. That verdict is the most prominent thing on each answer,
 * deliberately.
 */

const STATUS_STYLE = {
  verified: { colorScheme: 'green', label: '✓ matches the paper' },
  mismatch: { colorScheme: 'red', label: '✗ does not match' },
  unverified: { colorScheme: 'orange', label: '? not checkable' },
  invalid: { colorScheme: 'red', label: '✗ will not parse' },
  error: { colorScheme: 'red', label: '✗ fails on these values' },
};

function VerificationBadge({ verification }) {
  const style = STATUS_STYLE[verification?.status] || STATUS_STYLE.unverified;
  return (
    <Tooltip label={verification?.message || ''}>
      <Badge colorScheme={style.colorScheme}>{style.label}</Badge>
    </Tooltip>
  );
}

/** One variable, as the teacher adjusts what the model proposed. */
function VariableRow({ variable, onChange, onRemove }) {
  const set = (field, value) => onChange({ ...variable, [field]: value, accepted: false });

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} mb={2}>
      <Flex gap={2} wrap="wrap" align="flex-end">
        <FormControl maxW="110px">
          <FormLabel fontSize="xs" mb={1}>Name</FormLabel>
          <Input size="sm" value={variable.name} onChange={(e) => set('name', e.target.value)} />
        </FormControl>
        <FormControl maxW="130px">
          <FormLabel fontSize="xs" mb={1}>Type</FormLabel>
          <Select size="sm" value={variable.type} onChange={(e) => set('type', e.target.value)}>
            <option value="range">Decimal</option>
            <option value="integer">Integer</option>
            <option value="set">From a list</option>
          </Select>
        </FormControl>

        {variable.type === 'set' ? (
          <FormControl maxW="220px">
            <FormLabel fontSize="xs" mb={1}>Values</FormLabel>
            <Input
              size="sm"
              value={(variable.values || []).join(', ')}
              onChange={(e) => set('values', e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
            />
          </FormControl>
        ) : (
          <>
            <FormControl maxW="90px">
              <FormLabel fontSize="xs" mb={1}>Min</FormLabel>
              <Input size="sm" type="number" value={variable.min} onChange={(e) => set('min', Number(e.target.value))} />
            </FormControl>
            <FormControl maxW="90px">
              <FormLabel fontSize="xs" mb={1}>Max</FormLabel>
              <Input size="sm" type="number" value={variable.max} onChange={(e) => set('max', Number(e.target.value))} />
            </FormControl>
            <FormControl maxW="90px">
              <FormLabel fontSize="xs" mb={1}>Step</FormLabel>
              <Input size="sm" type="number" value={variable.step} onChange={(e) => set('step', Number(e.target.value))} />
            </FormControl>
          </>
        )}

        <FormControl maxW="90px">
          <FormLabel fontSize="xs" mb={1}>Unit</FormLabel>
          <Input size="sm" value={variable.unit || ''} onChange={(e) => set('unit', e.target.value)} />
        </FormControl>
        <Button size="xs" variant="ghost" colorScheme="red" onClick={onRemove}>Remove</Button>
      </Flex>

      <Flex gap={3} mt={2} wrap="wrap" fontSize="xs" color="lmFg.subtle">
        {/* The paper's own value, and the reason it cannot simply be dropped:
            it is what the derived formula is checked against. */}
        <Text>
          On the paper: <Code fontSize="xs">{String(variable.sourceValue)}</Code>
        </Text>
        {variable.reason && <Text fontStyle="italic">{variable.reason}</Text>}
      </Flex>
    </Box>
  );
}

function DraftQuestion({ classId, draftId, question, index, onChanged, selected, onSelect }) {
  const [working, setWorking] = useState(false);
  const [unplaced, setUnplaced] = useState([]);
  const toast = useToast();

  const run = async (fn, label) => {
    setWorking(true);
    try {
      const result = await fn();
      if (result.unplaced) setUnplaced(result.unplaced);
      onChanged(result.question || result);
    } catch (err) {
      toast({ status: 'error', title: `${label}: ${err.message}`, duration: 8000 });
    } finally {
      setWorking(false);
    }
  };

  const save = (changes) =>
    run(() => lmApi.updateImportQuestion(classId, draftId, question._id, changes), 'Could not save');

  const attention = (question.answers || []).filter((a) => a.verification?.status !== 'verified').length;

  return (
    <SectionCard mb={4}>
      <Flex justify="space-between" gap={3} mb={2} wrap="wrap">
        <HStack>
          <Checkbox isChecked={selected} onChange={(e) => onSelect(e.target.checked)}>
            <Heading size="sm">Question {index + 1}</Heading>
          </Checkbox>
        </HStack>
        <HStack>
          {question.answers?.length > 0 && (
            <Badge colorScheme={attention ? 'orange' : 'green'}>
              {attention ? `${attention} to check` : 'all checked'}
            </Badge>
          )}
        </HStack>
      </Flex>

      <FormControl mb={3}>
        <FormLabel fontSize="xs">Question, with the paper’s numbers replaced by variables</FormLabel>
        {/* The same editor as hand-authoring, and given the variable list so the
            insert button writes a placeholder the substitution will actually
            match. Typing {{R}} by hand through a rich text editor is how you end
            up with formatting inside the braces, which silently stops it
            substituting — prepareQuestions catches that at merge, but it is
            better not to create it. */}
        <RichTextEditor
          value={question.prompt}
          onChange={(value) => onChanged({ ...question, prompt: value })}
          variables={(question.variables || []).map((variable) => variable.name).filter(Boolean)}
          placeholder="A resistor of {{R}} Ω carries {{I}} A…"
        />
        <Button size="xs" variant="link" mt={1} onClick={() => save({ prompt: question.prompt })}>
          Save wording
        </Button>
      </FormControl>

      {question.parts?.length > 0 && (
        <Box mb={3} pl={3} borderLeftWidth="2px" borderColor="lmHue.purple200">
          {question.parts.map((part, i) => (
            <Box key={i} mb={3}>
              <Flex gap={2} align="center" mb={1}>
                <Input
                  size="xs"
                  maxW="90px"
                  value={part.label}
                  onChange={(e) => {
                    const parts = question.parts.map((p, j) => (j === i ? { ...p, label: e.target.value } : p));
                    onChanged({ ...question, parts });
                  }}
                />
                {part.answerText && (
                  <Text fontSize="xs" color="lmFg.muted">Paper’s answer: {part.answerText}</Text>
                )}
              </Flex>
              {/* Editable for the same reason the stem is: transcription gets
                  sub-question wording wrong more often than the stem — a figure
                  reference, a symbol the OCR guessed at. */}
              <RichTextEditor
                value={part.prompt}
                onChange={(value) => {
                  const parts = question.parts.map((p, j) => (j === i ? { ...p, prompt: value } : p));
                  onChanged({ ...question, parts });
                }}
                variables={(question.variables || []).map((variable) => variable.name).filter(Boolean)}
                compact
              />
            </Box>
          ))}
          <Button size="xs" variant="link" onClick={() => save({ parts: question.parts })}>
            Save sub-questions
          </Button>
        </Box>
      )}

      {unplaced.length > 0 && (
        <Alert status="warning" fontSize="xs" borderRadius="md" mb={3}>
          <AlertIcon />
          {unplaced.join(', ')} {unplaced.length === 1 ? 'does' : 'do'} not appear in the question text.
          Add {unplaced.length === 1 ? 'its' : 'their'} {'{{placeholder}}'} by hand, or the value will be
          drawn but never shown.
        </Alert>
      )}

      <Divider my={3} />
      <Flex justify="space-between" align="center" mb={2}>
        <Heading size="xs" color="lmFg.body">Variables</Heading>
        <Button
          size="xs"
          variant="outline"
          isLoading={working}
          onClick={() => run(() => lmApi.suggestImportVariables(classId, draftId, question._id), 'Suggestion failed')}
        >
          {question.variables?.length ? (
                        'Suggest again'
                      ) : (
                        <>
                          <LmIcon name="ai" size={13} style={{ marginRight: 4 }} />
                          Suggest variables
                        </>
                      )}
        </Button>
      </Flex>

      {(question.variables || []).map((variable, i) => (
        <VariableRow
          key={i}
          variable={variable}
          onChange={(updated) => {
            const variables = question.variables.map((v, j) => (j === i ? updated : v));
            onChanged({ ...question, variables });
          }}
          onRemove={() => save({ variables: question.variables.filter((_, j) => j !== i) })}
        />
      ))}
      {question.variables?.length > 0 && (
        <Button size="xs" variant="link" onClick={() => save({ variables: question.variables })}>
          Save variable changes
        </Button>
      )}

      <Divider my={3} />
      <Flex justify="space-between" align="center" mb={2}>
        <Heading size="xs" color="lmFg.body">Answers</Heading>
        <Button
          size="xs"
          colorScheme="purple"
          variant="outline"
          isLoading={working}
          isDisabled={!question.variables?.length}
          onClick={() => run(() => lmApi.deriveImportAnswers(classId, draftId, question._id), 'Derivation failed')}
        >
          <LmIcon name="ai" size={14} style={{ marginRight: 6 }} />
          Derive answers from the paper
        </Button>
      </Flex>

      {(question.answers || []).map((answer, i) => (
        <Box key={i} borderWidth="1px" borderRadius="md" p={3} mb={2}>
          <Flex gap={2} wrap="wrap" align="flex-end" mb={2}>
            <FormControl maxW="150px">
              <FormLabel fontSize="xs" mb={1}>Label</FormLabel>
              <Input size="sm" value={answer.label} onChange={(e) => {
                const answers = question.answers.map((a, j) => (j === i ? { ...a, label: e.target.value } : a));
                onChanged({ ...question, answers });
              }} />
            </FormControl>
            <FormControl flex="1" minW="180px">
              <FormLabel fontSize="xs" mb={1}>Formula</FormLabel>
              <Input
                size="sm"
                fontFamily="mono"
                value={answer.formula}
                onChange={(e) => {
                  const answers = question.answers.map((a, j) => (j === i ? { ...a, formula: e.target.value } : a));
                  onChanged({ ...question, answers });
                }}
                onBlur={() => save({ answers: question.answers })}
              />
            </FormControl>
            <FormControl maxW="80px">
              <FormLabel fontSize="xs" mb={1}>Unit</FormLabel>
              <Input size="sm" value={answer.unit || ''} onChange={(e) => {
                const answers = question.answers.map((a, j) => (j === i ? { ...a, unit: e.target.value } : a));
                onChanged({ ...question, answers });
              }} />
            </FormControl>
            <FormControl maxW="70px">
              <FormLabel fontSize="xs" mb={1}>Marks</FormLabel>
              <Input size="sm" type="number" value={answer.marks} onChange={(e) => {
                const answers = question.answers.map((a, j) => (j === i ? { ...a, marks: Number(e.target.value) } : a));
                onChanged({ ...question, answers });
              }} />
            </FormControl>
          </Flex>

          <Flex gap={2} align="center" wrap="wrap" mb={2}>
            {answer.partLabel && <Badge>{answer.partLabel}</Badge>}
            <VerificationBadge verification={answer.verification} />
            <Text fontSize="xs" color="lmFg.subtle">{answer.verification?.message}</Text>
          </Flex>

          {answer.working && (
            <Box bg="lmBg.sunken" borderRadius="md" p={2}>
              <Text fontSize="xs" fontWeight="600" color="lmFg.subtle" mb={1}>Derivation, for you to check</Text>
              <RichText fontSize="xs">{answer.working}</RichText>
            </Box>
          )}
        </Box>
      ))}
    </SectionCard>
  );
}


/**
 * What the class will actually see, alongside the answer key.
 *
 * Rolled through the real generator over the real prepared questions, so it is a
 * preview of the thing itself rather than of an approximation. It shows the
 * expected values too — this screen is teacher-only, and checking that the key
 * is sane for three different draws is the last thing worth doing before a paper
 * goes out. The student route strips `expected` until a paper is submitted.
 */
function PreviewPanel({ classId, draftId, questionIds }) {
  const [samples, setSamples] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const toast = useToast();

  const roll = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await lmApi.previewTutorialImport(classId, draftId, { count: 3, questionIds });
      setSamples(result.samples);
    } catch (err) {
      // Shown inline rather than as a toast: it is nearly always a validation
      // error naming a question, and the teacher needs to read it while looking
      // at that question.
      setProblem(err.message);
      toast({ status: 'error', title: 'Nothing to preview yet', duration: 4000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Preview"
      subtitle="Roll sample papers to see the numbers students will get, with the answer key."
      action={
        <Button size="sm" colorScheme="teal" variant="outline" onClick={roll} isLoading={busy}>
          Roll samples
        </Button>
      }
      mb={4}
    >
      {problem && (
        <Alert status="warning" borderRadius="md" fontSize="sm" mb={3}>
          <AlertIcon />
          {problem}
        </Alert>
      )}

      {!samples && !problem && (
        <Text fontSize="sm" color="lmFg.muted">
          Derive the answers first, then roll a few papers to check the numbers come out sensibly.
        </Text>
      )}

      {samples?.map((sample) => (
        <Box key={sample.label} borderWidth="1px" borderRadius="md" p={3} mb={3}>
          <Heading size="xs" mb={2}>{sample.label}</Heading>

          {sample.warnings?.length > 0 && (
            <Alert status="warning" borderRadius="md" fontSize="xs" mb={2}>
              <AlertIcon />
              {sample.warnings.join('; ')}
            </Alert>
          )}

          {sample.questions.map((question, index) => (
            <Box key={index} mb={3}>
              <RichText fontSize="sm">{question.prompt}</RichText>

              {question.parts?.map((part, partIndex) => (
                <Flex key={partIndex} gap={2} mt={1} pl={3} align="baseline">
                  <Text fontSize="sm" fontWeight="700" color="purple.600">{part.label}</Text>
                  <RichText fontSize="sm">{part.prompt}</RichText>
                </Flex>
              ))}

              <HStack fontSize="xs" color="lmFg.muted" mt={2} wrap="wrap">
                <Text>Values:</Text>
                {Object.entries(question.values || {}).map(([name, value]) => (
                  <Code key={name} fontSize="xs">{name} = {String(value)}</Code>
                ))}
              </HStack>

              <Box bg="lmHue.green50" borderRadius="md" p={2} mt={2}>
                <Text fontSize="xs" fontWeight="600" color="lmHue.green800" mb={1}>
                  Answer key for this paper
                </Text>
                {(question.expected || []).map((slot, slotIndex) => (
                  <Text key={slotIndex} fontSize="xs" color={slot.error ? 'red.600' : 'lmHue.green800'}>
                    {slot.partLabel ? `${slot.partLabel} ` : ''}{slot.label}:{' '}
                    <b>{slot.error ? `not markable — ${slot.error}` : `${formatAnswerValue(slot.value, slot.decimals, slot.valueIm)} ${slot.unit || ''}`}</b>
                    {' '}({slot.marks} mark{slot.marks === 1 ? '' : 's'})
                  </Text>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      ))}
    </SectionCard>
  );
}

export default function TutorialImport() {
  const { classId } = useOutletContext();
  const { draftId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState({});
  const [merging, setMerging] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const loaded = await lmApi.getTutorialImport(classId, draftId);
      setDraft(loaded);
      setSelected(Object.fromEntries((loaded.questions || []).map((q) => [q._id, true])));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, draftId]);

  useEffect(() => { load(); }, [load]);

  const merge = async () => {
    setMerging(true);
    try {
      const questionIds = Object.entries(selected).filter(([, on]) => on).map(([id]) => id);
      const result = await lmApi.mergeTutorialImport(classId, draftId, { questionIds });
      toast({ status: 'success', title: 'Merged into a new tutorial', duration: 5000 });
      // Straight into the ordinary editor: from here it is a tutorial like any
      // other, and publishing it is a separate, deliberate act.
      navigate(`/learning/class/${classId}/tutorial/${result.tutorial._id}/edit`);
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 10000 });
    } finally {
      setMerging(false);
    }
  };

  if (loading) return <Loading label="Loading the draft…" />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!draft) return null;

  const chosen = Object.values(selected).filter(Boolean).length;
  const attention = (draft.questions || []).filter((q) =>
    (q.answers || []).some((a) => a.verification?.status !== 'verified'),
  ).length;

  return (
    <Box>
      <Button size="sm" variant="ghost" mb={2} onClick={() => navigate(`/learning/class/${classId}/tutorials`)}>
        ← Back to tutorials
      </Button>

      <Heading size="lg" mb={1}>{draft.title}</Heading>
      <Text fontSize="sm" color="lmFg.subtle" mb={4}>
        Read from {draft.sources?.map((s) => s.name).join(', ') || 'an uploaded file'}
        {draft.provider ? ` by ${draft.provider}` : ''}.
      </Text>

      {draft.status === 'failed' && (
        <Alert status="error" borderRadius="md" mb={4}>
          <AlertIcon />
          {draft.error || 'The paper could not be read.'}
        </Alert>
      )}

      <Alert status="info" borderRadius="md" mb={4} fontSize="sm">
        <AlertIcon />
        <Box>
          Every formula below was written by the model and then <b>checked against the paper’s own
          numbers</b> — the original values are substituted and the result compared with the printed
          answer. A green badge means it reproduced that answer. Anything else needs your eyes before
          the class sees it.
        </Box>
      </Alert>

      {attention > 0 && (
        <Alert status="warning" borderRadius="md" mb={4} fontSize="sm">
          <AlertIcon />
          {attention} question{attention === 1 ? '' : 's'} still {attention === 1 ? 'has' : 'have'} an
          answer that did not reproduce the paper. Most often that is a unit mismatch.
        </Alert>
      )}

      {(draft.questions || []).map((question, index) => (
        <DraftQuestion
          key={question._id}
          classId={classId}
          draftId={draftId}
          question={question}
          index={index}
          selected={Boolean(selected[question._id])}
          onSelect={(on) => setSelected((prev) => ({ ...prev, [question._id]: on }))}
          onChanged={(updated) =>
            setDraft((prev) => ({
              ...prev,
              questions: prev.questions.map((q) => (q._id === updated._id ? updated : q)),
            }))
          }
        />
      ))}

      <PreviewPanel
        classId={classId}
        draftId={draftId}
        questionIds={Object.entries(selected).filter(([, on]) => on).map(([id]) => id)}
      />

      <VStack align="stretch" spacing={3} mt={4}>
        <Divider />
        <Flex gap={3} align="center" wrap="wrap">
          <Button
            colorScheme="purple"
            onClick={merge}
            isLoading={merging}
            isDisabled={!chosen || Boolean(draft.tutorialId)}
          >
            Merge {chosen} question{chosen === 1 ? '' : 's'} into a tutorial
          </Button>
          <Text fontSize="xs" color="lmFg.muted">
            Creates an unpublished tutorial you can edit and release like any other.
          </Text>
        </Flex>
        {draft.tutorialId && (
          <Alert status="success" borderRadius="md" fontSize="sm">
            <AlertIcon />
            Already merged.{' '}
            <Button
              size="xs"
              variant="link"
              ml={1}
              onClick={() => navigate(`/learning/class/${classId}/tutorial/${draft.tutorialId}/edit`)}
            >
              Open the tutorial
            </Button>
          </Alert>
        )}
      </VStack>
    </Box>
  );
}
