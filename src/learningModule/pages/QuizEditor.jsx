import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  Tooltip,
  useClipboard,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import PublishQuizModal from '../components/PublishQuizModal';
import ImportQuestionsModal from '../components/ImportQuestionsModal';
import QuizPreviewModal from '../components/QuizPreviewModal';
import RichTextEditor from '../components/RichTextEditor';
import { CopyLinkButton, ErrorState, Loading, SectionCard } from '../components/common';
import { duplicateOptionIndexes, questionsWithDuplicateOptions } from '../questionRules';
import { toDateTimeInput } from '../format';
import { LmIcon } from '../components/Icon';

const BLANK_QUESTION = {
  question: '',
  type: 'mcq',
  options: ['', '', '', ''],
  correctAnswers: [],
  explanation: '',
  marks: 1,
  negativeMarks: null,
  difficulty: 'medium',
  topic: '',
  // Filled in from the quiz's own default when the question is added, and left
  // at 0 on a paper that runs one clock — a stray 60 there reads as a live
  // per-question timer that never actually fires.
  timeLimitSec: 0,
  sectionId: null,
  tolerancePercent: 0,
  toleranceAbs: 0,
};

const TYPE_LABELS = {
  mcq: 'Single correct',
  msq: 'Multiple correct',
  truefalse: 'True / False',
  numerical: 'Numerical / integer',
};

/**
 * The three ways a paper can run, as one control.
 *
 * Delivery and timing are not independent — the one-page paper cannot enforce a
 * per-question clock — so offering them as two controls advertised a fourth
 * combination that does not exist and let a teacher undo per-question times by
 * changing delivery. The same three appear in the create dialog
 * (`Quizzes.jsx`), so a quiz is described the same way before and after it
 * exists.
 */
const METHODOLOGIES = [
  {
    key: 'one_page',
    icon: 'quiz',
    label: 'All questions on one page, one timer',
    hint: 'Students answer in any order and submit when ready, under a single countdown. Best for classroom quizzes.',
    deliveryMode: 'all_at_once',
    perQuestionTiming: false,
    canChooseBacktracking: false,
  },
  {
    key: 'sequential_paper_timer',
    icon: '1️⃣',
    label: 'One question at a time, one timer for the whole paper',
    hint: 'The server hands out one question at a time and remembers the position, so a refresh or a dropped connection resumes instead of restarting. One countdown covers the paper.',
    deliveryMode: 'one_at_a_time',
    perQuestionTiming: false,
    canChooseBacktracking: true,
  },
  {
    key: 'sequential_question_timer',
    icon: '⏱',
    label: 'One question at a time, a timer on each question',
    hint: 'Every question carries its own allowance and moves on by itself when it runs out. No overall clock, so each question needs a time of its own.',
    deliveryMode: 'one_at_a_time',
    perQuestionTiming: true,
    canChooseBacktracking: true,
  },
];

/** Which of the three a stored settings object is. */
const methodologyOf = (settings) => {
  if (settings.deliveryMode !== 'one_at_a_time') return 'one_page';
  return settings.perQuestionTiming ? 'sequential_question_timer' : 'sequential_paper_timer';
};

const toLocalInput = toDateTimeInput;

