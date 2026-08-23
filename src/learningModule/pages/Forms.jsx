import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useOutletContext } from 'react-router-dom';
import { Badge, Box, Button, Flex, HStack, Heading, Text } from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard } from '../components/common';

/**
 * Lists the class's forms — a Google-Forms-like builder, entirely separate
 * from quizzes and tutorials. Nothing here is marked; a response is never
 * graded.
 */
export default function Forms() {
  const { classId, isTeacher } = useOutletContext();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError(null);
    try {
      setForms(await lmApi.listForms(classId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    try {
      const created = await lmApi.createForm(classId, {
        title: 'Untitled form',
        questions: [{ type: 'short_answer', title: 'Question 1' }],
      });
      navigate(`/learning/class/${classId}/form/${created._id}/edit`);
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(err.message);
    }
  };

  if (loading) return <Loading label="Loading forms…" />;

  return (
    <Box>
      <Flex justify="space-between" align="flex-start" mb={4} gap={3} wrap="wrap">
        <Box>
          <Heading size="md">Forms</Heading>
          <Text fontSize="sm" color="lmFg.muted">
            Surveys, feedback and sign-ups — share with the class or with anyone holding the link.
          </Text>
        </Box>
        {isTeacher && (
          <Button colorScheme="teal" onClick={create}>
            + New form
          </Button>
        )}
      </Flex>

      <ErrorState error={error} onRetry={load} />

      {forms.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No forms yet"
          description={
            isTeacher
              ? 'Build a short answer, choice, scale or file-upload form and share it with the class or a wider link.'
              : 'Your teacher has not shared any forms yet.'
          }
          action={
            isTeacher ? (
              <Button colorScheme="teal" onClick={create}>
                Create your first form
              </Button>
            ) : null
          }
        />
      ) : (
        forms.map((form) => (
          <SectionCard key={form._id} mb={3}>
            <Flex align="center" gap={4} wrap="wrap">
              <Box flex="1" minW="220px">
                <HStack>
                  <Heading size="sm">{form.title}</Heading>
                  {isTeacher && (
                    <Badge colorScheme={form.published ? 'green' : 'gray'}>
                      {form.published ? 'Published' : 'Draft'}
                    </Badge>
                  )}
                  {isTeacher && form.settings?.accessMode === 'anyone' && (
                    <Badge colorScheme="purple">Anyone with the link</Badge>
                  )}
                </HStack>
                {form.description && (
                  <Text fontSize="sm" color="lmFg.subtle" noOfLines={2} mt={1}>
                    {form.description}
                  </Text>
                )}
                <Text fontSize="xs" color="lmFg.muted" mt={1}>
                  {form.questions?.length ?? form.questionCount ?? 0} question(s)
                  {isTeacher ? ` · ${form.responseCount ?? 0} response(s)` : ''}
                </Text>
                {!isTeacher && form.responded && <Badge colorScheme="green" mt={1}>Responded</Badge>}
              </Box>

              <HStack>
                {isTeacher ? (
                  <>
                    <Button
                      as={RouterLink}
                      to={`/learning/class/${classId}/form/${form._id}/edit`}
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      as={RouterLink}
                      to={`/learning/class/${classId}/form/${form._id}/responses`}
                      size="sm"
                      variant="outline"
                    >
                      Responses
                    </Button>
                  </>
                ) : (
                  <Button
                    as={RouterLink}
                    to={`/learning/class/${classId}/form/${form._id}`}
                    size="sm"
                    colorScheme="teal"
                  >
                    {form.responded ? 'View / edit response' : 'Fill in'}
                  </Button>
                )}
              </HStack>
            </Flex>
          </SectionCard>
        ))
      )}
    </Box>
  );
}
