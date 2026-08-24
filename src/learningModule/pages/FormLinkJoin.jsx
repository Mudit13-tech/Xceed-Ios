import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Input,
  Text,
  VStack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';

import lmApi from '../api/lmApi';
import StageBar from '../components/StageBar';
import { loginPathFor } from '../../authRedirect';
import { DeadlineCountdown, Loading } from '../components/common';
import { formatDateTime } from '../format';
import FormRenderer from '../components/FormRenderer';

/**
 * The public entry point for a form shared as "anyone with the link".
 *
 * Not class-scoped, and not behind LearningLayout: whoever opens this link may
 * have no account at all, and the layout's bootstrap would otherwise bounce
 * them to a login page with nothing left to sign in for. Mirrors ShortJoin's
 * shape — try the plain join first, let the response tell this page what else
 * to ask for.
 */
export default function FormLinkJoin() {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [phase, setPhase] = useState('joining'); // joining | needsName | form | thanks
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState(null);
  const [existingResponse, setExistingResponse] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const openForm = useCallback(async () => {
    const state = await lmApi.getFormByLink(shareCode);
    setForm(state.form);
    setExistingResponse(state.existingResponse);
    setPhase('form');
  }, [shareCode]);

  const join = useCallback(
    async (displayName) => {
      setBusy(true);
      setError('');
      try {
        const result = await lmApi.joinFormByLink(shareCode, { name: displayName });
        if (result.guestToken) lmApi.formGuest.save(result.formId, result.guestToken);
        await openForm();
      } catch (err) {
        const reason = err.payload?.code;
        if (reason === 'LOGIN_REQUIRED') {
          navigate(loginPathFor({ ...location, pathname: `/learning/form/link/${shareCode}` }), { replace: true });
          return;
        }
        if (reason === 'NAME_REQUIRED') {
          setPhase('needsName');
          setError('');
        } else {
          setError(err.message);
          setPhase('joining');
        }
      } finally {
        setBusy(false);
      }
    },
    [location, navigate, openForm, shareCode],
  );

  useEffect(() => {
    join();
    // Only on mount — re-joining on every keystroke of `name` would refetch
    // and reset whatever the respondent has already typed into the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (answers) => {
    setSubmitting(true);
    try {
      await lmApi.submitFormResponseByLink(shareCode, answers);
      setPhase('thanks');
      toast({ status: 'success', title: 'Response recorded' });
    } catch (err) {
      toast({ status: 'error', title: err.message, description: err.payload?.errors?.[0], duration: 8000 });
    } finally {
      setSubmitting(false);
    }
  };

  const cardBg = useColorModeValue('white', 'gray.800');
  const pageBg = useColorModeValue(
    'linear(to-br, purple.50, pink.50 45%, blue.50)',
    'linear(to-br, purple.900, gray.900 55%, blue.900)',
  );
  const cardShadow = useColorModeValue('xl', 'dark-lg');

  if (phase === 'form') {
    return (
      <Box minH="100vh" bg="lmBg.canvas">
        <StageBar label="Form" title={form.title} />
        <VStack align="stretch" spacing={4} maxW="640px" mx="auto" p={{ base: 4, md: 8 }}>
          <Box>
            <HStack>
              <Heading size="md">{form.title}</Heading>
              {!form.closed && form.dueDate && <DeadlineCountdown dueDate={form.dueDate} prefix="Closes in" />}
            </HStack>
            {form.description && (
              <Text fontSize="sm" color="lmFg.muted" mt={1}>
                {form.description}
              </Text>
            )}
            {!form.closed && existingResponse && (
              <Badge colorScheme="green" mt={2}>
                You can update your response below
              </Badge>
            )}
          </Box>
          {form.closed ? (
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              This form closed on {formatDateTime(form.dueDate)} and is no longer accepting responses.
            </Alert>
          ) : (
            <FormRenderer
              form={form}
              existingResponse={existingResponse}
              onSubmit={submit}
              submitting={submitting}
              canUploadFiles={false}
            />
          )}
        </VStack>
      </Box>
    );
  }

  if (phase === 'thanks') {
    return (
      <Box minH="100vh" bg="lmBg.canvas">
        <StageBar label="Form" title={form?.title} />
        <VStack align="stretch" spacing={4} maxW="640px" mx="auto" p={{ base: 4, md: 8 }}>
          <Heading size="md">Thanks!</Heading>
          <Text>Your response has been recorded.</Text>
          {form?.settings?.oneResponsePerPerson && (
            <Button
              size="sm"
              alignSelf="flex-start"
              variant="outline"
              onClick={async () => {
                setPhase('joining');
                await openForm();
              }}
            >
              Edit my response
            </Button>
          )}
        </VStack>
      </Box>
    );
  }

  // joining / needsName — the entry card, the same shape ShortJoin uses.
  return (
    <Box minH="100vh" bgGradient={pageBg}>
      <StageBar label="Form" />
      <Box
        maxW="420px"
        mx="auto"
        mt={{ base: 6, md: 16 }}
        bg={cardBg}
        borderRadius="xl"
        borderWidth="1px"
        boxShadow={cardShadow}
        overflow="hidden"
        p={0}
      >
        <Box h="6px" bgGradient="linear(to-r, purple.500, pink.500, orange.400)" />
        <VStack align="stretch" spacing={5} p={8}>
          <Box textAlign="center">
            <Text fontSize="3xl">📝</Text>
            <Heading size="lg" bgGradient="linear(to-r, purple.500, pink.500)" bgClip="text">
              {phase === 'needsName' ? 'One more thing' : 'Opening the form…'}
            </Heading>
            <Text fontSize="sm" opacity={0.7} mt={1}>
              {phase === 'needsName' ? 'What should we call you?' : 'Just a moment.'}
            </Text>
          </Box>

          {error ? (
            <>
              <Alert status="error" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
              <Button variant="outline" onClick={() => join()}>
                Try again
              </Button>
            </>
          ) : null}

          {phase === 'needsName' && (
            <>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 60))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') join(name.trim());
                }}
                placeholder="Your name"
                size="lg"
                textAlign="center"
                autoComplete="name"
                autoFocus
              />
              <Button
                colorScheme="purple"
                size="lg"
                onClick={() => join(name.trim())}
                isLoading={busy}
                isDisabled={!name.trim()}
                bgGradient="linear(to-r, purple.500, pink.500)"
                color="lmFg.onAccent"
                _hover={{ bgGradient: 'linear(to-r, purple.600, pink.600)' }}
              >
                Continue
              </Button>
            </>
          )}

          {phase === 'joining' && !error ? <Loading label="" minH="40px" /> : null}

          <Button variant="ghost" size="sm" colorScheme="purple" onClick={() => navigate('/learning')}>
            Back to my classes
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
