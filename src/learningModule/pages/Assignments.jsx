import React, { useState } from 'react';
import { Link as RouterLink, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Input,
  Link,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import lmApi from '../api/lmApi';
import {
  CardActions,
  CardBody,
  CardRow,
  EmptyState,
  ErrorState,
  Loading,
  SectionCard,
  WorkListSkeleton,
} from '../components/common';
import { toDateTimeInput } from '../format';
import FormCard from '../components/FormCard';
import FormPreviewModal from '../components/FormPreviewModal';
import PaperPreviewModal from '../components/PaperPreviewModal';
import { LmIcon } from '../components/Icon';
import DeleteButton from '../components/DeleteButton';
import DownloadPaperButton from '../components/DownloadPaperButton';

/**
 * Lists the class's parameterised assignments — the ones where every student
 * gets their own numbers.
 */
/**
 * Whether this row has a deadline to show: one already saved, or one the
 * teacher has just opened the field for. `''` counts — it is the empty field
 * they asked for, and must not collapse back the moment it renders.
 */
const hasDeadline = (assignment, dueDates) =>
  dueDates[assignment._id] !== undefined || Boolean(assignment.settings?.dueDate);

export default function Assignments() {
  const { classId, isTeacher, klass } = useOutletContext();
  const [dueDates, setDueDates] = useState({});
  // The assignment whose sample papers are open, or null.
  const [previewing, setPreviewing] = useState(null);
  const [previewForm, setPreviewForm] = useState(null);
  const formPreview = useDisclosure();
  const navigate = useNavigate();
  const toast = useToast();

  /* Held in the query cache, so coming back to this tab paints the list that
     was there and refreshes it behind you, instead of a spinner and a wait.
     Every tab in this class is a route, so leaving one unmounts it — without a
     cache that made every visit a cold fetch, however recently you had looked.

     Both lists come from one query because they are one screen: the numerical
     assignments, and the forms carrying the Assignment category — document
     hand-ins, listed here as well as on the Forms tab. */
  const {
    data: lists,
    isLoading: loading,
    error,
    refetch: load,
  } = useQuery({
    queryKey: ['learning', 'assignments', classId],
    queryFn: async () => {
      // A failure listing forms must not hide the numerical assignments.
      const [list, forms] = await Promise.all([
        lmApi.listAssignments(classId),
        Promise.resolve(lmApi.listForms(classId)).catch(() => []),
      ]);
      return {
        assignments: list,
        formAssignments: (forms || []).filter((form) => form.category === 'assignment'),
      };
    },
    placeholderData: (prev) => prev,
    staleTime: 2 * 60 * 1000,
  });
  const assignments = lists?.assignments || [];
  const formAssignments = lists?.formAssignments || [];

  const create = async () => {
    try {
      const created = await lmApi.createAssignment(classId, {
        title: 'Untitled assignment',
        questions: [
          {
            prompt: 'A resistor of {{R}} Ω carries a current of {{I}} A. Find the power dissipated.',
            constraint: 'R > 0',
            solutionSteps: 'P = I²R = {{I}}² × {{R}}',
            variables: [
              { name: 'R', type: 'integer', min: 10, max: 100, step: 5, unit: 'Ω' },
              { name: 'I', type: 'range', min: 0.5, max: 3, step: 0.5, decimals: 1, unit: 'A' },
            ],
            answers: [
              { key: 'p', label: 'Power', formula: 'I^2*R', unit: 'W', marks: 5, tolerancePercent: 1 },
            ],
          },
        ],
      });
      navigate(`/learning/class/${classId}/assignment/${created._id}/edit`);
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  const createFormAssignment = async () => {
    try {
      const created = await lmApi.createForm(classId, {
        title: 'Untitled assignment',
        category: 'assignment',
        questions: [{ type: 'file_upload', title: 'Upload your submission', required: true }],
      });
      navigate(`/learning/class/${classId}/form/${created._id}/edit`);
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  const togglePublish = async (assignment) => {
    try {
      const rawDate = dueDates[assignment._id];
      const isoDueDate = rawDate ? new Date(rawDate).toISOString() : (assignment.settings?.dueDate || undefined);
      const result = await lmApi.publishAssignment(classId, assignment._id, {
        publish: !assignment.published,
        dueDate: isoDueDate,
      });
      toast({
        status: 'success',
        title: result.published ? 'Published to the class' : 'Unpublished',
      });
      await load();
    } catch (err) {
      toast({
        status: 'error',
        title: err.message,
        description: err.payload?.errors?.slice(0, 3).join(' · '),
        duration: 10000,
      });
    }
  };

  const remove = async (assignment) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${assignment.title}" and every student attempt at it?`)) return;
    try {
      await lmApi.deleteAssignment(classId, assignment._id);
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  if (loading) return <Loading label="Loading assignments…" skeleton={<WorkListSkeleton />} />;

  return (
    <Box>
      {/* Teachers land here looking for "an assignment" and may really want a
          PDF hand-in, which this tab cannot take. Point them at Forms. */}
      {isTeacher && (
        <Alert status="info" borderRadius="md" fontSize="sm" mb={4} alignItems="flex-start">
          <AlertIcon />
          <Box>
            <Text>
              Here you can create <strong>numerical questions with random variables</strong> (every
              student gets different values), <strong>MCQ</strong> or <strong>multiple choice</strong>{' '}
              questions, or <strong>numerical questions that are the same for all students</strong>.
              Students enter their answers directly.
            </Text>
            <Text mt={1}>
              For a <strong>document upload</strong> assignment (e.g. students submit a PDF), use{' '}
              <Link as={RouterLink} to={`/learning/class/${classId}/forms`} fontWeight="600">
                Forms
              </Link>{' '}
              with the category set to <strong>Assignment</strong>, or use{' '}
              <strong>+ New document assignment</strong> below. Those forms appear under Document
              Submissions here as well as on the Forms tab.
            </Text>
          </Box>
        </Alert>
      )}

      <Flex direction="column" align="flex-start" mb={4} gap={3}>
        <Box>
          <Heading size="md">Assignments</Heading>
          <Text fontSize="sm" color="lmFg.muted">
            Assessed numerical work. Every student gets their own values, and answers are marked
            against a formula rather than a fixed key.
          </Text>
        </Box>
        {/* Under the heading on the left, the same place and style as
            "+ New document assignment" below. */}
        {isTeacher && (
          <HStack spacing={2}>
            <Button colorScheme="teal" variant="outline" onClick={create}>
              + New assignment
            </Button>
            <Button as="a" href="/learning/assignmentmanual" target="_blank" rel="noreferrer" variant="ghost">
              <LmIcon name="manual" size={14} style={{ marginRight: 6 }} />
              Manual
            </Button>
          </HStack>
        )}
      </Flex>

      <ErrorState error={error} onRetry={load} />

      {assignments.length === 0 ? (
        <EmptyState
          icon="assignment"
          title="No assignments yet"
          description={
            isTeacher
              ? 'Write a question once with variables and ranges — each student is given different numbers, and their answers are checked against your formula.'
              : 'Your teacher has not set any numerical assignments yet.'
          }
          action={
            isTeacher ? (
              <Button colorScheme="teal" onClick={create}>
                Create your first assignment
              </Button>
            ) : null
          }
        />
      ) : (
        assignments.map((assignment) => (
          <SectionCard key={assignment._id} mb={3}>
            <CardRow>
              <CardBody>
                <HStack wrap="wrap">
                  <Heading size="sm">{assignment.title}</Heading>
                  {isTeacher && (
                    <Badge colorScheme={assignment.published ? 'green' : 'gray'}>
                      {assignment.published ? 'Published' : 'Draft'}
                    </Badge>
                  )}
                  {assignment.topicName && <Badge colorScheme="gray">{assignment.topicName}</Badge>}
                </HStack>
                {assignment.description && (
                  <Text fontSize="sm" color="lmFg.subtle" noOfLines={2} mt={1}>
                    {assignment.description}
                  </Text>
                )}
                <Text fontSize="xs" color="lmFg.muted" mt={1}>
                  {assignment.questionCount ?? assignment.questions?.length ?? 0} questions ·{' '}
                  {assignment.totalMarks} marks
                  {assignment.settings?.attemptsAllowed > 1
                    ? ` · ${assignment.settings.attemptsAllowed} attempts`
                    : ''}
                </Text>
                {isTeacher && assignment.stats && (
                  <Text fontSize="xs" color="lmFg.muted">
                    {assignment.stats.attempts} submission(s)
                    {assignment.stats.avg !== null && assignment.stats.avg !== undefined
                      ? ` · avg ${Math.round(assignment.stats.avg * 10) / 10}%`
                      : ''}
                  </Text>
                )}
                {!isTeacher && assignment.bestAttempt && (
                  <Badge
                    colorScheme={
                      assignment.bestAttempt.passed === null || assignment.bestAttempt.passed === undefined
                        ? 'gray'
                        : assignment.bestAttempt.passed
                          ? 'green'
                          : 'red'
                    }
                    mt={1}
                  >
                    Best: {assignment.bestAttempt.score}/{assignment.bestAttempt.maxScore} (
                    {assignment.bestAttempt.percent}%)
                  </Badge>
                )}
              </CardBody>

              <CardActions>
                {isTeacher ? (
                  <>
                    {/* A deadline is optional, so an empty date box on every draft
                        was showing a date that does not exist. The field appears
                        once there is one, or once the teacher asks for one. */}
                    {!assignment.published &&
                      (hasDeadline(assignment, dueDates) ? (
                        // A date and a time need more than half a phone's
                        // width, so the field takes a row of its own there.
                        <Input
                          size="sm"
                          type="datetime-local"
                          data-card-action-wide
                          maxW={{ base: '100%', md: '200px' }}
                          value={
                            dueDates[assignment._id] !== undefined
                              ? dueDates[assignment._id]
                              : toDateTimeInput(assignment.settings?.dueDate)
                          }
                          onChange={(event) =>
                            setDueDates((prev) => ({ ...prev, [assignment._id]: event.target.value }))
                          }
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDueDates((prev) => ({ ...prev, [assignment._id]: '' }))}
                        >
                          + Deadline
                        </Button>
                      ))}
                    <Button
                      as={RouterLink}
                      to={`/learning/class/${classId}/assignment/${assignment._id}/edit`}
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      as={RouterLink}
                      to={`/learning/class/${classId}/assignment/${assignment._id}/results`}
                      size="sm"
                      variant="outline"
                    >
                      Results
                    </Button>
                    {/* The whole paper, as three students would meet it. Here
                        rather than in the editor: the editor previews one
                        question at a time, which is the question you have while
                        writing one. */}
                    <Button size="sm" variant="outline" onClick={() => setPreviewing(assignment)}>
                      Preview
                    </Button>
                    {/* The paper and its answer key as a printable file, with
                        the placeholders left standing — see paperPdf.js for why
                        it is the authored version rather than one student's. */}
                    <DownloadPaperButton
                      classId={classId}
                      item={assignment}
                      kind="assignment"
                      subjectName={klass?.subject || ''}
                    />
                    <Button
                      size="sm"
                      colorScheme={assignment.published ? 'gray' : 'green'}
                      onClick={() => togglePublish(assignment)}
                    >
                      {assignment.published ? 'Unpublish' : 'Publish'}
                    </Button>
                    <DeleteButton label="Delete assignment" onClick={() => remove(assignment)} />
                  </>
                ) : (
                  <Button
                    as={RouterLink}
                    to={`/learning/class/${classId}/assignment/${assignment._id}`}
                    size="sm"
                    colorScheme="teal"
                    isDisabled={!assignment.open}
                  >
                    {assignment.attemptsUsed > 0 ? 'Open' : 'Start'}
                  </Button>
                )}
              </CardActions>
            </CardRow>
          </SectionCard>
        ))
      )}

      {(isTeacher || formAssignments.length > 0) && (
        <Box mt={8}>
          <Flex direction="column" align="flex-start" mb={4} gap={3}>
            <Box>
              <Heading size="md">Document Submissions</Heading>
              <Text fontSize="sm" color="lmFg.muted">
                Forms with the Assignment category — students upload their work before the deadline.
              </Text>
            </Box>
            {isTeacher && (
              <Button colorScheme="teal" variant="outline" onClick={createFormAssignment}>
                + New document assignment
              </Button>
            )}
          </Flex>
          {formAssignments.length === 0 ? (
            <Text fontSize="sm" color="lmFg.muted">
              None yet. A form whose category is set to Assignment shows up here.
            </Text>
          ) : (
            formAssignments.map((form) => (
              <FormCard
                key={form._id}
                form={form}
                classId={classId}
                isTeacher={isTeacher}
                showCategory={false}
                onDeleted={load}
                onPreview={(f) => {
                  setPreviewForm(f);
                  formPreview.onOpen();
                }}
              />
            ))
          )}
        </Box>
      )}

      <FormPreviewModal
        isOpen={formPreview.isOpen}
        onClose={formPreview.onClose}
        form={previewForm}
        classId={classId}
      />

      <PaperPreviewModal
        isOpen={Boolean(previewing)}
        onClose={() => setPreviewing(null)}
        classId={classId}
        kind="assignment"
        item={previewing}
      />
    </Box>
  );
}
