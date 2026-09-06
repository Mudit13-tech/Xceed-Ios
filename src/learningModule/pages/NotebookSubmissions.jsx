import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom';
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
import { FiFastForward, FiPlay, FiRefreshCw, FiSquare } from 'react-icons/fi';

import lmApi from '../api/lmApi';
import {
  DeadlineCountdown,
  EmptyState,
  ErrorState,
  Loading,
  SectionCard,
  StatTile,
} from '../components/common';
import NotebookCell from '../components/NotebookCell';
import useNotebookKernel from '../hooks/useNotebookKernel';
import { formatDateTime } from '../format';

// A stable empty array — `open?.notebook?.x || []` would hand out a fresh
// array every render, which trips the hook dependencies built on top of it.
const EMPTY = [];

export default function NotebookSubmissions() {
  const { classId } = useOutletContext();
  const { notebookId } = useParams();
  const toast = useToast();

  const [attempts, setAttempts] = useState([]);
  const [tally, setTally] = useState(null);
  const [dueDate, setDueDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState({ grade: '', maxPoints: '', feedback: '' });
  // The cells actually on screen for the open attempt — starts as a copy of
  // `open.attempt.cells` but diverges once the teacher runs one, since a
  // re-run's output is this browser's own and must never overwrite what the
  // student's browser recorded.
  const [runCells, setRunCells] = useState([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await lmApi.listNotebookAttempts(classId, notebookId);
      setAttempts(data.attempts || []);
      setTally(data.tally || null);
      setDueDate(data.dueDate || null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, notebookId]);

  useEffect(() => {
    load();
  }, [load]);

  const openAttempt = async (row) => {
    if (open?.attempt?._id === row._id) {
      setOpen(null);
      return;
    }
    try {
      const data = await lmApi.getNotebookAttempt(classId, row._id);
      setOpen(data);
      setRunCells(data.attempt.cells || []);
      setDraft({
        grade: data.attempt.grade ?? '',
        maxPoints: data.attempt.maxPoints ?? '',
        feedback: data.attempt.feedback || '',
      });
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  const grade = async () => {
    try {
      await lmApi.gradeNotebookAttempt(classId, open.attempt._id, {
        grade: draft.grade === '' ? null : Number(draft.grade),
        maxPoints: draft.maxPoints === '' ? null : Number(draft.maxPoints),
        feedback: draft.feedback,
      });
      toast({ status: 'success', title: 'Graded and returned' });
      setOpen(null);
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  const reopen = async (row) => {
    try {
      await lmApi.reopenNotebookAttempt(classId, row._id);
      toast({ status: 'success', title: 'Handed back for another go' });
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  // Same kernels the student's own notebook runs on (see NotebookPlayer) —
  // reused here so a teacher can execute a submission's code themselves
  // instead of trusting only what the student's browser recorded.
  const language = open?.notebook?.language === 'c' ? 'c' : 'python';
  const packages = open?.notebook?.packages || EMPTY;
  const hiddenSetup = open?.notebook?.hiddenSetup || EMPTY;
  const sources = useMemo(
    () => [...hiddenSetup, ...runCells.map((cell) => cell.source)],
    [hiddenSetup, runCells],
  );
  const { status, detail, busyCellId, label, start, restart, runCell, stop } = useNotebookKernel(
    language,
    packages,
    sources,
  );

  // Replays the teacher's hidden setup into a fresh kernel, once — same
  // reasoning as NotebookPlayer's `ensureSetup`.
  const setupRef = useRef(null);
  const ensureSetup = useCallback(() => {
    if (language === 'c' || !hiddenSetup.length) return Promise.resolve();
    if (!setupRef.current) {
      setupRef.current = (async () => {
        for (const source of hiddenSetup) {
          // eslint-disable-next-line no-await-in-loop
          await runCell('__setup__', source, () => {});
        }
      })().catch((err) => {
        setupRef.current = null;
        throw err;
      });
    }
    return setupRef.current;
  }, [hiddenSetup, language, runCell]);

  const patchRunCell = useCallback((id, patch) => {
    setRunCells((current) =>
      current.map((cell) =>
        cell._id === id ? { ...cell, ...(typeof patch === 'function' ? patch(cell) : patch) } : cell,
      ),
    );
  }, []);

  const executeCell = useCallback(
    async (cell) => {
      if (status !== 'ready') {
        toast({ status: 'info', title: `${label} is still starting.`, duration: 2000 });
        return;
      }

      const collected = [];
      patchRunCell(cell._id, { outputs: [] });
      const push = (output) => {
        collected.push(output);
        patchRunCell(cell._id, { outputs: [...collected] });
      };

      try {
        await ensureSetup();
        const { result, error: runError } = await runCell(cell._id, cell.source, push, {
          stdin: cell.stdin || '',
          prelude: language === 'c' ? hiddenSetup : [],
        });
        if (runError) collected.push({ type: 'error', text: runError });
        else if (result !== null && result !== undefined) collected.push({ type: 'result', text: result });

        patchRunCell(cell._id, (current) => ({
          outputs: [...collected],
          executedAt: new Date().toISOString(),
          runCount: (current.runCount || 0) + 1,
        }));
      } catch (err) {
        patchRunCell(cell._id, { outputs: [{ type: 'error', text: err.message }] });
      }
    },
    [ensureSetup, hiddenSetup, language, label, patchRunCell, runCell, status, toast],
  );

  const runAllCells = useCallback(async () => {
    if (status !== 'ready') return;
    for (const cell of runCells) {
      if (cell.type !== 'code' || !cell.source?.trim()) continue;
      // Sequential — cells share one kernel namespace, so order is the contract.
      // eslint-disable-next-line no-await-in-loop
      await executeCell(cell);
    }
  }, [executeCell, runCells, status]);

  const restartKernel = useCallback(() => {
    setupRef.current = null;
    restart();
    setRunCells((current) => current.map((cell) => ({ ...cell, runCount: 0 })));
  }, [restart]);

  const stopKernel = useCallback(() => {
    setupRef.current = null;
    stop();
    setRunCells((current) => current.map((cell) => ({ ...cell, runCount: 0 })));
  }, [stop]);

  if (loading) return <Loading label="Loading submissions…" />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  return (
    <VStack align="stretch" spacing={4}>
      <Flex align="center" gap={3} wrap="wrap">
        <Heading size="md" flex="1">
          Submissions
        </Heading>
        <Button as={RouterLink} to={`/learning/class/${classId}/notebooks`} size="sm" variant="ghost">
          Back to notebooks
        </Button>
        <Button
          as={RouterLink}
          to={`/learning/class/${classId}/notebook/${notebookId}/edit`}
          size="sm"
          variant="outline"
        >
          Edit notebook
        </Button>
      </Flex>

      <Alert status="info" borderRadius="md" fontSize="sm">
        <AlertIcon />
        <Box>
          <Text fontWeight="600">Marked by hand, on purpose.</Text>
          <Text>
            Cell output is recorded from the student&apos;s own browser, so it shows what they saw rather than
            anything the server ran. The code is the part worth grading.
          </Text>
        </Box>
      </Alert>

      {tally && attempts.length > 0 && (
        <Flex gap={3} wrap="wrap" align="center">
          <StatTile label="Started" value={tally.started} />
          <StatTile label="Submitted" value={tally.submitted} />
          {dueDate ? (
            <>
              <StatTile label="On time" value={tally.onTime} accent="green.500" />
              <StatTile label="Late" value={tally.late} accent={tally.late ? 'red.500' : 'gray.400'} />
            </>
          ) : null}
          <StatTile
            label="Ran every cell"
            value={tally.completed}
            hint="of those submitted"
            accent="purple.500"
          />
          {dueDate && <DeadlineCountdown dueDate={dueDate} />}
        </Flex>
      )}

      {attempts.length === 0 ? (
        <EmptyState icon="coding" title="Nobody has opened it yet" description="Work will appear here as students start." />
      ) : (
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Student</Th>
                <Th>Roll no</Th>
                <Th>Status</Th>
                <Th isNumeric>Cells run</Th>
                <Th>Worked through</Th>
                <Th>Hidden tests</Th>
                <Th isNumeric>Grade</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {attempts.map((row) => (
                <Tr key={row._id}>
                  <Td>{row.studentName || row.studentEmail}</Td>
                  <Td>{row.rollNumber || '—'}</Td>
                  <Td>
                    {row.submittedAt ? (
                      <HStack spacing={1}>
                        <Badge colorScheme={row.late ? 'orange' : 'green'}>
                          submitted {formatDateTime(row.submittedAt)}
                        </Badge>
                        {row.late && <Badge colorScheme="red">late</Badge>}
                      </HStack>
                    ) : row.lastSavedAt ? (
                      <Badge colorScheme="blue">in progress</Badge>
                    ) : (
                      <Badge>opened</Badge>
                    )}
                  </Td>
                  <Td isNumeric>
                    {row.codeCells ? `${row.cellsRun}/${row.codeCells}` : row.cellsRun}
                  </Td>
                  <Td>
                    {row.completed === null ? (
                      <Text fontSize="xs" opacity={0.5}>
                        —
                      </Text>
                    ) : row.completed ? (
                      <Badge colorScheme="green">every cell ran</Badge>
                    ) : (
                      <Badge colorScheme="yellow">
                        {row.cellsErrored ? `${row.cellsErrored} errored` : 'cells left unrun'}
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    {row.totalTestCases === null || row.totalTestCases === undefined || row.totalTestCases === 0 ? (
                      <Text fontSize="xs" opacity={0.5}>
                        —
                      </Text>
                    ) : row.passedTestCases === row.totalTestCases ? (
                      <Badge colorScheme="green">All Passed ({row.passedTestCases}/{row.totalTestCases})</Badge>
                    ) : (
                      <Badge colorScheme="red">{row.passedTestCases}/{row.totalTestCases} Passed</Badge>
                    )}
                  </Td>
                  <Td isNumeric>
                    {row.grade === null || row.grade === undefined
                      ? '—'
                      : `${row.grade}${row.maxPoints ? `/${row.maxPoints}` : ''}`}
                  </Td>
                  <Td textAlign="right">
                    <HStack spacing={1} justify="flex-end">
                      <Button size="xs" variant="outline" onClick={() => openAttempt(row)}>
                        {open?.attempt?._id === row._id ? 'Close' : 'Read'}
                      </Button>
                      {row.submittedAt && (
                        <Button size="xs" variant="ghost" onClick={() => reopen(row)}>
                          Reopen
                        </Button>
                      )}
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {open && (
        <SectionCard
          title={open.attempt.studentName || open.attempt.studentEmail}
          subtitle={
            open.attempt.submittedAt
              ? `Submitted ${formatDateTime(open.attempt.submittedAt)}`
              : 'Not submitted yet'
          }
        >
          <VStack align="stretch" spacing={3}>
            <Flex gap={2} wrap="wrap" align="center">
              {status === 'idle' || status === 'failed' ? (
                <Button size="xs" colorScheme="green" leftIcon={<FiPlay />} onClick={start}>
                  Start {label}
                </Button>
              ) : (
                <>
                  <Button
                    size="xs"
                    leftIcon={<FiFastForward />}
                    onClick={runAllCells}
                    isDisabled={status !== 'ready' || Boolean(busyCellId)}
                  >
                    Run all
                  </Button>
                  <Button size="xs" variant="outline" leftIcon={<FiRefreshCw />} onClick={restartKernel}>
                    Restart
                  </Button>
                  {busyCellId && (
                    <Button size="xs" colorScheme="red" leftIcon={<FiSquare />} onClick={stopKernel}>
                      Stop
                    </Button>
                  )}
                </>
              )}
              {detail && (
                <Text fontSize="xs" opacity={0.7}>
                  {detail}
                </Text>
              )}
            </Flex>

            {runCells.map((cell, index) => (
              <NotebookCell
                key={cell._id}
                cell={cell}
                index={index}
                total={runCells.length}
                language={language}
                readOnly
                running={busyCellId === cell._id}
                canRun={status === 'ready' && !busyCellId}
                onChange={(patch) => patchRunCell(cell._id, patch)}
                onRun={() => executeCell(cell)}
                onStop={stopKernel}
              />
            ))}

            <Flex gap={3} wrap="wrap" align="flex-end">
              <Box>
                <Text fontSize="xs" mb={1}>
                  Grade
                </Text>
                <Input
                  size="sm"
                  w="90px"
                  value={draft.grade}
                  onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
                />
              </Box>
              <Box>
                <Text fontSize="xs" mb={1}>
                  Out of
                </Text>
                <Input
                  size="sm"
                  w="90px"
                  value={draft.maxPoints}
                  onChange={(e) => setDraft({ ...draft, maxPoints: e.target.value })}
                />
              </Box>
              <Box flex="1" minW="220px">
                <Text fontSize="xs" mb={1}>
                  Feedback
                </Text>
                <Textarea
                  size="sm"
                  rows={2}
                  value={draft.feedback}
                  onChange={(e) => setDraft({ ...draft, feedback: e.target.value })}
                />
              </Box>
              <Button size="sm" colorScheme="purple" onClick={grade}>
                Return grade
              </Button>
            </Flex>
          </VStack>
        </SectionCard>
      )}
    </VStack>
  );
}
