import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Link,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  VStack,
  useColorModeValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';

import { Link as RouterLink } from 'react-router-dom';

import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard } from '../components/common';
import { formatDateTime, relativeTime } from '../format';
import { LmIcon } from '../components/Icon';

/**
 * "Join our development team" — students asking to help build XCEED itself.
 *
 * One application per person per semester, which the server enforces and this
 * page shows *before* anything is typed: somebody who has already applied sees
 * their standing application and its verdict where the form would be, rather
 * than filling it in a second time to be told no at the end.
 *
 * The form is no longer open to anybody who can type. Two things have to be
 * done first — ten accepted bug reports or suggestions, and two XCEED events
 * with proof uploaded — and both are shown as progress on this page rather than
 * as a rule in a paragraph. Somebody four bugs short should be able to see that
 * they are four bugs short, and see it before they have written a pitch.
 *
 * The form is shown to them all the same, filled in and disabled rather than
 * hidden. A form nobody can see is a rule nobody can plan against: knowing what
 * will be asked is half of deciding whether to go after it, and there is
 * nothing secret on it. The server enforces the same gate on the endpoint, so
 * the disabling is a courtesy rather than the rule — see
 * services/devEligibility.js.
 *
 * The two warnings are the point of the form as much as the fields are. The
 * team is a working team, not a course — someone still learning to build, or
 * already carrying three other projects, is being set up to fail, and it is
 * kinder to say so on the form than in a rejection three weeks later. Neither
 * blocks submission: it is advice, and choosing to apply anyway is a real
 * answer that the admin gets to see.
 */

const STATUS_STYLE = {
  pending: { colorScheme: 'blue', label: 'waiting to be read' },
  accepted: { colorScheme: 'green', label: 'accepted' },
  rejected: { colorScheme: 'gray', label: 'not this time' },
};

const LEVELS = [
  { value: 'learning', label: 'Still learning to build things' },
  { value: 'comfortable', label: 'Comfortable building on my own' },
  { value: 'shipped', label: 'I have shipped something real' },
];

/**
 * The four things the team actually does, self-rated 1–5.
 *
 * Ordered front to back to model to ship, which is the order somebody thinks
 * about their own work in. The keys match the `skills` subdocument on the
 * server; the labels are the only place they are spelled out for a reader.
 */
const SKILLS = [
  { key: 'frontend', label: 'Frontend', hint: 'React, layout, making it usable' },
  { key: 'backend', label: 'Backend', hint: 'APIs, databases, auth' },
  { key: 'aiModels', label: 'AI model development', hint: 'training, fine-tuning, evaluating' },
  { key: 'deployment', label: 'Deployment', hint: 'servers, CI, getting it live' },
];

const SCALE_HINT = { 1: 'never done it', 2: 'have tried it', 3: 'can work in it', 4: 'strong', 5: 'could teach it' };

const EMPTY = {
  rollNo: '',
  department: '',
  githubLink: '',
  deployedLink: '',
  dailyHours: '2',
  ongoingProjects: '0',
  experienceLevel: 'comfortable',
  whyHire: '',
  // 3 is the honest default for "have not thought about it", and it is what
  // the server falls back to anyway.
  skills: { frontend: 3, backend: 3, aiModels: 3, deployment: 3 },
};

/**
 * One 1–5 row.
 *
 * Five buttons rather than a slider or a dropdown: the whole scale is visible
 * without interacting, which matters on a phone and matters more when the same
 * question is asked four times in a row. Real `<button>`s, so it is keyboard
 * reachable and screen-reader legible in a way a row of styled divs is not.
 */
function RatingRow({ label, hint, value, onChange, isDisabled }) {
  const hintColor = useColorModeValue('gray.500', 'gray.400');

  return (
    <Box>
      <Flex align="baseline" gap={2} wrap="wrap" mb={1}>
        <Text fontSize="sm" fontWeight="600">
          {label}
        </Text>
        <Text fontSize="xs" color={hintColor}>
          {hint}
        </Text>
      </Flex>
      <HStack spacing={1.5}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Button
            key={score}
            size="sm"
            minW={{ base: '38px', sm: '44px' }}
            flex={{ base: '1', sm: '0 0 auto' }}
            variant={value === score ? 'solid' : 'outline'}
            colorScheme={value === score ? 'teal' : 'gray'}
            onClick={() => onChange(score)}
            isDisabled={isDisabled}
            aria-label={`${label}: ${score} out of 5`}
            aria-pressed={value === score}
          >
            {score}
          </Button>
        ))}
        <Text fontSize="xs" color={hintColor} pl={1} display={{ base: 'none', sm: 'block' }}>
          {SCALE_HINT[value]}
        </Text>
      </HStack>
      {/* The scale word wraps under the buttons on a phone, where there is no
          room for it beside them. */}
      <Text fontSize="xs" color={hintColor} mt={1} display={{ base: 'block', sm: 'none' }}>
        {SCALE_HINT[value]}
      </Text>
    </Box>
  );
}

/**
 * The same two link rules the server applies, so they are answered here rather
 * than by a 400 after the pitch has been written. Kept deliberately in step with
 * `parseHttpUrl`/`isGithubUrl` in devApplicationController.js — the server is
 * the one that decides; this only spares somebody the round trip.
 */
function httpUrl(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  // `https://github` parses but resolves nowhere.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) return null;
  return url;
}

