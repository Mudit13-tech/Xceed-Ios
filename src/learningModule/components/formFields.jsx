import React, { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  HStack,
  Input,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Text,
  Textarea,
  VStack,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';

/**
 * Answer-shaping and per-type field rendering shared by both student-facing
 * renderers (`FormRenderer`'s all-at-once page and `TypeformRenderer`'s
 * one-at-a-time flow) — kept in one place so the two never drift apart on
 * what counts as "answered" or how a given question type looks.
 */

export const answerFor = (question, existing) => ({
  text: existing?.text || '',
  selectedOptions: existing?.selectedOptions || [],
  number: existing?.number ?? '',
  dateValue: existing?.dateValue ? String(existing.dateValue).slice(0, 10) : '',
  attachments: existing?.attachments || [],
});

/** Whether `answer` counts as filled in for `question` — ignores `question.required` on purpose, so callers decide when that check applies (e.g. "require every question" in one-at-a-time mode). */
export const isAnswered = (question, answer) => {
  switch (question.type) {
    case 'short_answer':
    case 'paragraph':
      return Boolean(answer.text.trim());
    case 'multiple_choice':
    case 'dropdown':
    case 'checkboxes':
      return answer.selectedOptions.length > 0;
    case 'linear_scale':
      return answer.number !== '' && answer.number !== null && answer.number !== undefined;
    case 'date':
      return Boolean(answer.dateValue);
    case 'file_upload':
      return answer.attachments.length > 0;
    default:
      return true;
  }
};

export const isMissing = (question, answer) => question.required && !isAnswered(question, answer);

/** Builds the payload shape the fill/submit endpoints expect. */
export const buildAnswerPayload = (questions, answers) =>
  questions.map((question) => {
    const answer = answers[String(question._id)];
    return {
      questionId: question._id,
      text: answer.text,
      selectedOptions: answer.selectedOptions,
      number: answer.number === '' ? null : Number(answer.number),
      dateValue: answer.dateValue || null,
      attachments: answer.attachments,
    };
  });

/** Local state + upload handling shared by both renderers. */
export function useFormAnswers(form, existingResponse) {
  const toast = useToast();
  const existingByQuestion = new Map((existingResponse?.answers || []).map((a) => [String(a.questionId), a]));
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(
      form.questions.map((question) => [String(question._id), answerFor(question, existingByQuestion.get(String(question._id)))]),
    ),
  );
  const [uploading, setUploading] = useState({});

  const patch = (questionId, next) =>
    setAnswers((current) => ({ ...current, [questionId]: { ...current[questionId], ...next } }));

  const handleUpload = async (classId, question, files) => {
    if (!files?.length) return;
    const key = String(question._id);
    setUploading((current) => ({ ...current, [key]: true }));
    try {
      const { attachments } = await lmApi.uploadFiles(classId, files);
      patch(key, { attachments: [...answers[key].attachments, ...attachments] });
    } catch (err) {
      toast({ status: 'error', title: err.message });
    } finally {
      setUploading((current) => ({ ...current, [key]: false }));
    }
  };

  return { answers, patch, uploading, handleUpload };
}

/** Renders the input control for one question. No label/help-text — callers place those to fit their own layout (a card row vs. a full-screen slide). */
export function QuestionField({ question, answer, onChange, canUploadFiles, uploading, onUpload }) {
  if (question.type === 'short_answer') {
    return <Input value={answer.text} onChange={(event) => onChange({ text: event.target.value })} />;
  }

  if (question.type === 'paragraph') {
    return <Textarea rows={3} value={answer.text} onChange={(event) => onChange({ text: event.target.value })} />;
  }

  if (question.type === 'multiple_choice') {
    return (
      <RadioGroup value={answer.selectedOptions[0] || ''} onChange={(value) => onChange({ selectedOptions: [value] })}>
        <Stack>
          {question.options.map((option) => (
            <Radio key={option} value={option}>
              {option}
            </Radio>
          ))}
        </Stack>
      </RadioGroup>
    );
  }

  if (question.type === 'dropdown') {
    return (
      <Select
        placeholder="Choose one"
        value={answer.selectedOptions[0] || ''}
        onChange={(event) => onChange({ selectedOptions: event.target.value ? [event.target.value] : [] })}
      >
        {question.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    );
  }

  if (question.type === 'checkboxes') {
    return (
      <Stack>
        {question.options.map((option) => (
          <Checkbox
            key={option}
            isChecked={answer.selectedOptions.includes(option)}
            onChange={(event) =>
              onChange({
                selectedOptions: event.target.checked
                  ? [...answer.selectedOptions, option]
                  : answer.selectedOptions.filter((o) => o !== option),
              })
            }
          >
            {option}
          </Checkbox>
        ))}
      </Stack>
    );
  }

  if (question.type === 'linear_scale') {
    return (
      <RadioGroup value={String(answer.number ?? '')} onChange={(value) => onChange({ number: Number(value) })}>
        <HStack spacing={4} wrap="wrap">
          {question.scaleMinLabel && <Text fontSize="xs">{question.scaleMinLabel}</Text>}
          {Array.from(
            { length: question.scaleMax - question.scaleMin + 1 },
            (_, i) => question.scaleMin + i,
          ).map((value) => (
            <VStack key={value} spacing={1}>
              <Radio value={String(value)} />
              <Text fontSize="xs">{value}</Text>
            </VStack>
          ))}
          {question.scaleMaxLabel && <Text fontSize="xs">{question.scaleMaxLabel}</Text>}
        </HStack>
      </RadioGroup>
    );
  }

  if (question.type === 'date') {
    return <Input type="date" value={answer.dateValue} onChange={(event) => onChange({ dateValue: event.target.value })} />;
  }

  if (question.type === 'file_upload') {
    if (!canUploadFiles) {
      return (
        <Text fontSize="sm" color="lmFg.muted">
          File attachments are not available when responding via a shared link — open this form from the class to
          attach a file.
        </Text>
      );
    }
    return (
      <Box>
        <input type="file" multiple disabled={uploading} onChange={(event) => onUpload([...event.target.files])} />
        {answer.attachments.length > 0 && (
          <VStack align="stretch" mt={2} spacing={1}>
            {answer.attachments.map((file, i) => (
              <HStack key={`${file.url}-${i}`} fontSize="xs" justify="space-between">
                <Text>{file.name}</Text>
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => onChange({ attachments: answer.attachments.filter((_, idx) => idx !== i) })}
                >
                  Remove
                </Button>
              </HStack>
            ))}
          </VStack>
        )}
      </Box>
    );
  }

  return null;
}
