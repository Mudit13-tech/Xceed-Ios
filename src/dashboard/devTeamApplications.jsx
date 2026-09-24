import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Container,
  Flex,
  HStack,
  Heading,
  Link,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
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
import { Link as RouterLink } from 'react-router-dom';

import lmApi from '../learningModule/api/lmApi';
import { serverFileLinkProps } from '../utils/nativeCapabilities';

/**
 * Requests to join the development team, for the people who decide on them.
 *
 * The same queue exists inside the learning module, but that one sits behind
 * the module's sidebar — the wrong place for an administrator whose job today
 * is the platform, not a class. This is the same data and the same endpoints,
 * one click from the Super Admin dashboard, and it is where the notification
 * email points.
 *
 * There is no role check here: the list endpoint 403s for anyone who is not a
 * platform admin, and this page renders that refusal. Guarding in the browser
 * as well would only mean two places to keep in step.
 *
 * The second tab is not a queue and nothing waits in it. Sending an
 * application now takes ten accepted bug reports and two XCEED events with
 * proof uploaded (see the server's services/devEligibility.js), and the events
 * count the moment a student uploads the file — no one approves them first. The
 * tab exists so that the evidence is not write-only: an admin can read what has
 * been claimed and strike anything whose proof shows nothing, which takes it
 * back out of that student's total. Spot-checking, in other words, and it sits
 * on this page because it is the same evidence the applications are read
 * against.
 */

const STATUS_STYLE = {
  pending: { colorScheme: 'blue', label: 'Waiting' },
  accepted: { colorScheme: 'green', label: 'Accepted' },
  rejected: { colorScheme: 'gray', label: 'Rejected' },
};

const LEVEL_LABEL = {
  learning: 'still learning to build',
  comfortable: 'comfortable building alone',
  shipped: 'has shipped something real',
};

const SKILLS = [
  { key: 'frontend', label: 'Frontend' },
  { key: 'backend', label: 'Backend' },
  { key: 'aiModels', label: 'AI models' },
  { key: 'deployment', label: 'Deployment' },
];

const formatWhen = (value) => (value ? new Date(value).toLocaleString() : '');

/**
 * A self-rating, drawn as five pips.
 *
 * Worth reading against the links rather than on its own: a 5 in backend beside
 * an empty GitHub says something quite different from the same 5 beside a live
 * project, and a shape is faster to compare across a queue than four numbers.
 */