/** Checked on the host: a path like /my-github-clone is not a GitHub profile. */
function githubProblem(value) {
  if (!value.trim()) return null;
  const url = httpUrl(value);
  if (!url) return 'Give the full link, starting with https://';
  if (!/(^|\.)github\.com$/i.test(url.hostname)) return 'This needs to be a github.com link.';
  return null;
}

function deployedProblem(value) {
  if (!value.trim()) return null;
  return httpUrl(value) ? null : 'Give the full link, starting with https:// — or leave it empty.';
}

/**
 * The honesty prompts.
 *
 * Shown as the answer is given, not on submit, so it reads as something to
 * think about rather than an error to work around.
 */
function warningsFor(form) {
  const list = [];
  if (form.experienceLevel === 'learning') {
    list.push(
      'You said you are still learning to build. This is a working team shipping to real users — it is not the best place to start. Finish something small end to end first and come back next semester; that application will be far stronger.',
    );
  }
  if (Number(form.ongoingProjects) >= 3) {
    list.push(
      `You are already on ${form.ongoingProjects} other projects. We would rather have a few hours a week you can actually keep than a name on a list — be honest with yourself about whether this fits.`,
    );
  }
  if (Number(form.dailyHours) > 0 && Number(form.dailyHours) < 1.5) {
    list.push('Under an hour and a half a day rarely adds up to anything shippable alongside coursework.');
  }
  return list;
}

/**
 * The last word before it goes.
 *
 * Everything here is already on the form somewhere, and it is repeated because
 * the moment somebody is about to spend their one application for the semester
 * is the moment they will actually read it. Two things are said here and nowhere
 * else: that a rejection is on the record and is read next time, and that a
 * first year who has not finished two semesters is almost certainly applying too
 * early.
 *
 * It does not block anybody. Applying anyway is a real answer, and the admin
 * gets to see that it was made with all of this in front of them.
 */
function ConfirmSend({ isOpen, onClose, onConfirm, saving, session, warnings }) {
  const cancelRef = useRef(null);

  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} leastDestructiveRef={cancelRef} isCentered size="lg">
      <AlertDialogOverlay>
        <AlertDialogContent mx={4}>
          <AlertDialogHeader fontSize="lg" fontWeight="700">
            Before you send this
          </AlertDialogHeader>

          <AlertDialogBody>
            <VStack align="stretch" spacing={3} fontSize="sm">
              <Alert status="warning" borderRadius="md" fontSize="sm" alignItems="flex-start">
                <AlertIcon />
                <Box>
                  <Text fontWeight="700">This is your one application for {session}.</Text>
                  <Text>
                    Whatever the answer, the next chance is next semester. There is no second try
                    and no editing it once it is sent.
                  </Text>
                </Box>
              </Alert>

              <Box>
                <Text fontWeight="700" mb={1}>
                  A rejection stays on your record.
                </Text>
                <Text>
                  Every application you have made is visible to whoever reads the next one, and a
                  pile of rejections counts against you in the long run. It is better to apply once,
                  later, with something to show than three times with nothing. Think it through
                  before you send.
                </Text>
              </Box>

              <Box>
                <Text fontWeight="700" mb={1}>
                  This is not the place to start learning.
                </Text>
                <Text>
                  It is a working team shipping to real users. If you are still learning to build,
                  or already carrying several other projects, this is not the right place right now
                  — and that is the most common reason applications are turned down.
                </Text>
              </Box>

              <Box>
                <Text fontWeight="700" mb={1}>
                  First years: wait.
                </Text>
                <Text>
                  If you have not finished two semesters yet, you are strongly discouraged from
                  applying unless your profile is genuinely extraordinary. Finish the year, build
                  something real, and apply with it.
                </Text>
              </Box>

              {warnings.length ? (
                <Box>
                  <Divider mb={3} />
                  <Text fontWeight="700" mb={2}>
                    From your own answers:
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    {warnings.map((warning) => (
                      <Alert key={warning} status="warning" borderRadius="md" fontSize="sm" alignItems="flex-start">
                        <AlertIcon />
                        <Text>{warning}</Text>
                      </Alert>
                    ))}
                  </VStack>
                </Box>
              ) : null}
            </VStack>
          </AlertDialogBody>

          <AlertDialogFooter gap={3}>
            {/* The cancel is the least destructive action and holds focus: the
                default answer to "are you sure" at this point is no. */}
            <Button ref={cancelRef} onClick={onClose} variant="ghost" isDisabled={saving}>
              Go back
            </Button>
            <Button colorScheme="teal" onClick={onConfirm} isLoading={saving}>
              I have read this — send it
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}

/**
 * The application itself, which is always on screen and not always live.
 *
 * `eligibility` decides which. Somebody short of the requirements gets every
 * field, disabled, under a banner saying what is missing — they can read what
 * will be asked and go and earn it, which is the whole point of showing it.
 * Nothing about that is a security boundary: the endpoint refuses the same
 * people, and this only spares them finding out at the end.
 */
