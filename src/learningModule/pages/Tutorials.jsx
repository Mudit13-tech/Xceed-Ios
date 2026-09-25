import React, { useState } from 'react';
import { Link as RouterLink, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Input,
  Text,
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
  PageHeader,
  SectionCard,
  WorkListSkeleton,
} from '../components/common';
import { toDateTimeInput } from '../format';
import PaperPreviewModal from '../components/PaperPreviewModal';
import { LmIcon } from '../components/Icon';
import DeleteButton from '../components/DeleteButton';
import DownloadPaperButton from '../components/DownloadPaperButton';

/**
 * Whether this row has a deadline to show: one already saved, or one the
 * teacher has just opened the field for. `''` counts — it is the empty field
 * they asked for, and must not collapse back the moment it renders.
 */
const hasDeadline = (tutorial, dueDates) =>
  dueDates[tutorial._id] !== undefined || Boolean(tutorial.settings?.dueDate);

/**
 * Lists the class's parameterised tutorials — the ones where every student
 * gets their own numbers.
 */
export default function Tutorials() {
  const { classId, isTeacher, klass } = useOutletContext();
  const [dueDates, setDueDates] = useState({});
  // The tutorial whose sample papers are open, or null.
  const [previewing, setPreviewing] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  /* Held in the query cache, so coming back to this tab paints the list that
     was there and refreshes it behind you, instead of a spinner and a wait.
     Every tab in this class is a route, so leaving one unmounts it — without a
     cache that made every visit a cold fetch, however recently you had looked. */
  const {
    data: tutorials = [],
    isLoading: loading,
    error,
    refetch: load,
  } = useQuery({
    queryKey: ['learning', 'tutorials', classId],
    queryFn: () => lmApi.listTutorials(classId),
    placeholderData: (prev) => prev,
    staleTime: 2 * 60 * 1000,
  });

  const create = async () => {
    try {
      const created = await lmApi.createTutorial(classId, {
        title: 'Untitled tutorial',
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
      navigate(`/learning/class/${classId}/tutorial/${created._id}/edit`);
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  const togglePublish = async (tutorial) => {
    try {
      const rawDate = dueDates[tutorial._id];
      const isoDueDate = rawDate ? new Date(rawDate).toISOString() : (tutorial.settings?.dueDate || undefined);
      const result = await lmApi.publishTutorial(classId, tutorial._id, {
        publish: !tutorial.published,
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

  const remove = async (tutorial) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${tutorial.title}" and every student attempt at it?`)) return;
    try {
      await lmApi.deleteTutorial(classId, tutorial._id);
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  if (loading) return <Loading label="Loading tutorials…" skeleton={<WorkListSkeleton />} />;

  return (
    <Box>
      <PageHeader
        title="Tutorials"
        description="Numerical practice where every student gets their own values and answers are marked against a formula."
        actions={
          isTeacher ? (
            <>
              <Button as="a" href="/learning/tutorialmanual" target="_blank" rel="noreferrer" variant="ghost">
                <LmIcon name="manual" size={14} style={{ marginRight: 6 }} />
                Manual
              </Button>
              <Button colorScheme="teal" onClick={create}>
                + New tutorial
              </Button>
            </>
          ) : null
        }
      />

      <ErrorState error={error} onRetry={load} />

      {tutorials.length === 0 ? (
        <EmptyState
          icon="tutorial"
          title="No tutorials yet"
          description={
            isTeacher
              ? 'Write a question once with variables and ranges — each student is given different numbers, and their answers are checked against your formula.'
              : 'Your teacher has not set any numerical tutorials yet.'
          }
          action={
            isTeacher ? (
              <Button colorScheme="teal" onClick={create}>
                Create your first tutorial
              </Button>
            ) : null
          }
        />
      ) : (
        tutorials.map((tutorial) => (
          <SectionCard key={tutorial._id} mb={3}>
            <CardRow>
              <CardBody>
                <HStack wrap="wrap">
                  <Heading size="sm">{tutorial.title}</Heading>
                  {isTeacher && (
                    <Badge colorScheme={tutorial.published ? 'green' : 'gray'}>
                      {tutorial.published ? 'Published' : 'Draft'}
                    </Badge>
                  )}
                  {tutorial.topicName && <Badge colorScheme="gray">{tutorial.topicName}</Badge>}
                </HStack>
                {tutorial.description && (
                  <Text fontSize="sm" color="lmFg.subtle" noOfLines={2} mt={1}>
                    {tutorial.description}
                  </Text>
                )}
                <Text fontSize="xs" color="lmFg.muted" mt={1}>
                  {tutorial.questionCount ?? tutorial.questions?.length ?? 0} questions ·{' '}
                  {tutorial.totalMarks} marks
                  {tutorial.settings?.attemptsAllowed > 0
                    ? ` · ${tutorial.settings.attemptsAllowed} attempt${tutorial.settings.attemptsAllowed === 1 ? '' : 's'}`
                    : ' · unlimited attempts'}
                </Text>
                {isTeacher && tutorial.stats && (
                  <Text fontSize="xs" color="lmFg.muted">
                    {tutorial.stats.submitted} submission(s)
                    {tutorial.stats.avg !== null && tutorial.stats.avg !== undefined
                      ? ` · avg ${Math.round(tutorial.stats.avg * 10) / 10}%`
                      : ''}
                  </Text>
                )}
                {!isTeacher && tutorial.bestAttempt && (
                  <Badge
                    colorScheme={
                      tutorial.bestAttempt.passed === null || tutorial.bestAttempt.passed === undefined
                        ? 'gray'
                        : tutorial.bestAttempt.passed
                          ? 'green'
                          : 'red'
                    }
                    mt={1}
                  >
                    Best: {tutorial.bestAttempt.score}/{tutorial.bestAttempt.maxScore} (
                    {tutorial.bestAttempt.percent}%)
                  </Badge>
                )}
              </CardBody>

              <CardActions>
                {isTeacher ? (
                  <>
                    {/* A deadline is optional, so an empty date box on every
                        draft was showing a date that does not exist. The field
                        appears once there is one to show, or once the teacher
                        asks for one. */}
                    {!tutorial.published &&
                      (hasDeadline(tutorial, dueDates) ? (
                        // A date and a time need more than half a phone's
                        // width, so the field takes a row of its own there.
                        <Input
                          size="sm"
                          type="datetime-local"
                          data-card-action-wide
                          maxW={{ base: '100%', md: '200px' }}
                          value={
                            dueDates[tutorial._id] !== undefined
                              ? dueDates[tutorial._id]
                              : toDateTimeInput(tutorial.settings?.dueDate)
                          }
                          onChange={(event) =>
                            setDueDates((prev) => ({ ...prev, [tutorial._id]: event.target.value }))
                          }
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDueDates((prev) => ({ ...prev, [tutorial._id]: '' }))}
                        >
                          + Deadline
                        </Button>
                      ))}
                    <Button
                      as={RouterLink}
                      to={`/learning/class/${classId}/tutorial/${tutorial._id}/edit`}
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      as={RouterLink}
                      to={`/learning/class/${classId}/tutorial/${tutorial._id}/results`}
                      size="sm"
                      variant="outline"
                    >
                      Results
                    </Button>
                    {/* The whole paper, as three students would meet it. Here
                        rather than in the editor: the editor previews one
                        question at a time, which is the question you have while
                        writing one. */}
                    <Button size="sm" variant="outline" onClick={() => setPreviewing(tutorial)}>
                      Preview
                    </Button>
                    {/* The paper and its answer key as a printable file, with
                        the placeholders left standing — see paperPdf.js for why
                        it is the authored version rather than one student's. */}
                    <DownloadPaperButton
                      classId={classId}
                      item={tutorial}
                      kind="tutorial"
                      subjectName={klass?.subject || ''}
                    />
                    {tutorial.published && tutorial.settings?.liveMode && (
                      <Button
                        as={RouterLink}
                        to={`/learning/class/${classId}/tutorial/${tutorial._id}/present`}
                        size="sm"
                        colorScheme="red"
                      >
                        Present live
                      </Button>
                    )}
                    <Button
                      size="sm"
                      colorScheme={tutorial.published ? 'gray' : 'green'}
                      onClick={() => togglePublish(tutorial)}
                    >
                      {tutorial.published ? 'Unpublish' : 'Publish'}
                    </Button>
                    <DeleteButton label="Delete tutorial" onClick={() => remove(tutorial)} />
                  </>
                ) : (
                  <Button
                    as={RouterLink}
                    to={`/learning/class/${classId}/tutorial/${tutorial._id}`}
                    size="sm"
                    colorScheme="teal"
                    isDisabled={!tutorial.open}
                  >
                    {tutorial.attemptsUsed > 0 ? 'Open' : 'Start'}
                  </Button>
                )}
              </CardActions>
            </CardRow>
          </SectionCard>
        ))
      )}

      <PaperPreviewModal
        isOpen={Boolean(previewing)}
        onClose={() => setPreviewing(null)}
        classId={classId}
        kind="tutorial"
        item={previewing}
      />
    </Box>
  );
}
