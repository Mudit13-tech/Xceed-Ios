import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  HStack,
  Heading,
  Input,
  Progress,
  Radio,
  RadioGroup,
  Stack,
  Text,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import RichText from '../components/RichText';
import { ErrorState, Loading, SectionCard, StatTile } from '../components/common';
import useProctoring from '../hooks/useProctoring';
import useQuizCountdown from '../hooks/useQuizCountdown';
import useAnswerAutosave from '../hooks/useAnswerAutosave';
import useQuestionPrefetch from '../hooks/useQuestionPrefetch';
import QuizReview from '../components/QuizReview';
import QuizStage from '../components/QuizStage';
import QuizCalculator from '../components/QuizCalculator';
import NumericKeypad from '../components/NumericKeypad';
import { fullscreenSupported, requestQuizFullscreen, scrollStageToTop } from '../quizStage';
import { formatDateTime } from '../format';
import { saveFailureMessage } from '../saveFailure';

const clock = (seconds) => {
  const safe = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * What leaving the test screen costs, in the student's own terms.
 *
 * Spelled out on the sitting itself rather than only in the brief they read ten
 * minutes ago: it is the one rule that ends the paper without warning, so it is
 * said wherever a student can still act on it.
 */
/**
 * How long a save may take before the student is told something about it.
 *
 * Long enough that an ordinary slow request passes unremarked, short enough that
 * nobody sits watching a spinner wondering whether the click registered — which
 * is the moment they reach for reload or another window, either of which ends
 * their paper.
 */
const SLOW_REQUEST_MS = 8000;

/**
 * What kind of answer a question wants, in the student's words.
 *
 * Worth saying on the question rather than leaving to the shape of the controls:
 * radio buttons and checkboxes are a subtle distinction to spot under exam
 * pressure, and a student who reads a multiple-answer question as single-answer
 * stops at the first correct option and loses the mark. The type was already on
 * the question; it just was not being shown.
 */
const TYPE_LABEL = {
  mcq: 'Choose one',
  msq: 'Choose all that apply',
  truefalse: 'True or false',
  numerical: 'Enter a number',
};

const LEAVING_COST =
  'Leaving fullscreen, or switching to another window, tab or application, submits your test ' +
  'immediately. There are no warnings and no allowance.';

/**
 * What the keyboard costs, which is not the same rule.
 *
 * Leaving the screen ends the paper on sight; a key does not, and saying so
 * plainly matters more than the tidiness of one sentence covering both. A
 * student who believes the first stray key has already ended their test spends
 * the rest of the paper working under something that has not happened.
 */
const KEYBOARD_COST =
  'The keyboard is disabled — nothing you type reaches the paper. You will be warned twice; '
  + 'the third key pressed submits your test.';

/** Answer widget shared by both delivery modes. */
function AnswerInput({ question, value, onChange, isDisabled, keypadOnly }) {
  if (question.type === 'numerical') {
    // With the keyboard blocked there is nothing to type into a text field, so the
    // keypad replaces it rather than sitting beside it. See NumericKeypad.
    if (keypadOnly) {
      return (
        <NumericKeypad
          value={value.text || ''}
          isDisabled={isDisabled}
          onChange={(text) => onChange({ selected: [], text })}
        />
      );
    }
    return (
      <Input
        type="text"
        inputMode="decimal"
        maxW="260px"
        placeholder="Enter a number"
        value={value.text || ''}
        isDisabled={isDisabled}
        onChange={(event) => onChange({ selected: [], text: event.target.value })}
      />
    );
  }
  if (question.type === 'msq') {
    return (
      <Stack>
        {question.options.map((option, index) => (
          <Checkbox
            key={index}
            alignItems="flex-start"
            isChecked={(value.selected || []).includes(String(index))}
            isDisabled={isDisabled}
            onChange={(event) => {
              const current = value.selected || [];
              const key = String(index);
              onChange({
                text: '',
                selected: event.target.checked ? [...current, key] : current.filter((c) => c !== key),
              });
            }}
          >
            <RichText>{option}</RichText>
          </Checkbox>
        ))}
      </Stack>
    );
  }
  return (
    <RadioGroup
      value={(value.selected || [])[0] ?? ''}
      isDisabled={isDisabled}
      onChange={(picked) => onChange({ selected: [picked], text: '' })}
    >
      <Stack>
        {question.options.map((option, index) => (
          <Radio key={index} value={String(index)} alignItems="flex-start">
            <RichText>{option}</RichText>
          </Radio>
        ))}
      </Stack>
    </RadioGroup>
  );
}

/**
 * A live quiz sitting.
 *
 * Two modes share this screen because they share all the surrounding machinery
 * (timers, proctoring, submission):
 *
 *   all_at_once   — every question on one page, free navigation, one clock
 *   one_at_a_time — the server hands out one question at a time and keeps the
 *                   cursor, so a refresh resumes rather than restarts
 */
export default function QuizAttempt() {
  const { classId, klass } = useOutletContext();
  const { quizId, attemptId } = useParams();
  const navigate = useNavigate();

  const [settings, setSettings] = useState(null);
  // Title, subject and faculty for the banner, taken from the quiz itself:
  // the sitting is the one screen that has to identify itself without leaning
  // on the class page around it.
  const [banner, setBanner] = useState({ title: '', subject: '', facultyName: '' });
  const [attempt, setAttempt] = useState(null);
  const [paper, setPaper] = useState(null);        // all_at_once
  const [current, setCurrent] = useState(null);    // one_at_a_time
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  // Set when Submit is pressed with questions still blank: the confirmation is
  // rendered inline rather than as a modal, because a Chakra modal portals to
  // document.body and would be invisible behind a fullscreened paper.
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  // A request that has been in flight long enough to worry a student.
  const [slow, setSlow] = useState(false);
  /**
   * The answers as the server last handed them over.
   *
   * The autosave compares against this rather than against nothing, so a
   * question arriving with an answer already on it is not immediately saved
   * back — one pointless request per question, on the connection least able to
   * afford it.
   */
  const [baseline, setBaseline] = useState({});
  const finishedRef = useRef(false);
  const noticeTimer = useRef(null);
  // The proctoring hook's queue drain, held in a ref because the paths that bank
  // work are declared above the hook that owns it. See `finish` and `advance`.
  const flushRef = useRef(null);
  // The autosave hook's forced flush, same reason: read by the pagehide/unmount
  // effect declared below the hook that owns it.
  const autosaveFlushRef = useRef(null);
  // Question card nodes, so the navigator can jump straight to one.
  const questionRefs = useRef({});

  const sequential = settings?.deliveryMode === 'one_at_a_time';

  /**
   * Chakra toasts render into a portal on `document.body`, which sits outside
   * the quiz stage and so is invisible the moment the stage is fullscreened.
   * Every message therefore goes inline above the paper instead — one path, so
   * nothing can go missing depending on whether fullscreen was granted.
   */
  const notify = useCallback((options) => {
    setNotice(options);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  /**
   * Runs a request, and says so on screen if it is taking too long.
   *
   * A spinner that never resolves is what a saturated server looks like from a
   * desk: `fetch` has no timeout, so Save-and-Next span for minutes with nothing
   * to read. The request is deliberately **not** aborted — cancelling and
   * retrying against a server that is already queueing is how a slow exam
   * becomes a failed one — so this only replaces the silence with an
   * explanation, and above all with the instruction not to leave the screen.
   * That instinct is the dangerous one: alt-tabbing or reloading a hung paper
   * ends the attempt under the proctoring rules.
   */
  const slowAware = useCallback(async (work) => {
    const timer = setTimeout(() => setSlow(true), SLOW_REQUEST_MS);
    try {
      return await work();
    } finally {
      clearTimeout(timer);
      setSlow(false);
    }
  }, []);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  /* ------------------------------ loading ------------------------------ */

  /** Answers that came from the server: they are the draft *and* its baseline. */
  const applyServerAnswers = useCallback((map) => {
    setAnswers(map);
    setBaseline(map);
  }, []);

  /**
   * What to do once something outside a click has decided this browser is no
   * longer driving the attempt — a permanent autosave failure, or the
   * heartbeat learning a second screen took over.
   *
   * Two different endings share this because they are told apart by the same
   * one thing everywhere else in this file already checks: whether the
   * server still considers *this* browser the one sitting the paper.
   * `SESSION_CONFLICT` says no, someone else is — the attempt lives on, just
   * not here, so the screen has to say that rather than "finished". Every
   * other fatal code (`FINISHED`, `TERMINATED`, `EXPIRED`) says the attempt
   * itself is over, so the paper's own result is what belongs on screen.
   */
  const reconcile = useCallback(
    async (err) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      if (err?.payload?.code === 'SESSION_CONFLICT') {
        setError(err);
        return;
      }
      const finished = await lmApi.getAttempt(classId, attemptId).catch(() => null);
      if (finished) {
        setAttempt(finished.attempt);
        setResult(finished);
      }
    },
    [classId, attemptId],
  );

  /* ------------------------------ autosave -----------------------------
     Banking answers as they are given, rather than only when the student moves.

     On a sequential paper the draft is the question in front of them and nothing
     else — the server refuses the rest, because a draft aimed at an earlier
     question would be a way around a paper that does not allow going back. On
     the one-page paper it is the whole thing, which is what the manual Save
     button did and what most students never pressed. */
  const draft = useMemo(() => {
    if (!sequential) return answers;
    const id = current?.question?._id;
    return id && answers[id] ? { [id]: answers[id] } : {};
  }, [sequential, answers, current]);

  const draftBaseline = useMemo(() => {
    if (!sequential) return baseline;
    const id = current?.question?._id;
    return id && baseline[id] ? { [id]: baseline[id] } : {};
  }, [sequential, baseline, current]);

  const autosave = useAnswerAutosave({
    payload: draft,
    baseline: draftBaseline,
    // Never on a question whose own clock has gone: its answer is fixed, and a
    // save there would be an answer arriving after its deadline. Nor once
    // something has already ended the sitting from outside a click — see
    // `reconcile` — since every subsequent save would just repeat the same
    // fatal response.
    active: Boolean(current || paper) && !result && !current?.questionClosed && !finishedRef.current,
    // `keepalive`, always — not only for the forced flush on a departure or a
    // closing tab. The same request is what an ordinary debounced save sends
    // too, and there is no version of "the page might go away before this
    // resolves" that is safe to skip: the whole point of autosaving is to get
    // an answer out from under a screen that will not be there long enough to
    // watch its own request finish.
    save: (entries) => lmApi.saveAttemptDraft(classId, attemptId, entries, { keepalive: true }),
  });

  // A permanent autosave failure reached outside a click — the connection was
  // fine right up until the moment it wasn't. Same reconciliation as every
  // other way this attempt can end from under the student.
  useEffect(() => {
    if (autosave.status === 'blocked') reconcile(autosave.fatalError);
  }, [autosave.status, autosave.fatalError, reconcile]);

  const loadSequential = useCallback(async () => {
    try {
      const data = await lmApi.getCurrentQuestion(classId, attemptId);
      if (data.done) {
        setCurrent(null);
        return true;
      }
      setCurrent(data);
      applyServerAnswers(
        data.saved ? { [data.question._id]: { selected: data.saved.selected || [], text: data.saved.text || '' } } : {},
      );
      return false;
    } catch (err) {
      // `payload.code`, not `err.code` — `LmApiError` carries the server's body
      // under `payload`, so the code check was dead and the whole thing rested on
      // the wording of the message. A student opening a submitted paper landed on
      // an error screen the day that sentence was reworded.
      if (err.payload?.code === 'FINISHED' || err.message?.includes('finished')) {
        setCurrent(null);
        return true;
      }
      throw err;
    }
  }, [classId, attemptId, applyServerAnswers]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const quiz = await lmApi.getQuiz(classId, quizId);
      setSettings(quiz.settings);
      setBanner({ title: quiz.title, subject: quiz.subject, facultyName: quiz.facultyName });

      if (quiz.settings.deliveryMode === 'one_at_a_time') {
        const done = await loadSequential();
        if (done) {
          const finished = await lmApi.getAttempt(classId, attemptId);
          setAttempt(finished.attempt);
          setResult(finished);
          finishedRef.current = true;
        }
      } else {
        const data = await lmApi.getAttemptPaper(classId, attemptId);
        setPaper(data);
        setAttempt(data.attempt);
        const restored = {};
        data.questions.forEach((question) => {
          if (question.saved) {
            restored[question._id] = {
              selected: question.saved.selected || [],
              text: question.saved.text || '',
            };
          }
        });
        applyServerAnswers(restored);
        if (data.attempt.status !== 'in_progress') {
          const finished = await lmApi.getAttempt(classId, attemptId);
          setResult(finished);
          finishedRef.current = true;
        }
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, quizId, attemptId, loadSequential, applyServerAnswers]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------------------- submitting ----------------------------- */

  const payload = useCallback(
    () =>
      Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        selected: value.selected || [],
        text: value.text || '',
      })),
    [answers],
  );

  const finish = useCallback(
    async (expired = false) => {
      if (finishedRef.current) return;
      // Anything queued while the connection was down goes first. If it ends the
      // attempt, `finishedRef` is already set by the time we look again and this
      // submit never happens — a student cannot outrun their own report by
      // submitting the moment they reconnect.
      await flushRef.current?.();
      if (finishedRef.current) return;
      finishedRef.current = true;
      // The submit carries every answer itself, so a debounced draft racing it
      // is a write for nothing — and awaited, because one already on the wire is
      // a second writer on the same attempt document rather than no writer.
      await autosave.cancel();
      setBusy('submit');
      try {
        const submitted = await slowAware(() =>
          lmApi.submitAttempt(classId, attemptId, payload(), expired),
        );
        setAttempt(submitted.attempt);
        setResult(submitted);
        if (expired) notify({ status: 'warning', title: 'Time is up — your answers were submitted.' });
      } catch (err) {
        finishedRef.current = false;
        notify({ status: 'error', title: saveFailureMessage(err) });
      } finally {
        setBusy('');
      }
    },
    [classId, attemptId, payload, notify, slowAware, autosave],
  );

  /* ---------------------------- proctoring ----------------------------- */

  /**
   * Whether a paper is live on screen.
   *
   * Not `attempt.status` alone: one-at-a-time delivery never hands back an
   * attempt document while it runs — the question endpoint is the whole
   * response — so an attempt-only test left the sequential mode, the one the
   * "Exam" preset uses and the one that turns every proctoring option on,
   * entirely unproctored: right-click worked, and leaving fullscreen was
   * neither reported nor noticed.
   */
  const sitting =
    !finishedRef.current &&
    !result &&
    (sequential ? Boolean(current) : attempt?.status === 'in_progress');

  const proctoring = useProctoring({
    settings: settings || {},
    active: sitting,
    attemptId,
    onViolation: (type, at, detail) => lmApi.recordViolation(classId, attemptId, type, at, detail),
    // `env` is present only on the beats that carry a machine fingerprint; see
    // ENV_PROBE_EVERY in useProctoring.
    onHeartbeat: (env) => lmApi.heartbeat(classId, attemptId, env),
    onTerminated: () => reconcile(),
    // Gets whatever autosave is still holding onto the wire before the
    // violation report ends the sitting — see the note on `report` in
    // useProctoring for why this has to run first, not just soon.
    beforeLeave: () => autosave.flush(),
    // The losing side of a rebind: the heartbeat found out this browser is no
    // longer the one driving the attempt.
    onSessionConflict: reconcile,
  });

  flushRef.current = proctoring.flushViolations;
  // Same reason as `flushRef` above: read through a ref so the effect below
  // does not have to depend on `autosave` itself, whose identity changes with
  // every status change and would tear the listener down and rebuild it on
  // every "saving" → "saved" flicker.
  autosaveFlushRef.current = autosave.flush;

  /**
   * The one departure `useProctoring` cannot see: this screen going away for a
   * reason that is not the browser leaving at all — an in-app route change,
   * in particular, fires none of the events that watches for. `pagehide`
   * covers the tab actually closing or navigating away; the cleanup covers
   * everything else, including that one, since React always runs it on
   * unmount regardless of why.
   *
   * Skipped when the attempt already ended through a path that flushed or
   * cancelled the draft on purpose (`finish`, `reconcile`, a proctoring
   * termination) — `finishedRef` is already true by the time any of those
   * lets `sitting` go false, so this only ever fires for the case it exists
   * for: something ending the sitting on screen without this file's own
   * knowledge that it was happening.
   */
  useEffect(() => {
    if (!sitting) return undefined;
    const onPageHide = () => autosaveFlushRef.current();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      if (!finishedRef.current) autosaveFlushRef.current();
    };
  }, [sitting]);

  /**
   * The student has left the test screen, seen locally rather than confirmed by
   * the server.
   *
   * Everything downstream keys off this rather than off the server's reply, so a
   * dropped connection cannot buy time: the clock stops, the paper is not
   * rendered, and re-entering fullscreen does not bring it back.
   */
  const departed = proctoring.departed;

  /* ----------------------------- prefetch ------------------------------
     The next question, fetched while this one is being read. The server decides
     whether it will send it at all, and whether in the clear or sealed, so
     nothing here can widen what a paper discloses. */
  const prefetch = useQuestionPrefetch({
    attemptId,
    questionId: current?.question?._id,
    active: sequential && Boolean(current) && !result && !departed,
    fetchNext: () => lmApi.getNextQuestion(classId, attemptId),
  });

  /**
   * A served question with its payload attached, wherever that came from.
   *
   * The reply to an advance leaves the question out when the browser already
   * holds it — that is the whole saving. If what we hold turns out not to open
   * it, the paper must not stop: ask for it plainly and carry on a round trip
   * poorer.
   */
  const materialise = useCallback(
    async (served) => {
      if (!served || served.done || served.question) return served;
      const question = await prefetch.open(served);
      if (question) return { ...served, question };
      return lmApi.getCurrentQuestion(classId, attemptId);
    },
    [prefetch, classId, attemptId],
  );

  /* ------------------------------ timers ------------------------------- */

  const deadline = sequential ? current?.deadline : paper?.deadline;

  const advance = useCallback(
    async (direction = 'forward', autoSubmitted = false) => {
      if (!current) return;
      // Same rule as `finish`: a queued departure is judged before the answer it
      // might have bought. If it terminates the attempt the answer POST below
      // returns FINISHED, and `onTerminated` has already swapped in the result.
      await flushRef.current?.();
      if (finishedRef.current) return;
      // A question whose own time is gone is read-only, so leaving it carries no
      // answer at all. Sending the one already on screen would be an answer
      // arriving after its deadline, which the server records as a proctoring
      // flag — earned by pressing Next on a question the student was invited to
      // look back at.
      const value = current.questionClosed ? {} : answers[current.question._id] || {};
      // Same reason as in `finish`, plus one of its own: the cursor is about to
      // move, and a draft in flight is aimed at where it used to be.
      await autosave.cancel();
      setBusy('advance');
      try {
        const served = await slowAware(() =>
          lmApi.answerAndAdvance(classId, attemptId, {
            // What this browser is already holding for the question after this
            // one. When it turns out to be the question being served, the reply
            // leaves the payload out — a key, or nothing at all.
            holding: prefetch.holding(),
            // Which question this answer belongs to. The server ignores the
            // request if the cursor has already moved past it, so pressing Next
            // again after a reply went missing cannot answer the wrong question.
            questionId: current.question._id,
            selected: value.selected || [],
            text: value.text || '',
            direction,
            autoSubmitted,
          }),
        );
        if (served.done) {
          finishedRef.current = true;
          setCurrent(null);
          const finished = await lmApi.getAttempt(classId, attemptId);
          setAttempt(finished.attempt);
          setResult(finished);
          return;
        }
        // Fills in the question when the reply left it out because we already
        // held it, sealed or otherwise.
        const next = await materialise(served);
        setCurrent(next);
        applyServerAnswers(
          next.saved
            ? { [next.question._id]: { selected: next.saved.selected || [], text: next.saved.text || '' } }
            : {},
        );
        scrollStageToTop();
      } catch (err) {
        // The server ended the sitting under us — a device change, or a
        // violation that landed first. Show the result rather than an error on
        // a paper the student can no longer write on.
        if (err?.payload?.code === 'TERMINATED' || err?.payload?.code === 'FINISHED') {
          finishedRef.current = true;
          const finished = await lmApi.getAttempt(classId, attemptId).catch(() => null);
          if (finished) {
            setAttempt(finished.attempt);
            setResult(finished);
            return;
          }
        }
        notify({ status: 'error', title: saveFailureMessage(err) });
      } finally {
        setBusy('');
      }
    },
    [current, answers, classId, attemptId, notify, slowAware, autosave, applyServerAnswers, prefetch, materialise],
  );

  /**
   * The countdown, in `useQuizCountdown` so what stops it can be tested.
   *
   * `Boolean(result)` is the finished flag rather than `finishedRef`: a ref does
   * not re-run an effect, which is why the old interval outlived the attempt.
   */
  const remaining = useQuizCountdown({
    deadline,
    departed,
    finished: Boolean(result),
    onExpire: () => {
      // A per-question clock only ends that question; the paper clock ends the
      // whole sitting. On a question that is already closed the deadline being
      // counted is the paper's — its own ran out long ago — so advancing there
      // would carry the student forward on the wrong clock's expiry.
      if (sequential && settings?.perQuestionTiming && !current?.questionClosed) advance('forward', true);
      else finish(true);
    },
  });

  /* ------------------------------ render ------------------------------- */

  // Which questions count as attempted — the navigator, the progress bar and
  // the submit guard all read the same set, so they can never disagree.
  const answeredIds = useMemo(
    () =>
      new Set(
        Object.entries(answers)
          .filter(([, value]) => (value.selected || []).length || String(value.text || '').trim())
          .map(([questionId]) => questionId),
      ),
    [answers],
  );
  const answeredCount = answeredIds.size;

  const total = sequential ? current?.totalQuestions || 0 : paper?.questions?.length || 0;
  const position = sequential ? (current?.cursor ?? 0) + 1 : answeredCount;
  const unansweredCount = sequential ? 0 : Math.max(0, total - answeredCount);
  const percentComplete = total ? Math.round((answeredCount / total) * 100) : 0;

  const goToQuestion = useCallback((questionId) => {
    questionRefs.current[questionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const attemptSubmit = useCallback(() => {
    if (unansweredCount > 0 && !confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    finish(false);
  }, [unansweredCount, confirmSubmit, finish]);

  const inFullscreen = proctoring.isFullscreen;
  const finished = Boolean(result) && Boolean(attempt) && attempt.status !== 'in_progress';

  /**
   * When the paper is shown without the browser being in fullscreen.
   *
   * Two cases, and neither is a concession — in both, waiting for fullscreen
   * withholds the paper without buying any enforcement:
   *
   *   **Inside Safe Exam Browser.** The machine is already a kiosk: no chrome,
   *   no other application, no second window. There is nothing left for the
   *   page's own fullscreen to add. SEB for macOS renders in a WKWebView that
   *   may expose no Fullscreen API at all, so the gate could not be satisfied
   *   from inside the very browser the exam demanded — which is how a student
   *   who did everything right ended up on this screen with their clock running.
   *
   *   **A browser that cannot.** WebKit before Safari 16.4 has only the
   *   prefixed API, and `quizStage` now speaks it; where not even that exists,
   *   the request can never succeed and the button can never work.
   *
   * What is *not* relaxed: leaving the window, switching tab and — where it
   * applies — the keyboard lockdown are all watched exactly as before, and still
   * end the sitting. Those need no fullscreen to observe. `sebBypassed` is
   * deliberately not here either: a student let in on the access code is in an
   * ordinary browser, and the gate is the only thing holding that screen down.
   */
  const fullscreenExempt = Boolean(attempt?.sebVerified) || !fullscreenSupported();

  /**
   * Whether the stage should be putting itself fullscreen.
   *
   * True from the first frame, loading included: the request has to go out while
   * the "Start test" click still counts as a user gesture, and gating it on a
   * paper that has not been fetched yet spends exactly that window — the fetch
   * lands, the request goes out with nothing behind it, and the browser refuses.
   * It goes false only once there is nothing left to sit, so neither a submitted
   * paper nor a sitting closed by leaving gets pulled back into fullscreen.
   */
  const wantsFullscreen = !finished && !departed;

  // The screen is handed back by leaving, not by submitting: the stage drops
  // fullscreen when it unmounts, so the result is read on the same canvas the
  // paper was written on and nothing jumps at the moment of submitting.

  const pending = attempt?.resultsPending;

  let content;
  if (loading) content = <Loading label="Loading your paper…" />;
  else if (error?.payload?.code === 'SESSION_CONFLICT') {
    /* ---- second screen ----
       Deliberately not an ErrorState with a Retry button: retrying is exactly
       what a student trying to open the paper on a second device would do, and
       the fix is not here — it is on the machine they started on. */
    content = (
      <SectionCard title="This test is open somewhere else">
        <Alert status="error" borderRadius="md" mb={4}>
          <AlertIcon />
          <Box>
            <Text fontWeight="600">Your test is already running in another browser</Text>
            <Text fontSize="sm">{error.message}</Text>
          </Box>
        </Alert>
        <Text fontSize="sm" color="lmFg.subtle">
          Your clock is still running, and your answers are safe. If the other browser has
          closed or crashed, wait a couple of minutes and reload this page — it will let you
          back in once that one has stopped responding.
        </Text>
      </SectionCard>
    );
  } else if (error) content = <ErrorState error={error} onRetry={load} />;
  else if (departed) {
    /* ---- left the test screen ----
       The paper is over. Shown while the server is still being told, and shown
       instead of the result if that report could not be delivered at all.

       Ahead of `finished`, and this is the whole reason it moved: the server's
       reply arrives a moment later and swaps the whole screen for the result
       card, so the student who has just been told their test closed loses that
       message mid-sentence and is handed a score instead. The paper ended by
       leaving; what they need on screen is why, and it has to stay put long
       enough to read.

       For the same reason the text is fixed rather than `proctoring.warning`:
       that value arrives from the server after the departure has already been
       announced locally, and rewriting the paragraph under someone's eyes is
       what made this screen unreadable. The alert above already says what
       leaving costs, in the same words the brief used.

       There is deliberately **no way back into the paper**. The old screen
       offered "Enter fullscreen and continue" and said the clock was still
       running, which contradicted the rule the brief promises and the server
       enforces — and on a dropped connection it was a real way to leave, come
       back, and carry on with only the lost seconds to show for it. Re-entering
       fullscreen does not reopen a paper that leaving has closed. The only
       button here leaves for good. */
    content = (
      <SectionCard title="Your test has been closed">
        <Alert status="error" borderRadius="md" mb={4}>
          <AlertIcon />
          <Box>
            <Text fontWeight="600">You left the test screen</Text>
            <Text fontSize="sm">{LEAVING_COST}</Text>
          </Box>
        </Alert>
        <Text fontSize="sm" color="lmFg.body">
          Your answers so far are being submitted. This paper cannot be reopened — speak to your
          teacher if you believe this was a mistake.
        </Text>
        <Button mt={4} onClick={() => navigate(`/learning/class/${classId}/quizzes`)}>
          Back to quizzes
        </Button>
      </SectionCard>
    );
  } else if (finished) {
    /* ---- finished: show the result ---- */
    content = (
      <Box>
        <SectionCard title="Test submitted">
          {attempt.status === 'terminated' && (
            <Alert status="error" borderRadius="md" mb={4}>
              <AlertIcon />
              <Box>
                <Text fontWeight="600">This attempt was ended automatically</Text>
                <Text fontSize="sm">{attempt.terminationReason}</Text>
              </Box>
            </Alert>
          )}

          {pending ? (
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Box>
                <Text fontWeight="600">Your answers are saved</Text>
                <Text fontSize="sm">
                  {attempt.resultReleaseAt
                    ? `Results for the whole class are announced on ${formatDateTime(attempt.resultReleaseAt)}. You will be notified, and the subject will be marked on your dashboard.`
                    : 'Your teacher releases the results for the whole class together. You will be notified when they do.'}
                </Text>
              </Box>
            </Alert>
          ) : (
            <>
              {/* Stats Cards */}
              <Flex gap={3} wrap="wrap" mb={4}>
                <StatTile label="Score" value={`${attempt.score ?? '—'}/${attempt.maxScore ?? '—'}`} />
                <StatTile
                  label="Percent"
                  value={attempt.percent === undefined ? '—' : `${attempt.percent}%`}
                  accent="blue.500"
                />
                <StatTile label="Correct" value={attempt.totalCorrect ?? '—'} accent="green.500" />
                <StatTile label="Wrong" value={attempt.totalWrong ?? '—'} accent="red.500" />
                {attempt.negativeApplied > 0 && (
                  <StatTile label="Negative" value={`−${attempt.negativeApplied}`} accent="red.500" />
                )}
              </Flex>

              <Progress
                value={attempt.percent || 0}
                colorScheme="purple"
                borderRadius="full"
                mb={4}
              />

              {attempt.sectionScores?.length > 1 && (
                <Box mb={4}>
                  <Heading size="xs" mb={2}>
                    By section
                  </Heading>
                  {attempt.sectionScores.map((section) => (
                    <Flex key={section.sectionName} justify="space-between" fontSize="sm" py={1}>
                      <Text>{section.sectionName}</Text>
                      <HStack spacing={3}>
                        <Text color="green.600">{section.correct} ✓</Text>
                        <Text color="red.600">{section.wrong} ✗</Text>
                        <Text fontWeight="600">
                          {section.score}/{section.maxScore}
                        </Text>
                      </HStack>
                    </Flex>
                  ))}
                </Box>
              )}
            </>
          )}

          <Button mt={2} onClick={() => navigate(`/learning/class/${classId}/quizzes`)}>
            Back to quizzes
          </Button>
        </SectionCard>

        {result.review ? (
          <Box mt={4}>
            <QuizReview review={result.review} />
          </Box>
        ) : (
          result.answerKeyHidden && (
            /* The marks are out and the paper is open, but the teacher turned
               "show correct answers and explanations after submitting" off —
               which the exam presets do by default. Said plainly, because to a
               student the screen is otherwise indistinguishable from a page that
               failed to load the questions. */
            <Alert status="info" borderRadius="md" mt={4}>
              <AlertIcon />
              <Box>
                <Text fontWeight="600">The answers are not being shown for this test</Text>
                <Text fontSize="sm">
                  Your teacher has kept the question paper and the answer key back — your marks above
                  are the whole of what was released. Ask them if you want to go through your paper.
                </Text>
              </Box>
            </Alert>
          )
        )}
      </Box>
    );
  } else if (!inFullscreen && !fullscreenExempt) {
    /* ---- entry gate ----
       Only for a student who has *not* left: the browser refused fullscreen with
       no user gesture behind it, or the tab was reloaded. They never got in, so
       there is nothing to hold against them and the button is the way in. A
       departure is caught by the branch above, which has no button.

       And only for a student the gate can actually be satisfied by — see
       `fullscreenExempt`. It used to stand in front of everyone, including the
       browsers where pressing the button did nothing at all. */
    content = (
      <SectionCard title="Fullscreen required">
        <Alert status="warning" borderRadius="md" mb={4}>
          <AlertIcon />
          <Box>
            <Text fontWeight="600">This test is taken in fullscreen only</Text>
            <Text fontSize="sm">{LEAVING_COST}</Text>
          </Box>
        </Alert>
        {/* Truthfully: the clock is *not* paused here. The deadline is an absolute
            time the server derived from when the attempt started, so sitting on
            this screen costs real minutes and nothing on the client can change
            that. Saying otherwise would be a kindness that loses someone marks. */}
        <Text fontSize="sm" color="lmFg.subtle" mb={4}>
          Your clock is already running, so enter fullscreen now. Once you are in, leaving again ends
          the test.
        </Text>
        <Button colorScheme="purple" onClick={requestQuizFullscreen}>
          Enter fullscreen and start
        </Button>
      </SectionCard>
    );
  } else {
    content = (
      <Box userSelect={settings?.disableCopyPaste ? 'none' : undefined}>
        {/* ---- sticky status bar ----
            The progress bar lives inside it rather than below it: on a long
            single-page paper the one thing a student wants while scrolling is
            how much is left, and anything above the fold scrolls away. */}
        <Box
          position="sticky"
          top={0}
          zIndex={5}
          bg="lmBg.surface"
          borderWidth="1px"
          borderColor="lmBorder.base"
          borderRadius="lg"
          mb={4}
          overflow="hidden"
          boxShadow="sm"
        >
          <Flex px={4} py={3} justify="space-between" align="center" gap={3} wrap="wrap">
            <Box>
              <HStack spacing={2}>
                <Text fontSize="sm" fontWeight="600">
                  {sequential ? `Question ${position} of ${total}` : `${answeredCount} of ${total} answered`}
                </Text>
                {!sequential && total > 0 && (
                  <Badge colorScheme={percentComplete === 100 ? 'green' : 'purple'} borderRadius="full">
                    {percentComplete}%
                  </Badge>
                )}
                {/* Deliberately small and grey. It answers "did that register?"
                    for a student who glances at it, and is ignorable for one who
                    does not — an answer being banked is not news, and a retry is
                    not an error worth interrupting a question for. */}
                {autosave.status !== 'idle' && (
                  <Text fontSize="xs" color={autosave.status === 'retrying' ? 'orange.600' : 'lmFg.muted'}>
                    {autosave.status === 'saving'
                      ? 'Saving…'
                      : autosave.status === 'saved'
                        ? '✓ Answer saved'
                        : 'Not saved yet — retrying'}
                  </Text>
                )}
              </HStack>
              {!sequential && unansweredCount > 0 && (
                <Text fontSize="xs" color="lmFg.muted">
                  {unansweredCount} still blank
                </Text>
              )}
              {current?.section && (
                <Badge colorScheme="purple" fontSize="0.65rem">
                  {current.section}
                </Badge>
              )}
            </Box>
            <HStack>
              <Badge colorScheme="red">Fullscreen only</Badge>
              {/* An untimed paper says so rather than leaving a gap where a
                  clock would be: "no timer" and "the timer failed to load" look
                  identical when both are blank, and only one is worth worrying
                  about five minutes into an exam. */}
              {remaining !== null ? (
                <Badge
                  colorScheme={remaining < 30 ? 'red' : remaining < 120 ? 'orange' : 'green'}
                  fontSize="md"
                  px={3}
                  py={1}
                  borderRadius="md"
                >
                  ⏱ {clock(remaining)}
                </Badge>
              ) : (
                <Badge colorScheme="gray" px={3} py={1} borderRadius="md">
                  No time limit
                </Badge>
              )}
              {!sequential && (
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={busy === 'save'}
                  onClick={async () => {
                    // The autosave writes the same attempt document; two of
                    // these at once is the version clash all over again.
                    await autosave.cancel();
                    setBusy('save');
                    try {
                      await lmApi.saveAttemptDraft(classId, attemptId, payload());
                      notify({ status: 'success', title: 'Progress saved', duration: 1500 });
                    } catch (err) {
                      notify({ status: 'error', title: saveFailureMessage(err) });
                    } finally {
                      setBusy('');
                    }
                  }}
                >
                  Save
                </Button>
              )}
              {!sequential && (
                <Button size="sm" colorScheme="purple" onClick={attemptSubmit} isLoading={busy === 'submit'}>
                  Submit test
                </Button>
              )}
            </HStack>
          </Flex>
          {total > 0 && (
            <Progress
              value={sequential ? (position / total) * 100 : percentComplete}
              size="sm"
              colorScheme={!sequential && percentComplete === 100 ? 'green' : 'purple'}
              hasStripe={!sequential && percentComplete < 100}
              aria-label="Quiz progress"
            />
          )}
          {/* Submitting is irreversible, so a blank question is named before it
              is accepted. It lives in the sticky bar rather than beside either
              Submit button so it is visible wherever the student pressed one —
              and inline rather than in a modal, which would portal to
              document.body and disappear behind a fullscreened paper. */}
          {confirmSubmit && unansweredCount > 0 && (
            <Flex
              bg="lmHue.orange50"
              borderTopWidth="1px"
              borderColor="lmHue.orange200"
              px={4}
              py={2}
              gap={2}
              align="center"
              wrap="wrap"
            >
              <Text fontSize="sm" flex="1" minW="200px">
                {unansweredCount} question{unansweredCount === 1 ? ' is' : 's are'} still blank.
              </Text>
              <Button size="xs" variant="ghost" onClick={() => setConfirmSubmit(false)}>
                Keep working
              </Button>
              <Button size="xs" colorScheme="purple" onClick={() => finish(false)} isLoading={busy === 'submit'}>
                Submit anyway
              </Button>
            </Flex>
          )}
        </Box>

        {/* The rule that ends the paper without warning, kept on screen for the
            whole sitting rather than only in the brief: a student who is about
            to reach for another window is the one person who needs it.

            The keyboard line sits with it for the same reason, and is said
            standing rather than only when a key is pressed — a student who never
            touches the keyboard should still know why the field will not take
            typing, and one who is about to should know what it costs before the
            warnings start rather than after. */}
        <Alert status="warning" borderRadius="md" mb={4} py={2}>
          <AlertIcon />
          <Box flex="1">
            <Text fontSize="sm">{LEAVING_COST}</Text>
            {settings.keyboardLockdown !== false && (
              <Text fontSize="sm">{KEYBOARD_COST}</Text>
            )}
          </Box>
        </Alert>

        {/* Not dismissible, and no retry button: the request is still running,
            and the one thing that must not happen is the student going looking
            for a way out of the screen. */}
        {slow && (
          <Alert status="info" borderRadius="md" mb={4}>
            <AlertIcon />
            <Box flex="1">
              <Text fontWeight="600">Still saving — the connection is slow</Text>
              <Text fontSize="sm">
                Your answer has been sent and is not lost. Please wait. Do not reload, and do not
                switch to another window or tab — leaving this screen ends your test.
              </Text>
            </Box>
          </Alert>
        )}

        {notice && (
          <Alert status={notice.status || 'info'} borderRadius="md" mb={4}>
            <AlertIcon />
            <Box flex="1">{notice.title}</Box>
            <Button size="xs" variant="ghost" onClick={() => setNotice(null)}>
              Dismiss
            </Button>
          </Alert>
        )}

        {proctoring.warning && (
          <Alert status="warning" borderRadius="md" mb={4}>
            <AlertIcon />
            <Box flex="1">{proctoring.warning}</Box>
            <Button size="xs" variant="ghost" onClick={proctoring.dismissWarning}>
              Dismiss
            </Button>
          </Alert>
        )}

        {/* ---- question navigator ----
            Free navigation is the point of this mode, but on a twenty-question
            paper scrolling is a poor way to exercise it. The grid doubles as
            the "what have I missed" view the progress bar can only summarise. */}
        {!sequential && total > 1 && (
          <SectionCard mb={4} p={4}>
            <Flex justify="space-between" align="center" gap={3} wrap="wrap" mb={3}>
              <Text fontSize="xs" fontWeight="700" color="lmFg.subtle" textTransform="uppercase" letterSpacing="wide">
                Jump to question
              </Text>
              <HStack spacing={3} fontSize="0.65rem" color="lmFg.muted">
                <HStack spacing={1.5}>
                  <Box w="10px" h="10px" borderRadius="sm" bg="purple.500" />
                  <Text>Answered</Text>
                </HStack>
                <HStack spacing={1.5}>
                  <Box w="10px" h="10px" borderRadius="sm" borderWidth="1px" borderColor="lmBorder.strong" />
                  <Text>Blank</Text>
                </HStack>
              </HStack>
            </Flex>
            <Flex wrap="wrap" gap={2}>
              {paper.questions.map((question, index) => {
                const done = answeredIds.has(question._id);
                return (
                  <Button
                    key={question._id}
                    size="sm"
                    minW="38px"
                    px={0}
                    fontSize="xs"
                    variant={done ? 'solid' : 'outline'}
                    colorScheme={done ? 'purple' : 'gray'}
                    color={done ? undefined : 'lmFg.subtle'}
                    onClick={() => goToQuestion(question._id)}
                    aria-label={`Question ${index + 1}, ${done ? 'answered' : 'not answered'}`}
                  >
                    {index + 1}
                  </Button>
                );
              })}
            </Flex>
          </SectionCard>
        )}

        {/* ---- sequential: one question ---- */}
        {sequential && current && (
          <SectionCard>
            <Flex justify="space-between" gap={3} mb={3}>
              <Box flex="1" minW={0}>
                <Text fontWeight="600" fontSize="sm" mb={1}>
                  Question {position}
                </Text>
                <RichText>{current.question.question}</RichText>
              </Box>
              <HStack flexShrink={0} align="start" spacing={2}>
                {TYPE_LABEL[current.question.type] && (
                  <Badge colorScheme="blue" variant="subtle">
                    {TYPE_LABEL[current.question.type]}
                  </Badge>
                )}
                <Badge colorScheme="gray">
                  {current.question.marks} mark{current.question.marks === 1 ? '' : 's'}
                </Badge>
              </HStack>
            </Flex>

            {/* Only reachable by going back to a question whose own allowance
                already ran out. It is shown rather than skipped — a student who
                asked to see it is owed the sight of what they answered — but it
                cannot be written on, and the server would refuse the answer
                anyway. */}
            {current.questionClosed && (
              <Alert status="warning" borderRadius="md" mb={3} fontSize="sm">
                <AlertIcon />
                This question&apos;s time has run out. You can see it and your answer, but you cannot
                change it.
              </Alert>
            )}

            <AnswerInput
              question={current.question}
              value={answers[current.question._id] || {}}
              onChange={(value) => setAnswers({ [current.question._id]: value })}
              isDisabled={current.questionClosed}
              keypadOnly={Boolean(settings.keyboardLockdown)}
            />

            <Divider my={4} />
            <Flex gap={2} wrap="wrap">
              {current.canGoBack && (
                <Button size="sm" variant="outline" onClick={() => advance('back')} isLoading={busy === 'advance'}>
                  ← Previous
                </Button>
              )}
              <Box flex="1" />
              <Button size="sm" colorScheme="purple" onClick={() => advance('forward')} isLoading={busy === 'advance'}>
                {position >= total ? 'Finish test' : current.questionClosed ? 'Next →' : 'Save & next →'}
              </Button>
            </Flex>
            {!settings?.allowBacktracking ? (
              <Text fontSize="xs" color="lmFg.muted" mt={2}>
                You cannot return to this question once you move on.
              </Text>
            ) : (
              settings?.perQuestionTiming && (
                <Text fontSize="xs" color="lmFg.muted" mt={2}>
                  You may come back to this question — it will resume with whatever time it has left.
                </Text>
              )
            )}
          </SectionCard>
        )}

        {/* ---- all at once: full paper ---- */}
        {!sequential &&
          paper?.questions.map((question, index) => {
            const done = answeredIds.has(question._id);
            return (
              // SectionCard is a plain function component, so the scroll target
              // is this wrapper. The margin keeps the sticky bar from landing on
              // top of the question the navigator just jumped to.
              <Box
                key={question._id}
                ref={(node) => {
                  questionRefs.current[question._id] = node;
                }}
                scrollMarginTop="96px"
              >
                <SectionCard
                  mb={3}
                  borderLeftWidth="3px"
                  borderLeftColor={done ? 'purple.400' : 'transparent'}
                  transition="border-color 0.2s"
                >
                  <Flex justify="space-between" gap={3} mb={3}>
                    <Box flex="1" minW={0}>
                      <HStack mb={2} spacing={2}>
                        <Flex
                          align="center"
                          justify="center"
                          w="24px"
                          h="24px"
                          borderRadius="md"
                          flexShrink={0}
                          fontSize="xs"
                          fontWeight="700"
                          bg={done ? 'purple.500' : 'lmBg.track'}
                          color={done ? 'lmFg.onAccent' : 'lmFg.subtle'}
                        >
                          {index + 1}
                        </Flex>
                        {question.sectionName && (
                          <Badge colorScheme="purple" fontSize="0.6rem">
                            {question.sectionName}
                          </Badge>
                        )}
                        {!done && (
                          <Badge colorScheme="gray" fontSize="0.6rem" variant="outline">
                            Not answered
                          </Badge>
                        )}
                      </HStack>
                      <RichText>{question.question}</RichText>
                    </Box>
                    <HStack flexShrink={0} h="fit-content" spacing={2}>
                      {TYPE_LABEL[question.type] && (
                        <Badge colorScheme="blue" variant="subtle">
                          {TYPE_LABEL[question.type]}
                        </Badge>
                      )}
                      <Badge colorScheme="gray">
                        {question.marks} mark{question.marks === 1 ? '' : 's'}
                      </Badge>
                    </HStack>
                  </Flex>
                  <AnswerInput
                    question={question}
                    value={answers[question._id] || {}}
                    onChange={(value) => setAnswers((prev) => ({ ...prev, [question._id]: value }))}
                    keypadOnly={Boolean(settings.keyboardLockdown)}
                  />
                </SectionCard>
              </Box>
            );
          })}

        {!sequential && (
          <Button
            colorScheme="purple"
            size="lg"
            w="100%"
            mt={2}
            onClick={attemptSubmit}
            isLoading={busy === 'submit'}
          >
            Submit test ({answeredCount}/{total} answered)
          </Button>
        )}

        {/* Floats over the paper on its own fixed layer, so it is reachable
            from any question in either delivery mode without moving anything
            the student is reading. */}
        {settings?.allowCalculator !== false && <QuizCalculator />}
      </Box>
    );
  }

  /**
   * The stage owns the screen — it is already fullscreen when the brief handed
   * over, and it covers the app either way, so the module header, class header
   * and tabs never appear beside a live paper.
   */
  return (
    <QuizStage
      subject={[banner.subject, klass?.subject, klass?.name].find(Boolean)}
      faculty={[banner.facultyName, klass?.ownerName].find(Boolean)}
      title={banner.title}
      autoFullscreen={wantsFullscreen}
    >
      {content}
    </QuizStage>
  );
}
