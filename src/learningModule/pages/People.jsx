import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Avatar,
  Badge,
  Box,
  Button,
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
              mail server knows it fans out. The three cases below are the ones
              faculty actually hit, in the order they should try them — most of
              a B.Tech class needs no invitation at all, and typing sixty
              addresses to reach students who could have used the code is the
              mistake this box exists to head off. */}
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
                Individual student IDs only — never a group ID
              </Text>
              <Text fontSize="xs" color="lmFg.subtle" mt={1}>
                One address per student. A batch or group alias cannot be invited: it looks like an
                ordinary address here, and everyone behind it lands in the class as a single account.
              </Text>
              <Box as="ul" pl={4} mt={2} fontSize="xs" color="lmFg.subtle">
                <Box as="li">
                  <strong>B.Tech students</strong> already have accounts — share the class code{' '}
                  <Text as="span" fontFamily="mono" fontWeight="700" color="lmFg.heading">
                    {klass?.code || '——'}
                  </Text>{' '}
                  and let them join themselves. No invitation needed.
                </Box>
                <Box as="li" mt={1}>
                  <strong>M.Tech, PhD and everyone else</strong> — invite them here, one individual ID
                  at a time.
                </Box>
                <Box as="li" mt={1}>
                  <strong>No account yet?</strong> Ask them to create one at{' '}
                  <Text
                    as="a"
                    href="https://xceed.nitj.ac.in/help"
                    target="_blank"
                    rel="noopener noreferrer"
                    color="lmHue.blue600"
                    textDecoration="underline"
                  >
                    xceed.nitj.ac.in/help
                  </Text>
                  , then share the class code with them.
                </Box>
              </Box>
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
              <HStack spacing={6} mb={4}>
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
    <Flex align="center" gap={3} py={3} borderBottomWidth="1px" borderColor="lmBorder.subtle">
      <Avatar size="sm" name={member.name || member.email} getInitials={() => initials(member.name || member.email)} />
      <Box flex="1" minW={0}>
        <HStack spacing={2}>
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
        <HStack>
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

  const afterChange = async () => {
    await load();
    reloadClass();
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
        {members.students.filter((m) => m.status !== 'pending').length === 0 ? (
          <EmptyState
            icon="people"
            title="No students yet"
            description={
              isTeacher
                ? `Share the class code "${klass.code}", or invite students by their email addresses.`
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
