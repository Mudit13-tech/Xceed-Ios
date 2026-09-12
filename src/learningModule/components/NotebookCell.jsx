import React, { useMemo, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Collapse,
  Flex,
  HStack,
  IconButton,
  Image,
  ListItem,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  UnorderedList,
  VStack,
  useColorMode,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  FiAlertCircle,
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiCheckSquare,
  FiChevronDown,
  FiChevronUp,
  FiEdit2,
  FiEye,
  FiHelpCircle,
  FiLock,
  FiPlay,
  FiPlus,
  FiSquare,
  FiTerminal,
  FiTrash2,
  FiXCircle,
} from 'react-icons/fi';
import CodeMirror, { EditorView, keymap } from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { Prec } from '@codemirror/state';

import HintTooltip from './HintTooltip';
import RichText from './RichText';
import { EXAMPLE_CELL } from '../sampleNotebook';

/**
 * One notebook cell: source on top, output underneath.
 *
 * Stacked output pane below editor for maximum readability.
 */

/** stderr and tracebacks read as errors; everything else gets its own tint. */
const OUTPUT_COLOUR = {
  stderr: 'red.400',
  error: 'red.400',
  result: 'purple.400',
  stdout: 'green.400',
};

function OutputBlock({ outputs, onClear }) {
  const bg = useColorModeValue('gray.50', 'blackAlpha.400');
  const border = useColorModeValue('gray.200', 'whiteAlpha.200');

  if (!outputs || outputs.length === 0) return null;

  return (
    <Box bg={bg} borderTopWidth="1px" borderColor={border}>
      <Flex align="center" justify="space-between" px={4} pt={2}>
        <Text fontSize="2xs" fontWeight="600" opacity={0.5} textTransform="uppercase">
          Output
        </Text>
        <HintTooltip label="Clear this cell's output">
          <IconButton
            aria-label="Clear output"
            icon={<FiXCircle />}
            size="xs"
            variant="ghost"
            onClick={onClear}
          />
        </HintTooltip>
      </Flex>

      <Box
        px={4}
        pb={3}
        pt={1}
        fontSize="sm"
        maxH="480px"
        overflowY="auto"
        overflowX="auto"
      >
        {(outputs || []).map((output, index) =>
          output.type === 'image' ? (
            <Image
              key={index}
              src={`data:image/png;base64,${output.text}`}
              alt="Figure produced by this cell"
              maxW="100%"
              my={2}
            />
          ) : (
            <Box
              key={index}
              as="pre"
              fontFamily="mono"
              fontSize="13px"
              lineHeight="1.5"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
              color={OUTPUT_COLOUR[output.type] || 'inherit'}
              fontStyle={output.type === 'result' ? 'italic' : 'normal'}
              m={0}
            >
              {output.text}
            </Box>
          ),
        )}
      </Box>
    </Box>
  );
}

function MarkdownCell({ cell, index, total, locked, readOnly, onChange, onMove, onDelete }) {
  const { colorMode } = useColorMode();
  const border = useColorModeValue('gray.200', 'whiteAlpha.200');
  const gutter = useColorModeValue('gray.50', 'whiteAlpha.50');

  const [editing, setEditing] = useState(() => !locked && !String(cell.source || '').trim());

  if (locked) {
    return (
      <Box borderWidth="1px" borderColor={border} borderRadius="md" overflow="hidden">
        <Box px={4} py={3}>
          <RichText markdown>{cell.source}</RichText>
        </Box>
      </Box>
    );
  }

  return (
    <Box borderWidth="1px" borderColor={border} borderRadius="md" overflow="hidden">
      <Flex align="center" gap={2} px={3} py={1} bg={gutter} borderBottomWidth="1px" borderColor={border}>
        <Badge fontSize="2xs">markdown</Badge>
        <Box flex="1" />
        <HintTooltip
          label={editing ? 'Show it the way it will be read' : 'Edit the Markdown source'}
        >
          <Button
            size="xs"
            variant="ghost"
            leftIcon={editing ? <FiEye /> : <FiEdit2 />}
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? 'Done' : 'Edit'}
          </Button>
        </HintTooltip>
        <CellControls
          index={index}
          total={total}
          onMove={onMove}
          onDelete={onDelete}
          readOnly={readOnly}
          canDelete={cell.sourceCellId == null}
        />
      </Flex>

      {editing ? (
        <CodeMirror
          value={cell.source}
          onChange={(source) => onChange({ source })}
          theme={colorMode === 'dark' ? 'dark' : 'light'}
          basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
          minHeight="60px"
        />
      ) : (
        <Box px={4} py={3} cursor="text" onDoubleClick={() => setEditing(true)}>
          <RichText
            markdown
            fallback={
              <Text fontSize="sm" opacity={0.5} fontStyle="italic">
                Empty — press Edit to write something.
              </Text>
            }
          >
            {cell.source}
          </RichText>
        </Box>
      )}
    </Box>
  );
}

