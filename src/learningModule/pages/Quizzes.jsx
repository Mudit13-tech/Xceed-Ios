import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Stack,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
// From emotion, not from '@chakra-ui/react' — Chakra v2 does not re-export
// `keyframes` from its root, and importing a name a module does not export
// fails the whole module, which is a blank page rather than a missing
// animation. Emotion is a declared dependency and Chakra's own styling engine.
import { keyframes } from '@emotion/react';
import lmApi from '../api/lmApi';
import { CopyLinkButton, EmptyState, ErrorState, Loading, SectionCard } from '../components/common';
import PublishQuizModal from '../components/PublishQuizModal';
import { formatDateTime, relativeTime } from '../format';
import { generateQuizPdf } from '../utils/quizPdfGenerator';

// Slow enough to read as "running" rather than "alarm" — this sits in a list a
// teacher scans, not on a monitoring dashboard.
const livePulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
`;

const livePulseGlowGreen = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
    transform: scale(1);
  }
`;

const liveDotBeacon = keyframes`
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.25;
    transform: scale(1.4);
  }
`;

/**
 * The three ways a paper can be run, as one choice.
 *
 * Delivery and timing used to be asked separately, which offered four
 * combinations of which only three exist — the one-page paper cannot enforce a
 * per-question clock — and let a teacher undo their timing decision by changing
 * delivery afterwards. Asking once removes both problems, and the answer is a
 * whole preset: the feedback and proctoring defaults that go with a low-stakes
 * quiz are not the ones that go with an exam. Everything stays editable in the
 * editor afterwards.
 */
const METHODS = {
  quiz: {
    label: 'Quiz — one page, one timer',
    icon: '📝',
    hint: 'All questions on one page, answered in any order, answers shown on submit. One countdown for the whole paper.',
    timerField: 'Time limit for the whole paper (minutes)',
    timerPlaceholder: 'Leave blank for no limit',
    timerHelp: 'Leave blank or 0 for an untimed quiz.',
    // Free navigation is what the one-page paper *is*, so there is nothing to
    // offer here — the checkbox below appears for the other two only.
    canChooseBacktracking: false,
    settings: {
      deliveryMode: 'all_at_once',
      allowBacktracking: true,
      perQuestionTiming: false,
      showAnswersAfterSubmit: true,
      showScoreImmediately: true,
      allowReviewBeforeSubmit: true,
    },
  },
  exam_paper_timer: {
    label: 'Exam — one question at a time, one timer',
    icon: '🎓',
    hint: 'Questions are handed out one at a time with a single countdown over the whole paper. Results are held until you release them.',
    timerField: 'Time limit for the whole paper (minutes)',
    timerPlaceholder: 'e.g. 60',
    timerHelp: 'Leave blank or 0 for an untimed paper.',
    canChooseBacktracking: true,
    settings: {
      deliveryMode: 'one_at_a_time',
      perQuestionTiming: false,
      showAnswersAfterSubmit: false,
      showScoreImmediately: false,
      allowReviewBeforeSubmit: false,
      shuffleQuestions: true,
      shuffleOptions: true,
      allowTabChange: false,
      autoSubmitOnTabLimit: true,
      requireFullscreen: true,
      disableCopyPaste: true,
      disableRightClick: true,
    },
  },
  exam_question_timer: {
    label: 'Exam — one question at a time, a timer on each question',
    icon: '⏱',
    hint: 'Every question carries its own allowance and moves on by itself when it runs out. No overall clock.',
    timerField: 'Seconds per question',
    timerPlaceholder: '60',
    timerHelp: 'Stamped on every question you add — change it per question in the editor.',
    canChooseBacktracking: true,
    settings: {
      deliveryMode: 'one_at_a_time',
      perQuestionTiming: true,
      showAnswersAfterSubmit: false,
      showScoreImmediately: false,
      allowReviewBeforeSubmit: false,
      shuffleQuestions: true,
      shuffleOptions: true,
      disableCopyPaste: true,
      disableRightClick: true,
    },
  },
};