function ApplicationForm({ suggested, session, eligibility, onSent }) {
  const [form, setForm] = useState({ ...EMPTY, department: suggested?.department || '' });
  const [saving, setSaving] = useState(false);
  const confirm = useDisclosure();
  const toast = useToast();

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const fromEvent = (key) => (event) => set(key)(event.target.value);
  const setSkill = (key) => (score) =>
    setForm((current) => ({ ...current, skills: { ...current.skills, [key]: score } }));

  const locked = !eligibility.eligible;
  const warnings = warningsFor(form);
  const githubError = githubProblem(form.githubLink);
  const deployedError = deployedProblem(form.deployedLink);
  const ready =
    !locked &&
    form.rollNo.trim() &&
    form.department.trim() &&
    form.githubLink.trim() &&
    !githubError &&
    !deployedError &&
    form.whyHire.trim().length >= 40 &&
    Number(form.dailyHours) > 0;

  const submit = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      await lmApi.applyToDevTeam({
        rollNo: form.rollNo.trim(),
        department: form.department.trim(),
        githubLink: form.githubLink.trim(),
        deployedLink: form.deployedLink.trim(),
        dailyHours: Number(form.dailyHours),
        ongoingProjects: Number(form.ongoingProjects) || 0,
        experienceLevel: form.experienceLevel,
        whyHire: form.whyHire.trim(),
        skills: form.skills,
      });
      toast({ status: 'success', title: 'Sent — we will come back to you', duration: 5000 });
      onSent();
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 8000 });
      // Back to the form with the refusal on screen — a validation message
      // behind a dialog is a message nobody can act on.
      confirm.onClose();
      // A 409 means somebody applied from another tab, or the semester rule
      // caught up with them. NOT_ELIGIBLE means an admin struck one of their
      // events while this form was open, so the gate closed under them. Either way
      // reloading swaps this form for the real state rather than leaving a form
      // that can never succeed.
      if (err.payload?.code === 'ALREADY_APPLIED' || err.payload?.code === 'NOT_ELIGIBLE') onSent();
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack align="stretch" spacing={5}>
      {/* Why the fields below will not take a keystroke, said before the first
          one is clicked rather than after. */}
      {locked ? <LockedBanner eligibility={eligibility} /> : null}

      {/* The rule, before anything has been typed. Learning it from a 409 after
          writing a pitch is the version of this that makes people angry. */}
      <Alert status="warning" borderRadius="md" fontSize="sm" alignItems="flex-start">
        <AlertIcon />
        <Box>
          <Text fontWeight="700">You can apply only once per semester.</Text>
          <Text>
            This is your one application for {session}. Whatever the answer — accepted or not — the
            next chance is next semester, so take your time over it.
          </Text>
        </Box>
      </Alert>

      {/* Two per row on a laptop, stacked on a phone — these are short fields
          and a full-width roll number reads as a mistake. */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <FormControl isRequired>
          <FormLabel fontSize="sm">Roll number</FormLabel>
          <Input
            value={form.rollNo}
            onChange={fromEvent('rollNo')}
            placeholder="e.g. 21103045"
            maxLength={40}
            isDisabled={locked}
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel fontSize="sm">Department</FormLabel>
          <Input
            value={form.department}
            onChange={fromEvent('department')}
            placeholder="e.g. Computer Science & Engineering"
            maxLength={120}
            isDisabled={locked}
          />
          {suggested?.department ? (
            <FormHelperText fontSize="xs">Prefilled from your account — change it if it is wrong.</FormHelperText>
          ) : null}
        </FormControl>

        <FormControl isRequired isInvalid={Boolean(githubError)}>
          <FormLabel fontSize="sm">GitHub profile</FormLabel>
          <Input
            value={form.githubLink}
            onChange={fromEvent('githubLink')}
            placeholder="https://github.com/yourname"
            type="url"
            isDisabled={locked}
          />
          {githubError ? (
            <FormErrorMessage fontSize="xs">{githubError}</FormErrorMessage>
          ) : (
            <FormHelperText fontSize="xs">The code matters more than the CV. Pin your best repo.</FormHelperText>
          )}
        </FormControl>

        <FormControl isInvalid={Boolean(deployedError)}>
          <FormLabel fontSize="sm">A deployed project</FormLabel>
          <Input
            value={form.deployedLink}
            onChange={fromEvent('deployedLink')}
            placeholder="https://yourproject.vercel.app"
            type="url"
            isDisabled={locked}
          />
          {deployedError ? (
            <FormErrorMessage fontSize="xs">{deployedError}</FormErrorMessage>
          ) : (
            <FormHelperText fontSize="xs">
              Anything of yours that is live and clickable. Leave empty if you have none yet.
            </FormHelperText>
          )}
        </FormControl>

        <FormControl isRequired>
          <FormLabel fontSize="sm">Hours you can give, per day</FormLabel>
          <NumberInput
            min={0.5}
            max={16}
            step={0.5}
            value={form.dailyHours}
            onChange={set('dailyHours')}
            isDisabled={locked}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
          <FormHelperText fontSize="xs">Be realistic — we plan around this number.</FormHelperText>
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm">Other projects you are on right now</FormLabel>
          <NumberInput
            min={0}
            max={20}
            value={form.ongoingProjects}
            onChange={set('ongoingProjects')}
            isDisabled={locked}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </FormControl>
      </SimpleGrid>

      <FormControl>
        <FormLabel fontSize="sm">Where are you with building things?</FormLabel>
        <Select
          value={form.experienceLevel}
          onChange={fromEvent('experienceLevel')}
          maxW={{ md: '420px' }}
          isDisabled={locked}
        >
          {LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel fontSize="sm" mb={1}>
          Rate yourself, 1 to 5
        </FormLabel>
        <FormHelperText fontSize="xs" mt={0} mb={3}>
          1 = never done it, 5 = could teach it. Be straight about it — we read these against your
          GitHub, and knowing what you do not know yet counts for more than a row of fives.
        </FormHelperText>
        <VStack align="stretch" spacing={4}>
          {SKILLS.map((skill) => (
            <RatingRow
              key={skill.key}
              label={skill.label}
              hint={skill.hint}
              value={form.skills[skill.key]}
              onChange={setSkill(skill.key)}
              isDisabled={locked}
            />
          ))}
        </VStack>
      </FormControl>

      <FormControl isRequired>
        <FormLabel fontSize="sm">Why should we take you on?</FormLabel>
        <Textarea
          value={form.whyHire}
          onChange={fromEvent('whyHire')}
          rows={6}
          maxLength={3000}
          placeholder="What have you built, what do you want to work on here, and what will you bring that we do not already have?"
          isDisabled={locked}
        />
        <FormHelperText fontSize="xs">
          {form.whyHire.trim().length < 40
            ? `A line or two at least — ${40 - form.whyHire.trim().length} more characters.`
            : `${form.whyHire.length} / 3000`}
        </FormHelperText>
      </FormControl>

      {warnings.map((warning) => (
        <Alert key={warning} status="warning" borderRadius="md" fontSize="sm" alignItems="flex-start">
          <AlertIcon />
          <Text>{warning}</Text>
        </Alert>
      ))}

      <Flex gap={3} wrap="wrap" align="center">
        <Button
          colorScheme="teal"
          onClick={confirm.onOpen}
          isLoading={saving}
          isDisabled={!ready}
          w={{ base: '100%', sm: 'auto' }}
        >
          {locked ? 'Locked until both requirements are met' : 'Send my application'}
        </Button>
        <Text fontSize="xs" color="lmFg.muted">
          {locked
            ? 'Meet both requirements above and this form unlocks itself.'
            : `This is your one application for ${session}. It goes straight to the admins, and you will hear back by email and in your notifications.`}
        </Text>
      </Flex>

      <ConfirmSend
        isOpen={confirm.isOpen}
        onClose={confirm.onClose}
        onConfirm={submit}
        saving={saving}
        session={session}
        warnings={warnings}
      />
    </VStack>
  );
}