function CellStatus({ running, cell }) {
  if (running) {
    return (
      <HStack spacing={1.5} color="blue.400" flexShrink={0}>
        <Spinner size="xs" speed="0.7s" />
        <Text fontSize="xs" fontWeight="500">
          Running…
        </Text>
      </HStack>
    );
  }

  if (!cell.runCount) return null;

  const failed = (cell.outputs || []).some((output) => output.type === 'error');
  const at = cell.executedAt ? new Date(cell.executedAt) : null;
  const when = at && !Number.isNaN(at.getTime()) ? ` at ${at.toLocaleTimeString()}` : '';

  return (
    <HintTooltip
      label={
        failed
          ? `This cell finished with an error${when}`
          : `Ran without errors${when}. A cell that assigns or defines something shows no output — that is normal.`
      }
    >
      <HStack as="span" spacing={1} color={failed ? 'red.400' : 'green.400'} flexShrink={0}>
        <Box as="span" display="inline-flex" fontSize="14px">
          {failed ? <FiAlertCircle aria-label="Finished with an error" /> : <FiCheckCircle aria-label="Ran successfully" />}
        </Box>
        <Text as="span" fontSize="xs" fontWeight="500">
          {failed ? 'Error' : 'Completed'}
        </Text>
      </HStack>
    </HintTooltip>
  );
}

/** One titled block of the setup guide. */
function GuideSection({ title, children }) {
  return (
    <Box>
      <Text fontSize="xs" fontWeight="700" mb={1}>
        {title}
      </Text>
      <UnorderedList spacing={1} ml={4} fontSize="xs" lineHeight="1.55">
        {children}
      </UnorderedList>
    </Box>
  );
}

const Code = ({ children }) => (
  <Box as="code" fontFamily="mono" fontSize="0.95em" px={1} borderRadius="sm" bg="blackAlpha.100">
    {children}
  </Box>
);

/**
 * What a teacher needs to know to set up a tested exercise in this cell.
 *
 * Every statement here is a description of what the kernels and `testRunner`
 * actually do — the cell source is what students start from, a test's input is
 * the program's stdin, and output is compared after `normalizeOutput`. If one
 * of those changes, this has to change with it.
 */
