import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Image,
  Input,
  Select,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  VStack,
  useToast,
} from '@chakra-ui/react';

import lmApi from '../api/lmApi';
import { noteThread, noteThreadLabel, noteByline } from '../bugNotes';
import { EmptyState, ErrorState, Loading, SectionCard, TableSkeleton } from '../components/common';
import { formatDateTime, relativeTime } from '../format';
import { githubIssueUrl } from '../githubIssue';
import DeleteButton from '../components/DeleteButton';

/**
 * "Something is broken" — or "this would be better if".
 *
 * Open to students and staff alike, because the people who find bugs are the
 * people using the thing. Points are paid when a platform admin confirms the
 * report is real — never on submission, which would make this a button worth
 * pressing for its own sake and fill the queue faster than anyone could read it.
 */

const STATUS_STYLE = {
  open: { colorScheme: 'blue', label: 'waiting to be read' },
  acknowledged: { colorScheme: 'green', label: 'approved — points added' },
  duplicate: { colorScheme: 'purple', label: 'already known' },
  rejected: { colorScheme: 'gray', label: 'not taken up' },
  fixed: { colorScheme: 'teal', label: 'done' },
};

const KIND_STYLE = {
  bug: { colorScheme: 'red', label: 'Bug' },
  suggestion: { colorScheme: 'orange', label: 'Suggestion' },
};

// The two halves of the form that read differently depending on which one you
// are filing. Asking "is this broken, or could it be better?" once is cheaper
// than an admin reading the whole thing to work it out.
const KIND_COPY = {
  bug: {
    title: 'What went wrong, in one line?',
    description: 'What were you doing, what did you expect, and what happened instead?',
  },
  suggestion: {
    title: 'What would you like to see, in one line?',
    description: 'What are you trying to do, and how would this make it easier?',
  },
};

/* "Not about a class" as a value the dropdown can hold.

   A bug had to name a class, and plenty of them are not about one — the sign-in
   page, a mail that did not arrive, the whole module being down. With no way to
   say so, the reporter picked a class at random and the queue learned something
   false about where the trouble was. The queue has always been able to show
   this (`report.className ? ` · in ${x}` : ' · platform-wide'`) and the server
   has always accepted it; only the form refused to offer it.

   A sentinel rather than the empty string, because the empty string is the
   dropdown's own "nothing chosen yet" and the two mean different things: one is
   an answer, the other is the absence of one. Sent as null, which is what
   platform-wide already is on the wire. */
const GENERAL = '__general__';