/**
 * The kinds of event a claim can name.
 *
 * `fe_course` is first and spelled out because it is the one people do not
 * think of as an event: taking the Foundation Elective counts as one, and a
 * student who does not know that will believe they are twice as far away as
 * they are.
 */
const EVENT_TYPES = [
  { value: 'fe_course', label: 'FE course (Foundation Elective) - counts as one event' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'seminar', label: 'Seminar / talk' },
  { value: 'competition', label: 'Competition' },
  { value: 'other', label: 'Something else' },
];

const EVENT_TYPE_LABEL = Object.fromEntries(
  EVENT_TYPES.map((type) => [type.value, type.label.split(' - ')[0]]),
);

const CLAIM_STATUS = {
  counted: { colorScheme: 'green', label: 'counted' },
  rejected: { colorScheme: 'red', label: 'not counted' },
};

/** Kept in step with PROOF_MAX_BYTES in the server's uploadController. */
const PROOF_MAX_BYTES = 1024 * 1024;

/**
 * One requirement, drawn as a bar.
 *
 * The bar is the point. "8 of 10" is a fact somebody has to do arithmetic on;
 * a bar four fifths full is a fact they can act on. The count still appears
 * beside it, because a bar cannot say that two more are what is left.
 *
 * Anything still waiting on an admin is called out separately rather than
 * folded into the bar. Counting unread claims towards the total would be a
 * promise that reverses itself the moment one is rejected -- and somebody who
 * cannot see that three are already in the queue will file three more.
 */
function RequirementBar({ title, done, required, remaining, pending, met, children }) {
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const pct = required ? Math.min(100, (done / required) * 100) : 0;

  return (
    <Box>
      <Flex justify="space-between" align="baseline" gap={3} wrap="wrap" mb={1}>
        <Text fontSize="sm" fontWeight="600">
          {met && <LmIcon name="success" size={13} style={{ marginRight: 4 }} />}
          {title}
        </Text>
        <Text fontSize="sm" fontWeight="700" color={met ? 'green.500' : undefined}>
          {done} / {required}
        </Text>
      </Flex>
      <Progress
        value={pct}
        size="sm"
        borderRadius="full"
        colorScheme={met ? 'green' : 'teal'}
        aria-label={`${title}: ${done} of ${required}`}
      />
      <Text fontSize="xs" color={subColor} mt={1.5}>
        {met ? 'Done — this requirement is met.' : `${remaining} to go.`}
        {pending
          ? ` ${pending} still waiting to be looked at — they do not count until they are.`
          : ''}
      </Text>
      {children ? <Box mt={2}>{children}</Box> : null}
    </Box>
  );
}

/**
 * The form for claiming one event.
 *
 * Proof is a file and not a link on purpose: a URL is something the claimant
 * controls and can change afterwards, and a file cannot be. One image or PDF,
 * under a megabyte -- the same limits the server applies, and checked here so an
 * oversized photo is refused before it is uploaded rather than after.
 *
 * The event counts the moment this succeeds. Nobody approves it first, so the
 * bar above moves as the page reloads, and the copy says so: a student told
 * their submission is "being checked" will sit and wait for a mail that is
 * never coming.
 */
