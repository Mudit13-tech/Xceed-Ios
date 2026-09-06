import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
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
  MenuDivider,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Select,
  Spinner,
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { FiMail } from 'react-icons/fi';
import { EmptyState, ErrorState, Loading, SectionCard, buttonTextStyles } from '../components/common';
import { LmIcon } from '../components/Icon';
import { formatDate, initials, relativeTime } from '../format';

/**
 * One line of the invite modal's two-step progress: what is happening now,
 * what has already finished, and what is still waiting on it.
 */
function InviteStep({ label, state, detail, ...rest }) {
  return (
    <Flex align="center" gap={2} {...rest}>
      {state === 'running' ? (
        <Spinner size="xs" color="blue.400" speed="0.8s" />
      ) : (
        <Box
          w="10px"
          h="10px"
          borderRadius="full"
          bg={state === 'done' ? 'green.400' : 'transparent'}
          borderWidth={state === 'done' ? 0 : '2px'}
          borderColor="lmBorder.base"
        />
      )}
      <Text fontSize="xs" fontWeight="600" color={state === 'waiting' ? 'lmFg.subtle' : undefined}>
        {label}
      </Text>
      <Text fontSize="xs" color="lmFg.subtle" ml="auto" textAlign="right">
        {detail}
      </Text>
    </Flex>
  );
}

/**
 * One shared read of the class's ERP roster.
 *
 * The page wants it to notice students the ERP has and the class does not; the
 * invite modal wants it to list them. Both go through this key so the lookup —
 * which walks the attendance module's subject roster and then resolves every
 * roll number to an address — happens once and is answered from cache the
 * second time. `staleTime` is generous for the same reason: a roster changes
 * when a registration does, not between two clicks.
 */
const erpRosterQuery = (classId, enabled) => ({
  queryKey: ['learning', 'erp-roster', classId],
  queryFn: () => lmApi.previewErpImport(classId),
  enabled: Boolean(enabled && classId),
  staleTime: 5 * 60 * 1000,
  // A class whose subject the attendance module has never heard of 404s or
  // comes back empty. That is an ordinary answer, not something to retry.
  retry: false,
});

/**
 * What to do instead, when the ERP has no answer for this class.
 *
 * A subject the attendance module has never heard of, or one whose roster sync
 * has not run, is a dead end the teacher cannot fix from here — so the panel
 * says so and names the two routes that do not depend on it, rather than
 * leaving an empty box and a teacher wondering whether to wait.
 */
function ErpFallbackHelp({ klass }) {
  return (
    <Box mt={3} fontSize="xs" color="lmFg.subtle">
      <Text>Two ways in that do not need the ERP:</Text>
      <Box as="ul" pl={4} mt={1}>
        <Box as="li">
          Type the students&apos; individual addresses into the box below — one per person.
        </Box>
        <Box as="li">
          Share the class code{' '}
          <Text as="span" fontFamily="mono" fontWeight="700" color="lmFg.heading">
            {klass?.code || '——'}
          </Text>{' '}
          and let them join the classroom themselves.
        </Box>
      </Box>
    </Box>
  );
}

/**
 * The class's ERP roster, offered as addresses for the invite box.
 *
 * The Attendance module already knows who is enrolled in this subject — it is
 * the roster attendance is taken against — so a teacher has no business
 * retyping sixty addresses the platform can already list. What that roster
 * actually stores is roll numbers; the server resolves each one to the
 * student's official `mailID`, falling back to `<roll>@nitj.ac.in`, and says
 * which of them are already in the class (see memberController.previewErpImport).
 *
 * It loads as soon as the modal opens, because a teacher who came here to add
 * students should not have to know the roster exists to be offered it. What it
 * will not do is act on it: it fills the box, the teacher confirms the list,
 * and the same Send invites the typed path uses does the enrolling. One invite
 * route, one confirmation step, and no way to add sixty people by misreading a
 * button.
 */
