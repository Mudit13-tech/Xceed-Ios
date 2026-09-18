import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Progress,
  SimpleGrid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';

import lmApi from '../api/lmApi';
import { AttachmentList } from '../components/Attachments';
import { EmptyState, ErrorState, Loading, SectionCard, StatTile, TableSkeleton } from '../components/common';
import { formatDateTime } from '../format';
import FormSummary from '../components/FormSummary';

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

function DropOffFunnel({ summary }) {
  if (!summary?.funnel?.length || !summary.totalStarts) return null;
  return (
    <SectionCard title="Where students drop off" subtitle={`${summary.totalStarts} started this form`}>
      <VStack align="stretch" spacing={3}>
        {summary.funnel.map((entry, index) => (
          <Box key={entry.questionId}>
            <Flex justify="space-between" fontSize="sm" mb={1}>
              <Text noOfLines={1}>
                {index + 1}. {entry.title}
              </Text>
              <Text color="lmFg.muted">
                {entry.reached}/{summary.totalStarts} ({Math.round((entry.reached / summary.totalStarts) * 100)}%)
              </Text>
            </Flex>
            <Progress value={(entry.reached / summary.totalStarts) * 100} size="sm" borderRadius="full" colorScheme="orange" />
          </Box>
        ))}
      </VStack>
    </SectionCard>
  );
}

export function SummaryTab({ summary }) {
  if (!summary) return null;
  return (
    <VStack align="stretch" spacing={4}>
      <DropOffFunnel summary={summary} />
      <FormSummary summary={summary.summary} />
    </VStack>
  );
}

export const answerText = (question, answer) => {
  if (!answer) return '—';
  switch (question.type) {
    case 'short_answer':
    case 'paragraph':
      return answer.text || '—';
    case 'multiple_choice':
    case 'dropdown':
    case 'checkboxes':
      return (answer.selectedOptions || []).join(', ') || '—';
    case 'linear_scale':
      return answer.number ?? '—';
    case 'date':
      return answer.dateValue ? new Date(answer.dateValue).toLocaleDateString() : '—';
    case 'file_upload':
      return (answer.attachments || []).length
        ? answer.attachments.map((f) => f.name).join(', ')
        : '—';
    default:
      return '—';
  }
};

function ResponsesTab({ classId, formId, form, responses, onDeleted }) {
  const toast = useToast();

  const remove = async (response) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete the response from ${response.respondent.name || 'this respondent'}?`)) return;
    try {
      await lmApi.deleteFormResponse(classId, formId, response._id);
      onDeleted();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  if (!responses.length) {
    return <EmptyState icon="form" title="No responses yet" description="Share the form to start collecting responses." />;
  }

  return (
    <Accordion allowToggle>
      {responses.map((response) => {
        const byQuestion = new Map((response.answers || []).map((a) => [String(a.questionId), a]));
        return (
          <AccordionItem key={response._id}>
            <AccordionButton>
              <HStack flex="1" justify="space-between" pr={2}>
                <HStack>
                  <Text fontWeight="600">{response.respondent.name || 'Anonymous'}</Text>
                  {response.respondent.isGuest && <Badge colorScheme="purple">guest</Badge>}
                  {response.respondent.rollNumber && (
                    <Text fontSize="xs" color="lmFg.muted">
                      {response.respondent.rollNumber}
                    </Text>
                  )}
                </HStack>
                <Text fontSize="xs" color="lmFg.muted">
                  {formatDateTime(response.submittedAt)}
                </Text>
              </HStack>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel>
              <VStack align="stretch" spacing={2} mb={2}>
                {form.questions.map((question) => {
                  const answer = byQuestion.get(String(question._id));
                  // An uploaded file is only useful to the teacher as something
                  // they can open — the name alone left no way to reach it.
                  const files = question.type === 'file_upload' ? answer?.attachments || [] : [];
                  return (
                    <Box key={question._id}>
                      <Text fontSize="xs" color="lmFg.muted">
                        {question.title}
                      </Text>
                      {files.length ? (
                        <AttachmentList attachments={files} compact />
                      ) : (
                        <Text fontSize="sm">{answerText(question, answer)}</Text>
                      )}
                    </Box>
                  );
                })}
              </VStack>
              <Button size="xs" colorScheme="red" variant="outline" onClick={() => remove(response)}>
                Delete this response
              </Button>
            </AccordionPanel>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export default function FormResponses() {
  const { classId } = useOutletContext();
  const { formId } = useParams();

  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [listed, summarised] = await Promise.all([
        lmApi.listFormResponses(classId, formId),
        lmApi.getFormSummary(classId, formId),
      ]);
      setForm(listed.form);
      setResponses(listed.responses);
      setSummary(summarised);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, formId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Loading responses…" skeleton={<TableSkeleton rows={6} columns={5} />} />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!form) return null;

  return (
    <VStack align="stretch" spacing={5}>
      <Flex gap={3} wrap="wrap" align="flex-start">
        <Box flex="1" minW="220px">
          <Heading size="md">{form.title}</Heading>
          <Text fontSize="sm" color="lmFg.muted">
            {responses.length} response(s)
          </Text>
        </Box>
        <HStack spacing={2} wrap="wrap">
          <Button as={RouterLink} to={`/learning/class/${classId}/form/${formId}/edit`} size="sm" variant="ghost">
            Edit form
          </Button>
          <Button as="a" href={lmApi.formResponsesCsvUrl(classId, formId)} size="sm" variant="outline">
            Download CSV
          </Button>
          <Button
            as="a"
            href={lmApi.formResponsesZipUrl(classId, formId)}
            size="sm"
            variant="outline"
            title="The CSV, plus a folder for each respondent with their answers and uploaded files"
          >
            Download all (ZIP)
          </Button>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4}>
        <StatTile label="Started" value={summary?.totalStarts ?? responses.length} accent="orange.500" />
        <StatTile label="Completed" value={summary?.totalCompletions ?? responses.length} accent="teal.500" />
        <StatTile
          label="Completion rate"
          value={summary?.completionRate !== null && summary?.completionRate !== undefined ? `${summary.completionRate}%` : '—'}
          accent="green.500"
        />
        <StatTile label="Avg. time to complete" value={formatDuration(summary?.averageCompletionSeconds)} accent="blue.500" />
        <StatTile label="Questions" value={form.questions.length} accent="purple.500" />
        <StatTile
          label="Access"
          value={form.settings?.accessMode === 'anyone' ? 'Anyone with link' : 'Class only'}
          accent="pink.500"
        />
      </SimpleGrid>

      <Tabs colorScheme="teal">
        <TabList>
          <Tab>Summary</Tab>
          <Tab>Individual responses</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <SummaryTab summary={summary} />
          </TabPanel>
          <TabPanel px={0}>
            <ResponsesTab classId={classId} formId={formId} form={form} responses={responses} onDeleted={load} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
}