function SetupGuide({ isC, canInsertExample, onInsertExample }) {
  const bg = useColorModeValue('blue.50', 'blackAlpha.300');
  const border = useColorModeValue('blue.200', 'blue.800');
  const exampleBg = useColorModeValue('white', 'gray.800');

  // The same code "Insert example" puts in the cell, so what is shown is what you get.
  const example = EXAMPLE_CELL[isC ? 'c' : 'python'].source.trim();

  return (
    <Box bg={bg} borderTopWidth="1px" borderColor={border} p={3}>
      <Flex align="center" justify="space-between" mb={2} gap={2} wrap="wrap">
        <Text fontSize="xs" fontWeight="700" color="blue.600" textTransform="uppercase">
          How to set up this exercise
        </Text>
        {canInsertExample && (
          <HintTooltip label="Fills this empty cell with the example below, a sample input and two test cases">
            <Button size="xs" colorScheme="blue" variant="outline" onClick={onInsertExample}>
              Insert example
            </Button>
          </HintTooltip>
        )}
      </Flex>

      <Flex gap={4} direction={{ base: 'column', lg: 'row' }}>
        <VStack align="stretch" spacing={3} flex="3">
          <GuideSection title="1. What you write here, and what the student writes">
            <ListItem>
              The code in this cell is exactly what every student starts with. Write <b>starter code</b>: the
              lines that read the input, the function headers, and <Code>TODO</Code> comments. Leave the logic out.
            </ListItem>
            <ListItem>
              To check your tests, paste your full solution here, press <b>Test Cases</b> →{' '}
              <b>Test Solution on Cell</b>, then put the starter code back before you save.
            </ListItem>
            {isC && (
              <ListItem>
                Each C cell is a whole program and needs its own <Code>main()</Code>.
              </ListItem>
            )}
          </GuideSection>

          <GuideSection title="2. How a test case's input reaches the code">
            <ListItem>
              A test&apos;s <b>Input</b> is fed to the program as if typed at the keyboard, and its{' '}
              <b>Expected output</b> is compared with what the program prints.
            </ListItem>
            {isC ? (
              <ListItem>
                <Code>scanf(&quot;%d&quot;, …)</Code> skips spaces and line breaks, so <Code>3 4</Code> on one line
                and on two lines read the same. <Code>fgets</Code> reads one whole line. Reading past the end gives
                EOF.
              </ListItem>
            ) : (
              <ListItem>
                Each line of the Input is returned by one <Code>input()</Code> call. <Code>3 4</Code> is one line:{' '}
                <Code>a, b = map(int, input().split())</Code>. Two lines need two <Code>input()</Code> calls.
              </ListItem>
            )}
            <ListItem>
              The <b>Input</b> box under the cell is only sample input for the ▶ button. Students get a copy of it,
              and hidden tests don&apos;t use it.
            </ListItem>
          </GuideSection>

          <GuideSection title="3. How the output is checked">
            <ListItem>
              It has to match exactly, including capital letters. Spaces at the end of lines and blank lines at the
              start or end are ignored.
            </ListItem>
            <ListItem>
              No prompts in tested cells:{' '}
              {isC ? <Code>printf(&quot;Enter a number: &quot;)</Code> : <Code>input(&quot;Enter a number: &quot;)</Code>}{' '}
              prints the prompt, which then fails the match. Print only the answer.
            </ListItem>
          </GuideSection>

          <GuideSection title="4. Helper functions (sub-functions)">
            <ListItem>
              Yes, put them in the same cell, one after another, <b>above</b>{' '}
              {isC ? <Code>main()</Code> : 'the code that calls them'}. Tests run this one cell by itself, so
              everything the test needs must be in it.
            </ListItem>
            <ListItem>
              If students should call a function but not write it, put it in a separate cell and tick{' '}
              <b>Hidden setup</b>. It runs before every student cell and test
              {isC ? ', and must not have its own main()' : ''}.
            </ListItem>
          </GuideSection>
        </VStack>

        <Box flex="2" minW={0}>
          <Text fontSize="2xs" fontWeight="600" opacity={0.6} mb={1}>
            EXAMPLE STARTER CODE
          </Text>
          <Box
            as="pre"
            bg={exampleBg}
            borderWidth="1px"
            borderColor={border}
            borderRadius="md"
            p={2}
            fontFamily="mono"
            fontSize="11px"
            lineHeight="1.5"
            overflowX="auto"
            m={0}
          >
            {example}
          </Box>
          <Text fontSize="2xs" opacity={0.7} mt={1.5}>
            Test case: Input <Code>3 4</Code> → Expected output <Code>7</Code>. The student replaces the TODO;
            the input and print lines stay as they are.
          </Text>
        </Box>
      </Flex>
    </Box>
  );
}

