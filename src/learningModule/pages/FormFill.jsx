import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Alert, AlertIcon, Badge, Box, Button, HStack, Heading, Text, VStack, useToast } from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { DeadlineCountdown, ErrorState, Loading } from '../components/common';
import { formatDateTime } from '../format';
import FormRenderer from '../components/FormRenderer';
import TypeformRenderer from '../components/TypeformRenderer';

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

  const submit = async (answers) => {
    setSubmitting(true);
    try {
      await lmApi.submitFormResponse(classId, formId, answers);
      setJustSubmitted(true);
      toast({ status: 'success', title: 'Response recorded' });
    } catch (err) {
      toast({ status: 'error', title: err.message, description: err.payload?.errors?.[0], duration: 8000 });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading label="Loading form…" />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!state) return null;

  const { form, existingResponse } = state;
  const oneAtATime = form.settings?.displayMode === 'one_at_a_time';

  if (justSubmitted) {
    return (
      <VStack align="stretch" spacing={4} maxW="640px">
        <Heading size="md">Thanks!</Heading>
        <Text>Your response to &ldquo;{form.title}&rdquo; has been recorded.</Text>
        <Box>
          {form.settings?.oneResponsePerPerson && (
            <Button
              size="sm"
              variant="outline"
              mr={2}
              onClick={async () => {
                setJustSubmitted(false);
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
        {form.description && (
          <Text fontSize="sm" color="lmFg.muted" mt={1}>
            {form.description}
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
        />
      )}
    </VStack>
  );
}
