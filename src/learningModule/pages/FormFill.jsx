import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Badge, Box, Button, Heading, Text, VStack, useToast } from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { ErrorState, Loading } from '../components/common';
import FormRenderer from '../components/FormRenderer';

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
    <VStack align="stretch" spacing={4} maxW="640px">
      <Box>
        <Heading size="md">{form.title}</Heading>
        {form.description && (
          <Text fontSize="sm" color="lmFg.muted" mt={1}>
            {form.description}
          </Text>
        )}
        {existingResponse && (
          <Badge colorScheme="green" mt={2}>
            You can update your response below
          </Badge>
        )}
      </Box>

      <FormRenderer
        form={form}
        existingResponse={existingResponse}
        onSubmit={submit}
        submitting={submitting}
        canUploadFiles
        classId={classId}
      />
    </VStack>
  );
}
