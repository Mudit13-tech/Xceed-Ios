import React, { useEffect, useState } from 'react';
import { Box, Flex, Heading, Progress, SkeletonText, Text, VStack } from '@chakra-ui/react';

import { SectionCard } from './common';

/**
 * The per-question rollup of a form's answers.
 *
 * Shared by the teacher's Summary tab (FormResponses) and the respondent's own
 * view of the results after submitting (FormFill, FormLinkJoin), because they
 * render the same thing from the same server rollup. What differs is only what
 * the server is willing to put in it: a respondent's copy carries no drop-off
 * funnel and no completion stats — see formController.respondentSummary — so
 * those live with the teacher's page rather than here.
 *
 * Nothing drawn here identifies a respondent. Choice and scale types are bare
 * counts, and text and date answers arrive as a list with no author attached.
 */

// Local, not exported: a module that exports anything but components breaks
// fast refresh (react-refresh/only-export-components), and nothing outside
// this file needs it — questionTypes.js is where a shared list would belong.
const CHOICE_TYPES = ['multiple_choice', 'checkboxes', 'dropdown'];

export function ChoiceSummary({ entry }) {
  const total = Object.values(entry.counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <VStack align="stretch" spacing={2}>
      {Object.entries(entry.counts).map(([option, count]) => (
        <Box key={option}>
          <Flex justify="space-between" fontSize="sm" mb={1}>
            <Text noOfLines={1}>{option}</Text>
            <Text color="lmFg.muted">{count}</Text>
          </Flex>
          <Progress value={(count / total) * 100} size="sm" borderRadius="full" colorScheme="teal" />
        </Box>
      ))}
    </VStack>
  );
}

export function ScaleSummary({ entry }) {
  const total = Object.values(entry.counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <VStack align="stretch" spacing={2}>
      {entry.average !== null && (
        <Text fontSize="sm" color="lmFg.muted">
          Average: {entry.average}
        </Text>
      )}
      {Object.entries(entry.counts).map(([value, count]) => (
        <Box key={value}>
          <Flex justify="space-between" fontSize="sm" mb={1}>
            <Text>{value}</Text>
            <Text color="lmFg.muted">{count}</Text>
          </Flex>
          <Progress value={(count / total) * 100} size="sm" borderRadius="full" colorScheme="blue" />
        </Box>
      ))}
    </VStack>
  );
}

export function TextSummary({ entry }) {
  if (!entry.answers.length) {
    return (
      <Text fontSize="sm" color="lmFg.muted">
        No answers yet.
      </Text>
    );
  }
  return (
    <VStack align="stretch" spacing={1} maxH="220px" overflowY="auto">
      {entry.answers.map((answer, i) => (
        <Text key={i} fontSize="sm" borderBottomWidth="1px" borderColor="lmBorder.subtle" pb={1}>
          {entry.type === 'date' && answer ? new Date(answer).toLocaleDateString() : String(answer)}
        </Text>
      ))}
    </VStack>
  );
}

/** One card per question, in the order the server sent them. */
export default function FormSummary({ summary }) {
  if (!summary?.length) return null;
  return (
    <VStack align="stretch" spacing={4}>
      {summary.map((entry) => (
        <SectionCard key={entry.questionId} title={entry.title} subtitle={`${entry.answered} response(s)`}>
          {CHOICE_TYPES.includes(entry.type) && <ChoiceSummary entry={entry} />}
          {entry.type === 'linear_scale' && <ScaleSummary entry={entry} />}
          {entry.type === 'file_upload' && (
            <Text fontSize="sm" color="lmFg.muted">
              {entry.answered} file(s) attached.
            </Text>
          )}
          {['short_answer', 'paragraph', 'date'].includes(entry.type) && <TextSummary entry={entry} />}
        </SectionCard>
      ))}
    </VStack>
  );
}

/**
 * The results a respondent has earned by answering, fetched on mount.
 *
 * Quiet on refusal by design. The server declines this for reasons that are
 * not the respondent's problem to solve — the teacher has not shared the
 * results, or has since turned sharing off — and a red error box under
 * "Thanks!" would read as though their submission had gone wrong. Only a real
 * fault is worth a line, and even that stays a muted one.
 *
 * `load` is passed in rather than a classId/shareCode pair because the two
 * pages that show this reach the same rollup by different routes.
 */
export function RespondentResults({ load }) {
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    let alive = true;
    load()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((err) => {
        if (!alive) return;
        const code = err?.payload?.code;
        const hidden = code === 'SUMMARY_NOT_SHARED' || code === 'SUMMARY_REQUIRES_RESPONSE';
        setState({ status: hidden ? 'hidden' : 'failed', data: null });
      });
    return () => {
      alive = false;
    };
  }, [load]);

  if (state.status === 'hidden') return null;

  if (state.status === 'loading') {
    return (
      <SkeletonText noOfLines={3} spacing={3} skeletonHeight="12px" aria-label="Loading everyone&rsquo;s answers…" />
    );
  }

  if (state.status === 'failed') {
    return (
      <Text fontSize="sm" color="lmFg.muted">
        The summary could not be loaded just now. Your response was still recorded.
      </Text>
    );
  }

  const { totalResponses, summary } = state.data || {};
  if (!summary?.length) return null;

  return (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Heading size="sm">How everyone answered</Heading>
        <Text fontSize="sm" color="lmFg.muted">
          {totalResponses} response{totalResponses === 1 ? '' : 's'} so far. Nobody&rsquo;s name is shown.
        </Text>
      </Box>
      <FormSummary summary={summary} />
    </VStack>
  );
}
