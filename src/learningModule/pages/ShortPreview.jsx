import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  IconButton,
  Progress,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight, FiMaximize, FiMinimize } from 'react-icons/fi';

import lmApi from '../api/lmApi';
import { ErrorState, Loading } from '../components/common';
import RichText from '../components/RichText';
import ShortResults from '../components/ShortResults';

/**
 * Preview mode for a Short — identical to the presenter view but runs entirely
 * in local state. No session is created, no notification is sent, nothing is
 * tracked. Teachers can rehearse their deck without disturbing the class.
 */

const STATE_LABEL = {
  waiting: 'Not open yet',
  open: 'Answering',
  locked: 'Closed',
  revealed: 'Answer shown',
};

function Countdown({ seconds, big }) {
  if (!seconds) return null;
  return (
    <Text
      fontSize={big ? '5xl' : '2xl'}
      fontWeight="800"
      color={seconds <= 5 ? 'red.400' : undefined}
      lineHeight="1"
      fontVariantNumeric="tabular-nums"
    >
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </Text>
  );
}

export default function ShortPreview() {
  const { classId } = useOutletContext();
  const { shortId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [short, setShort] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Local presenter state — mirrors what the real session would hold
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideState, setSlideState] = useState('waiting');
  const [fullscreen, setFullscreen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);
  const stageRef = useRef(null);

  const stageBg = useColorModeValue('white', 'gray.900');
  const panelBg = useColorModeValue('purple.50', 'whiteAlpha.100');

  useEffect(() => {
    lmApi.getShort(classId, shortId)
      .then((data) => setShort(data))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [classId, shortId]);

  // Countdown timer — only runs in preview open state
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (slideState !== 'open' || !countdown) return undefined;
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setSlideState('locked');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [slideState]);

  const slide = short?.slides?.[slideIndex] || null;

  const goTo = (index) => {
    if (!short || index < 0 || index >= short.slides.length) return;
    setSlideIndex(index);
    setSlideState('waiting');
    setCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const control = (action) => {
    if (action === 'open') {
      setSlideState('open');
      setCountdown(slide?.timeLimitSec || 0);
    } else if (action === 'lock') {
      setSlideState(short?.settings?.autoRevealOnClose ? 'revealed' : 'locked');
      setCountdown(0);
    } else if (action === 'reveal') {
      setSlideState('revealed');
      setCountdown(0);
    } else if (action === 'reopen') {
      setSlideState('open');
      setCountdown(slide?.timeLimitSec || 0);
    } else if (action === 'next') {
      goTo(slideIndex + 1);
    } else if (action === 'previous') {
      goTo(slideIndex - 1);
    }
  };

  const toggleFullscreen = () => {
    const node = stageRef.current;
    if (!node) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else node.requestFullscreen?.();
  };

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Keyboard driving — same as real presenter
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.matches?.('input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight') control('next');
      else if (event.key === 'ArrowLeft') control('previous');
      else if (event.key === ' ') {
        event.preventDefault();
        if (slideState === 'waiting') control('open');
        else if (slideState === 'open') control('lock');
        else if (slideState === 'locked') control('reveal');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideState, slideIndex]);

  if (loading) return <Loading label="Loading preview…" />;
  if (error) return <ErrorState error={error} onRetry={() => navigate(0)} />;
  if (!short) return null;

  // Build mock results for revealed state so the answer key is visible
  const mockResults = slideState === 'revealed' && slide ? {
    type: slide.type,
    totalResponses: 0,
    options: (slide.options || []).map((option, index) => ({
      label: option,
      count: 0,
      percent: 0,
      correct: (slide.correctAnswers || []).includes(String(index)),
    })),
    correctAnswers: slide.correctAnswers || [],
    explanation: slide.explanation || '',
  } : slideState !== 'waiting' && slide ? {
    type: slide.type,
    totalResponses: 0,
    options: (slide.options || []).map((option) => ({ label: option, count: 0, percent: 0 })),
  } : null;

  return (
    <Box ref={stageRef} bg={stageBg} borderRadius="lg" p={{ base: 3, md: 6 }}>
      <VStack align="stretch" spacing={5}>

        {/* Header */}
        <Flex gap={4} wrap="wrap" align="flex-start">
          <Box flex="1" minW="240px">
            <HStack spacing={2} mb={1} wrap="wrap">
              <Heading size="md">{short.title}</Heading>
              <Badge colorScheme="yellow" variant="solid">
                preview
              </Badge>
              <Badge colorScheme="gray">no students notified</Badge>
            </HStack>
            <Text fontSize="sm" opacity={0.7}>
              Slide {slideIndex + 1} of {short.slides.length} · {STATE_LABEL[slideState]}
            </Text>
          </Box>

          {/* Mock join panel */}
          <Box bg={panelBg} borderRadius="lg" p={3}>
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" opacity={0.7}>
              Preview mode — no live code
            </Text>
            <Text fontSize="sm" opacity={0.6} mt={1}>
              This is a local preview. No session is created,
              no notifications are sent, and no answers are tracked.
            </Text>
          </Box>

          <Tooltip label={fullscreen ? 'Leave full screen' : 'Full screen'}>
            <IconButton
              aria-label="Toggle full screen"
              icon={fullscreen ? <FiMinimize /> : <FiMaximize />}
              onClick={toggleFullscreen}
              variant="outline"
            />
          </Tooltip>
        </Flex>

        {/* Slide content */}
        {slide ? (
          <>
            <Flex gap={4} align="flex-start" wrap="wrap">
              <Box
                flex="1"
                minW="260px"
                fontSize={fullscreen ? { base: '3xl', md: '5xl' } : { base: 'xl', md: '3xl' }}
                fontWeight="700"
              >
                <RichText>{slide.question}</RichText>
              </Box>
              {slideState === 'open' && countdown > 0 && (
                <Countdown seconds={countdown} big />
              )}
            </Flex>

            <Progress
              value={0}
              colorScheme="purple"
              size="sm"
              borderRadius="full"
            />

            {slideState === 'waiting' ? (
              <Box textAlign="center" py={10} opacity={0.6}>
                <Text fontSize="2xl">Ready when you are.</Text>
                <Text fontSize="sm">Open the slide to see the question in action.</Text>
              </Box>
            ) : (
              <ShortResults results={mockResults} size="lg" />
            )}
          </>
        ) : (
          <Text opacity={0.6}>This short has no slides.</Text>
        )}

        {/* Controls — identical layout to real presenter */}
        <Flex
          gap={2}
          wrap="wrap"
          align="center"
          position="sticky"
          bottom={0}
          bg={stageBg}
          pt={3}
          borderTopWidth="1px"
        >
          <IconButton
            aria-label="Previous slide"
            icon={<FiChevronLeft />}
            onClick={() => control('previous')}
            isDisabled={slideIndex === 0}
          />
          <IconButton
            aria-label="Next slide"
            icon={<FiChevronRight />}
            onClick={() => control('next')}
            isDisabled={slideIndex >= short.slides.length - 1}
          />

          {slideState === 'waiting' && (
            <Button colorScheme="green" onClick={() => control('open')}>
              Open for answers
            </Button>
          )}
          {slideState === 'open' && (
            <Button colorScheme="orange" onClick={() => control('lock')}>
              Close answering
            </Button>
          )}
          {slideState === 'locked' && (
            <>
              {slide?.correctAnswers?.length > 0 && (
                <Button colorScheme="blue" onClick={() => control('reveal')}>
                  Reveal the answer
                </Button>
              )}
              <Button variant="outline" onClick={() => control('reopen')}>
                Reopen
              </Button>
            </>
          )}
          {slideState === 'revealed' && (
            <Button variant="outline" onClick={() => control('reopen')}>
              Reopen
            </Button>
          )}

          <Box flex="1" />
          <Text fontSize="xs" opacity={0.5} display={{ base: 'none', md: 'block' }}>
            ← → to move · space to open / close / reveal
          </Text>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/learning/class/${classId}/short/${shortId}/edit`)}
          >
            Back to editor
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
}