/**
 * Panel for Faculty authoring of hidden test cases per cell
 */
function TestCasesEditorPanel({
  testCases = [],
  isC = false,
  onChange,
  onRunTestCases,
  testing = false,
  testSummary,
}) {
  const bg = useColorModeValue('purple.50', 'blackAlpha.300');
  const border = useColorModeValue('purple.200', 'purple.800');

  const addTestCase = () => {
    onChange([...testCases, { input: '', output: '' }]);
  };

  const updateTestCase = (index, patch) => {
    const next = [...testCases];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeTestCase = (index) => {
    onChange(testCases.filter((_, i) => i !== index));
  };

  return (
    <Box bg={bg} borderTopWidth="1px" borderColor={border} p={3}>
      <Flex align="center" justify="space-between" mb={2} wrap="wrap" gap={2}>
        <HStack spacing={2}>
          <Text fontSize="xs" fontWeight="700" color="purple.600" textTransform="uppercase">
            Hidden Test Cases ({testCases.length})
          </Text>
          {testSummary?.total > 0 && (
            <Badge colorScheme={testSummary.passedAll ? 'green' : 'red'} fontSize="2xs">
              {testSummary.passedAll ? 'Completed (Yes)' : `Failed (No - ${testSummary.passed}/${testSummary.total})`}
            </Badge>
          )}
        </HStack>
        <HStack spacing={2}>
          {typeof onRunTestCases === 'function' && testCases.length > 0 && (
            <Button
              size="xs"
              colorScheme="purple"
              leftIcon={testing ? <Spinner size="xs" /> : <FiPlay />}
              isLoading={testing}
              onClick={onRunTestCases}
            >
              Test Solution on Cell
            </Button>
          )}
          <Button size="xs" variant="outline" colorScheme="purple" leftIcon={<FiPlus />} onClick={addTestCase}>
            Add Test Case
          </Button>
        </HStack>
      </Flex>
      <Text fontSize="2xs" opacity={0.7} mb={1}>
        Students never see these. They press &quot;Run Hidden Test Case&quot;, and their code is run once for each
        test below and gets a Yes/No result.
      </Text>
      <Text fontSize="2xs" opacity={0.7} mb={3}>
        <b>Input</b> is typed into the program for that run
        {isC ? ' (what scanf / fgets read)' : ', one line per input() call'}. <b>Expected output</b> is exactly what
        it should print. Capital letters count; spaces at line ends and trailing blank lines don&apos;t.
      </Text>

      {testCases.length === 0 ? (
        <Text fontSize="xs" fontStyle="italic" opacity={0.6} py={1}>
          No test cases added yet. Click &quot;Add Test Case&quot; above.
        </Text>
      ) : (
        <VStack align="stretch" spacing={3}>
          {testCases.map((tc, idx) => (
            <Box
              key={tc._id || idx}
              p={2.5}
              borderWidth="1px"
              borderRadius="md"
              borderColor={border}
              bg={useColorModeValue('white', 'gray.800')}
            >
              <Flex justify="space-between" align="center" mb={1.5}>
                <Text fontSize="xs" fontWeight="600">
                  Test Case #{idx + 1}
                </Text>
                <IconButton
                  aria-label="Remove test case"
                  icon={<FiTrash2 />}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => removeTestCase(idx)}
                />
              </Flex>
              <Flex gap={3} direction={{ base: 'column', sm: 'row' }}>
                <Box flex="1">
                  <Text fontSize="2xs" fontWeight="600" opacity={0.6} mb={0.5}>
                    Input (stdin)
                  </Text>
                  <Textarea
                    size="xs"
                    fontFamily="mono"
                    rows={3}
                    placeholder={
                      isC
                        ? 'What the program reads, e.g.\n5\n2 3 4 5 6\n(empty if it reads nothing)'
                        : 'One line per input() call, e.g.\n5\n2 3 4 5 6\n(empty if it reads nothing)'
                    }
                    value={tc.input || ''}
                    onChange={(e) => updateTestCase(idx, { input: e.target.value })}
                  />
                </Box>
                <Box flex="1">
                  <Text fontSize="2xs" fontWeight="600" opacity={0.6} mb={0.5}>
                    Expected Output (stdout)
                  </Text>
                  <Textarea
                    size="xs"
                    fontFamily="mono"
                    rows={3}
                    placeholder={'Exactly what it should print, e.g.\n3'}
                    value={tc.output || ''}
                    onChange={(e) => updateTestCase(idx, { output: e.target.value })}
                  />
                </Box>
              </Flex>
            </Box>
          ))}
        </VStack>
      )}
    </Box>
  );
}