function EventClaimForm({ onSubmitted }) {
  const [form, setForm] = useState({
    eventType: 'hackathon',
    eventName: '',
    eventDate: '',
    role: '',
    description: '',
  });
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);
  const toast = useToast();
  const subColor = useColorModeValue('gray.600', 'gray.400');

  const fromEvent = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const pickFile = (event) => {
    const chosen = event.target.files?.[0] || null;
    if (!chosen) {
      setFile(null);
      setFileError('');
      return;
    }
    if (!chosen.type.startsWith('image/') && chosen.type !== 'application/pdf') {
      setFile(null);
      setFileError('Proof has to be a photo or a PDF.');
      return;
    }
    if (chosen.size > PROOF_MAX_BYTES) {
      setFile(null);
      setFileError(
        `That file is ${(chosen.size / 1024 / 1024).toFixed(1)} MB — the limit is 1 MB. Save the photo smaller, or export the PDF at a lower quality.`,
      );
      return;
    }
    setFileError('');
    setFile(chosen);
  };

  const ready = form.eventName.trim() && file && !fileError;

  const submit = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      await lmApi.submitEventParticipation({
        ...form,
        eventName: form.eventName.trim(),
        proof: file,
      });
      toast({ status: 'success', title: 'Added — that event counts now', duration: 5000 });
      setForm({ eventType: 'hackathon', eventName: '', eventDate: '', role: '', description: '' });
      setFile(null);
      // The input keeps the old file otherwise, and picking the same one again
      // fires no change event -- so a resubmission would silently send nothing.
      if (fileInput.current) fileInput.current.value = '';
      onSubmitted();
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack align="stretch" spacing={4}>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <FormControl isRequired>
          <FormLabel fontSize="sm">What was it?</FormLabel>
          <Select value={form.eventType} onChange={fromEvent('eventType')}>
            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl isRequired>
          <FormLabel fontSize="sm">Event name</FormLabel>
          <Input
            value={form.eventName}
            onChange={fromEvent('eventName')}
            placeholder="e.g. XCEED Hackathon 2026"
            maxLength={160}
          />
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm">When</FormLabel>
          <Input type="date" value={form.eventDate} onChange={fromEvent('eventDate')} />
          <FormHelperText fontSize="xs">
            Roughly is fine. Leave it empty for something that ran a whole semester.
          </FormHelperText>
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm">What you did there</FormLabel>
          <Input
            value={form.role}
            onChange={fromEvent('role')}
            placeholder="e.g. participant, volunteer, runner-up"
            maxLength={120}
          />
        </FormControl>
      </SimpleGrid>

      <FormControl isRequired isInvalid={Boolean(fileError)}>
        <FormLabel fontSize="sm">Proof</FormLabel>
        <Input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          onChange={pickFile}
          p={1.5}
          height="auto"
        />
        {fileError ? (
          <FormErrorMessage fontSize="xs">{fileError}</FormErrorMessage>
        ) : (
          <FormHelperText fontSize="xs">
            One photo or PDF, 1 MB at most — a certificate, a participation slip, the
            confirmation mail. It has to show your name and the event: nobody checks it up
            front, but an admin can look at any of these later and strike one that shows
            nothing.
          </FormHelperText>
        )}
        {file ? (
          <Text fontSize="xs" color={subColor} mt={1}>
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </Text>
        ) : null}
      </FormControl>

      <FormControl>
        <FormLabel fontSize="sm">Anything else worth knowing</FormLabel>
        <Textarea
          value={form.description}
          onChange={fromEvent('description')}
          rows={3}
          maxLength={2000}
          placeholder="Optional - what you built, who ran it, anything that makes the proof easier to place."
        />
      </FormControl>

      <Flex gap={3} wrap="wrap" align="center">
        <Button
          colorScheme="teal"
          onClick={submit}
          isLoading={saving}
          isDisabled={!ready}
          w={{ base: '100%', sm: 'auto' }}
        >
          Add this event
        </Button>
        <Text fontSize="xs" color={subColor}>
          It counts straight away — nothing to wait for.
        </Text>
      </Flex>
    </VStack>
  );
}

/** The claims already filed, and what became of them. */
function EventClaimList({ participations }) {
  const subColor = useColorModeValue('gray.600', 'gray.400');

  if (!participations.length) {
    return (
      <Text fontSize="sm" color={subColor}>
        No events added yet.
      </Text>
    );
  }

  return (
    <VStack align="stretch" spacing={2}>
      {participations.map((claim) => {
        const style = CLAIM_STATUS[claim.status] || CLAIM_STATUS.counted;
        return (
          <Box key={claim._id} borderWidth="1px" borderRadius="md" p={3}>
            <Flex justify="space-between" gap={2} wrap="wrap" align="baseline">
              <Text fontSize="sm" fontWeight="600">
                {claim.eventName}
              </Text>
              <Badge colorScheme={style.colorScheme} borderRadius="full" px={2}>
                {style.label}
              </Badge>
            </Flex>
            <Text fontSize="xs" color={subColor} mt={0.5}>
              {EVENT_TYPE_LABEL[claim.eventType] || claim.eventType}
              {claim.role ? ` · ${claim.role}` : ''}
              {claim.eventDate ? ` · ${formatDateTime(claim.eventDate)}` : ''}
              {' · '}
              submitted {relativeTime(claim.created_at)}
            </Text>
            {claim.proof?.url ? (
              <Link
                href={lmApi.fileUrl(claim.proof.url)}
                isExternal
                color="teal.500"
                fontSize="xs"
                wordBreak="break-all"
              >
                {claim.proof.name || 'proof'} ↗
              </Link>
            ) : null}
            {claim.adminNote ? (
              <Text fontSize="xs" mt={2} color={subColor}>
                {claim.reviewedByName ? `${claim.reviewedByName}: ` : ''}
                {claim.adminNote}
              </Text>
            ) : null}
            {claim.status === 'rejected' ? (
              <Text fontSize="xs" mt={1} fontWeight="600">
                An admin has taken this one out of your total. Fix what it says and add the
                event again.
              </Text>
            ) : null}
          </Box>
        );
      })}
    </VStack>
  );
}

