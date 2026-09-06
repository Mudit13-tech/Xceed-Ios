import React from 'react';
import { Box, Flex, HStack, Heading, Text } from '@chakra-ui/react';
import { LmIcon } from './Icon';

/**
 * The chrome a student screen is allowed: which platform this is, whose paper
 * or room it is, and what it is called.
 *
 * Lifted out of QuizStage so the Shorts screens can carry the same bar. Those
 * two sit outside LearningLayout — a deck can admit someone with no account at
 * all, so a scanned QR used to land on a page with no branding of any kind —
 * and "am I in the right place" is the first thing that page has to answer.
 *
 * @param {string} [label]   the small line under the wordmark, naming the mode
 * @param {node}   [action]  right-hand control (the quiz stage puts its
 *                           fullscreen button here); omitted elsewhere
 */
export default function StageBar({ label = 'Assessment', subject, faculty, title, action = null }) {
  return (
    <Flex
      align="center"
      gap={3}
      px={{ base: 3, md: 6 }}
      py={3}
      bg="lmBg.surface"
      borderBottomWidth="1px"
      borderColor="lmBorder.base"
      wrap="wrap"
    >
      <HStack spacing={2} flexShrink={0}>
        <LmIcon name="brand" size={22} />
        <Box>
          <Heading size="sm" color="lmFg.heading" lineHeight="1.1">
            XCEED Learning
          </Heading>
          <Text fontSize="xs" color="lmFg.muted">
            {label}
          </Text>
        </Box>
      </HStack>

      {/* Identity never shrinks: it is the part of the bar a proctor and an
          invigilated student both check, so the paper's title is what gives
          way on a narrow screen, not whose subject this is. */}
      {(subject || faculty) && (
        <>
          <Box w="1px" alignSelf="stretch" bg="lmBorder.base" display={{ base: 'none', sm: 'block' }} />
          <Box flexShrink={0}>
            {subject && (
              <Text fontSize="sm" fontWeight="600" color="lmFg.heading">
                {subject}
              </Text>
            )}
            {faculty && (
              <Text fontSize="xs" color="lmFg.muted">
                <LmIcon name="user" size={12} style={{ marginRight: 4 }} />
                {faculty}
              </Text>
            )}
          </Box>
        </>
      )}

      <Box flex="1" minW={0} />

      {/* The paper's own name, kept in the bar rather than only on the page:
          mid-test it has scrolled away, and "which test am I in" is a
          question worth never having to scroll back for. */}
      {title && (
        <Text
          fontSize="sm"
          fontWeight="600"
          color="lmFg.body"
          noOfLines={1}
          minW={0}
          maxW={{ base: '100%', md: '340px' }}
        >
          {title}
        </Text>
      )}

      {action}
    </Flex>
  );
}
