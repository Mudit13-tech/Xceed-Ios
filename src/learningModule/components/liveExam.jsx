import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Progress,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useToast,
} from '@chakra-ui/react';

import lmApi from '../api/lmApi';
import ExamCodes from './ExamCodes';
import { SectionCard } from './common';
import { formatDateTime, relativeTime } from '../format';

/**
 * The mid-exam control panel, and the pieces of the invigilation views it
 * shares with the results page.
 *
 * It lives here rather than inside `QuizResults` because the panel is wanted in
 * two places at once and for the same reason: while a hall is sitting, the
 * question is "who needs me right now", and the answer must be one click from
 * wherever staff happen to be. That is the quiz list — the page a teacher opens
 * when the exam starts — so the control hangs off the card, and the results
 * page keeps the deeper monitor and the per-student fixes.
 */

export const nameOf = (person) => person.studentName || person.studentEmail || 'Unknown student';


/**
 * The roll number, on its own line under the name.
 *
 * Below rather than trailing the name because a hall is ordered by roll number,
 * not alphabetically: staff reading this panel are matching a number off a
 * seating list, and a badge that starts wherever the name happens to end sits
 * in a different place on every row. Under the name it forms a column the eye
 * can run down.
 */
export function RollNumber({ value }) {
  if (!value) return null;
  return (
    <Badge fontSize="0.6rem" mt={0.5}>
      {value}
    </Badge>
  );
}


/** How often the invigilation view re-reads the server while it is open. */
export const LIVE_POLL_MS = 15000;


/** The invigilation ring's colour on a quiz that has never been given one.
    Matches the server's fallback and ExamPulse's own default. */
const DEFAULT_PULSE_COLOR = '#3884ff';


/**
 * A once-a-second re-render, so countdowns tick without the page re-fetching.
 *
 * Only mounted by the monitor view: a timer running behind the analytics tabs
 * would re-render tables that cannot change between polls.
 */
export function useSecondTick(enabled) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [enabled]);
}


export function AttemptFlags({ attempt }) {
  const fullscreen = (attempt.violations || []).filter((v) => v.type === 'fullscreen_exit').length;
  /* Worth its own badge now that a keypress no longer ends the paper on sight.
     Under the allowance a sitting can carry two of these and finish normally, so
     without this the only record of them is the violation list a teacher has to
     open the attempt to read — and two warned keypresses on an otherwise clean
     paper is exactly the thing worth noticing from the list. */
  const keys = (attempt.violations || []).filter((v) => v.type === 'key_press').length;
  return (
    <>
      {/* Only one of these can be set, and only on a paper that asked for SEB,
          so an ordinary quiz shows neither badge. The "no SEB" case is the one
          worth the loud colour: that sitting is running in a browser the
          lockdown does not cover. */}
      {attempt.sebBypassed ? (
        <Tooltip
          label={`Sitting outside Safe Exam Browser${
            attempt.sebBypassAt ? ` since ${relativeTime(attempt.sebBypassAt)}` : ''
          }`}
        >
          <Badge colorScheme="red" fontSize="0.6rem" mr={1}>
            no SEB
          </Badge>
        </Tooltip>
      ) : (
        attempt.sebVerified && (
          <Tooltip label="Verified Safe Exam Browser session">
            <Badge colorScheme="green" fontSize="0.6rem" mr={1}>
              SEB
            </Badge>
          </Tooltip>
        )
      )}
      {attempt.tabSwitches > 0 && (
        <Badge colorScheme="orange" fontSize="0.6rem" mr={1}>
          {attempt.tabSwitches}× away
        </Badge>
      )}
      {fullscreen > 0 && (
        <Tooltip label={`Left fullscreen ${fullscreen} time(s)`}>
          <Badge colorScheme="purple" fontSize="0.6rem" mr={1}>
            fs {fullscreen}
          </Badge>
        </Tooltip>
      )}
      {/* Loudest badge on the row, and the only one that asks staff to leave
          their seat. A paper requiring SEB refuses to start in a VM at all, so
          this means SEB itself has been modified — see services/vmSignals. */}
      {attempt.vmSuspicion?.flaggedAt && !attempt.vmSuspicion?.clearedAt && (
        <Tooltip label={(attempt.vmSuspicion.reasons || []).join('; ') || 'Environment looks virtual'}>
          <Badge colorScheme="red" variant="solid" fontSize="0.6rem" mr={1}>
            check laptop
          </Badge>
        </Tooltip>
      )}
      {attempt.vmSuspicion?.clearedAt && (
        <Tooltip label={`Laptop checked by ${attempt.vmSuspicion.clearedBy || 'staff'}`}>
          <Badge colorScheme="gray" fontSize="0.6rem" mr={1}>
            checked
          </Badge>
        </Tooltip>
      )}
      {keys > 0 && (
        <Tooltip label={`Pressed a key ${keys} time(s) with the keyboard locked`}>
          <Badge colorScheme="orange" fontSize="0.6rem" mr={1}>
            keys {keys}
          </Badge>
        </Tooltip>
      )}
      {attempt.device?.isMobile && (
        <Badge colorScheme="gray" fontSize="0.6rem" mr={1}>
          mobile
        </Badge>
      )}
      {attempt.gateFailures > 1 && (
        <Tooltip label={`Typed a wrong ${attempt.gateFailureType === 'room' ? 'room' : 'access'} code ${attempt.gateFailures} time(s) before starting`}>
          <Badge colorScheme="orange" variant="solid" fontSize="0.6rem" mr={1}>
            {attempt.gateFailures}× code
          </Badge>
        </Tooltip>
      )}
      {attempt.webcam?.flaggedAt && !attempt.webcam?.clearedAt && (
        <Tooltip
          label={
            attempt.webcam.unavailableReason
              ? 'Started on a machine with no usable camera'
              : attempt.webcam.blockedCount > 0
                ? 'Webcam went dark during the sitting'
                : `No face on camera ${attempt.webcam.noFaceCount || 0} time(s)`
          }
        >
          <Badge colorScheme="red" variant="solid" fontSize="0.6rem" mr={1}>
            {attempt.webcam.unavailableReason
              ? 'no camera'
              : attempt.webcam.blockedCount > 0
                ? 'camera off'
                : 'no face'}
          </Badge>
        </Tooltip>
      )}
      {attempt.webcam?.waivedByName && (
        <Tooltip label={`Webcam waived by ${attempt.webcam.waivedByName}`}>
          <Badge colorScheme="gray" fontSize="0.6rem" mr={1}>
            webcam waived
          </Badge>
        </Tooltip>
      )}
      {attempt.regradedAt && (
        <Tooltip
          label={`Re-marked ${relativeTime(attempt.regradedAt)}${
            attempt.regradedByName ? ` by ${attempt.regradedByName}` : ''
          }`}
        >
          <Badge colorScheme="blue" fontSize="0.6rem">
            re-marked
          </Badge>
        </Tooltip>
      )}
    </>
  );
}


/**
 * The narrow-screen shape of a monitor row.
 *
 * A nine-column invigilation table cannot be read on a phone, and side-scrolling
 * it hides exactly the column an invigilator reached for — the fixes. Below `lg`
 * each row becomes a card carrying the same facts stacked, so the same view
 * works in the app without a second screen being built for it.
 */
