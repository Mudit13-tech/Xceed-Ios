import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { DeadlineCountdown, ErrorState, Loading, requestFullscreen, SectionCardSkeleton, useIsFullscreen } from '../components/common';
import { formatDateTime } from '../format';
import FormRenderer from '../components/FormRenderer';
import TypeformRenderer from '../components/TypeformRenderer';
import { RespondentResults } from '../components/FormSummary';
import { answerText } from './FormResponses';

/** A class member filling in (or re-filling) a published form. */
export default function FormFill() {
  const { classId } = useOutletContext();
  const { formId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [state, setState] = useState(null); // { form, existingResponse }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [submittedAnswers, setSubmittedAnswers] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setState(await lmApi.getFormForFill(classId, formId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, formId]);

  useEffect(() => {
    load();
  }, [load]);

  const isFullscreen = useIsFullscreen();

  useEffect(() => {
    if (state?.form?.settings?.autoFullscreen && !document.fullscreenElement) {
      requestFullscreen();
    }
  }, [state]);

  const loadResults = useCallback(
    () => lmApi.getFormSummaryForRespondent(classId, formId),
    [classId, formId],
  );

  const submit = async (answers) => {
    setSubmitting(true);
    try {
      await lmApi.submitFormResponse(classId, formId, answers);
      setSubmittedAnswers(answers);
      setJustSubmitted(true);
      toast({ status: 'success', title: 'Response recorded' });
    } catch (err) {
      toast({ status: 'error', title: err.message, description: err.payload?.errors?.[0], duration: 8000 });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading label="Loading form…" skeleton={<SectionCardSkeleton lines={4} />} />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!state) return null;

  const { form, existingResponse, respondent } = state;
  const oneAtATime = form.settings?.displayMode === 'one_at_a_time';

  if (justSubmitted) {
    return (
      <VStack align="stretch" spacing={4} maxW="640px">
        <Heading size="md">Thanks!</Heading>
        <Text>Your response to &ldquo;{form.title}&rdquo; has been recorded.</Text>
        {form.settings?.showSummaryToRespondents && submittedAnswers && (
          <Box>
            <Heading size="sm" mb={3}>Your answers</Heading>
            <VStack align="stretch" spacing={2}>
              {form.questions.map((question) => {
                const byQuestion = new Map((submittedAnswers || []).map((a) => [String(a.questionId), a]));
                const answer = byQuestion.get(String(question._id));
                return (
                  <Box key={question._id} borderBottomWidth="1px" borderColor="lmBorder.subtle" pb={2}>
                    <Text fontSize="xs" color="lmFg.muted">{question.title}</Text>
                    <Text fontSize="sm">{answerText(question, answer)}</Text>
                  </Box>
                );
              })}
            </VStack>
          </Box>
        )}
        {form.settings?.showSummaryToRespondents && <RespondentResults load={loadResults} />}
        <Box>
          {form.settings?.oneResponsePerPerson && (
            <Button
              size="sm"
              variant="outline"
              mr={2}
              onClick={async () => {
                setJustSubmitted(false);
                setSubmittedAnswers(null);
                setLoading(true);
                await load();
              }}
            >
              Edit my response
            </Button>
          )}
          <Button size="sm" onClick={() => navigate(`/learning/class/${classId}/forms`)}>
            Back to forms
          </Button>
        </Box>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={4} maxW={oneAtATime ? '960px' : '640px'}>
      <Box>
        <HStack>
          <Heading size="md">{form.title}</Heading>
          {!form.closed && form.dueDate && <DeadlineCountdown dueDate={form.dueDate} prefix="Closes in" />}
        </HStack>
        {(form.subjectName || form.facultyName) && (
          <Text fontSize="sm" color="lmFg.muted" mt={1}>
            {[form.subjectName, form.facultyName].filter(Boolean).join(' · ')}
          </Text>
        )}
        {form.description && (
          <Text fontSize="sm" color="lmFg.muted" mt={1}>
            {form.description}
          </Text>
        )}
        {form.settings?.collectEmail && respondent?.email && (
          <Text fontSize="sm" color="lmFg.muted" mt={2}>
            Your response will be recorded against <strong>{respondent.email}</strong>.
          </Text>
        )}
        {!form.closed && existingResponse && (
          <Badge colorScheme="green" mt={2}>
            You can update your response below
          </Badge>
        )}
      </Box>

      {form.closed ? (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          This form closed on {formatDateTime(form.dueDate)} and is no longer accepting responses.
        </Alert>
      ) : oneAtATime ? (
        <TypeformRenderer
          form={form}
          existingResponse={existingResponse}
          onSubmit={submit}
          submitting={submitting}
          canUploadFiles
          classId={classId}
          isFullscreen={isFullscreen}
          onProgress={(questionIndex) => lmApi.pingFormProgress(classId, formId, questionIndex).catch(() => {})}
        />
      ) : (
        <FormRenderer
          form={form}
          existingResponse={existingResponse}
          onSubmit={submit}
          submitting={submitting}
          canUploadFiles
          classId={classId}
          isFullscreen={isFullscreen}
        />
      )}
    </VStack>
  );
}