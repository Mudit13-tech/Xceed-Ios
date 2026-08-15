import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
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
  useToast,
} from '@chakra-ui/react';

import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard } from '../components/common';
import { formatDateTime, relativeTime } from '../format';

/**
 * "Join our development team" — students asking to help build XCEED itself.
 *
 * One application per person per semester, which the server enforces and this
 * page shows *before* anything is typed: somebody who has already applied sees
 * their standing application and its verdict where the form would be, rather
 * than filling it in a second time to be told no at the end.
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
function RatingRow({ label, hint, value, onChange }) {
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

function ApplicationForm({ suggested, session, onSent }) {
  const [form, setForm] = useState({ ...EMPTY, department: suggested?.department || '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const fromEvent = (key) => (event) => set(key)(event.target.value);
  const setSkill = (key) => (score) =>
    setForm((current) => ({ ...current, skills: { ...current.skills, [key]: score } }));

  const warnings = warningsFor(form);
  const ready =
    form.rollNo.trim() &&
    form.department.trim() &&
    form.githubLink.trim() &&
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
      // A 409 means somebody applied from another tab, or the semester rule
      // caught up with them. Reloading swaps this form for the real state
      // rather than leaving a form that can never succeed.
      if (err.payload?.code === 'ALREADY_APPLIED') onSent();
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack align="stretch" spacing={5}>
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
          <Input value={form.rollNo} onChange={fromEvent('rollNo')} placeholder="e.g. 21103045" maxLength={40} />
        </FormControl>

        <FormControl isRequired>
          <FormLabel fontSize="sm">Department</FormLabel>
          <Input
            value={form.department}
            onChange={fromEvent('department')}
            placeholder="e.g. Computer Science & Engineering"
            maxLength={120}
          />
          {suggested?.department ? (
            <FormHelperText fontSize="xs">Prefilled from your account — change it if it is wrong.</FormHelperText>
          ) : null}
        </FormControl>

        <FormControl isRequired>
          <FormLabel fontSize="sm">GitHub profile</FormLabel>
          <Input
            value={form.githubLink}
            onChange={fromEvent('githubLink')}
            placeholder="https://github.com/yourname"
            type="url"
          />
          <FormHelperText fontSize="xs">The code matters more than the CV. Pin your best repo.</FormHelperText>
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm">A deployed project</FormLabel>
          <Input
            value={form.deployedLink}
            onChange={fromEvent('deployedLink')}
            placeholder="https://yourproject.vercel.app"
            type="url"
          />
          <FormHelperText fontSize="xs">
            Anything of yours that is live and clickable. Leave empty if you have none yet.
          </FormHelperText>
        </FormControl>

        <FormControl isRequired>
          <FormLabel fontSize="sm">Hours you can give, per day</FormLabel>
          <NumberInput min={0.5} max={16} step={0.5} value={form.dailyHours} onChange={set('dailyHours')}>
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
          <NumberInput min={0} max={20} value={form.ongoingProjects} onChange={set('ongoingProjects')}>
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
        <Select value={form.experienceLevel} onChange={fromEvent('experienceLevel')} maxW={{ md: '420px' }}>
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
          onClick={submit}
          isLoading={saving}
          isDisabled={!ready}
          w={{ base: '100%', sm: 'auto' }}
        >
          Send my application
        </Button>
        <Text fontSize="xs" color="gray.500">
          This is your one application for {session}. It goes straight to the admins, and you will
          hear back by email and in your notifications.
        </Text>
      </Flex>
    </VStack>
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

/** The admin queue. Only rendered when the API let this account read it. */
function AdminQueue({ applications, counts, onReviewed }) {
  const [message, setMessage] = useState({});
  const [deciding, setDeciding] = useState(null);
  const toast = useToast();
  const labelColor = useColorModeValue('gray.500', 'gray.400');
  const flagBg = useColorModeValue('orange.50', 'orange.900');

  const decide = async (application, status) => {
    const text = (message[application._id] ?? '').trim();
    if (!text) {
      toast({
        status: 'warning',
        title: 'Write a line back to them first',
        description: 'It goes out with the decision, by email and in-app.',
      });
      return;
    }
    setDeciding(`${application._id}:${status}`);
    try {
      await lmApi.reviewDevApplication(application._id, { status, adminMessage: text });
      toast({ status: 'success', title: status === 'accepted' ? 'Accepted — they have been told' : 'Rejected — they have been told' });
      setMessage((current) => {
        const next = { ...current };
        delete next[application._id];
        return next;
      });
      onReviewed();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    } finally {
      setDeciding(null);
    }
  };

  if (!applications.length) return <EmptyState icon="📭" title="No applications yet" />;

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
                ⚠️ {flags.join(' · ')}
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

            <Textarea
              size="sm"
              rows={2}
              mb={2}
              placeholder="Your message to them — required, and it goes out with the decision"
              value={message[application._id] ?? ''}
              onChange={(event) =>
                setMessage((current) => ({ ...current, [application._id]: event.target.value }))
              }
            />
            <Stack direction={{ base: 'column', sm: 'row' }} spacing={2}>
              <Button
                size="sm"
                colorScheme="green"
                isLoading={deciding === `${application._id}:accepted`}
                onClick={() => decide(application, 'accepted')}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                colorScheme="red"
                isLoading={deciding === `${application._id}:rejected`}
                onClick={() => decide(application, 'rejected')}
              >
                Reject
              </Button>
            </Stack>
          </Box>
        );
      })}
    </VStack>
  );
}

export default function DevTeam() {
  const [mine, setMine] = useState(null);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [own, admin] = await Promise.all([
        lmApi.myDevApplication(),
        // 403 for everyone who is not a platform admin, which is how this page
        // decides whether to show the queue at all.
        lmApi.allDevApplications().catch(() => null),
      ]);
      setMine(own);
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

  const applyPanel = (
    <SectionCard
      title="🚀 Join our development team"
      subtitle="XCEED is built by students. If you want to work on the thing you are using, tell us about yourself — one application per person, per semester."
    >
      {mine.current ? (
        <MyApplication application={mine.current} />
      ) : (
        <ApplicationForm suggested={mine.suggested} session={mine.session} onSent={load} />
      )}
    </SectionCard>
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
        {applyPanel}
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
            {applyPanel}
            {history}
          </VStack>
        </TabPanel>
        <TabPanel px={0}>
          <SectionCard
            title="Development team applications"
            subtitle="Accepting or rejecting emails your message straight back to them."
          >
            <AdminQueue
              applications={queue.applications}
              counts={queue.counts || {}}
              onReviewed={load}
            />
          </SectionCard>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