function SkillMeter({ label, score }) {
  const trackColor = useColorModeValue('gray.200', 'gray.600');
  const labelColor = useColorModeValue('gray.600', 'gray.400');
  const value = Number(score) || 0;

  return (
    <Flex align="center" gap={2}>
      <Text fontSize="xs" color={labelColor} minW="82px">
        {label}
      </Text>
      <HStack spacing={1} aria-label={`${label}: ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((pip) => (
          <Box
            key={pip}
            boxSize="8px"
            borderRadius="full"
            bg={pip <= value ? (value >= 4 ? 'teal.400' : 'blue.400') : trackColor}
          />
        ))}
      </HStack>
      <Text fontSize="xs" fontWeight="600">
        {value || '—'}
      </Text>
    </Flex>
  );
}

function ApplicationCard({ application, onDecide }) {
  const [message, setMessage] = useState(application.adminMessage || '');
  const [busy, setBusy] = useState(null);
  // An answered application is a record, not a job. Changing a verdict re-mails
  // the applicant, so the reply box and the two buttons have to be asked for.
  const [reopened, setReopened] = useState(false);
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const quoteBg = useColorModeValue('gray.50', 'gray.900');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const flagBg = useColorModeValue('orange.50', 'orange.900');
  const flagColor = useColorModeValue('orange.800', 'orange.100');

  const decide = async (status) => {
    if (!message.trim()) return;
    setBusy(status);
    try {
      await onDecide(application, status, message.trim());
    } finally {
      setBusy(null);
    }
  };

  const status = STATUS_STYLE[application.status] || {
    colorScheme: 'gray',
    label: application.status,
  };
  const decided = application.status !== 'pending';

  // The two things the form warned them about. Surfaced at the top rather than
  // left in the body: they are the reason most applications are turned down,
  // and an admin should see them before reading the pitch.
  const flags = [
    application.experienceLevel === 'learning' ? 'says they are still at the learning stage' : null,
    application.ongoingProjects >= 3 ? `already on ${application.ongoingProjects} other projects` : null,
  ].filter(Boolean);

  const Fact = ({ label, children }) => (
    <Box>
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color={subColor}>
        {label}
      </Text>
      <Box fontSize="sm" wordBreak="break-word">
        {children}
      </Box>
    </Box>
  );

  return (
    <Box bg={cardBg} borderWidth="1px" borderColor={border} borderRadius="lg" p={{ base: 4, md: 5 }}>
      <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap" mb={1}>
        <Heading as="h3" size="sm">
          {application.applicantName || 'Unknown'} · {application.rollNo}
        </Heading>
        <Badge colorScheme={status.colorScheme}>{status.label}</Badge>
      </Flex>

      <Text fontSize="xs" color={subColor} mb={3}>
        {application.department} · {application.session} · applied {formatWhen(application.created_at)}
      </Text>

      {flags.length ? (
        <Box bg={flagBg} color={flagColor} borderRadius="md" px={3} py={2} mb={3} fontSize="xs">
          ⚠️ {flags.join(' · ')}
        </Box>
      ) : null}

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={3} mb={3}>
        <Fact label="Email">
          <Link href={`mailto:${application.applicantEmail}`} color="blue.500">
            {application.applicantEmail || '—'}
          </Link>
        </Fact>
        <Fact label="Time per day">{application.dailyHours} h</Fact>
        <Fact label="Where they are">
          {LEVEL_LABEL[application.experienceLevel] || application.experienceLevel}
        </Fact>
        <Fact label="GitHub">
          <Link href={application.githubLink} isExternal color="blue.500">
            {application.githubLink}
          </Link>
        </Fact>
        <Fact label="Deployed project">
          {application.deployedLink ? (
            <Link href={application.deployedLink} isExternal color="blue.500">
              {application.deployedLink}
            </Link>
          ) : (
            <Text color={subColor}>none given</Text>
          )}
        </Fact>
        <Fact label="Other projects on">{application.ongoingProjects}</Fact>
      </SimpleGrid>

      {application.skills ? (
        <Box mb={3}>
          <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color={subColor} mb={2}>
            Rates themselves
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 2 }} spacingX={6} spacingY={2}>
            {SKILLS.map((skill) => (
              <SkillMeter key={skill.key} label={skill.label} score={application.skills[skill.key]} />
            ))}
          </SimpleGrid>
        </Box>
      ) : null}

      <Box
        bg={quoteBg}
        borderWidth="1px"
        borderColor={border}
        borderRadius="md"
        p={3}
        mb={3}
        fontSize="sm"
        whiteSpace="pre-wrap"
      >
        {application.whyHire}
      </Box>

      {application.reviewedByName && (
        <Text fontSize="xs" color={subColor} mb={3}>
          {status.label} by {application.reviewedByName} on {formatWhen(application.reviewedAt)}
        </Text>
      )}

      {decided && !reopened ? (
        <Button size="xs" variant="ghost" colorScheme="gray" onClick={() => setReopened(true)}>
          Change this decision
        </Button>
      ) : (
        <>
          {/* Required for both outcomes. An acceptance with no word on what happens
              next leaves somebody waiting, and a rejection with no reason is how
              people stop applying — which costs more than the reading it saves. */}
          <Textarea
            size="sm"
            rows={3}
            mb={2}
            placeholder="Your message to them — required, and it goes out by email with the decision"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <Stack direction={{ base: 'column', sm: 'row' }} spacing={2}>
            <Button
              size="sm"
              colorScheme="green"
              isLoading={busy === 'accepted'}
              isDisabled={!message.trim()}
              onClick={() => decide('accepted')}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              colorScheme="red"
              isLoading={busy === 'rejected'}
              isDisabled={!message.trim()}
              onClick={() => decide('rejected')}
            >
              Reject
            </Button>
            {decided ? (
              <Button size="sm" variant="ghost" colorScheme="gray" onClick={() => setReopened(false)}>
                Cancel
              </Button>
            ) : null}
          </Stack>
        </>
      )}
    </Box>
  );
}

const CLAIM_STATUS_STYLE = {
  counted: { colorScheme: 'green', label: 'Counted' },
  rejected: { colorScheme: 'red', label: 'Struck' },
};

const EVENT_TYPE_LABEL = {
  fe_course: 'FE course',
  hackathon: 'Hackathon',
  workshop: 'Workshop',
  seminar: 'Seminar / talk',
  competition: 'Competition',
  other: 'Other',
};

/**
 * One claim that somebody was at an XCEED event.
 *
 * The proof link is the only thing on the card that matters, so it is given a
 * button of its own rather than left as a line of text among the details. It
 * opens in a new tab — an inline preview cannot authenticate, because the
 * attachment route wants a header an `<img>` cannot send (see readAuthToken).
 *
 * There is nothing to approve. A counted claim is already counting, and the
 * only action here is to strike one whose proof shows nothing — which takes it
 * out of that student's total on their next page load, and may close the
 * application form again behind them. That is worth a moment and a sentence,
 * so the reason is required and goes to them.
 */
function EventClaimCard({ claim, onDecide }) {
  const [note, setNote] = useState(claim.adminNote || '');
  const [busy, setBusy] = useState(null);
  const [acting, setActing] = useState(false);
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const quoteBg = useColorModeValue('gray.50', 'gray.900');

  const status = CLAIM_STATUS_STYLE[claim.status] || {
    colorScheme: 'gray',
    label: claim.status,
  };
  const struck = claim.status === 'rejected';

  const decide = async (next) => {
    // Striking one has to say why; putting one back does not. See the server's
    // review handler for the reasoning.
    if (next === 'rejected' && !note.trim()) return;
    setBusy(next);
    try {
      await onDecide(claim, next, note.trim());
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box bg={cardBg} borderWidth="1px" borderColor={border} borderRadius="lg" p={{ base: 4, md: 5 }}>
      <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap" mb={1}>
        <Heading as="h3" size="sm">
          {claim.participantName || 'Unknown'} · {claim.eventName}
        </Heading>
        <Badge colorScheme={status.colorScheme}>{status.label}</Badge>
      </Flex>

      <Text fontSize="xs" color={subColor} mb={3}>
        {EVENT_TYPE_LABEL[claim.eventType] || claim.eventType}
        {claim.role ? ` · ${claim.role}` : ''}
        {claim.eventDate ? ` · held ${new Date(claim.eventDate).toLocaleDateString()}` : ''}
        {' · submitted '}
        {formatWhen(claim.created_at)}
        {claim.participantEmail ? ` · ${claim.participantEmail}` : ''}
      </Text>

      {claim.description ? (
        <Box
          bg={quoteBg}
          borderWidth="1px"
          borderColor={border}
          borderRadius="md"
          p={3}
          mb={3}
          fontSize="sm"
          whiteSpace="pre-wrap"
        >
          {claim.description}
        </Box>
      ) : null}

      <Stack direction={{ base: 'column', sm: 'row' }} spacing={2} align="center" mb={3}>
        <Button
          as={Link}
          {...serverFileLinkProps(lmApi.fileUrl(claim.proof?.url), claim.proof?.name)}
          size="sm"
          colorScheme="blue"
          variant="outline"
        >
          Open the proof ↗
        </Button>
        <Text fontSize="xs" color={subColor}>
          {claim.proof?.name || 'proof'}
          {claim.proof?.sizeBytes ? ` · ${Math.round(claim.proof.sizeBytes / 1024)} KB` : ''}
        </Text>
      </Stack>

      {claim.reviewedByName ? (
        <Text fontSize="xs" color={subColor} mb={3}>
          {status.label} by {claim.reviewedByName} on {formatWhen(claim.reviewedAt)}
          {claim.adminNote ? ` — “${claim.adminNote}”` : ''}
        </Text>
      ) : null}

{/* Nothing to do on a counted claim, so nothing is offered until it is
          asked for: a row of buttons under every card invites deciding on
          claims that needed no decision. */}
      {!acting ? (
        <Button size="xs" variant="ghost" colorScheme="gray" onClick={() => setActing(true)}>
          {struck ? 'Count this again' : 'Strike this claim'}
        </Button>
      ) : (
        <>
          <Textarea
            size="sm"
            rows={2}
            mb={2}
            placeholder="Why it does not count — required, and they are told"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <Stack direction={{ base: 'column', sm: 'row' }} spacing={2}>
            {struck ? (
              <Button
                size="sm"
                colorScheme="green"
                isLoading={busy === 'counted'}
                onClick={() => decide('counted')}
              >
                Count it again
              </Button>
            ) : (
              <Button
                size="sm"
                colorScheme="red"
                isLoading={busy === 'rejected'}
                isDisabled={!note.trim()}
                onClick={() => decide('rejected')}
              >
                Strike it — stops counting
              </Button>
            )}
            <Button size="sm" variant="ghost" colorScheme="gray" onClick={() => setActing(false)}>
              Cancel
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}

/** The count tiles above a queue. */
function StatTiles({ tiles }) {
  const statBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Flex gap={3} wrap="wrap" mb={5}>
      {tiles.map((tile) => (
        <Stat
          key={tile.label}
          bg={statBg}
          borderWidth="1px"
          borderColor={border}
          borderRadius="lg"
          px={4}
          py={3}
          minW="140px"
          flex="0 1 auto"
        >
          <StatLabel fontSize="xs" color={subColor}>
            {tile.label}
          </StatLabel>
          <StatNumber fontSize="2xl" color={tile.color}>
            {tile.value}
          </StatNumber>
        </Stat>
      ))}
    </Flex>
  );
}

function EmptyBox() {
  const statBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box bg={statBg} borderWidth="1px" borderColor={border} borderRadius="lg" p={10} textAlign="center">
      <Text fontSize="3xl" mb={2}>
        📭
      </Text>
      <Text color={subColor}>Nothing here.</Text>
    </Box>
  );
}

/** The refusal both queues render when the account is not a platform admin. */
function QueueError({ error }) {
  return (
    <Alert status={error.status === 403 ? 'warning' : 'error'} borderRadius="md">
      <AlertIcon />
      {error.status === 403
        ? 'This queue is for platform administrators only.'
        : error.message || 'Could not load the queue.'}
    </Alert>
  );
}

/** Applications to join the team. */
function ApplicationsQueue({ onCounts }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('pending');
  const toast = useToast();
  const statBg = useColorModeValue('white', 'gray.800');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await lmApi.allDevApplications({ status: status || undefined });
      setData(next);
      onCounts(next.counts || {});
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [status, onCounts]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (application, nextStatus, adminMessage) => {
    try {
      await lmApi.reviewDevApplication(application._id, { status: nextStatus, adminMessage });
      toast({
        status: 'success',
        title:
          nextStatus === 'accepted'
            ? 'Accepted — they have been emailed'
            : 'Rejected — they have been emailed',
        duration: 3000,
      });
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 6000 });
    }
  };

  if (error) return <QueueError error={error} />;

  const counts = data?.counts || {};
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <>
      <StatTiles
        tiles={[
          { label: 'Waiting on you', value: counts.pending || 0, color: 'blue.500' },
          { label: 'Accepted', value: counts.accepted || 0, color: 'green.500' },
          { label: 'Rejected', value: counts.rejected || 0, color: 'gray.500' },
          { label: 'All time', value: total, color: 'purple.500' },
        ]}
      />

      <HStack spacing={3} mb={5} wrap="wrap">
        <Select maxW="220px" bg={statBg} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Any status</option>
          <option value="pending">Waiting</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Button size="md" variant="outline" onClick={load} isLoading={loading}>
          Refresh
        </Button>
      </HStack>

      {loading ? (
        <Flex justify="center" py={16}>
          <Spinner size="lg" />
        </Flex>
      ) : data?.applications?.length ? (
        <VStack align="stretch" spacing={4}>
          {data.applications.map((application) => (
            // Keyed on the review stamp as well as the id so the message box
            // re-initialises from the server after a decision, rather than
            // holding text typed against the old verdict.
            <ApplicationCard
              key={`${application._id}-${application.reviewedAt || ''}`}
              application={application}
              onDecide={decide}
            />
          ))}
        </VStack>
      ) : (
        <EmptyBox />
      )}
    </>
  );
}

/**
 * Proof that somebody was at an XCEED event.
 *
 * Two of these are half of what opens the application form, and they count
 * without anybody here touching them. So this is a record to spot-check rather
 * than a queue to work through, and it defaults to showing everything: there is
 * no "waiting" bucket to filter down to.
 */
function EventProofQueue({ onCounts }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const toast = useToast();
  const statBg = useColorModeValue('white', 'gray.800');
  const subColor = useColorModeValue('gray.600', 'gray.400');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await lmApi.allEventParticipations({ status: status || undefined });
      setData(next);
      onCounts(next.counts || {});
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [status, onCounts]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (claim, nextStatus, adminNote) => {
    try {
      await lmApi.reviewEventParticipation(claim._id, { status: nextStatus, adminNote });
      toast({
        status: 'success',
        title:
          nextStatus === 'counted'
            ? 'Counted again — their progress is restored'
            : 'Struck — it no longer counts, and they have been told why',
        duration: 3000,
      });
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 6000 });
    }
  };

  if (error) return <QueueError error={error} />;

  const counts = data?.counts || {};
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <>
      <Text fontSize="sm" color={subColor} mb={4}>
        Students have to take part in two XCEED events before they can send an application — taking
        the FE course counts as one. Each of these counted the moment it was uploaded; nothing here
        is waiting on you. Open a proof when you want to check one, and strike it if it does not
        carry the student&rsquo;s name and the event they claimed.
      </Text>

      <StatTiles
        tiles={[
          { label: 'Counting', value: counts.counted || 0, color: 'green.500' },
          { label: 'Struck', value: counts.rejected || 0, color: 'red.500' },
          { label: 'All time', value: total, color: 'purple.500' },
        ]}
      />

      <HStack spacing={3} mb={5} wrap="wrap">
        <Select maxW="220px" bg={statBg} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Any status</option>
          <option value="counted">Counting</option>
          <option value="rejected">Struck</option>
        </Select>
        <Button size="md" variant="outline" onClick={load} isLoading={loading}>
          Refresh
        </Button>
      </HStack>

      {loading ? (
        <Flex justify="center" py={16}>
          <Spinner size="lg" />
        </Flex>
      ) : data?.participations?.length ? (
        <VStack align="stretch" spacing={4}>
          {data.participations.map((claim) => (
            <EventClaimCard
              key={`${claim._id}-${claim.reviewedAt || ''}`}
              claim={claim}
              onDecide={decide}
            />
          ))}
        </VStack>
      ) : (
        <EmptyBox />
      )}
    </>
  );
}

const DevTeamApplicationsAdmin = () => {
  // Lifted only so the Applications tab can say how many are waiting behind it.
  // An admin who has to open a tab to find out whether it needs opening will
  // stop opening it. The proofs tab carries no badge on purpose: nothing there
  // waits on anybody, and a number beside it would read as work to do.
  const [pending, setPending] = useState({ applications: 0 });

  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const subColor = useColorModeValue('gray.600', 'gray.400');

  const onApplicationCounts = useCallback(
    (counts) => setPending((current) => ({ ...current, applications: counts.pending || 0 })),
    [],
  );
  // The proofs queue reports its counts too, and this ignores them: the shape
  // is the same for both queues so neither has to know which one it is.
  const onProofCounts = useCallback(() => {}, []);

  const tabBadge = (count) =>
    count ? (
      <Badge ml={2} colorScheme="blue" borderRadius="full">
        {count}
      </Badge>
    ) : null;

  return (
    <Box bg={pageBg} minH="100vh" py={{ base: 8, md: 12 }}>
      <Container maxW="5xl">
        <Flex justify="space-between" align="flex-start" gap={4} wrap="wrap" mb={6}>
          <Box>
            <Heading as="h1" size="lg" mb={1}>
              Development Team Applications
            </Heading>
            <Text color={subColor}>
              Students asking to help build XCEED. They have to earn their way to the form first —
              ten accepted bug reports and two XCEED events with proof, which the second tab holds
              for spot-checking. One application each per semester; accepting or rejecting emails
              your message straight back to them.
            </Text>
          </Box>
          <Button as={RouterLink} to="/superadmin" variant="outline" size="sm">
            Back to Super Admin
          </Button>
        </Flex>

        {/* Not lazy: both counts have to be known before either tab is opened,
            or the badge that says which one needs attention is never drawn. */}
        <Tabs colorScheme="blue">
          <TabList overflowX="auto" overflowY="hidden" mb={5}>
            <Tab flexShrink={0}>Applications{tabBadge(pending.applications)}</Tab>
            <Tab flexShrink={0}>Event proofs</Tab>
          </TabList>
          <TabPanels>
            <TabPanel px={0}>
              <ApplicationsQueue onCounts={onApplicationCounts} />
            </TabPanel>
            <TabPanel px={0}>
              <EventProofQueue onCounts={onProofCounts} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Container>
    </Box>
  );
};

export default DevTeamApplicationsAdmin;
