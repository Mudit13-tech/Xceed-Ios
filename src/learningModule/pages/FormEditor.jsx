import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Switch,
  Text,
  Textarea,
  VStack,
  useClipboard,
  useToast,
} from '@chakra-ui/react';
import { FiArrowDown, FiArrowUp, FiCopy, FiTrash2 } from 'react-icons/fi';

import lmApi from '../api/lmApi';
import { ErrorState, Loading, SectionCard } from '../components/common';

/**
 * Authoring surface for a form — a Google-Forms-like builder. Entirely
 * separate from the quiz and tutorial editors; nothing here is marked and a
 * response is never scored.
 *
 * The server re-runs the same validation on save (formController.prepareQuestions);
 * the checks here exist so a teacher finds a problem before sharing the form,
 * not as the real enforcement.
 */

const QUESTION_TYPES = [
  { value: 'short_answer', label: 'Short answer', hint: 'A single line of text.' },
  { value: 'paragraph', label: 'Paragraph', hint: 'A longer block of text.' },
  { value: 'multiple_choice', label: 'Multiple choice', hint: 'Pick one from a list.' },
  { value: 'checkboxes', label: 'Checkboxes', hint: 'Pick any number from a list.' },
  { value: 'dropdown', label: 'Dropdown', hint: 'Pick one, from a dropdown.' },
  { value: 'linear_scale', label: 'Linear scale', hint: 'Rate between two labels.' },
  { value: 'date', label: 'Date', hint: 'A calendar date.' },
  { value: 'file_upload', label: 'File upload', hint: 'Attach a file as the answer.' },
];

const HAS_OPTIONS = ['multiple_choice', 'checkboxes', 'dropdown'];

const blankQuestion = (type = 'short_answer') => ({
  _key: Math.random().toString(36).slice(2),
  type,
  title: '',
  description: '',
  required: false,
  options: HAS_OPTIONS.includes(type) ? ['', ''] : [],
  scaleMin: 1,
  scaleMax: 5,
  scaleMinLabel: '',
  scaleMaxLabel: '',
});

// The server sends questions without the local _key that keeps React's list
// stable across reordering, so one is minted on load.
const withKeys = (questions) =>
  (questions || []).map((question) => ({
    ...blankQuestion(question.type),
    ...question,
    _key: String(question._id || Math.random().toString(36).slice(2)),
  }));

/** Mirrors the server's prepareQuestions so problems surface while editing. */
function validate(questions) {
  const problems = [];
  questions.forEach((question, index) => {
    const where = `Question ${index + 1}`;
    if (!question.title.trim()) problems.push(`${where}: give it a title.`);
    if (HAS_OPTIONS.includes(question.type)) {
      if (question.options.filter((option) => option.trim()).length < 2) {
        problems.push(`${where}: add at least two options.`);
      }
    }
    if (question.type === 'linear_scale' && Number(question.scaleMax) <= Number(question.scaleMin)) {
      problems.push(`${where}: the scale maximum must be above the minimum.`);
    }
  });
  return problems;
}

function OptionRows({ question, onChange }) {
  const setOption = (index, value) => {
    const options = [...question.options];
    options[index] = value;
    onChange({ options });
  };
  const addOption = () => onChange({ options: [...question.options, ''] });
  const removeOption = (index) => onChange({ options: question.options.filter((_, i) => i !== index) });

  return (
    <VStack align="stretch" spacing={2}>
      {question.options.map((option, index) => (
        <HStack key={index} spacing={2}>
          <Input
            size="sm"
            value={option}
            placeholder={`Option ${index + 1}`}
            onChange={(event) => setOption(index, event.target.value)}
          />
          {question.options.length > 2 && (
            <IconButton
              aria-label="Remove option"
              icon={<FiTrash2 />}
              size="xs"
              variant="ghost"
              colorScheme="red"
              onClick={() => removeOption(index)}
            />
          )}
        </HStack>
      ))}
      <Button size="xs" variant="outline" onClick={addOption} alignSelf="flex-start">
        Add option
      </Button>
    </VStack>
  );
}