function ReportForm({ classes, pointsPerReport, onSent }) {
  const [kind, setKind] = useState('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState('');
  // Left blank on purpose: the current URL is often not where the trouble
  // actually is (they may have navigated away, or it was a step/modal the URL
  // alone does not show), so the reporter names the module or pastes the link.
  const [pageUrl, setPageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotError, setScreenshotError] = useState('');
  const toast = useToast();
    const handleScreenshot = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setScreenshotError('');
    try {
      const dataUrl = await lmApi.uploadBugScreenshot(file);
      setScreenshot(dataUrl);
    } catch (err) {
      setScreenshotError(err.message);
    }
    event.target.value = '';
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await lmApi.reportBug({
        kind,
        title: title.trim(),
        description: description.trim(),
        classId: classId && classId !== GENERAL ? classId : null,
        pageUrl: pageUrl.trim(),
        screenshotUrl: screenshot || '',
      });
      toast({ status: 'success', title: 'Sent — thank you', duration: 4000 });
      setTitle('');
      setDescription('');
      setClassId('');
      setPageUrl('');
      setScreenshot(null);
      setScreenshotError('');
      onSent();
    } catch (err) {
      toast({ status: 'error', title: err.message, duration: 6000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack align="stretch" spacing={3}>
      <Select value={kind} onChange={(event) => setKind(event.target.value)} maxW="420px">
        <option value="bug">Something is broken (bug)</option>
        <option value="suggestion">Something could be better (suggestion)</option>
      </Select>
      <Input
        placeholder={KIND_COPY[kind].title}
        value={title}
        maxLength={160}
        onChange={(event) => setTitle(event.target.value)}
      />
            <Textarea
        placeholder={KIND_COPY[kind].description}
        rows={5}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <Input
        placeholder="Enter the module or link (optional)"
        value={pageUrl}
        maxLength={500}
        onChange={(event) => setPageUrl(event.target.value)}
      />
      <Select
        placeholder={kind === 'bug' ? 'Where is this? (required)' : 'Where was it? (optional)'}
        value={classId}
        onChange={(event) => setClassId(event.target.value)}
        maxW="420px"
        isRequired={kind === 'bug'}
      >
        {/* First, because it is the right answer for anything outside a class
            — and because a reporter who has to scroll past twelve classes to
            find it will pick one of the twelve instead. */}
        <option value={GENERAL}>General — not about a particular class</option>
        {classes.map((klass) => (
          <option key={klass._id} value={klass._id}>
            {klass.name}
          </option>
        ))}
      </Select>
      <Box>
        <Text fontSize="sm" mb={1} color="lmFg.subtle">
          Screenshot (optional, max 800 KB)
        </Text>
        <Input
          type="file"
          accept="image/*"
          size="sm"
          p={1}
          onChange={handleScreenshot}
        />
        {screenshotError && (
          <Text fontSize="xs" color="red.500" mt={1}>{screenshotError}</Text>
        )}
        {screenshot && (
          <Box mt={2} position="relative" display="inline-block">
            <Image src={screenshot} maxH="120px" borderRadius="md" borderWidth="1px" />
            <DeleteButton
              size="xs"
              label="Remove screenshot"
              variant="solid"
              position="absolute"
              top={1}
              right={1}
              onClick={() => setScreenshot(null)}
            />
          </Box>
        )}
      </Box>
      <Flex align="center" gap={3} wrap="wrap">
        <Button colorScheme="purple" onClick={submit} isLoading={saving} isDisabled={!title.trim() || (kind === 'bug' && !classId)}>
          Send
        </Button>
        {/* No route to GitHub from this form, for anybody. Filing here is the
            only way in: it reaches the queue, it pays points, and an admin
            decides what is worth raising on the tracker. Escalation lives in
            the queue instead — see AdminQueue. */}
        <Text fontSize="xs" color="lmFg.muted">
          {pointsPerReport} points once an administrator approves it — and a badge if it was in one
          of your classes.
        </Text>
      </Flex>
    </VStack>
  );
}

/**
 * Every reply on a report, oldest first, with who wrote it and when.
 *
 * The same component on both sides of the conversation: the admin needs it to
 * see whether they have already asked this, and the reporter needs it because
 * showing only the newest note made a question, its answer and the follow-up
 * look like one remark.
 */
function NoteThread({ report, ...boxProps }) {
  const thread = noteThread(report);
  if (!thread.length) return null;

  return (
    <Box {...boxProps}>
      <Text fontSize="xs" fontWeight="600" color="lmFg.muted" mb={1}>
        {noteThreadLabel(thread)}
      </Text>
      <VStack align="stretch" spacing={2}>
        {thread.map((entry, index) => (
          <Box
            key={entry._id || `${entry.at || ''}-${index}`}
            borderWidth="1px"
            borderRadius="md"
            p={2}
          >
            <Text fontSize="sm" whiteSpace="pre-wrap">
              {entry.body}
            </Text>
            <Text fontSize="xs" color="lmFg.muted" mt={1}>
              {noteByline(entry, formatDateTime, (value) => STATUS_STYLE[value]?.label || value)}
            </Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}

/** The admin queue. Only rendered when the API let this account read it. */
function AdminQueue({ reports, counts, onReviewed }) {
  const [note, setNote] = useState({});
  const [sendingNote, setSendingNote] = useState(null);
  const toast = useToast();

  const decide = async (report, status) => {
    try {
      // Only send the note when this admin actually typed one. Sending the
      // untouched field would post an empty string and wipe whatever note the
      // report already carried.
      const edited = note[report._id];
      await lmApi.reviewBug(report._id, {
        status,
        ...(edited === undefined ? {} : { adminNote: edited }),
      });
      toast({ status: 'success', title: `Marked ${status}` });
      onReviewed();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  // A reply without a verdict — "what were you doing when it happened?" on a
  // ticket that has to stay open until they answer.
  const sendNote = async (report) => {
    // The box starts empty and is emptied again after a send: it is where the
    // next reply is written, not a copy of the last one that has to be cleared
    // before anything else can be said.
    const text = (note[report._id] ?? '').trim();
    if (!text) return;
    setSendingNote(report._id);
    try {
      await lmApi.reviewBug(report._id, { adminNote: text });
      toast({ status: 'success', title: 'Note sent to the reporter' });
      setNote((current) => {
        const next = { ...current };
        delete next[report._id];
        return next;
      });
      onReviewed();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    } finally {
      setSendingNote(null);
    }
  };

  return (
    <VStack align="stretch" spacing={3}>
      <HStack spacing={2} wrap="wrap">
        {Object.entries(counts).map(([status, count]) => (
          <Badge key={status} colorScheme={STATUS_STYLE[status]?.colorScheme || 'gray'} borderRadius="full" px={2}>
            {count} {status}
          </Badge>
        ))}
      </HStack>

      {reports.length === 0 ? (
        <EmptyState icon="success" title="Nothing in the queue" />
      ) : (
        reports.map((report) => (
          <Box key={report._id} borderWidth="1px" borderRadius="md" p={4}>
            <Flex justify="space-between" gap={3} wrap="wrap" mb={1}>
              <HStack spacing={2}>
                <Badge colorScheme={KIND_STYLE[report.kind]?.colorScheme || 'red'}>
                  {KIND_STYLE[report.kind]?.label || 'Bug'}
                </Badge>
                <Text fontWeight="600">{report.title}</Text>
              </HStack>
              <Badge colorScheme={STATUS_STYLE[report.status]?.colorScheme || 'gray'}>{report.status}</Badge>
            </Flex>
            <Text fontSize="xs" color="lmFg.muted" mb={2}>
              {report.reporterName} ({report.reporterRole || 'user'}) · {relativeTime(report.created_at)}
              {report.className ? ` · in ${report.className}` : ' · platform-wide'}
            </Text>
            {report.description && (
              <Text fontSize="sm" whiteSpace="pre-wrap" mb={2}>
                {report.description}
              </Text>
            )}
            {report.pageUrl && (
              <Text fontSize="xs" color="lmFg.muted" mb={2} wordBreak="break-all">
                {report.pageUrl}
              </Text>
            )}
            {report.screenshotUrl && (
              <Box mb={2}>
                <Text fontSize="xs" color="lmFg.muted" mb={1}>Screenshot:</Text>
                <Image
                  src={report.screenshotUrl}
                  maxH="200px"
                  borderRadius="md"
                  borderWidth="1px"
                  cursor="pointer"
                  onClick={() => window.open(report.screenshotUrl, '_blank')}
                />
              </Box>
            )}

            {report.awardedAt && (
              <Badge colorScheme="green" mb={2}>
                points already paid
              </Badge>
            )}

            <VStack align="stretch" spacing={1} mb={2}>
              <Textarea
                size="sm"
                rows={2}
                resize="vertical"
                maxLength={2000}
                placeholder="Reply to the reporter — this is emailed to them"
                value={note[report._id] ?? ''}
                onChange={(event) =>
                  setNote((current) => ({ ...current, [report._id]: event.target.value }))
                }
                onKeyDown={(event) => {
                  // Enter starts a line now that this is a paragraph box.
                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    sendNote(report);
                  }
                }}
              />
              <Flex justify="space-between" align="center" gap={2} wrap="wrap">
                <Text fontSize="xs" color="lmFg.muted">
                  Emailed to the reporter. Ctrl+Enter to send.
                </Text>
                <Button
                  size="sm"
                  colorScheme="purple"
                  variant="outline"
                  flexShrink={0}
                  isLoading={sendingNote === report._id}
                  isDisabled={!(note[report._id] ?? '').trim()}
                  onClick={() => sendNote(report)}
                >
                  Send note
                </Button>
              </Flex>
            </VStack>
            <HStack spacing={2} wrap="wrap">
              {/* Only "approve" pays, and only the first time — the server will
                  not pay twice however often this is pressed. */}
              <Button size="xs" colorScheme="green" onClick={() => decide(report, 'acknowledged')}>
                Approve
              </Button>
              <Button size="xs" variant="outline" onClick={() => decide(report, 'fixed')}>
                {report.kind === 'suggestion' ? 'Done' : 'Fixed'}
              </Button>
              <Button size="xs" variant="outline" onClick={() => decide(report, 'duplicate')}>
                Already known
              </Button>
              <Button size="xs" variant="ghost" colorScheme="red" onClick={() => decide(report, 'rejected')}>
                Reject
              </Button>
              {/* Escalation, not a decision: it opens a prefilled issue and
                  leaves the report's own status alone, so approving it (and
                  paying the reporter) is still a separate, deliberate click. */}
              <Button
                as="a"
                size="xs"
                variant="outline"
                colorScheme="purple"
                href={githubIssueUrl({
                  kind: report.kind,
                  title: report.title,
                  description: report.description,
                  pageUrl: report.pageUrl,
                  className: report.className,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                Raise on GitHub ↗
              </Button>
            </HStack>

            <NoteThread report={report} mt={3} />
          </Box>
        ))
      )}
    </VStack>
  );
}

export default function BugReports() {
  const [mine, setMine] = useState(null);
  const [queue, setQueue] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [own, myClasses, admin] = await Promise.all([
        lmApi.myBugReports(),
        lmApi.listClasses().catch(() => []),
        // 403 for everyone who is not a platform admin, which is how this page
        // decides whether to show the queue at all.
        lmApi.allBugReports().catch(() => null),
      ]);
      setMine(own);
      setClasses(myClasses);
      setQueue(admin);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Loading…" skeleton={<TableSkeleton rows={6} columns={5} />} />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  const form = (
    <SectionCard
      title="Bug / Suggestion"
      subtitle="Found something broken, or thought of something better? Tell us and we will look."
    >
      <ReportForm classes={classes} pointsPerReport={mine.pointsPerReport} onSent={load} />
    </SectionCard>
  );

  const history = (
    <SectionCard title="Your submissions">
      {mine.reports.length === 0 ? (
        <EmptyState icon="empty" title="Nothing sent yet" />
      ) : (
        <VStack align="stretch" spacing={2}>
          {mine.reports.map((report) => (
            <Box key={report._id} borderWidth="1px" borderRadius="md" p={3}>
              <Flex justify="space-between" gap={2} wrap="wrap">
                <HStack spacing={2}>
                  <Badge colorScheme={KIND_STYLE[report.kind]?.colorScheme || 'red'}>
                    {KIND_STYLE[report.kind]?.label || 'Bug'}
                  </Badge>
                  <Text fontSize="sm" fontWeight="500">
                    {report.title}
                  </Text>
                </HStack>
                <HStack spacing={2}>
                  {report.awarded && <Badge colorScheme="purple">+{mine.pointsPerReport}</Badge>}
                  <Badge colorScheme={STATUS_STYLE[report.status]?.colorScheme || 'gray'}>
                    {STATUS_STYLE[report.status]?.label || report.status}
                  </Badge>
                </HStack>
              </Flex>
              <Text fontSize="xs" color="lmFg.muted">
                {formatDateTime(report.created_at)}
                {report.className ? ` · ${report.className}` : ''}
              </Text>
              {/* The whole exchange, not just the last line of it — see
                  NoteThread. It used to be one Alert holding the newest note,
                  which meant an answer to a question replaced the question. */}
              <NoteThread report={report} mt={2} />
            </Box>
          ))}
        </VStack>
      )}
    </SectionCard>
  );

  // Admins get the queue alongside their own reports; everyone else just files.
  if (!queue) {
    return (
      <VStack align="stretch" spacing={4}>
        {form}
        {history}
      </VStack>
    );
  }

  return (
    <Tabs colorScheme="purple" isLazy>
      <TabList>
        <Tab>Bug / Suggestion</Tab>
        <Tab>
          Queue
          {queue.counts?.open ? (
            <Badge ml={2} colorScheme="blue" borderRadius="full">
              {queue.counts.open}
            </Badge>
          ) : null}
        </Tab>
      </TabList>
      <TabPanels>
        <TabPanel px={0}>
          <VStack align="stretch" spacing={4}>
            {form}
            {history}
          </VStack>
        </TabPanel>
        <TabPanel px={0}>
          <SectionCard
            title="Bugs & suggestions"
            subtitle="Approving pays the person who sent it, once."
          >
            <AdminQueue reports={queue.reports} counts={queue.counts || {}} onReviewed={load} />
          </SectionCard>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
