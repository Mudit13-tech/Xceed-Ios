import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Spinner,
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
import serverClock from '../serverClock';
import { sebDiagnosis } from '../sebDiagnosis';
import QuizStage from '../components/QuizStage';
import CodeKeypad from '../components/CodeKeypad';
import RichText from '../components/RichText';
import { requestCamera, stopStream } from '../webcam';
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

/**
 * Counts down against the server's clock, not this browser's own.
 *
 * `target` (opensAt/closesAt/startDeadline) is a server timestamp; comparing
 * it against a raw `Date.now()` puts this browser's own clock drift directly
 * on the number a student watches. Reaching "0:00" here is also what fires
 * the one-shot reload that is supposed to unlock the Start button — so on a
 * machine whose clock runs behind the server's, this used to hit zero and
 * reload while the window had not actually opened yet by the server's own
 * clock, refetch a brief that still said `notYetOpen`, and then never try
 * again (the effect below only fires when this value *changes* to zero).
 * `serverClock.now()` is corrected using `serverTime` on every quiz-brief
 * response — see serverClock.js — so this reaches zero exactly when the
 * server agrees it should.
 */
const useCountdown = (target) => {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!target) {
      setRemaining(null);
      return undefined;
    }
    const tick = () => setRemaining(Math.max(0, Math.round((new Date(target).getTime() - serverClock.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target]);

  return remaining;
};

/** True on a Mac, by the same signals a browser actually exposes — there is no
 * more specific API than this to ask with. */
const isAppleDevice = () => /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || navigator.platform || '');

/**
 * A place to get Safe Exam Browser itself, not the settings file this quiz
 * hands out.
 *
 * Entirely self-contained — its own fetch, its own state, nothing read from or
 * written to the quiz this panel is otherwise about — because it answers a
 * different question than everything around it: not "can this browser open
 * this exam" but "does this computer have Safe Exam Browser installed at
 * all". A student who does not is stuck on that question regardless of which
 * quiz brought them here, and installing the exact build this installation
 * was tested against is safer than whichever version their own search turns
 * up. See `sebInstallerController.js` on the server — deliberately unrelated
 * to any quiz's own data.
 */
