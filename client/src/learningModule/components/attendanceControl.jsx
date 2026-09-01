import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';

import lmApi from '../api/lmApi';
import { LIVE_POLL_MS, nameOf } from './liveExam';
import { relativeTime } from '../format';

/**
 * Taking the register during an exam.
 *
 * Split from `liveExam.jsx` rather than folded into the live panel because the
 * two views are built from different things and answer different questions.
 * The live panel is built from attempts — it can only show people who started.
 * The register is built from the class roster, so it can show the student who
 * never appeared, which is the one an absence is usually being recorded for.
 */

/* ─────────────────────── the hall register ─────────────────────── */

/** What each register state looks like at a glance. */
const ATTENDANCE_STYLE = {
  present: { colorScheme: 'green', label: 'Present' },
  absent: { colorScheme: 'red', label: 'Absent' },
  unmarked: { colorScheme: 'gray', label: 'Not marked' },
};

/**
 * The register, taken from the quiz card while the paper runs.
 *
 * It is a separate control from Live exam rather than another section inside
 * it because the two are used at different moments and by different hands:
 * the register is walked once, down a roster, in roll-number order, and it
 * lists every enrolled student — including the ones with no attempt at all,
 * who are exactly the people an absence is being recorded for and who the
 * live panel, built from attempts, cannot show.
 *
 * Marking somebody absent ends their sitting if they are writing, so that
 * single tap carries a confirmation. Nothing is destroyed by it — the paper
 * lands in the live panel's shut-out list with its answers, and Let in hands
 * it back — but the student watches their exam disappear, which is not
 * something to do on a mis-tap in a scrolling list.
 *
 * Terminate sits on the same rows for the same reason, and takes the same two
 * taps. It used to live in the live panel, but the hand that stops a paper is
 * the hand already holding the register: staff are walking the roster when they
 * catch somebody, and the row in front of them is the one to act on. It ends
 * the sitting and leaves the attendance mark alone — a student stopped for
 * cheating was present, and the register should still say so.
 */