/**
 * Interactive Test Results display for Student and Teacher
 */
function TestResultsPanel({ testResults = [], testSummary, isTeacher = false }) {
  const bg = useColorModeValue('gray.50', 'blackAlpha.300');
  const border = useColorModeValue('gray.200', 'whiteAlpha.200');

  if (!testResults || testResults.length === 0) return null;

  return (
    <Box bg={bg} borderTopWidth="1px" borderColor={border} p={3}>
      <Flex align="center" justify="space-between" mb={2}>
        <HStack spacing={2}>
          <Text fontSize="xs" fontWeight="700" textTransform="uppercase" opacity={0.7}>
            Test Case Results
          </Text>
          <Badge
            colorScheme={testSummary?.passedAll ? 'green' : 'red'}
            fontSize="xs"
            px={2}
            py={0.5}
            borderRadius="full"
          >
            {testSummary?.passedAll
              ? 'Passed (Yes - All Completed)'
              : `Failed (No - ${testSummary?.passed || 0}/${testSummary?.total || testResults.length} Passed)`}
          </Badge>
        </HStack>
      </Flex>

      <VStack align="stretch" spacing={2}>
        {testResults.map((result, idx) => (
          <Box
            key={idx}
            p={2}
            borderWidth="1px"
            borderRadius="md"
            borderColor={result.passed ? 'green.200' : 'red.200'}
            bg={result.passed ? useColorModeValue('green.50', 'rgba(72,187,120,0.1)') : useColorModeValue('red.50', 'rgba(245,101,101,0.1)')}
          >
            <Flex justify="space-between" align="center">
              <HStack spacing={2}>
                <Box color={result.passed ? 'green.500' : 'red.500'} fontSize="14px">
                  {result.passed ? <FiCheckCircle /> : <FiXCircle />}
                </Box>
                <Text fontSize="xs" fontWeight="600">
                  Test #{idx + 1}:
                </Text>
                <Badge colorScheme={result.passed ? 'green' : 'red'} fontSize="2xs">
                  {result.passed ? 'Yes (Passed)' : 'No (Failed)'}
                </Badge>
              </HStack>
              {result.executedAt && (
                <Text fontSize="2xs" opacity={0.5}>
                  {new Date(result.executedAt).toLocaleTimeString()}
                </Text>
              )}
            </Flex>

            {!result.passed && (
              <Box mt={1.5} pt={1.5} borderTopWidth="1px" borderColor={result.passed ? 'green.200' : 'red.200'}>
                {result.error ? (
                  <Text fontSize="2xs" fontFamily="mono" color="red.500">
                    Error: {result.error}
                  </Text>
                ) : (
                  <VStack align="stretch" spacing={1} fontSize="2xs" fontFamily="mono">
                    {isTeacher && (
                      <>
                        {result.input && <Text opacity={0.8}>Input: {result.input}</Text>}
                        <Text color="green.600">Expected: {result.expectedOutput}</Text>
                      </>
                    )}
                    <Text color="red.500">
                      {isTeacher ? `Actual: ${result.actualOutput || '(empty)'}` : 'Output did not match expected result.'}
                    </Text>
                  </VStack>
                )}
              </Box>
            )}
          </Box>
        ))}
      </VStack>
    </Box>
  );
}