/**
 * The gate, and how far along somebody is through it.
 *
 * Shown whether or not they are eligible, and whether or not they have already
 * applied. Somebody through it should still be able to see what they did;
 * somebody not through it should see why before they see a locked form, which
 * is why this card sits above the application rather than inside it.
 */
function EligibilityPanel({ eligibility, participations, onChanged }) {
  const subColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <SectionCard
      title={eligibility.eligible ? 'You are eligible to apply' : 'Unlock the application'}
      subtitle={
        eligibility.eligible
          ? 'Both requirements are met. The application form is below.'
          : 'The development team is not open to everyone — it is open to people already helping. Two things unlock the form, and both are earned.'
      }
    >
      <VStack align="stretch" spacing={6}>
        <RequirementBar
          title="Bugs reported or improvements suggested, and accepted"
          done={eligibility.bugs.done}
          required={eligibility.bugs.required}
          remaining={eligibility.bugs.remaining}
          pending={eligibility.bugs.pending}
          met={eligibility.bugs.met}
        >
          <Text fontSize="xs" color={subColor}>
            Only reports an admin has accepted count — a duplicate or a rejected one does not.
            Report what you find on the{' '}
            <Link as={RouterLink} to="/learning/bugs" color="teal.500" fontWeight="600">
              Report a problem
            </Link>{' '}
            page.
          </Text>
        </RequirementBar>

        <Divider />

        <RequirementBar
          title="XCEED events taken part in, with proof uploaded"
          done={eligibility.events.done}
          required={eligibility.events.required}
          remaining={eligibility.events.remaining}
          pending={eligibility.events.pending}
          met={eligibility.events.met}
        >
          <Text fontSize="xs" color={subColor}>
            Hackathons, workshops and the like. Taking the FE course counts as one event. Add
            each one below with its proof — it counts as soon as you add it.
          </Text>
        </RequirementBar>

        <Divider />

        <Box>
          <Text fontSize="sm" fontWeight="600" mb={3}>
            Add an event
          </Text>
          <EventClaimForm onSubmitted={onChanged} />
        </Box>

        <Box>
          <Text fontSize="sm" fontWeight="600" mb={2}>
            Events you have added
          </Text>
          <EventClaimList participations={participations} />
        </Box>
      </VStack>
    </SectionCard>
  );
}

/**
 * The banner across the top of a form that cannot be sent yet.
 *
 * Sits inside the form rather than in place of it: the fields below it are
 * visible and disabled, so this has to say why they will not take a keystroke,
 * and say it where somebody who has just clicked one is looking.
 */
function LockedBanner({ eligibility }) {
  const short = [
    !eligibility.bugs.met
      ? `${eligibility.bugs.remaining} more accepted bug report${
          eligibility.bugs.remaining === 1 ? '' : 's'
        } or suggestion${eligibility.bugs.remaining === 1 ? '' : 's'}`
      : null,
    !eligibility.events.met
      ? `${eligibility.events.remaining} more XCEED event${
          eligibility.events.remaining === 1 ? '' : 's'
        } with proof`
      : null,
  ].filter(Boolean);

  return (
    <Alert status="info" borderRadius="md" fontSize="sm" alignItems="flex-start">
      <AlertIcon />
      <Box>
        <Text fontWeight="700" mb={1}>
          You can read the form, but not send it yet.
        </Text>
        <Text>
          You still need {short.join(' and ')}. It unlocks itself the moment you are through —
          there is nothing else to do and nobody to ask.
        </Text>
        <Text mt={2} fontSize="xs">
          This is not busywork. The people who are useful on this team are the ones who already use
          XCEED closely enough to find what is wrong with it, and who turn up when it runs
          something. Both requirements are just that, written down.
        </Text>
      </Box>
    </Alert>
  );
}

