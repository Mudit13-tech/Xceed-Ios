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
import { EmptyState, ErrorState, Loading, SectionCard, StatTile } from '../components/common';
import { formatDateTime } from '../format';

const CHOICE_TYPES = ['multiple_choice', 'checkboxes', 'dropdown'];

function ChoiceSummary({ entry }) {
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

function ScaleSummary({ entry }) {
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

function TextSummary({ entry }) {
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
          {String(answer)}
        </Text>
      ))}
    </VStack>
  );
}

function SummaryTab({ summary }) {
  if (!summary) return null;
  return (
    <VStack align="stretch" spacing={4}>
      {summary.summary.map((entry) => (
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

const answerText = (question, answer) => {
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
    return <EmptyState icon="📭" title="No responses yet" description="Share the form to start collecting responses." />;
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
                {form.questions.map((question) => (
                  <Box key={question._id}>
                    <Text fontSize="xs" color="lmFg.muted">
                      {question.title}
                    </Text>
                    <Text fontSize="sm">{answerText(question, byQuestion.get(String(question._id)))}</Text>
                  </Box>
                ))}
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

  if (loading) return <Loading label="Loading responses…" />;
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
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4}>
        <StatTile label="Responses" value={summary?.totalResponses ?? responses.length} accent="teal.500" />
        <StatTile label="Questions" value={form.questions.length} accent="blue.500" />
        <StatTile
          label="Access"
          value={form.settings?.accessMode === 'anyone' ? 'Anyone with link' : 'Class only'}
          accent="purple.500"
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