export function MonitorCard({ children, accent }) {
  return (
    <Box borderWidth="1px" borderColor="lmBorder.base" borderRadius="md" p={3} bg={accent}>
      {children}
    </Box>
  );
}

/** One label-over-value fact on a monitor card. */
export function CardFact({ label, children }) {
  return (
    <Box>
      <Text fontSize="0.6rem" color="lmFg.muted" textTransform="uppercase" fontWeight="700">
        {label}
      </Text>
      <Box fontSize="xs">{children}</Box>
    </Box>
  );
}


/**
 * How many minutes a shut-out student should get back.
 *
 * The time they lost is the time that was still on their clock when the paper
 * was taken off them — `submittedAt` is stamped at that moment for a
 * terminated sitting, and `durationSec` is how much of the limit they had
 * already used. Anything after that is time the invigilator spends finding
 * them, which is not the student's fault, so it is added on top.
 *
 * A paper with no whole-paper limit (untimed, or timed per question) has no
 * remainder to compute, so it falls back to the wait alone with a floor worth
 * handing back at all.
 */
export function minutesLostSinceTermination(quiz, attempt, now = new Date()) {
  const endedAt = attempt.submittedAt ? new Date(attempt.submittedAt) : null;
  const waitedMin = endedAt ? Math.max(0, Math.round((now - endedAt) / 60000)) : 0;

  // A sitting staff have already reopened once runs on the deadline they gave
  // it and on nothing else — the same rule `examEngine.attemptDeadline` applies
  // server-side. Measuring the second reopen against `timeLimitMinutes` from
  // `startedAt` instead would charge them for the whole first sitting *and* the
  // gap they spent shut out, so the remainder came out negative and the floor
  // below quietly handed back ten minutes on a paper with forty left.
  if (attempt.deadlineOverride && endedAt) {
    const leftMin = Math.ceil((new Date(attempt.deadlineOverride) - endedAt) / 60000);
    if (leftMin >= 1) return leftMin + waitedMin;
    return Math.max(10, waitedMin);
  }

  const limitMin = quiz?.settings?.timeLimitMinutes || 0;
  if (limitMin > 0) {
    const usedSec =
      attempt.durationSec ||
      (endedAt ? Math.max(0, (endedAt - new Date(attempt.startedAt)) / 1000) : 0);
    const leftMin = Math.ceil((limitMin * 60 - usedSec) / 60);
    if (leftMin >= 1) return leftMin + waitedMin;
  }
  return Math.max(10, waitedMin);
}

/**
 * When a sitting's paper clock runs out.
 *
 * The same three inputs `examEngine.attemptDeadline` uses, in the same order:
 * a reopened sitting runs on the deadline staff gave it and on nothing else,
 * otherwise it is whichever comes first of the whole-paper limit from when they
 * started and the moment the window shuts. Per-question timing is deliberately
 * left out — that clock ends a question, not the paper, so it is not what the
 * hall is waiting on.
 *
 * Null means there is nothing to count down: an untimed paper with no closing
 * time ends when the students say it does.
 */
export function paperDeadline(quiz, attempt) {
  if (attempt.deadlineOverride) return new Date(attempt.deadlineOverride);
  const candidates = [];
  const limitMin = quiz?.settings?.timeLimitMinutes || 0;
  if (limitMin > 0 && attempt.startedAt) {
    candidates.push(new Date(attempt.startedAt).getTime() + limitMin * 60000);
  }
  if (quiz?.settings?.availableTo) candidates.push(new Date(quiz.settings.availableTo).getTime());
  if (!candidates.length) return null;
  return new Date(Math.min(...candidates));
}

/** `h:mm:ss` once there is an hour to show, `m:ss` below that, never negative. */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (part) => String(part).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/**
 * How long after the window shuts a shut-out student can still be let back in
 * from this panel.
 *
 * Not zero, because the sitting this panel exists for is the one that ends
 * *at* the bell: a student thrown out at 10:59 on an 11:00 paper is found by
 * an invigilator at 11:01, and a control that vanished on the stroke of the
 * hour would send them to the results page for the one case it was built for.
 * Not open-ended either — that is the complaint this grace answers. Five
 * minutes is the walk from a seat to the invigilator's desk.
 */
export const LET_IN_GRACE_MS = 5 * 60 * 1000;

/** When Let in stops being offered here — null on a paper with no closing time. */
export function letInClosesAt(quiz) {
  const closesAt = quiz?.settings?.availableTo;
  if (!closesAt) return null;
  return new Date(new Date(closesAt).getTime() + LET_IN_GRACE_MS);
}

/**
 * Whether the exam is over, for the purpose of what this panel offers.
 *
 * Live control is an invigilation tool, and once the hall has emptied it stops
 * being one: handing back time on a paper that finished an hour ago is not a
 * decision made while walking a hall, it is an exception granted afterwards.
 * So the panel keeps *showing* who was shut out — that is the record staff came
 * for — and stops offering to reopen them. The exception still exists; it moved
 * to the results page, where it is a deliberate act with a confirmation on it.
 *
 * The results signals are read exactly as `examEngine.windowState` reads them,
 * so a paper that is closed there is closed here; only the closing time carries
 * the grace, because only the closing time arrives while people are still in
 * the room. Announced results, or a paper pulled from publication, are somebody
 * deciding it is finished — there is nothing to be late for.
 */
export function examIsOver(quiz, now = new Date()) {
  if (!quiz) return false;
  const settings = quiz.settings || {};

  const resultsPublished =
    (quiz.resultsAnnouncedAt && now >= new Date(quiz.resultsAnnouncedAt)) ||
    (settings.resultReleaseAt && now >= new Date(settings.resultReleaseAt));
  if (resultsPublished) return true;

  // Releasing results unpublishes the quiz, so this is rarely the signal that
  // fires first; it is here for the paper a teacher pulls down by hand to stop
  // it, which is as final a "this is over" as the clock running out.
  if (quiz.published === false) return true;

  const closes = letInClosesAt(quiz);
  return Boolean(closes && now >= closes);
}

/**
 * The clock at the top of the panel, and the counts beside it.
 *
 * It counts down to the *last* paper still running rather than the first,
 * because the question it answers is "how long am I invigilating for" — the
 * moment the hall empties. Individual students finishing earlier is what the
 * lists below are for. Nobody writing leaves the window's own closing time,
 * which is still the answer to how long latecomers can be let in for.
 */