function SebInstallerLinks() {
  const [installers, setInstallers] = useState(null);

  useEffect(() => {
    let cancelled = false;
    lmApi
      .getSebInstallers()
      .then((result) => { if (!cancelled) setInstallers(result); })
      // Nothing configured, or the request failed — either way there is
      // nothing to offer, and this panel has no error state of its own to
      // show for it: the surrounding SEB instructions stand on their own.
      .catch(() => { if (!cancelled) setInstallers(false); });
    return () => { cancelled = true; };
  }, []);

  if (!installers) return null;

  const mac = isAppleDevice();
  const primary = mac ? installers.mac : installers.windows;
  const secondary = mac ? installers.windows : installers.mac;
  if (!primary?.available && !secondary?.available) return null;

  return (
    <Text fontSize="xs" color="lmFg.subtle" mb={1}>
      Don&apos;t have it yet?{' '}
      {primary?.available && (
        <Box
          as="a"
          href={lmApi.sebInstallerDownloadUrl(mac ? 'mac' : 'windows')}
          textDecoration="underline"
        >
          Download Safe Exam Browser for {mac ? 'Mac' : 'Windows'}
        </Box>
      )}
      {primary?.available && secondary?.available && ' · '}
      {secondary?.available && (
        <Box
          as="a"
          href={lmApi.sebInstallerDownloadUrl(mac ? 'windows' : 'mac')}
          textDecoration="underline"
        >
          {mac ? 'Windows' : 'Mac'} version
        </Box>
      )}
    </Text>
  );
}

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
  /* Whether the server has confirmed this code, and the request that asks it.
     The two gates are asked in order — right browser, then right room — so the
     screen has to know the code is good *before* it draws the room-code pad and
     the Start button. Cleared on every edit of the field: a code that has been
     changed since it was checked has not been checked. */
  const [codeVerified, setCodeVerified] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  // The room code, entered on an on-screen keyboard (never the physical one) and
  // sent only when the student actually presses Start — see CodeKeypad.
  const [roomCode, setRoomCode] = useState('');
  /* Whether the server has accepted this room code, and the check in flight.
     Checked automatically the moment the entry is complete rather than on Start,
     so a wrong code reads as a wrong code while the student can still do
     something about it. Cleared on every edit: a code changed since it was
     checked has not been checked. */
  const [roomVerified, setRoomVerified] = useState(false);
  const [verifyingRoom, setVerifyingRoom] = useState(false);
  const [roomError, setRoomError] = useState('');
  // The webcam grant, for a paper that requires one. 'idle' before we ask, then
  // 'prompting', then 'granted' or a reason the student can act on. The Start
  // button will not fire until this is 'granted'.
  const [camState, setCamState] = useState('idle');
  const camStreamRef = useRef(null);
  const camVideoRef = useRef(null);

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

  /**
   * The camera grant, asked for on this screen so a required-camera paper cannot
   * be started without it. Requested once the brief has loaded and only for a
   * student — a teacher previewing has nothing to start. The stream is held only
   * to prove the grant and show a preview; it is stopped on the way to the paper,
   * which acquires its own (with the permission already given, so no second
   * prompt). `askCamera` is also the Try-again handler, and a full refresh is
   * offered too, because a browser that remembers a block only re-prompts on
   * reload.
   */
  const askCamera = useCallback(() => {
    setCamState('prompting');
    requestCamera()
      .then((stream) => {
        camStreamRef.current = stream;
        setCamState('granted');
        if (camVideoRef.current) {
          camVideoRef.current.srcObject = stream;
          camVideoRef.current.play().catch(() => {});
        }
      })
      .catch((err) => setCamState(err?.reason || 'error'));
  }, []);

  /* Asked for last, and only once the room code has been accepted — the same
     order in Safe Exam Browser as in an ordinary browser.

     It used to be asked the moment the brief loaded, which put the camera
     prompt in front of students who had not yet proved they were in the room and
     might never start the paper at all: a light coming on, and a permission
     dialog, for a sitting that had not begun. Held until the last gate passes,
     the prompt arrives once, at the point the student is actually about to
     start, and never for somebody who wandered onto the link.

     A paper with no room code has nothing to wait for, so it asks as soon as the
     browser gate is open, as before. */
  const roomGateOpen = !brief?.settings?.roomCodeRequired || roomVerified;
  useEffect(() => {
    // Skipped when a teacher has waived the camera for this student — there is
    // nothing to ask for, and the paper starts without one.
    if (!brief?.settings?.requireWebcam || isTeacher || brief?.webcamExempt) return undefined;
    if (!roomGateOpen) return undefined;
    askCamera();
    return () => {
      stopStream(camStreamRef.current);
      camStreamRef.current = null;
    };
  }, [brief?.settings?.requireWebcam, isTeacher, brief?.webcamExempt, roomGateOpen, askCamera]);

  // Whether this screen is actually running inside Safe Exam Browser. It matters
  // for the camera: a camera "denied" inside SEB is SEB's own config refusing it,
  // not the student — and the student cannot change that config.
  //
  // `sebVerified` alone was too narrow to answer it, and the gap is where the
  // whole point of this went: it is only ever computed for a paper that requires
  // SEB, and only true once the Config Key matches. A webcam paper that does not
  // demand SEB has no key at all, and a mis-keyed settings file fails the hash —
  // in both, a student sitting in SEB looked to this screen like an ordinary
  // browser, and a config-level block looked like them refusing. `sebLikely` is
  // the server answering the presence question on its own terms (SEB's headers,
  // or its name in the user agent). The local user-agent test stays as a last
  // resort for a cached brief from a server that predates the field.
  const inSeb =
    Boolean(brief?.sebVerified) ||
    Boolean(brief?.sebLikely) ||
    /\bSEB(\b|_)/i.test(navigator.userAgent || '');
  // A refusal by SEB's config rather than by the student. Treated as unavailable
  // (let through, flagged) so a locked-down config does not strand a whole hall.
  const cameraSebBlocked = camState === 'denied' && inSeb;
  // "No usable camera here" — a desktop with no webcam, a browser that cannot
  // open one, or a camera SEB blocked. Not a student refusal, so the paper is let
  // through and flagged rather than blocked. Kept in step with the server's
  // WEBCAM_UNAVAILABLE_REASONS.
  const cameraUnavailable =
    ['notfound', 'unsupported', 'insecure', 'inuse', 'error'].includes(camState) || cameraSebBlocked;
  // The reason sent to the server — a real refusal outside SEB is not in the
  // allow set, so it stays undefined and the start is turned away.
  const cameraUnavailableReason = cameraSebBlocked ? 'seb_blocked' : cameraUnavailable ? camState : undefined;

  const opensIn = useCountdown(brief?.window?.notYetOpen ? brief.window.opensAt : null);
  const startDeadlineIn = useCountdown(
    brief?.window?.canStart && brief?.window?.startDeadline ? brief.window.startDeadline : null,
  );
  /* How long this paper has left to run — counted from the moment it opened,
     not from the moment this student pressed Start.

     The two countdowns above answer "when may I begin" and "how long may I dawdle
     before I am locked out". Neither answers the one a student on this screen is
     actually facing, and it is the one that costs marks: the paper closes at a
     fixed time, `attemptDeadline` takes the earlier of that and any personal
     limit, and every minute spent here — reading the rules, wrestling Safe Exam
     Browser onto the machine — is a minute gone from the paper. That was
     invisible, and the brief used to say the opposite in words. */
  const closesIn = useCountdown(
    brief?.window?.open && brief?.window?.closesAt ? brief.window.closesAt : null,
  );

  // Refresh once the quiz opens so the Start button becomes live without a
  // manual reload.
  useEffect(() => {
    if (opensIn === 0) load();
  }, [opensIn, load]);

  // And once it runs out, so the page turns itself over to the closed state
  // rather than leaving a live-looking Start button on a paper that has ended.
  useEffect(() => {
    if (closesIn === 0) load();
  }, [closesIn, load]);

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

  /**
   * Check the access code, before anything else is asked of this student.
   *
   * A student on an ordinary browser has nothing that answers "are you allowed
   * to sit this outside Safe Exam Browser?" until the code is checked, and until
   * that is answered there is no reason to show them the room-code pad or a
   * Start button. So the code is checked on its own here rather than folded into
   * Start, and only a pass opens the rest of the screen.
   *
   * It grants nothing by itself — `startAttempt` checks the same code again — so
   * the worst a tampered `codeVerified` buys is the sight of a keypad.
   */
  const verifyCode = async () => {
    const code = sebCode.trim().toUpperCase();
    if (!code) return;
    setVerifyingCode(true);
    setCodeError('');
    setStartError('');
    try {
      await lmApi.verifyAccessCode(classId, quizId, code);
      setCodeVerified(true);
    } catch (err) {
      setCodeVerified(false);
      setCodeError(err.message);
    } finally {
      setVerifyingCode(false);
    }
  };

  /* The room code, checked the moment the entry is complete.

     Automatic rather than a button, because a spoken five-character code has
     exactly one moment worth checking at and asking the student to press a
     second thing after typing it is a step that only ever adds a way to forget.
     Fired once per complete entry — the effect below re-runs on every edit, but
     `roomCodeLength` keeps a request from going out for a half-typed code, which
     would spend the shared guess budget four times over before the code was even
     finished.

     Nothing is granted by a pass. `startAttempt` re-checks the code, so a
     tampered `roomVerified` buys a green tick and nothing behind it. */
  const roomCodeLength = brief?.settings?.roomCodeLength || 0;
  const roomCodeComplete = roomCodeLength > 0 && roomCode.trim().length === roomCodeLength;
  useEffect(() => {
    if (!roomCodeComplete || isTeacher) return undefined;
    let cancelled = false;
    const code = roomCode.trim().toUpperCase();
    setVerifyingRoom(true);
    setRoomError('');
    lmApi
      .verifyRoomCode(classId, quizId, code)
      .then(() => {
        if (!cancelled) setRoomVerified(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setRoomVerified(false);
        setRoomError(err.message);
      })
      .finally(() => {
        if (!cancelled) setVerifyingRoom(false);
      });
    /* A code edited while its check was in flight must not be overwritten by
       that check landing late — the student would see a tick against a code they
       had already changed. */
    return () => {
      cancelled = true;
    };
  }, [roomCodeComplete, roomCode, classId, quizId, isTeacher]);

  /* The one state the pad draws itself with, folded out of the three flags so
     the pad has a single thing to switch on. */
  const roomStatus = verifyingRoom
    ? 'checking'
    : roomVerified
      ? 'verified'
      : roomError
        ? 'error'
        : 'idle';

  /** Every edit invalidates the last verdict — see `roomVerified`. */
  const onRoomCodeChange = useCallback((next) => {
    setRoomCode(next);
    setRoomVerified(false);
    setRoomError('');
  }, []);

  const start = async () => {
    setStarting(true);
    setStartError('');
    try {
      // Upper-cased before it leaves: the codes are generated from an
      // uppercase alphabet, and the server compares them exactly. It normalises
      // too, so this is belt and braces — but it also keeps what was typed and
      // what was sent the same thing, which matters when a student reads the
      // field back to a teacher over the phone.
      const result = await lmApi.startAttempt(classId, quizId, {
        sebBypassCode: sebCode.trim().toUpperCase() || undefined,
        roomCode: roomCode.trim().toUpperCase() || undefined,
        cameraReady: camState === 'granted' || undefined,
        cameraUnavailable: cameraUnavailableReason,
      });
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

    /**
     * What the clock actually does, said accurately.
     *
     * Both places below used to promise "the clock does not start until you
     * press Start", and on a scheduled paper that is not true. The server takes
     * the *earlier* of the student's own time limit and the paper's closing
     * time — `attemptDeadline` is `min(startedAt + timeLimitMinutes,
     * availableTo)` — so once a closing time exists the paper ends then whoever
     * started when. Reading the rules slowly, or fighting Safe Exam Browser on
     * the way in, comes straight out of the time available to answer.
     *
     * Telling a student otherwise is the worst kind of wrong: it is reassuring,
     * it is on the screen where they decide how long to spend, and the cost of
     * believing it is marks. So the sentence is derived from the paper in front
     * of them rather than asserted about papers in general.
     */
    const clockNote = state.closesAt
      ? `This test closes at ${formatDateTime(state.closesAt)} whether or not you have started, so start promptly.`
      : 'Your time starts when you press Start test.';
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
    /* The first of the two gates, and the one everything else on this screen
       waits behind: is this student in a browser allowed to sit the paper?
       Safe Exam Browser answers it by itself — the server verified the header —
       and an ordinary browser answers it with an access code that has been
       checked (see `verifyCode`), never merely typed.

       Until it is answered there is no Start button and no room-code pad. A
       Start button sitting beside "Open this test in Safe Exam Browser" made the
       launch look like one of two equal routes: students pressed Start,
       collected a refusal they could not act on, and read it as the test being
       broken. And the room code is the *second* question — asking it of somebody
       who has not passed the first hands the entry pad to anyone who opens the
       link. */
    const sebGateOpen =
      !settings.requireSafeExamBrowser || isTeacher || Boolean(brief.sebVerified) || codeVerified;

    /* Two exemptions from hiding Start, both matching what `startAttempt` itself
       does: a sitting already in progress resumes before the SEB gate is ever
       reached, and a student whose single attempt is spent needs the
       Review/Results button below rather than a launch instruction. */
    const sebStartBlocked = !sebGateOpen && !brief.hasInProgress && !attemptUsed;
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

        {/* Running right now. Shown whether or not this student has started —
            that is the whole point: the clock belongs to the paper, not to them.
            Red because it is the only one of the three that is actively costing
            the reader something while they read it. */}
        {state.open && closesIn !== null && (
          <CountdownPanel
            accent="red"
            label={brief.hasInProgress ? 'Your test is running — closes in' : 'This test is running — closes in'}
            seconds={closesIn}
            note={
              brief.hasInProgress
                ? `Closes ${formatDateTime(state.closesAt)}. Your paper ends then even if you are still answering.`
                : `Closes ${formatDateTime(state.closesAt)} whether or not you have started, so start promptly.`
            }
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
                ✅ Safe Exam Browser is active and this test has been matched to it. {clockNote}
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
                    <SebInstallerLinks />
                    {/* One click, if SEB is installed: following a `seb://` link hands
                        the settings straight to it. The raw exam-file download that
                        used to sit beneath this is gone by request — students were
                        taking it as the normal route and ending up with a stray
                        `.seb` file in Downloads instead of a launched exam. */}
                    {sebLaunch && (
                      <Button as="a" href={sebLaunch} size="sm" colorScheme="purple" mb={2}>
                        Open this test in Safe Exam Browser
                      </Button>
                    )}
                    <Text
                      fontSize="xs"
                      color="lmFg.subtle"
                      mb={sebCodeOpen || settings.sebBypassEnabled ? 3 : 0}
                    >
                      Safe Exam Browser opens on the learning home; your test is listed there.
                      {' '}
                      {clockNote}
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
                        <HStack align="center">
                          <Input
                            size="sm"
                            maxW="200px"
                            fontFamily="mono"
                            placeholder="Access code"
                            value={sebCode}
                            onChange={(e) => {
                              setSebCode(e.target.value.toUpperCase());
                              // A code that has been edited since it was checked
                              // has not been checked. Closes the gate again, so
                              // the room-code pad and Start cannot be left open
                              // over a code that no longer matches.
                              setCodeVerified(false);
                              setCodeError('');
                            }}
                            /* The codes are uppercase, so the field is too: a
                               student never sees what they typed differ from what
                               is checked. autoCapitalize/autoCorrect are for
                               phones, which otherwise "help" with a code. */
                            textTransform="uppercase"
                            autoCapitalize="characters"
                            autoCorrect="off"
                            spellCheck={false}
                            isDisabled={codeVerified}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') verifyCode();
                            }}
                          />
                          {!codeVerified && (
                            <Button
                              size="sm"
                              colorScheme="purple"
                              onClick={verifyCode}
                              isLoading={verifyingCode}
                              isDisabled={!sebCode.trim()}
                            >
                              Check code
                            </Button>
                          )}
                          {codeVerified && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSebCode('');
                                setCodeVerified(false);
                              }}
                            >
                              Change
                            </Button>
                          )}
                        </HStack>
                        {codeError && (
                          <Text fontSize="xs" color="lmHue.red700" mt={2} fontWeight="600">
                            {codeError}
                          </Text>
                        )}
                        {/* Said here because the Start button is not on screen to
                            be looked for: checking the code is what puts it
                            there — and, on a paper with a room code, what brings
                            up the keypad for it. */}
                        <Text fontSize="xs" color={codeVerified ? 'lmHue.green700' : 'lmFg.subtle'} mt={2}>
                          {codeVerified
                            ? settings.roomCodeRequired
                              ? '✓ Access code accepted. Now enter the room code your invigilator reads out, below.'
                              : '✓ Access code accepted. The Start button is below.'
                            : 'Enter the code and press Check code. Nothing else on this page unlocks until it is checked.'}
                        </Text>
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

        {/* A teacher has waived the camera for this student — no camera is asked
            for, and Start is not gated on one. Shown in place of the gate below. */}
        {settings.requireWebcam && !isTeacher && brief.webcamExempt && (
          <Box mb={4} p={4} borderWidth="1px" borderColor="lmHue.green200" bg="lmHue.green50" borderRadius="md">
            <Text fontSize="sm" fontWeight="700" mb={1}>
              Webcam waived
            </Text>
            <Text fontSize="xs" color="lmFg.muted">
              Your teacher has allowed you to take this test without a webcam. You can start.
            </Text>
          </Box>
        )}

        {/* The room code, on an on-screen keyboard, when the invigilator has set
            one. Students only — a teacher previewing the brief has no code to
            enter and no sitting to start.

            First on the screen now, not last. It gates the camera prompt as well
            as Start, so it has to be the thing the student sees and answers
            before anything else asks them for something; a permission dialog
            arriving ahead of it was a request made of somebody not yet known to
            be in the room.

            Still held back until the browser gate has been passed, which is the
            order the server checks them in: a student working out how to open
            Safe Exam Browser has no use for a room code, and drawing the pad for
            everyone who opens the link tells anyone curious that a spoken code
            exists and how long it is. */}
        {settings.roomCodeRequired && !isTeacher && sebGateOpen && (
          <Box
            mb={4}
            p={4}
            borderWidth="1px"
            borderColor="lmHue.blue200"
            bg="lmHue.blue50"
            borderRadius="md"
          >
            <Text fontSize="sm" fontWeight="700" mb={1}>
              Step 1 — Enter the room code {roomVerified ? '' : 'to continue'}
            </Text>
            <Text fontSize="xs" color="lmFg.muted" mb={3}>
              Your invigilator will read out a {roomCodeLength ? `${roomCodeLength}-character ` : ''}
              code for this room. Tap it into the boxes below — it is checked as soon as the last box is
              filled, and nothing else on this page opens until it is accepted.
            </Text>
            {/* The pad draws one blank box per character of the real code, so a
                student knows how many to listen for before the first tap, and
                carries the verdict on the boxes themselves — the tick appears
                the moment the last box is filled and checked. */}
            <CodeKeypad
              value={roomCode}
              onChange={onRoomCodeChange}
              length={roomCodeLength || undefined}
              maxLength={roomCodeLength || 8}
              status={roomStatus}
              isDisabled={starting || roomVerified}
            />
            {/* The verdict in words, under the pad. The pad itself already
                carries the state — a spinner, a green tick, a red row — but a
                refusal has a *reason* ("wrong code", "no guesses left") that only
                fits as a sentence. Silence here is what made the old screen feel
                broken: the code was only ever judged on Start. */}
            <Box mt={2} minH="24px">
              {!verifyingRoom && roomVerified && (
                <Text fontSize="sm" color="lmHue.green700" fontWeight="700">
                  Room code accepted — you can start the test below.
                </Text>
              )}
              {!verifyingRoom && roomError && (
                <Text fontSize="sm" color="lmHue.orange700" fontWeight="600">
                  {roomError}
                </Text>
              )}
            </Box>
          </Box>
        )}

        {/* The webcam gate. Students only, and only when the paper requires it
            and the student has not been waived. The paper cannot start until this
            is granted, so it sits above Start with the grant state and a preview.

            Drawn only once the room code is in. Shown any earlier it is a panel
            saying "Webcam required" with nothing happening in it, next to a
            camera that has deliberately not been asked for yet — which reads as
            the page having failed rather than as a step that has not come round. */}
        {settings.requireWebcam && !isTeacher && !brief.webcamExempt && roomGateOpen && (
          <Box
            mb={4}
            p={4}
            borderWidth="1px"
            borderColor={camState === 'granted' ? 'lmHue.green200' : 'lmHue.orange200'}
            bg={camState === 'granted' ? 'lmHue.green50' : 'lmHue.orange50'}
            borderRadius="md"
          >
            <Text fontSize="sm" fontWeight="700" mb={1}>
              {settings.roomCodeRequired ? 'Step 2 — ' : ''}Webcam{' '}
              {camState === 'granted' ? 'on' : 'required'}
            </Text>
            <Text fontSize="xs" color="lmFg.muted" mb={3}>
              This test is invigilated by webcam. Your camera is watched for the length of the paper,
              and a frame is kept and shown to your teacher only when something looks wrong (no face in
              view). You must allow the camera to start.
            </Text>

            {/* The preview is always mounted so the granted stream has somewhere
                to attach; it simply shows nothing until there is a stream. */}
            <Flex gap={3} align="center" wrap="wrap">
              <Box
                as="video"
                ref={camVideoRef}
                muted
                playsInline
                w="160px"
                h="120px"
                bg="black"
                borderRadius="md"
                objectFit="cover"
                transform="scaleX(-1)"
                display={camState === 'granted' ? 'block' : 'none'}
              />
              {camState === 'prompting' && (
                <HStack fontSize="sm" color="lmFg.muted">
                  <Spinner size="sm" />
                  <Text>Asking for your camera — choose “Allow”.</Text>
                </HStack>
              )}
              {camState === 'granted' && (
                <Text fontSize="sm" color="lmHue.green700" fontWeight="600">
                  ✓ Camera on. You can start the test.
                </Text>
              )}
              {camState === 'denied' && !cameraSebBlocked && (
                <Box>
                  <Text fontSize="sm" color="lmHue.orange700" fontWeight="600" mb={1}>
                    Camera blocked. The test cannot start without it.
                  </Text>
                  <Text fontSize="xs" color="lmFg.muted" mb={2}>
                    Allow the camera for this site, then try again.
                  </Text>
                  <HStack>
                    <Button size="sm" variant="outline" onClick={askCamera}>
                      Try again
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
                      Refresh
                    </Button>
                  </HStack>
                </Box>
              )}
              {/* No usable camera on this machine — not a refusal. The student is
                  let through, and their teacher is told, so a legitimate desktop
                  without a webcam is not stranded. */}
              {cameraUnavailable && (
                <Box>
                  <Text fontSize="sm" color="lmHue.orange700" fontWeight="600" mb={1}>
                    {cameraSebBlocked
                      ? 'The camera is not enabled in the exam settings file.'
                      : camState === 'notfound'
                        ? 'No camera found on this computer.'
                        : camState === 'inuse'
                          ? 'Another app is using the camera.'
                          : 'Could not open the camera.'}
                  </Text>
                  {cameraSebBlocked && (
                    <Text fontSize="xs" color="lmFg.muted" mb={1}>
                      Tell your invigilator.
                    </Text>
                  )}
                  {/* One line, and no advice about which browser to open. The
                      long version read as a troubleshooting page in the middle of
                      an exam, and its suggestions were mostly things a student
                      sitting in a locked-down hall cannot do — least of all
                      switching browser, which on a Safe Exam Browser paper is the
                      one action that is actually forbidden. What they need to
                      know is that they can start and that it is not hidden. */}
                  <Text fontSize="xs" color="lmFg.muted" mb={2}>
                    You can still start the test. <b>Your teacher will be told</b> this sitting has no
                    camera.
                  </Text>
                  <HStack>
                    <Button size="sm" variant="outline" onClick={askCamera}>
                      Try again
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
                      Refresh
                    </Button>
                  </HStack>
                </Box>
              )}
            </Flex>
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
          {sebStartBlocked ? (
            /* Where the Start button would be, saying what to do instead. A
               blank space here reads as a page that failed to finish loading —
               the student has to be told that the launch above *is* the start. */
            <Box
              p={3}
              borderWidth="1px"
              borderColor="lmHue.purple200"
              bg="lmHue.purple50"
              borderRadius="md"
              maxW="520px"
            >
              <Text fontSize="sm" fontWeight="600" mb={1}>
                🔒 {sebNotReady ? 'This test is not ready to start yet' : 'Start from Safe Exam Browser'}
              </Text>
              <Text fontSize="xs" color="lmFg.muted">
                {sebNotReady
                  ? 'Your teacher has still to finish the Safe Exam Browser setup. There is nothing you can do from here yet.'
                  : settings.sebBypassEnabled
                    ? 'Open the test in Safe Exam Browser above — that is how this paper begins. If your invigilator has given you an access code instead, enter it above and press Check code; the Start button appears here once it is accepted.'
                    : 'Open the test in Safe Exam Browser above — that is how this paper begins. There is no Start button here, because the test can only be sat inside Safe Exam Browser.'}
              </Text>
            </Box>
          ) : !attemptUsed || brief.hasInProgress ? (
            <Button
              size="lg"
              colorScheme="purple"
              onClick={start}
              isLoading={starting}
              // A room-code quiz needs the code before Start does anything, and a
              // webcam quiz needs the camera granted; the server refuses either
              // when missing, so gate the button rather than send a start that can
              // only bounce. Resuming an open sitting is exempt — both are
              // start-time gates, not re-asked mid-paper.
              isDisabled={
                !canStart ||
                // The *accepted* code, not merely a typed one: it is checked as
                // soon as it is complete, so by the time Start could be pressed
                // the answer is already known, and enabling the button on typing
                // alone would put a refusal back on Start for no reason.
                (settings.roomCodeRequired && !brief.hasInProgress && !roomVerified) ||
                // Blocked only while still trying, or on a plain refusal. A
                // machine with no usable camera is let through (and flagged), and
                // a teacher's waiver drops the requirement entirely.
                (settings.requireWebcam &&
                  !brief.hasInProgress &&
                  !brief.webcamExempt &&
                  camState !== 'granted' &&
                  !cameraUnavailable)
              }
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
