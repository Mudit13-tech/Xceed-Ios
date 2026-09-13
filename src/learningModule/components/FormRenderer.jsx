import React from 'react';
import { Box, Button, FormControl, FormHelperText, FormLabel, Heading, Text, VStack, useToast } from '@chakra-ui/react';
import { SectionCard } from './common';
import { buildAnswerPayload, isMissing, QuestionField, useFormAnswers } from './formFields';

/**
 * Renders every question on one scrolling page and collects one respondent's
 * answers — the original "all at once" fill experience, now grouped under
 * section headings when the form has any. The one-at-a-time flow lives in
 * `TypeformRenderer`; `FormFill`/`FormLinkJoin`/`FormPreviewModal` pick
 * between the two based on `form.settings.displayMode`.
 *
 * Shared between the class-scoped fill page and the public link-mode page —
 * both need identical question rendering, and only differ in how the form
 * and the submit call are fetched. `canUploadFiles` is false in link mode: the
 * shared attachment endpoint sits behind class membership (`loadClass`), which
 * a signed-out link guest does not have, so a file-upload question is shown
 * read-only there rather than pretending to accept a file that would 403.
 */

function QuestionCardField({ question, answer, patch, classId, canUploadFiles, uploading, handleUpload }) {
  const key = String(question._id);
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
        <QuestionField
          question={question}
          answer={answer}
          onChange={(next) => patch(key, next)}
          canUploadFiles={canUploadFiles}
          uploading={Boolean(uploading[key])}
          onUpload={(files) => handleUpload(classId, question, files)}
        />
      </FormControl>
    </SectionCard>
  );
}

export default function FormRenderer({ form, existingResponse, onSubmit, submitting, canUploadFiles, classId }) {
  const toast = useToast();
  const { answers, patch, uploading, handleUpload } = useFormAnswers(form, existingResponse);

  const submit = async () => {
    const missing = form.questions.find((question) => isMissing(question, answers[String(question._id)]));
    if (missing) {
      toast({ status: 'warning', title: `"${missing.title}" is required.` });
      return;
    }
    await onSubmit(buildAnswerPayload(form.questions, answers));
  };

  const sections = (form.sections || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const questionsBySection = new Map(sections.map((s) => [String(s._id), []]));
  const ungrouped = [];
  form.questions.forEach((question) => {
    const bucket = question.sectionId && questionsBySection.get(String(question.sectionId));
    (bucket || ungrouped).push(question);
  });

  const fieldProps = { patch, classId, canUploadFiles, uploading, handleUpload };

  return (
    <VStack align="stretch" spacing={4}>
      {ungrouped.map((question) => (
        <QuestionCardField key={question._id} question={question} answer={answers[String(question._id)]} {...fieldProps} />
      ))}

      {sections.map((section) => {
        const sectionQuestions = questionsBySection.get(String(section._id)) || [];
        if (!sectionQuestions.length && !section.title && !section.description) return null;
        return (
          <Box key={section._id}>
            {(section.title || section.description) && (
              <Box mb={3} mt={2}>
                {section.title && (
                  <Heading size="sm">{section.title}</Heading>
                )}
                {section.description && (
                  <Text fontSize="sm" color="lmFg.muted" mt={1}>
                    {section.description}
                  </Text>
                )}
              </Box>
            )}
            <VStack align="stretch" spacing={4}>
              {sectionQuestions.map((question) => (
                <QuestionCardField key={question._id} question={question} answer={answers[String(question._id)]} {...fieldProps} />
              ))}
            </VStack>
          </Box>
        );
      })}

      <Button colorScheme="teal" alignSelf="flex-start" onClick={submit} isLoading={submitting}>
        {existingResponse ? 'Update response' : 'Submit'}
      </Button>
    </VStack>
  );
}