export function AttendanceModal({ isOpen, onClose, classId, quiz, toast, onDone }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  // The one row that has been armed but not yet confirmed, and which of the two
  // destructive acts it was armed for: `{ studentId, action }`, where action is
  // 'absent' or 'terminate'. Only ever set for a student who is actually
  // writing — marking an absence for someone who never appeared takes nothing
  // away and needs no ceremony.
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await lmApi.quizAttendance(classId, quiz._id);
      setRows(data.students || []);
      setSummary(data.summary || null);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, quiz._id]);

  useEffect(() => {
    if (!isOpen) return undefined;
    setLoading(true);
    load();
    // The register is read alongside a live exam, so it goes stale the same way
    // the live panel does — a student who started since it opened must not still
    // read as "not started" when staff decide whether to mark them absent.
    const id = setInterval(load, LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [isOpen, load]);

  const mark = async (row, status) => {
    setBusyId(row.studentId);
    try {
      const result = await lmApi.markQuizAttendance(classId, quiz._id, [
        { studentId: row.studentId, status },
      ]);
      toast({
        title: `${nameOf(row)} marked ${status}`,
        description: result.terminated?.length
          ? 'Their sitting was ended. Answers are kept — let them back in from Live control.'
          : undefined,
        status: status === 'absent' ? 'warning' : 'success',
        duration: 5000,
      });
      setConfirm(null);
      await load();
      if (onDone) onDone();
    } catch (err) {
      toast({ title: err.message || 'Could not mark that student', status: 'error', duration: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  /*
   * Taking the paper off a student without touching the register.
   *
   * It lives here rather than in the live panel because this is the list staff
   * already have open while they walk the hall: the person being stopped is
   * being looked at, and the row under the thumb is theirs. Marking them absent
   * would end the paper too, but the two are different records — somebody
   * caught cheating was present — so ending the sitting is its own button and
   * leaves the attendance mark alone.
   *
   * No reason is sent: the server writes "Ended by <teacher>", which is the one
   * fact worth recording here and the only one the browser cannot get wrong.
   */
  const endPaper = async (row) => {
    setBusyId(row.studentId);
    try {
      await lmApi.terminateQuizAttempt(classId, row.attemptId);
      toast({
        title: `${nameOf(row)}'s test was ended`,
        description:
          'Their answers are kept. They now appear under Shut out in Live control, where you can let them back in.',
        status: 'success',
        duration: 6000,
      });
      setConfirm(null);
      await load();
      if (onDone) onDone();
    } catch (err) {
      toast({ title: err.message || 'Could not end that sitting', status: 'error', duration: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  /* The one bulk action worth having, and the only one that is safe: everyone
     the server can see writing is, by definition, in front of you. There is no
     "mark all absent" — that would end a hall's worth of papers on one tap. */
  const markWritingPresent = async () => {
    const entries = rows
      .filter((row) => row.attemptStatus === 'in_progress' && row.attendance !== 'present')
      .map((row) => ({ studentId: row.studentId, status: 'present' }));
    if (!entries.length) return;
    setBusyId('bulk');
    try {
      await lmApi.markQuizAttendance(classId, quiz._id, entries);
      toast({ title: `${entries.length} student(s) marked present`, status: 'success', duration: 4000 });
      await load();
      if (onDone) onDone();
    } catch (err) {
      toast({ title: err.message || 'Could not mark them present', status: 'error', duration: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  const term = search.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      !term ||
      [row.studentName, row.studentEmail, row.rollNumber]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
  );
  const writingUnmarked = rows.filter(
    (row) => row.attemptStatus === 'in_progress' && row.attendance !== 'present',
  ).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: '3xl' }} scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Attendance — {quiz.title}
          <Text fontSize="xs" fontWeight="400" color="lmFg.muted">
            Marking a student absent ends the paper they are writing, and Terminate ends it without
            touching the register. Answers are kept either way, and Live control can let them back
            in.
          </Text>
          {summary && (
            <HStack spacing={4} mt={2} fontWeight="400">
              <Box>
                <Text fontSize="0.6rem" color="lmFg.muted" textTransform="uppercase" fontWeight="700">
                  Present
                </Text>
                <Text fontSize="xl" fontWeight="700" lineHeight="1.1" color="green.500">
                  {summary.present}
                </Text>
              </Box>
              <Box>
                <Text fontSize="0.6rem" color="lmFg.muted" textTransform="uppercase" fontWeight="700">
                  Absent
                </Text>
                <Text
                  fontSize="xl"
                  fontWeight="700"
                  lineHeight="1.1"
                  color={summary.absent > 0 ? 'red.500' : undefined}
                >
                  {summary.absent}
                </Text>
              </Box>
              <Box>
                <Text fontSize="0.6rem" color="lmFg.muted" textTransform="uppercase" fontWeight="700">
                  Not marked
                </Text>
                <Text fontSize="xl" fontWeight="700" lineHeight="1.1">
                  {summary.unmarked}
                </Text>
              </Box>
              <Box>
                <Text fontSize="0.6rem" color="lmFg.muted" textTransform="uppercase" fontWeight="700">
                  Enrolled
                </Text>
                <Text fontSize="xl" fontWeight="700" lineHeight="1.1" color="lmFg.muted">
                  {summary.enrolled}
                </Text>
              </Box>
            </HStack>
          )}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Flex gap={2} mb={4} direction={{ base: 'column', md: 'row' }} align={{ md: 'center' }}>
            <FormControl flex="1">
              <Input
                size="sm"
                placeholder="Search by name, email or roll number"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search students"
              />
            </FormControl>
            <Button
              size="sm"
              variant="outline"
              colorScheme="green"
              onClick={markWritingPresent}
              isLoading={busyId === 'bulk'}
              isDisabled={writingUnmarked === 0}
            >
              Mark all writing present ({writingUnmarked})
            </Button>
          </Flex>

          {loading && rows.length === 0 ? (
            <Text fontSize="sm" color="lmFg.muted">
              Reading the register…
            </Text>
          ) : error ? (
            <Alert status="error" borderRadius="md" fontSize="sm">
              <AlertIcon />
              {error.message || 'Could not read the register'}
            </Alert>
          ) : shown.length === 0 ? (
            <Text fontSize="sm" color="lmFg.muted">
              {rows.length === 0
                ? 'No students are enrolled in this class yet.'
                : `Nobody matches “${search}”.`}
            </Text>
          ) : (
            <Stack spacing={2}>
              {shown.map((row) => {
                const style = ATTENDANCE_STYLE[row.attendance] || ATTENDANCE_STYLE.unmarked;
                const writing = row.attemptStatus === 'in_progress';
                const armed = confirm?.studentId === row.studentId ? confirm.action : null;
                return (
                  <Flex
                    key={row.studentId}
                    gap={3}
                    align={{ base: 'stretch', md: 'center' }}
                    direction={{ base: 'column', md: 'row' }}
                    borderWidth="1px"
                    borderRadius="md"
                    p={3}
                  >
                    <Box flex="1" minW={0}>
                      <Flex align="center" gap={2} wrap="wrap">
                        {row.rollNumber && <Badge fontSize="0.6rem">{row.rollNumber}</Badge>}
                        <Text fontSize="sm" fontWeight="600">
                          {nameOf(row)}
                        </Text>
                        <Badge colorScheme={style.colorScheme} fontSize="0.6rem">
                          {style.label}
                        </Badge>
                        {writing && (
                          <Badge colorScheme="blue" fontSize="0.6rem">
                            writing
                          </Badge>
                        )}
                      </Flex>
                      <Text fontSize="xs" color="lmFg.subtle" wordBreak="break-all">
                        {row.studentEmail || 'no email on file'}
                      </Text>
                      <Text fontSize="xs" color="lmFg.muted">
                        {row.attemptStatus
                          ? `Sitting: ${row.attemptStatus.replace('_', ' ')}`
                          : 'Has not started'}
                        {row.markedAt
                          ? ` · marked ${relativeTime(row.markedAt)}${
                              row.markedByName ? ` by ${row.markedByName}` : ''
                            }`
                          : ''}
                      </Text>
                    </Box>

                    {armed ? (
                      <HStack spacing={2} w={{ base: '100%', md: 'auto' }}>
                        <Button
                          size={{ base: 'md', md: 'sm' }}
                          minH={{ base: '44px', md: 'auto' }}
                          colorScheme="red"
                          onClick={() =>
                            armed === 'terminate' ? endPaper(row) : mark(row, 'absent')
                          }
                          isLoading={busyId === row.studentId}
                          flex={{ base: '1', md: 'none' }}
                        >
                          {armed === 'terminate'
                            ? `End ${nameOf(row).split(' ')[0]}’s test`
                            : 'Absent — end their test'}
                        </Button>
                        <Button
                          size={{ base: 'md', md: 'sm' }}
                          minH={{ base: '44px', md: 'auto' }}
                          variant="ghost"
                          onClick={() => setConfirm(null)}
                        >
                          Cancel
                        </Button>
                      </HStack>
                    ) : (
                      <HStack spacing={2} w={{ base: '100%', md: 'auto' }}>
                        <Button
                          size={{ base: 'md', md: 'sm' }}
                          minH={{ base: '44px', md: 'auto' }}
                          colorScheme="green"
                          variant={row.attendance === 'present' ? 'solid' : 'outline'}
                          onClick={() => mark(row, 'present')}
                          isLoading={busyId === row.studentId}
                          flex={{ base: '1', md: 'none' }}
                        >
                          Present
                        </Button>
                        <Button
                          size={{ base: 'md', md: 'sm' }}
                          minH={{ base: '44px', md: 'auto' }}
                          colorScheme="red"
                          variant={row.attendance === 'absent' ? 'solid' : 'outline'}
                          /* Only a live paper needs the second tap: there is
                             nothing to take away from a student who never
                             started, and asking anyway makes walking a roster
                             twice the work. */
                          onClick={() =>
                            writing
                              ? setConfirm({ studentId: row.studentId, action: 'absent' })
                              : mark(row, 'absent')
                          }
                          isLoading={busyId === row.studentId}
                          flex={{ base: '1', md: 'none' }}
                        >
                          Absent
                        </Button>
                        {/* Only offered where there is a paper to take: a row
                            with no live sitting has nothing to end, and the
                            register is mostly such rows. */}
                        {writing && row.attemptId && (
                          <Button
                            size={{ base: 'md', md: 'sm' }}
                            minH={{ base: '44px', md: 'auto' }}
                            colorScheme="orange"
                            variant="outline"
                            onClick={() =>
                              setConfirm({ studentId: row.studentId, action: 'terminate' })
                            }
                            isLoading={busyId === row.studentId}
                            flex={{ base: '1', md: 'none' }}
                          >
                            Terminate
                          </Button>
                        )}
                      </HStack>
                    )}
                  </Flex>
                );
              })}
            </Stack>
          )}
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
 * The register, plus the button that opens it, beside Live control on a card.
 *
 * Its own button rather than a tab inside the live panel: taking a register is
 * a different job from fixing one student's paper, and it is the one staff do
 * first — before anyone has been shut out and while the live panel would still
 * be empty.
 */
export default function AttendanceControl({ classId, quiz, onDone }) {
  const [isOpen, setIsOpen] = useState(false);
  const toast = useToast();

  return (
    <>
      <Button size="sm" colorScheme="blue" variant="outline" onClick={() => setIsOpen(true)}>
        🧾 Attendance
      </Button>
      {isOpen && (
        <AttendanceModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          classId={classId}
          quiz={quiz}
          toast={toast}
          onDone={onDone}
        />
      )}
    </>
  );
}