function CreateQuizModal({ isOpen, onClose, classId }) {
  const [method, setMethod] = useState('quiz');
  const [allowBack, setAllowBack] = useState(false);
  // Whether the sitting is watched, which is what decides if the browser may
  // hold the next question. Defaults off: the safe answer for a paper whose
  // conditions nobody has told us about yet.
  const [proctored, setProctored] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const chosen = METHODS[method];

  const reset = () => {
    setMethod('quiz');
    setAllowBack(false);
    setProctored(false);
    setTitle('');
    setDescription('');
    setTimeLimit('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const entered = Number(timeLimit);
      const value = Number.isFinite(entered) && entered > 0 ? entered : 0;
      // The one number in the dialog changes unit with the methodology, so which
      // clock it lands on is decided here rather than by the field.
      const timingSettings = chosen.settings.perQuestionTiming
        ? { timeLimitMinutes: 0, defaultQuestionSec: value || 60 }
        : { timeLimitMinutes: value, defaultQuestionSec: 0 };
      const created = await lmApi.createQuiz(classId, {
        title: title.trim(),
        description: description.trim(),
        settings: {
          ...chosen.settings,
          ...timingSettings,
          ...(chosen.canChooseBacktracking ? { allowBacktracking: allowBack } : {}),
          // Only meaningful one question at a time; on a one-page paper the whole
          // thing is already in the browser and there is nothing to fetch ahead.
          prefetchQuestions: chosen.settings.deliveryMode === 'one_at_a_time' && proctored,
        },
      });
      reset();
      onClose();
      // Straight into the editor — a quiz with no questions cannot be published
      // anyway, so there is nothing useful to come back to the list for.
      navigate(`/learning/class/${classId}/quiz/${created._id}/edit`);
    } catch (error) {
      toast({ status: 'error', title: 'Could not create quiz', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} size="lg">
      <ModalOverlay />
      <ModalContent mt="100px" mb="50px" pt={6} pb={4}>
        <ModalHeader>Create a quiz</ModalHeader>
        <ModalCloseButton top={8} />
        <ModalBody>
          <FormControl isRequired mb={4}>
            <FormLabel fontSize="sm">Title</FormLabel>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Unit 2 — Fourier transforms"
              autoFocus
              onKeyDown={(event) => event.key === 'Enter' && title.trim() && submit()}
            />
          </FormControl>

          <FormControl mb={4}>
            <FormLabel fontSize="sm">Description</FormLabel>
            <Textarea
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Shown to students before they start."
            />
          </FormControl>

          {/* Methodology, its clock and its navigation rule in one block: they
              are one decision, and reading them apart was how a teacher ended up
              with per-question times on twenty questions and only the paper clock
              actually running. */}
          <FormControl>
            <FormLabel fontSize="sm">How this paper runs</FormLabel>
            <RadioGroup
              value={method}
              // The number below changes unit between methodologies, so a value
              // typed for one must not silently carry into another.
              onChange={(value) => {
                setMethod(value);
                setTimeLimit('');
                if (!METHODS[value].canChooseBacktracking) setAllowBack(false);
              }}
            >
              <Stack spacing={3}>
                {Object.entries(METHODS).map(([key, option]) => (
                  <Box
                    key={key}
                    borderWidth="1px"
                    borderColor={method === key ? 'blue.400' : 'lmBorder.base'}
                    bg={method === key ? 'lmHue.blue50' : 'lmBg.surface'}
                    borderRadius="md"
                    px={3}
                    py={2}
                  >
                    <Radio value={key} alignItems="flex-start">
                      <Text fontSize="sm" fontWeight="600">
                        {option.icon} {option.label}
                      </Text>
                      <Text fontSize="xs" color="lmFg.subtle">
                        {option.hint}
                      </Text>
                    </Radio>

                    {/* The clock and the going-back rule sit inside the chosen
                        card, so what is being set is unmistakably a property of
                        the methodology above it rather than a fourth question. */}
                    {method === key && (
                      <Stack spacing={3} mt={3} pt={3} borderTopWidth="1px" borderColor="lmHue.blue200" pl={6}>
                        <FormControl>
                          <FormLabel fontSize="xs">{option.timerField}</FormLabel>
                          <Input
                            size="sm"
                            type="number"
                            min={0}
                            value={timeLimit}
                            onChange={(event) => setTimeLimit(event.target.value)}
                            placeholder={option.timerPlaceholder}
                            maxW="220px"
                            bg="lmBg.surface"
                          />
                          <FormHelperText fontSize="xs">{option.timerHelp}</FormHelperText>
                        </FormControl>

                        {option.canChooseBacktracking && (
                          <Checkbox
                            size="sm"
                            alignItems="flex-start"
                            isChecked={allowBack}
                            onChange={(event) => setAllowBack(event.target.checked)}
                          >
                            <Text fontSize="sm">Let students go back and change earlier answers</Text>
                            <Text fontSize="xs" color="lmFg.subtle">
                              {option.settings.perQuestionTiming
                                ? 'A revisited question resumes with the seconds it had left, so going back cannot buy more time. Off is placement-test behaviour: once you move on, the question is closed.'
                                : 'Off is placement-test behaviour: once you move on, the question is closed.'}
                            </Text>
                          </Checkbox>
                        )}
                      </Stack>
                    )}
                  </Box>
                ))}
              </Stack>
            </RadioGroup>
            <FormHelperText>
              Only one clock ever runs, and every one of these settings stays editable afterwards.
            </FormHelperText>
          </FormControl>

          {/* ---- how much the browser may hold ----
              Only for papers handed out one question at a time. On a one-page
              paper every question is on screen already, so there is nothing to
              fetch ahead and nothing to decide. */}
          {chosen.settings.deliveryMode === 'one_at_a_time' && (
            <FormControl mt={5}>
              <FormLabel fontSize="sm">How this paper is invigilated</FormLabel>
              <RadioGroup value={proctored ? 'proctored' : 'high'} onChange={(v) => setProctored(v === 'proctored')}>
                <Stack spacing={3}>
                  <Box
                    borderWidth="1px"
                    borderColor={proctored ? 'blue.400' : 'lmBorder.base'}
                    bg={proctored ? 'lmHue.blue50' : 'lmBg.surface'}
                    borderRadius="md"
                    px={3}
                    py={2}
                  >
                    <Radio value="proctored" alignItems="flex-start">
                      <Text fontSize="sm" fontWeight="600">👁 Proctored — students are watched</Text>
                      <Text fontSize="xs" color="lmFg.subtle">
                        The next question is loaded quietly while the student reads the current one, so
                        pressing Next is immediate. On a paper that already lets them go back it is sent
                        plainly; otherwise it is encrypted, and the key is only released when they
                        actually reach it — so it cannot be read ahead of time.
                      </Text>
                    </Radio>
                  </Box>

                  <Box
                    borderWidth="1px"
                    borderColor={!proctored ? 'orange.400' : 'lmBorder.base'}
                    bg={!proctored ? 'lmHue.orange50' : 'lmBg.surface'}
                    borderRadius="md"
                    px={3}
                    py={2}
                  >
                    <Radio value="high" alignItems="flex-start">
                      <Text fontSize="sm" fontWeight="600">🔒 High security — nothing loads ahead</Text>
                      <Text fontSize="xs" color="lmFg.subtle">
                        Nothing about the next question reaches the browser until the student has
                        reached it.
                      </Text>
                    </Radio>
                    {/* The cost, next to the choice rather than discovered on exam
                        day by sixty students at once. */}
                    {!proctored && (
                      <Alert status="warning" borderRadius="md" mt={2} py={2} fontSize="xs">
                        <AlertIcon boxSize={3} />
                        <Box>
                          Every question is fetched only when it is asked for, so students will see a
                          pause on each Next — noticeably so on a slow or busy connection, and worst
                          when a whole batch starts together.
                        </Box>
                      </Alert>
                    )}
                  </Box>
                </Stack>
              </RadioGroup>
            </FormControl>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={submit} isLoading={saving} isDisabled={!title.trim()}>
            Create & add questions
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// Teachers get the whole quiz document back; students get a trimmed projection
// that carries questionCount instead of questions, and `window` rather than any
// single "can I start this" flag.
function startState(quiz) {
  // An open sitting outranks everything below it, mirroring the server:
  // `startAttempt` resumes an in-progress attempt before it looks at the window.
  // This is what carries a teacher's reopen through to the student — the case it
  // exists for is a paper that has already closed, or already been sat, so
  // neither may be what turns them away.
  if (quiz.inProgress) return { can: true, why: null };
  // One sitting per student — a submitted paper cannot be taken again.
  if (quiz.attemptsUsed) return { can: false, why: 'Already attempted' };
  if (quiz.window?.notYetOpen) return { can: false, why: 'Not open yet' };
  if (quiz.window?.closed) return { can: false, why: 'Closed' };
  if (quiz.window?.lateToStart) return { can: false, why: 'Start window has passed' };
  return { can: true, why: null };
}

/**
 * Whether a card should say the test is running, and what "finished" means on it.
 *
 * Deliberately different for the two audiences, because "is this live" is a
 * different question depending on who asks:
 *
 *  - a **teacher** wants to know whether anyone is sitting it *right now* — an
 *    open window with nobody in it is not a live test, and it is the middle of a
 *    sitting they may need to intervene in. So `sittingNow` leads, and the open
 *    window is the weaker second answer.
 *  - a **student** wants to know whether it is open to them and whether their
 *    own paper is still going.
 *
 * "Completed" likewise: the cohort's last submission for staff, the student's
 * own submission for them.
 */
function liveState(quiz, isTeacher) {
  const open = quiz.window?.open && (isTeacher ? quiz.published : true);

  if (isTeacher) {
    const sitting = quiz.sittingNow || 0;
    return {
      live: sitting > 0 || Boolean(open),
      label: sitting > 0 ? `Live · ${sitting} sitting now` : 'Live',
      open: Boolean(open && !sitting),
      completedAt: quiz.stats?.lastSubmittedAt || null,
      completedLabel: 'Last submission',
    };
  }

  return {
    live: Boolean(quiz.inProgress || open),
    label: quiz.inProgress ? 'In progress' : 'Live',
    open: Boolean(open && !quiz.inProgress),
    completedAt: quiz.completedAt || null,
    completedLabel: 'You completed this',
  };
}

function QuizRow({ quiz, classId, isTeacher, onPublish, onUnpublish, onDelete }) {
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const toast = useToast();

  const handleDownloadPdf = async (withAnswers) => {
    setDownloadingPdf(withAnswers ? 'answers' : 'questions');
    try {
      const pdfData = await lmApi.exportQuizQuestions(classId, quiz._id, withAnswers);
      generateQuizPdf(pdfData, withAnswers);
      toast({
        status: 'success',
        title: withAnswers ? 'Questions & Answers PDF downloaded' : 'Questions PDF downloaded',
      });
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not download PDF',
        description: err.message || 'An error occurred while generating the PDF.',
      });
    } finally {
      setDownloadingPdf(null);
    }
  };

  const isExam = quiz.settings?.deliveryMode === 'one_at_a_time';
  const questionCount = quiz.questionCount ?? quiz.questions?.length ?? 0;
  const start = isTeacher ? { can: true, why: null } : startState(quiz);
  const scheduled = quiz.publish?.scheduled;
  const opensAt = quiz.settings?.availableFrom;
  const entryCloses = quiz.window?.startDeadline;
  const state = liveState(quiz, isTeacher);
  // A sitting to go back to. Only ever set for a student once results are released.
  const reviewable = !isTeacher && Boolean(quiz.lastAttemptId) && !quiz.resultsPending;

  const isLive = Boolean(state.live || state.open);
  // A reopened paper is not a finished one. The attempt row survives a reopen,
  // so `attemptsUsed` still counts it, and on its own that would show a student
  // whose teacher just gave them more time a finished test with no way back
  // into it. An open sitting therefore vetoes "Completed".
  const isCompleted = !isTeacher
    ? Boolean(!quiz.inProgress && (state.completedAt || quiz.attemptsUsed > 0))
    : Boolean(state.completedAt || (quiz.stats?.attempts > 0 && quiz.window?.closed));

  return (
    <Flex
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor={isLive ? 'green.400' : 'lmBorder.base'}
      boxShadow={isLive ? '0 2px 12px -2px rgba(34, 197, 94, 0.25)' : 'none'}
      borderRadius="lg"
      p={4}
      mb={3}
      align="center"
      gap={4}
      wrap="wrap"
      transition="all 0.2s ease"
    >
      <Box flex="1" minW="220px">
        <HStack spacing={2} wrap="wrap">
          <Heading size="sm">{quiz.title}</Heading>
          <Badge colorScheme={isExam ? 'red' : 'blue'}>{isExam ? '🎓 Exam' : '📝 Quiz'}</Badge>
          {quiz.source === 'ai' && <Badge colorScheme="purple">✨ AI</Badge>}
          {isTeacher && (
            <Badge colorScheme={scheduled ? 'orange' : quiz.published ? 'green' : 'gray'}>
              {scheduled ? 'Scheduled' : quiz.published ? 'Published' : 'Draft'}
            </Badge>
          )}
          {/* Animated Green LIVE Button in Card Header */}
          {isLive && !isCompleted && (
            <Button
              as={RouterLink}
              to={
                isTeacher
                  ? `/learning/class/${classId}/quiz/${quiz._id}/results`
                  : `/learning/class/${classId}/quiz/${quiz._id}`
              }
              size="xs"
              colorScheme="green"
              variant="solid"
              borderRadius="full"
              px={3}
              py={1}
              h="auto"
              leftIcon={
                <Box
                  as="span"
                  w="7px"
                  h="7px"
                  bg="lmBg.surface"
                  borderRadius="full"
                  display="inline-block"
                  sx={{ animation: `${liveDotBeacon} 1.2s ease-in-out infinite` }}
                />
              }
              sx={{
                animation: `${livePulseGlowGreen} 1.8s ease-in-out infinite`,
                fontWeight: 'bold',
                letterSpacing: '0.4px',
                _hover: { textDecoration: 'none', transform: 'scale(1.05)' },
              }}
            >
              🟢 {state.label || 'Live'}
            </Button>
          )}

          {/* Completed badge */}
          {isCompleted && (
            <Badge colorScheme="blue" variant="subtle" borderRadius="full" px={2.5} py={0.5}>
              ✅ Completed
            </Badge>
          )}
        </HStack>
        {isTeacher && (scheduled || opensAt || entryCloses) && (
          <Text fontSize="xs" color="lmFg.subtle" mt={1}>
            {[
              scheduled && `🔗 Link goes live ${formatDateTime(quiz.publish.publishAt)}`,
              opensAt && `▶️ Starts ${formatDateTime(opensAt)}`,
              entryCloses && `🚪 Entry closes ${formatDateTime(entryCloses)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
        <Text fontSize="xs" color="lmFg.muted" mt={1}>
          {questionCount} questions · {quiz.totalMarks} marks
          {quiz.settings?.timeLimitMinutes ? ` · ${quiz.settings.timeLimitMinutes} min` : ''}
        </Text>

        {/* Shown to students and staff alike. For a student it answers "did my
            submission actually register?", which is the question they otherwise
            ask a teacher; for staff it is when the cohort finished, which a
            scheduled window does not tell them. */}
        {state.completedAt && (
          <Tooltip label={formatDateTime(state.completedAt)}>
            <Text fontSize="xs" color="lmHue.green700" mt={1} fontWeight="500" display="inline-block">
              ✅ {state.completedLabel} {relativeTime(state.completedAt)} ·{' '}
              {formatDateTime(state.completedAt)}
            </Text>
          </Tooltip>
        )}
        {!state.completedAt && !state.live && quiz.window?.closed && (
          <Text fontSize="xs" color="lmFg.muted" mt={1}>
            🔒 Closed {relativeTime(quiz.window.closesAt)} · {formatDateTime(quiz.window.closesAt)}
          </Text>
        )}
        {isTeacher && quiz.stats && (
          <Text fontSize="xs" color="lmFg.muted">
            {quiz.stats.attempts} attempt(s)
            {quiz.stats.avg !== null && quiz.stats.avg !== undefined
              ? ` · avg ${Math.round(quiz.stats.avg * 10) / 10}%`
              : ''}
          </Text>
        )}
        {!isTeacher && quiz.bestAttempt && (
          <Badge colorScheme={quiz.bestAttempt.passed ? 'green' : 'red'} mt={1}>
            Best: {quiz.bestAttempt.score}/{quiz.bestAttempt.maxScore} ({quiz.bestAttempt.percent}%)
          </Badge>
        )}
        {!isTeacher && quiz.resultsPending && (
          <Badge colorScheme="orange" mt={1}>
            {quiz.resultReleaseAt
              ? `Results announced ${formatDateTime(quiz.resultReleaseAt)}`
              : 'Results not released yet'}
          </Badge>
        )}
        {/* Stays up until they open it — the same marker the class card
            carries, and the same thing clears both. */}
        {!isTeacher && quiz.resultsUnread && (
          <Badge colorScheme="green" mt={1} ml={1}>
            🎯 Results announced — not seen yet
          </Badge>
        )}
        {!isTeacher && start.why && (
          <Text fontSize="xs" color="lmFg.muted" mt={1}>
            {start.why}
          </Text>
        )}
      </Box>

      <Flex gap={2} wrap="wrap" align="center" maxW="100%">
        <Menu>
          <MenuButton
            as={Button}
            size="sm"
            variant="outline"
            colorScheme="purple"
            isLoading={Boolean(downloadingPdf)}
          >
            📄 PDF ▾
          </MenuButton>
          <MenuList zIndex={10}>
            <MenuItem
              isDisabled={downloadingPdf === 'questions'}
              onClick={() => handleDownloadPdf(false)}
            >
              📝 Questions Only
            </MenuItem>
            <MenuItem
              isDisabled={downloadingPdf === 'answers'}
              onClick={() => handleDownloadPdf(true)}
            >
              💡 Questions with Answers
            </MenuItem>
          </MenuList>
        </Menu>

        {isTeacher ? (
          <>
            <Button as={RouterLink} to={`/learning/class/${classId}/quiz/${quiz._id}/edit`} size="sm" variant="outline">
              Edit
            </Button>

            {isLive ? (
              <Button
                as={RouterLink}
                to={`/learning/class/${classId}/quiz/${quiz._id}/results`}
                size="sm"
                colorScheme="green"
                sx={{
                  animation: `${livePulseGlowGreen} 1.8s ease-in-out infinite`,
                  fontWeight: 'bold',
                }}
              >
                🟢 Results {quiz.sittingNow ? `(${quiz.sittingNow} live)` : ''}
              </Button>
            ) : (
              <Button as={RouterLink} to={`/learning/class/${classId}/quiz/${quiz._id}/results`} size="sm" variant="outline">
                Results
              </Button>
            )}

            {/* Only once published: the link resolves to the student brief, which
                a draft quiz will not serve to anyone but its author. */}
            {quiz.published && <CopyLinkButton to={`/learning/class/${classId}/quiz/${quiz._id}`} />}
            {quiz.published ? (
              <>
                <Button size="sm" variant="outline" onClick={onPublish}>
                  🗓 Schedule
                </Button>
                <Button size="sm" colorScheme="gray" onClick={onUnpublish}>
                  Unpublish
                </Button>
              </>
            ) : (
              <Button size="sm" colorScheme="green" onClick={onPublish}>
                Publish
              </Button>
            )}
            <Button size="sm" variant="ghost" colorScheme="red" onClick={onDelete} aria-label="Delete quiz">
              ✕
            </Button>
          </>
        ) : (
          <>
            {/* An open sitting comes first: a student whose paper is live —
                including one their teacher has just reopened or extended — needs
                the door back into it, not a verdict on a test they have not
                finished. */}
            {quiz.inProgress ? (
              <Button
                as={RouterLink}
                to={`/learning/class/${classId}/quiz/${quiz._id}`}
                size="sm"
                colorScheme="green"
                sx={{ animation: `${livePulseGlowGreen} 1.8s ease-in-out infinite`, fontWeight: 'bold' }}
              >
                Resume test
              </Button>
            ) : reviewable ? (
              <Button
                as={RouterLink}
                to={`/learning/class/${classId}/quiz/${quiz._id}/attempt/${quiz.lastAttemptId}`}
                size="sm"
                colorScheme={quiz.resultsUnread ? 'green' : 'blue'}
                variant={quiz.resultsUnread ? 'solid' : 'outline'}
                leftIcon={<span>🎯</span>}
                sx={
                  quiz.resultsUnread
                    ? {
                        animation: `${livePulseGlowGreen} 1.8s ease-in-out infinite`,
                        fontWeight: 'bold',
                      }
                    : undefined
                }
              >
                {quiz.resultsUnread ? 'See your result' : 'View Result'}
              </Button>
            ) : quiz.resultsPending ? (
              <Tooltip label="Your teacher has not released the results for this test yet.">
                <Button size="sm" variant="outline" colorScheme="orange" isDisabled>
                  🔒 Results pending
                </Button>
              </Tooltip>
            ) : (
              <Button
                as={RouterLink}
                to={
                  quiz.attemptsUsed > 0 && quiz.lastAttemptId
                    ? `/learning/class/${classId}/quiz/${quiz._id}/attempt/${quiz.lastAttemptId}`
                    : `/learning/class/${classId}/quiz/${quiz._id}`
                }
                size="sm"
                colorScheme={
                  isLive || start.can
                    ? 'green'
                    : 'purple'
                }
                sx={
                  isLive && start.can && !isCompleted
                    ? {
                        animation: `${livePulseGlowGreen} 1.8s ease-in-out infinite`,
                        fontWeight: 'bold',
                      }
                    : undefined
                }
              >
                {quiz.attemptsUsed > 0
                  ? 'Review answers'
                  : start.can
                    ? 'Start test'
                    : 'View instructions'}
              </Button>
            )}
          </>
        )}
      </Flex>
    </Flex>
  );
}

/**
 * Quizzes and exams live on their own tab rather than inside Classwork: they
 * are authored in a dedicated editor, published on their own schedule, and the
 * classwork item is only the announcement of an already-built paper.
 */
export default function Quizzes() {
  const { classId, isTeacher } = useOutletContext();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const publishDialog = useDisclosure();
  const toast = useToast();

  const load = useCallback(async () => {
    setError(null);
    try {
      setQuizzes(await lmApi.listQuizzes(classId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  // Publishing goes through the dialog — it is where the two clocks are set and
  // where the link comes back. Unpublishing needs neither, so it stays direct.
  const openPublish = (quiz) => {
    setPublishing(quiz);
    publishDialog.onOpen();
  };

  const unpublish = async (quiz) => {
    try {
      await lmApi.publishQuiz(classId, quiz._id, { publish: false });
      toast({ status: 'success', title: 'Quiz unpublished' });
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  const remove = async (quiz) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${quiz.title}" and all its attempts?`)) return;
    try {
      await lmApi.deleteQuiz(classId, quiz._id);
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  if (loading) return <Loading label="Loading quizzes…" />;

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
        <Box>
          <Heading size="md" color="lmFg.heading">
            Quizzes & exams
          </Heading>
          <Text fontSize="sm" color="lmFg.muted">
            {isTeacher
              ? 'Build a paper here, then publish it to the class.'
              : 'Everything your teacher has published.'}
          </Text>
        </Box>
        {isTeacher && (
          <HStack>
            <Button as={RouterLink} to={`/learning/class/${classId}/studio`} size="sm" variant="outline">
              ✨ Generate from a recording
            </Button>
            <Button colorScheme="blue" size="sm" onClick={onOpen}>
              + Create quiz
            </Button>
          </HStack>
        )}
      </Flex>

      <ErrorState error={error} onRetry={load} />

      <SectionCard>
        {quizzes.length === 0 ? (
          <EmptyState
            icon="🧠"
            title="No quizzes yet"
            description={
              isTeacher
                ? 'Create one from scratch, or generate it from a class recording in the AI Studio.'
                : 'Your teacher has not published any quizzes.'
            }
            action={
              isTeacher ? (
                <Button size="sm" colorScheme="blue" onClick={onOpen}>
                  Create a quiz
                </Button>
              ) : null
            }
          />
        ) : (
          quizzes.map((quiz) => (
            <QuizRow
              key={quiz._id}
              quiz={quiz}
              classId={classId}
              isTeacher={isTeacher}
              onPublish={() => openPublish(quiz)}
              onUnpublish={() => unpublish(quiz)}
              onDelete={() => remove(quiz)}
            />
          ))
        )}
      </SectionCard>

      <CreateQuizModal isOpen={isOpen} onClose={onClose} classId={classId} />
      <PublishQuizModal
        isOpen={publishDialog.isOpen}
        onClose={publishDialog.onClose}
        quiz={publishing}
        classId={classId}
        onPublished={load}
      />
    </Box>
  );
}
