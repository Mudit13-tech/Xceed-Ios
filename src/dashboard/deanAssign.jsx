import React, { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  IconButton,
  Input,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { FiTrash2, FiUserPlus } from 'react-icons/fi';
import getEnvironment from '../getenvironment';
import EditableName from './editableName';

const apiUrl = getEnvironment();

/**
 * Appointing the Dean (Academic) — a panel on the Heads of Department screen.
 *
 * It sits beside the HOD panel rather than on a page of its own because the two
 * are the same decision at two scopes: who reads a department, and who reads
 * every department. Somebody arriving to appoint one very often needs to see
 * the other, and two screens meant remembering that the second existed.
 *
 * An email address and nothing else. That absence is the point — an HOD is
 * appointed *to a department*, which is why the panel above asks for one and
 * writes a mapping row; a dean is scoped to no department, so there is nothing
 * to map them to and the appointment is simply the DEAN role on the account.
 * See server/src/services/deans.js.
 *
 * An address with no account gets one, claimed through the platform's usual OTP
 * flow — the same rule as assigning a head of department, so an incoming dean
 * need not already be in the system to be given the screen.
 *
 * More than one dean is allowed, deliberately: nothing about reading every
 * department's activity is exclusive, an institute with a dean and a deputy is
 * ordinary, and refusing the second would only push somebody towards sharing
 * the first one's password.
 *
 * Removing revokes the role and keeps the account. The person very often still
 * teaches here, and their classes, submissions and gradebooks hang off that id.
 *
 * No name is asked for either, for the reason the HOD panel above does not ask:
 * whoever fills in this form is not the person being appointed, so a name typed
 * here is a guess at somebody else's spelling. A created account is named for
 * the post — `Dean-Academic`, with no department to vary it by, which is the
 * whole of what this role is — and the name column is editable in place,
 * permanently, for whenever the real one is learned.
 */

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const DeanAssignPanel = () => {
  const [email, setEmail] = useState('');
  const [deans, setDeans] = useState([]);
  const [loadingDeans, setLoadingDeans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(null);
  const toast = useToast();

  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subColor = useColorModeValue('gray.600', 'gray.400');

  const fetchDeans = async () => {
    setLoadingDeans(true);
    try {
      const res = await fetch(`${apiUrl}/user/getuser/deans`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load deans');
      setDeans(data.deans || []);
    } catch (err) {
      toast({
        title: 'Could not load deans',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoadingDeans(false);
    }
  };

  useEffect(() => {
    fetchDeans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whether the address typed already holds the role, so the form can say so
  // before the server has to answer "already the dean" to a submitted form.
  const typed = email.trim().toLowerCase();
  const alreadyDean = Boolean(typed) && deans.some((dean) => dean.email === typed);

  const handleAssign = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/user/getuser/assign-dean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to assign');
      toast({
        title: data.created ? 'Account created and dean assigned' : 'Dean (Academic) assigned',
        description: data.roleAdded
          ? `${email.trim()} can now open the institute-wide dashboard.`
          : `${email.trim()} already held the role — nothing changed.`,
        status: data.roleAdded ? 'success' : 'info',
        duration: 5000,
        isClosable: true,
      });
      setEmail('');
      fetchDeans();
    } catch (err) {
      toast({
        title: 'Assignment failed',
        description: err.message,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Open for the life of the appointment rather than only at the moment it is
  // made — the address is known first, the name usually later. It rethrows so
  // the cell can stay open on what was typed.
  const handleRename = async (dean, name) => {
    try {
      const res = await fetch(`${apiUrl}/user/getuser/rename-dean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: dean._id, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename');
      toast({
        title: 'Name updated',
        description: `${dean.email || 'The account'} is now shown as ${name}.`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      fetchDeans();
    } catch (err) {
      toast({
        title: 'Could not rename',
        description: err.message,
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
      throw err;
    }
  };

  const handleRemove = async (dean) => {
    setRemoving(dean._id);
    try {
      const res = await fetch(`${apiUrl}/user/getuser/remove-dean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: dean._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove');
      toast({
        title: 'Dean (Academic) removed',
        description:
          'The role is gone from the account. The account itself is untouched — any classes it teaches are unaffected.',
        status: 'success',
        duration: 6000,
        isClosable: true,
      });
      fetchDeans();
    } catch (err) {
      toast({
        title: 'Could not remove',
        description: err.message,
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Box bg={cardBg} borderWidth="1px" borderColor={border} borderRadius="xl" p={6} mb={8}>
      <Box mb={4}>
        <Heading as="h2" size="md">
          Dean (Academic)
        </Heading>
        <Text color={subColor} fontSize="sm" mt={1}>
          The head of department&apos;s dashboard, read across every department. No department
          is asked for, because that is exactly what this role is not scoped to.
        </Text>
      </Box>

      <Box as="form" onSubmit={handleAssign} mb={6}>
        <Flex gap={4} direction={{ base: 'column', md: 'row' }} align={{ md: 'flex-start' }}>
          <FormControl isRequired isInvalid={alreadyDean}>
            <FormLabel>Dean email ID</FormLabel>
            <Input
              type="email"
              placeholder="dean.academic@nitj.ac.in"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <FormHelperText color={alreadyDean ? 'orange.500' : undefined}>
              {alreadyDean
                ? 'This account already holds the role.'
                : 'An address with no account gets one, named for the post (Dean-Academic) and claimed through the usual OTP flow. The name is editable below.'}
            </FormHelperText>
          </FormControl>
          <Button
            type="submit"
            colorScheme="purple"
            leftIcon={<FiUserPlus />}
            isLoading={submitting}
            isDisabled={alreadyDean}
            px={8}
            flexShrink={0}
            mt={{ base: 0, md: 8 }}
          >
            Assign dean
          </Button>
        </Flex>
      </Box>

      <Flex justify="space-between" align="center" gap={3} wrap="wrap" mb={3}>
        <Heading as="h3" size="sm">
          Current Deans
        </Heading>
        <Text fontSize="sm" color={subColor}>
          {deans.length} {deans.length === 1 ? 'account' : 'accounts'}
        </Text>
      </Flex>

      {loadingDeans ? (
        <Flex justify="center" py={8}>
          <Spinner />
        </Flex>
      ) : deans.length === 0 ? (
        <Text color={subColor}>No Dean (Academic) assigned yet.</Text>
      ) : (
        <Box overflowX="auto">
          <Table size="md" variant="simple">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Account</Th>
                <Th>Created</Th>
                <Th width="1%">Remove</Th>
              </Tr>
            </Thead>
            <Tbody>
              {deans.map((dean) => (
                <Tr key={dean._id}>
                  {/* Editable in place. The appointment asks for an address and
                      nothing else, so an account created by it carries the
                      address as its name — which is not a name, and is why the
                      cell shows nothing until somebody sets one here. */}
                  <Td>
                    <EditableName
                      value={dean.name && dean.name !== dean.email ? dean.name : ''}
                      label={dean.email || 'this dean'}
                      onSave={(name) => handleRename(dean, name)}
                    />
                  </Td>
                  <Td>{dean.email || '—'}</Td>
                  <Td>
                    {/* An account nobody has ever signed into looks exactly like
                        one in daily use unless the table says so — and an
                        unclaimed one is what an administrator has to chase after
                        making the appointment. */}
                    <Badge
                      colorScheme={dean.claimed ? 'green' : 'orange'}
                      borderRadius="full"
                      px={3}
                      py={1}
                    >
                      {dean.claimed ? 'Claimed' : 'Not signed in yet'}
                    </Badge>
                  </Td>
                  <Td>{formatDate(dean.createdAt)}</Td>
                  <Td>
                    <IconButton
                      aria-label={`Remove ${dean.email || dean.name} as Dean (Academic)`}
                      icon={<FiTrash2 />}
                      size="sm"
                      colorScheme="red"
                      variant="ghost"
                      isLoading={removing === dean._id}
                      onClick={() => handleRemove(dean)}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
};

export default DeanAssignPanel;
