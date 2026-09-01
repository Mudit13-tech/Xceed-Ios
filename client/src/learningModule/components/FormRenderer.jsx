import React, { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
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
import { SectionCard } from './common';

/**
 * Renders a form's questions and collects one respondent's answers.
 *
 * Shared between the class-scoped fill page and the public link-mode page —
 * both need identical question rendering, and only differ in how the form
 * and the submit call are fetched. `canUploadFiles` is false in link mode: the
 * shared attachment endpoint sits behind class membership (`loadClass`), which
 * a signed-out link guest does not have, so a file-upload question is shown
 * read-only there rather than pretending to accept a file that would 403.
 */

const answerFor = (question, existing) => ({
  text: existing?.text || '',
  selectedOptions: existing?.selectedOptions || [],
  number: existing?.number ?? '',
  dateValue: existing?.dateValue ? String(existing.dateValue).slice(0, 10) : '',
  attachments: existing?.attachments || [],
});

const isMissing = (question, answer) => {
  if (!question.required) return false;
  switch (question.type) {
    case 'short_answer':
    case 'paragraph':
      return !answer.text.trim();
    case 'multiple_choice':
    case 'dropdown':
    case 'checkboxes':
      return !answer.selectedOptions.length;
    case 'linear_scale':
      return answer.number === '' || answer.number === null || answer.number === undefined;
    case 'date':
      return !answer.dateValue;
    case 'file_upload':
      return !answer.attachments.length;
    default:
      return false;
  }
};

export default function FormRenderer({ form, existingResponse, onSubmit, submitting, canUploadFiles, classId }) {
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

  const handleUpload = async (question, files) => {
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

  const submit = async () => {
    const missing = form.questions.find((question) => isMissing(question, answers[String(question._id)]));
    if (missing) {
      toast({ status: 'warning', title: `"${missing.title}" is required.` });
      return;
    }
    const payload = form.questions.map((question) => {
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
    await onSubmit(payload);
  };

  return (
    <VStack align="stretch" spacing={4}>
      {form.questions.map((question) => {
        const key = String(question._id);
        const answer = answers[key];
        return (
          <SectionCard key={key}>
            <FormControl isRequired={question.required}>
              <FormLabel fontSize="sm" fontWeight="600">
                {question.title}
              </FormLabel>
              {question.description && (
                <FormHelperText mt={-1} mb={2} fontSize="xs">
                  {question.description}
                </FormHelperText>
              )}

              {question.type === 'short_answer' && (
                <Input value={answer.text} onChange={(event) => patch(key, { text: event.target.value })} />
              )}

              {question.type === 'paragraph' && (
                <Textarea rows={3} value={answer.text} onChange={(event) => patch(key, { text: event.target.value })} />
              )}

              {question.type === 'multiple_choice' && (
                <RadioGroup value={answer.selectedOptions[0] || ''} onChange={(value) => patch(key, { selectedOptions: [value] })}>
                  <Stack>
                    {question.options.map((option) => (
                      <Radio key={option} value={option}>
                        {option}
                      </Radio>
                    ))}
                  </Stack>
                </RadioGroup>
              )}

              {question.type === 'dropdown' && (
                <Select
                  placeholder="Choose one"
                  value={answer.selectedOptions[0] || ''}
                  onChange={(event) => patch(key, { selectedOptions: event.target.value ? [event.target.value] : [] })}
                >
                  {question.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              )}

              {question.type === 'checkboxes' && (
                <Stack>
                  {question.options.map((option) => (
                    <Checkbox
                      key={option}
                      isChecked={answer.selectedOptions.includes(option)}
                      onChange={(event) =>
                        patch(key, {
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
              )}

              {question.type === 'linear_scale' && (
                <RadioGroup value={String(answer.number ?? '')} onChange={(value) => patch(key, { number: Number(value) })}>
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
              )}

              {question.type === 'date' && (
                <Input type="date" value={answer.dateValue} onChange={(event) => patch(key, { dateValue: event.target.value })} />
              )}

              {question.type === 'file_upload' && (
                canUploadFiles ? (
                  <Box>
                    <input
                      type="file"
                      multiple
                      disabled={uploading[key]}
                      onChange={(event) => handleUpload(question, [...event.target.files])}
                    />
                    {answer.attachments.length > 0 && (
                      <VStack align="stretch" mt={2} spacing={1}>
                        {answer.attachments.map((file, i) => (
                          <HStack key={`${file.url}-${i}`} fontSize="xs" justify="space-between">
                            <Text>{file.name}</Text>
                            <Button
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() =>
                                patch(key, { attachments: answer.attachments.filter((_, idx) => idx !== i) })
                              }
                            >
                              Remove
                            </Button>
                          </HStack>
                        ))}
                      </VStack>
                    )}
                  </Box>
                ) : (
                  <Text fontSize="sm" color="lmFg.muted">
                    File attachments are not available when responding via a shared link — open this form from
                    the class to attach a file.
                  </Text>
                )
              )}
            </FormControl>
          </SectionCard>
        );
      })}

      <Button colorScheme="teal" alignSelf="flex-start" onClick={submit} isLoading={submitting}>
        {existingResponse ? 'Update response' : 'Submit'}
      </Button>
    </VStack>
  );
}
