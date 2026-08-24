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


/** How often the invigilation view re-reads the server while it is open. */
export const LIVE_POLL_MS = 15000;


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
export function LiveExamModal({ isOpen, onClose, data, classId, onDone, toast }) {
  const { quiz, attempts = [] } = data || { quiz: null };
  const [minutesById, setMinutesById] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [sebExempt, setSebExempt] = useState(false);
  const [search, setSearch] = useState('');
  // Who the invigilator has asked to stop, held until they confirm. Ending a
  // paper by hand is the one irreversible-feeling act on this panel — it is
  // undoable, but the student watches their exam vanish first — so it does not
  // happen on a single tap in a list that is re-sorting under the finger.
  const [confirmEnd, setConfirmEnd] = useState(null);
  useSecondTick(isOpen);

  useEffect(() => {
    // Same reasoning as the reopen dialog: waiving SEB is a decision made for
    // the students in front of you now, never one left ticked from last time.
    if (isOpen) setSebExempt(false);
  }, [isOpen]);

  const sebRequired = Boolean(quiz?.settings?.requireSafeExamBrowser);
  const now = new Date();

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

  const endPaper = async (attempt) => {
    setBusyId(attempt._id);
    try {
      // No reason sent: the server writes "Ended by <teacher>", which is the
      // one fact worth recording here and the only one the browser cannot get
      // wrong. A free-text box belongs on the results page, not on a control
      // being used one-handed in a hall.
      await lmApi.terminateQuizAttempt(classId, attempt._id);
      toast({
        title: `${nameOf(attempt)}'s test was ended`,
        description: 'Their answers are kept. They now appear under Shut out, where you can let them back in.',
        status: 'success',
        duration: 6000,
      });
      setConfirmEnd(null);
      onDone();
    } catch (err) {
      toast({ title: err.message || 'Could not end that sitting', status: 'error', duration: 6000 });
    } finally {
      setBusyId(null);
    }
  };

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
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
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

          {/* ---- who is writing right now ---- */}
          <SectionCard
            title={`Writing now (${writing.length})`}
            subtitle="Ending a paper keeps every answer. They move to Shut out, where Let in hands it straight back."
            mb={4}
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
                  const confirming = confirmEnd === attempt._id;
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
                          {attempt.rollNumber && (
                            <Badge fontSize="0.6rem">{attempt.rollNumber}</Badge>
                          )}
                          <AttemptFlags attempt={attempt} />
                        </Flex>
                        <Text fontSize="xs" color="lmFg.subtle" wordBreak="break-all">
                          {attempt.studentEmail || 'no email on file'}
                        </Text>
                        <Text fontSize="xs" color="lmFg.muted">
                          {attempt.answeredCount}/{total} answered
                          {attempt.startedAt ? ` · started ${relativeTime(attempt.startedAt)}` : ''}
                        </Text>
                      </Box>

                      {/* Two taps, and the second one says what it does. The
                          first tap only arms this row — nothing has reached the
                          server yet, and tapping any other row disarms it. */}
                      {confirming ? (
                        <HStack spacing={2} w={{ base: '100%', md: 'auto' }}>
                          <Button
                            size={{ base: 'md', md: 'sm' }}
                            minH={{ base: '44px', md: 'auto' }}
                            colorScheme="red"
                            onClick={() => endPaper(attempt)}
                            isLoading={busyId === attempt._id}
                            flex={{ base: '1', md: 'none' }}
                          >
                            End {nameOf(attempt).split(' ')[0]}’s test
                          </Button>
                          <Button
                            size={{ base: 'md', md: 'sm' }}
                            minH={{ base: '44px', md: 'auto' }}
                            variant="ghost"
                            onClick={() => setConfirmEnd(null)}
                          >
                            Cancel
                          </Button>
                        </HStack>
                      ) : (
                        <Button
                          size={{ base: 'md', md: 'sm' }}
                          minH={{ base: '44px', md: 'auto' }}
                          colorScheme="red"
                          variant="outline"
                          onClick={() => setConfirmEnd(attempt._id)}
                          w={{ base: '100%', md: 'auto' }}
                        >
                          Terminate
                        </Button>
                      )}
                    </Flex>
                  );
                })}
              </Stack>
            )}
          </SectionCard>

          {/* ---- who has been shut out ---- */}
          <SectionCard
            title={`Shut out (${lockedOut.length})`}
            subtitle="Terminated or expired sittings. Letting one back in returns their paper with every answer intact."
            mb={4}
          >
            {lockedOut.length === 0 ? (
              <Text fontSize="sm" color="lmFg.muted">
                Nobody has lost the paper. Anyone terminated mid-exam appears here.
              </Text>
            ) : (
              <>
                {sebRequired && (
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
  const alerts = (live?.shutOut || 0) + (live?.offSeb || 0);

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
