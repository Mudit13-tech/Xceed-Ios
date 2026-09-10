import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  Heading,
  SimpleGrid,
  Spinner,
  Switch,
  Text,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { FiSave } from 'react-icons/fi';
import getEnvironment from '../getenvironment';

const apiUrl = getEnvironment();

/**
 * What each leadership dashboard shows — a panel on the Heads of Department
 * screen, beside the two appointments it configures.
 *
 * The HOD and Dean dashboards are one component serving two audiences, so the
 * panels they carry are the one thing that genuinely differs between them
 * beyond scope — and which panels belong on each is an institute's decision
 * rather than a developer's. One head of department wants six months of trend
 * in front of them; another finds it noise beside the semester table.
 *
 * Two columns, one per dashboard, so the difference between them is the thing
 * on screen rather than something an administrator has to hold in their head
 * while clicking between two forms. Each column saves on its own: changing what
 * heads of department see should not require having an opinion about the dean.
 *
 * The rows are generated from the server's own catalogue rather than a list
 * kept here. That is what stops the two drifting — a panel added to the
 * dashboard appears in this form without the client being redeployed, and this
 * form cannot offer a panel that does not exist.
 *
 * Everything here is a *display* preference. Both dashboards are already gated
 * by `requireHod` / `requireDean` and scoped by department in the handler;
 * turning a panel off tidies a screen and protects nothing.
 */

const AUDIENCES = [
  {
    key: 'hod',
    title: 'HOD Dashboard',
    blurb: 'What a head of department sees, scoped to the department they head.',
  },
  {
    key: 'dean',
    title: 'Dean Dashboard',
    blurb: 'What the Dean (Academic) sees, across every department.',
  },
];

const DashboardSectionsPanel = () => {
  const [catalogue, setCatalogue] = useState([]);
  const [values, setValues] = useState({ hod: {}, dean: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  // Which columns have been edited since they were last read or saved, so the
  // Save button says something true rather than being permanently available.
  const [dirty, setDirty] = useState({});
  const toast = useToast();

  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const rowBorder = useColorModeValue('gray.100', 'gray.700');

  const fetchSections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/user/getuser/dashboard-sections`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load dashboard settings');
      setCatalogue(data.catalogue || []);
      setValues(data.values || { hod: {}, dean: {} });
      setDirty({});
    } catch (err) {
      toast({
        title: 'Could not load dashboard settings',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (audience, key) => {
    setValues((current) => ({
      ...current,
      // Absent means on, everywhere else in this feature — so the first click
      // on a panel nobody has an opinion about turns it off, not on.
      [audience]: { ...current[audience], [key]: current[audience]?.[key] === false },
    }));
    setDirty((current) => ({ ...current, [audience]: true }));
  };

  const save = async (audience) => {
    setSaving(audience);
    try {
      const res = await fetch(`${apiUrl}/user/getuser/dashboard-sections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ audience, sections: values[audience] || {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      // Taken from the response rather than left as typed: the server drops
      // panels it does not know about, and the form should show what was
      // actually stored rather than what was sent.
      setValues((current) => ({ ...current, [audience]: data.sections || current[audience] }));
      setDirty((current) => ({ ...current, [audience]: false }));
      toast({
        title: `${audience === 'dean' ? 'Dean' : 'HOD'} dashboard updated`,
        description: 'Anyone with that dashboard sees the change on their next visit.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err.message,
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Box bg={cardBg} borderWidth="1px" borderColor={border} borderRadius="xl" p={6}>
      <Box mb={4}>
        <Heading as="h2" size="md">
          What each dashboard shows
        </Heading>
        <Text color={subColor} fontSize="sm" mt={1}>
          The two dashboards are the same screen at two scopes, so the panels on each are
          the one thing worth deciding separately. Everything is on until you turn it off.
        </Text>
      </Box>

      <Alert status="info" borderRadius="md" mb={5} fontSize="sm">
        <AlertIcon />
        These control what appears on a screen, not who may open it — both dashboards are
        already restricted to the role they are named after, and to its departments.
      </Alert>

      {loading ? (
        <Flex justify="center" py={8}>
          <Spinner />
        </Flex>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
            {AUDIENCES.map((audience) => (
              <Box
                key={audience.key}
                borderWidth="1px"
                borderColor={border}
                borderRadius="lg"
                p={4}
              >
                <Flex justify="space-between" align="flex-start" gap={3} mb={3} wrap="wrap">
                  <Box>
                    <Heading as="h3" size="sm">
                      {audience.title}
                    </Heading>
                    <Text fontSize="xs" color={subColor}>
                      {audience.blurb}
                    </Text>
                  </Box>
                  <Button
                    size="sm"
                    colorScheme="purple"
                    leftIcon={<FiSave />}
                    onClick={() => save(audience.key)}
                    isLoading={saving === audience.key}
                    isDisabled={!dirty[audience.key]}
                  >
                    Save
                  </Button>
                </Flex>

                {catalogue.map((section) => {
                  const on = values[audience.key]?.[section.key] !== false;
                  return (
                    <Flex
                      key={section.key}
                      align="flex-start"
                      justify="space-between"
                      gap={3}
                      py={3}
                      borderTopWidth="1px"
                      borderColor={rowBorder}
                    >
                      <Box>
                        <Text fontSize="sm" fontWeight="600">
                          {section.label}
                        </Text>
                        <Text fontSize="xs" color={subColor}>
                          {section.description}
                        </Text>
                      </Box>
                      <Switch
                        colorScheme="purple"
                        isChecked={on}
                        onChange={() => toggle(audience.key, section.key)}
                        aria-label={`${section.label} on the ${audience.title}`}
                        flexShrink={0}
                        mt={1}
                      />
                    </Flex>
                  );
                })}
              </Box>
            ))}
          </SimpleGrid>
        </>
      )}
    </Box>
  );
};

export default DashboardSectionsPanel;
