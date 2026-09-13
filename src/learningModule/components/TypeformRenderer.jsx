import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Flex, FormControl, FormHelperText, Heading, Progress, Text, VStack, useToast } from '@chakra-ui/react';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import { buildAnswerPayload, isAnswered, isMissing, QuestionField, useFormAnswers } from './formFields';

/**
 * A Typeform-style single-question-per-screen fill flow: one question (or
 * section-intro slide) visible at a time, a thin progress bar, and — when the
 * form asks for it — a hard gate that keeps the respondent from moving on
 * without answering. `FormRenderer` is the all-at-once alternative; which one
 * a given form uses is `form.settings.displayMode`, picked by the caller.
 *
 * `onProgress(questionIndex)` is fired on mount (-1: "opened the form") and
 * each time the visible question advances, so the teacher's analytics can
 * show a drop-off funnel — it is best-effort telemetry, so callers should
 * swallow its own failures rather than let them interrupt filling the form.
 */

const ENTER_ADVANCES = new Set(['short_answer', 'multiple_choice', 'dropdown', 'linear_scale', 'date']);

function buildSteps(form) {
  const sections = (form.sections || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const bySection = new Map(sections.map((s) => [String(s._id), []]));
  const ungrouped = [];
  form.questions.forEach((question) => {
    const bucket = question.sectionId && bySection.get(String(question.sectionId));
    (bucket || ungrouped).push(question);
  });

  const steps = [];
  let flatIndex = 0;
  ungrouped.forEach((question) => {
    steps.push({ kind: 'question', question, flatIndex });
    flatIndex += 1;
  });
  sections.forEach((section) => {
    const questions = bySection.get(String(section._id)) || [];
    if (!questions.length) return;
    if (section.title || section.description) {
      steps.push({ kind: 'intro', section, flatIndex });
    }
    questions.forEach((question) => {
      steps.push({ kind: 'question', question, flatIndex });
      flatIndex += 1;
    });
  });
  return { steps, totalQuestions: flatIndex };
}

export default function TypeformRenderer({ form, existingResponse, onSubmit, submitting, canUploadFiles, classId, onProgress }) {
  const toast = useToast();
  const { answers, patch, uploading, handleUpload } = useFormAnswers(form, existingResponse);
  const { steps, totalQuestions } = useMemo(() => buildSteps(form), [form]);
  const [stepIndex, setStepIndex] = useState(0);
  const lastPinged = useRef(null);
  const containerRef = useRef(null);

  const step = steps[stepIndex];
  const requireSequential = Boolean(form.settings?.requireSequentialAnswers);

  useEffect(() => {
    onProgress?.(-1);
    // Only once, when the respondent first opens the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step?.kind === 'question' && lastPinged.current !== step.flatIndex) {
      lastPinged.current = step.flatIndex;
      onProgress?.(step.flatIndex);
    }
    containerRef.current?.focus();
  }, [step, onProgress]);

  if (!step) return null;

  const question = step.kind === 'question' ? step.question : null;
  const answer = question ? answers[String(question._id)] : null;
  const mustAnswerToAdvance = question && (question.required || requireSequential);
  const canAdvance = !mustAnswerToAdvance || isAnswered(question, answer);
  const isLastStep = stepIndex === steps.length - 1;

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const submitForm = async () => {
    const missing = form.questions.find((q) => isMissing(q, answers[String(q._id)]));
    if (missing) {
      const missingStepIndex = steps.findIndex((s) => s.kind === 'question' && s.question._id === missing._id);
      if (missingStepIndex >= 0) setStepIndex(missingStepIndex);
      toast({ status: 'warning', title: `"${missing.title}" is required.` });
      return;
    }
    await onSubmit(buildAnswerPayload(form.questions, answers));
  };

  const goNext = () => {
    if (!canAdvance) return;
    if (isLastStep) {
      submitForm();
      return;
    }
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  };

  const progressPercent = totalQuestions ? Math.round((step.flatIndex / totalQuestions) * 100) : 0;

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    if (event.target?.tagName === 'TEXTAREA') return;
    if (question && !ENTER_ADVANCES.has(question.type)) return;
    event.preventDefault();
    goNext();
  };

  return (
    <VStack
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      align="stretch"
      spacing={0}
      minH={{ base: '60vh', md: '65vh' }}
      outline="none"
    >
      <Progress value={progressPercent} size="xs" colorScheme="teal" borderRadius="full" mb={6} />

      <Flex flex="1" direction="column" justify="center" maxW="860px" w="100%" mx="auto" px={{ base: 4, md: 8 }} py={6}>
        {step.kind === 'intro' ? (
          <VStack align="flex-start" spacing={4}>
            <Text fontSize="xs" fontWeight="700" color="teal.500" textTransform="uppercase" letterSpacing="wide">
              Section
            </Text>
            {step.section.title && (
              <Heading size="lg">{step.section.title}</Heading>
            )}
            {step.section.description && (
              <Text fontSize="md" color="lmFg.muted">
                {step.section.description}
              </Text>
            )}
            <Button colorScheme="teal" size="lg" mt={2} onClick={goNext}>
              Continue
            </Button>
          </VStack>
        ) : (
          <VStack align="stretch" spacing={5}>
            <Text fontSize="sm" color="lmFg.muted">
              Question {step.flatIndex + 1} of {totalQuestions}
            </Text>
            <FormControl>
              <Heading size="md" fontWeight="700">
                {question.title}
                {question.required && (
                  <Text as="span" color="red.400">
                    {' '}
                    *
                  </Text>
                )}
              </Heading>
              {question.description && (
                <FormHelperText fontSize="sm" mt={1} mb={4}>
                  {question.description}
                </FormHelperText>
              )}
              <Box mt={4}>
                <QuestionField
                  question={question}
                  answer={answer}
                  onChange={(next) => patch(String(question._id), next)}
                  canUploadFiles={canUploadFiles}
                  uploading={Boolean(uploading[String(question._id)])}
                  onUpload={(files) => handleUpload(classId, question, files)}
                />
              </Box>
            </FormControl>

            <Flex justify="flex-end" align="center" gap={3} pt={10} pr={{ base: 0, md: 4 }}>
              {mustAnswerToAdvance && !canAdvance && (
                <Text fontSize="xs" color="lmFg.muted">
                  Answer to continue.
                </Text>
              )}
              <Button
                leftIcon={<FiArrowLeft />}
                variant="ghost"
                onClick={goBack}
                isDisabled={stepIndex === 0}
              >
                Back
              </Button>
              <Button
                rightIcon={isLastStep ? undefined : <FiArrowRight />}
                colorScheme="teal"
                onClick={goNext}
                isDisabled={!canAdvance}
                isLoading={isLastStep && submitting}
              >
                {isLastStep ? (existingResponse ? 'Update response' : 'Submit') : 'Next'}
              </Button>
            </Flex>
          </VStack>
        )}
      </Flex>
    </VStack>
  );
}
