import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  Input,
  List,
  ListItem,
  Select,
  SimpleGrid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  Tabs,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { ErrorState, Loading, SectionCard } from '../components/common';
import RichText from '../components/RichText';
import RichTextEditor from '../components/RichTextEditor';
import Equation from '../components/Equation';
import TableBuilderModal from '../components/TableBuilderModal';
import ImportQuestionsModal from '../components/ImportQuestionsModal';
import { formatAnswerValue, toDateTimeInput } from '../format';
import { LmIcon } from '../components/Icon';
import { AddQuestionMenu, FixedQuestionFields } from '../components/QuestionTypeFields';
import QuestionTypeBadge from '../components/QuestionTypeBadge';
import { QUESTION_TYPES, isFixedType, questionMarks, withType } from '../questionTypes';

// Integer by default: a question asking for "a 7 Ω resistor" is the common
// case, and a teacher who wants decimals says so, rather than having to turn
// 4.5137 back into a whole number on every variable they add.
const BLANK_VARIABLE = { name: '', type: 'integer', min: 1, max: 10, step: 1, decimals: 2, values: [], unit: '' };
const BLANK_ANSWER = { key: '', label: '', formula: '', unit: '', tolerancePercent: 1, toleranceAbs: 0, decimals: 2, marks: 1 };
const BLANK_QUESTION = {
  type: 'parametric',
  prompt: '',
  variables: [{ ...BLANK_VARIABLE, name: 'x' }],
  answers: [{ ...BLANK_ANSWER, label: 'Answer', formula: 'x' }],
  constraints: [],
  tables: [],
  hint: '',
  solutionSteps: '',
  difficulty: 'medium',
};

/** Starting variable and answer for a question switched to the parametric type. */
const parametricSeed = () => {
  const { variables, answers } = JSON.parse(JSON.stringify(BLANK_QUESTION));
  return { variables, answers };
};

/** A new question of the chosen type — the type is picked first, as in the quiz editor. */
const blankQuestion = (type) => {
  const blank = JSON.parse(JSON.stringify(BLANK_QUESTION));
  return type === 'parametric' ? blank : withType({ ...blank, variables: [], answers: [] }, type);
};

