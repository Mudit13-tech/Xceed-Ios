import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Heading,
  List,
  ListIcon,
  ListItem,
  Input,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { sebDiagnosis } from '../sebDiagnosis';
import QuizStage from '../components/QuizStage';
import RichText from '../components/RichText';
import { ErrorState, Loading, SectionCard, StatTile } from '../components/common';
import { formatDateTime } from '../format';
import useProctoring, { isMobileDevice } from '../hooks/useProctoring';

const formatDuration = (seconds) => {
  if (!seconds) return 'No limit';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return secs ? `${mins}m ${secs}s` : `${mins} min`;
};

const useCountdown = (target) => {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!target) {
      setRemaining(null);
      return undefined;
    }
    const tick = () => setRemaining(Math.max(0, Math.round((new Date(target) - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target]);

  return remaining;
};

/**
 * The clock a waiting student actually watches, given its own block rather than
 * a line inside an alert — on a fullscreen brief this is the one thing on the
 * page that changes, and it has to be readable from a desk away.
 */
function CountdownPanel({ label, seconds, note, accent }) {
  const parts = [
    { unit: 'hrs', value: Math.floor(seconds / 3600) },
    { unit: 'min', value: Math.floor((seconds % 3600) / 60) },
    { unit: 'sec', value: seconds % 60 },
  ];

  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor={`${accent}.200`}
      borderLeftWidth="4px"
      borderLeftColor={`${accent}.400`}
      borderRadius="lg"
      p={4}
      mb={4}
    >
      <Text
        fontSize="xs"
        fontWeight="700"
        textTransform="uppercase"
        letterSpacing="wide"
        color={`${accent}.600`}
      >
        {label}
      </Text>
      <HStack spacing={2} mt={2} role="timer" aria-live="off">
        {parts.map((part) => (
          <Box key={part.unit} bg={`${accent}.50`} borderRadius="md" px={3} py={2} minW="68px" textAlign="center">
            <Text fontSize="2xl" fontWeight="700" fontFamily="mono" lineHeight="1.1" color={`${accent}.700`}>
              {String(part.value).padStart(2, '0')}
            </Text>
            <Text fontSize="0.6rem" color="lmFg.muted" textTransform="uppercase" letterSpacing="wide">
              {part.unit}
            </Text>
          </Box>
        ))}
      </HStack>
      {note && (
        <Text fontSize="sm" color="lmFg.subtle" mt={2}>
          {note}
        </Text>
      )}
    </Box>
  );
}

/**
 * The pre-test screen: rules, timings and eligibility, shown before a single
 * question is handed out. Starting is a deliberate action because for a
 * one-at-a-time paper the clock begins immediately and cannot be paused.
 *
 * It runs on the shared quiz stage, so the instructions fill the screen the
 * same way the paper will — and the fullscreen the student is granted here
 * carries straight through into the sitting.
 */
