import React, { useCallback, useEffect, useState } from 'react';
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
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import jsPDF from 'jspdf';

import lmApi from '../api/lmApi';
import {
  DeadlineCountdown,
  EmptyState,
  ErrorState,
  Loading,
  SectionCard,
  StatTile,
} from '../components/common';
import RichText from '../components/RichText';
import { formatDateTime } from '../format';

/**
 * Build a PDF for a single student's attempt: header (name, roll no,
 * submission time, grade), then each cell's code and its outputs.
 * Images already come in as base64 PNG, so they drop straight into
 * jsPDF's addImage without any conversion.
 */
function buildAttemptPdf(attempt) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = 50;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
  };

  // jsPDF's built-in fonts only cover WinAnsi/Latin-1. Anything outside
  // that (emoji, arrows, icon-font glyphs like a run-button symbol) comes
  // back with a wrong measured width, which throws off splitTextToSize
  // and produces the stretched, cut-off lines. Normalize common "smart"
  // punctuation to plain ASCII first, then drop whatever's left outside
  // Latin-1.
  const sanitizeForPdf = (text) =>
    String(text ?? '')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/[•▪●]/g, '*')
      .replace(/[^\x00-\xFF\n]/g, '');

  const stripInlineMarkdown = (text) =>
    sanitizeForPdf(text)
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\*\*([^*]*)\*\*/g, '$1')
      .replace(/__([^_]*)__/g, '$1')
      .replace(/\*([^*]*)\*/g, '$1')
      .replace(/_([^_]*)_/g, '$1');

  const addWrappedText = (text, { font = 'helvetica', style = 'normal', size = 10, color = '#000000', lineHeight = 14 } = {}) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(sanitizeForPdf(text), maxWidth);
    lines.forEach((line) => {
      ensureSpace(lineHeight);
      doc.text(line, marginX, y);
      y += lineHeight;
    });
  };

  // Very small markdown renderer: headings get bold + a bigger size (no
  // literal "#" shown), inline **bold**/*italic*/`code` markers are
  // stripped rather than printed as-is, blank lines add a bit of breathing
  // room.
  const addMarkdownBlock = (source) => {
    String(source ?? '')
      .split('\n')
      .forEach((rawLine) => {
        const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const size = Math.max(11, 18 - level * 2);
          y += 4;
          addWrappedText(stripInlineMarkdown(headingMatch[2]), { style: 'bold', size, lineHeight: size + 4 });
          y += 2;
          return;
        }
        if (rawLine.trim() === '') {
          y += 6;
          return;
        }
        addWrappedText(stripInlineMarkdown(rawLine), { size: 11, lineHeight: 15 });
      });
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor('#000000');
  doc.text(attempt.studentName || attempt.studentEmail || 'Student', marginX, y);
  y += 20;

  const metaBits = [
    `Roll no: ${attempt.rollNumber || '—'}`,
    attempt.submittedAt ? `Submitted: ${formatDateTime(attempt.submittedAt)}` : 'Not submitted',
  ];
  addWrappedText(metaBits.join('   '), { size: 10, color: '#555555', lineHeight: 14 });

  if (attempt.grade !== null && attempt.grade !== undefined) {
    addWrappedText(
      `Grade: ${attempt.grade}${attempt.maxPoints ? `/${attempt.maxPoints}` : ''}`,
      { size: 10, color: '#555555', lineHeight: 14 },
    );
  }
  if (attempt.feedback) {
    addWrappedText(`Feedback: ${attempt.feedback}`, { size: 10, color: '#555555', lineHeight: 14 });
  }
  y += 10;

  // PDF-only reordering. This never touches attempt.cells itself, so the
  // on-screen viewer is unaffected — it only decides what order cells are
  // drawn in *here*. Markdown cells whose first heading matches one of
  // these names are either dropped entirely (instructions the grader
  // doesn't need on paper) or pulled to the front with that heading line
  // removed (so the actual question reads first, without a "Your turn"
  // label). Add more names to either list if other notebooks use
  // different section titles.
  const DROP_HEADINGS = ['getting started'];
  const PROMOTE_HEADINGS = ['your turn'];

  const firstHeadingOf = (cell) => {
    if (cell.type !== 'markdown') return null;
    const match = String(cell.source || '').match(/^#{1,6}\s+(.*)$/m);
    return match ? match[1].trim().toLowerCase() : null;
  };

  const withoutFirstHeadingLine = (source) =>
    String(source || '').replace(/^#{1,6}\s+.*(\n|$)/, '');

  const promoted = [];
  const rest = [];
  (attempt.cells || []).forEach((cell) => {
    const heading = firstHeadingOf(cell);
    if (heading && DROP_HEADINGS.includes(heading)) return;
    if (heading && PROMOTE_HEADINGS.includes(heading)) {
      promoted.push({ ...cell, source: withoutFirstHeadingLine(cell.source) });
      return;
    }
    rest.push(cell);
  });
  const pdfCells = [...promoted, ...rest];

  pdfCells.forEach((cell, idx) => {
    ensureSpace(24);

    if (cell.type === 'markdown') {
      addMarkdownBlock(cell.source);
      y += 6;
      return;
    }

    // Cell index label
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor('#7c3aed');
    doc.text(`[${idx + 1}]`, marginX, y);
    y += 12;

    // Code, monospace
    addWrappedText(cell.source || '(empty)', { font: 'courier', size: 9, color: '#111111', lineHeight: 12 });
    y += 4;

    (cell.outputs || []).forEach((output) => {
      if (output.type === 'image') {
        try {
          const dataUrl = `data:image/png;base64,${output.text}`;
          const imgProps = doc.getImageProperties(dataUrl);
          const imgWidth = Math.min(maxWidth, imgProps.width);
          const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
          ensureSpace(imgHeight + 10);
          doc.addImage(dataUrl, 'PNG', marginX, y, imgWidth, imgHeight);
          y += imgHeight + 10;
        } catch {
          addWrappedText('[image could not be embedded]', { size: 9, color: '#999999', lineHeight: 12 });
        }
      } else {
        const isErr = output.type === 'stderr' || output.type === 'error';
        addWrappedText(output.text, {
          font: 'courier',
          size: 9,
          color: isErr ? '#cc3333' : '#333333',
          lineHeight: 12,
        });
      }
    });

    y += 10;
  });

  const fileName = `${(attempt.studentName || attempt.studentEmail || 'submission').replace(/\s+/g, '_')}_notebook.pdf`;
  doc.save(fileName);
}

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
  const [downloadingId, setDownloadingId] = useState(null);

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

  // Downloads a PDF for a row without needing it expanded first — reuses
  // the already-open attempt's full data if it's the one currently open,
  // otherwise fetches it fresh.
  const downloadPdf = async (row) => {
    setDownloadingId(row._id);
    try {
      const data =
        open?.attempt?._id === row._id ? open : await lmApi.getNotebookAttempt(classId, row._id);
      buildAttemptPdf(data.attempt);
    } catch (err) {
      toast({ status: 'error', title: 'Could not build PDF', description: err.message });
    } finally {
      setDownloadingId(null);
    }
  };

  const codeBg = useColorModeValue('gray.50', 'blackAlpha.400');

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
        <EmptyState icon="🐍" title="Nobody has opened it yet" description="Work will appear here as students start." />
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
                      <Button
                        size="xs"
                        variant="ghost"
                        isLoading={downloadingId === row._id}
                        onClick={() => downloadPdf(row)}
                      >
                        PDF
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
            <Flex justify="flex-end">
              <Button
                size="xs"
                variant="outline"
                isLoading={downloadingId === open.attempt._id}
                onClick={() => downloadPdf(open.attempt)}
              >
                Download PDF
              </Button>
            </Flex>

            {(open.attempt.cells || []).map((cell) => (
              <Box key={cell._id} borderWidth="1px" borderRadius="md" overflow="hidden">
                {cell.type === 'markdown' ? (
                  <Box px={4} py={3} fontSize="sm">
                    <RichText>{cell.source}</RichText>
                  </Box>
                ) : (
                  <>
                    <Box
                      as="pre"
                      px={4}
                      py={3}
                      m={0}
                      fontFamily="mono"
                      fontSize="13px"
                      whiteSpace="pre-wrap"
                      wordBreak="break-word"
                    >
                      {cell.source || <Text as="span" opacity={0.5}>(empty)</Text>}
                    </Box>
                    {(cell.outputs || []).length > 0 && (
                      <Box bg={codeBg} borderTopWidth="1px" px={4} py={2} maxH="260px" overflow="auto">
                        {cell.outputs.map((output, index) =>
                          output.type === 'image' ? (
                            <Box
                              key={index}
                              as="img"
                              src={`data:image/png;base64,${output.text}`}
                              alt="Figure the student produced"
                              maxW="100%"
                            />
                          ) : (
                            <Box
                              key={index}
                              as="pre"
                              m={0}
                              fontFamily="mono"
                              fontSize="12px"
                              whiteSpace="pre-wrap"
                              color={output.type === 'stderr' || output.type === 'error' ? 'red.400' : 'inherit'}
                            >
                              {output.text}
                            </Box>
                          ),
                        )}
                      </Box>
                    )}
                  </>
                )}
              </Box>
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
