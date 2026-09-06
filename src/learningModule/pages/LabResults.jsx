import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Heading,
  Input,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard } from '../components/common';
import CircuitCanvas from '../components/lab/CircuitCanvas';
import { eng } from '../components/lab/format';

/**
 * What the class did.
 *
 * The thing this screen exists for is the **bench**, not the score. A lab report
 * marked only on its numbers tells a student they got three of five readings wrong;
 * looking at the circuit they built tells them the ammeter was across the load
 * instead of in series with it, which is the sentence worth writing. So opening an
 * attempt shows the circuit as they left it and the runs they made, and the marking
 * box sits underneath.
 */
export default function LabResults() {
  const { classId } = useOutletContext();
  const { labId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await lmApi.listLabAttempts(classId, labId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, labId]);

  useEffect(() => {
    load();
  }, [load]);

  const openAttempt = async (attempt) => {
    try {
      // Re-fetched rather than taken from the list: the list deliberately omits
      // the runs, which are the large and interesting half.
      const full = await lmApi.getLabAttempt(classId, attempt._id);
      setOpen(full);
      setMarks(full.attempt.teacherMarks ?? '');
      setFeedback(full.attempt.teacherFeedback ?? '');
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  const mark = async () => {
    try {
      await lmApi.markLabAttempt(classId, open.attempt._id, {
        teacherMarks: marks === '' ? null : Number(marks),
        teacherFeedback: feedback,
      });
      toast({ status: 'success', title: 'Marked' });
      setOpen(null);
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  if (loading) return <Loading label="Loading submissions…" />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return null;

  const wanted = data.lab.readings || [];

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={2}>
        <Box>
          <Heading size="md">{data.lab.title}</Heading>
          <Text fontSize="sm" color="lmFg.muted">
            {data.attempts.length} bench(es) · {data.attempts.filter((a) => a.status === 'submitted').length}{' '}
            submitted
          </Text>
        </Box>
        <Button size="sm" variant="ghost" onClick={() => navigate(`/learning/class/${classId}/labs`)}>
          Back
        </Button>
      </Flex>

      {!data.attempts.length ? (
        <EmptyState icon="lab" title="Nobody has started yet" description="Submissions will appear here." />
      ) : (
        <SectionCard mb={3}>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th px={1}>Student</Th>
                <Th px={1}>Status</Th>
                <Th px={1} isNumeric>
                  Checked
                </Th>
                <Th px={1} isNumeric>
                  Runs
                </Th>
                <Th px={1} isNumeric>
                  Marks
                </Th>
                <Th px={1} />
              </Tr>
            </Thead>
            <Tbody>
              {data.attempts.map((attempt) => (
                <Tr key={attempt._id}>
                  <Td px={1}>{attempt.studentName}</Td>
                  <Td px={1}>
                    <Badge colorScheme={attempt.status === 'submitted' ? 'green' : 'yellow'}>
                      {attempt.status === 'submitted' ? 'Submitted' : 'In progress'}
                    </Badge>
                  </Td>
                  <Td px={1} isNumeric>
                    {/* Null where the teacher gave no expected values. Showing 0%
                        there would report every student as having failed a lab
                        that was never automatically markable. */}
                    {attempt.percent === null || attempt.percent === undefined
                      ? '—'
                      : `${attempt.correctCount}/${attempt.checkedCount} · ${attempt.percent}%`}
                  </Td>
                  <Td px={1} isNumeric>
                    {attempt.runCount ?? '—'}
                  </Td>
                  <Td px={1} isNumeric>
                    {attempt.teacherMarks ?? '—'}
                  </Td>
                  <Td px={1}>
                    <Button size="xs" variant="outline" onClick={() => openAttempt(attempt)}>
                      Open bench
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </SectionCard>
      )}

      {open && (
        <SectionCard>
          <Flex justify="space-between" align="center" mb={3}>
            <Heading size="sm">
              {open.attempt.studentName}
              {open.attempt.submitted_at
                ? ` · submitted ${new Date(open.attempt.submitted_at).toLocaleString()}`
                : ' · still working'}
            </Heading>
            <Button size="xs" variant="ghost" onClick={() => setOpen(null)}>
              Close
            </Button>
          </Flex>

          {/* The circuit they built, read-only. This is the point of the screen. */}
          <CircuitCanvas
            circuit={open.attempt.circuit || { components: [], wires: [] }}
            onChange={() => {}}
            palette={open.lab?.domainSpec?.parts || []}
            readOnly
            height={360}
          />

          <Divider my={4} />

          <Flex gap={5} wrap="wrap" align="flex-start">
            <Box flex="1" minW="280px">
              <Text fontSize="sm" fontWeight="700" mb={2}>
                What they reported
              </Text>
              {!wanted.length ? (
                <Text fontSize="sm" color="lmFg.muted">
                  This experiment asks for no specific readings.
                </Text>
              ) : (
                <Table size="sm">
                  <Tbody>
                    {wanted.map((want) => {
                      const given = (open.attempt.readings || []).find((row) => row.key === want.key);
                      return (
                        <Tr key={want.key}>
                          <Td px={1}>
                            <Text fontSize="sm">{want.label}</Text>
                            {given?.working && (
                              <Text fontSize="xs" color="lmFg.muted">
                                {given.working}
                              </Text>
                            )}
                          </Td>
                          <Td px={1} isNumeric>
                            <Text fontSize="sm" fontWeight="600">
                              {given?.value === null || given?.value === undefined
                                ? '—'
                                : eng(given.value, want.unit)}
                            </Text>
                            {want.expected !== null && want.expected !== undefined && (
                              <Text fontSize="10px" color={given?.correct ? 'green.600' : 'red.600'}>
                                {given?.correct ? '✓' : '✕'} expected {eng(want.expected, want.unit)}
                              </Text>
                            )}
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              )}

              {open.attempt.conclusion && (
                <Box mt={3}>
                  <Text fontSize="sm" fontWeight="700">
                    Conclusion
                  </Text>
                  <Text fontSize="sm" color="lmFg.body" whiteSpace="pre-wrap">
                    {open.attempt.conclusion}
                  </Text>
                </Box>
              )}
            </Box>

            <Box flex="1" minW="280px">
              {/* The run history. Two runs where the wattmeter read nothing say
                  more about what a student understood than the final number. */}
              <Text fontSize="sm" fontWeight="700" mb={2}>
                Runs ({(open.attempt.runs || []).length})
              </Text>
              <VStack align="stretch" spacing={2} maxH="320px" overflowY="auto">
                {(open.attempt.runs || [])
                  .slice()
                  .reverse()
                  .map((run) => (
                    <Box key={run._id} borderWidth="1px" borderColor="lmBorder.base" borderRadius="md" p={2}>
                      <HStack justify="space-between">
                        <HStack>
                          <Badge>{run.analysis?.toUpperCase()}</Badge>
                          {run.frequency ? (
                            <Text fontSize="10px" color="lmFg.muted">
                              {run.frequency} Hz
                            </Text>
                          ) : null}
                        </HStack>
                        <Text fontSize="10px" color="lmFg.muted">
                          {new Date(run.at).toLocaleTimeString()}
                        </Text>
                      </HStack>
                      {run.error ? (
                        <Text fontSize="xs" color="red.600" mt={1}>
                          {run.error}
                        </Text>
                      ) : (
                        <Text fontSize="xs" color="lmFg.body" mt={1}>
                          {(run.instruments || [])
                            .map((meter) => `${meter.label} ${eng(meter.magnitude, meter.unit)}`)
                            .join(' · ') || 'no meters on the bench'}
                        </Text>
                      )}
                    </Box>
                  ))}
                {!(open.attempt.runs || []).length && (
                  <Text fontSize="sm" color="lmFg.muted">
                    They never pressed Run.
                  </Text>
                )}
              </VStack>
            </Box>
          </Flex>

          <Divider my={4} />

          <Flex gap={3} align="flex-end" wrap="wrap">
            <Box>
              <Text fontSize="xs" color="lmFg.subtle">
                Marks
              </Text>
              <Input
                size="sm"
                maxW="110px"
                type="number"
                value={marks}
                onChange={(event) => setMarks(event.target.value)}
              />
            </Box>
            <Box flex="1" minW="240px">
              <Text fontSize="xs" color="lmFg.subtle">
                Feedback
              </Text>
              <Textarea
                size="sm"
                rows={2}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="The ammeter is across the load rather than in series with it — that is why it read nothing."
              />
            </Box>
            <Button size="sm" colorScheme="teal" onClick={mark}>
              Save marks
            </Button>
          </Flex>
        </SectionCard>
      )}
    </Box>
  );
}
