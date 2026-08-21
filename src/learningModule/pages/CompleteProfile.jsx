import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  Text,
  useColorModeValue,
  VStack,
} from '@chakra-ui/react';
import { FiHash, FiUser, FiUserCheck } from 'react-icons/fi';
import lmApi from '../api/lmApi';

/**
 * The gate a student passes through once, the first time they open the module.
 *
 * A roll number is the only name a mark sheet is ever read by, and the module
 * used to hold it per class — typed by whichever teacher imported a roster, and
 * missing entirely when a student joined with a code. Asking the student
 * themselves, once, gives every class they are ever in one answer to copy.
 *
 * It is a whole page rather than a dismissable dialog on purpose: it is
 * mandatory, and a dialog with no way to close it is a worse version of a page.
 * `LearningLayout` renders this *instead of* the shell — no header, no nav, no
 * class underneath — so there is nothing to click past.
 *
 * Deliberately shaped like the platform's Forgot Password screen: one centred
 * card, one icon, one heading, the same alert placement. A student meeting this
 * on their first sign-in should recognise it as part of the same system.
 */
export default function CompleteProfile({ onDone }) {
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const iconBg = useColorModeValue('cyan.50', 'cyan.900');
  const iconColor = useColorModeValue('cyan.600', 'cyan.300');

  // Opens with whatever is already known — the account's name, and a roll
  // number a teacher may have recorded on a roster. For an imported cohort
  // that is the right answer already, and confirming beats retyping.
  useEffect(() => {
    let cancelled = false;
    lmApi
      .myIdentity()
      .then((identity) => {
        if (cancelled) return;
        setName(identity.name || '');
        setRollNumber(identity.rollNumber || '');
      })
      .catch(() => {
        // A failed prefill is not a failed form: it opens empty instead.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    setError('');
    const trimmedName = name.trim();
    const trimmedRoll = rollNumber.trim();
    if (trimmedName.length < 2) {
      setError('Enter your full name as it should appear on results.');
      return;
    }
    if (!trimmedRoll) {
      setError('Your roll number is required.');
      return;
    }
    setSaving(true);
    try {
      await lmApi.saveIdentity({ name: trimmedName, rollNumber: trimmedRoll });
      // The shell re-reads the profile; that is what takes the gate down.
      await onDone();
    } catch (err) {
      setError(err.message || 'Could not save your details. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex bg={pageBg} minH="100vh" align="center" justify="center" px={4} py={10}>
      <Box
        bg={cardBg}
        borderWidth="1px"
        borderColor={border}
        borderRadius="xl"
        boxShadow="lg"
        p={{ base: 6, md: 10 }}
        w="full"
        maxW="md"
      >
        <VStack spacing={5} align="stretch">
          <Flex align="center" justify="center" direction="column" gap={3}>
            <Flex
              align="center"
              justify="center"
              boxSize={14}
              borderRadius="full"
              bg={iconBg}
              color={iconColor}
            >
              <Icon as={FiUserCheck} boxSize={7} />
            </Flex>
            <Heading as="h1" size="lg" textAlign="center">
              Complete Your Profile
            </Heading>
            <Text color={subColor} fontSize="sm" textAlign="center">
              Before you start, confirm your name and roll number. They identify your
              work in every class, quiz and result sheet, so they are needed once
              before you can go on.
            </Text>
          </Flex>

          {error && (
            <Alert status="error" borderRadius="md" fontSize="sm">
              <AlertIcon />
              {error}
            </Alert>
          )}

          {loading ? (
            <Flex justify="center" py={6}>
              <Spinner color={iconColor} />
            </Flex>
          ) : (
            <>
              <FormControl isRequired>
                <FormLabel>Full Name</FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={FiUser} color={subColor} />
                  </InputLeftElement>
                  <Input
                    placeholder="As it should appear on results"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                  />
                </InputGroup>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Roll Number</FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={FiHash} color={subColor} />
                  </InputLeftElement>
                  <Input
                    placeholder="e.g. 21103078"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !saving && submit()}
                    maxLength={40}
                  />
                </InputGroup>
                <FormHelperText fontSize="xs">
                  Exactly as your institute issued it. Your teachers find your marks by
                  this.
                </FormHelperText>
              </FormControl>

              <Button
                colorScheme="cyan"
                isLoading={saving}
                loadingText="Saving"
                onClick={submit}
              >
                Save and Continue
              </Button>
            </>
          )}
        </VStack>
      </Box>
    </Flex>
  );
}
