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
  Text,
  Textarea,
  VStack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

import lmApi from '../learningModule/api/lmApi';

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
      </Stack>
    </Box>
  );
}

const DevTeamApplicationsAdmin = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('pending');
  const toast = useToast();

  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const statBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await lmApi.allDevApplications({ status: status || undefined }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (application, nextStatus, adminMessage) => {
    try {
      await lmApi.reviewDevApplication(application._id, { status: nextStatus, adminMessage });
      toast({
        status: 'success',
        title: nextStatus === 'accepted' ? 'Accepted — they have been emailed' : 'Rejected — they have been emailed',
        duration: 3000,
      });
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 6000 });
    }
  };

  const counts = data?.counts || {};
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const tiles = [
    { label: 'Waiting on you', value: counts.pending || 0, color: 'blue.500' },
    { label: 'Accepted', value: counts.accepted || 0, color: 'green.500' },
    { label: 'Rejected', value: counts.rejected || 0, color: 'gray.500' },
    { label: 'All time', value: total, color: 'purple.500' },
  ];

  return (
    <Box bg={pageBg} minH="100vh" py={{ base: 8, md: 12 }}>
      <Container maxW="5xl">
        <Flex justify="space-between" align="flex-start" gap={4} wrap="wrap" mb={6}>
          <Box>
            <Heading as="h1" size="lg" mb={1}>
              Development Team Applications
            </Heading>
            <Text color={subColor}>
              Students asking to help build XCEED. One application each per semester — accepting or
              rejecting emails your message straight back to them.
            </Text>
          </Box>
          <Button as={RouterLink} to="/superadmin" variant="outline" size="sm">
            Back to Super Admin
          </Button>
        </Flex>

        {error ? (
          <Alert status={error.status === 403 ? 'warning' : 'error'} borderRadius="md">
            <AlertIcon />
            {error.status === 403
              ? 'This queue is for platform administrators only.'
              : error.message || 'Could not load the queue.'}
          </Alert>
        ) : (
          <>
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

            <HStack spacing={3} mb={5} wrap="wrap">
              <Select
                maxW="220px"
                bg={statBg}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
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
                  // Keyed on the review stamp as well as the id so the message
                  // box re-initialises from the server after a decision, rather
                  // than holding text typed against the old verdict.
                  <ApplicationCard
                    key={`${application._id}-${application.reviewedAt || ''}`}
                    application={application}
                    onDecide={decide}
                  />
                ))}
              </VStack>
            ) : (
              <Box
                bg={statBg}
                borderWidth="1px"
                borderColor={border}
                borderRadius="lg"
                p={10}
                textAlign="center"
              >
                <Text fontSize="3xl" mb={2}>
                  📭
                </Text>
                <Text color={subColor}>Nothing here.</Text>
              </Box>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};

export default DevTeamApplicationsAdmin;
