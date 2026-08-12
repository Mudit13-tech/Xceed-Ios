import React, { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Text,
} from '@chakra-ui/react';
import RichText from './RichText';
import { SectionCard } from './common';
import { richTextToPlain } from '../richTextUtils';

/**
 * Per-question review after submitting.
 *
 * Option indices arrive already remapped into the order this student saw, so a
 * shuffled paper highlights the right row. Shared between the live player (just
 * after submitting), the attempt-history view, and staff reading one student's
 * paper on the results page — which is why the one second-person phrase here
 * takes `answerLabel`: "Your answer" is wrong when a teacher is reading it.
 */
export default function QuizReview({ review, title = 'Question review', answerLabel = 'Your answer' }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    if (!review) return { all: 0, correct: 0, wrong: 0, skipped: 0 };
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    review.forEach((entry) => {
      const answer = entry.yourAnswer;
      if (!answer?.attempted) skipped += 1;
      else if (answer.correct) correct += 1;
      else wrong += 1;
    });
    return { all: review.length, correct, wrong, skipped };
  }, [review]);

  const filtered = useMemo(() => {
    if (!review) return [];
    return review.filter((entry, originalIndex) => {
      const answer = entry.yourAnswer;
      const state = !answer?.attempted ? 'skipped' : answer.correct ? 'correct' : 'wrong';

      if (filter !== 'all' && state !== filter) return false;

      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const plainQ = richTextToPlain(entry.question || '').toLowerCase();
        const section = (entry.sectionName || '').toLowerCase();
        if (!plainQ.includes(query) && !section.includes(query)) return false;
      }

      return true;
    });
  }, [review, filter, search]);

  if (!review?.length) return null;

  return (
    <SectionCard title={title}>
      {/* Filter and Search Bar */}
      <Flex justify="space-between" align="center" gap={3} mb={4} wrap="wrap">
        <HStack spacing={2} wrap="wrap">
          <Button
            size="xs"
            variant={filter === 'all' ? 'solid' : 'outline'}
            colorScheme="blue"
            onClick={() => setFilter('all')}
          >
            All ({counts.all})
          </Button>
          <Button
            size="xs"
            variant={filter === 'correct' ? 'solid' : 'outline'}
            colorScheme="green"
            onClick={() => setFilter('correct')}
          >
            ✓ Correct ({counts.correct})
          </Button>
          <Button
            size="xs"
            variant={filter === 'wrong' ? 'solid' : 'outline'}
            colorScheme="red"
            onClick={() => setFilter('wrong')}
          >
            ✗ Incorrect ({counts.wrong})
          </Button>
          <Button
            size="xs"
            variant={filter === 'skipped' ? 'solid' : 'outline'}
            colorScheme="gray"
            onClick={() => setFilter('skipped')}
          >
            — Skipped ({counts.skipped})
          </Button>
        </HStack>

        <InputGroup size="xs" maxW="240px">
          <InputLeftElement pointerEvents="none" color="gray.400">
            🔍
          </InputLeftElement>
          <Input
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            borderRadius="md"
          />
        </InputGroup>
      </Flex>

      {filtered.length === 0 ? (
        <Box textAlign="center" py={6} bg="gray.50" borderRadius="md">
          <Text fontSize="sm" color="gray.500">
            No questions match your filter criteria.
          </Text>
        </Box>
      ) : (
        filtered.map((entry) => {
          const originalIndex = review.indexOf(entry);
          const answer = entry.yourAnswer;
          const state = !answer?.attempted ? 'skipped' : answer.correct ? 'correct' : 'wrong';
          const accent = state === 'correct' ? 'green.400' : state === 'wrong' ? 'red.400' : 'gray.300';
          const isNegative = (answer?.awarded ?? 0) < 0;

          return (
            <Box
              key={entry.questionId || originalIndex}
              borderWidth="1px"
              borderLeftWidth="4px"
              borderLeftColor={accent}
              borderColor="gray.200"
              borderRadius="md"
              p={4}
              mb={3}
              bg="white"
              boxShadow="2xs"
            >
              <Flex justify="space-between" gap={3} mb={2}>
                <Box flex="1" minW={0}>
                  <HStack mb={1} spacing={2} wrap="wrap">
                    <Text fontSize="sm" fontWeight="700">
                      Q{originalIndex + 1}.
                    </Text>
                    {entry.sectionName && (
                      <Badge colorScheme="purple" fontSize="0.6rem">
                        {entry.sectionName}
                      </Badge>
                    )}
                    {answer?.autoSubmitted && (
                      <Badge colorScheme="orange" fontSize="0.6rem">
                        auto-submitted
                      </Badge>
                    )}
                  </HStack>
                  <RichText>{entry.question}</RichText>
                </Box>
                <Box textAlign="right" flexShrink={0}>
                  <Badge colorScheme={state === 'correct' ? 'green' : state === 'wrong' ? 'red' : 'gray'}>
                    {state === 'correct' ? 'Correct' : state === 'wrong' ? 'Incorrect' : 'Not answered'}
                  </Badge>
                  <Text fontSize="sm" fontWeight="700" mt={1} color={isNegative ? 'red.600' : undefined}>
                    {answer?.awarded ?? 0}/{entry.marks}
                  </Text>
                  {entry.timeSpentSec > 0 && (
                    <Text fontSize="xs" color="gray.500">
                      ⏱ {entry.timeSpentSec}s
                    </Text>
                  )}
                </Box>
              </Flex>

              {entry.options?.length > 0 && (
                <Stack mt={3} spacing={1.5}>
                  {entry.options.map((option, optionIndex) => {
                    const isCorrect = (entry.correctAnswers || []).map(String).includes(String(optionIndex));
                    const chose = (answer?.selected || []).map(String).includes(String(optionIndex));
                    return (
                      <Flex
                        key={optionIndex}
                        gap={2}
                        px={3}
                        py={1.5}
                        borderRadius="md"
                        align="center"
                        bg={
                          isCorrect
                            ? 'green.50'
                            : chose
                              ? 'red.50'
                              : 'transparent'
                        }
                        borderWidth={isCorrect || chose ? '1px' : '0px'}
                        borderColor={isCorrect ? 'green.200' : chose ? 'red.200' : 'transparent'}
                      >
                        <Text fontSize="sm" fontWeight="bold" flexShrink={0} w="20px" color={isCorrect ? 'green.600' : chose ? 'red.600' : 'gray.400'}>
                          {isCorrect ? '✓' : chose ? '✗' : '•'}
                        </Text>
                        <RichText color={isCorrect ? 'green.900' : chose ? 'red.900' : 'gray.700'}>
                          {option}
                        </RichText>
                        {isCorrect && (
                          <Badge ml="auto" colorScheme="green" fontSize="0.55rem">
                            Correct Answer
                          </Badge>
                        )}
                        {!isCorrect && chose && (
                          <Badge ml="auto" colorScheme="red" fontSize="0.55rem">
                            {answerLabel}
                          </Badge>
                        )}
                      </Flex>
                    );
                  })}
                </Stack>
              )}

              {entry.type === 'numerical' && (
                <Box mt={2} p={2} bg="gray.50" borderRadius="md" fontSize="sm">
                  <Text color="gray.700">
                    {answerLabel}: <b>{answer?.text || '—'}</b>
                  </Text>
                  <Text color="green.700" mt={0.5}>
                    Expected: <b>{(entry.correctAnswers || []).join(', ')}</b>
                  </Text>
                </Box>
              )}

              {entry.explanation && (
                <Box mt={3} bg="blue.50" borderRadius="md" px={3} py={2} borderLeftWidth="3px" borderLeftColor="blue.400">
                  <Text fontSize="xs" fontWeight="700" color="blue.700" mb={0.5}>
                    Explanation
                  </Text>
                  <RichText>{entry.explanation}</RichText>
                </Box>
              )}

              {entry.sourceExcerpt && (
                <Text fontSize="xs" color="gray.500" mt= {2} fontStyle="italic">
                  From the lecture: “{entry.sourceExcerpt}”
                </Text>
              )}
            </Box>
          );
        })
      )}
    </SectionCard>
  );
}
