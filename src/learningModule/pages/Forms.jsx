import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useOutletContext } from 'react-router-dom';
import { Badge, Box, Button, Divider, Flex, HStack, Heading, Text, useDisclosure } from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import {
  CopyLinkButton,
  DeadlineCountdown,
  EmptyState,
  ErrorState,
  Loading,
  SectionCard,
  TopicManager,
  groupByTopic,
} from '../components/common';
import FormPreviewModal from '../components/FormPreviewModal';
import { LmIcon } from '../components/Icon';

function FormCard({ form, classId, isTeacher, onDeleted, onPreview }) {
  return (
    <SectionCard mb={3}>
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
            {form.closed && <Badge colorScheme="red">Closed</Badge>}
            {!form.closed && form.dueDate && <DeadlineCountdown dueDate={form.dueDate} prefix="Closes in" />}
          </HStack>
          {form.description && (
            <Text fontSize="sm" color="lmFg.subtle" noOfLines={2} mt={1}>
              {form.description}
            </Text>
          )}
          <Text fontSize="xs" color="lmFg.muted" mt={1}>
            {form.questions?.length ?? form.questionCount ?? 0} question(s)
            {isTeacher
              ? form.settings?.accessMode === 'class'
                ? ` · ${form.responseCount ?? 0}/${form.enrolledCount ?? 0} students filled`
                : ` · ${form.responseCount ?? 0} response(s)`
              : ''}
          </Text>
          {!isTeacher && form.responded && <Badge colorScheme="green" mt={1}>Responded</Badge>}
        </Box>

        <HStack>
          {isTeacher ? (
            <>
              {form.published && form.shareCode && (
                <CopyLinkButton to={`/learning/form/link/${form.shareCode}`} size="sm" />
              )}
              <Button
                as={RouterLink}
                to={`/learning/class/${classId}/form/${form._id}/edit`}
                size="sm"
                variant="outline"
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                colorScheme="purple"
                onClick={() => onPreview(form)}
              >
                Preview
              </Button>
              <Button
                as={RouterLink}
                to={`/learning/class/${classId}/form/${form._id}/responses`}
                size="sm"
                variant="outline"
              >
                Responses
              </Button>
              <Button
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={async () => {
                  if (!window.confirm(`Delete "${form.title}"? This cannot be undone.`)) return;
                  try {
                    await lmApi.deleteForm(classId, form._id);
                    onDeleted();
                  } catch (err) {
                    window.alert(err.message);
                  }
                }}
              >
                Delete
              </Button>
            </>
          ) : (
            <Button
              as={RouterLink}
              to={`/learning/class/${classId}/form/${form._id}`}
              size="sm"
              colorScheme="teal"
              isDisabled={form.closed}
            >
              {form.closed ? 'Closed' : form.responded ? 'View / edit response' : 'Fill in'}
            </Button>
          )}
        </HStack>
      </Flex>
    </SectionCard>
  );
}

/**
 * Lists the class's forms — a Google-Forms-like builder, entirely separate
 * from quizzes and tutorials. Nothing here is marked; a response is never
 * graded.
 */
export default function Forms() {
  const { classId, klass, isTeacher, reloadClass } = useOutletContext();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const previewDialog = useDisclosure();
  const [previewForm, setPreviewForm] = useState(null);

  const topics = klass?.topics || [];

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

  const afterTopicsChanged = async () => {
    await load();
    reloadClass?.();
  };

  if (loading) return <Loading label="Loading forms…" />;

  const { grouped, untopiced } = groupByTopic(forms, topics);

  return (
    <Flex gap={6} align="flex-start" direction={{ base: 'column', lg: 'row' }}>
      <Box flex="1" minW={0} order={{ base: 2, lg: 1 }} w="100%">
        <Flex justify="space-between" align="flex-start" mb={4} gap={3} wrap="wrap">
          <Box>
            <Heading size="md">Forms</Heading>
            <Text fontSize="sm" color="lmFg.muted">
              Surveys, feedback and sign-ups — share with the class or with anyone holding the link.
            </Text>
          </Box>
          {isTeacher && (
            <>
              <Button as="a" href="/learning/formsmanual" target="_blank" rel="noreferrer" variant="ghost" size="sm">
                <LmIcon name="manual" size={14} style={{ marginRight: 6 }} />
              Manual
              </Button>
              <Button colorScheme="teal" onClick={create}>
                + New form
              </Button>
            </>
          )}
        </Flex>

        <ErrorState error={error} onRetry={load} />

        {forms.length === 0 ? (
          <EmptyState
            icon="form"
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
          <>
            {grouped.map((group) => (
              <Box key={group.topic._id} mb={6}>
                <Heading size="sm" color="lmFg.body" mb={2}>
                  {group.topic.name}
                </Heading>
                <Divider mb={3} />
                {group.items.map((form) => (
                  <FormCard
                    key={form._id}
                    form={form}
                    classId={classId}
                    isTeacher={isTeacher}
                    onDeleted={load}
                    onPreview={(f) => {
                      setPreviewForm(f);
                      previewDialog.onOpen();
                    }}
                  />
                ))}
              </Box>
            ))}
            {untopiced.length > 0 && (
              <Box>
                {grouped.length > 0 && (
                  <>
                    <Heading size="sm" color="lmFg.body" mb={2}>
                      Other
                    </Heading>
                    <Divider mb={3} />
                  </>
                )}
                {untopiced.map((form) => (
                  <FormCard
                    key={form._id}
                    form={form}
                    classId={classId}
                    isTeacher={isTeacher}
                    onDeleted={load}
                    onPreview={(f) => {
                      setPreviewForm(f);
                      previewDialog.onOpen();
                    }}
                  />
                ))}
              </Box>
            )}
          </>
        )}
      </Box>

      {isTeacher && (
        <Box w={{ base: '100%', lg: '260px' }} flexShrink={0} order={{ base: 1, lg: 2 }}>
          <TopicManager classId={classId} topics={topics} onChanged={afterTopicsChanged} itemNoun="Forms" />
        </Box>
      )}

      <FormPreviewModal
        isOpen={previewDialog.isOpen}
        onClose={previewDialog.onClose}
        form={previewForm}
        classId={classId}
      />
    </Flex>
  );
}
