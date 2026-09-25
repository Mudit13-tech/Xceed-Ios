import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Box, Button, Divider, Flex, Heading, Text, useDisclosure } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, WorkListSkeleton } from '../components/common';
import FormCard from '../components/FormCard';
import FormPreviewModal from '../components/FormPreviewModal';
import { LmIcon } from '../components/Icon';

// A form's category, not the class's Material topics: an Assignment form is a
// hand-in that is also listed on the Assignments tab; a Normal form is
// everything else.
const CATEGORY_GROUPS = [
  { key: 'assignment', title: 'Assignment', hint: 'Also listed on the Assignments tab.' },
  { key: 'normal', title: 'Normal form' },
];

const categoryOf = (form) => (form.category === 'assignment' ? 'assignment' : 'normal');

/**
 * Lists the class's forms — a Google-Forms-like builder, entirely separate
 * from quizzes and tutorials. Nothing here is marked; a response is never
 * graded.
 */
export default function Forms() {
  const { classId, klass, isTeacher } = useOutletContext();
  const navigate = useNavigate();
  const previewDialog = useDisclosure();
  const [previewForm, setPreviewForm] = useState(null);

  /* Held in the query cache, so coming back to this tab paints the list that
     was there and refreshes it behind you, instead of a spinner and a wait.
     Every tab in this class is a route, so leaving one unmounts it — without a
     cache that made every visit a cold fetch, however recently you had looked. */
  const {
    data: forms = [],
    isLoading: loading,
    error,
    refetch: load,
  } = useQuery({
    queryKey: ['learning', 'forms', classId],
    queryFn: () => lmApi.listForms(classId),
    placeholderData: (prev) => prev,
    staleTime: 2 * 60 * 1000,
  });

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

  if (loading) return <Loading label="Loading forms…" skeleton={<WorkListSkeleton />} />;

  const groups = CATEGORY_GROUPS.map((group) => ({
    ...group,
    items: forms.filter((form) => categoryOf(form) === group.key),
  })).filter((group) => group.items.length > 0);

  return (
    <Box>
      <Flex justify="space-between" align="flex-start" mb={4} gap={3} wrap="wrap">
        <Box>
          <Heading size="md">Forms</Heading>
          <Text fontSize="sm" color="lmFg.muted">
            Surveys, feedback, sign-ups and document hand-ins — share with the class or with anyone holding the link.
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
        groups.map((group) => (
          <Box key={group.key} mb={6}>
            <Heading size="sm" color="lmFg.body" mb={1}>
              {group.title}
            </Heading>
            {group.hint && (
              <Text fontSize="xs" color="lmFg.muted" mb={2}>
                {group.hint}
              </Text>
            )}
            <Divider mb={3} />
            {group.items.map((form) => (
              <FormCard
                key={form._id}
                form={form}
                classId={classId}
                isTeacher={isTeacher}
                showCategory={false}
                onDeleted={load}
                onPreview={(f) => {
                  setPreviewForm(f);
                  previewDialog.onOpen();
                }}
              />
            ))}
          </Box>
        ))
      )}

      <FormPreviewModal
        isOpen={previewDialog.isOpen}
        onClose={previewDialog.onClose}
        form={previewForm}
        classId={classId}
        subjectName={klass?.subject}
        facultyName={previewForm?.createdByName || klass?.ownerName}
      />
    </Box>
  );
}