function ErpRosterPicker({ classId, klass, onAdd }) {
  const { data: preview, isLoading, isError, error, refetch, isFetching } = useQuery(
    erpRosterQuery(classId, true),
  );
  // Selection is by roll number, not by address: the roll is what the ERP is
  // keyed on, and two rows could in principle resolve to the same fallback.
  const [selected, setSelected] = useState(() => new Set());
  const toast = useToast();

  const students = preview?.students || [];

  // Everyone the class does not already have, ticked, re-derived whenever a
  // fresh roster lands. The rest are listed but left alone — re-inviting them
  // is a no-op the teacher should not have to read past.
  useEffect(() => {
    setSelected(new Set(students.filter((st) => !st.alreadyMember).map((st) => st.rollNo)));
    // The roster array is rebuilt on every fetch, so it is compared by the one
    // thing that says "this is a different roster" rather than by identity.
  }, [students.map((st) => `${st.rollNo}:${st.alreadyMember}`).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (rollNo) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rollNo)) next.delete(rollNo);
      else next.add(rollNo);
      return next;
    });

  const selectable = students.filter((st) => !st.alreadyMember);
  const allSelected = selectable.length > 0 && selectable.every((st) => selected.has(st.rollNo));

  const addSelected = () => {
    const chosen = students.filter((st) => selected.has(st.rollNo)).map((st) => st.email);
    const added = onAdd(chosen);
    toast({
      status: added ? 'success' : 'info',
      title: added
        ? `${added} address${added === 1 ? '' : 'es'} added to the list`
        : 'Those addresses are already in the list',
      duration: 4000,
    });
  };

  return (
    <Box mt={4} p={4} borderWidth="1px" borderColor="lmBorder.base" borderRadius="md">
      <Flex align="flex-start" justify="space-between" gap={3} wrap="wrap">
        <Box minW={0}>
          <Text fontSize="sm" fontWeight="600">
            From the ERP roster
          </Text>
          <Text fontSize="xs" color="lmFg.subtle" mt={1}>
            The attendance roster for {klass?.subject || 'this subject'}
            {klass?.semester ? ` · Semester ${klass.semester}` : ''}. Roll numbers are resolved to
            addresses and added to the list above; nobody is invited until you press Send invites.
          </Text>
        </Box>
        <Button
          size="sm"
          variant="outline"
          flexShrink={0}
          leftIcon={<LmIcon name="refresh" size={14} />}
          onClick={() => refetch()}
          isLoading={isFetching}
          loadingText="Fetching"
        >
          Refresh
        </Button>
      </Flex>

      {isLoading && <Loading label="Fetching the roster from the ERP…" minH="80px" />}

      {isError && (
        <>
          <ErrorState error={error} onRetry={refetch} />
          <ErpFallbackHelp klass={klass} />
        </>
      )}

      {!isLoading && !isError && students.length === 0 && (
        <>
          <Text fontSize="xs" color="lmFg.muted" mt={3}>
            {preview?.message
              || `No roster found in the attendance module for "${klass?.subject || 'this subject'}".`}
          </Text>
          <ErpFallbackHelp klass={klass} />
        </>
      )}

      {students.length > 0 && (
        <>
          <Flex align="center" justify="space-between" gap={3} wrap="wrap" mt={4} mb={2}>
            <Text fontSize="xs" color="lmFg.muted">
              {preview.totalErp} on the ERP roster · {preview.existingCount} already in this class ·{' '}
              {preview.newCount} new
            </Text>
            {selectable.length > 0 && (
              <Button
                size="xs"
                variant="link"
                colorScheme="blue"
                onClick={() =>
                  setSelected(allSelected ? new Set() : new Set(selectable.map((st) => st.rollNo)))
                }
              >
                {allSelected ? 'Clear all' : `Select all ${selectable.length} new`}
              </Button>
            )}
          </Flex>

          <Box maxH="220px" overflowY="auto" borderWidth="1px" borderColor="lmBorder.base" borderRadius="md">
            {students.map((st) => (
              <Flex
                key={st.rollNo}
                align="center"
                gap={3}
                px={3}
                py={2}
                borderBottomWidth="1px"
                borderColor="lmBorder.subtle"
              >
                <Checkbox
                  isChecked={selected.has(st.rollNo)}
                  onChange={() => toggle(st.rollNo)}
                  flexShrink={0}
                />
                <Box flex="1" minW={0}>
                  <Text fontSize="xs" fontWeight="600" noOfLines={1}>
                    {st.rollNo} · {st.name}
                  </Text>
                  <Text fontSize="xs" color="lmFg.muted" noOfLines={1}>
                    {st.email}
                  </Text>
                </Box>
                {st.alreadyMember && (
                  <Badge colorScheme="gray" fontSize="0.6rem" flexShrink={0}>
                    Already in class
                  </Badge>
                )}
              </Flex>
            ))}
          </Box>

          <Button
            size="sm"
            colorScheme="blue"
            mt={3}
            onClick={addSelected}
            isDisabled={selected.size === 0}
          >
            Add {selected.size} address{selected.size === 1 ? '' : 'es'} to the list
          </Button>
        </>
      )}
    </Box>
  );
}