/** The applicant's own standing application, shown where the form would be. */
function MyApplication({ application }) {
  const style = STATUS_STYLE[application.status] || STATUS_STYLE.pending;
  const labelColor = useColorModeValue('gray.500', 'gray.400');

  const Fact = ({ label, children }) => (
    <Box>
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color={labelColor}>
        {label}
      </Text>
      <Text fontSize="sm" wordBreak="break-word">
        {children}
      </Text>
    </Box>
  );

  return (
    <VStack align="stretch" spacing={4}>
      <Flex gap={2} wrap="wrap" align="center">
        <Badge colorScheme={style.colorScheme} borderRadius="full" px={3} py={1}>
          {style.label}
        </Badge>
        <Text fontSize="xs" color={labelColor}>
          sent {relativeTime(application.created_at)} · for {application.session}
        </Text>
      </Flex>

      {application.status === 'pending' ? (
        <Alert status="info" borderRadius="md" fontSize="sm">
          <AlertIcon />
          It is with the admins — you will get an email and a notification the moment there is an
          answer. This was your one application for {application.session}; the next chance is next
          semester.
        </Alert>
      ) : (
        <Alert
          status={application.status === 'accepted' ? 'success' : 'warning'}
          borderRadius="md"
          fontSize="sm"
          alignItems="flex-start"
        >
          <AlertIcon />
          <Box>
            <Text fontWeight="600" mb={1}>
              {application.status === 'accepted'
                ? 'You are in — welcome aboard.'
                : 'Not taken up this semester.'}
            </Text>
            {application.adminMessage ? <Text whiteSpace="pre-wrap">{application.adminMessage}</Text> : null}
            {application.reviewedByName ? (
              <Text fontSize="xs" color={labelColor} mt={1}>
                — {application.reviewedByName}, {formatDateTime(application.reviewedAt)}
              </Text>
            ) : null}
            {application.status === 'rejected' ? (
              <Text fontSize="xs" mt={2} fontWeight="600">
                You can apply again next semester — one application each semester.
              </Text>
            ) : null}
          </Box>
        </Alert>
      )}

      <Divider />

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
        <Fact label="Roll no">{application.rollNo}</Fact>
        <Fact label="Department">{application.department}</Fact>
        <Fact label="Time per day">{application.dailyHours} h</Fact>
        <Fact label="GitHub">
          <Link href={application.githubLink} isExternal color="teal.500">
            {application.githubLink}
          </Link>
        </Fact>
        <Fact label="Deployed">
          {application.deployedLink ? (
            <Link href={application.deployedLink} isExternal color="teal.500">
              {application.deployedLink}
            </Link>
          ) : (
            '—'
          )}
        </Fact>
        <Fact label="Other projects">{application.ongoingProjects}</Fact>
      </SimpleGrid>

      {application.skills ? (
        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={2}>
          {SKILLS.map((skill) => (
            <Flex key={skill.key} gap={2} align="baseline">
              <Text fontSize="sm" flex="1">
                {skill.label}
              </Text>
              <Text fontSize="sm" fontWeight="600">
                {application.skills[skill.key]}/5
              </Text>
            </Flex>
          ))}
        </SimpleGrid>
      ) : null}

      <Box>
        <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color={labelColor} mb={1}>
          What you wrote
        </Text>
        <Text fontSize="sm" whiteSpace="pre-wrap">
          {application.whyHire}
        </Text>
      </Box>
    </VStack>
  );
}

/**
 * The queue, read-only.
 *
 * Deliberately has no reply box and no Accept/Reject: deciding happens in the
 * Super Admin queue at /superadmin/dev-team, which is the one place the
 * notification emails point at. Two screens that could both send a verdict meant
 * two screens to keep in step, and a reply box sitting under an application on a
 * page an applicant can open reads as something they are being asked to fill in.
 *
 * Only rendered when the API let this account read it.
 */
function AdminQueue({ applications, counts }) {
  const labelColor = useColorModeValue('gray.500', 'gray.400');
  const flagBg = useColorModeValue('orange.50', 'orange.900');

  if (!applications.length) return <EmptyState icon="empty" title="No applications yet" />;

  return (
    <VStack align="stretch" spacing={3}>
      <HStack spacing={2} wrap="wrap">
        {Object.entries(counts).map(([status, count]) => (
          <Badge key={status} colorScheme={STATUS_STYLE[status]?.colorScheme || 'gray'} borderRadius="full" px={2}>
            {count} {status}
          </Badge>
        ))}
      </HStack>

      {applications.map((application) => {
        const flags = [
          application.experienceLevel === 'learning' ? 'still at the learning stage' : null,
          application.ongoingProjects >= 3 ? `on ${application.ongoingProjects} other projects` : null,
        ].filter(Boolean);

        return (
          <Box key={application._id} borderWidth="1px" borderRadius="md" p={{ base: 3, md: 4 }}>
            <Flex justify="space-between" gap={3} wrap="wrap" mb={1}>
              <Text fontWeight="600">
                {application.applicantName} · {application.rollNo}
              </Text>
              <Badge colorScheme={STATUS_STYLE[application.status]?.colorScheme || 'gray'}>
                {application.status}
              </Badge>
            </Flex>
            <Text fontSize="xs" color={labelColor} mb={2}>
              {application.department} · {application.dailyHours} h/day · {application.session} ·{' '}
              {relativeTime(application.created_at)}
            </Text>

            {flags.length ? (
              <Box bg={flagBg} borderRadius="md" px={3} py={2} mb={2} fontSize="xs">
                <LmIcon name="warning" size={12} style={{ marginRight: 4 }} />
                {flags.join(' · ')}
              </Box>
            ) : null}

            <Stack direction={{ base: 'column', sm: 'row' }} spacing={{ base: 1, sm: 4 }} mb={2} fontSize="sm">
              <Link href={application.githubLink} isExternal color="teal.500" wordBreak="break-all">
                GitHub ↗
              </Link>
              {application.deployedLink ? (
                <Link href={application.deployedLink} isExternal color="teal.500" wordBreak="break-all">
                  Deployed project ↗
                </Link>
              ) : (
                <Text color={labelColor}>nothing deployed</Text>
              )}
              <Link href={`mailto:${application.applicantEmail}`} color="teal.500" wordBreak="break-all">
                {application.applicantEmail}
              </Link>
            </Stack>

            {application.skills ? (
              <HStack spacing={3} wrap="wrap" mb={2} fontSize="xs">
                {SKILLS.map((skill) => (
                  <Text key={skill.key} color={labelColor}>
                    {skill.label}{' '}
                    <Text as="span" fontWeight="700" color={application.skills[skill.key] >= 4 ? 'teal.500' : undefined}>
                      {application.skills[skill.key]}/5
                    </Text>
                  </Text>
                ))}
              </HStack>
            ) : null}

            <Text fontSize="sm" whiteSpace="pre-wrap" mb={3}>
              {application.whyHire}
            </Text>

            {application.status !== 'pending' && application.adminMessage ? (
              <Alert status="info" borderRadius="md" fontSize="xs" mb={2}>
                <AlertIcon />
                <Box>
                  Sent by {application.reviewedByName || 'an admin'}: {application.adminMessage}
                </Box>
              </Alert>
            ) : null}

          </Box>
        );
      })}
    </VStack>
  );
}

