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
import { looksLikeEmail, EMAIL_AS_NAME_MESSAGE } from '../displayName';

/**
 * The gate an account passes through once, the first time it opens the module.
 *
 * A roll number is the only name a mark sheet is ever read by, and the module
 * used to hold it per class — typed by whichever teacher imported a roster, and
 * missing entirely when a student joined with a code. Asking the student
 * themselves, once, gives every class they are ever in one answer to copy.
 *
 * The name is asked for on the same terms, and of staff as well: every account
 * on the platform is created with its email address sitting in the name field,
 * and a class owned by `someone@nitj.ac.in` reads that way to every student in
 * it. This replaced an always-open "Edit your name" item in the account menu —
 * a name that rosters, gradebooks and result sheets are read by should not be
 * re-typed at will, so it is given once here and afterwards only an
 * administrator changes it. `saveMyIdentity` refuses a second, different one.
 * The account menu's one-time correction (`EditIdentityModal`) is the single
 * exception: one edit, on a separate endpoint, and then gone.
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
  // Both come from the server: staff have no roll number to give, and a name
  // already on the account is shown but not retaken.
  const [needsRoll, setNeedsRoll] = useState(false);
  const [nameLocked, setNameLocked] = useState(false);
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
  //
  // The name arrives blank when what is stored on the account is its email
  // address: that is the value every account is created with, and prefilling it
  // is how whole cohorts ended up with `21103078@nitj.ac.in` printed in the name
  // column of every result sheet. The server drops it (see lmAuth.profileName)
  // so this form asks rather than offering the placeholder back.
  useEffect(() => {
    let cancelled = false;
    lmApi
      .myIdentity()
      .then((identity) => {
        if (cancelled) return;
        setName(identity.name || '');
        setRollNumber(identity.rollNumber || '');
        setNeedsRoll(Boolean(identity.required));
        setNameLocked(Boolean(identity.nameLocked ?? identity.name));
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
    // Typing the address in anyway — or pasting it back — is the same wrong
    // answer the prefill used to hand out. The server refuses it too.
    if (looksLikeEmail(trimmedName)) {
      setError(EMAIL_AS_NAME_MESSAGE);
      return;
    }
    if (needsRoll && !trimmedRoll) {
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
              {needsRoll
                ? 'Before you start, give your name and roll number. They identify your work in every class, quiz and result sheet, so they are needed once before you can go on.'
                : 'Before you start, give your name. It is what your students and colleagues see on every class you teach, so it is needed once before you can go on.'}
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
                  {/* Read-only rather than absent when it is already settled: a
                      student who came back only for a roll number should still
                      see the name their marks will be filed under. */}
                  <Input
                    placeholder="As it should appear on results"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !saving && !needsRoll && submit()}
                    maxLength={80}
                    isReadOnly={nameLocked}
                    isDisabled={nameLocked}
                  />
                </InputGroup>
                <FormHelperText fontSize="xs">
                  {nameLocked
                    ? 'Already set. Ask your administrator if it needs correcting.'
                    : needsRoll
                      ? 'Your name, not your email address — this is what your teachers see on rosters and result sheets. You can set it once, so check the spelling.'
                      : 'Your name, not your email address — this is what your students see on every class you teach. You can set it once, so check the spelling.'}
                </FormHelperText>
              </FormControl>

              {needsRoll && (
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
              )}

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
