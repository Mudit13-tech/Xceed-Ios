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
  IconButton,
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
import { DeleteIcon, DownloadIcon, SettingsIcon, TimeIcon } from '@chakra-ui/icons';
import lmApi from '../api/lmApi';
import LiveExamControl, { LiveCounts } from '../components/liveExam';
import AttendanceControl from '../components/attendanceControl';
import AccessCodeButton from '../components/AccessCodeButton';
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
    hint: 'Questions are handed out one at a time with a single countdown over the whole paper. Each student sees their score as they submit; the worked answers stay held back until you release them.',
    timerField: 'Time limit for the whole paper (minutes)',
    timerPlaceholder: 'e.g. 60',
    timerHelp: 'Leave blank or 0 for an untimed paper.',
    canChooseBacktracking: true,
    settings: {
      deliveryMode: 'one_at_a_time',
      perQuestionTiming: false,
      // The score and the worked answers are two different questions to a
      // student — "how did I do" versus "what were the right answers" — and
      // an exam has reason to withhold only the second: the answer key is
      // reusable by whoever sits a make-up paper later, a raw mark is not.
      // Both stay editable per quiz from the Marking tab.
      showAnswersAfterSubmit: false,
      showScoreImmediately: true,
      allowReviewBeforeSubmit: false,
      shuffleQuestions: true,
      shuffleOptions: true,
      // Fullscreen and the submit-on-leaving rule are no longer per-quiz — they
      // apply to every paper — so the preset only carries what still varies.
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
      // See the note on the other exam preset — the score and the answer key
      // are withheld on two different grounds, and only the second is what an
      // exam actually has reason to hold back by default.
      showAnswersAfterSubmit: false,
      showScoreImmediately: true,
      allowReviewBeforeSubmit: false,
      shuffleQuestions: true,
      shuffleOptions: true,
      disableCopyPaste: true,
      disableRightClick: true,
    },
  },
};

function CreateQuizModal({ isOpen, onClose, classId }) {
  // Defaults to the invigilated exam preset: that is what this dialog is used
  // for in practice, and the low-stakes quiz is a click away for the rest.
  const [method, setMethod] = useState('exam_paper_timer');
  const [allowBack, setAllowBack] = useState(false);
  // Whether the sitting is watched, which is what decides if the browser may
  // hold the next question. Defaults on to match the exam preset above.
  const [proctored, setProctored] = useState(true);
  // Recorded here, finished in the editor: the .seb file cannot be built until
  // the quiz has a URL, which it does not have until it exists.
  const [requireSeb, setRequireSeb] = useState(true);
  // Whether the institution already has a shared .seb file and Config Key on the
  // server. `null` while unknown: with one file serving every exam, telling a
  // teacher to go and build one they do not need is the common case now, so the
  // instruction below waits until the answer is in rather than defaulting to it.
  const [sharedSebReady, setSharedSebReady] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  // Asked only when the box is ticked, and only once the dialog is open: it is
  // a module-level fact, not worth a request from every teacher who never
  // touches Safe Exam Browser.
  useEffect(() => {
    if (!isOpen || !requireSeb || sharedSebReady !== null) return undefined;
    let cancelled = false;
    lmApi
      .getSharedSebConfig()
      .then((res) => {
        if (!cancelled) setSharedSebReady(Boolean(res?.ready));
      })
      .catch(() => {
        // A failed lookup must not hide the instruction: unknown is treated as
        // "not set up", which is the state that still needs the teacher.
        if (!cancelled) setSharedSebReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, requireSeb, sharedSebReady]);

  const chosen = METHODS[method];

  const reset = () => {
    setMethod('exam_paper_timer');
    setAllowBack(false);
    setProctored(true);
    setRequireSeb(true);
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
          requireSafeExamBrowser: requireSeb,
          // Always on with SEB: the student whose laptop cannot run SEB on the
          // day is a known case, not an exception to opt into, so the paper is
          // created with a code already minted and the teacher only has to hand
          // it out. Turn it off in the editor → Proctoring if a paper must be
          // SEB-only.
          sebBypassEnabled: requireSeb,
        },
      });
      reset();
      onClose();
      // The plaintext exists in this response and nowhere else, and the editor
      // opens on the questions tab — so it is said here too, and stays on screen
      // until the teacher dismisses it rather than fading out unread.
      if (created.sebBypassCode) {
        toast({
          status: 'success',
          title: `Access code: ${created.sebBypassCode}`,
          description:
            'Copy this now — it is not shown again. Hand it to a student who cannot run Safe Exam Browser. You can replace or turn it off in the editor → Proctoring.',
          duration: null,
          isClosable: true,
        });
      }
      // Straight into the editor — a quiz with no questions cannot be published
      // anyway, so there is nothing useful to come back to the list for.
      navigate(`/learning/class/${classId}/quiz/${created._id}/edit`, {
        // The access code is in this response and nowhere else, ever again.
        state: created.sebBypassCode ? { sebBypassCode: created.sebBypassCode } : undefined,
      });
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

          {/* ---- Safe Exam Browser ----
              Decided here because it is a property of how the paper is *sat*,
              which is the question this dialog exists to ask. What cannot happen
              here is the setup itself: the .seb file is built in SEB's own
              Configuration Tool against the exam's URL, and that URL does not
              exist until this quiz does. So this records the intent and the
              editor finishes the job — with the paper refusing to be sat until
              it is finished, rather than letting a class arrive at a locked
              door. */}
          <FormControl mt={5}>
            <FormLabel fontSize="sm">Safe Exam Browser</FormLabel>
            <Checkbox
              size="sm"
              alignItems="flex-start"
              isChecked={requireSeb}
              onChange={(event) => setRequireSeb(event.target.checked)}
            >
              <Text fontSize="sm">Require Safe Exam Browser to sit this paper</Text>
              <Text fontSize="xs" color="lmFg.subtle">
                A locked-down kiosk browser that refuses to run alongside anything else — the
                strongest lockdown available, and the only one a second application cannot sit on
                top of.
              </Text>
            </Checkbox>

            {requireSeb && (
              <Box mt={2} pl={6}>
                <Text fontSize="xs" color="lmFg.subtle">
                  An access code is generated with the paper, so a student whose laptop cannot run
                  SEB on the day can still start from an ordinary browser with a code you hand out
                  yourself. Every use is recorded on the attempt, and the code is shown to you in
                  the editor → Proctoring, where you can replace or turn it off.
                </Text>

                {sharedSebReady === false ? (
                  <Alert status="info" borderRadius="md" mt={3} py={2} fontSize="xs">
                    <AlertIcon boxSize={3} />
                    <Box>
                      <b>One more step after this.</b> Open the quiz editor → Proctoring, and upload
                      the <code>.seb</code> file from SEB&apos;s Configuration Tool along with the
                      Config Key it shows you — or ask an administrator to set the shared one up
                      once for everybody. Students cannot start until that is done.
                    </Box>
                  </Alert>
                ) : null}
              </Box>
            )}
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

/** Which build a person most likely needs, guessed from the browser they asked in. */
const isAppleDevice = () => /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || navigator.platform || '');