function QuestionCard({ question, index, sections, onChange, onRemove, onDuplicate, perQuestionTiming }) {
  const set = (field, value) => onChange({ ...question, [field]: value });
  const isChoice = ['mcq', 'msq', 'truefalse'].includes(question.type);
  // Flagged as it is typed rather than at save: by the time a toast says
  // "question 14 repeats an option", the teacher has to go and find which one.
  const duplicates = isChoice ? duplicateOptionIndexes(question.options) : new Set();

  const setType = (type) => {
    if (type === 'truefalse') {
      onChange({ ...question, type, options: ['True', 'False'], correctAnswers: [] });
    } else if (type === 'numerical') {
      onChange({ ...question, type, options: [], correctAnswers: [''] });
    } else {
      onChange({
        ...question,
        type,
        options: question.options?.length ? question.options : ['', '', '', ''],
        correctAnswers: [],
      });
    }
  };

  return (
    <SectionCard mb={3}>
      <Flex justify="space-between" align="center" mb={3} gap={2} wrap="wrap">
        <HStack>
          <Text fontWeight="600" fontSize="sm">
            Question {index + 1}
          </Text>
          <Badge colorScheme="gray">{TYPE_LABELS[question.type]}</Badge>
        </HStack>
        <HStack>
          <Button size="xs" variant="ghost" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button size="xs" variant="ghost" colorScheme="red" onClick={onRemove}>
            Delete
          </Button>
        </HStack>
      </Flex>

      {/* Settings before the text, and Type first among them: the choice of
          type decides what the answer section below even looks like, so making
          it after writing the question is the wrong way round — and a teacher
          who picks it last has already typed into a layout that then changes. */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={3}>
        <FormControl>
          <FormLabel fontSize="xs">Type</FormLabel>
          <Select size="sm" value={question.type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="xs">Difficulty</FormLabel>
          <Select size="sm" value={question.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="xs">Marks</FormLabel>
          <Input size="sm" type="number" min={0} value={question.marks} onChange={(e) => set('marks', Number(e.target.value) || 0)} />
        </FormControl>
        <FormControl>
          <Tooltip label="Leave blank to use the quiz-wide negative marking">
            <FormLabel fontSize="xs">Negative</FormLabel>
          </Tooltip>
          <Input
            size="sm"
            type="number"
            min={0}
            placeholder="default"
            value={question.negativeMarks ?? ''}
            onChange={(e) => set('negativeMarks', e.target.value === '' ? null : Number(e.target.value))}
          />
        </FormControl>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3} mb={3}>
        <FormControl>
          <FormLabel fontSize="xs">Section</FormLabel>
          <Select size="sm" value={question.sectionId || ''} onChange={(e) => set('sectionId', e.target.value || null)}>
            <option value="">Ungrouped</option>
            {sections.map((section) => (
              <option key={section._id} value={section._id}>
                {section.name}
              </option>
            ))}
          </Select>
        </FormControl>
        {/* Disabled rather than hidden while the paper runs on one clock: the
            box would otherwise look like an omission, and a teacher who wants
            it needs to know where the switch is. */}
        <FormControl isInvalid={perQuestionTiming && !question.timeLimitSec} isDisabled={!perQuestionTiming}>
          <FormLabel fontSize="xs">Time (seconds)</FormLabel>
          <Input
            size="sm"
            type="number"
            min={0}
            value={perQuestionTiming ? question.timeLimitSec : ''}
            placeholder={perQuestionTiming ? '' : 'Whole-paper timer'}
            onChange={(e) => set('timeLimitSec', Number(e.target.value) || 0)}
          />
          {!perQuestionTiming && (
            // A disabled input swallows hover, so the reason goes underneath
            // rather than into a tooltip nobody can trigger.
            <FormHelperText fontSize="xs">One timer covers the paper — see Delivery &amp; timing</FormHelperText>
          )}
          {perQuestionTiming && !question.timeLimitSec && (
            <FormHelperText fontSize="xs" color="red.500">
              Required while per-question timing is on
            </FormHelperText>
          )}
        </FormControl>
        <FormControl>
          <FormLabel fontSize="xs">Topic</FormLabel>
          <Input size="sm" value={question.topic} onChange={(e) => set('topic', e.target.value)} placeholder="Optional" />
        </FormControl>
      </SimpleGrid>

      <Box mb={3}>
        <RichTextEditor
          value={question.question}
          onChange={(html) => set('question', html)}
          placeholder="Question text — formatting, sub/superscripts and images are supported"
          minH="110px"
        />
      </Box>

      {isChoice && (
        <Stack spacing={2} mb={3}>
          <Text fontSize="xs" color="lmFg.muted">
            Tick the correct {question.type === 'msq' ? 'answers' : 'answer'}.
          </Text>
          {question.options.map((option, optionIndex) => (
            <Flex key={optionIndex} gap={2} align="flex-start">
              <Checkbox
                mt={2}
                isChecked={(question.correctAnswers || []).map(String).includes(String(optionIndex))}
                onChange={(event) => {
                  const current = (question.correctAnswers || []).map(String);
                  const key = String(optionIndex);
                  const next =
                    question.type === 'msq'
                      ? event.target.checked
                        ? [...current, key]
                        : current.filter((c) => c !== key)
                      : event.target.checked
                        ? [key]
                        : [];
                  set('correctAnswers', next);
                }}
              />
              {question.type === 'truefalse' ? (
                <Input size="sm" value={option} isReadOnly />
              ) : (
                <Box
                  flex="1"
                  borderWidth={duplicates.has(optionIndex) ? '1px' : 0}
                  borderColor="red.400"
                  borderRadius="md"
                >
                  <RichTextEditor
                    compact
                    minH="46px"
                    value={option}
                    onChange={(html) => {
                      const options = [...question.options];
                      options[optionIndex] = html;
                      set('options', options);
                    }}
                    placeholder={`Option ${optionIndex + 1}`}
                  />
                  {duplicates.has(optionIndex) && (
                    <Text fontSize="xs" color="red.600" px={2} pb={1}>
                      Same as an option above — a student could be right and wrong at once.
                    </Text>
                  )}
                </Box>
              )}
              {question.type !== 'truefalse' && question.options.length > 2 && (
                <IconButton
                  mt={1}
                  size="xs"
                  variant="ghost"
                  aria-label="Remove option"
                  colorScheme="red"
                  icon={<LmIcon name="delete" size={15} />}
                  onClick={() => {
                    set('options', question.options.filter((_, i) => i !== optionIndex));
                    set(
                      'correctAnswers',
                      (question.correctAnswers || []).filter((c) => String(c) !== String(optionIndex)),
                    );
                  }}
                />
              )}
            </Flex>
          ))}
          {question.type !== 'truefalse' && (
            <Button size="xs" variant="link" alignSelf="flex-start" onClick={() => set('options', [...question.options, ''])}>
              + Add option
            </Button>
          )}
        </Stack>
      )}

      {question.type === 'numerical' && (
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3} mb={3}>
          <FormControl>
            <FormLabel fontSize="xs">Correct value</FormLabel>
            <Input
              size="sm"
              value={(question.correctAnswers || [])[0] || ''}
              placeholder="42"
              onChange={(e) => set('correctAnswers', [e.target.value])}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Tolerance %</FormLabel>
            <Input
              size="sm"
              type="number"
              min={0}
              value={question.tolerancePercent}
              onChange={(e) => set('tolerancePercent', Number(e.target.value) || 0)}
            />
          </FormControl>
          <FormControl>
            <Tooltip label="Absolute allowance — needed when the answer is near zero">
              <FormLabel fontSize="xs">Tolerance ±</FormLabel>
            </Tooltip>
            <Input
              size="sm"
              type="number"
              min={0}
              value={question.toleranceAbs}
              onChange={(e) => set('toleranceAbs', Number(e.target.value) || 0)}
            />
          </FormControl>
        </SimpleGrid>
      )}

      <RichTextEditor
        compact
        value={question.explanation || ''}
        onChange={(html) => set('explanation', html)}
        placeholder="Explanation shown to students after they submit"
      />
    </SectionCard>
  );
}

/**
 * The paper and everything about how it runs, over two pages.
 *
 * Seven tabs in one bar buried the two a teacher opens the editor to use —
 * writing questions and grouping them — behind five they set once and rarely
 * touch again. So the settings tabs moved to their own page, reached by the
 * gear in the header, and this component renders one half or the other
 * (`mode`). Both halves are the same component on purpose: the load, the
 * unsaved `quiz` state and the single Save all stay in one place, and moving
 * between the two pages saves first so nothing typed is lost to the reload.
 */
export default function QuizEditor({ mode = 'questions' }) {
  const isSettings = mode === 'settings';
  const { classId } = useOutletContext();
  const { quizId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [collaboratorEmails, setCollaboratorEmails] = useState('');
  const publishDialog = useDisclosure();
  const importDialog = useDisclosure();
  const previewDialog = useDisclosure();
  const [wentLive, setWentLive] = useState(false);
  // Safe Exam Browser authoring. Kept local rather than folded into `quiz`:
  // the file itself and the once-shown bypass code are never part of the
  // settings object the big Save button persists — both go to the server
  // immediately, through their own endpoints, the moment they are set.
  const [sebFile, setSebFile] = useState(null);
  const [sebUploading, setSebUploading] = useState(false);
  const [sebCodeBusy, setSebCodeBusy] = useState(false);
  /* The access code is now kept in the clear on the quiz (see the model), so the
     editor reads it off the settings like any other field rather than catching a
     plaintext that existed in exactly one response. What is left in state is the
     blank string for a paper minted before the code was kept — nothing to show,
     and the panel says so. */
  const sebCode = quiz?.settings?.sebBypassCode || '';
  const sebCodeClip = useClipboard(sebCode);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await lmApi.getQuiz(classId, quizId);
      setQuiz(data);
      setCollaboratorEmails((data.collaborators || []).map((c) => c.email).join(', '));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, quizId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    // The server rejects this too; catching it here names the questions while
    // the teacher is still on the page that can fix them.
    const repeated = questionsWithDuplicateOptions(quiz.questions);
    if (repeated.length) {
      toast({
        status: 'error',
        duration: 8000,
        title: `Question${repeated.length > 1 ? 's' : ''} ${repeated.join(', ')} repeat${
          repeated.length > 1 ? '' : 's'
        } an option`,
        description: 'Every choice in a question must be distinct. The repeats are outlined in red.',
      });
      return false;
    }

    setSaving(true);
    try {
      await lmApi.updateQuiz(classId, quizId, {
        title: quiz.title,
        description: quiz.description,
        instructions: quiz.instructions,
        sections: quiz.sections,
        questions: quiz.questions,
        settings: quiz.settings,
      });
      toast({ status: 'success', title: 'Quiz saved' });
      await load();
      return true;
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 8000 });
      return false;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Save first, for the same reason publishing does: the import appends to the
   * stored paper and this page then reloads it, so anything typed and not saved
   * would be thrown away by the reload that follows.
   */
  const openImport = async () => {
    if (!(await save())) return;
    importDialog.onOpen();
  };

  // Same reason as the import: the other page reloads the quiz from the
  // server, so anything typed here has to be persisted before we leave.
  const goto = async (path) => {
    if (!(await save())) return;
    navigate(path);
  };

  // Save first — the dialog publishes what is on the server, not what is on
  // screen — then hand over to it for the two clocks and the link.
  const publish = async () => {
    if (!(await save())) return;
    setWentLive(false);
    publishDialog.onOpen();
  };

  // Back to the list once it is actually out, which is where the link, the
  // schedule and the results live. A cancelled dialog leaves the editor alone.
  const closePublish = () => {
    publishDialog.onClose();
    if (wentLive) navigate(`/learning/class/${classId}/quizzes`);
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!quiz) return null;

  const set = (changes) => setQuiz((prev) => ({ ...prev, ...changes }));
  const uploadSebFile = async () => {
    if (!sebFile) return;
    setSebUploading(true);
    try {
      const { settings } = await lmApi.uploadSebConfig(classId, quizId, sebFile);
      set({ settings });
      setSebFile(null);
      toast({ status: 'success', title: 'Safe Exam Browser file uploaded.', duration: 4000 });
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 6000 });
    } finally {
      setSebUploading(false);
    }
  };

  const generateSebCode = async () => {
    setSebCodeBusy(true);
    try {
      const { settings } = await lmApi.setSebBypassCode(classId, quizId, {});
      // The reply's `settings` carries the new plaintext, so nothing has to be
      // stashed alongside it — the panel re-renders showing the code.
      set({ settings });
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 6000 });
    } finally {
      setSebCodeBusy(false);
    }
  };

  const clearSebCode = async () => {
    setSebCodeBusy(true);
    try {
      const { settings } = await lmApi.setSebBypassCode(classId, quizId, { clear: true });
      set({ settings });
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 6000 });
    } finally {
      setSebCodeBusy(false);
    }
  };

  const setSetting = (key, value) => set({ settings: { ...quiz.settings, [key]: value } });
  const setSettings = (changes) => set({ settings: { ...quiz.settings, ...changes } });
  const settings = quiz.settings;
  const methodology = methodologyOf(settings);

  const addQuestion = () =>
    set({
      questions: [
        ...quiz.questions,
        {
          ...JSON.parse(JSON.stringify(BLANK_QUESTION)),
          timeLimitSec: settings.perQuestionTiming ? settings.defaultQuestionSec || 60 : 0,
        },
      ],
    });

  /**
   * Switching methodology sets delivery and timing together, so the other
   * clock is put away rather than left set behind a control that no longer shows
   * it. `allowBacktracking` is deliberately *not* reset: it is a choice that
   * means the same thing under both one-at-a-time methodologies, and clearing it
   * on a switch would silently reopen a paper the teacher had closed.
   */
  const setMethodology = (key) => {
    const chosen = METHODOLOGIES.find((option) => option.key === key);
    if (!chosen) return;
    setSettings({
      deliveryMode: chosen.deliveryMode,
      perQuestionTiming: chosen.perQuestionTiming,
      // The one-page paper is free navigation by definition; the server pins the
      // flag on for it too, so the editor must not disagree.
      ...(chosen.canChooseBacktracking ? {} : { allowBacktracking: true }),
      ...(chosen.perQuestionTiming
        ? { timeLimitMinutes: 0, defaultQuestionSec: settings.defaultQuestionSec || 60 }
        : {}),
    });
  };

  // Questions still carrying 0 seconds block publishing while per-question
  // timing is on, so the count is worth showing before they try.
  const untimedCount = settings.perQuestionTiming
    ? quiz.questions.filter((question) => !question.timeLimitSec).length
    : 0;

  const totalMarks = quiz.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
        <Box>
          {isSettings ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => goto(`/learning/class/${classId}/quiz/${quizId}/edit`)}
              isLoading={saving}
            >
              ← Back to questions
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/learning/class/${classId}/quizzes`)}>
              ← Back to quizzes
            </Button>
          )}
          <Heading size="md" mt={1}>
            {quiz.title}
          </Heading>
          <Text fontSize="sm" color="lmFg.muted">
            {quiz.questions.length} questions · {totalMarks} marks
            {settings.questionsPerAttempt > 0 && ` · ${settings.questionsPerAttempt} drawn per student`}
            {quiz.source === 'ai' && ' · generated from a class recording'}
          </Text>
        </Box>
        <HStack>
          {quiz.published && <CopyLinkButton to={`/learning/class/${classId}/quiz/${quizId}`} />}
          <Button size="sm" variant="outline" colorScheme="purple" onClick={previewDialog.onOpen}>
            <LmIcon name="preview" size={14} style={{ marginRight: 6 }} />
            Preview
          </Button>
          <Button size="sm" variant="outline" onClick={save} isLoading={saving}>
            Save
          </Button>
          <Button size="sm" colorScheme="green" onClick={publish} isDisabled={!quiz.questions.length}>
            Save &amp; publish
          </Button>
        </HStack>
      </Flex>

      {isSettings ? (
        <Tabs colorScheme="purple" variant="enclosed">
          <TabList>
            <Tab fontSize="sm">Delivery &amp; timing</Tab>
            <Tab fontSize="sm">Marking</Tab>
            <Tab fontSize="sm">Proctoring</Tab>
            <Tab fontSize="sm">Instructions</Tab>
            <Tab fontSize="sm">Access</Tab>
          </TabList>

          <TabPanels>
            {/* ---------- delivery & timing ---------- */}
            <TabPanel px={0}>
              {/* Delivery, the clock and the going-back rule are one card because
                  they are one decision: only three of the four delivery/timing
                  combinations exist, and asked separately a teacher could set
                  per-question times and then quietly lose them by changing
                  delivery. Each methodology carries its own clock field and, where
                  it means something, its own navigation choice. */}
              <SectionCard
                title="How this paper runs"
                subtitle="One clock or one per question — never both, so there is no doubt about which countdown a student is watching."
                mb={4}
              >
                <RadioGroup value={methodology} onChange={setMethodology}>
                  <Stack spacing={4}>
                    {METHODOLOGIES.map((option) => (
                      <Box key={option.key}>
                        <Radio value={option.key} alignItems="flex-start">
                          <Box>
                            <Text fontSize="sm" fontWeight="600">
                              {option.icon} {option.label}
                            </Text>
                            <Text fontSize="xs" color="lmFg.muted">
                              {option.hint}
                            </Text>
                          </Box>
                        </Radio>

                        {methodology === option.key && (
                          <Stack spacing={3} mt={3} ml={6} pl={3} borderLeftWidth="2px" borderColor="lmHue.purple200">
                            <FormControl maxW="260px">
                              {option.perQuestionTiming ? (
                                <>
                                  <Tooltip label="Stamped on each question you add from now on. Existing questions keep their own time.">
                                    <FormLabel fontSize="xs">Default time for new questions (seconds)</FormLabel>
                                  </Tooltip>
                                  <Input
                                    size="sm"
                                    type="number"
                                    min={0}
                                    value={settings.defaultQuestionSec ?? 60}
                                    onChange={(e) => setSetting('defaultQuestionSec', Number(e.target.value) || 0)}
                                  />
                                </>
                              ) : (
                                <>
                                  <FormLabel fontSize="xs">Overall time limit (minutes, 0 = none)</FormLabel>
                                  <Input
                                    size="sm"
                                    type="number"
                                    min={0}
                                    value={settings.timeLimitMinutes}
                                    onChange={(e) => setSetting('timeLimitMinutes', Number(e.target.value) || 0)}
                                  />
                                </>
                              )}
                            </FormControl>

                            {/* Offered under both clocks. Under per-question
                                timing a revisit resumes the question's remaining
                                budget rather than restarting it, which is what
                                makes the combination safe to offer. */}
                            {option.canChooseBacktracking && (
                              <Checkbox
                                size="sm"
                                alignItems="flex-start"
                                isChecked={settings.allowBacktracking}
                                onChange={(e) => setSetting('allowBacktracking', e.target.checked)}
                              >
                                <Text fontSize="sm">Let students go back and change earlier answers</Text>
                                <Text fontSize="xs" color="lmFg.muted">
                                  {option.perQuestionTiming
                                    ? 'A revisited question resumes with the seconds it had left, and one whose time is gone is shown read-only — so going back cannot buy more time. Off is placement-test behaviour.'
                                    : 'Off is placement-test behaviour: once a question is answered, it is closed.'}
                                </Text>
                              </Checkbox>
                            )}

                            {option.perQuestionTiming && (
                              <Alert status={untimedCount ? 'warning' : 'info'} borderRadius="md" fontSize="xs">
                                <AlertIcon />
                                {untimedCount
                                  ? `${untimedCount} question(s) still have no time set — publishing is blocked until every question has one.`
                                  : 'Every question carries its own time, set in the Questions tab.'}
                              </Alert>
                            )}
                          </Stack>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </RadioGroup>
              </SectionCard>

              <SectionCard title="When students may sit it" mb={4}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  {/* The cut-off in the same spelling the publish dialog writes
                      and the engine reads first — `startDeadline`. This card used
                      to offer only the older relative `marginMinutes`, so a quiz
                      whose entry closes at a moment set while publishing showed a
                      flat 0 here, which reads as "no cut-off" for a paper that
                      has one. */}
                  <FormControl>
                    <Tooltip label="Students may still be sitting the test after this, but nobody new can begin">
                      <FormLabel fontSize="xs">Entry closes at</FormLabel>
                    </Tooltip>
                    <Input
                      size="sm"
                      type="datetime-local"
                      value={toDateTimeInput(settings.startDeadline)}
                      onChange={(e) => setSetting('startDeadline', e.target.value ? new Date(e.target.value).toISOString() : null)}
                    />
                    <FormHelperText fontSize="xs">
                      Blank = anyone may start while the quiz is open. Also set when you publish.
                    </FormHelperText>
                  </FormControl>
                  {/* Only for a quiz still carrying the older relative form, and
                      only while nothing has superseded it: an absolute cut-off
                      wins outright, so showing both would offer two answers to one
                      question. */}
                  {!settings.startDeadline && settings.marginMinutes > 0 && (
                    <FormControl>
                      <Tooltip label="The older relative form of the same cut-off, counted from the opening time">
                        <FormLabel fontSize="xs">Late-entry window (minutes after opening)</FormLabel>
                      </Tooltip>
                      <Input
                        size="sm"
                        type="number"
                        min={0}
                        value={settings.marginMinutes}
                        onChange={(e) => setSetting('marginMinutes', Number(e.target.value) || 0)}
                      />
                      <FormHelperText fontSize="xs">
                        0 = anyone may start while the quiz is open. Setting a moment above replaces this.
                      </FormHelperText>
                    </FormControl>
                  )}
                  <FormControl>
                    <FormLabel fontSize="xs">Opens at</FormLabel>
                    <Input
                      size="sm"
                      type="datetime-local"
                      value={toDateTimeInput(settings.availableFrom)}
                      onChange={(e) => setSetting('availableFrom', e.target.value ? new Date(e.target.value).toISOString() : null)}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Test closes at</FormLabel>
                    <Input
                      size="sm"
                      type="datetime-local"
                      value={toDateTimeInput(settings.availableTo)}
                      onChange={(e) => setSetting('availableTo', e.target.value ? new Date(e.target.value).toISOString() : null)}
                    />
                  </FormControl>
                  <FormControl>
                    <Tooltip label="Scores stay hidden until this moment, so a whole cohort sees them together. You can always announce them sooner from the results page.">
                      <FormLabel fontSize="xs">Results announced at</FormLabel>
                    </Tooltip>
                    <Input
                      size="sm"
                      type="datetime-local"
                      value={toDateTimeInput(settings.resultReleaseAt)}
                      onChange={(e) => setSetting('resultReleaseAt', e.target.value ? new Date(e.target.value).toISOString() : null)}
                    />
                    <FormHelperText fontSize="xs">
                      Blank shows each student their result as they submit. Confirmed when you publish.
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>
              </SectionCard>
            </TabPanel>

            {/* ---------- marking ---------- */}
            <TabPanel px={0}>
              <SectionCard title="Marking and randomisation">
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                  <FormControl>
                    <Tooltip label="Applied to any question that does not set its own. Unanswered questions are never penalised.">
                      <FormLabel fontSize="xs">Negative marking (default)</FormLabel>
                    </Tooltip>
                    <Input
                      size="sm"
                      type="number"
                      min={0}
                      value={settings.negativeMarking}
                      onChange={(e) => setSetting('negativeMarking', Number(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Pass mark (%)</FormLabel>
                    <Input
                      size="sm"
                      type="number"
                      min={0}
                      max={100}
                      value={settings.passPercent}
                      onChange={(e) => setSetting('passPercent', Number(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormControl>
                    <Tooltip label="Draw this many questions at random from the bank for each student. 0 = serve every question.">
                      <FormLabel fontSize="xs">Questions per student</FormLabel>
                    </Tooltip>
                    <Input
                      size="sm"
                      type="number"
                      min={0}
                      max={quiz.questions.length}
                      value={settings.questionsPerAttempt}
                      onChange={(e) => setSetting('questionsPerAttempt', Number(e.target.value) || 0)}
                    />
                  </FormControl>
                </SimpleGrid>

                <Divider my={4} />
                <Stack spacing={2}>
                  <Checkbox
                    size="sm"
                    isChecked={settings.shuffleQuestions}
                    onChange={(e) => setSetting('shuffleQuestions', e.target.checked)}
                  >
                    Shuffle question order per student
                  </Checkbox>
                  <Checkbox
                    size="sm"
                    isChecked={settings.shuffleOptions}
                    onChange={(e) => setSetting('shuffleOptions', e.target.checked)}
                  >
                    Shuffle options per student (True/False is left alone)
                  </Checkbox>
                  <Checkbox
                    size="sm"
                    isChecked={settings.showAnswersAfterSubmit}
                    onChange={(e) => setSetting('showAnswersAfterSubmit', e.target.checked)}
                  >
                    Show correct answers and explanations after submitting
                  </Checkbox>
                  <Checkbox
                    size="sm"
                    isChecked={settings.showScoreImmediately}
                    onChange={(e) => setSetting('showScoreImmediately', e.target.checked)}
                  >
                    Show the score immediately (subject to the release time)
                  </Checkbox>
                </Stack>
              </SectionCard>
            </TabPanel>

            {/* ---------- proctoring ---------- */}
            <TabPanel px={0}>
              <SectionCard
                title="Proctoring"
                subtitle="Deterrents, not guarantees — a determined student can defeat any of them. What makes them useful is that every event is recorded on the attempt for you to review."
              >
                <Stack spacing={3}>
                  {/* Not a checkbox, because it is not a choice any more: every
                      paper is sat in fullscreen and the first departure submits
                      it. Stated here so a teacher setting the paper knows exactly
                      what their class will be held to. */}
                  <Box p={3} bg="lmHue.orange50" borderRadius="md" borderWidth="1px" borderColor="lmHue.orange200">
                    <Text fontSize="sm" fontWeight="600" mb={1}>
                      Always on: fullscreen lockdown
                    </Text>
                    <Text fontSize="xs" color="lmFg.body">
                      Every test runs in fullscreen. Leaving fullscreen, or switching to another tab,
                      window or application, submits the student&apos;s attempt immediately and records
                      the reason on it. There is no allowance to configure — your students are told
                      this on the pre-test screen before they can start.
                    </Text>
                  </Box>

                  {/* Set at creation as "is this sitting watched?", and changeable
                      here for the same reason everything else is. Only shown for
                      one-at-a-time delivery: on a one-page paper every question is
                      already in the browser, so there is nothing to fetch ahead
                      and the setting would be a lie. */}
                  {settings.deliveryMode === 'one_at_a_time' && (
                    <Box p={3} borderRadius="md" borderWidth="1px" borderColor="lmBorder.base">
                      <Checkbox
                        size="sm"
                        alignItems="flex-start"
                        isChecked={Boolean(settings.prefetchQuestions)}
                        onChange={(e) => setSetting('prefetchQuestions', e.target.checked)}
                      >
                        <Text fontSize="sm" fontWeight="600">
                          Proctored — load the next question ahead
                        </Text>
                        <Text fontSize="xs" color="lmFg.subtle">
                          Pressing Next is immediate, because the browser already has the question.
                          Where this paper lets students go back it is sent plainly; otherwise it is
                          encrypted and the key is only released when they reach it.
                        </Text>
                      </Checkbox>
                      {!settings.prefetchQuestions && (
                        <Alert status="warning" borderRadius="md" mt={2} py={2} fontSize="xs">
                          <AlertIcon boxSize={3} />
                          <Box>
                            <b>High security:</b> nothing loads ahead. Students will see a pause on every
                            Next — noticeable on a slow or busy connection, and worst when a whole batch
                            starts at once.
                          </Box>
                        </Alert>
                      )}
                    </Box>
                  )}

                  {/* Named honestly. The check is on the User-Agent string, which
                      a browser chooses for itself and any student can change from
                      the devtools device toolbar in one click. It turns away the
                      student who wandered in on a phone; it stops nobody who does
                      not want to be stopped. Promising otherwise is worse than the
                      gap, because a teacher plans around the promise. */}
                  <Box>
                    <Checkbox
                      size="sm"
                      isChecked={settings.preventMobile}
                      onChange={(e) => setSetting('preventMobile', e.target.checked)}
                    >
                      Discourage mobile devices
                    </Checkbox>
                    <Text fontSize="xs" opacity={0.6} ml={6}>
                      Turns away phones that identify themselves as phones. Trivially bypassed — treat it as a
                      nudge, not a control.
                    </Text>
                  </Box>
                  <Box>
                    <Checkbox
                      size="sm"
                      isChecked={settings.keyboardLockdown !== false}
                      onChange={(e) => setSetting('keyboardLockdown', e.target.checked)}
                    >
                      Block the keyboard, warn twice, then submit
                    </Checkbox>
                    <Text fontSize="xs" opacity={0.6} ml={6}>
                      Closes the gap a <b>hotkey-summoned</b> desktop AI assistant opens: on macOS one
                      answers a global hotkey with a panel drawn over the browser, which fires none of
                      the events that end a paper. The hotkey itself is consumed by the operating
                      system, but the modifier held down first still reaches the page, and that is what
                      this catches. Every answer here is clicked — a numerical answer gets an on-screen
                      keypad — so during a sitting the keyboard has no legitimate use. Every key is
                      swallowed and recorded on the attempt; the first two are answered with an
                      on-screen warning, and the third submits the paper. Unlike leaving the screen
                      this gets an allowance, because a hand resting on a key looks the same as a
                      hotkey at the first event.
                    </Text>
                    {settings.keyboardLockdown === false && (
                      <Text fontSize="xs" color="lmHue.orange700" ml={6} mt={1}>
                        Off: a student can reach a hotkey without ending their paper. Turn it off only
                        for a candidate who needs a keyboard for assistive input.
                      </Text>
                    )}
                    {/* Said plainly and next to the setting, because the failure
                        mode is a teacher reading "blocks AI assistants" and
                        planning a paper around a guarantee that stops at the
                        keyboard. Reported from a live sitting on macOS: a spoken
                        "Hey Siri" reaches the assistant without touching the
                        page. */}
                    <Text fontSize="xs" color="lmHue.orange700" ml={6} mt={1}>
                      Not covered: an assistant summoned <b>by voice</b>. Speaking to Siri produces no
                      keystroke, no focus change and no fullscreen exit, so no web page can observe it.
                      Require Safe Exam Browser below, with Siri and dictation turned off in the
                      settings file, for a paper where that matters.
                    </Text>
                  </Box>
                  <Checkbox
                    size="sm"
                    isChecked={settings.disableCopyPaste}
                    onChange={(e) => setSetting('disableCopyPaste', e.target.checked)}
                  >
                    Disable copy, cut and paste
                  </Checkbox>
                  <Checkbox
                    size="sm"
                    isChecked={settings.disableRightClick}
                    onChange={(e) => setSetting('disableRightClick', e.target.checked)}
                  >
                    Disable right-click
                  </Checkbox>

                  <Divider />
                  {/* An allowance rather than a deterrent, but it belongs next to
                      them: it is the same decision about what a student may have
                      on screen during the sitting. */}
                  <Checkbox
                    size="sm"
                    isChecked={settings.allowCalculator !== false}
                    onChange={(e) => setSetting('allowCalculator', e.target.checked)}
                  >
                    Offer an on-screen scientific calculator
                  </Checkbox>
                  <Text fontSize="xs" color="lmFg.muted" pl={6} mt={-1}>
                    Turn this off for a paper where the arithmetic is the point.
                  </Text>

                  <Divider />

                  {/* The invigilation pulse — for the person at the back of the
                      hall, not the student. A faint ring blooms out of the centre
                      of every live screen at the same instant, on the server's
                      clock, so a room of papers breathes together and a screen
                      out of the rhythm stands out from a distance. On by default,
                      because it is only useful if it was already running when an
                      invigilator walked the hall — a teacher setting a paper that
                      nobody watches turns it off here. */}
                  <Box>
                    <Checkbox
                      size="sm"
                      isChecked={settings.invigilationPulse !== false}
                      onChange={(e) => setSetting('invigilationPulse', e.target.checked)}
                    >
                      Automatic invigilation pulse — a synchronised ring every 30 seconds
                    </Checkbox>
                    <Text fontSize="xs" color="lmFg.muted" pl={6} mt={-1}>
                      A faint ring sweeps out from the centre of every live screen every 30 seconds, all
                      in step on the server&apos;s clock. It is weak up close and never covers the text; from
                      the back what shows is the motion, and a screen not pulsing in time is the one to
                      walk over to. This toggle only controls the <em>standing</em> pulse — the ring
                      colour below can be changed at any time from Live control, and a live sitting
                      picks up the new shade on its next heartbeat.
                    </Text>
                    {/* Always shown, not gated on the toggle: the colour is the
                        same setting Live control edits mid-sitting, so a teacher
                        who has not turned the standing pulse on still gets to
                        pick the shade their invigilators will read at range. */}
                    <HStack pl={6} mt={2} spacing={3}>
                      <Text fontSize="xs" color="lmFg.body">
                        Ring colour
                      </Text>
                      <Input
                        type="color"
                        size="sm"
                        w="56px"
                        p={1}
                        value={settings.invigilationPulseColor || '#3884ff'}
                        onChange={(e) => setSetting('invigilationPulseColor', e.target.value)}
                        aria-label="Invigilation pulse ring colour"
                      />
                      <Text fontSize="xs" color="lmFg.muted">
                        Used by the pulse everywhere, and changeable mid-sitting from Live control —
                        pick a shade your invigilators can read at range.
                      </Text>
                    </HStack>
                  </Box>

                  <Divider />

                  {/* Webcam invigilation. On by default, and the most sensitive
                      control here — it captures images of students — so it is
                      stated plainly, it can be turned off for a paper that does
                      not want it, and the consent lives on the student's own
                      pre-test screen. */}
                  <Box>
                    <Checkbox
                      size="sm"
                      isChecked={Boolean(settings.requireWebcam)}
                      onChange={(e) => setSetting('requireWebcam', e.target.checked)}
                    >
                      Require a webcam, and flag when no face is visible
                    </Checkbox>
                    <Text fontSize="xs" color="lmFg.muted" pl={6} mt={-1}>
                      Students must allow their camera on the pre-test screen — the test will not start
                      without it, and a refresh re-asks. Their browser watches for a face for the length
                      of the paper; a frame with no face raises the student in <b>Live control</b>, with a
                      thumbnail to look at. Detection runs on the student&apos;s device and only a result is
                      sent, so a slow connection is not loaded — an image travels only when a frame is
                      flagged.
                    </Text>
                    {settings.requireWebcam && (
                      <>
                        {/* The random snapshots. Kept next to the requirement
                            that produces them, and only shown once it is on:
                            a count on a paper with no camera is a setting that
                            does nothing, which is worse than absent. */}
                        <HStack pl={6} mt={2} spacing={3} align="center">
                          <Text fontSize="xs" color="lmFg.body">
                            Random snapshots per sitting
                          </Text>
                          <Input
                            type="number"
                            size="sm"
                            w="72px"
                            min={0}
                            max={20}
                            value={settings.webcamSnapshotCount ?? 3}
                            onChange={(e) =>
                              setSetting(
                                'webcamSnapshotCount',
                                Math.min(20, Math.max(0, Math.trunc(Number(e.target.value) || 0))),
                              )
                            }
                            aria-label="Random webcam snapshots per sitting"
                          />
                          <Text fontSize="xs" color="lmFg.muted">
                            Taken at moments no one can predict, spread across the paper, and stored with
                            the quiz. 0 turns them off.
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="lmHue.orange700" pl={6} mt={1}>
                          This records images of students. Make sure your institution permits it and that
                          students are told — the pre-test screen discloses it before they grant the camera.
                          Automatic face detection depends on the browser; where it is unavailable, thumbnails
                          are kept for you to review by eye instead.
                        </Text>
                      </>
                    )}
                  </Box>

                  <Divider />

                  {/* Safe Exam Browser. A different kind of control from
                      everything above: those raise the cost of cheating from
                      inside an ordinary tab; this replaces the tab, so it closes
                      what nothing above can reach — a desktop AI assistant that
                      overlays the browser without ever touching it (no blur, no
                      visibility change, no fullscreen exit — see the long
                      comment on lmQuiz's `requireSafeExamBrowser`). */}
                  <Checkbox
                    size="sm"
                    isChecked={Boolean(settings.requireSafeExamBrowser)}
                    onChange={(e) => setSetting('requireSafeExamBrowser', e.target.checked)}
                  >
                    Require Safe Exam Browser
                  </Checkbox>
                  <Text fontSize="xs" color="lmFg.muted" pl={6} mt={-1}>
                    Highly secure. The test can only be opened inside Safe Exam Browser (SEB) — a
                    locked-down browser students install beforehand — which shuts every other
                    application out for the duration. Without it, a student cannot start this test
                    at all, unless you enable the access-code fallback below.
                  </Text>

                  {settings.requireSafeExamBrowser && (
                    <Box pl={6} mt={2}>
                      <Stack spacing={4} borderLeftWidth="2px" borderColor="lmBorder.base" pl={4}>
                        <Box>
                          <Text fontSize="sm" fontWeight="600" mb={1}>
                            1. Exam settings file
                            {settings.sebConfigSource === 'shared' ? ' (optional for this paper)' : ''}
                          </Text>
                          {/* With a shared file on the server this paper is already
                              set up, so the build-it-yourself instructions are not
                              an instruction any more — they are an option most
                              teachers should ignore. Reading them as a to-do is
                              what sent teachers to SEB's Configuration Tool for a
                              file the institution had uploaded months ago. */}
                          <Text fontSize="xs" color="lmFg.muted" mb={2}>
                            {settings.sebConfigSource === 'shared' ? (
                              <>
                                Nothing to upload — the institution&apos;s shared configuration covers
                                this paper. Use this only if it needs a lockdown of its own: build the{' '}
                                <code>.seb</code> file in SEB&apos;s free Configuration Tool and paste
                                the <b>Config Key</b> it shows below. Both have to match the same saved
                                file.
                              </>
                            ) : (
                              <>
                                Build this once in SEB&apos;s own free Configuration Tool — set the
                                Start URL to this test&apos;s link and a quit password if you want one
                                — then upload the <code>.seb</code> file it produces. The tool also
                                shows a <b>Config Key</b>: paste that into the field below. Both have
                                to match the same saved file, or the check below will refuse every
                                student, including ones who did everything right.
                              </>
                            )}
                          </Text>
                          <HStack mb={1}>
                            <Input
                              size="sm"
                              type="file"
                              accept=".seb"
                              onChange={(e) => setSebFile(e.target.files?.[0] || null)}
                              maxW="280px"
                            />
                            <Button
                              size="sm"
                              onClick={uploadSebFile}
                              isDisabled={!sebFile}
                              isLoading={sebUploading}
                            >
                              Upload
                            </Button>
                          </HStack>
                          <Text fontSize="xs" color={settings.sebConfigFileName ? 'lmHue.green700' : 'lmFg.faint'}>
                            {settings.sebConfigFileName
                              ? `Current file: ${settings.sebConfigFileName}`
                              : 'No file uploaded yet.'}
                          </Text>
                        </Box>

                        {/* Reported from a live sitting: a student said "Hey Siri"
                            in an ordinary browser and read the answer off the
                            panel. Nothing on the page can see that — a spoken
                            trigger fires no event at all, so the keyboard rule
                            above, which works by catching the modifier of a
                            hotkey, has nothing to catch. SEB is the only place
                            this can be stopped rather than recorded, and only if
                            the file was built with the assistant switched off.
                            A file built with the defaults leaves it on, so this
                            says so where the file is chosen rather than in a
                            release note nobody re-reads. It applies to the shared
                            file just as much as to a per-paper one. */}
                        <Alert status="warning" borderRadius="md" fontSize="xs" py={2} alignItems="flex-start">
                          <AlertIcon />
                          <Box>
                            <Text fontWeight="600" mb={1}>
                              Turn off Siri and dictation in the file
                            </Text>
                            In the Configuration Tool&apos;s macOS settings, clear{' '}
                            <b>allowSiri</b> and <b>allowDictation</b> before saving. A student can
                            summon a voice assistant by speaking, and a spoken trigger produces no
                            keystroke, no focus change and no fullscreen exit — so nothing in this
                            module can detect it, including the keyboard rule above. SEB refusing to
                            run alongside it is the only thing that stops it, and only if the file
                            says so.
                          </Box>
                        </Alert>

                        <FormControl>
                          <FormLabel fontSize="xs">Config Key</FormLabel>
                          <Input
                            size="sm"
                            fontFamily="mono"
                            placeholder="Pasted from the SEB Configuration Tool"
                            value={settings.sebConfigKey || ''}
                            onChange={(e) => setSetting('sebConfigKey', e.target.value)}
                          />
                        </FormControl>

                        {/* Three states, not two. The middle one is the common case
                            now: the institution has a file on the server, so this
                            paper is ready without anybody uploading anything, and
                            telling a teacher "not ready" there sends them to build a
                            file they do not need. */}
                        {settings.sebConfigSource === 'shared' ? (
                          <Alert status="success" borderRadius="md" fontSize="xs" py={2}>
                            <AlertIcon />
                            <Box>
                              Ready — using the institution&apos;s shared configuration
                              {settings.sebSharedFileName ? ` (${settings.sebSharedFileName})` : ''}. Upload a
                              file above only if this paper needs a lockdown of its own.
                            </Box>
                          </Alert>
                        ) : settings.sebConfigSource === 'quiz' ? (
                          <Alert status="success" borderRadius="md" fontSize="xs" py={2}>
                            <AlertIcon />
                            Ready — this paper uses its own file and key.
                          </Alert>
                        ) : (
                          <Alert status="warning" borderRadius="md" fontSize="xs" py={2}>
                            <AlertIcon />
                            <Box>
                              Not ready yet — this paper has no file of its own and no shared
                              configuration has been set up for the institution. Either upload both
                              above, or ask an administrator to set the shared one once for everybody.
                            </Box>
                          </Alert>
                        )}

                        <Box>
                          <Text fontSize="sm" fontWeight="600" mb={1}>
                            2. Access code, for a student without Safe Exam Browser
                          </Text>
                          <Text fontSize="xs" color="lmFg.muted" mb={2}>
                            SEB only runs on Windows and macOS, and has to be installed beforehand —
                            real, known reasons a student cannot use it. One shared code lets you get
                            a specific student into the test from an ordinary browser when that
                            happens; hand it out yourself, to whoever actually needs it. Every use is
                            still recorded on the attempt it unlocks.
                          </Text>
                          {/* The code itself, kept on screen rather than flashed
                              once at mint time: it is handed out by a teacher, by
                              hand, and one shown once is one that gets needlessly
                              regenerated — retiring a code already given out. */}
                          {sebCode && (
                            <HStack
                              mb={2}
                              borderWidth="1px"
                              borderColor="lmHue.purple200"
                              bg="lmHue.purple50"
                              borderRadius="md"
                              px={3}
                              py={2}
                              w="fit-content"
                            >
                              <Text fontFamily="mono" fontSize="md" fontWeight="700" letterSpacing="0.1em" userSelect="all">
                                {sebCode}
                              </Text>
                              <Button size="xs" onClick={sebCodeClip.onCopy}>
                                {sebCodeClip.hasCopied ? 'Copied' : 'Copy'}
                              </Button>
                            </HStack>
                          )}
                          <HStack>
                            <Button size="sm" onClick={generateSebCode} isLoading={sebCodeBusy}>
                              {settings.sebBypassEnabled ? 'Generate a new code' : 'Enable and generate a code'}
                            </Button>
                            {settings.sebBypassEnabled && (
                              <Button size="sm" variant="outline" colorScheme="red" onClick={clearSebCode} isLoading={sebCodeBusy}>
                                Turn off the access code
                              </Button>
                            )}
                          </HStack>
                          {settings.sebBypassEnabled && (
                            <Text fontSize="xs" color="lmFg.muted" mt={1}>
                              {sebCode
                                ? 'This code is also on the quiz card and in Live control. Generating a new one replaces it — the old code stops working the moment you do.'
                                : 'A code is active but was minted before codes were kept readable, so it cannot be shown. Generate a new one to see it here.'}
                            </Text>
                          )}
                        </Box>
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </SectionCard>
            </TabPanel>

            {/* ---------- instructions ---------- */}
            <TabPanel px={0}>
              <SectionCard
                title="Instructions"
                subtitle="Shown on the pre-test screen, before any question is handed out. One instruction per line."
              >
                <FormControl mb={4}>
                  <FormLabel fontSize="sm">Title</FormLabel>
                  <Input value={quiz.title} onChange={(e) => set({ title: e.target.value })} />
                </FormControl>
                <FormControl mb={4}>
                  <FormLabel fontSize="sm">Description</FormLabel>
                  <RichTextEditor
                    compact
                    value={quiz.description}
                    onChange={(html) => set({ description: html })}
                    placeholder="What this test covers"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Instruction lines</FormLabel>
                  <Textarea
                    rows={8}
                    value={(quiz.instructions || []).join('\n')}
                    onChange={(e) => set({ instructions: e.target.value.split('\n') })}
                    placeholder={'Keep your ID card on the desk\nUse of a calculator is not permitted\nRaise your hand if the page stops responding'}
                  />
                  <FormHelperText fontSize="xs">
                    The delivery, timing and proctoring rules are described automatically — you only need to add
                    anything specific to your test.
                  </FormHelperText>
                </FormControl>
              </SectionCard>
            </TabPanel>

            {/* ---------- access ---------- */}
            <TabPanel px={0}>
              <SectionCard
                title="Collaborators"
                subtitle="Give another member of staff edit access to this quiz without making them a class teacher."
                mb={4}
              >
                <FormControl>
                  <FormLabel fontSize="sm">Emails</FormLabel>
                  <Textarea
                    rows={3}
                    value={collaboratorEmails}
                    onChange={(e) => setCollaboratorEmails(e.target.value)}
                    placeholder="colleague@nitj.ac.in, another@nitj.ac.in"
                  />
                </FormControl>
                <Button
                  size="sm"
                  mt={3}
                  variant="outline"
                  onClick={async () => {
                    try {
                      const result = await lmApi.setQuizCollaborators(
                        classId,
                        quizId,
                        collaboratorEmails.split(/[\s,;]+/).filter(Boolean),
                      );
                      toast({ status: 'success', title: `${result.collaborators.length} collaborator(s) set` });
                      load();
                    } catch (err) {
                      toast({ status: 'error', title: err.message });
                    }
                  }}
                >
                  Save collaborators
                </Button>
                {quiz.collaborators?.length > 0 && (
                  <HStack mt={3} wrap="wrap">
                    {quiz.collaborators.map((collaborator) => (
                      <Badge key={collaborator.email} colorScheme={collaborator.userId ? 'green' : 'orange'}>
                        {collaborator.email}
                        {collaborator.userId ? '' : ' (no account yet)'}
                      </Badge>
                    ))}
                  </HStack>
                )}
              </SectionCard>

              <SectionCard title="Danger zone" borderColor="lmHue.red200">
                <Flex justify="space-between" align="center" gap={3} wrap="wrap" py={2}>
                  <Box>
                    <Text fontSize="sm" fontWeight="600" color="red.600">
                      Delete all responses
                    </Text>
                    <Text fontSize="xs" color="lmFg.muted">
                      Clears every attempt so the same cohort can sit this test again. Their gradebook entries
                      are reset too.
                    </Text>
                  </Box>
                  <Button
                    size="sm"
                    colorScheme="red"
                    variant="outline"
                    onClick={async () => {
                      // eslint-disable-next-line no-alert
                      if (!window.confirm('Delete every attempt at this quiz? This cannot be undone.')) return;
                      try {
                        const result = await lmApi.deleteQuizResponses(classId, quizId);
                        toast({ status: 'success', title: `${result.deleted} attempt(s) deleted` });
                      } catch (err) {
                        toast({ status: 'error', title: err.message });
                      }
                    }}
                  >
                    Delete responses
                  </Button>
                </Flex>
              </SectionCard>
            </TabPanel>
          </TabPanels>
        </Tabs>
      ) : (
        <Tabs colorScheme="purple" variant="enclosed">
          <TabList>
            <Tab fontSize="sm">Questions ({quiz.questions.length})</Tab>
            <Tab fontSize="sm">Sections ({quiz.sections.length})</Tab>
          </TabList>

          <TabPanels>
            {/* ---------- questions ---------- */}
            <TabPanel px={0}>
              {quiz.questions.map((question, index) => (
                <QuestionCard
                  key={question._id || index}
                  index={index}
                  question={question}
                  sections={quiz.sections}
                  perQuestionTiming={settings.perQuestionTiming}
                  onChange={(updated) =>
                    set({ questions: quiz.questions.map((q, i) => (i === index ? updated : q)) })
                  }
                  onRemove={() => set({ questions: quiz.questions.filter((_, i) => i !== index) })}
                  onDuplicate={() => {
                    const copy = JSON.parse(JSON.stringify(question));
                    delete copy._id;
                    const next = [...quiz.questions];
                    next.splice(index + 1, 0, copy);
                    set({ questions: next });
                  }}
                />
              ))}
              <Flex gap={2} wrap="wrap">
                <Button variant="outline" onClick={addQuestion}>
                  + Add question
                </Button>
                {/* Beside "Add question" rather than in the header: importing one
                    is the same act as writing one, and this is where a teacher is
                    looking when they decide they have written this before. */}
                <Button variant="outline" onClick={openImport} isLoading={saving}>
                  <LmIcon name="import" size={14} style={{ marginRight: 6 }} />
              Import questions
                </Button>
              </Flex>

              {/* The same two actions as the header. A long paper puts the header
                  pair a few screens up, and scrolling back to save is exactly the
                  moment a teacher loses the work they just typed. */}
              <Flex justify="flex-end" gap={2} mt={6} pt={4} borderTopWidth="1px" borderColor="lmBorder.base">
                <Button size="sm" variant="outline" colorScheme="purple" onClick={previewDialog.onOpen}>
                  <LmIcon name="preview" size={14} style={{ marginRight: 6 }} />
            Preview
                </Button>
                <Button size="sm" variant="outline" onClick={save} isLoading={saving}>
                  Save
                </Button>
                <Button size="sm" colorScheme="green" onClick={publish} isDisabled={!quiz.questions.length}>
                  Save &amp; publish
                </Button>
              </Flex>
            </TabPanel>

            {/* ---------- sections ---------- */}
            <TabPanel px={0}>
              <SectionCard
                title="Sections"
                subtitle="Group questions into parts, e.g. Aptitude / Coding. Question order is only ever shuffled inside a section, never across them."
              >
                {quiz.sections.length === 0 && (
                  <Text fontSize="sm" color="lmFg.muted" mb={3}>
                    No sections — every question sits in one flat list.
                  </Text>
                )}
                {quiz.sections.map((section, index) => (
                  <Flex key={section._id || index} gap={2} align="flex-end" mb={3} wrap="wrap">
                    <FormControl maxW="200px">
                      <FormLabel fontSize="xs">Name</FormLabel>
                      <Input
                        size="sm"
                        value={section.name}
                        onChange={(e) =>
                          set({
                            sections: quiz.sections.map((s, i) =>
                              i === index ? { ...s, name: e.target.value } : s,
                            ),
                          })
                        }
                      />
                    </FormControl>
                    <FormControl flex="1" minW="220px">
                      <FormLabel fontSize="xs">Notes shown on the brief</FormLabel>
                      <Input
                        size="sm"
                        value={section.instructions}
                        onChange={(e) =>
                          set({
                            sections: quiz.sections.map((s, i) =>
                              i === index ? { ...s, instructions: e.target.value } : s,
                            ),
                          })
                        }
                      />
                    </FormControl>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      aria-label="Delete section"
                      icon={<LmIcon name="delete" size={15} />}
                      onClick={() => set({ sections: quiz.sections.filter((_, i) => i !== index) })}
                    />
                  </Flex>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    set({
                      sections: [
                        ...quiz.sections,
                        { name: `Section ${quiz.sections.length + 1}`, order: quiz.sections.length, instructions: '' },
                      ],
                    })
                  }
                >
                  + Add section
                </Button>
                <Text fontSize="xs" color="lmFg.muted" mt={3}>
                  Save after adding a section, then assign questions to it from the Questions tab.
                </Text>
              </SectionCard>
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}

      <ImportQuestionsModal
        isOpen={importDialog.isOpen}
        onClose={importDialog.onClose}
        classId={classId}
        type="quiz"
        targetId={quizId}
        partLabel="questions"
        onImported={load}
      />

      <PublishQuizModal
        isOpen={publishDialog.isOpen}
        onClose={closePublish}
        quiz={quiz}
        classId={classId}
        onPublished={async () => {
          setWentLive(true);
          await load();
        }}
      />

      <QuizPreviewModal
        isOpen={previewDialog.isOpen}
        onClose={previewDialog.onClose}
        quiz={quiz}
        classId={classId}
      />
    </Box>
  );
}
