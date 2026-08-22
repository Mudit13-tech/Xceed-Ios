import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Input,
  Text,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard } from '../components/common';

/**
 * Lists the class's parameterised assignments — the ones where every student
 * gets their own numbers.
 */
export default function Assignments() {
  const { classId, isTeacher } = useOutletContext();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dueDates, setDueDates] = useState({});
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(async () => {
    setError(null);
    try {
      setAssignments(await lmApi.listAssignments(classId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);


  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);

  /**
   * Uploads the pages, then asks the server to read them.
   *
   * Two requests rather than one multipart call: the upload handler already
   * exists, already enforces the size and type rules and already stores files
   * under names it minted, so one place stays responsible for what lands on disk.
   */
  const startImport = async (files) => {
    if (!files.length) return;
    setImporting(true);
    try {
      const { attachments } = await lmApi.uploadFiles(classId, files);
      const draft = await lmApi.startAssignmentImport(classId, {
        title: files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : 'Imported assignment',
        sources: attachments.map((file) => ({
          name: file.name,
          url: file.url,
          mimeType: file.mimeType,
        })),
      });
      navigate(`/learning/class/${classId}/assignment-import/${draft._id}`);
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 10000 });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

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

  const togglePublish = async (assignment) => {
    try {
      const result = await lmApi.publishAssignment(classId, assignment._id, {
        publish: !assignment.published,
        dueDate: dueDates[assignment._id] || undefined,
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

  if (loading) return <Loading label="Loading assignments…" />;

  return (
    <Box>
      <Flex justify="space-between" align="flex-start" mb={4} gap={3} wrap="wrap">
        <Box>
          <Heading size="md">Assignments</Heading>
          <Text fontSize="sm" color="lmFg.muted">
            Assessed numerical work. Every student gets their own values, and answers are marked
            against a formula rather than a fixed key.
          </Text>
        </Box>
        {isTeacher && (
          <>
            {/* Reads a photographed or scanned paper and proposes variables and
                answer formulas, each checked against the paper's own numbers.
                Its own pipeline, ending in an assignment — a tutorial draft
                cannot land here and vice versa. */}
            <Button
              variant="outline"
              colorScheme="purple"
              isLoading={importing}
              onClick={() => fileRef.current?.click()}
            >
              📄 Import from a paper
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/gif,image/webp"
              multiple
              style={{ display: 'none' }}
              onChange={(event) => startImport([...event.target.files])}
            />
            <Button colorScheme="teal" onClick={create}>
              + New assignment
            </Button>
          </>
        )}
      </Flex>

      <ErrorState error={error} onRetry={load} />

      {assignments.length === 0 ? (
        <EmptyState
          icon="🧮"
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
            <Flex align="center" gap={4} wrap="wrap">
              <Box flex="1" minW="220px">
                <HStack>
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
                  <Badge colorScheme={assignment.bestAttempt.passed ? 'green' : 'red'} mt={1}>
                    Best: {assignment.bestAttempt.score}/{assignment.bestAttempt.maxScore} (
                    {assignment.bestAttempt.percent}%)
                  </Badge>
                )}
              </Box>

              <HStack>
                {isTeacher ? (
                  <>
                    {!assignment.published && (
                      <Input
                        size="sm"
                        type="datetime-local"
                        maxW="200px"
                        value={dueDates[assignment._id] || ''}
                        onChange={(event) =>
                          setDueDates((prev) => ({ ...prev, [assignment._id]: event.target.value }))
                        }
                      />
                    )}
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
                    <Button
                      size="sm"
                      colorScheme={assignment.published ? 'gray' : 'green'}
                      onClick={() => togglePublish(assignment)}
                    >
                      {assignment.published ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button size="sm" variant="ghost" colorScheme="red" onClick={() => remove(assignment)}>
                      ✕
                    </Button>
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
              </HStack>
            </Flex>
          </SectionCard>
        ))
      )}
    </Box>
  );
}