export function LiveClock({ quiz, writing, submitted, shutOut, now }) {
  const deadlines = writing
    .map((attempt) => paperDeadline(quiz, attempt))
    .filter(Boolean)
    .map((date) => date.getTime());
  const windowClose = quiz?.settings?.availableTo
    ? new Date(quiz.settings.availableTo).getTime()
    : null;

  const endsAt = deadlines.length ? Math.max(...deadlines) : windowClose;
  const label = deadlines.length ? 'until the last paper ends' : 'until the window closes';
  const left = endsAt === null ? null : endsAt - now.getTime();
  // Under five minutes the number stops being background information and
  // becomes the thing to act on, so it is the one part of this header that
  // changes colour.
  const urgent = left !== null && left <= 5 * 60000;

  return (
    <Flex align="center" gap={5} wrap="wrap">
      <Box>
        <Text fontSize="0.6rem" color="lmFg.muted" textTransform="uppercase" fontWeight="700">
          Time left
        </Text>
        {left === null ? (
          <Text fontSize="lg" fontWeight="700" color="lmFg.muted">
            No clock
          </Text>
        ) : (
          <Tooltip label={`Ends ${formatDateTime(new Date(endsAt))}`}>
            <Text
              fontSize="2xl"
              fontWeight="700"
              lineHeight="1.1"
              fontVariantNumeric="tabular-nums"
              color={left <= 0 ? 'lmFg.muted' : urgent ? 'red.500' : undefined}
            >
              {formatCountdown(left)}
            </Text>
          </Tooltip>
        )}
        <Text fontSize="xs" color="lmFg.muted" fontWeight="400">
          {left === null ? 'Untimed, and no closing time set' : left <= 0 ? 'Time is up' : label}
        </Text>
      </Box>

      <HStack spacing={5} fontWeight="400">
        <Box>
          <Text fontSize="0.6rem" color="lmFg.muted" textTransform="uppercase" fontWeight="700">
            Writing
          </Text>
          <Text fontSize="xl" fontWeight="700" lineHeight="1.1">
            {writing.length}
          </Text>
        </Box>
        <Box>
          <Text fontSize="0.6rem" color="lmFg.muted" textTransform="uppercase" fontWeight="700">
            Submitted
          </Text>
          <Text fontSize="xl" fontWeight="700" lineHeight="1.1">
            {submitted}
          </Text>
        </Box>
        <Box>
          <Text fontSize="0.6rem" color="lmFg.muted" textTransform="uppercase" fontWeight="700">
            Shut out
          </Text>
          <Text
            fontSize="xl"
            fontWeight="700"
            lineHeight="1.1"
            color={shutOut > 0 ? 'red.500' : undefined}
          >
            {shutOut}
          </Text>
        </Box>
      </HStack>
    </Flex>
  );
}

/**
 * The one panel an invigilator keeps open while the exam runs.
 *
 * Everything here answers a question that is only asked mid-exam — who is
 * outside the lockdown, and who has been thrown out and needs letting back in
 * — which is why it is a modal over the page rather than another tab: it stays
 * up while the results page underneath keeps polling, and it closes when the
 * hall does.
 *
 * Letting a student back in is a single click on purpose. The minutes are
 * computed from when their paper was taken off them, so nobody does arithmetic
 * under pressure, and the number stays editable for what the clock cannot know.
 */
/**
 * The laptops an invigilator should walk over and look at.
 *
 * Sits above everything else in the panel, and is the only section that appears
 * and disappears on its own — an empty one renders nothing at all rather than
 * an empty state, because a permanent "no suspicious machines" card is a thing
 * staff learn to stop reading, and this is the one card that must be noticed the
 * moment it changes.
 *
 * The reasons are spelled out on the row rather than hidden behind a tooltip.
 * Whoever is holding this is walking towards a student and needs to know what
 * they are looking for before they arrive: "graphics adapter reports VMware" and
 * "only 2 CPU cores visible" call for different conversations, and neither is
 * legible as a score.
 *
 * Nothing here can terminate a sitting. That control exists elsewhere in this
 * panel and stays there deliberately — an alert built from values the suspect
 * machine reported about itself is a reason to look, never a reason to act, and
 * putting "end their exam" on this row would invite exactly the mistake the
 * whole design is arranged to prevent.
 */