export default function QuizBrief() {
  const { classId, klass, isTeacher } = useOutletContext();
  const { quizId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  // Why the last Start was refused. Cleared on the next attempt, so a stale
  // reason never sits under a fresh click.
  const [startError, setStartError] = useState('');
  // The `seb://` address for this student, once the server has minted a token
  // for it. Empty until then, and empty for good on a paper that does not use SEB.
  const [sebLaunch, setSebLaunch] = useState('');
  // The Safe Exam Browser fallback. Kept local, not sent anywhere until the
  // student actually presses Start — a code typed and abandoned should not be
  // reported the way a wrong guess would.
  const [sebCode, setSebCode] = useState('');
  const [showSebCode, setShowSebCode] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBrief(await lmApi.quizBrief(classId, quizId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, quizId]);

  useEffect(() => {
    load();
  }, [load]);

  /* The launch address, once the brief says this paper uses SEB and is ready.
     Not assembled client-side: it carries a short-lived token minted for this
     student, because SEB fetches the settings with its own network stack and
     none of this session — which is why pointing the link at the ordinary
     endpoint produced a 401 while the file download beside it worked. */
  useEffect(() => {
    const settings = brief?.settings;
    if (!settings?.requireSafeExamBrowser || !settings?.sebReady || isTeacher) return undefined;
    let cancelled = false;
    lmApi
      .sebLaunchToken(classId, quizId)
      .then((result) => {
        if (!cancelled && result?.token) setSebLaunch(lmApi.sebLaunchUrlFromToken(result.token));
      })
      // A token we could not mint costs the one-click launch and nothing else;
      // the download beneath it is the same file by the longer road.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brief?.settings, classId, quizId, isTeacher]);

  const opensIn = useCountdown(brief?.window?.notYetOpen ? brief.window.opensAt : null);
  const startDeadlineIn = useCountdown(
    brief?.window?.canStart && brief?.window?.startDeadline ? brief.window.startDeadline : null,
  );

  // Refresh once the quiz opens so the Start button becomes live without a
  // manual reload.
  useEffect(() => {
    if (opensIn === 0) load();
  }, [opensIn, load]);

  // The brief is already on the fullscreen stage, so it is already "in the
  // test" as far as the student can tell — and a right-click menu or a copy
  // that works here reads as the lockdown not being on. No `onViolation`: the
  // restrictions hold, but there is no attempt yet to record them against.
  /* The pre-test screen runs the same lockdown as the paper, with one exception:
     the keyboard. This page carries the Safe Exam Browser access-code field, and
     a student without SEB has to be able to type into it. Everything else — the
     right-click block, copy and paste, the fullscreen watcher — applies here as
     it does on the paper. */
  useProctoring({
    settings: brief?.settings || {},
    active: Boolean(brief) && !isTeacher,
    lockKeyboard: false,
  });

  const start = async () => {
    setStarting(true);
    setStartError('');
    try {
      // Upper-cased before it leaves: the codes are generated from an
      // uppercase alphabet, and the server compares them exactly. It normalises
      // too, so this is belt and braces — but it also keeps what was typed and
      // what was sent the same thing, which matters when a student reads the
      // field back to a teacher over the phone.
      const result = await lmApi.startAttempt(classId, quizId, sebCode.trim().toUpperCase() || undefined);
      navigate(`/learning/class/${classId}/quiz/${quizId}/attempt/${result.attempt._id}`);
    } catch (err) {
      /* Inline, not a toast.
         Chakra toasts portal to `document.body`, which is outside the quiz
         stage - so on a fullscreened brief the message rendered behind the very
         screen the student is looking at, and a wrong access code looked exactly
         like a button that did nothing. QuizAttempt already routes every message
         inline for this reason; this page was still using the toast. */
      setStartError(err.message);
      // SEB_REQUIRED means the code field is the thing to look at, if there is
      // one — surfacing it beats a toast the student has already read once.
      if (err.payload?.code === 'SEB_REQUIRED' && err.payload?.sebBypassEnabled) setShowSebCode(true);
      // A blocked start usually changes the window state; refresh to show why.
      load();
    } finally {
      setStarting(false);
    }
  };

  // The stage is mounted before the brief has loaded on purpose: fullscreen is
  // only granted while the click that brought us here still counts as a user
  // gesture, and waiting for the fetch would spend that window.
  //
  // The brief carries its own subject and faculty so the banner does not depend
  // on the class layout above having them; the class is only the stand-in for
  // the moment before the fetch lands.
  const subject = [brief?.subject, klass?.subject, klass?.name].find(Boolean);
  const faculty = [brief?.facultyName, klass?.ownerName, brief?.createdByName].find(Boolean);

  let body;
  if (loading) body = <Loading label="Loading test details…" />;
  else if (error) body = <ErrorState error={error} onRetry={load} />;
  else if (!brief) body = null;
  else {
    const { settings, window: state } = brief;
    const mobileBlocked = settings.preventMobile && isMobileDevice();
    // A teacher who has switched this on but not finished uploading the file
    // and pasting the Config Key has not made a paper anyone can sit yet — not
    // even in Safe Exam Browser, since there is nothing to check its header
    // against. Blocked the same way a mobile-blocked device is: explained, not
    // just disabled.
    const sebNotReady = settings.requireSafeExamBrowser && !settings.sebReady;
    /* Safe Exam Browser is running and the server still could not match this
       test to it. The student cannot fix that and cannot try harder at it, so
       the code is opened for them rather than left behind a link that reads
       "Don't have Safe Exam Browser installed?" — which is the one thing that is
       definitely not their problem. */
    const sebRunningUnverified =
      brief.sebReason === 'hash-mismatch' || brief.sebReason === 'config-key-header-missing';
    const sebCodeOpen = showSebCode || sebRunningUnverified;
    // One sitting per student, so a used attempt is the end of it.
    const attemptUsed = brief.attemptsUsed > 0;
    const hasInstructions = brief.instructions?.length > 0;
    // Staff can read this page — it is the one they hand out, and checking what
    // the class will see is the point — but only the roll can sit the paper.
    // An open sitting outranks the window, mirroring the server: `startAttempt`
    // resumes an in-progress attempt before it checks `canStart`. This is what
    // makes a teacher's reopen reach the student — the case it exists for is a
    // paper whose window has *already* closed, so a closed window must not be
    // what turns them away at the door.
    const canStart =
      !mobileBlocked && !sebNotReady && !isTeacher
      && (brief.hasInProgress || (state.canStart && !attemptUsed));

    body = (
      <>
        <Button size="sm" variant="ghost" mb={2} onClick={() => navigate(`/learning/class/${classId}/quizzes`)}>
          ← Back to quizzes
        </Button>

        <Heading size="lg" mb={1}>
          {brief.title}
        </Heading>
        {brief.description && (
          <Box mb={4}>
            <RichText>{brief.description}</RichText>
          </Box>
        )}

        <Grid templateColumns={{ base: '1fr 1fr', md: 'repeat(4, 1fr)' }} gap={3} mb={5}>
          <StatTile label="Questions" value={brief.questionCount} />
          <StatTile label="Total marks" value={brief.totalMarks} />
          <StatTile label="Duration" value={formatDuration(brief.estimatedDurationSec)} />
          <StatTile
            label="Attempt"
            value={brief.hasInProgress ? 'In progress' : attemptUsed ? 'Used' : 'Single'}
            accent={attemptUsed && !brief.hasInProgress ? 'red.500' : 'green.500'}
          />
        </Grid>

        {/* ---- the clock ---- */}
        {state.notYetOpen && opensIn !== null && (
          <CountdownPanel
            accent="purple"
            label="Starts in"
            seconds={opensIn}
            note={`Opens ${formatDateTime(state.opensAt)} — this page unlocks itself, so stay here.`}
          />
        )}

        {state.canStart && startDeadlineIn !== null && (
          <CountdownPanel
            accent="orange"
            label="Time left to start"
            seconds={startDeadlineIn}
            note={`Late entry closes at ${formatDateTime(state.startDeadline)}.`}
          />
        )}

        {/* ---- eligibility banners ---- */}
        {isTeacher && (
          <Alert status="info" borderRadius="md" mb={4}>
            <AlertIcon />
            <Box>
              <Text fontWeight="600">You are seeing this as staff</Text>
              <Text fontSize="sm">
                This is exactly what your students will read. Only students enrolled in this class
                can sit the paper — a staff attempt would be scored into their results.
              </Text>
            </Box>
          </Alert>
        )}

        {mobileBlocked && (
          <Alert status="error" borderRadius="md" mb={4}>
            <AlertIcon />
            <Box>
              <Text fontWeight="600">This test cannot be taken on a mobile device</Text>
              <Text fontSize="sm">Please switch to a laptop or desktop and reload this page.</Text>
            </Box>
          </Alert>
        )}

        {/* Suppressed when a sitting is open: the student's teacher has just
            reopened the paper for them, and "this test closed" above a working
            Continue button reads as a bug and stops people clicking it. */}
        {state.closed && !brief.hasInProgress && (
          <Alert status="error" borderRadius="md" mb={4}>
            <AlertIcon />
            This test closed on {formatDateTime(state.closesAt)}.
          </Alert>
        )}

        {state.lateToStart && !state.closed && !brief.hasInProgress && (
          <Alert status="error" borderRadius="md" mb={4}>
            <AlertIcon />
            <Box>
              <Text fontWeight="600">The window to start has passed</Text>
              <Text fontSize="sm">
                New attempts had to begin by {formatDateTime(state.startDeadline)}. Contact your teacher if you
                were unable to start in time.
              </Text>
            </Box>
          </Alert>
        )}

        {brief.hasInProgress && (
          <Alert status={state.closed ? 'info' : 'warning'} borderRadius="md" mb={4}>
            <AlertIcon />
            <Box>
              <Text fontWeight="600">
                {state.closed
                  ? 'Your teacher has reopened this test for you'
                  : 'You have an attempt in progress'}
              </Text>
              <Text fontSize="sm">
                Continuing picks up exactly where you left off.
                {state.closed
                  ? ' The test is closed for everyone else, so finish it in one go — your teacher set the time you have.'
                  : ''}
              </Text>
            </Box>
          </Alert>
        )}

        {/* ---- rules ----
            The teacher's own instructions sit beside the generated rules rather
            than under them: they are the part a student is told to read, and a
            long "How this test runs" list would otherwise push them off screen. */}
        <Grid
          templateColumns={{ base: '1fr', lg: hasInstructions ? 'minmax(0, 3fr) minmax(0, 2fr)' : '1fr' }}
          gap={4}
          mb={4}
          alignItems="start"
        >
          <SectionCard title="How this test runs">
            <List spacing={2} fontSize="sm">
              <ListItem>
                <ListIcon as="span">{settings.deliveryMode === 'one_at_a_time' ? '1️⃣' : '📋'}</ListIcon>
                {settings.deliveryMode === 'one_at_a_time'
                  ? 'Questions are shown one at a time.'
                  : 'All questions are shown on one page — answer them in any order.'}
              </ListItem>
              {settings.deliveryMode === 'one_at_a_time' && (
                <ListItem>
                  <ListIcon as="span">{settings.allowBacktracking ? '↩️' : '⛔'}</ListIcon>
                  {settings.allowBacktracking
                    ? 'You may go back to earlier questions and change your answers.'
                    : 'Once you move on, you cannot return to a question.'}
                </ListItem>
              )}
              <ListItem>
                <ListIcon as="span">⏱</ListIcon>
                {settings.perQuestionTiming
                  ? 'Each question has its own timer and moves on automatically when it runs out.'
                  : settings.timeLimitMinutes
                    ? `You have ${settings.timeLimitMinutes} minutes for the whole paper.`
                    : 'There is no time limit.'}
              </ListItem>
              {/* Spelled out because the obvious guess is wrong in both
                  directions: going back does not hand you a fresh countdown, and
                  it does not cost you the time you had left either. */}
              {settings.perQuestionTiming && settings.allowBacktracking && (
                <ListItem>
                  <ListIcon as="span">⏳</ListIcon>
                  A question you come back to resumes with the time it had left. Once a question&apos;s
                  time is gone you can still see it, but you cannot change your answer.
                </ListItem>
              )}
              {settings.negativeMarking > 0 && (
                <ListItem>
                  <ListIcon as="span">➖</ListIcon>
                  <b>Negative marking:</b> {settings.negativeMarking} mark(s) deducted for a wrong answer.
                  Unanswered questions are never penalised.
                </ListItem>
              )}
              {settings.shuffleQuestions && (
                <ListItem>
                  <ListIcon as="span">🔀</ListIcon>
                  Question order is randomised — your paper differs from your neighbour&apos;s.
                </ListItem>
              )}
              {settings.questionsPerAttempt > 0 && (
                <ListItem>
                  <ListIcon as="span">🎲</ListIcon>
                  {settings.questionsPerAttempt} questions are drawn at random for you.
                </ListItem>
              )}
              {/* Stated up front, not only as the countdown above: a student
                  reading the brief early needs to know there is a door that
                  closes, whether or not it is closing while they read. */}
              {state.startDeadline && (
                <ListItem>
                  <ListIcon as="span">🚪</ListIcon>
                  You must <b>begin</b> by {formatDateTime(state.startDeadline)}. Nobody may start after
                  that, though anyone already sitting the paper keeps their full time.
                </ListItem>
              )}
              <ListItem>
                <ListIcon as="span">☝️</ListIcon>
                You get <b>one attempt</b> — once you submit, this test cannot be taken again.
              </ListItem>
              <ListItem>
                <ListIcon as="span">🖥️</ListIcon>
                The test runs in <b>fullscreen only</b>. Leaving fullscreen, or switching to another
                tab, window or application, <b>submits your test immediately</b>.
              </ListItem>
              {settings.allowCalculator !== false && (
                <ListItem>
                  <ListIcon as="span">🖩</ListIcon>
                  A scientific calculator is available on screen during the test.
                </ListItem>
              )}
              {settings.resultReleaseAt && (
                <ListItem>
                  <ListIcon as="span">📅</ListIcon>
                  Results are released on {formatDateTime(settings.resultReleaseAt)}.
                </ListItem>
              )}
            </List>

            {/* Always shown: leaving the test now ends it on the first offence,
                so the rule is never conditional on how the paper was set up. */}
            <Box mt={4} p={3} bg="lmHue.orange50" borderRadius="md" borderWidth="1px" borderColor="lmHue.orange200">
              <Text fontSize="sm" fontWeight="600" mb={1}>
                Monitored conditions
              </Text>
              <List spacing={1} fontSize="xs">
                <ListItem>
                  • The test is taken in fullscreen. Pressing Escape, or otherwise leaving fullscreen,
                  submits your test at once — there is no warning and no second chance.
                </ListItem>
                <ListItem>
                  • Switching to another tab, window or application does the same. Close everything
                  else before you start, and turn off anything that can pop up over the screen.
                </ListItem>
                {/* Not a monitored condition, and deliberately worded as a rule
                    rather than a threat: a voice assistant is summoned by
                    speaking, which no web page can observe. Stating it makes
                    using one misconduct rather than a grey area a student can
                    argue was never forbidden — which is the only thing this
                    line can honestly buy. Unconditional, because it does not
                    depend on any setting being on. */}
                <ListItem>
                  • Voice assistants — Siri, or any other — must not be used during the test, whether
                  you open one by speaking or with a shortcut. Turn the assistant off before you
                  start.
                </ListItem>
                <ListItem>• Every one of these events is recorded on your attempt for your teacher.</ListItem>
                <ListItem>
                  • The clock is kept by the server. Closing the tab does not pause it, and the test
                  is submitted for you when the time runs out.
                </ListItem>
                {settings.keyboardLockdown !== false && (
                  // Said before they start, because it is the one rule a student
                  // would otherwise discover by breaking it.
                  <ListItem>
                    • <strong>The keyboard is disabled.</strong> Nothing you type reaches the paper.
                    You will be warned twice; the third key pressed submits your test. Answer by
                    clicking, and use the on-screen keypad for numbers.
                  </ListItem>
                )}
                {settings.disableCopyPaste && <ListItem>• Copy and paste are disabled.</ListItem>}
                {settings.disableRightClick && <ListItem>• Right-click is disabled.</ListItem>}
                {settings.preventMobile && (
                  <ListItem>• Please sit this on a laptop or desktop, not a phone.</ListItem>
                )}
              </List>
            </Box>
          </SectionCard>

          {hasInstructions && (
            <SectionCard title="Instructions from your teacher">
              <List spacing={2} fontSize="sm">
                {brief.instructions.map((line, index) => (
                  <ListItem key={index}>
                    <ListIcon as="span">•</ListIcon>
                    {line}
                  </ListItem>
                ))}
              </List>
            </SectionCard>
          )}
        </Grid>

        {brief.sections?.length > 0 && (
          <SectionCard title="Sections" mb={4}>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Section</Th>
                  <Th isNumeric>Questions</Th>
                  <Th isNumeric>Marks</Th>
                  <Th>Notes</Th>
                </Tr>
              </Thead>
              <Tbody>
                {brief.sections.map((section) => (
                  <Tr key={section._id}>
                    <Td fontWeight="500">{section.name}</Td>
                    <Td isNumeric>{section.questionCount}</Td>
                    <Td isNumeric>{section.marks}</Td>
                    <Td fontSize="xs" color="lmFg.subtle">
                      {section.instructions}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </SectionCard>
        )}

        {/* ---- staff pre-flight ----
            The one screen that can answer "did I set this up correctly" before
            an exam rather than during it. A teacher opening this page *inside*
            Safe Exam Browser makes exactly the request a student will make, over
            the same URL, carrying the same header, checked against the same
            Config Key — so a pass here is the real thing and not a simulation of
            it. Staff were shown nothing at all before, which left the file and
            its key unverifiable until a hall full of students could not start.

            Deliberately not the student block below: staff never need the
            launch button, the download or the access code, and a teacher reading
            instructions meant for a candidate is how a teacher comes to believe
            the paper is broken. */}
        {settings.requireSafeExamBrowser && isTeacher && (
          <Box
            mb={4}
            p={4}
            borderWidth="1px"
            borderRadius="lg"
            borderColor={brief.sebVerified ? 'lmHue.green200' : 'lmBorder.base'}
            bg={brief.sebVerified ? 'lmHue.green50' : 'lmBg.subtle'}
          >
            <Text fontSize="sm" fontWeight="700" mb={1}>
              🔒 Safe Exam Browser — setup check
            </Text>
            {sebNotReady ? (
              <Text fontSize="xs" color="lmFg.subtle">
                No settings file and Config Key yet. Until both are uploaded, nobody can sit this
                paper — not even in Safe Exam Browser, since there is nothing to check against.
              </Text>
            ) : brief.sebVerified ? (
              <Text fontSize="xs" color="lmHue.green700">
                ✅ Verified. This page was opened in Safe Exam Browser and matched to the uploaded
                Config Key — the check a student will pass is the check that just passed. Nothing
                further to do.
              </Text>
            ) : (
              <>
                <Text fontSize="xs" color="lmFg.subtle" mb={2}>
                  {sebDiagnosis(brief.sebReason)}
                </Text>
                <Text fontSize="xs" color="lmFg.muted">
                  To test the setup, open this page inside Safe Exam Browser. Checked from an
                  ordinary browser this will always say the headers are missing, which tells you
                  nothing about whether the file and key agree.
                </Text>
              </>
            )}
          </Box>
        )}

        {settings.requireSafeExamBrowser && !isTeacher && (
          <Box mb={4} p={4} borderWidth="1px" borderColor="lmHue.purple200" bg="lmHue.purple50" borderRadius="lg">
            <Text fontSize="sm" fontWeight="700" mb={1}>
              🔒 This test requires Safe Exam Browser
            </Text>
            {sebNotReady ? (
              <Text fontSize="xs" color="lmFg.subtle">
                Your teacher has not finished setting this up yet. Check back closer to the start
                time, or ask them directly.
              </Text>
            ) : brief.sebVerified ? (
              /* Already in it, and the server says so. Everything below - the
                 launch button, the download fallback, the access code - answers
                 a question this student no longer has, and showing it to them
                 reads as the check having failed. All they need now is Start. */
              <Text fontSize="xs" color="lmFg.subtle">
                ✅ Safe Exam Browser is active and this test has been matched to it. Press Start
                test when you are ready — the clock does not start until you do.
              </Text>
            ) : (
              <>
                {sebRunningUnverified ? (
                  /* Safe Exam Browser is demonstrably running — only SEB sends the
                     header that got this far — and the check still failed, which
                     makes it a teacher-side fault every time: the exam file and
                     the Config Key uploaded beside it describe different
                     settings. Repeating the launch button here would be telling
                     this student to do the thing they have visibly already done,
                     so the instructions are replaced rather than added to. The
                     access code below stays, because it is now the only way on
                     and it is exactly what it exists for. */
                  <Text
                    fontSize="xs"
                    color="lmHue.red700"
                    mb={settings.sebBypassEnabled ? 3 : 0}
                  >
                    Safe Exam Browser is running, but this test could not be matched to it — the
                    exam file and its Config Key do not agree. Tell your invigilator.
                    {settings.sebBypassEnabled && ' They can let you in with the access code below.'}
                  </Text>
                ) : (
                  <>
                    <Text fontSize="xs" color="lmFg.subtle" mb={3}>
                      Safe Exam Browser has to be installed on this computer first. Open the test in
                      it below, and nothing else you have open will be reachable while the test runs.
                    </Text>
                    {/* One click, if SEB is installed: following a `seb://` link hands
                        the settings straight to it. The download beneath is the same
                        file the long way round, for a browser that will not follow an
                        unknown scheme - which many do silently, so the fallback is
                        offered rather than left to be discovered after a failure. */}
                    {sebLaunch && (
                      <Button as="a" href={sebLaunch} size="sm" colorScheme="purple" mb={2}>
                        Open this test in Safe Exam Browser
                      </Button>
                    )}
                    <Text fontSize="xs" color="lmFg.subtle" mb={1}>
                      <Box
                        as="a"
                        href={lmApi.sebConfigUrl(classId, quizId)}
                        textDecoration="underline"
                      >
                        Nothing happened? Download the exam file instead
                      </Box>
                    </Text>
                    <Text
                      fontSize="xs"
                      color="lmFg.subtle"
                      mb={sebCodeOpen || settings.sebBypassEnabled ? 3 : 0}
                    >
                      Safe Exam Browser opens on the learning home; your test is listed there, and
                      the clock does not start until you press Start.
                    </Text>
                  </>
                )}

                {settings.sebBypassEnabled && (
                  <Box borderTopWidth="1px" borderColor="lmHue.purple200" pt={3}>
                    {sebCodeOpen ? (
                      <>
                        <Text fontSize="xs" fontWeight="600" mb={1}>
                          Access code
                        </Text>
                        <Text fontSize="xs" color="lmFg.muted" mb={2}>
                          For starting without Safe Exam Browser. Your teacher gives this out
                          directly — ask them if you do not have it.
                        </Text>
                        <Input
                          size="sm"
                          maxW="200px"
                          fontFamily="mono"
                          placeholder="Access code"
                          value={sebCode}
                          onChange={(e) => setSebCode(e.target.value.toUpperCase())}
                          /* The codes are uppercase, so the field is too: a
                             student never sees what they typed differ from what
                             is checked. autoCapitalize/autoCorrect are for
                             phones, which otherwise "help" with a code. */
                          textTransform="uppercase"
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </>
                    ) : (
                      <Text
                        as="button"
                        type="button"
                        fontSize="xs"
                        color="lmHue.purple700"
                        textDecoration="underline"
                        onClick={() => setShowSebCode(true)}
                      >
                        Don&apos;t have Safe Exam Browser installed?
                      </Text>
                    )}
                  </Box>
                )}
              </>
            )}
          </Box>
        )}

        {/* Directly above Start, because that is where the student is looking
            when it is refused. A wrong access code is the common case and it has
            to look like a wrong code, not like a dead button. */}
        {startError && (
          <Alert status="error" borderRadius="md" mb={4}>
            <AlertIcon />
            <Box>
              <Text fontWeight="600">Could not start the test</Text>
              <Text fontSize="sm">{startError}</Text>
            </Box>
          </Alert>
        )}

                <Flex gap={3} align="center" wrap="wrap">
          {/* `hasInProgress` overrides the used attempt for the same reason it
              overrides the window in `canStart`: a reopened or extended sitting
              still counts against `attemptsUsed`, and on that alone the student
              is handed a "Results pending" button for a paper they are supposed
              to be writing. */}
          {!attemptUsed || brief.hasInProgress ? (
            <Button
              size="lg"
              colorScheme="purple"
              onClick={start}
              isLoading={starting}
              isDisabled={!canStart}
            >
              {brief.hasInProgress ? 'Continue attempt' : 'Start test'}
            </Button>
          ) : brief.lastAttemptId && (brief.resultsReleased || !brief.resultsPending) ? (
            <Button
              size="lg"
              colorScheme="purple"
              onClick={() => navigate(`/learning/class/${classId}/quiz/${quizId}/attempt/${brief.lastAttemptId}`)}
            >
              Review submission
            </Button>
          ) : (
            <Button size="lg" colorScheme="orange" variant="outline" isDisabled>
              🔒 Results pending
            </Button>
          )}
          {isTeacher && <Badge colorScheme="blue">Enrolled students only</Badge>}
          {!canStart && !isTeacher && !mobileBlocked && attemptUsed && !brief.hasInProgress && (
            <Badge colorScheme="red">Already attempted — this test cannot be retaken</Badge>
          )}
          <HStack fontSize="xs" color="lmFg.muted">
            <Text>Make sure you have a stable connection before starting.</Text>
          </HStack>
        </Flex>
      </>
    );
  }

  return (
    <QuizStage subject={subject} faculty={faculty} title={brief?.title}>
      {body}
    </QuizStage>
  );
}