export default function DevTeam() {
  const [mine, setMine] = useState(null);
  const [events, setEvents] = useState([]);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [own, claims, admin] = await Promise.all([
        lmApi.myDevApplication(),
        lmApi.myEventParticipations(),
        // 403 for everyone who is not a platform admin, which is how this page
        // decides whether to show the queue at all.
        lmApi.allDevApplications().catch(() => null),
      ]);
      setMine(own);
      setEvents(claims.participations || []);
      setQueue(admin);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Loading…" />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  /* A server that has not been upgraded sends no eligibility block. Treating
     that as "met" rather than "locked out" is the right way round: the endpoint
     is the thing that actually enforces the gate, and a page that hid the form
     on a missing field would be a page nobody could apply from. */
  const eligibility = mine.eligibility || {
    bugs: { done: 0, required: 0, remaining: 0, pending: 0, met: true },
    events: { done: 0, required: 0, remaining: 0, pending: 0, met: true },
    eligible: true,
  };

  const eligibilityPanel = mine.eligibility ? (
    <EligibilityPanel eligibility={eligibility} participations={events} onChanged={load} />
  ) : null;

  const applyPanel = (
    <SectionCard
      title="Join our development team"
      subtitle="XCEED invites developers to join the team. If you want to work on the thing you are using, tell us about yourself — one application per person, per semester."
    >
      {mine.current ? (
        <MyApplication application={mine.current} />
      ) : (
        <ApplicationForm
          suggested={mine.suggested}
          session={mine.session}
          eligibility={eligibility}
          onSent={load}
        />
      )}
    </SectionCard>
  );

  /* Order matters. Somebody who has not applied reads the gate first — it is
     what stands between them and the form directly below it. Somebody whose
     application is already in reads that first; their progress through the gate
     is then a record, not an instruction, and belongs underneath. */
  const applySection = mine.current ? (
    <>
      {applyPanel}
      {eligibilityPanel}
    </>
  ) : (
    <>
      {eligibilityPanel}
      {applyPanel}
    </>
  );

  // Earlier semesters, once there are any. Kept out of the way — it is a record,
  // not something to act on.
  const past = mine.history.filter((row) => row._id !== mine.current?._id);
  const history = past.length ? (
    <SectionCard title="Earlier applications">
      <VStack align="stretch" spacing={2}>
        {past.map((application) => (
          <Flex
            key={application._id}
            borderWidth="1px"
            borderRadius="md"
            p={3}
            gap={2}
            justify="space-between"
            wrap="wrap"
          >
            <Text fontSize="sm">
              {application.session} · {formatDateTime(application.created_at)}
            </Text>
            <Badge colorScheme={STATUS_STYLE[application.status]?.colorScheme || 'gray'}>
              {STATUS_STYLE[application.status]?.label || application.status}
            </Badge>
          </Flex>
        ))}
      </VStack>
    </SectionCard>
  ) : null;

  if (!queue) {
    return (
      <VStack align="stretch" spacing={4}>
        {applySection}
        {history}
      </VStack>
    );
  }

  return (
    <Tabs colorScheme="teal" isLazy>
      <TabList overflowX="auto" overflowY="hidden">
        <Tab flexShrink={0}>Apply</Tab>
        <Tab flexShrink={0}>
          Applications
          {queue.counts?.pending ? (
            <Badge ml={2} colorScheme="blue" borderRadius="full">
              {queue.counts.pending}
            </Badge>
          ) : null}
        </Tab>
      </TabList>
      <TabPanels>
        <TabPanel px={0}>
          <VStack align="stretch" spacing={4}>
            {applySection}
            {history}
          </VStack>
        </TabPanel>
        <TabPanel px={0}>
          <SectionCard
            title="Development team applications"
            subtitle="A read-only view. Accept or reject from the Super Admin queue, which is where the notification emails point."
          >
            <AdminQueue applications={queue.applications} counts={queue.counts || {}} />
          </SectionCard>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