export default function NotebookCell({
  cell,
  index,
  total,
  language = 'python',
  readOnly = false,
  running = false,
  testing = false,
  canRun = true,
  isEditor = false,
  testCases = null,
  // Refuses paste and drag-drop into the code editor; `onPasteBlocked` hears
  // about each refusal so the page can tell the student and record it.
  blockPaste = false,
  onPasteBlocked,
  onChange,
  onRun,
  onStop,
  onMove,
  onDelete,
  onRunTests,
}) {
  const { colorMode } = useColorMode();
  const border = useColorModeValue('gray.200', 'whiteAlpha.200');
  const gutter = useColorModeValue('gray.50', 'whiteAlpha.50');
  const hiddenNoteBg = useColorModeValue('orange.50', 'blackAlpha.300');

  const isC = language === 'c';

  const runKeymap = useMemo(
    () =>
      Prec.highest(
        keymap.of([
          {
            key: 'Shift-Enter',
            run: () => {
              if (canRun && !running) onRun();
              return true;
            },
          },
        ]),
      ),
    [canRun, running, onRun],
  );

  // Kept in a ref so a new callback each render does not rebuild the editor's
  // extensions, which would reset its state.
  const onPasteBlockedRef = useRef(onPasteBlocked);
  onPasteBlockedRef.current = onPasteBlocked;

  const pasteGuard = useMemo(() => {
    if (!blockPaste) return [];
    const refuse = (event) => {
      event.preventDefault();
      onPasteBlockedRef.current?.();
      return true;
    };
    return Prec.highest(
      EditorView.domEventHandlers({
        paste: refuse,
        drop: refuse,
        // Belt and braces for inputs that arrive without a paste event, such as
        // some mobile keyboards' clipboard suggestions.
        beforeinput: (event) =>
          event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop' ? refuse(event) : false,
      }),
    );
  }, [blockPaste]);

  const extensions = useMemo(
    () => [isC ? cpp() : python(), runKeymap, pasteGuard],
    [isC, runKeymap, pasteGuard],
  );
  const locked = cell.locked || readOnly;

  const [showStdin, setShowStdin] = useState(() => isC || Boolean(cell.stdin));
  const [showTestCases, setShowTestCases] = useState(false);
  const [showTestResults, setShowTestResults] = useState(true);
  // Open by default on a fresh cell, the moment a teacher is deciding what to
  // write in it; closed on cells that already have code, where it is noise.
  const [showGuide, setShowGuide] = useState(
    () => isEditor && !cell.hidden && !String(cell.source || '').trim() && !(cell.testCases || []).length,
  );

  if (cell.type === 'markdown') {
    return (
      <MarkdownCell
        cell={cell}
        index={index}
        total={total}
        locked={locked}
        readOnly={readOnly}
        onChange={onChange}
        onMove={onMove}
        onDelete={onDelete}
      />
    );
  }

  // Active test cases from either cell definition or passed testCases prop
  const activeTestCases = testCases || cell.testCases || [];
  const hasTestCases = activeTestCases.length > 0;
  const testResults = cell.testResults || [];
  const testSummary = cell.testSummary;

  return (
    <Box borderWidth="1px" borderColor={border} borderRadius="md" overflow="hidden">
      <Flex align="center" gap={2} px={3} py={1.5} bg={gutter} borderBottomWidth="1px" borderColor={border} wrap="wrap">
        <HintTooltip label={running ? 'Stop the kernel' : 'Run this cell'}>
          <IconButton
            aria-label={running ? 'Stop' : 'Run cell'}
            icon={running ? <FiSquare /> : <FiPlay />}
            size="xs"
            colorScheme={running ? 'red' : 'green'}
            variant={running ? 'solid' : 'ghost'}
            isDisabled={!canRun && !running}
            onClick={running ? onStop : onRun}
          />
        </HintTooltip>

        <Text fontSize="xs" fontFamily="mono" opacity={0.55} minW="36px">
          [{cell.runCount || ' '}]
        </Text>

        <CellStatus running={running} cell={cell} />

        {cell.locked && (
          <HintTooltip label="Set up by your teacher — you can run it but not change it">
            <Badge display="flex" alignItems="center" gap={1} fontSize="2xs">
              <FiLock /> locked
            </Badge>
          </HintTooltip>
        )}

        {/* Hidden Test Case badges & Execution action */}
        {hasTestCases && (
          <HStack spacing={1.5}>
            <Badge colorScheme="purple" fontSize="2xs" px={1.5}>
              Hidden Tests ({activeTestCases.length})
            </Badge>
            {testSummary?.total > 0 && (
              <Badge
                colorScheme={testSummary.passedAll ? 'green' : 'red'}
                display="flex"
                alignItems="center"
                gap={1}
                fontSize="2xs"
                px={1.5}
              >
                {testSummary.passedAll ? <FiCheckCircle /> : <FiXCircle />}
                {testSummary.passedAll
                  ? 'Completed (Yes)'
                  : `Failed (No - ${testSummary.passed}/${testSummary.total})`}
              </Badge>
            )}
            {typeof onRunTests === 'function' && !cell.hidden && (
              <HintTooltip label="Evaluate cell against hidden test cases">
                <Button
                  size="xs"
                  colorScheme={testSummary?.passedAll ? 'green' : 'purple'}
                  variant="solid"
                  leftIcon={testing ? <Spinner size="xs" /> : <FiCheckSquare />}
                  isLoading={testing}
                  isDisabled={!canRun || testing || running}
                  onClick={() => onRunTests(cell)}
                >
                  Run Hidden Test Case
                </Button>
              </HintTooltip>
            )}
          </HStack>
        )}

        <HintTooltip
          label={
            isC
              ? 'What this program reads with scanf or fgets'
              : 'What input() reads in this cell'
          }
        >
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<FiTerminal />}
            onClick={() => setShowStdin((current) => !current)}
          >
            Input
          </Button>
        </HintTooltip>

        {isEditor && !cell.hidden && (
          <Button
            size="xs"
            variant={showTestCases ? 'solid' : 'ghost'}
            colorScheme="purple"
            leftIcon={<FiCheckSquare />}
            onClick={() => setShowTestCases((current) => !current)}
          >
            Test Cases ({activeTestCases.length})
          </Button>
        )}

        {isEditor && !cell.hidden && (
          <HintTooltip label="What to write here, how test inputs are fed in, and how output is checked">
            <Button
              size="xs"
              variant={showGuide ? 'solid' : 'ghost'}
              colorScheme="blue"
              leftIcon={<FiHelpCircle />}
              onClick={() => setShowGuide((current) => !current)}
            >
              Setup guide
            </Button>
          </HintTooltip>
        )}

        {testResults.length > 0 && (
          <Button
            size="xs"
            variant="ghost"
            rightIcon={showTestResults ? <FiChevronUp /> : <FiChevronDown />}
            onClick={() => setShowTestResults((c) => !c)}
          >
            Test Results
          </Button>
        )}

        <Box flex="1" />
        <CellControls
          index={index}
          total={total}
          onMove={onMove}
          onDelete={onDelete}
          readOnly={readOnly || cell.locked}
          canDelete={cell.sourceCellId == null}
        />
      </Flex>

      {isEditor && cell.hidden && (
        <Text fontSize="2xs" px={3} py={1.5} bg={hiddenNoteBg} borderBottomWidth="1px" borderColor={border}>
          <b>Hidden setup:</b>{' '}
          {isC
            ? 'pasted in front of every student cell before it compiles. Put shared #include lines and helper functions here, but no main().'
            : 'runs before any student cell and before every hidden test. Put imports, data and helper functions here that students may call but should not write.'}{' '}
          Students never see it.
        </Text>
      )}

      <CodeMirror
        value={cell.source}
        onChange={(source) => onChange({ source })}
        theme={colorMode === 'dark' ? 'dark' : 'light'}
        extensions={extensions}
        editable={!locked}
        placeholder={
          isEditor && !cell.hidden
            ? 'Write the starter code students begin from: input lines, function headers and TODO comments. Open "Setup guide" for help.'
            : undefined
        }
        basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: false }}
        minHeight="72px"
      />

      {isEditor && showGuide && !cell.hidden && (
        <SetupGuide
          isC={isC}
          canInsertExample={!String(cell.source || '').trim() && !(cell.testCases || []).length}
          onInsertExample={() => {
            const example = EXAMPLE_CELL[isC ? 'c' : 'python'];
            onChange({
              source: example.source,
              stdin: example.stdin,
              testCases: example.testCases.map((tc) => ({ ...tc })),
            });
            setShowStdin(true);
            setShowTestCases(true);
          }}
        />
      )}

      {showStdin && (
        <Box px={3} py={2} borderTopWidth="1px" borderColor={border}>
          <Text fontSize="2xs" fontWeight="600" opacity={0.5} textTransform="uppercase" mb={1}>
            Input (stdin)
          </Text>
          {isEditor && !cell.hidden && (
            <Text fontSize="2xs" opacity={0.7} mb={1}>
              Sample input for the ▶ button. Students get a copy of it to try their code with. Hidden tests don&apos;t
              use this box; each test has its own Input.
            </Text>
          )}
          <Textarea
            value={cell.stdin || ''}
            onChange={(event) => onChange({ stdin: event.target.value })}
            isDisabled={readOnly}
            placeholder={isC ? 'Typed as if at a terminal, e.g. 3 4' : 'Read line by line by input()'}
            rows={2}
            fontFamily="mono"
            fontSize="13px"
          />
        </Box>
      )}

      {/* Editor Test Cases Panel */}
      {isEditor && showTestCases && (
        <TestCasesEditorPanel
          testCases={cell.testCases || []}
          isC={isC}
          onChange={(newTestCases) => onChange({ testCases: newTestCases })}
          onRunTestCases={onRunTests ? () => onRunTests(cell) : null}
          testing={testing}
          testSummary={testSummary}
        />
      )}

      {/* Test Results Output */}
      {showTestResults && testResults.length > 0 && (
        <TestResultsPanel testResults={testResults} testSummary={testSummary} isTeacher={isEditor} />
      )}

      <OutputBlock outputs={cell.outputs} onClear={() => onChange({ outputs: [] })} />
    </Box>
  );
}

/**
 * Move stays available on a teacher's cell — reordering the notebook is fine —
 * but delete does not: `canDelete` is false for anything with a `sourceCellId`,
 * which only the student's own added cells lack. Only the teacher may remove
 * their own cells, from the authoring page.
 */
function CellControls({ index, total, onMove, onDelete, readOnly, canDelete = true }) {
  if (readOnly) return null;
  return (
    <HStack spacing={0}>
      <IconButton
        aria-label="Move cell up"
        icon={<FiArrowUp />}
        size="xs"
        variant="ghost"
        isDisabled={index === 0}
        onClick={() => onMove(-1)}
      />
      <IconButton
        aria-label="Move cell down"
        icon={<FiArrowDown />}
        size="xs"
        variant="ghost"
        isDisabled={index === total - 1}
        onClick={() => onMove(1)}
      />
      {canDelete && (
        <IconButton
          aria-label="Delete cell"
          icon={<FiTrash2 />}
          size="xs"
          variant="ghost"
          colorScheme="red"
          onClick={onDelete}
        />
      )}
    </HStack>
  );
}