function SuspectMachines({ attempts, classId, onDone, toast }) {
  const [busyId, setBusyId] = useState(null);

  const flagged = attempts.filter(
    (attempt) =>
      attempt.status === 'in_progress'
      && attempt.vmSuspicion?.flaggedAt
      && !attempt.vmSuspicion?.clearedAt,
  );

  if (flagged.length === 0) return null;

  const markChecked = async (attempt) => {
    setBusyId(attempt._id);
    try {
      await lmApi.markVmChecked(classId, attempt._id);
      toast({
        title: `${nameOf(attempt)}'s laptop marked as checked`,
        description: 'The alert is cleared. Their sitting is untouched — end it from the list below if you need to.',
        status: 'success',
        duration: 5000,
      });
      onDone();
    } catch (err) {
      toast({ title: err.message || 'Could not clear the alert', status: 'error', duration: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Alert status="error" variant="left-accent" flexDirection="column" alignItems="stretch" mb={4} borderRadius="md">
      <Flex align="center" mb={2}>
        <AlertIcon />
        <Text fontSize="sm" fontWeight="700">
          {flagged.length} laptop{flagged.length === 1 ? '' : 's'} to check now
        </Text>
      </Flex>
      <Text fontSize="xs" color="lmFg.muted" mb={3}>
        These machines describe themselves as virtual. A paper requiring Safe Exam Browser cannot
        start inside a VM, so this means SEB has been modified — but the machine is the only witness,
        so please look at the screen yourself before doing anything.
      </Text>
      <Stack spacing={3}>
        {flagged.map((attempt) => (
          <Box key={attempt._id} borderWidth="1px" borderRadius="md" p={3} bg="lmBg.surface">
            <Flex align="center" gap={2} wrap="wrap" mb={1}>
              <Text fontSize="sm" fontWeight="600">
                {nameOf(attempt)}
              </Text>
              {attempt.rollNumber && (
                <Badge fontSize="0.6rem" colorScheme="blue">
                  {attempt.rollNumber}
                </Badge>
              )}
              <Text fontSize="xs" color="lmFg.muted">
                flagged {relativeTime(attempt.vmSuspicion.flaggedAt)}
              </Text>
            </Flex>
            <Stack spacing={0} mb={2}>
              {(attempt.vmSuspicion.reasons || []).map((reason) => (
                <Text key={reason} fontSize="xs" color="lmFg.muted">
                  • {reason}
                </Text>
              ))}
            </Stack>
            <Button
              size="xs"
              variant="outline"
              isLoading={busyId === attempt._id}
              onClick={() => markChecked(attempt)}
            >
              I have checked this laptop
            </Button>
          </Box>
        ))}
      </Stack>
    </Alert>
  );
}


/**
 * Repeated wrong code entries, raised to the invigilator.
 *
 * A student fumbling their own code once is nothing; a run of them — a room code
 * tried and rejected over and over, most tellingly by somebody who never started
 * the paper — is the shape of someone trying to get into a test they are not
 * sitting in front of. Built from both the sittings and the no-shows, because the
 * row that matters most carries no attempt at all.
 *
 * A flag, not a verdict: like the VM panel, it says "go and look", and it can end
 * nothing. The server already blocks a genuine grind (a two-minute pause past a
 * handful of wrong entries); this is so an invigilator sees the grind happening.
 */
export const REPEAT_GUESS_THRESHOLD = 2;
const codeLabel = (type) => (type === 'room' ? 'room-code' : type === 'access' ? 'access-code' : 'code');

function CodeGuessAlerts({ attempts, notStarted }) {
  const rows = [
    ...attempts.map((attempt) => ({
      id: String(attempt.studentId || attempt._id),
      name: nameOf(attempt),
      rollNumber: attempt.rollNumber,
      count: attempt.gateFailures || 0,
      type: attempt.gateFailureType,
      where: attempt.status === 'in_progress' ? 'writing now' : 'already submitted',
    })),
    ...notStarted.map((student) => ({
      id: String(student.studentId),
      name: student.studentName || student.studentEmail || 'Unknown student',
      rollNumber: student.rollNumber,
      count: student.gateFailures || 0,
      type: student.gateFailureType,
      where: 'has not started',
    })),
  ]
    .filter((row) => row.count >= REPEAT_GUESS_THRESHOLD)
    .sort((a, b) => b.count - a.count);

  if (rows.length === 0) return null;

  return (
    <Alert status="warning" variant="left-accent" flexDirection="column" alignItems="stretch" mb={4} borderRadius="md">
      <Flex align="center" mb={2}>
        <AlertIcon />
        <Text fontSize="sm" fontWeight="700">
          {rows.length} student{rows.length === 1 ? '' : 's'} with repeated wrong code entries
        </Text>
      </Flex>
      <Text fontSize="xs" color="lmFg.muted" mb={3}>
        These accounts had a start code typed and rejected more than once. A student mistyping their
        own code is ordinary; a run of them — above all from someone who has not started — can be a
        person trying to get into a paper they are not in front of. Worth a look, not proof.
      </Text>
      <Stack spacing={2}>
        {rows.map((row) => (
          <Box key={row.id} borderWidth="1px" borderRadius="md" p={3} bg="lmBg.surface">
            <Flex align="center" gap={2} wrap="wrap">
              <Text fontSize="sm" fontWeight="600">
                {row.name}
              </Text>
              {row.rollNumber && (
                <Badge fontSize="0.6rem" colorScheme="blue">
                  {row.rollNumber}
                </Badge>
              )}
              <Badge fontSize="0.6rem" colorScheme="orange" variant="solid">
                {`${row.count}× wrong ${codeLabel(row.type)}`}
              </Badge>
              <Text fontSize="xs" color="lmFg.muted">
                {row.where}
              </Text>
            </Flex>
          </Box>
        ))}
      </Stack>
    </Alert>
  );
}


/**
 * The random snapshots taken during one sitting, on demand.
 *
 * Behind a button rather than always open, and fetched only when that button is
 * pressed. Two reasons, and the second is the important one. A hall of two
 * hundred sittings would otherwise pull six hundred images through a panel that
 * re-polls every few seconds. And these are photographs of students: an
 * invigilator should have to ask for the one they want, not have every face in
 * the room painted across a screen that is open on a desk in that room.
 *
 * They arrive as blobs through an authenticated fetch — the route is staff-only
 * and this module signs requests with a header, which an <img src> cannot carry
 * — so every object URL made here is revoked when the strip closes.
 */
function WebcamSnapshots({ attempt, classId }) {
  const shots = attempt.webcam?.snapshots || [];
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState([]);
  const [failed, setFailed] = useState(0);

  useEffect(() => {
    if (!open) {
      setUrls([]);
      setFailed(0);
      return undefined;
    }
    let cancelled = false;
    const made = [];
    (async () => {
      let lost = 0;
      for (const shot of shots) {
        try {
          // Sequential on purpose: a row of thumbnails is not worth opening
          // several connections for, and they appear as they arrive.
          // eslint-disable-next-line no-await-in-loop
          const url = await lmApi.webcamSnapshot(classId, attempt._id, shot.file);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          made.push(url);
          setUrls([...made]);
        } catch {
          // One picture that will not load is not a reason to lose the rest —
          // say how many are missing and show what there is.
          lost += 1;
          if (!cancelled) setFailed(lost);
        }
      }
    })();
    return () => {
      cancelled = true;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId, attempt._id, shots.length]);

  if (shots.length === 0) return null;

  return (
    <Box mt={1}>
      <Button size="xs" variant="ghost" onClick={() => setOpen((was) => !was)}>
        {open ? 'Hide' : 'Show'} {shots.length} camera snapshot{shots.length === 1 ? '' : 's'}
      </Button>
      {open && (
        <HStack spacing={2} mt={1} wrap="wrap">
          {urls.map((url, i) => (
            <Box
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              as="img"
              src={url}
              alt={`Webcam snapshot taken ${relativeTime(shots[i]?.at)}`}
              title={relativeTime(shots[i]?.at)}
              w="104px"
              h="78px"
              objectFit="cover"
              borderRadius="md"
              borderWidth="1px"
              transform="scaleX(-1)"
            />
          ))}
          {urls.length + failed < shots.length && (
            <Text fontSize="xs" color="lmFg.muted">
              loading…
            </Text>
          )}
          {failed > 0 && (
            <Text fontSize="xs" color="lmFg.muted">
              {failed} could not be loaded
            </Text>
          )}
        </HStack>
      )}
    </Box>
  );
}

/**
 * Webcam flags, raised to the invigilator with the frames themselves.
 *
 * A run of empty frames — the machine sitting the paper with nobody in front of
 * it — or a camera that went dark mid-test is what lands here, each with the last
 * thumbnails the browser kept. As with the VM panel it only says "go and look":
 * the "I have checked" button clears the flag off the row without judging it, and
 * ending a sitting is a different button elsewhere.
 */
function WebcamAlerts({ attempts, classId, onDone, toast }) {
  const [busyId, setBusyId] = useState(null);

  const flagged = attempts.filter(
    (attempt) => attempt.webcam?.flaggedAt && !attempt.webcam?.clearedAt,
  );

  if (flagged.length === 0) return null;

  const markChecked = async (attempt) => {
    setBusyId(attempt._id);
    try {
      await lmApi.markWebcamChecked(classId, attempt._id);
      toast({
        title: `${nameOf(attempt)}'s camera flag cleared`,
        description: 'The alert is cleared. Their sitting is untouched — end it from the list below if you need to.',
        status: 'success',
        duration: 5000,
      });
      onDone();
    } catch (err) {
      toast({ title: err.message || 'Could not clear the alert', status: 'error', duration: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Alert status="error" variant="left-accent" flexDirection="column" alignItems="stretch" mb={4} borderRadius="md">
      <Flex align="center" mb={2}>
        <AlertIcon />
        <Text fontSize="sm" fontWeight="700">
          {flagged.length} webcam flag{flagged.length === 1 ? '' : 's'} to check now
        </Text>
      </Flex>
      <Text fontSize="xs" color="lmFg.muted" mb={3}>
        These sittings showed no face on camera, or the camera went dark. That is the shape of a machine
        left running with nobody there — but the camera is the only witness, so look at the frames and, if
        you can, the seat before doing anything.
      </Text>
      <Stack spacing={3}>
        {flagged.map((attempt) => {
          const cam = attempt.webcam || {};
          const shots = (cam.thumbnails || []).filter((thumb) => thumb.image).slice(-3);
          return (
            <Box key={attempt._id} borderWidth="1px" borderRadius="md" p={3} bg="lmBg.surface">
              <Flex align="center" gap={2} wrap="wrap" mb={2}>
                <Text fontSize="sm" fontWeight="600">
                  {nameOf(attempt)}
                </Text>
                {attempt.rollNumber && (
                  <Badge fontSize="0.6rem" colorScheme="blue">
                    {attempt.rollNumber}
                  </Badge>
                )}
                {cam.noFaceCount > 0 && (
                  <Badge fontSize="0.6rem" colorScheme="red" variant="solid">
                    {`${cam.noFaceCount}× no face`}
                  </Badge>
                )}
                {cam.blockedCount > 0 && (
                  <Badge fontSize="0.6rem" colorScheme="red" variant="solid">
                    camera blocked
                  </Badge>
                )}
                {cam.unavailableReason && (
                  <Badge fontSize="0.6rem" colorScheme="red" variant="solid">
                    no camera
                  </Badge>
                )}
                <Text fontSize="xs" color="lmFg.muted">
                  flagged {relativeTime(cam.flaggedAt)}
                </Text>
              </Flex>
              {shots.length > 0 && (
                <HStack spacing={2} mb={2}>
                  {shots.map((thumb, i) => (
                    <Box
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      as="img"
                      src={thumb.image}
                      alt={`Webcam frame (${thumb.type || 'flagged'})`}
                      w="88px"
                      h="66px"
                      objectFit="cover"
                      borderRadius="md"
                      borderWidth="1px"
                      transform="scaleX(-1)"
                    />
                  ))}
                </HStack>
              )}
              <WebcamSnapshots attempt={attempt} classId={classId} />
              {cam.unavailableReason ? (
                <Text fontSize="xs" color="lmFg.muted" mb={2}>
                  {cam.unavailableReason === 'seb_blocked'
                    ? 'Safe Exam Browser blocked the camera on this machine — the camera is not enabled in the exam settings file. They were let in rather than stranded.'
                    : `Started on a machine with no usable camera${
                        cam.unavailableReason === 'notfound' ? ' (no camera found)' : ''
                      }. They were let in rather than stranded — check the seat, or move them to a camera machine.`}
                </Text>
              ) : (
                !cam.detectionAvailable && (
                  <Text fontSize="xs" color="lmFg.muted" mb={2}>
                    Face detection was not available in this browser — these frames are kept for you to read.
                  </Text>
                )
              )}
              <Button
                size="xs"
                variant="outline"
                isLoading={busyId === attempt._id}
                onClick={() => markChecked(attempt)}
              >
                I have checked this
              </Button>
            </Box>
          );
        })}
      </Stack>
    </Alert>
  );
}


/**
 * Webcam waivers — the escape hatch, from Live control.
 *
 * The requirement is right for the room but cannot serve the one student whose
 * camera will not work; this is where a teacher lets that student in without one.
 * A waiver targets a student who has not started (the one stuck at "camera
 * blocked"), so it is granted from the roster by name — the same search that
 * filters the rest of the panel finds them. Waived students are listed with the
 * teacher who allowed it, and a single click withdraws it. Once granted, the
 * student refreshes the pre-test screen and starts without a camera.
 */
function WebcamWaivers({ quizId, classId, notStarted, attempts, exemptions, search, onDone, toast }) {
  const [busyId, setBusyId] = useState(null);

  const nameById = new Map();
  [...attempts, ...notStarted].forEach((person) => {
    const id = String(person.studentId || person._id || '');
    if (id) nameById.set(id, nameOf(person));
  });

  const setWaiver = async (studentId, exempt) => {
    setBusyId(studentId);
    try {
      await lmApi.setWebcamExemption(classId, quizId, studentId, exempt);
      toast({
        title: exempt ? 'Webcam waived' : 'Waiver withdrawn',
        description: exempt
          ? 'They can start without a camera once they refresh the start screen.'
          : 'The camera is required for them again.',
        status: 'success',
        duration: 5000,
      });
      onDone();
    } catch (err) {
      toast({ title: err.message || 'Could not change the waiver', status: 'error', duration: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  const term = search.trim().toLowerCase();
  const waivedIds = new Set((exemptions || []).map((row) => String(row.studentId)));
  // Only not-started students, and only once a name is being searched — a hall of
  // two hundred should not render as a list to scroll.
  const candidates = term
    ? notStarted
        .filter((student) => !waivedIds.has(String(student.studentId)))
        .filter((student) =>
          [student.studentName, student.studentEmail, student.rollNumber]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(term)),
        )
        .slice(0, 8)
    : [];

  return (
    <Box mb={4} p={3} borderWidth="1px" borderColor="lmBorder.base" borderRadius="md">
      <Text fontSize="sm" fontWeight="700" mb={1}>
        Webcam waivers
      </Text>
      <Text fontSize="xs" color="lmFg.muted" mb={2}>
        For a student whose camera cannot be made to work. A waived student can start without one; the
        sitting records that you allowed it. Search a name above to find someone who has not started.
      </Text>

      {(exemptions || []).length > 0 && (
        <Stack spacing={1} mb={2}>
          {(exemptions || []).map((row) => (
            <Flex key={String(row.studentId)} align="center" gap={2} wrap="wrap">
              <Badge colorScheme="green" fontSize="0.6rem">
                waived
              </Badge>
              <Text fontSize="sm">{nameById.get(String(row.studentId)) || 'Student'}</Text>
              {row.byName && (
                <Text fontSize="xs" color="lmFg.muted">
                  by {row.byName}
                </Text>
              )}
              <Button
                size="xs"
                variant="ghost"
                colorScheme="red"
                isLoading={busyId === String(row.studentId)}
                onClick={() => setWaiver(String(row.studentId), false)}
              >
                Undo
              </Button>
            </Flex>
          ))}
        </Stack>
      )}

      {term ? (
        candidates.length > 0 ? (
          <Stack spacing={1}>
            {candidates.map((student) => (
              <Flex key={String(student.studentId)} align="center" gap={2} wrap="wrap">
                <Text fontSize="sm">{nameOf(student)}</Text>
                {student.rollNumber && (
                  <Badge fontSize="0.6rem" colorScheme="blue">
                    {student.rollNumber}
                  </Badge>
                )}
                <Button
                  size="xs"
                  variant="outline"
                  isLoading={busyId === String(student.studentId)}
                  onClick={() => setWaiver(String(student.studentId), true)}
                >
                  Waive webcam
                </Button>
              </Flex>
            ))}
          </Stack>
        ) : (
          <Text fontSize="xs" color="lmFg.subtle">
            No not-yet-started student matches “{search}”.
          </Text>
        )
      ) : null}
    </Box>
  );
}


export function LiveExamModal({ isOpen, onClose, data, classId, onDone, toast }) {
  const { quiz, attempts = [], notStartedStudents = [], webcamExemptions = [] } = data || { quiz: null };
  const [minutesById, setMinutesById] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [sebExempt, setSebExempt] = useState(false);
  const [search, setSearch] = useState('');
  // The ring's colour, editable from here as well as from the quiz editor —
  // which shade reads at range is something an invigilator only finds out once
  // the hall is sitting under its own lights, and by then the editor is shut.
  // Local state so the swatch answers the moment it is dragged; the write is
  // debounced behind it, and the panel's refresh brings back the stored value
  // once it lands.
  const storedPulseColor = quiz?.settings?.invigilationPulseColor || DEFAULT_PULSE_COLOR;
  const [pulseColor, setPulseColor] = useState(storedPulseColor);
  const colourSaveRef = useRef(null);
  useSecondTick(isOpen);

  useEffect(() => {
    // Don't let a refresh that landed mid-edit yank the swatch back to the old
    // colour: while a write is pending, the local value is the truth.
    if (!colourSaveRef.current) setPulseColor(storedPulseColor);
  }, [storedPulseColor]);

  useEffect(() => () => clearTimeout(colourSaveRef.current), []);

  useEffect(() => {
    // Same reasoning as the reopen dialog: waiving SEB is a decision made for
    // the students in front of you now, never one left ticked from last time.
    if (isOpen) setSebExempt(false);
  }, [isOpen]);

  const sebRequired = Boolean(quiz?.settings?.requireSafeExamBrowser);
  const now = new Date();
  /* Whether the paper is finished, and so whether this panel is still an
     invigilation tool or has become a record of one. Recomputed on every tick
     rather than held in state, so a panel left open across the closing bell
     puts its own controls away without being reopened. */
  const over = examIsOver(quiz, now);
  /* The last few minutes of Let in, counted down where staff can see it: the
     control is about to go, and a teacher deciding whether to walk back to
     their desk should not have to work out when from the window's closing
     time. Null outside the grace, and on a paper that has no closing time to
     count from. */
  const letInClosingAt = letInClosesAt(quiz);
  const graceLeftMs =
    !over && letInClosingAt && now >= new Date(quiz.settings.availableTo)
      ? letInClosingAt.getTime() - now.getTime()
      : null;

  const writing = attempts.filter((attempt) => attempt.status === 'in_progress');
  const offSeb = writing.filter((attempt) => attempt.sebBypassed);
  const onSeb = writing.filter((attempt) => attempt.sebVerified && !attempt.sebBypassed);
  // Expired sittings sit alongside terminated ones: from the student's side
  // both are "the test vanished", and both are put right the same way.
  const submitted = attempts.filter((attempt) => attempt.status === 'submitted').length;
  const lockedOut = attempts
    .filter((attempt) => attempt.status === 'terminated' || attempt.status === 'expired')
    .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

  // One box over both lists. An invigilator searching mid-exam is holding a
  // name, not a category — they should not have to know whether that name is
  // still writing or already shut out to find it.
  const term = search.trim().toLowerCase();
  const matches = (attempt) =>
    !term ||
    [attempt.studentName, attempt.studentEmail, attempt.rollNumber]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term));

  const letIn = async (attempt) => {
    const minutes =
      Number(minutesById[attempt._id] ?? minutesLostSinceTermination(quiz, attempt, now)) || 30;
    setBusyId(attempt._id);
    try {
      await lmApi.reopenQuizAttempt(classId, attempt._id, {
        mode: 'continue',
        minutes,
        ...(sebRequired ? { sebExempt } : {}),
      });
      toast({
        title: `${nameOf(attempt)} let back in`,
        description: `They have ${minutes} minutes from now, with their answers intact.`,
        status: 'success',
        duration: 5000,
      });
      onDone();
    } catch (err) {
      toast({ title: err.message || 'Could not let them back in', status: 'error', duration: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  // The colour is a quiz setting, so it is written the way the editor writes it
  // and reaches a live sitting on its next heartbeat — a paper already open
  // picks up the new shade without being touched. Debounced because a colour
  // input fires as it is dragged, and one PATCH per shade dragged through is a
  // write a frame on a route that is doing real work during a sitting.
  const chooseColor = (next) => {
    setPulseColor(next);
    clearTimeout(colourSaveRef.current);
    colourSaveRef.current = setTimeout(async () => {
      try {
        await lmApi.updateQuiz(classId, quiz._id, {
          settings: { invigilationPulseColor: next },
        });
      } catch (err) {
        toast({
          title: err.message || 'Could not change the pulse colour',
          status: 'error',
          duration: 6000,
        });
        setPulseColor(storedPulseColor);
      } finally {
        colourSaveRef.current = null;
      }
    }, 400);
  };

  if (!quiz) return null;

  // Full screen on a phone: this is the panel an invigilator holds in one hand
  // while walking the hall, and a 3xl dialog there was a letterbox with margins
  // down both sides.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: 'full', md: '3xl' }}
      scrollBehavior="inside"
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Live exam control
          <Text fontSize="xs" fontWeight="400" color="lmFg.muted" mb={2}>
            Refreshes every {LIVE_POLL_MS / 1000}s
          </Text>
          <LiveClock
            quiz={quiz}
            writing={writing}
            submitted={submitted}
            shutOut={lockedOut.length}
            now={now}
          />

          {/* Under the clock, above every control: the panel is opened mid-hall,
              and the two questions it is opened for after "who is stuck" are
              "what is the room code again" and "what do I give this laptop that
              will not run SEB". Both answers belong on screen, not behind a
              second dialog opened from behind this one. */}
          <ExamCodes settings={quiz.settings} mt={3} />
          <HStack mt={3} spacing={3}>
            <Text fontSize="sm" fontWeight="500">
              Pulse colour change
            </Text>
            <Tooltip label="The ring's colour on every live screen — a shade picked here reaches the hall on the next heartbeat, and the pulse rings in it from then on.">
              <Input
                type="color"
                size="sm"
                w="46px"
                p={1}
                value={pulseColor}
                onChange={(e) => chooseColor(e.target.value)}
                aria-label="Invigilation pulse ring colour"
              />
            </Tooltip>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {/* Above the search box on purpose: the two things in the panel staff
              must see without having looked for them — a machine to check, and a
              run of wrong code entries that may be somebody getting in from
              outside the room. */}
          <SuspectMachines
            attempts={attempts}
            classId={classId}
            onDone={onDone}
            toast={toast}
          />
          <WebcamAlerts attempts={attempts} classId={classId} onDone={onDone} toast={toast} />
          <CodeGuessAlerts attempts={attempts} notStarted={notStartedStudents} />

          {/* One box, filtering every list below it. In a hall of two hundred
              the panel is opened because one person put their hand up, and the
              only thing staff know about them is their name. */}
          <FormControl mb={4}>
            <Input
              size="sm"
              placeholder="Search by name, email or roll number"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search students"
            />
          </FormControl>

          {/* ---- the webcam escape hatch ---- */}
          {quiz.settings?.requireWebcam && (
            <WebcamWaivers
              quizId={quiz._id}
              classId={classId}
              notStarted={notStartedStudents}
              attempts={attempts}
              exemptions={webcamExemptions}
              search={search}
              onDone={onDone}
              toast={toast}
            />
          )}

          {/* ---- who has been shut out ---- */}
          <SectionCard
            title={`Shut out (${lockedOut.length})`}
            /* Three subtitles, because the card is three different things over
               the life of a paper: the control while the hall sits, a warning
               that the control is about to go, and afterwards a record with the
               way to reopen a sitting named rather than left to be hunted. */
            subtitle={
              over
                ? 'Terminated or expired sittings. The exam is over, so they are no longer let back in from here — to reopen one, open Results and use the action beside the student.'
                : graceLeftMs !== null
                  ? `Terminated or expired sittings. The window has closed: Let in is available for another ${formatCountdown(graceLeftMs)}, then only from Results.`
                  : 'Terminated or expired sittings. Letting one back in returns their paper with every answer intact.'
            }
            mb={4}
          >
            {lockedOut.length === 0 ? (
              <Text fontSize="sm" color="lmFg.muted">
                Nobody has lost the paper. Anyone terminated mid-exam appears here.
              </Text>
            ) : (
              <>
                {/* The waiver configures a Let in and nothing else, so it goes
                    when the button does — a tickbox that changes nothing is
                    worse than no tickbox. */}
                {sebRequired && !over && (
                  <FormControl mb={3}>
                    <Checkbox
                      size="sm"
                      isChecked={sebExempt}
                      onChange={(event) => setSebExempt(event.target.checked)}
                    >
                      Let them back in without Safe Exam Browser
                    </Checkbox>
                    <FormHelperText fontSize="xs">
                      Applies to every student you let in from this panel. Leave it off unless SEB
                      itself is what threw them out — otherwise the reopened sitting is shut down
                      again on its next request.
                    </FormHelperText>
                  </FormControl>
                )}
                <Stack spacing={3}>
                  {lockedOut.filter(matches).map((attempt) => {
                    const auto = minutesLostSinceTermination(quiz, attempt, now);
                    const minutes = minutesById[attempt._id] ?? String(auto);
                    return (
                      <Flex
                        key={attempt._id}
                        gap={3}
                        align={{ base: 'stretch', md: 'center' }}
                        direction={{ base: 'column', md: 'row' }}
                        borderWidth="1px"
                        borderRadius="md"
                        p={3}
                      >
                        <Box flex="1" minW={0}>
                          <Flex align="center" gap={2} wrap="wrap">
                            <Text fontSize="sm" fontWeight="600">
                              {nameOf(attempt)}
                            </Text>
                            <Badge
                              colorScheme={attempt.status === 'terminated' ? 'red' : 'orange'}
                              fontSize="0.6rem"
                            >
                              {attempt.status}
                            </Badge>
                            <AttemptFlags attempt={attempt} />
                          </Flex>
                          <RollNumber value={attempt.rollNumber} />
                          <Text fontSize="xs" color="lmFg.subtle">
                            {attempt.studentEmail || 'no email on file'}
                          </Text>
                          <Text fontSize="xs" color="lmFg.muted">
                            {attempt.submittedAt
                              ? `Ended ${relativeTime(attempt.submittedAt)} · ${formatDateTime(
                                  attempt.submittedAt,
                                )}`
                              : 'End time unknown'}
                            {attempt.terminationReason ? ` · ${attempt.terminationReason}` : ''}
                          </Text>
                        </Box>

                        {/* The whole control column, gone once the paper is
                            over: the row keeps every fact about the sitting —
                            who, which roll number, when it ended and why — and
                            stops offering the one thing that is no longer this
                            panel's to give. */}
                        {!over && (
                          <HStack spacing={2} align="flex-end" w={{ base: '100%', md: 'auto' }}>
                            <FormControl w="110px" flexShrink={0}>
                              <FormLabel fontSize="xs" mb={1}>
                                Minutes
                              </FormLabel>
                              <NumberInput
                                size="sm"
                                min={1}
                                max={600}
                                value={minutes}
                                onChange={(value) =>
                                  setMinutesById((current) => ({ ...current, [attempt._id]: value }))
                                }
                              >
                                <NumberInputField />
                              </NumberInput>
                            </FormControl>
                            <Tooltip
                              label={`Time left when it ended, plus the wait since — ${auto} min`}
                            >
                              <Button
                                /* Bigger on a handset: this is pressed with a
                                   thumb, one-handed, while walking a hall, and a
                                   32px target beside a number stepper was easy to
                                   miss. Back to `sm` from md up, where it sits in
                                   a row of small controls and is clicked. */
                                size={{ base: 'md', md: 'sm' }}
                                minH={{ base: '44px', md: 'auto' }}
                                colorScheme="purple"
                                onClick={() => letIn(attempt)}
                                isLoading={busyId === attempt._id}
                                flex={{ base: '1', md: 'none' }}
                              >
                                Let in
                              </Button>
                            </Tooltip>
                          </HStack>
                        )}
                      </Flex>
                    );
                  })}
                </Stack>
              </>
            )}
          </SectionCard>

          {/* ---- who is on SEB ---- */}
          <SectionCard
            title={
              sebRequired
                ? `Safe Exam Browser (${onSeb.length}/${writing.length})`
                : 'Safe Exam Browser'
            }
            subtitle={
              sebRequired
                ? 'Counted over the students writing at this moment.'
                : 'This quiz does not require Safe Exam Browser.'
            }
            mb={4}
          >
            {!sebRequired ? (
              <Text fontSize="sm" color="lmFg.muted">
                Nothing to watch — every student may sit it in an ordinary browser.
              </Text>
            ) : writing.length === 0 ? (
              <Text fontSize="sm" color="lmFg.muted">
                Nobody is sitting the test at the moment.
              </Text>
            ) : offSeb.length === 0 ? (
              <Alert status="success" borderRadius="md" fontSize="sm">
                <AlertIcon />
                All {writing.length} students writing now are inside Safe Exam Browser.
              </Alert>
            ) : (
              <>
                <Alert status="warning" borderRadius="md" fontSize="sm" mb={3}>
                  <AlertIcon />
                  {offSeb.length} of {writing.length} are writing outside Safe Exam Browser.
                </Alert>
                {/* Cards on a phone, the table from md up — the same split the
                    monitor lists use. Four columns in a modal on a handset was a
                    sideways scroll to read an email address. */}
                <Stack spacing={3} display={{ base: 'flex', md: 'none' }}>
                  {offSeb.map((attempt) => {
                    const total = attempt.questionCount || quiz.questions.length || 1;
                    const percent = Math.round((attempt.answeredCount / total) * 100);
                    return (
                      <MonitorCard key={attempt._id}>
                        <Flex justify="space-between" gap={2} align="flex-start">
                          <Box minW={0}>
                            <Text fontSize="sm" fontWeight="600">
                              {nameOf(attempt)}
                            </Text>
                            <RollNumber value={attempt.rollNumber} />
                            <Text fontSize="xs" color="lmFg.muted" wordBreak="break-all">
                              {attempt.studentEmail || '—'}
                            </Text>
                          </Box>
                          <Badge colorScheme="red" fontSize="0.6rem" flexShrink={0}>
                            no SEB
                          </Badge>
                        </Flex>

                        <Box mt={2}>
                          <Progress value={percent} size="sm" borderRadius="full" colorScheme="green" />
                          <Text fontSize="xs" color="lmFg.muted">
                            {attempt.answeredCount}/{total} answered
                          </Text>
                        </Box>

                        <Flex mt={2} gap={4} wrap="wrap">
                          <CardFact label="Outside SEB since">
                            <Text fontSize="xs" color="lmFg.subtle">
                              {attempt.sebBypassAt ? relativeTime(attempt.sebBypassAt) : '—'}
                            </Text>
                          </CardFact>
                        </Flex>
                      </MonitorCard>
                    );
                  })}
                </Stack>

                <Box overflowX="auto" display={{ base: 'none', md: 'block' }}>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Student</Th>
                        <Th>Email</Th>
                        <Th w="160px">Progress</Th>
                        <Th>Since</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {offSeb.map((attempt) => {
                        const total = attempt.questionCount || quiz.questions.length || 1;
                        const percent = Math.round((attempt.answeredCount / total) * 100);
                        return (
                          <Tr key={attempt._id}>
                            <Td>
                              {nameOf(attempt)}
                              <Badge colorScheme="red" fontSize="0.6rem" ml={2}>
                                no SEB
                              </Badge>
                              {/* Its own line inside the cell, so the column of
                                  numbers lines up the way the seating list does. */}
                              <Box>
                                <RollNumber value={attempt.rollNumber} />
                              </Box>
                            </Td>
                            <Td fontSize="xs">{attempt.studentEmail || '—'}</Td>
                            <Td>
                              <Progress
                                value={percent}
                                size="sm"
                                borderRadius="full"
                                colorScheme="green"
                              />
                              <Text fontSize="xs" color="lmFg.muted">
                                {attempt.answeredCount}/{total} answered
                              </Text>
                            </Td>
                            <Td fontSize="xs" color="lmFg.subtle">
                              {attempt.sebBypassAt ? relativeTime(attempt.sebBypassAt) : '—'}
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </Box>
              </>
            )}
          </SectionCard>
          {/* ---- who is writing right now ---- */}
          <SectionCard
            title={`Writing now (${writing.length})`}
            subtitle={
              over
                ? 'Read-only. The exam is over — anyone still shown here is on a sitting that has outlived the window, and a paper is reopened from Results, not from here.'
                : 'Read-only. To stop somebody’s paper, use Attendance — the register lists the whole hall. They then appear under Shut out, where Let in hands the paper straight back.'
            }
          >
            {writing.length === 0 ? (
              <Text fontSize="sm" color="lmFg.muted">
                Nobody is sitting the test at the moment.
              </Text>
            ) : writing.filter(matches).length === 0 ? (
              <Text fontSize="sm" color="lmFg.muted">
                No student writing now matches “{search}”.
              </Text>
            ) : (
              <Stack spacing={2}>
                {writing.filter(matches).map((attempt) => {
                  const total = attempt.questionCount || quiz.questions.length || 1;
                  return (
                    <Flex
                      key={attempt._id}
                      gap={3}
                      align={{ base: 'stretch', md: 'center' }}
                      direction={{ base: 'column', md: 'row' }}
                      borderWidth="1px"
                      borderRadius="md"
                      p={3}
                    >
                      <Box flex="1" minW={0}>
                        <Flex align="center" gap={2} wrap="wrap">
                          <Text fontSize="sm" fontWeight="600">
                            {nameOf(attempt)}
                          </Text>
                          <AttemptFlags attempt={attempt} />
                        </Flex>
                        <RollNumber value={attempt.rollNumber} />
                        <Text fontSize="xs" color="lmFg.subtle" wordBreak="break-all">
                          {attempt.studentEmail || 'no email on file'}
                        </Text>
                        <Text fontSize="xs" color="lmFg.muted">
                          {attempt.answeredCount}/{total} answered
                          {attempt.startedAt ? ` · started ${relativeTime(attempt.startedAt)}` : ''}
                        </Text>
                        <WebcamSnapshots attempt={attempt} classId={classId} />
                      </Box>

                    </Flex>
                  );
                })}
              </Stack>
            )}
          </SectionCard>

        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/**
 * The live counts a quiz card carries while the hall is sitting.
 *
 * Terminated leads, and leads on purpose: it is the only one of the three that
 * is a person waiting on a decision from staff. Writing and submitted are
 * reassurance — they say the exam is running — and reassurance does not go
 * first when somebody has been thrown out of a paper they cannot re-enter
 * without you.
 */
export function LiveCounts({ live }) {
  const shutOut = live?.shutOut || 0;
  const writing = live?.writing || 0;
  const submitted = live?.submitted || 0;

  return (
    <HStack spacing={2} mt={1} fontSize="xs" wrap="wrap">
      <Text color={shutOut > 0 ? 'red.500' : 'lmFg.muted'} fontWeight={shutOut > 0 ? '700' : '400'}>
        🚫 {shutOut} terminated
      </Text>
      <Text color="lmFg.muted">·</Text>
      <Text color="lmFg.muted">✍️ {writing} writing</Text>
      <Text color="lmFg.muted">·</Text>
      <Text color="lmFg.muted">✅ {submitted} submitted</Text>
    </HStack>
  );
}

/**
 * The panel, plus the button that opens it, anywhere a quiz is listed.
 *
 * It fetches its own results while it is open rather than being handed them,
 * because the quiz list does not otherwise carry a single attempt: pulling the
 * whole results payload on every card, for every quiz, to keep a modal warm
 * that is opened once an exam would be a page-load's worth of work for
 * nothing. Opening it starts the same poll the results page runs, and closing
 * it stops it.
 */
export default function LiveExamControl({ classId, quiz, live, onDone }) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  // Held in a ref so the poll can check it without being torn down and rebuilt
  // on every fetch.
  const openRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const fetched = await lmApi.quizResults(classId, quiz._id);
      if (openRef.current) setData(fetched);
    } catch (err) {
      // A failed background poll leaves the last good panel up; only a failed
      // first open has nothing to show and is worth saying out loud.
      if (openRef.current && !data) {
        toast({ title: err.message || 'Could not read the live state', status: 'error' });
      }
    } finally {
      setLoading(false);
    }
  }, [classId, quiz._id, data, toast]);

  useEffect(() => {
    openRef.current = isOpen;
    if (!isOpen) return undefined;
    setLoading(true);
    load();
    const id = setInterval(load, LIVE_POLL_MS);
    return () => clearInterval(id);
    // `load` is deliberately out of the deps: it changes on every fetch (it
    // closes over `data`), and following it would restart the interval each
    // time, turning a 15-second poll into a much faster one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // What the panel would show as needing a decision: students shut out of the
  // paper, plus anyone writing outside the lockdown. Counted from the list
  // payload, so the badge is right before anything is opened.
  //
  // Zero once the paper is over, and not because the numbers changed: an alert
  // is a thing to act on, and the acting is what has just been taken out of
  // this panel. A red button counting shut-out students across a finished exam
  // sends staff in to find no control, then does it again tomorrow — which is
  // how a badge stops being read at all. The list is still one click away for
  // anyone who wants it.
  const alerts = examIsOver(quiz) ? 0 : (live?.shutOut || 0) + (live?.offSeb || 0);

  return (
    <>
      {/* Green while the exam is simply running, red and filled once somebody
          needs a decision — the colour is the fastest thing on the row to read
          from across a hall. */}
      <Button
        size="sm"
        colorScheme={alerts > 0 ? 'red' : 'green'}
        variant={alerts > 0 ? 'solid' : 'outline'}
        onClick={() => setIsOpen(true)}
      >
        🎥 Live control
        {alerts > 0 && (
          <Badge ml={2} colorScheme="red" fontSize="0.6rem">
            {alerts}
          </Badge>
        )}
      </Button>
      {isOpen && (
        <LiveExamModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          // Until the first fetch lands there is a dialog with a heading and
          // nothing under it; the quiz is known from the list, so the panel can
          // frame itself immediately and fill in.
          data={data || (loading ? { quiz, attempts: [] } : null)}
          classId={classId}
          onDone={() => {
            load();
            if (onDone) onDone();
          }}
          toast={toast}
        />
      )}
    </>
  );
}
