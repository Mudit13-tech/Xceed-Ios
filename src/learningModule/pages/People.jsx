import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { FiMail } from 'react-icons/fi';
import { EmptyState, ErrorState, Loading, SectionCard, buttonTextStyles } from '../components/common';
import { formatDate, initials, relativeTime } from '../format';

function InviteModal({ isOpen, onClose, classId, onDone, defaultRole = 'student', availableRoles = ['student', 'co-teacher'] }) {
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState(defaultRole);

  useEffect(() => {
    if (isOpen) {
      setRole(defaultRole);
    }
  }, [isOpen, defaultRole]);
  const [createAccounts, setCreateAccounts] = useState(true);
  const [grantRoleToExisting, setGrantRoleToExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  // Mail for an invite goes out in the background after the membership rows
  // are already written — see memberController.inviteMembers. `mailProgress`
  // tracks that batch so the modal can show "sending N of M" instead of
  // sitting on a spinner for as long as the slowest SMTP attempt takes.
  const [mailProgress, setMailProgress] = useState(null);
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
    stopPolling();
    try {
      const result = await lmApi.inviteMembers(classId, list, role, {
        createAccounts,
        grantRoleToExisting,
      });
      setReport(result.results);
      // Membership rows are already written — the roster and counts are
      // correct now, regardless of how long the mail queue below takes.
      onDone();

      if (result.batchId) {
        setMailProgress({ completed: 0, total: result.mailPending });
        pollMailStatus(result.batchId);
      } else {
        finish(result.results);
      }
    } catch (error) {
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
          <FormControl>
            <FormLabel fontSize="sm">Email addresses</FormLabel>
            <Textarea
              rows={6}
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              placeholder={'one@nitj.ac.in\ntwo@nitj.ac.in, three@nitj.ac.in'}
            />
            <FormHelperText>Separate with commas, spaces or new lines.</FormHelperText>
          </FormControl>

          <Box mt={5} p={4} borderWidth="1px" borderColor="lmBorder.base" borderRadius="md" bg="lmBg.sunken">
            <Checkbox
              isChecked={createAccounts}
              onChange={(event) => setCreateAccounts(event.target.checked)}
            >
              <Text fontSize="sm" fontWeight="600">
                Create XCEED accounts for addresses that don&apos;t have one
              </Text>
            </Checkbox>
            <Text fontSize="xs" color="lmFg.subtle" mt={2} ml={6}>
              {createAccounts ? (
                <>
                  Each new person gets an account with the <Badge colorScheme="cyan">{platformRole}</Badge>{' '}
                  role and is enrolled straight away. They receive an email inviting them to set their own
                  password — no password is ever emailed, and the account cannot be signed into until they
                  do.
                </>
              ) : (
                <>
                  Addresses without an account are stored as pending invites and enrolled automatically the
                  first time that person signs in to XCEED.
                </>
              )}
            </Text>

            <Checkbox
              mt={3}
              size="sm"
              isChecked={grantRoleToExisting}
              onChange={(event) => setGrantRoleToExisting(event.target.checked)}
            >
              Also give the {platformRole} role to people who already have an account without it
            </Checkbox>
            <Text fontSize="xs" color="lmFg.muted" mt={1} ml={6}>
              Off by default — changing an existing user&apos;s platform roles is usually an
              administrator&apos;s decision.
            </Text>
          </Box>

          {mailProgress && (
            <Box mt={4}>
              <Flex justify="space-between" mb={1}>
                <Text fontSize="xs" color="lmFg.subtle">
                  Sending invite emails…
                </Text>
                <Text fontSize="xs" color="lmFg.subtle">
                  {mailProgress.completed} of {mailProgress.total}
                </Text>
              </Flex>
              <Progress
                value={mailProgress.total ? (mailProgress.completed / mailProgress.total) * 100 : 0}
                size="xs"
                colorScheme="blue"
                borderRadius="full"
                isIndeterminate={mailProgress.total === 0}
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
          <Button colorScheme="blue" onClick={submit} isLoading={busy} isDisabled={!emails.trim()}>
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
            <Button size="sm" variant="outline" onClick={() => { setInviteRole('co-teacher'); setAvailableRoles(['co-teacher']); invite.onOpen(); }}>
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
            <Button size="sm" variant="outline" onClick={() => { setInviteRole('student'); setAvailableRoles(['student']); invite.onOpen(); }}>
              + Invite
            </Button>
          ) : null
        }
      >
        {members.students.filter((m) => m.status !== 'pending').length === 0 ? (
          <EmptyState
            icon="👥"
            title="No students yet"
            description={
              isTeacher
                ? `Share the class code "${klass.code}" or invite students by email.`
                : 'The roster is empty.'
            }
            action={
              isTeacher ? (
                <Button size="sm" colorScheme="blue" onClick={() => { setInviteRole('student'); setAvailableRoles(['student']); invite.onOpen(); }}>
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