function InviteModal({ isOpen, onClose, classId, klass, onDone, defaultRole = 'student', availableRoles = ['student', 'co-teacher'] }) {
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState(defaultRole);

  useEffect(() => {
    if (isOpen) {
      setRole(defaultRole);
      // A reopened modal must not show the last run's steps still ticking.
      setPhase(null);
      setMailProgress(null);
      setCreatedCount(0);
    }
  }, [isOpen, defaultRole]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  // Mail for an invite goes out in the background after the membership rows
  // are already written — see memberController.inviteMembers. `mailProgress`
  // tracks that batch so the modal can show "sending N of M" instead of
  // sitting on a spinner for as long as the slowest SMTP attempt takes.
  const [mailProgress, setMailProgress] = useState(null);
  // Which of the invite's two steps is running. Creating the accounts happens
  // inside the POST and mailing happens after it, and the two take visibly
  // different amounts of time — naming the current one is the difference
  // between "this is working" and "this is stuck".
  const [phase, setPhase] = useState(null); // 'creating' | 'sending' | null
  const [createdCount, setCreatedCount] = useState(0);
  const pollRef = useRef(null);
  const toast = useToast();

  const platformRole = role === 'co-teacher' ? 'FACULTY' : 'STUDENT';

  const stopPolling = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  const finish = (finalResults) => {
    const count = (status) => finalResults.filter((r) => r.status === status).length;
    const failures = finalResults.filter((r) => r.status === 'error');
    // `mailed === false` means the person was enrolled but the invitation
    // email did not leave — worth saying out loud rather than reporting a
    // clean success.
    const unmailed = finalResults.filter((r) => r.mailed === false);

    toast({
      status: failures.length || unmailed.length ? 'warning' : 'success',
      title: 'Invites processed',
      description: [
        count('account_created') && `${count('account_created')} account(s) created`,
        count('added') && `${count('added')} enrolled`,
        count('invited') && `${count('invited')} invited by email`,
        count('already_member') && `${count('already_member')} already in the class`,
        failures.length && `${failures.length} failed`,
        unmailed.length && `${unmailed.length} enrolled but the email could not be sent`,
      ]
        .filter(Boolean)
        .join(', '),
      duration: 8000,
    });

    if (!failures.length && !unmailed.length) {
      setEmails('');
      setReport(null);
      onClose();
    }
  };

  // Polls /members/invite-status/:batchId until every queued mail has an
  // outcome, folding each address's result into the report as it lands so
  // the "Result" list fills in live rather than appearing all at once.
  const pollMailStatus = (batchId) => {
    pollRef.current = setTimeout(async () => {
      let status;
      try {
        status = await lmApi.inviteStatus(classId, batchId);
      } catch {
        // A transient failure to poll is not worth surfacing — the next tick
        // tries again, and the batch itself is unaffected either way.
        pollMailStatus(batchId);
        return;
      }

      const byEmail = new Map(status.updates.map((u) => [u.email, u.mailed]));
      let merged;
      setReport((prev) => {
        merged = (prev || []).map((entry) =>
          byEmail.has(entry.email) ? { ...entry, mailed: byEmail.get(entry.email) } : entry,
        );
        return merged;
      });
      setMailProgress({ completed: status.completed, total: status.total });

      if (status.done) {
        setMailProgress(null);
        setPhase(null);
        onDone();
        finish(merged);
        return;
      }
      pollMailStatus(batchId);
    }, 1200);
  };

  /**
   * Folds addresses from the ERP picker into whatever the teacher has already
   * typed, one per line and without repeating any. Returns how many were
   * actually new, which is what the picker reports back.
   */
  const addAddresses = (incoming) => {
    let added = 0;
    setEmails((current) => {
      const have = new Set(
        current.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean),
      );
      const fresh = incoming.filter((email) => {
        const key = String(email || '').trim().toLowerCase();
        if (!key || have.has(key)) return false;
        have.add(key);
        return true;
      });
      added = fresh.length;
      if (!fresh.length) return current;
      const head = current.trim();
      return `${head ? `${head}\n` : ''}${fresh.join('\n')}\n`;
    });
    return added;
  };

  const submit = async () => {
    const list = emails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (!list.length) return;

    setBusy(true);
    setReport(null);
    setMailProgress(null);
    setCreatedCount(0);
    // The server creates every account before it queues a single mail, so this
    // is what the whole request is doing until it comes back.
    setPhase('creating');
    stopPolling();
    try {
      const result = await lmApi.inviteMembers(classId, list, role);
      setReport(result.results);
      setCreatedCount(result.results.filter((entry) => entry.status === 'account_created').length);
      // Membership rows are already written — the roster and counts are
      // correct now, regardless of how long the mail queue below takes.
      onDone();

      if (result.batchId) {
        setPhase('sending');
        setMailProgress({ completed: 0, total: result.mailPending });
        pollMailStatus(result.batchId);
      } else {
        // Nothing to mail — every address failed to provision, or everyone was
        // already in the class.
        setPhase(null);
        finish(result.results);
      }
    } catch (error) {
      setPhase(null);
      toast({ status: 'error', title: 'Could not invite', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Invite people</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={4}>
            <FormLabel fontSize="sm">Role</FormLabel>
            <Select value={role} onChange={(event) => setRole(event.target.value)}>
              {availableRoles.includes('student') && <option value="student">Student</option>}
              {availableRoles.includes('co-teacher') && <option value="co-teacher">Co-teacher</option>}
            </Select>
          </FormControl>
          {/* Above the address box, because it is the step that fills it, and
              students only: the ERP roster lists who sits the subject, so there
              is nothing on it to make a co-teacher from. */}
          {role === 'student' && (
            <ErpRosterPicker classId={classId} klass={klass} onAdd={addAddresses} />
          )}

          <FormControl mt={4}>
            <FormLabel fontSize="sm">Email addresses</FormLabel>
            <Textarea
              rows={6}
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              placeholder={'one@nitj.ac.in\ntwo@nitj.ac.in, three@nitj.ac.in'}
            />
            <FormHelperText fontSize="xs">
              Separate with commas, spaces or new lines.
            </FormHelperText>
          </FormControl>

          {/* Stated rather than enforced, because it cannot be detected: a
              batch alias is a well-formed address like any other, and only the
              mail server knows it fans out. */}
          <Flex
            mt={3}
            p={3}
            gap={3}
            align="flex-start"
            borderWidth="1px"
            borderColor="lmHue.orange200"
            bg="lmHue.orange50"
            borderRadius="md"
          >
            <Box color="orange.500" pt={0.5}>
              <LmIcon name="warning" size={15} />
            </Box>
            <Box>
              <Text fontSize="xs" fontWeight="700" color="lmFg.heading">
                Do not use a group ID
              </Text>
              <Text fontSize="xs" color="lmFg.subtle" mt={1}>
                Use individual IDs, fetch from the ERP, or share the class code.
              </Text>
            </Box>
          </Flex>

          <Box mt={5} p={4} borderWidth="1px" borderColor="lmBorder.base" borderRadius="md" bg="lmBg.sunken">
            <Text fontSize="sm" fontWeight="600">
              Accounts are created automatically
            </Text>
            <Text fontSize="xs" color="lmFg.subtle" mt={2}>
              Each person without an XCEED account gets one with the{' '}
              <Badge colorScheme="cyan">{platformRole}</Badge> role and is enrolled straight away. They
              receive an email inviting them to set their own password — no password is ever emailed, and
              the account cannot be signed into until they do. People who already have an account are
              given the <Badge colorScheme="cyan">{platformRole}</Badge> role if they do not have it yet.
            </Text>
            <Text fontSize="xs" color="lmFg.subtle" mt={2}>
              Accounts are created first and the emails go out only afterwards, so nobody is mailed
              about an account that could not be created.
            </Text>
          </Box>

          {phase && (
            <Box mt={4} p={3} borderWidth="1px" borderColor="lmBorder.base" borderRadius="md">
              {/* The two steps in the order the server runs them: nothing is
                  mailed until every account exists, so showing them as one
                  spinner hides which half is slow. */}
              <InviteStep
                label="Creating accounts"
                state={phase === 'creating' ? 'running' : 'done'}
                detail={
                  phase === 'creating'
                    ? 'Adding people to the database…'
                    : `${createdCount} new account${createdCount === 1 ? '' : 's'} created`
                }
              />
              <InviteStep
                mt={3}
                label="Sending emails"
                state={phase === 'sending' ? 'running' : 'waiting'}
                detail={
                  phase === 'sending'
                    ? `${mailProgress?.completed ?? 0} of ${mailProgress?.total ?? 0} sent`
                    : 'Starts once every account exists'
                }
              />
              <Progress
                mt={3}
                value={
                  phase === 'sending' && mailProgress?.total
                    ? (mailProgress.completed / mailProgress.total) * 100
                    : 0
                }
                size="xs"
                colorScheme="blue"
                borderRadius="full"
                isIndeterminate={phase === 'creating' || !mailProgress?.total}
              />
            </Box>
          )}

          {report && (
            <Box mt={4}>
              <Text fontSize="sm" fontWeight="600" mb={1}>
                Result
              </Text>
              {report.map((entry) => (
                <Flex key={entry.email} fontSize="xs" justify="space-between" py={1} gap={2}>
                  <Text noOfLines={1}>{entry.email}</Text>
                  <HStack spacing={1}>
                    <Badge
                      colorScheme={
                        entry.status === 'error'
                          ? 'red'
                          : entry.status === 'already_member'
                            ? 'gray'
                            : 'green'
                      }
                    >
                      {entry.status === 'account_created'
                        ? `account created (${entry.platformRole})`
                        : entry.status === 'error'
                          ? entry.message || 'failed'
                          : entry.status.replace(/_/g, ' ')}
                    </Badge>
                    {entry.mailed === false && <Badge colorScheme="orange">email failed</Badge>}
                    {entry.mailed === null && ['account_created', 'added', 'invited'].includes(entry.status) && (
                      <Badge colorScheme="blue">sending…</Badge>
                    )}
                  </HStack>
                </Flex>
              ))}
            </Box>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={submit}
            isLoading={busy || phase === 'sending'}
            loadingText={phase === 'sending' ? 'Sending emails…' : 'Creating accounts…'}
            isDisabled={!emails.trim()}
          >
            Send invites
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function ProgressModal({ isOpen, onClose, classId, membership }) {
  const { data, isLoading } = useQuery({
    queryKey: ['learning', 'memberProgress', classId, membership?._id],
    queryFn: () => lmApi.memberProgress(classId, membership._id),
    enabled: isOpen && !!membership,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{membership?.name || 'Student'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {isLoading || !data ? (
            <Loading minH="160px" />
          ) : (
            <>
              <HStack spacing={4} mb={4} wrap="wrap">
                <Box>
                  <Text fontSize="2xl" fontWeight="700">
                    {data.summary.turnedIn}
                  </Text>
                  <Text fontSize="xs" color="lmFg.muted">
                    Turned in
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="2xl" fontWeight="700" color="red.500">
                    {data.summary.late}
                  </Text>
                  <Text fontSize="xs" color="lmFg.muted">
                    Late
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="2xl" fontWeight="700" color="blue.500">
                    {data.summary.percent === null ? '—' : `${data.summary.percent}%`}
                  </Text>
                  <Text fontSize="xs" color="lmFg.muted">
                    {data.summary.earned}/{data.summary.possible} points
                  </Text>
                </Box>
              </HStack>
              {data.summary.percent !== null && (
                <Progress value={data.summary.percent} colorScheme="blue" borderRadius="full" mb={4} />
              )}
              <Divider mb={3} />
              {data.submissions.map((submission) => (
                <Flex key={submission._id} justify="space-between" py={2} borderBottomWidth="1px" borderColor="lmBorder.subtle">
                  <Box>
                    <Text fontSize="sm">{submission.courseworkId?.title || 'Deleted item'}</Text>
                    <Text fontSize="xs" color="lmFg.muted">
                      {submission.state}
                      {submission.late ? ' · late' : ''}
                    </Text>
                  </Box>
                  <Text fontSize="sm" fontWeight="600">
                    {submission.grade === null || submission.grade === undefined
                      ? '—'
                      : `${submission.grade}/${submission.maxPoints}`}
                  </Text>
                </Flex>
              ))}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function EmailModal({ isOpen, onClose, classId, membership, className }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen && membership) {
      setSubject(`[${className || 'Class'}] Notice for ${membership.name || 'Student'}`);
      setBody('');
    }
  }, [isOpen, membership, className]);

  if (!membership) return null;

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({ status: 'warning', title: 'Please enter a subject and message body.' });
      return;
    }

    setSending(true);
    try {
      await lmApi.emailMember(classId, membership._id, { subject: subject.trim(), body: body.trim() });
      toast({ status: 'success', title: 'Email sent to student.' });
      onClose();
    } catch (error) {
      toast({ status: 'error', title: 'Could not send email', description: error.message });
    } finally {
      setSending(false);
    }
  };

  const mailtoHref = membership.email
    ? `mailto:${encodeURIComponent(membership.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : '#';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Email {membership.name || 'Student'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={4}>
            <FormLabel fontSize="sm">To</FormLabel>
            <Input value={membership.email || 'No email address registered'} isReadOnly bg="lmBg.sunken" fontSize="sm" />
          </FormControl>
          <FormControl mb={4} isRequired>
            <FormLabel fontSize="sm">Subject</FormLabel>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject"
              fontSize="sm"
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Message</FormLabel>
            <Textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here..."
              fontSize="sm"
            />
            <FormHelperText>
              Sent directly to the student&apos;s email address and saved as an in-app notification.
            </FormHelperText>
          </FormControl>
        </ModalBody>
        <ModalFooter gap={2}>
          {membership.email && (
            <Button
              as="a"
              href={mailtoHref}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="sm"
              leftIcon={<FiMail />}
            >
              Open in Email App
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            size="sm"
            onClick={handleSend}
            isLoading={sending}
            isDisabled={!subject.trim() || !body.trim()}
          >
            Send Email
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/**
 * "The ERP has students this class does not."
 *
 * The roster a class is taught from moves after the class is made: late
 * registrations, branch changes, a roster sync that only ran last night. A
 * teacher has no reason to reopen the invite modal on the off-chance, so the
 * page checks for them and says so — naming the roll numbers, because that is
 * what a teacher recognises a missing student by.
 *
 * It never acts. Confirming who actually gets invited stays with the faculty,
 * in the modal, one tick at a time.
 */
function ErpRosterNotice({ preview, onReview }) {
  const missing = (preview?.students || []).filter((st) => !st.alreadyMember);
  if (!missing.length) return null;

  // Long rosters get a head and a count rather than a wall of numbers.
  const shown = missing.slice(0, 8);
  const rest = missing.length - shown.length;

  return (
    <Flex
      mb={4}
      p={3}
      gap={3}
      align="flex-start"
      borderWidth="1px"
      borderColor="lmHue.blue200"
      bg="lmHue.blue50"
      borderRadius="md"
    >
      <Box color="blue.500" pt={0.5}>
        <LmIcon name="info" size={16} />
      </Box>
      <Box flex="1" minW={0}>
        <Text fontSize="sm" fontWeight="600" color="lmFg.heading">
          {missing.length} student{missing.length === 1 ? '' : 's'} on the ERP roster{' '}
          {missing.length === 1 ? 'is' : 'are'} not in this class
        </Text>
        <Text fontSize="xs" color="lmFg.subtle" mt={1} wordBreak="break-word">
          {shown.map((st) => st.rollNo).join(', ')}
          {rest > 0 ? ` and ${rest} more` : ''}
        </Text>
      </Box>
      <Button size="sm" colorScheme="blue" flexShrink={0} onClick={onReview}>
        Review &amp; invite
      </Button>
    </Flex>
  );
}

function PersonRow({ member, isTeacher, isOwner, classId, onChanged, onViewProgress, onEmailMember }) {
  const toast = useToast();

  const act = async (fn, successTitle) => {
    try {
      await fn();
      toast({ status: 'success', title: successTitle });
      onChanged();
    } catch (error) {
      toast({ status: 'error', title: error.message });
    }
  };

  return (
    <Flex align="center" gap={3} py={3} borderBottomWidth="1px" borderColor="lmBorder.subtle" wrap="wrap">
      <Avatar size="sm" name={member.name || member.email} getInitials={() => initials(member.name || member.email)} />
      <Box flex="1" minW={0}>
        <HStack spacing={2} wrap="wrap">
          <Text fontSize="sm" fontWeight="500" noOfLines={1}>
            {member.name || member.email || 'Pending user'}
          </Text>
          {member.role !== 'student' && <Badge colorScheme="yellow">{member.role}</Badge>}
          {member.status === 'pending' && <Badge colorScheme="orange">Requested</Badge>}
          {member.status === 'invited' && <Badge colorScheme="cyan">Invited</Badge>}
          {member.muted && <Badge colorScheme="red">Muted</Badge>}
        </HStack>
        <Text fontSize="xs" color="lmFg.muted" noOfLines={1}>
          {member.email}
          {member.rollNumber ? ` · ${member.rollNumber}` : ''}
          {member.lastSeenAt ? ` · active ${relativeTime(member.lastSeenAt)}` : ''}
        </Text>
      </Box>

      {member.status === 'pending' && isTeacher && (
        <HStack wrap="wrap">
          <Button
            size="xs"
            colorScheme="green"
            onClick={() => act(() => lmApi.decideJoinRequest(classId, member._id, true), 'Approved')}
          >
            Approve
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => act(() => lmApi.decideJoinRequest(classId, member._id, false), 'Declined')}
          >
            Decline
          </Button>
        </HStack>
      )}

      {isTeacher && member.status === 'active' && (
        <HStack spacing={1}>
          {member.role === 'student' && onEmailMember && (
            <IconButton
              size="xs"
              variant="ghost"
              icon={<FiMail />}
              aria-label={`Email ${member.name || 'student'}`}
              title="Email student"
              onClick={() => onEmailMember(member)}
            />
          )}
          <Menu>
            <MenuButton as={Button} size="xs" variant="ghost">
              ⋮
            </MenuButton>
            <MenuList>
              {member.role === 'student' && (
                <MenuItem {...buttonTextStyles} onClick={() => onViewProgress(member)}>
                  View progress
                </MenuItem>
              )}
              {member.role === 'student' && onEmailMember && (
                <MenuItem {...buttonTextStyles} icon={<FiMail />} onClick={() => onEmailMember(member)}>
                  Email student
                </MenuItem>
              )}
              {member.role === 'student' && (
                <MenuItem {...buttonTextStyles} onClick={() => act(() => lmApi.updateMember(classId, member._id, { role: 'co-teacher' }), 'Promoted to co-teacher')}>
                  Make co-teacher
                </MenuItem>
              )}
              {member.role === 'co-teacher' && (
                <MenuItem {...buttonTextStyles} onClick={() => act(() => lmApi.updateMember(classId, member._id, { role: 'student' }), 'Changed to student')}>
                  Make student
                </MenuItem>
              )}
              <MenuItem {...buttonTextStyles} onClick={() => act(() => lmApi.updateMember(classId, member._id, { muted: !member.muted }), member.muted ? 'Unmuted' : 'Muted')}>
                {member.muted ? 'Allow posting' : 'Mute (no posts or comments)'}
              </MenuItem>
              {isOwner && member.role !== 'teacher' && (
                <>
                  <MenuDivider />
                  <MenuItem
                    {...buttonTextStyles}
                    onClick={() => {
                      // eslint-disable-next-line no-alert
                      if (window.confirm(`Transfer ownership of this class to ${member.name}?`)) {
                        act(() => lmApi.transferOwnership(classId, member._id), 'Ownership transferred');
                      }
                    }}
                  >
                    Transfer ownership
                  </MenuItem>
                </>
              )}
              <MenuDivider />
              <MenuItem
                color="red.600"
                onClick={() => {
                  // eslint-disable-next-line no-alert
                  if (window.confirm(`Remove ${member.name || member.email} from the class?`)) {
                    act(() => lmApi.removeMember(classId, member._id), 'Removed');
                  }
                }}
              >
                Remove from class
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      )}
    </Flex>
  );
}

export default function People() {
  const { classId, klass, isTeacher, reloadClass } = useOutletContext();
  const [progressFor, setProgressFor] = useState(null);
  const [emailFor, setEmailFor] = useState(null);
  const [inviteRole, setInviteRole] = useState('student');
  const [availableRoles, setAvailableRoles] = useState(['student', 'co-teacher']);
  const invite = useDisclosure();
  const progress = useDisclosure();
  const emailModal = useDisclosure();

  const {
    data: members = { teachers: [], students: [] },
    isLoading: loading,
    error,
    refetch: load,
  } = useQuery({
    queryKey: ['learning', 'members', classId],
    queryFn: () => lmApi.listMembers(classId),
  });

  const openInvite = ({ role = 'student', roles = ['student'] } = {}) => {
    setInviteRole(role);
    setAvailableRoles(roles);
    invite.onOpen();
  };

  // The same cached read the invite modal uses, so noticing a change costs no
  // extra request once the modal has been opened (and vice versa).
  const { data: erpRoster } = useQuery(erpRosterQuery(classId, isTeacher));
  const queryClient = useQueryClient();

  const afterChange = async () => {
    await load();
    reloadClass();
    // Whoever was just invited is a member now, so the roster's "not in this
    // class" answer is stale and the notice above it would still be counting
    // them.
    queryClient.invalidateQueries({ queryKey: ['learning', 'erp-roster', classId] });
  };

  const openProgress = (member) => {
    setProgressFor(member);
    progress.onOpen();
  };

  const openEmail = (member) => {
    setEmailFor(member);
    emailModal.onOpen();
  };

  if (loading) return <Loading label="Loading people…" />;

  const pending = members.students.filter((m) => m.status === 'pending');

  return (
    <Box>
      <ErrorState error={error} onRetry={load} />

      {pending.length > 0 && isTeacher && (
        <Box mb={4}>
          <SectionCard title={`${pending.length} join request${pending.length === 1 ? '' : 's'}`}>
            {pending.map((member) => (
              <PersonRow
                key={member._id}
                member={member}
                isTeacher={isTeacher}
                isOwner={klass.isOwner}
                classId={classId}
                onChanged={afterChange}
                onViewProgress={openProgress}
                onEmailMember={openEmail}
              />
            ))}
          </SectionCard>
        </Box>
      )}

      <SectionCard
        title={`Teachers (${members.teachers.length})`}
        action={
          isTeacher ? (
            <Button size="sm" variant="outline" onClick={() => openInvite({ role: 'co-teacher', roles: ['co-teacher'] })}>
              + Invite
            </Button>
          ) : null
        }
        mb={4}
      >
        {members.teachers.map((member) => (
          <PersonRow
            key={member._id}
            member={member}
            isTeacher={isTeacher}
            isOwner={klass.isOwner}
            classId={classId}
            onChanged={afterChange}
            onViewProgress={openProgress}
            onEmailMember={openEmail}
          />
        ))}
      </SectionCard>

      <SectionCard
        title={`Students (${members.students.filter((m) => m.status !== 'pending').length})`}
        action={
          isTeacher ? (
            <Button size="sm" variant="outline" onClick={() => openInvite()}>
              + Invite
            </Button>
          ) : null
        }
      >
        {isTeacher && <ErpRosterNotice preview={erpRoster} onReview={() => openInvite()} />}

        {members.students.filter((m) => m.status !== 'pending').length === 0 ? (
          <EmptyState
            icon="people"
            title="No students yet"
            description={
              isTeacher
                ? `Share the class code "${klass.code}", or invite students — the ERP roster for this subject is offered when you do.`
                : 'The roster is empty.'
            }
            action={
              isTeacher ? (
                <Button size="sm" variant="outline" onClick={() => openInvite()}>
                  Invite students
                </Button>
              ) : null
            }
          />
        ) : (
          members.students
            .filter((m) => m.status !== 'pending')
            .map((member) => (
              <PersonRow
                key={member._id}
                member={member}
                isTeacher={isTeacher}
                isOwner={klass.isOwner}
                classId={classId}
                onChanged={afterChange}
                onViewProgress={openProgress}
                onEmailMember={openEmail}
              />
            ))
        )}
      </SectionCard>

      {!isTeacher && (
        <Box mt={4}>
          <Text fontSize="xs" color="lmFg.muted">
            Joined {formatDate(klass.created_at)} · taught by {klass.ownerName}
          </Text>
        </Box>
      )}

      <InviteModal
        isOpen={invite.isOpen}
        onClose={invite.onClose}
        classId={classId}
        klass={klass}
        onDone={afterChange}
        defaultRole={inviteRole}
        availableRoles={availableRoles}
      />
      <ProgressModal
        isOpen={progress.isOpen}
        onClose={progress.onClose}
        classId={classId}
        membership={progressFor}
      />
      <EmailModal
        isOpen={emailModal.isOpen}
        onClose={emailModal.onClose}
        classId={classId}
        membership={emailFor}
        className={klass?.name}
      />
    </Box>
  );
}