/**
 * Safe Exam Browser itself, offered from the quiz list rather than only from a
 * single paper's brief.
 *
 * The brief already carries this (`SebInstallerLinks` in `QuizBrief.jsx`), but
 * it is the wrong moment: a student reaches it when a proctored test is about
 * to start, which is the worst time to discover they have a 100MB install
 * ahead of them. Here it sits on the page they open days earlier, and a
 * teacher checking their own setup can reach it without opening a paper.
 *
 * Deliberately unconditional on any quiz: this asks "does this computer have
 * SEB" — nothing about which papers require it — and it disappears entirely
 * when no installer has been uploaded, so an installation that does not use
 * SEB never sees it.
 */
function SebInstallerDownload() {
  const [installers, setInstallers] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Started inside a resolved promise so a server or client that has no such
    // endpoint at all fails the same quiet way a failed request does, rather
    // than throwing out of the effect and taking the quiz list down with it.
    Promise.resolve()
      .then(() => lmApi.getSebInstallers())
      // Nothing configured, or the request failed — either way there is nothing
      // to offer and no error worth putting in a toolbar.
      .then((result) => { if (!cancelled) setInstallers(result); })
      .catch(() => { if (!cancelled) setInstallers(false); });
    return () => { cancelled = true; };
  }, []);

  if (!installers) return null;

  const mac = isAppleDevice();
  const primary = mac ? 'mac' : 'windows';
  const secondary = mac ? 'windows' : 'mac';
  const label = { windows: 'Windows', mac: 'Mac' };
  const platforms = [primary, secondary].filter((p) => installers[p]?.available);
  if (platforms.length === 0) return null;

  // One build available is a plain link; both is a menu, so the common case
  // stays a single click and the other machine is still one hop away.
  if (platforms.length === 1) {
    return (
      <Button
        as="a"
        href={lmApi.sebInstallerDownloadUrl(platforms[0])}
        size="sm"
        variant="outline"
        colorScheme="purple"
        leftIcon={<DownloadIcon />}
      >
        Safe Exam Browser ({label[platforms[0]]})
      </Button>
    );
  }

  return (
    <Menu>
      <MenuButton as={Button} size="sm" variant="outline" colorScheme="purple" leftIcon={<DownloadIcon />}>
        Safe Exam Browser
      </MenuButton>
      <MenuList>
        {platforms.map((p) => (
          <MenuItem key={p} as="a" href={lmApi.sebInstallerDownloadUrl(p)}>
            Download for {label[p]}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
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

function QuizRow({ quiz, classId, isTeacher, onPublish, onUnpublish, onDelete, onRefresh }) {
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

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
  /* The paper as a PDF, offered only where the server will actually hand it over.
   *
   * This menu used to render for everyone on every row, which is where the quiz
   * id and the export URL came from in the first place — a student had the link
   * to an unsat paper sitting on their own quiz list. The server is the check
   * (see exportQuestions); this stops the row advertising a download that is
   * now a 403, and stops handing out the address of one. */
  const canDownloadPaper = isTeacher || Boolean(quiz.lastAttemptId);
  const canDownloadKey =
    isTeacher || (canDownloadPaper && quiz.resultsReleased && quiz.settings?.showAnswersAfterSubmit);

  const isLive = Boolean(state.live || state.open);
  /* Whether the paper has begun, which is when invigilation starts being the
   * thing a teacher wants from this row.
   *
   * Deliberately not the same as `isLive`: it stays true after the window shuts,
   * because a student who was thrown out at the end is let back in *after* the
   * hall has emptied, and that is the one moment the control would otherwise
   * disappear. A scheduled paper that has not opened yet has nobody to watch. */
  const hasStarted =
    isTeacher && Boolean(quiz.published) && !scheduled && !quiz.window?.notYetOpen;
  // Where "this is running" leads: the monitor for staff, the paper for a student.
  const liveTarget = isTeacher
    ? `/learning/class/${classId}/quiz/${quiz._id}/results`
    : `/learning/class/${classId}/quiz/${quiz._id}`;
  // A reopened paper is not a finished one. The attempt row survives a reopen,
  // so `attemptsUsed` still counts it, and on its own that would show a student
  // whose teacher just gave them more time a finished test with no way back
  // into it. An open sitting therefore vetoes "Completed".
  const isCompleted = !isTeacher
    ? Boolean(!quiz.inProgress && (state.completedAt || quiz.attemptsUsed > 0))
    : Boolean(state.completedAt || (quiz.stats?.attempts > 0 && quiz.window?.closed));

  /* The paper as a download, as an icon rather than a labelled menu.
   *
   * It used to open the row from the left at full width, which put the least
   * used control on the card in the most prominent place on it — ahead of Edit,
   * Results and the live state — on every row, for every teacher, all term. As
   * an icon beside Delete it is exactly as reachable and stops competing. The
   * menu underneath is unchanged: the two documents are different documents, and
   * one of them carries the answer key. */
  const downloadMenu = canDownloadPaper && (
    <Menu>
      <Tooltip label="Download the paper">
        <MenuButton
          as={IconButton}
          size="sm"
          variant="ghost"
          colorScheme="purple"
          aria-label="Download the paper"
          icon={<DownloadIcon />}
          isLoading={Boolean(downloadingPdf)}
        />
      </Tooltip>
      <MenuList zIndex={10}>
        <MenuItem isDisabled={downloadingPdf === 'questions'} onClick={() => handleDownloadPdf(false)}>
          📝 Questions Only
        </MenuItem>
        {canDownloadKey && (
          <MenuItem isDisabled={downloadingPdf === 'answers'} onClick={() => handleDownloadPdf(true)}>
            💡 Questions with Answers
          </MenuItem>
        )}
      </MenuList>
    </Menu>
  );

  /* Every wordless control in one group, pinned to the top corner of the card.
     Scattered between the labelled buttons they read as gaps in a sentence — a
     teacher scanning the row for "Results" had to look past a gear and a clock
     to find it. On their own line above, they are a toolbar: settings,
     schedule, download, delete, in the order they are reached for, and the
     labelled buttons keep the right-hand side to themselves. */
  const iconTools = isTeacher ? (
    <>
      <Tooltip label="Settings — delivery, marking, proctoring, instructions and access">
        <IconButton
          as={RouterLink}
          to={`/learning/class/${classId}/quiz/${quiz._id}/settings`}
          size="sm"
          variant="ghost"
          aria-label="Quiz settings"
          icon={<SettingsIcon />}
        />
      </Tooltip>
      {quiz.published && (
        <Tooltip label="Schedule — when it opens, when entry closes, when results go out">
          <IconButton
            size="sm"
            variant="ghost"
            onClick={onPublish}
            aria-label="Schedule quiz"
            icon={<TimeIcon />}
          />
        </Tooltip>
      )}
      {downloadMenu}
      <IconButton
        size="sm"
        variant="ghost"
        colorScheme="red"
        onClick={onDelete}
        aria-label="Delete quiz"
        icon={<DeleteIcon />}
      />
    </>
  ) : (
    downloadMenu
  );

  // The click-through, spread onto both halves of the card body: the title line
  // and the detail beneath it are one target split in two by the toolbar.
  const bodyLink = isLive
    ? { onClick: () => navigate(liveTarget), cursor: 'pointer', role: 'link' }
    : {};

  return (
    <Flex
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor={isLive ? 'green.400' : 'lmBorder.base'}
      boxShadow={isLive ? '0 2px 12px -2px rgba(34, 197, 94, 0.25)' : 'none'}
      borderRadius="lg"
      p={4}
      mb={3}
      direction="column"
      align="stretch"
      gap={2}
      transition="all 0.2s ease"
    >
      {/* The title line, with the icon toolbar on the end of it: wordless
          controls belong in the card's top corner, level with the name of the
          paper they act on, not on a line of their own. */}
      <Flex align="flex-start" gap={3}>
        <Box flex="1" minW="220px" {...bodyLink}>
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
                to={liveTarget}
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
        </Box>
        {iconTools && (
          <HStack spacing={1} mt={-1} mr={-1}>
            {iconTools}
          </HStack>
        )}
      </Flex>

      <Flex align="center" gap={4} wrap="wrap">
        {/* While it is running, the card is the way in: the whole body is the
            link to the live page (teachers to the monitor, students to the
            paper), not just the pill in its corner. Only the body — the action
            buttons to the right keep their own destinations. */}
        <Box flex="1" minW="220px" {...bodyLink}>
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
          {/* Terminated first — see `LiveCounts`. It is the only one of the three
              that is a person waiting on a decision from staff. */}
          {hasStarted && <LiveCounts live={quiz.live} />}
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
          {isTeacher ? (
            <>
              {/* First while the exam is on, because mid-exam it is the only
                  control on this row anybody wants — and it is on the row rather
                  than three pages away on the results screen, which is where it
                  used to be. */}
              {hasStarted && (
                <LiveExamControl classId={classId} quiz={quiz} live={quiz.live} onDone={onRefresh} />
              )}
              {/* Beside it, and only once the paper has begun for the same
                  reason: a register is taken in the hall, and there is no hall
                  before the exam opens. */}
              {hasStarted && (
                <AttendanceControl classId={classId} quiz={quiz} onDone={onRefresh} />
              )}
              <Button as={RouterLink} to={`/learning/class/${classId}/quiz/${quiz._id}/edit`} size="sm" variant="outline">
                Edit
              </Button>

              {/* Always the same quiet Results button. The live state already has
                  its own loud control — the LIVE pill in the card header, and the
                  card body itself — so pulsing this one too said "live" three
                  times and dressed up results as something they are not. */}
              <Button as={RouterLink} to={`/learning/class/${classId}/quiz/${quiz._id}/results`} size="sm" variant="outline">
                Results
              </Button>

              {/* Only once published: the link resolves to the student brief, which
                  a draft quiz will not serve to anyone but its author. */}
              {quiz.published && <CopyLinkButton to={`/learning/class/${classId}/quiz/${quiz._id}`} />}
              {quiz.published ? (
                <Button size="sm" colorScheme="gray" onClick={onUnpublish}>
                  Unpublish
                </Button>
              ) : (
                <Button size="sm" colorScheme="green" onClick={onPublish}>
                  Publish
                </Button>
              )}
              {/* Only where there is a lockdown for it to unlock. */}
              {quiz.published && quiz.settings?.requireSafeExamBrowser && (
                <AccessCodeButton classId={classId} quiz={quiz} onDone={onRefresh} />
              )}
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
        {/* Students get this row too, for the SEB installer alone: they have no
            other route to it that does not start with a test about to begin. */}
        <HStack>
          <SebInstallerDownload />
          {isTeacher && (
            <>
            <Button as={RouterLink} to={`/learning/class/${classId}/studio`} size="sm" variant="outline">
              ✨ Generate from a recording
            </Button>
            <Button
              as="a"
              href="/learning/quizmanual"
              target="_blank"
              rel="noreferrer"
              size="sm"
              variant="outline"
              colorScheme="teal"
              borderWidth="2px"
              fontWeight="semibold"
            >
              📖 Manual
            </Button>
            <Button colorScheme="blue" size="sm" onClick={onOpen}>
              + Create quiz
            </Button>
            </>
          )}
        </HStack>
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
              onRefresh={load}
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