/** Live formula check, debounced, so errors show while the teacher types. */
function useFormulaCheck(classId, formula, variableNames) {
  const [state, setState] = useState({ ok: true, error: null, latex: null });
  const key = `${formula}|${variableNames.join(',')}`;

  useEffect(() => {
    if (!formula?.trim()) {
      setState({ ok: false, error: null, latex: null });
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await lmApi.validateFormula(classId, formula, variableNames);
        if (!cancelled) setState(result);
      } catch {
        // The formula is unchecked, not wrong — say nothing rather than
        // flagging a network blip as a bad formula. The equation preview drops
        // out for the same reason: better blank than stale.
        if (!cancelled) setState({ ok: true, error: null, latex: null });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `key` collapses the two real inputs into one stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, key]);

  return state;
}

function VariableRow({ variable, onChange, onRemove }) {
  const set = (field, value) => onChange({ ...variable, [field]: value });

  return (
    <Flex gap={2} align="flex-end" wrap="wrap" mb={2}>
      <FormControl maxW="110px">
        <FormLabel fontSize="xs" mb={1}>
          Name
        </FormLabel>
        <Input
          size="sm"
          value={variable.name}
          placeholder="R"
          onChange={(event) => set('name', event.target.value.trim())}
        />
      </FormControl>
      <FormControl maxW="120px">
        <FormLabel fontSize="xs" mb={1}>
          Type
        </FormLabel>
        <Select size="sm" value={variable.type} onChange={(event) => set('type', event.target.value)}>
          <option value="range">Decimal</option>
          <option value="integer">Integer</option>
          <option value="set">From a list</option>
        </Select>
      </FormControl>

      {variable.type === 'set' ? (
        <FormControl flex="1" minW="200px">
          <FormLabel fontSize="xs" mb={1}>
            Values (comma separated)
          </FormLabel>
          <Input
            size="sm"
            value={(variable.values || []).join(', ')}
            placeholder="2, 4, 8"
            onChange={(event) =>
              set(
                'values',
                event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              )
            }
          />
        </FormControl>
      ) : (
        <>
          <FormControl maxW="90px">
            <FormLabel fontSize="xs" mb={1}>
              Min
            </FormLabel>
            <Input size="sm" type="number" value={variable.min} onChange={(e) => set('min', Number(e.target.value))} />
          </FormControl>
          <FormControl maxW="90px">
            <FormLabel fontSize="xs" mb={1}>
              Max
            </FormLabel>
            <Input size="sm" type="number" value={variable.max} onChange={(e) => set('max', Number(e.target.value))} />
          </FormControl>
          <FormControl maxW="90px">
            <Tooltip label="Values land on this grid, so students get 4.5 not 4.5137">
              <FormLabel fontSize="xs" mb={1}>
                Step
              </FormLabel>
            </Tooltip>
            <Input size="sm" type="number" value={variable.step} onChange={(e) => set('step', Number(e.target.value))} />
          </FormControl>
          {variable.type === 'range' && (
            <FormControl maxW="90px">
              <FormLabel fontSize="xs" mb={1}>
                Decimals
              </FormLabel>
              <Input
                size="sm"
                type="number"
                value={variable.decimals}
                onChange={(e) => set('decimals', Number(e.target.value))}
              />
            </FormControl>
          )}
        </>
      )}

      <FormControl maxW="90px">
        <FormLabel fontSize="xs" mb={1}>
          Unit
        </FormLabel>
        <Input size="sm" value={variable.unit} placeholder="Ω" onChange={(e) => set('unit', e.target.value)} />
      </FormControl>
      <Button size="sm" variant="ghost" colorScheme="red" onClick={onRemove}>
        ✕
      </Button>
    </Flex>
  );
}

/**
 * "Power = I^{2} \cdot R \mathrm{W}" — the formula the server rendered, with
 * the answer's own label and unit around it, so the teacher proofreads the
 * whole equation rather than a bare right-hand side.
 */
function equationLatex(answer, formulaLatex) {
  const label = String(answer.label || '').trim();
  const unit = String(answer.unit || '').trim();
  const lhs = label ? `\\text{${latexEscape(label)}} = ` : '';
  const rhs = unit ? `${formulaLatex}\\ \\text{${latexEscape(unit)}}` : formulaLatex;
  return `${lhs}${rhs}`;
}

/** Labels and units are free text; keep a stray brace or backslash out of KaTeX. */
const latexEscape = (text) => text.replace(/[\\{}$&#~%]/g, ' ');

function AnswerRow({ classId, answer, variableNames, onChange, onRemove }) {
  const set = (field, value) => onChange({ ...answer, [field]: value });
  const check = useFormulaCheck(classId, answer.formula, variableNames);

  return (
    <Box borderWidth="1px" borderColor="lmBorder.base" borderRadius="md" p={3} mb={2}>
      <Flex gap={2} align="flex-end" wrap="wrap">
        <FormControl maxW="150px">
          <FormLabel fontSize="xs" mb={1}>
            Label
          </FormLabel>
          <Input size="sm" value={answer.label} placeholder="Power" onChange={(e) => set('label', e.target.value)} />
        </FormControl>
        <FormControl flex="1" minW="220px">
          <FormLabel fontSize="xs" mb={1}>
            Answer formula
          </FormLabel>
          <Input
            size="sm"
            fontFamily="mono"
            value={answer.formula}
            placeholder="I^2*R"
            isInvalid={Boolean(check.error)}
            onChange={(e) => set('formula', e.target.value)}
          />
        </FormControl>
        <FormControl maxW="80px">
          <FormLabel fontSize="xs" mb={1}>
            Unit
          </FormLabel>
          <Input size="sm" value={answer.unit} placeholder="W" onChange={(e) => set('unit', e.target.value)} />
        </FormControl>
        <FormControl maxW="100px">
          <Tooltip label="How many decimal places the student should give. Shown on their paper, and the answer key is stated to the same precision. Leave blank for the exact, unrounded value.">
            <FormLabel fontSize="xs" mb={1}>
              Decimals
            </FormLabel>
          </Tooltip>
          <Select
            size="sm"
            value={answer.decimals ?? ''}
            onChange={(e) => set('decimals', e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">Exact</option>
            {[0, 1, 2, 3, 4, 5, 6].map((places) => (
              <option key={places} value={places}>
                {places} dp
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl maxW="90px">
          <Tooltip label="An answer within this percentage of the exact value is marked correct">
            <FormLabel fontSize="xs" mb={1}>
              Tol %
            </FormLabel>
          </Tooltip>
          <Input
            size="sm"
            type="number"
            value={answer.tolerancePercent}
            onChange={(e) => set('tolerancePercent', Number(e.target.value))}
          />
        </FormControl>
        <FormControl maxW="90px">
          <Tooltip label="Absolute allowance — needed when the answer is close to zero">
            <FormLabel fontSize="xs" mb={1}>
              Tol ±
            </FormLabel>
          </Tooltip>
          <Input
            size="sm"
            type="number"
            value={answer.toleranceAbs}
            onChange={(e) => set('toleranceAbs', Number(e.target.value))}
          />
        </FormControl>
        <FormControl maxW="80px">
          <FormLabel fontSize="xs" mb={1}>
            Marks
          </FormLabel>
          <Input size="sm" type="number" value={answer.marks} onChange={(e) => set('marks', Number(e.target.value))} />
        </FormControl>
        <Button size="sm" variant="ghost" colorScheme="red" onClick={onRemove}>
          ✕
        </Button>
      </Flex>
      {check.error && (
        <Text fontSize="xs" color="red.600" mt={2}>
          {check.error}
        </Text>
      )}
      {/* The formula as it will actually be read. Typed text is easy to mistype
          and hard to proofread; a fraction or a root is obvious at a glance.
          Given the full width of the card rather than sharing a line with the
          label, so an ordinary equation never needs a scrollbar. */}
      {check.latex && (
        <Box mt={3} px={3} py={2} bg="lmHue.blue50" borderRadius="md">
          <Text fontSize="xs" color="lmFg.muted" mb={1}>
            Reads as:
          </Text>
          <Equation latex={equationLatex(answer, check.latex)} fontSize="xl" w="100%" />
        </Box>
      )}
    </Box>
  );
}

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** True when the question's text actually places this table somewhere. */
function usesTable(question, key) {
  const pattern = tableTokenPattern(key);
  return [
    question.prompt,
    question.hint,
    question.solutionSteps,
    ...(question.parts || []).map((part) => part?.prompt),
  ].some((text) => {
    pattern.lastIndex = 0;
    return pattern.test(String(text || ''));
  });
}

/** Matches one table's token, for pulling it back out of the text. */
const tableTokenPattern = (key) => new RegExp(`\\{\\{\\s*table:${key}\\s*\\}\\}`, 'g');

/** The distinct {{name}} placeholders across a set of authored fields. */
function placeholderNames(texts) {
  const found = new Set();
  texts.forEach((text) => {
    String(text || '').replace(PLACEHOLDER, (match, name) => {
      found.add(name);
      return match;
    });
  });
  return [...found];
}

/**
 * Adds the named variables to the list, reusing a row the teacher has already
 * opened but not named yet — otherwise clicking "+ Add variable" and then
 * typing the placeholder would leave a blank row behind.
 */
function withDeclared(existing, names) {
  const rows = [...(existing || [])];
  names.forEach((name) => {
    if (rows.some((row) => row.name === name)) return;
    const blank = rows.findIndex((row) => !String(row.name || '').trim());
    if (blank >= 0) rows[blank] = { ...rows[blank], name };
    else rows.push({ ...BLANK_VARIABLE, name });
  });
  return rows;
}

/**
 * One constraint cell. Each is parsed and reported on its own, which is the
 * point of splitting them: with "b != c && R > 0" as a single string, one typo
 * invalidates the lot and the message cannot say which half is wrong.
 */
function ConstraintRow({ classId, constraint, variableNames, index, onChange, onRemove }) {
  const check = useFormulaCheck(classId, constraint, variableNames);

  return (
    <Box mb={2}>
      <Flex gap={2} align="center">
        <Text fontSize="xs" color="lmFg.muted" minW="18px">
          {index + 1}.
        </Text>
        <Input
          size="sm"
          fontFamily="mono"
          value={constraint}
          placeholder="R > 0"
          isInvalid={Boolean(check.error)}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button size="sm" variant="ghost" colorScheme="red" onClick={onRemove}>
          ✕
        </Button>
      </Flex>
      {check.error && (
        <Text fontSize="xs" color="red.600" mt={1} ml="26px">
          {check.error}
        </Text>
      )}
      {check.latex && !check.error && (
        <Box ml="26px" mt={1} mr={10}>
          <Equation latex={check.latex} fontSize="sm" w="100%" />
        </Box>
      )}
    </Box>
  );
}

/**
 * Sample rolls for one question, shown under that question.
 *
 * The whole-tutorial preview at the bottom of the page answers "is this paper
 * sane"; this answers "is *this* question right", which is the question a
 * teacher actually has while editing one. It reads the same endpoint and picks
 * out this question's slice, so there is no second generation path that could
 * disagree with what students are handed.
 *
 * Sub-questions are shown nested under the stem, each with its own answers,
 * because a part's answer means nothing without the part that asked for it.
 */
function QuestionPreview({ classId, tutorialId, index, dirty, variables }) {
  const [samples, setSamples] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fixed, setFixed] = useState({});
  const [fixedResult, setFixedResult] = useState(null);
  const [fixedBusy, setFixedBusy] = useState(false);
  const toast = useToast();

  const named = (variables || []).filter((variable) => String(variable.name || '').trim());

  const runFixed = async () => {
    setFixedBusy(true);
    try {
      setFixedResult(await lmApi.evaluateTutorialQuestion(classId, tutorialId, index, fixed));
    } catch (error) {
      toast({ status: 'error', title: error.message });
    } finally {
      setFixedBusy(false);
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      const result = await lmApi.previewTutorial(classId, tutorialId, 2);
      setSamples((result.samples || []).map((sample) => ({
        label: sample.label,
        question: sample.questions?.[index] || null,
      })));
    } catch (error) {
      toast({ status: 'error', title: error.message });
    } finally {
      setBusy(false);
    }
  };

  // A roll describes the saved question, so an edited one must not keep
  // showing numbers from before the edit.
  useEffect(() => {
    if (dirty) {
      setSamples(null);
      setFixedResult(null);
    }
  }, [dirty]);

  // textTransform, because a Badge uppercases its content by default. That is
  // right for the status words it is meant for and wrong for a value: it prints
  // a complex answer's imaginary unit as "I", and a "mA" unit as "MA".
  const answerBadges = (expected, partIndex) =>
    (expected || [])
      .filter((slot) => (slot.partIndex ?? null) === partIndex)
      .map((slot) => (
        <Badge key={slot.key} colorScheme={slot.error ? 'red' : 'green'} textTransform="none">
          {slot.label}:{' '}
          {slot.error ? 'failed' : `${formatAnswerValue(slot.value, slot.decimals, slot.valueIm)} ${slot.unit || ''}`}
        </Badge>
      ));

  return (
    <Box mt={4} pt={3} borderTopWidth="1px" borderColor="lmBorder.base">
      <Flex justify="space-between" align="center" gap={3} wrap="wrap" mb={2}>
        <Box>
          <Heading size="xs" color="lmFg.body">
            Preview this question
          </Heading>
          <Text fontSize="xs" color="lmFg.muted">
            {dirty
              ? 'Save the question first — the roll runs against the saved version.'
              : 'The actual numbers two students would be given.'}
          </Text>
        </Box>
        <Button size="sm" variant="outline" colorScheme="teal" onClick={run} isLoading={busy} isDisabled={dirty}>
          Roll samples
        </Button>
      </Flex>

      {samples?.map(({ label, question: sample }) => (
        <Box key={label} borderWidth="1px" borderColor="lmBorder.base" borderRadius="md" p={3} mb={2}>
          <Badge mb={2}>{label}</Badge>
          {!sample ? (
            <Text fontSize="sm" color="lmFg.muted">
              This question is not in the saved tutorial yet.
            </Text>
          ) : (
            <>
              <RichText fontSize="sm">{sample.prompt}</RichText>
              <HStack fontSize="xs" color="lmFg.muted" mt={1} wrap="wrap">
                {Object.entries(sample.values || {}).map(([name, value]) => (
                  <Code key={name} fontSize="xs">
                    {name} = {String(value)}
                  </Code>
                ))}
              </HStack>
                            <HStack fontSize="xs" mt={2} wrap="wrap">
                {answerBadges(sample.expected, null)}
              </HStack>

              {sample.solution && (
                <Box mt={2} p={2} bg="lmHue.green50" borderRadius="md">
                  <Text fontSize="xs" fontWeight="700" color="lmHue.green800" mb={1}>
                    Worked solution
                  </Text>
                  <RichText fontSize="sm">{sample.solution}</RichText>
                </Box>
              )}

              {(sample.parts || []).map((part, partIndex) => (
                <Box key={partIndex} mt={3} pl={3} borderLeftWidth="2px" borderColor="lmHue.purple200">
                  {part.label && (
                    <Text fontSize="sm" fontWeight="700" color="lmHue.purple700">
                      {part.label}
                    </Text>
                  )}
                  <RichText fontSize="sm">{part.prompt}</RichText>
                  <HStack fontSize="xs" mt={1} wrap="wrap">
                    {answerBadges(sample.expected, partIndex)}
                  </HStack>
                </Box>
              ))}
            </>
          )}
        </Box>
      ))}

      {/* Check against a result you already know. Rolling until R happens to
          come up as 7 is not a way to verify a formula. */}
      {named.length > 0 && (
        <Box mt={3} p={3} borderWidth="1px" borderColor="lmBorder.base" borderRadius="md" bg="lmHue.teal50">
          <Text fontSize="xs" fontWeight="600" color="lmFg.body" mb={2}>
            Or work it out for values you choose
          </Text>
          <Flex gap={2} align="flex-end" wrap="wrap">
            {named.map((variable) => (
              <FormControl key={variable.name} maxW="110px">
                <FormLabel fontSize="xs" mb={1}>
                  {variable.name}
                  {variable.unit ? ` (${variable.unit})` : ''}
                </FormLabel>
                <Input
                  size="sm"
                  bg="lmBg.card"
                  value={fixed[variable.name] ?? ''}
                  onChange={(event) => setFixed({ ...fixed, [variable.name]: event.target.value })}
                />
              </FormControl>
            ))}
            <Button size="sm" colorScheme="teal" onClick={runFixed} isLoading={fixedBusy} isDisabled={dirty}>
              Work it out
            </Button>
          </Flex>

          {fixedResult && (
            <Box mt={3} borderWidth="1px" borderColor="lmBorder.base" borderRadius="md" p={3} bg="lmBg.card">
              <RichText fontSize="sm">{fixedResult.prompt}</RichText>
                            <HStack fontSize="xs" mt={2} wrap="wrap">
                {answerBadges(fixedResult.expected, null)}
              </HStack>

              {fixedResult.solution && (
                <Box mt={2} p={2} bg="lmHue.green50" borderRadius="md">
                  <Text fontSize="xs" fontWeight="700" color="lmHue.green800" mb={1}>
                    Worked solution
                  </Text>
                  <RichText fontSize="sm">{fixedResult.solution}</RichText>
                </Box>
              )}

              {(fixedResult.parts || []).map((part, partIndex) => (
                <Box key={partIndex} mt={3} pl={3} borderLeftWidth="2px" borderColor="lmHue.purple200">
                  {part.label && (
                    <Text fontSize="sm" fontWeight="700" color="lmHue.purple700">
                      {part.label}
                    </Text>
                  )}
                  <RichText fontSize="sm">{part.prompt}</RichText>
                  <HStack fontSize="xs" mt={1} wrap="wrap">
                    {answerBadges(fixedResult.expected, partIndex)}
                  </HStack>
                </Box>
              ))}
              {!fixedResult.constraintsSatisfied && (
                <Text fontSize="xs" color="orange.600" mt={2}>
                  These values break a constraint, so no student would be given them — the answers
                  above are still worked out from them.
                </Text>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

function QuestionCard({ classId, tutorialId, question, index, onChange, onRemove, onSave, saving, dirty }) {
  /**
   * Every edit is applied as a function of the *current* question, never of the
   * one captured when this render ran.
   *
   * That is load-bearing, not tidiness. Inserting a table token makes Quill emit
   * its own onChange in the same tick; with plain object spreads the second
   * update rebuilt the question from a closure that predated the first and
   * silently dropped the table that had just been added.
   */
  const set = (field, value) => onChange((current) => ({ ...current, [field]: value }));
  // MCQ, MSQ and plain numerical questions carry a fixed key and draw nothing.
  const fixed = isFixedType(question);
  const variableNames = useMemo(
    () => (question.variables || []).map((variable) => variable.name).filter(Boolean),
    [question.variables],
  );
  // The list, with the single legacy `constraint` field folded in as its first
  // entry — that is how a tutorial saved before multi-constraint support opens
  // with its guard intact and editable.
  const constraints = useMemo(() => {
    const legacy = String(question.constraint || '').trim();
    return [...(legacy ? [legacy] : []), ...(question.constraints || [])];
  }, [question.constraint, question.constraints]);

  const setConstraints = (next) =>
    onChange((current) => ({ ...current, constraint: '', constraints: next }));

  // Every {{name}} the teacher has typed anywhere in the question. The stem is
  // not the only surface that can introduce one — a sub-question prompt, a hint
  // or a worked solution can too, and a variable declared from any of them is
  // the same variable.
  const placeholders = useMemo(
    () =>
      placeholderNames([
        question.prompt,
        question.hint,
        question.solutionSteps,
        ...(question.parts || []).map((part) => part.prompt),
      ]),
    [question.prompt, question.hint, question.solutionSteps, question.parts],
  );
  const undeclared = placeholders.filter((name) => !variableNames.includes(name));

  const declare = (names) =>
    set('variables', withDeclared(question.variables, names));

  // The prompt editor, so the table builder can drop its token where the
  // cursor actually is rather than at the end.
  const promptRef = useRef(null);
  // null when closed; { key } when editing an existing table, {} when new.
  const [tableEdit, setTableEdit] = useState(null);
  const tables = question.tables || [];

  // Bumped whenever a table changes. The save runs from an effect rather than
  // inline so it happens *after* the edit is committed — saving in the same
  // tick would write the question as it was a moment ago, which is the whole
  // class of bug this file just had.
  const [autoSave, setAutoSave] = useState(0);
  useEffect(() => {
    if (autoSave) onSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave]);

  const saveTable = (built) => {
    if (tableEdit?.key) {
      onChange((current) => ({
        ...current,
        tables: (current.tables || []).map((table) =>
          table.key === tableEdit.key ? { ...table, ...built } : table,
        ),
      }));
      setAutoSave((n) => n + 1);
      return;
    }

    // A key rather than a position: the text's token points at this table, and
    // must keep pointing at it when another one is deleted.
    const key = `t${Math.random().toString(36).slice(2, 8)}`;
    // The insert hands back the prompt HTML it produced, so the token and the
    // table land in one update rather than racing Quill's own onChange.
    const prompt = promptRef.current?.insertAtCursor(`{{table:${key}}}`);
    onChange((current) => ({
      ...current,
      tables: [...(current.tables || []), { key, ...built }],
      ...(typeof prompt === 'string' ? { prompt } : {}),
    }));
    setAutoSave((n) => n + 1);
  };

  const removeTable = (key) => {
    // The token goes with it, otherwise saving fails on a dangling reference.
    const strip = (text) => String(text || '').replace(tableTokenPattern(key), '');
    onChange((current) => ({
      ...current,
      tables: (current.tables || []).filter((table) => table.key !== key),
      prompt: strip(current.prompt),
      hint: strip(current.hint),
      solutionSteps: strip(current.solutionSteps),
      parts: (current.parts || []).map((part) => ({ ...part, prompt: strip(part.prompt) })),
    }));
    setAutoSave((n) => n + 1);
  };

  // Typing declares. A newly typed {{R}} becomes a variable row on its own, so
  // the answer formulas and the placeholder bar can see it immediately instead
  // of the teacher having to add the same name a second time by hand.
  //
  // `handled` remembers every name already acted on, which does two things:
  // deleting a variable row whose placeholder is still in the text keeps it
  // deleted rather than resurrecting it on the next keystroke, and seeding it
  // from what the question already contains means merely *opening* an old
  // question never edits it. Those pre-existing gaps get the button below.
  const handled = useRef(null);
  if (handled.current === null) handled.current = new Set([...variableNames, ...placeholders]);

  useEffect(() => {
    const fresh = placeholders.filter((name) => !handled.current.has(name));
    if (fixed || !fresh.length) return;
    fresh.forEach((name) => handled.current.add(name));
    declare(fresh);
    // `declare` closes over this render's question, which is the one the new
    // placeholder was just typed into — re-running on it would only loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeholders]);

  return (
    <SectionCard mb={4}>
      <Flex justify="space-between" align="center" mb={3} gap={2} wrap="wrap">
        <HStack spacing={2}>
          <Heading size="sm">Question {index + 1}</Heading>
          {/* Coloured by type, so the make-up of a paper reads at a glance. */}
          <QuestionTypeBadge question={question} fontSize="sm" px={2} />
        </HStack>
        <HStack spacing={2} wrap="wrap">
          <Text fontSize="xs" fontWeight="600" color="lmFg.muted">
            Type
          </Text>
          {/* Changing type resets the answer section, as the quiz editor does.
              A fixed width, not "auto": a select sized by percentage may be
              shrunk to nothing when the header is tight, which left only its
              arrow showing and the chosen type invisible. On Chakra's Select
              the width props land on the wrapper, which is what keeps it open. */}
          <Select
            size="sm"
            w="250px"
            minW="250px"
            aria-label="Question type"
            value={question.type || 'parametric'}
            onChange={(e) => onChange((current) => withType(current, e.target.value, parametricSeed()))}
          >
            {QUESTION_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select size="sm" w="110px" value={question.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
          <Button size="sm" variant="ghost" colorScheme="red" onClick={onRemove}>
            Delete
          </Button>
        </HStack>
      </Flex>

      <FormControl mb={1}>
        <FormLabel fontSize="sm">
          {fixed ? (
            'Question'
          ) : (
            <>
              Prompt — type <Code fontSize="xs">{'{{R}}'}</Code> and the variable is declared for you, or
              use the buttons below to drop an existing one at the cursor
            </>
          )}
        </FormLabel>
        <RichTextEditor
          ref={promptRef}
          value={question.prompt}
          onChange={(html) => set('prompt', html)}
          placeholder={
            fixed
              ? 'Question text — formatting, sub/superscripts and images are supported'
              : 'A resistor of {{R}} Ω carries {{I}} A. Find the power dissipated.'
          }
          variables={fixed ? [] : variableNames}
          minH="110px"
        />
      </FormControl>
      {/* A fixed-key question is authored the way a quiz question is: options
          with the right ones ticked, or one number with a tolerance. Nothing is
          drawn, so none of the variable machinery below applies to it. */}
      {fixed ? (
        <Box mt={4}>
          <FixedQuestionFields question={question} onChange={onChange} />
        </Box>
      ) : (
        <>
      {undeclared.length > 0 && (
        <HStack fontSize="xs" color="red.600" mb={3} spacing={2} wrap="wrap">
          <Text>
            {undeclared.map((name) => `{{${name}}}`).join(', ')}{' '}
            {undeclared.length === 1 ? 'is' : 'are'} used here but not declared below, so{' '}
            {undeclared.length === 1 ? 'it stays' : 'they stay'} literal on the student&apos;s paper.
          </Text>
          <Button size="xs" colorScheme="red" variant="outline" onClick={() => declare(undeclared)}>
            {undeclared.length === 1 ? 'Declare it' : 'Declare them'}
          </Button>
        </HStack>
      )}

      {/* Tables live on the question and are referenced from the text by a
          token, so they survive editing the prompt around them. */}
      <Flex align="center" gap={2} mt={2} wrap="wrap">
        <Button size="xs" variant="outline" onClick={() => setTableEdit({})}>
          ⊞ Insert table
        </Button>
        <Text fontSize="xs" color="lmFg.muted">
          Dropped in at the cursor, and its cells can use the variables too.
        </Text>
      </Flex>

      {/* Shown as the table it is, not as a line of metadata. The prompt above
          can only ever carry the token, so this is the teacher's one view of
          what the students will actually be given. */}
      {tables.map((table, tableIndex) => (
        <Box
          key={table.key}
          mt={2}
          borderWidth="1px"
          borderColor="lmBorder.base"
          borderRadius="md"
          p={3}
          bg="lmBg.sunken"
        >
          <Flex align="center" gap={2} wrap="wrap" mb={2}>
            <Text fontSize="sm" fontWeight="700">
              {table.caption?.trim() || `Table ${tableIndex + 1}`}
            </Text>
            <Code fontSize="xs">{`{{table:${table.key}}}`}</Code>
            {!usesTable(question, table.key) && (
              <Badge colorScheme="orange">not placed — delete it, or insert a new one</Badge>
            )}
            <Box flex="1" />
            <Button size="xs" variant="outline" onClick={() => setTableEdit({ key: table.key })}>
              Edit table
            </Button>
            <Button size="xs" variant="ghost" colorScheme="red" onClick={() => removeTable(table.key)}>
              Delete
            </Button>
          </Flex>

          <Box bg="lmBg.card" borderRadius="md">
            <Table
              size="sm"
              // Ruled on every side and column-width shared, so the preview here
              // matches what the student's paper will look like rather than
              // Chakra's default underline-only styling.
              sx={{
                tableLayout: 'fixed',
                width: '100%',
                borderCollapse: 'collapse',
                'th, td': {
                  borderWidth: '1px',
                  borderColor: 'lmBorder.base',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  verticalAlign: 'top',
                },
                th: { bg: 'lmBg.sunken' },
              }}
            >
              {(table.header || []).some(Boolean) && (
                <Thead>
                  <Tr>
                    {table.header.map((cell, cellIndex) => (
                      <Th key={cellIndex}>{cell}</Th>
                    ))}
                  </Tr>
                </Thead>
              )}
              <Tbody>
                {(table.rows || []).map((row, rowIndex) => (
                  <Tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <Td key={cellIndex} fontSize="xs">
                        {/* Placeholders are left as written — this is the
                            question, not one student's copy of it. */}
                        {cell}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      ))}

      <TableBuilderModal
        isOpen={Boolean(tableEdit)}
        onClose={() => setTableEdit(null)}
        onSave={saveTable}
        variables={variableNames}
        initial={tableEdit?.key ? tables.find((table) => table.key === tableEdit.key) : null}
      />

      <Divider my={4} />
      <Heading size="xs" mb={2} color="lmFg.body">
        Variables
      </Heading>
      {(question.variables || []).map((variable, variableIndex) => (
        <VariableRow
          key={variableIndex}
          variable={variable}
          onChange={(updated) =>
            set(
              'variables',
              question.variables.map((v, i) => (i === variableIndex ? updated : v)),
            )
          }
          onRemove={() =>
            set(
              'variables',
              question.variables.filter((_, i) => i !== variableIndex),
            )
          }
        />
      ))}
      <Button size="xs" variant="link" onClick={() => set('variables', [...(question.variables || []), { ...BLANK_VARIABLE }])}>
        + Add variable
      </Button>

      <Divider my={4} />
      <Heading size="xs" mb={2} color="lmFg.body">
        Answers
      </Heading>
      <Text fontSize="xs" color="lmFg.muted" mb={2}>
        Each answer is a formula over the variables above. It is evaluated per student and compared
        with what they type.
      </Text>
      {(question.answers || []).map((answer, answerIndex) => (
        <AnswerRow
          key={answerIndex}
          classId={classId}
          answer={answer}
          variableNames={variableNames}
          onChange={(updated) =>
            set(
              'answers',
              question.answers.map((a, i) => (i === answerIndex ? updated : a)),
            )
          }
          onRemove={() =>
            set(
              'answers',
              question.answers.filter((_, i) => i !== answerIndex),
            )
          }
        />
      ))}
      <Button size="xs" variant="link" onClick={() => set('answers', [...(question.answers || []), { ...BLANK_ANSWER }])}>
        + Add answer
      </Button>

      <Divider my={4} />
      <Heading size="xs" mb={2} color="lmFg.body">
        Sub-questions
      </Heading>
      <Text fontSize="xs" color="lmFg.muted" mb={3}>
        Parts (a), (b), (c) … for a question with several steps. They share the variables above, so
        part (b) refers to the same numbers part (a) did. Each part has its own prompt and its own
        answers, and each answer is marked separately on submit. Leave this empty for a
        single-answer question.
      </Text>
      {(question.parts || []).map((part, partIndex) => (
        <Box key={partIndex} borderWidth="1px" borderRadius="md" p={3} mb={3} bg="lmHue.purple50">
          <Flex justify="space-between" align="center" gap={2} mb={2}>
            <HStack spacing={2}>
              <Text fontSize="sm" fontWeight="700" color="lmHue.purple700">
                {part.label?.trim() || 'Sub-question'}
              </Text>
              <Input
                size="xs"
                maxW="130px"
                placeholder="Label (optional)"
                value={part.label || ''}
                onChange={(event) =>
                  set(
                    'parts',
                    question.parts.map((p, i) => (i === partIndex ? { ...p, label: event.target.value } : p)),
                  )
                }
              />
            </HStack>
            <Button
              size="xs"
              variant="ghost"
              colorScheme="red"
              onClick={() =>
                set('parts', question.parts.filter((_, i) => i !== partIndex))
              }
            >
              Remove part
            </Button>
          </Flex>

          <FormControl mb={2}>
            <FormLabel fontSize="xs">Prompt for this part</FormLabel>
            <RichTextEditor
                  value={part.prompt || ''}
              onChange={(value) =>
                set(
                  'parts',
                  question.parts.map((p, i) => (i === partIndex ? { ...p, prompt: value } : p)),
                )
              }
              placeholder="Find the power dissipated in the {{R}} Ω resistor."
            />
            <FormHelperText fontSize="xs">
              Use {'{{name}}'} to insert a variable, the same as the main prompt.
            </FormHelperText>
          </FormControl>

          {(part.answers || []).map((answer, answerIndex) => (
            <AnswerRow
              key={answerIndex}
              classId={classId}
              answer={answer}
              variableNames={variableNames}
              onChange={(updated) =>
                set(
                  'parts',
                  question.parts.map((p, i) =>
                    i === partIndex
                      ? { ...p, answers: p.answers.map((a, j) => (j === answerIndex ? updated : a)) }
                      : p,
                  ),
                )
              }
              onRemove={() =>
                set(
                  'parts',
                  question.parts.map((p, i) =>
                    i === partIndex
                      ? { ...p, answers: p.answers.filter((_, j) => j !== answerIndex) }
                      : p,
                  ),
                )
              }
            />
          ))}
          <Button
            size="xs"
            variant="link"
            onClick={() =>
              set(
                'parts',
                question.parts.map((p, i) =>
                  i === partIndex ? { ...p, answers: [...(p.answers || []), { ...BLANK_ANSWER }] } : p,
                ),
              )
            }
          >
            + Add answer to this part
          </Button>
        </Box>
      ))}
      <Button
        size="xs"
        variant="link"
        colorScheme="purple"
        onClick={() =>
          set('parts', [
            ...(question.parts || []),
            { label: '', prompt: '', answers: [{ ...BLANK_ANSWER, label: 'Answer', formula: 'x' }] },
          ])
        }
      >
        + Add sub-question
      </Button>
        </>
      )}

      <Divider my={4} />
      <SimpleGrid columns={{ base: 1, md: fixed ? 1 : 2 }} spacing={4}>
        {!fixed && (
        <FormControl>
          <Tooltip label="Every constraint must be true, or the values are drawn again — this is what keeps a student's numbers away from a divide-by-zero or the root of a negative">
            <FormLabel fontSize="sm">Constraints (optional)</FormLabel>
          </Tooltip>
          {constraints.length === 0 && (
            <Text fontSize="xs" color="lmFg.muted" mb={2}>
              None — any drawn values are accepted.
            </Text>
          )}
          {constraints.map((constraint, constraintIndex) => (
            <ConstraintRow
              key={constraintIndex}
              classId={classId}
              constraint={constraint}
              variableNames={variableNames}
              index={constraintIndex}
              onChange={(value) =>
                setConstraints(constraints.map((c, i) => (i === constraintIndex ? value : c)))
              }
              onRemove={() => setConstraints(constraints.filter((_, i) => i !== constraintIndex))}
            />
          ))}
          <Button size="xs" variant="link" onClick={() => setConstraints([...constraints, ''])}>
            + Add constraint
          </Button>
          <FormHelperText fontSize="xs">
            One condition per cell — they must all hold together, so
            <Code fontSize="xs" mx={1}>
              R &gt; 0
            </Code>
            and
            <Code fontSize="xs" mx={1}>
              b != c
            </Code>
            go in separate cells rather than joined with &amp;&amp;.
          </FormHelperText>
        </FormControl>
        )}
        <FormControl>
          <FormLabel fontSize="sm">Hint (optional)</FormLabel>
          <RichTextEditor
            compact
            minH="56px"
            value={question.hint}
            onChange={(html) => set('hint', html)}
            placeholder="Ohm's law relates V, I and R"
          />
        </FormControl>
      </SimpleGrid>

      <FormControl mt={4}>
        <FormLabel fontSize="sm">{fixed ? 'Explanation' : 'Worked solution'} — shown after submitting</FormLabel>
        <RichTextEditor
          value={question.solutionSteps}
          onChange={(html) => set('solutionSteps', html)}
          placeholder={fixed ? 'Why the answer is what it is' : 'P = I²R = {{I}}² × {{R}}'}
          variables={fixed ? [] : variableNames}
          minH="110px"
        />
      </FormControl>

      {/* Saving from inside the question, rather than scrolling to the bottom of
          a long tutorial — and it is what unlocks the preview, which can only
          roll samples against the saved version. */}
      <Flex justify="flex-end" align="center" gap={3} mt={4} pt={3} borderTopWidth="1px" borderColor="lmBorder.base">
        <Text fontSize="xs" color="lmFg.muted">
          {dirty ? 'Unsaved changes' : 'Saved — the preview can roll samples'}
        </Text>
        <Button size="sm" colorScheme="blue" onClick={onSave} isLoading={saving} isDisabled={!dirty}>
          Save
        </Button>
      </Flex>

      {/* Rolling samples only means something where values are drawn. */}
      {!fixed && (
        <QuestionPreview
          classId={classId}
          tutorialId={tutorialId}
          index={index}
          dirty={dirty}
          variables={question.variables}
        />
      )}
    </SectionCard>
  );
}

export default function TutorialEditor() {
  const { classId, klass } = useOutletContext();
  const { tutorialId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [tutorial, setTutorial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reference, setReference] = useState(null);
  const [importing, setImporting] = useState(false);
  // Which question tab is open. Clamped at render, so deleting the last
  // question or reloading a shorter tutorial cannot leave it out of range.
  const [openQuestion, setOpenQuestion] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, ref] = await Promise.all([
        lmApi.getTutorial(classId, tutorialId),
        lmApi.formulaReference(classId).catch(() => null),
      ]);
      setTutorial(data);
      setReference(ref);
      setDirty(false);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, tutorialId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (changes) => {
    setTutorial((prev) => ({ ...prev, ...changes }));
    setDirty(true);
  };

  /** Question edits, applied to whatever the questions array is right now. */
  const updateQuestions = (updater) => {
    setTutorial((prev) => ({ ...prev, questions: updater(prev.questions || []) }));
    setDirty(true);
  };

  // `save` can be called from a child effect, after a state update it must
  // include. Reading the ref rather than the render-time `tutorial` is what
  // makes that safe.
  const tutorialRef = useRef(tutorial);
  tutorialRef.current = tutorial;

  /**
   * Pushes a corrected question through to every paper already issued.
   *
   * Saves first: re-evaluation runs server-side against the stored tutorial, so
   * running it on unsaved edits would re-work the papers against the very
   * formula being fixed.
   */
  const [reevaluating, setReevaluating] = useState(false);
  const reevaluate = async () => {
    if (
      // eslint-disable-next-line no-alert
      !window.confirm(
        'Re-work every paper already issued against the current questions?\n\n' +
          'Each student keeps their own numbers. Answers are recalculated from the formulas as they now stand, ' +
          'and papers already submitted are marked again — scores can go up or down.',
      )
    ) {
      return;
    }
    if (!(await save())) return;

    setReevaluating(true);
    try {
      const result = await lmApi.reevaluateTutorial(classId, tutorialId);
      toast({
        status: result.warnings?.length ? 'warning' : 'success',
        title: `${result.updated} paper${result.updated === 1 ? '' : 's'} re-worked`,
        description:
          [
            result.remarked ? `${result.remarked} re-marked` : null,
            result.scoreChanged ? `${result.scoreChanged} score${result.scoreChanged === 1 ? '' : 's'} changed` : null,
            result.orphanQuestions
              ? `${result.orphanQuestions} answered question${result.orphanQuestions === 1 ? '' : 's'} no longer on the tutorial, left as they were`
              : null,
            ...(result.warnings || []),
          ]
            .filter(Boolean)
            .join(' · ') || 'Nothing needed changing.',
        duration: 10000,
        isClosable: true,
      });
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 10000 });
    } finally {
      setReevaluating(false);
    }
  };

  const addQuestion = (type) => {
    update({ questions: [...tutorial.questions, blankQuestion(type)] });
    // Straight onto the new tab. Adding a question and being left looking at
    // the old one is the thing the tab strip is meant to fix.
    setOpenQuestion(tutorial.questions.length);
  };

  const save = async () => {
    const current = tutorialRef.current;
    if (!current) return false;
    setSaving(true);
    try {
      await lmApi.updateTutorial(classId, tutorialId, {
        title: current.title,
        description: current.description,
        topicId: current.topicId,
        questions: current.questions,
        settings: current.settings,
      });
      toast({ status: 'success', title: 'Tutorial saved' });
      await load();
      return true;
    } catch (err) {
      toast({
        status: 'error',
        title: err.message,
        description: err.payload?.errors?.slice(1, 4).join(' · '),
        duration: 10000,
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!(await save())) return;
    try {
      await lmApi.publishTutorial(classId, tutorialId, { publish: true });
      toast({ status: 'success', title: 'Published to the class' });
      navigate(`/learning/class/${classId}/tutorials`);
    } catch (err) {
      toast({
        status: 'error',
        title: err.message,
        description: err.payload?.errors?.slice(0, 3).join(' · '),
        duration: 10000,
      });
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!tutorial) return null;

  const setSetting = (key, value) =>
    update({ settings: { ...tutorial.settings, [key]: value } });

  const totalMarks = (tutorial.questions || []).reduce((sum, question) => sum + questionMarks(question), 0);

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
        <Box>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/learning/class/${classId}/tutorials`)}>
            ← Back to tutorials
          </Button>
          <Text fontSize="sm" color="lmFg.muted" mt={1}>
            {tutorial.questions.length} questions · {totalMarks} marks
            {dirty ? ' · unsaved changes' : ''}
          </Text>
        </Box>
        <HStack wrap="wrap" spacing={2} justify="flex-end">
          {/* Save first: the import appends to the stored tutorial and this page
              reloads it afterwards, so unsaved edits would go with the reload. */}
          <Button
            size="sm"
            variant="outline"
            isLoading={saving}
            onClick={async () => {
              if (!(await save())) return;
              setImporting(true);
            }}
          >
            <LmIcon name="import" size={14} style={{ marginRight: 6 }} />
            Import questions
          </Button>
          {/* Sits beside Save because that is the workflow: fix the formula,
              save it, push the fix through to the papers already sat. */}
          <Button
            size="sm"
            variant="outline"
            colorScheme="purple"
            isLoading={reevaluating}
            onClick={reevaluate}
          >
            <LmIcon name="reuse" size={14} style={{ marginRight: 6 }} />
            Re-evaluate
          </Button>
          <Button size="sm" variant="outline" onClick={save} isLoading={saving}>
            Save
          </Button>
          <Button size="sm" colorScheme="green" onClick={publish} isDisabled={!tutorial.questions.length}>
            Save &amp; publish
          </Button>
        </HStack>
      </Flex>

      <SectionCard title="Tutorial details" mb={4}>
        <FormControl mb={3}>
          <FormLabel fontSize="sm">Title</FormLabel>
          <Input value={tutorial.title} onChange={(e) => update({ title: e.target.value })} />
        </FormControl>
        <FormControl mb={4}>
          <FormLabel fontSize="sm">Description</FormLabel>
          <Textarea rows={2} value={tutorial.description} onChange={(e) => update({ description: e.target.value })} />
        </FormControl>

        {/* All three are optional. A tutorial is practice: unlimited goes, no
            bar to clear and no deadline unless the teacher wants one. */}
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <FormControl>
            <FormLabel fontSize="xs">Attempts allowed</FormLabel>
            <Input
              size="sm"
              type="number"
              min={0}
              placeholder="Unlimited"
              value={tutorial.settings.attemptsAllowed || ''}
              onChange={(e) => setSetting('attemptsAllowed', Number(e.target.value) || 0)}
            />
            <FormHelperText fontSize="xs">Leave blank for unlimited.</FormHelperText>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Pass mark (%)</FormLabel>
            <Input
              size="sm"
              type="number"
              min={0}
              max={100}
              placeholder="No pass mark"
              value={tutorial.settings.passPercent ?? ''}
              onChange={(e) => setSetting('passPercent', e.target.value === '' ? null : Number(e.target.value))}
            />
            <FormHelperText fontSize="xs">Blank means no pass or fail is shown.</FormHelperText>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Due date</FormLabel>
            <Input
              size="sm"
              type="datetime-local"
              value={toDateTimeInput(tutorial.settings?.dueDate)}
              onChange={(e) => setSetting('dueDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
            <FormHelperText fontSize="xs">Blank means no deadline.</FormHelperText>
          </FormControl>
        </SimpleGrid>

        <HStack mt={4} spacing={5} wrap="wrap">
          <Checkbox
            size="sm"
            isChecked={tutorial.settings.newValuesOnRetry}
            onChange={(e) => setSetting('newValuesOnRetry', e.target.checked)}
          >
            Fresh numbers on each retry
          </Checkbox>
          <Checkbox
            size="sm"
            isChecked={tutorial.settings.showSolutionAfterSubmit}
            onChange={(e) => setSetting('showSolutionAfterSubmit', e.target.checked)}
          >
            Show the worked solution after submitting
          </Checkbox>
          <Checkbox
            size="sm"
            isChecked={tutorial.settings.showHints}
            onChange={(e) => setSetting('showHints', e.target.checked)}
          >
            Show hints
          </Checkbox>
        </HStack>

        {/* Off by default, and the warning is the point: with instant feedback a
            numeric answer can be brute-forced by typing values until it goes
            green. Good for practice, wrong for anything carrying marks — so the
            teacher decides per tutorial rather than the platform deciding. */}
        <Divider my={3} />
        <Checkbox
          size="sm"
          isChecked={Boolean(tutorial.settings.instantFeedback)}
          onChange={(e) => setSetting('instantFeedback', e.target.checked)}
        >
          Let students check an answer before submitting
        </Checkbox>
        <Text fontSize="xs" color="lmFg.subtle" mt={1}>
          Puts a Check button beside each answer, which tells the student whether it is right
          before they submit. Useful for practice, but a numeric answer can be guessed at until it
          goes green — leave this off for a tutorial that counts. Each answer allows only a few
          checks, and the number used is recorded either way, so you can see who worked and who
          searched.
        </Text>
        {tutorial.settings.instantFeedback && (
          <FormControl mt={2} maxW="240px">
            <FormLabel fontSize="xs">Checks allowed per answer</FormLabel>
            <Input
              size="sm"
              type="number"
              min={1}
              value={tutorial.settings.checksPerAnswer ?? 3}
              onChange={(e) => setSetting('checksPerAnswer', Number(e.target.value))}
            />
            <FormHelperText fontSize="xs">
              Once spent, the ticks stop but the answer can still be submitted.
            </FormHelperText>
          </FormControl>
        )}

        {/* Teacher-paced live mode: run the tutorial like a Short, opening the
            questions one at a time from the live board. */}
        <Divider my={3} />
        <Checkbox
          size="sm"
          isChecked={Boolean(tutorial.settings.liveMode)}
          onChange={(e) => setSetting('liveMode', e.target.checked)}
        >
          Run this tutorial live (teacher-paced)
        </Checkbox>
        <Text fontSize="xs" color="lmFg.subtle" mt={1}>
          You open the questions one at a time from a live board and watch how each student is doing.
          Everyone answers their own numbers as many times as they like, with a green tick when right,
          and can finish an opened question later. A live tutorial always ticks answers as they go.
        </Text>

        <Divider my={3} />
        <Checkbox
          size="sm"
          isChecked={Boolean(tutorial.settings.allowFileUpload)}
          onChange={(e) => setSetting('allowFileUpload', e.target.checked)}
        >
          Let students upload photos/PDF of their working
        </Checkbox>
        <Text fontSize="xs" color="lmFg.subtle" mt={1}>
          Adds an upload box to the tutorial. On a phone they can take a photo directly. Images and
          PDFs, up to 10 MB each.
        </Text>
      </SectionCard>

      {reference && (
        <SectionCard title="Formula reference" mb={4}>
          <Text fontSize="sm" color="lmFg.subtle" mb={2}>
            Operators <Code fontSize="xs">+ - * / % ^</Code>, comparisons{' '}
            <Code fontSize="xs">== != &lt; &lt;= &gt; &gt;=</Code> and <Code fontSize="xs">&amp;&amp; ||</Code> for
            constraints. Constants: {reference.constants.map((c) => <Code key={c} fontSize="xs" mr={1}>{c}</Code>)}
          </Text>
          {/* Complex answers need their own line: the constants list above
              shows i and j, but not what to do with them, and ∠ is an
              operator so it never appears in the function list either.
              polar() leads and ∠ trails, deliberately — ∠ is on no keyboard,
              so a teacher who copies it into a question sets an answer their
              students have no way to type. */}
          <Text fontSize="sm" color="lmFg.subtle" mb={2}>
            Complex answers: write <Code fontSize="xs">R + i*X</Code> or <Code fontSize="xs">3+4i</Code> (
            <Code fontSize="xs">j</Code> works too), or in polar form{' '}
            <Code fontSize="xs">polar(10, 45)</Code> — magnitude and angle in degrees. Students may answer
            in either form, and their paper tells them so. <Code fontSize="xs">10∠45</Code> parses to the
            same value, but ∠ is on no keyboard — <Code fontSize="xs">polar()</Code> is the form to set.
          </Text>
          <Text fontSize="sm" color="lmFg.subtle" mb={2}>
            A variable cannot be named <Code fontSize="xs">i</Code>, <Code fontSize="xs">j</Code>,{' '}
            <Code fontSize="xs">e</Code> or <Code fontSize="xs">pi</Code>: a variable is resolved before a
            constant, so one of those would quietly replace it in every formula. Capitals are free — use{' '}
            <Code fontSize="xs">I</Code> for a current.
          </Text>
          <Flex wrap="wrap" gap={1}>
            {reference.functions.map((fn) => (
              <Code key={fn} fontSize="xs">
                {fn}()
              </Code>
            ))}
          </Flex>
        </SectionCard>
      )}

      {/* One question at a time, on its own tab. A tutorial with a dozen
          parameterised questions is thousands of pixels of form otherwise, and
          the teacher loses their place every time they add one. Only the open
          tab is mounted, which also means only its formulas are being checked
          against the server on each keystroke. */}
      {tutorial.questions.length > 0 && (
        <Tabs
          index={Math.min(openQuestion, tutorial.questions.length - 1)}
          onChange={setOpenQuestion}
          variant="unstyled"
          isLazy
          mb={5}
        >
          <Flex align="center" gap={2} mb={2}>
            <TabList overflowX="auto" overflowY="hidden" py={1} gap={2} flex="1">
              {tutorial.questions.map((question, index) => (
                <Tab
                  key={question._id || index}
                  whiteSpace="nowrap"
                  fontSize="sm"
                  fontWeight="600"
                  borderRadius="full"
                  px={4}
                  py={1.5}
                  // Explicit on both states: the default enclosed tabs read as
                  // plain text on this page's background, so which question is
                  // open was not actually visible.
                  bg="lmHue.purple50"
                  color="lmHue.purple700"
                  _hover={{ bg: 'lmHue.purple100' }}
                  _selected={{ bg: 'purple.500', color: 'white', boxShadow: 'md' }}
                >
                  Question {index + 1}
                  {/* Out of the tab's accessible name — the card heading already
                      announces the type — but visible across the whole strip. */}
                  <QuestionTypeBadge question={question} short ml={2} aria-hidden="true" />
                </Tab>
              ))}
            </TabList>
            {/* In the tab strip, where a new tab appears — not at the bottom of
                a question the teacher would have to scroll past first. */}
            <AddQuestionMenu
              size="sm"
              colorScheme="purple"
              variant="outline"
              borderRadius="full"
              flexShrink={0}
              onAdd={addQuestion}
            />
          </Flex>
          <TabPanels>
            {tutorial.questions.map((question, index) => (
              <TabPanel key={question._id || index} px={0}>
                <QuestionCard
                  classId={classId}
                  tutorialId={tutorialId}
                  question={question}
                  index={index}
                  // Takes an updater, applied against the newest questions array
                  // rather than the one this render closed over.
                  onChange={(updater) =>
                    updateQuestions((questions) =>
                      questions.map((q, i) => (i === index ? (typeof updater === 'function' ? updater(q) : updater) : q)),
                    )
                  }
                  onRemove={() => {
                    update({ questions: tutorial.questions.filter((_, i) => i !== index) });
                    // Land on the neighbour rather than on whatever slid into
                    // this index, which would look like the wrong one opened.
                    setOpenQuestion(Math.max(0, index - 1));
                  }}
                  onSave={save}
                  saving={saving}
                  dirty={dirty}
                />
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      )}

      {tutorial.questions.length === 0 && (
        <Flex gap={2} mb={5} wrap="wrap">
          <AddQuestionMenu variant="outline" colorScheme="purple" onAdd={addQuestion} />
        </Flex>
      )}

      <ImportQuestionsModal
        isOpen={importing}
        onClose={() => setImporting(false)}
        classId={classId}
        type="tutorial"
        targetId={tutorialId}
        partLabel="questions"
        onImported={load}
      />

    </Box>
  );
}