function QuestionCard({ question, index, total, onChange, onMove, onRemove, onDuplicate }) {
  const meta = QUESTION_TYPES.find((entry) => entry.value === question.type);

  const changeType = (type) => {
    // Options rarely survive a type change intact; resetting them is less
    // surprising than carrying options that now mean nothing.
    onChange({ type, options: HAS_OPTIONS.includes(type) ? (question.options.length >= 2 ? question.options : ['', '']) : [] });
  };

  return (
    <SectionCard>
      <Flex align="center" gap={2} mb={3} wrap="wrap">
        <Badge fontSize="sm" px={2} py={1}>
          {index + 1}
        </Badge>
        <Select size="sm" maxW="220px" value={question.type} onChange={(event) => changeType(event.target.value)}>
          {QUESTION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>
        <Box flex="1" />
        <IconButton
          aria-label="Move question up"
          icon={<FiArrowUp />}
          size="xs"
          variant="ghost"
          isDisabled={index === 0}
          onClick={() => onMove(-1)}
        />
        <IconButton
          aria-label="Move question down"
          icon={<FiArrowDown />}
          size="xs"
          variant="ghost"
          isDisabled={index === total - 1}
          onClick={() => onMove(1)}
        />
        <IconButton aria-label="Duplicate question" icon={<FiCopy />} size="xs" variant="ghost" onClick={onDuplicate} />
        <IconButton
          aria-label="Delete question"
          icon={<FiTrash2 />}
          size="xs"
          variant="ghost"
          colorScheme="red"
          onClick={onRemove}
        />
      </Flex>

      {meta?.hint ? (
        <Text fontSize="xs" opacity={0.6} mb={2}>
          {meta.hint}
        </Text>
      ) : null}

      <FormControl mb={3} isInvalid={!question.title.trim()}>
        <FormLabel fontSize="sm">Question</FormLabel>
        <Input
          value={question.title}
          placeholder="What do you want to ask?"
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </FormControl>

      <FormControl mb={3}>
        <FormLabel fontSize="sm">Help text (optional)</FormLabel>
        <Input
          size="sm"
          value={question.description}
          placeholder="Extra detail shown beneath the question"
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </FormControl>

      {HAS_OPTIONS.includes(question.type) && (
        <FormControl mb={3}>
          <FormLabel fontSize="sm">Options</FormLabel>
          <OptionRows question={question} onChange={onChange} />
        </FormControl>
      )}

      {question.type === 'linear_scale' && (
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={3}>
          <FormControl>
            <FormLabel fontSize="sm">From</FormLabel>
            <NumberInput size="sm" value={question.scaleMin} onChange={(value) => onChange({ scaleMin: Number(value) || 0 })}>
              <NumberInputField />
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">To</FormLabel>
            <NumberInput size="sm" value={question.scaleMax} onChange={(value) => onChange({ scaleMax: Number(value) || 0 })}>
              <NumberInputField />
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Low label</FormLabel>
            <Input
              size="sm"
              value={question.scaleMinLabel}
              placeholder="Not at all"
              onChange={(event) => onChange({ scaleMinLabel: event.target.value })}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">High label</FormLabel>
            <Input
              size="sm"
              value={question.scaleMaxLabel}
              placeholder="Completely"
              onChange={(event) => onChange({ scaleMaxLabel: event.target.value })}
            />
          </FormControl>
        </SimpleGrid>
      )}

      <Checkbox isChecked={question.required} onChange={(event) => onChange({ required: event.target.checked })}>
        Required
      </Checkbox>
    </SectionCard>
  );
}

function ShareLink({ form, classId }) {
  const shareUrl = form.shareCode ? lmApi.formShareUrl(form.shareCode) : '';
  const { onCopy, hasCopied } = useClipboard(shareUrl);

  if (!form.published) return null;

  return (
    <SectionCard title="Share">
      <VStack align="stretch" spacing={2}>
        <Text fontSize="sm" color="lmFg.muted">
          {form.settings?.accessMode === 'anyone'
            ? 'Anyone with this link can respond, signed in or not.'
            : 'This link only accepts a signed-in member of this class.'}
        </Text>
        <HStack>
          <Input size="sm" value={shareUrl} isReadOnly />
          <Button size="sm" onClick={onCopy} leftIcon={<FiCopy />}>
            {hasCopied ? 'Copied' : 'Copy link'}
          </Button>
        </HStack>
      </VStack>
    </SectionCard>
  );
}

export default function FormEditor() {
  const { classId } = useOutletContext();
  const { formId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [serverProblems, setServerProblems] = useState([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const loaded = await lmApi.getForm(classId, formId);
      setForm(loaded);
      setQuestions(withKeys(loaded.questions));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, formId]);

  useEffect(() => {
    load();
  }, [load]);

  const problems = useMemo(() => validate(questions), [questions]);

  const patchQuestion = (index, patch) =>
    setQuestions((current) => current.map((question, i) => (i === index ? { ...question, ...patch } : question)));

  const moveQuestion = (index, delta) =>
    setQuestions((current) => {
      const to = index + delta;
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  const save = async () => {
    if (questions.length && problems.length) {
      toast({ status: 'warning', title: problems[0] });
      return false;
    }
    setSaving(true);
    setServerProblems([]);
    try {
      const updated = await lmApi.updateForm(classId, formId, {
        title: form.title,
        description: form.description,
        settings: form.settings,
        questions: questions.map((question, order) => ({ ...question, _key: undefined, order })),
      });
      setForm(updated);
      toast({ status: 'success', title: 'Saved' });
      return true;
    } catch (err) {
      setServerProblems(err.payload?.errors || [err.message]);
      toast({ status: 'error', title: err.message });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!form.published && !(await save())) return;
    try {
      const result = await lmApi.publishForm(classId, formId, { publish: !form.published });
      toast({ status: 'success', title: result.published ? 'Published' : 'Unpublished' });
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  if (loading) return <Loading label="Loading form…" />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  const setSetting = (key, value) =>
    setForm((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));

  return (
    <VStack align="stretch" spacing={5}>
      <Flex gap={3} wrap="wrap" align="center">
        <Heading size="md" flex="1">
          Edit form
        </Heading>
        <Button size="sm" variant="ghost" onClick={() => navigate(`/learning/class/${classId}/forms`)}>
          Back
        </Button>
        <Button size="sm" onClick={() => save()} isLoading={saving}>
          Save
        </Button>
        <Button size="sm" colorScheme={form.published ? 'gray' : 'green'} onClick={togglePublish} isLoading={saving}>
          {form.published ? 'Unpublish' : 'Publish'}
        </Button>
      </Flex>

      {(problems.length > 0 || serverProblems.length > 0) && (
        <Alert status="warning" borderRadius="md" alignItems="flex-start">
          <AlertIcon />
          <VStack align="stretch" spacing={0} fontSize="sm">
            {[...new Set([...problems, ...serverProblems])].map((problem) => (
              <Text key={problem}>{problem}</Text>
            ))}
          </VStack>
        </Alert>
      )}

      <SectionCard title="Form">
        <VStack align="stretch" spacing={3}>
          <FormControl>
            <FormLabel fontSize="sm">Title</FormLabel>
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Description</FormLabel>
            <Textarea
              rows={2}
              value={form.description || ''}
              placeholder="Shown at the top of the form."
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </FormControl>

          <Divider />

          <FormControl>
            <FormLabel fontSize="sm">Who can respond</FormLabel>
            <Select
              maxW="320px"
              value={form.settings?.accessMode || 'class'}
              onChange={(event) => setSetting('accessMode', event.target.value)}
            >
              <option value="class">Class members only (signed in)</option>
              <option value="anyone">Anyone with the link, including guests</option>
            </Select>
          </FormControl>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacingY={3} spacingX={6}>
            {[
              [
                'oneResponsePerPerson',
                'Limit to one response per person',
                'A second submission overwrites the first rather than adding a new row.',
                true,
              ],
              ['collectEmail', 'Ask respondents to confirm their email', ''],
              ['showSummaryToRespondents', 'Let respondents see the summary after submitting', ''],
            ].map(([key, label, hint, defaultOn]) => (
              <FormControl key={key} display="flex" alignItems="flex-start" gap={3}>
                <Switch
                  mt={1}
                  isChecked={defaultOn ? form.settings?.[key] !== false : Boolean(form.settings?.[key])}
                  onChange={(event) => setSetting(key, event.target.checked)}
                />
                <Box>
                  <FormLabel mb={0} fontSize="sm">
                    {label}
                  </FormLabel>
                  {hint ? (
                    <Text fontSize="xs" opacity={0.6}>
                      {hint}
                    </Text>
                  ) : null}
                </Box>
              </FormControl>
            ))}
          </SimpleGrid>
        </VStack>
      </SectionCard>

      <ShareLink form={form} classId={classId} />

      {questions.map((question, index) => (
        <QuestionCard
          key={question._key}
          question={question}
          index={index}
          total={questions.length}
          onChange={(patch) => patchQuestion(index, patch)}
          onMove={(delta) => moveQuestion(index, delta)}
          onRemove={() => setQuestions((current) => current.filter((_, i) => i !== index))}
          onDuplicate={() =>
            setQuestions((current) => [
              ...current.slice(0, index + 1),
              { ...current[index], _id: undefined, _key: Math.random().toString(36).slice(2) },
              ...current.slice(index + 1),
            ])
          }
        />
      ))}

      <HStack wrap="wrap">
        {QUESTION_TYPES.map((type) => (
          <Button
            key={type.value}
            size="sm"
            variant="outline"
            onClick={() => setQuestions((current) => [...current, blankQuestion(type.value)])}
          >
            + {type.label}
          </Button>
        ))}
      </HStack>
    </VStack>
  );
}
