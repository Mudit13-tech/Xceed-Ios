import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard } from '../components/common';

/**
 * The class's virtual lab experiments.
 *
 * The New button is a menu rather than a plain button because the first decision
 * about an experiment is which bench it is on — the domain fixes the palette, and
 * changing it later means the parts a teacher has already placed may not belong
 * on the new one. Asking up front is one click, and it is the click that saves the
 * rework.
 */
export default function Labs() {
  const { classId, isTeacher } = useOutletContext();
  const [labs, setLabs] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(async () => {
    setError(null);
    try {
      // The domain list comes from the server, so the dropdown here is whatever
      // the solver actually supports rather than a copy that can fall behind.
      const [list, cat] = await Promise.all([lmApi.listLabs(classId), lmApi.labCatalogue(classId)]);
      setLabs(list);
      setCatalogue(cat.domains || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (domain) => {
    try {
      const created = await lmApi.createLab(classId, {
        title: `Untitled ${domain.label.toLowerCase()} experiment`,
        domain: domain.key,
      });
      navigate(`/learning/class/${classId}/lab/${created._id}/edit`);
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  const togglePublish = async (lab) => {
    try {
      const result = await lmApi.publishLab(classId, lab._id, { publish: !lab.published });
      toast({ status: 'success', title: result.published ? 'Published to the class' : 'Unpublished' });
      await load();
    } catch (err) {
      toast({
        status: 'error',
        title: err.message,
        description: err.payload?.errors?.slice(0, 3).join(' · '),
        duration: 10000,
      });
    }
  };

  const remove = async (lab) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${lab.title}" and every student's bench for it?`)) return;
    try {
      await lmApi.deleteLab(classId, lab._id);
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  if (loading) return <Loading label="Loading experiments…" />;

  return (
    <Box>
      <Flex justify="space-between" align="flex-start" mb={4} gap={3} wrap="wrap">
        <Box>
          <Heading size="md">Virtual lab</Heading>
          <Text fontSize="sm" color="lmFg.muted">
            Wire up a circuit, put meters on it and run it. Voltage, current and power in AC and DC,
            with a scope for waveforms — solved properly, so the numbers are the ones the bench would
            give.
          </Text>
        </Box>
        {isTeacher && (
          <Menu>
            <MenuButton as={Button} colorScheme="teal">
              + New experiment
            </MenuButton>
            <MenuList>
              {catalogue.map((domain) => (
                <MenuItem key={domain.key} onClick={() => create(domain)}>
                  <Box>
                    <Text fontWeight="600">{domain.label}</Text>
                    <Text fontSize="xs" color="lmFg.muted" maxW="320px" whiteSpace="normal">
                      {domain.blurb}
                    </Text>
                  </Box>
                </MenuItem>
              ))}
            </MenuList>
          </Menu>
        )}
      </Flex>

      <ErrorState error={error} onRetry={load} />

      {labs.length === 0 ? (
        <EmptyState
          icon="lab"
          title="No experiments yet"
          description={
            isTeacher
              ? 'Set up a bench, choose what the class must measure, and they build the circuit themselves. Nothing can be blown up and nobody has to queue for a wattmeter.'
              : 'Your teacher has not set up any lab experiments yet.'
          }
        />
      ) : (
        labs.map((lab) => (
          <SectionCard key={lab._id} mb={3}>
            <Flex align="center" gap={4} wrap="wrap">
              <Box flex="1" minW="240px">
                <HStack>
                  <Heading size="sm">{lab.title}</Heading>
                  <Badge colorScheme="teal">{lab.domainLabel}</Badge>
                  {isTeacher && (
                    <Badge colorScheme={lab.published ? 'green' : 'gray'}>
                      {lab.published ? 'Published' : 'Draft'}
                    </Badge>
                  )}
                  {lab.topicName && <Badge colorScheme="gray">{lab.topicName}</Badge>}
                </HStack>
                <Text fontSize="xs" color="lmFg.muted" mt={1}>
                  {lab.componentCount
                    ? `${lab.componentCount} component(s) laid out`
                    : 'Students build it from scratch'}
                  {lab.readingCount ? ` · ${lab.readingCount} reading(s) to record` : ''}
                  {(lab.settings?.analyses || []).length
                    ? ` · ${lab.settings.analyses.join(', ').toUpperCase()}`
                    : ''}
                </Text>
                {isTeacher && lab.stats && (
                  <Text fontSize="xs" color="lmFg.muted">
                    {lab.stats.submissions} submission(s)
                  </Text>
                )}
                {!isTeacher && lab.myAttempt && (
                  <Badge
                    mt={1}
                    colorScheme={lab.myAttempt.status === 'submitted' ? 'green' : 'yellow'}
                  >
                    {lab.myAttempt.status === 'submitted'
                      ? lab.myAttempt.percent !== null && lab.myAttempt.percent !== undefined
                        ? `Submitted · ${lab.myAttempt.percent}%`
                        : 'Submitted'
                      : 'In progress'}
                  </Badge>
                )}
              </Box>

              <HStack>
                {isTeacher ? (
                  <>
                    <Button
                      as={RouterLink}
                      to={`/learning/class/${classId}/lab/${lab._id}`}
                      size="sm"
                      variant="outline"
                    >
                      Open bench
                    </Button>
                    <Button
                      as={RouterLink}
                      to={`/learning/class/${classId}/lab/${lab._id}/edit`}
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      as={RouterLink}
                      to={`/learning/class/${classId}/lab/${lab._id}/results`}
                      size="sm"
                      variant="outline"
                    >
                      Results
                    </Button>
                    <Button
                      size="sm"
                      colorScheme={lab.published ? 'gray' : 'green'}
                      onClick={() => togglePublish(lab)}
                    >
                      {lab.published ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button size="sm" variant="ghost" colorScheme="red" onClick={() => remove(lab)}>
                      ✕
                    </Button>
                  </>
                ) : (
                  <Button
                    as={RouterLink}
                    to={`/learning/class/${classId}/lab/${lab._id}`}
                    size="sm"
                    colorScheme="teal"
                    isDisabled={!lab.open && lab.myAttempt?.status !== 'submitted'}
                  >
                    {lab.myAttempt ? 'Open' : 'Start'}
                  </Button>
                )}
              </HStack>
            </Flex>
          </SectionCard>
        ))
      )}
    </Box>
  );
}
