import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  Tabs,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  VStack,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';

import getEnvironment from '../../getenvironment';
import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard } from '../components/common';
import MyGroundTruthPhotos from '../components/MyGroundTruthPhotos';
import StudentAttendanceMap from '../components/StudentAttendanceMap';
import { relativeTime } from '../format';

/**
 * "Was I marked present?" — and the way to argue when the answer is wrong.
 *
 * The classroom cameras finalise a period, the student is mailed and notified,
 * and this is where that notification lands. One row per period, the marking
 * that was recorded, and a dispute the Department Coordinator then accepts or
 * rejects. The verdict never rewrites attendance by itself: an accepted dispute
 * is the coordinator agreeing to correct the record through the ERP, and this
 * page says so rather than implying the number has already moved.
 *
 * Lives in the learning module because that is where students already sign in;
 * the data comes from the attendance module's own API, which owns it.
 *
 * The second tab is the other half of the same question. Disputing a marking
 * argues about one period after the fact; choosing which photos the cameras
 * match you against is how a student stops the next one going wrong. Both are
 * "my attendance", so both live here rather than as a nav entry of their own.
 */

const DISPUTES_API = `${getEnvironment()}/attendancemodule/disputes`;

const STATUS_STYLE = {
  P: { colorScheme: 'green', label: 'Present' },
  A: { colorScheme: 'red', label: 'Absent' },
  R: { colorScheme: 'yellow', label: 'Under review' },
};

const DISPUTE_STYLE = {
  pending: { colorScheme: 'blue', label: 'Dispute pending' },
  accepted: { colorScheme: 'green', label: 'Dispute accepted' },
  rejected: { colorScheme: 'gray', label: 'Dispute rejected' },
};

async function api(path, { method = 'GET', body } = {}) {
  const options = { method, credentials: 'include', headers: {} };
  const token = localStorage.getItem('token');
  if (token) options.headers.Authorization = `Bearer ${token}`;
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${DISPUTES_API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function DisputeDialog({ record, reasons, isOpen, onClose, onRaised }) {
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // Reset per record, so the previous class's wording never rides along.
    setReason('');
    setRemark('');
  }, [record?.reportId]);

  const submit = async () => {
    if (!reason) return;
    setSaving(true);
    try {
      await api('/mine', {
        method: 'POST',
        body: { reportId: record.reportId, reason, remark: remark.trim() },
      });
      toast({ status: 'success', title: 'Dispute raised', description: 'Your Department Coordinator will review it.', duration: 5000 });
      onRaised();
      onClose();
    } catch (err) {
      toast({ status: 'error', title: 'Could not raise the dispute', description: err.message, duration: 6000 });
    } finally {
      setSaving(false);
    }
  };

  if (!record) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Raise a dispute</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Box borderWidth="1px" borderRadius="md" p={3} mb={4} bg="lmBg.sunken">
            <Text fontWeight="600">{record.subject || 'Class'}</Text>
            <Text fontSize="sm" color="lmFg.subtle">
              {record.date} · {record.periodName}
              {record.periodTime ? ` (${record.periodTime})` : ''}
              {record.faculty ? ` · ${record.faculty}` : ''}
            </Text>
            <HStack mt={2}>
              <Text fontSize="sm" color="lmFg.subtle">You were marked</Text>
              <Badge colorScheme={STATUS_STYLE[record.status]?.colorScheme}>
                {STATUS_STYLE[record.status]?.label}
              </Badge>
            </HStack>
          </Box>

          <Text fontSize="sm" fontWeight="600" mb={2}>What is wrong?</Text>
          <RadioGroup value={reason} onChange={setReason}>
            <Stack spacing={2}>
              {reasons.map((item) => (
                <Radio key={item} value={item} size="sm">{item}</Radio>
              ))}
            </Stack>
          </RadioGroup>

          <Text fontSize="sm" fontWeight="600" mt={4} mb={2}>
            Anything that would help the coordinator decide? (optional)
          </Text>
          <Textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Where you were sitting, who can confirm it, anything unusual about the class…"
            rows={3}
            maxLength={1000}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={submit} isLoading={saving} isDisabled={!reason}>
            Raise dispute
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function MyAttendance() {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [profile, setProfile] = useState(null);
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const [disputesRes, profileRes] = await Promise.allSettled([
        api('/mine/attendance'),
        lmApi.myProfile(),
      ]);

      if (disputesRes.status === 'fulfilled') {
        setState({ loading: false, error: null, data: disputesRes.value });
      } else {
        setState({ loading: false, error: null, data: null });
      }

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value);
      }
    } catch (err) {
      setState({ loading: false, error: err, data: null });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (state.loading && !profile) return <Loading label="Loading your attendance…" />;
  if (state.error && !profile) return <ErrorState error={state.error} onRetry={load} />;

  const { records = [], reasons = [], rollNo, windowDays } = state.data || {};
  const currentRoll = profile?.studentRollNo || rollNo || '';

  const visible = records.filter((record) => {
    if (filter === 'all') return true;
    if (filter === 'disputed') return !!record.dispute;
    return record.status === filter;
  });

  const openDispute = (record) => {
    setActive(record);
    onOpen();
  };

  return (
    <Tabs colorScheme="blue" variant="enclosed" isLazy>
      <TabList>
        <Tab fontSize="sm">Markings &amp; disputes</Tab>
        <Tab fontSize="sm">My photos</Tab>
      </TabList>

      <TabPanels>
        <TabPanel px={0}>
          <VStack align="stretch" spacing={5}>
      {/* ── Student GitHub-Style Attendance Contribution Map (Issue #1928) ── */}
      <StudentAttendanceMap
        history={profile?.attendanceHistory || []}
        academicSessions={profile?.academicSessions || []}
        currentSession={profile?.currentSession || null}
        studentRollNo={currentRoll}
      />

      {/* ── Recent Markings & Dispute Management Table ─────────────────────── */}
      <SectionCard
        title="Recent Markings & Disputes"
        subtitle={
          currentRoll
            ? `Roll ${currentRoll} · Disagree with a recent marking? Raise a dispute and your Department Coordinator will review it.`
            : 'Recent class markings. Disagree with a marking? Raise a dispute and your Department Coordinator will review it.'
        }
        action={(
          <Select size="sm" width="190px" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All classes</option>
            <option value="P">Present only</option>
            <option value="A">Absent only</option>
            <option value="disputed">Disputed only</option>
          </Select>
        )}
      >
        {visible.length === 0 ? (
          <EmptyState
            icon="attendance"
            title="Nothing here yet"
            description={
              records.length === 0
                ? `No attendance has been recorded for you in the last ${windowDays} days.`
                : 'No class matches this filter.'
            }
          />
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Period</Th>
                  <Th>Subject</Th>
                  <Th>Faculty</Th>
                  <Th>Marked</Th>
                  <Th>Dispute</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {visible.map((record) => {
                  const status = STATUS_STYLE[record.status] || {};
                  const dispute = record.dispute
                    ? DISPUTE_STYLE[record.dispute.status]
                    : null;
                  return (
                    <Tr key={record.reportId}>
                      <Td whiteSpace="nowrap">{record.date}</Td>
                      <Td whiteSpace="nowrap">
                        <Text fontSize="sm">{record.periodName}</Text>
                        {record.periodTime && (
                          <Text fontSize="xs" color="lmFg.muted">{record.periodTime}</Text>
                        )}
                      </Td>
                      <Td>
                        <Text fontSize="sm" fontWeight="600">{record.subject || '—'}</Text>
                        {record.semester && (
                          <Text fontSize="xs" color="lmFg.muted">Sem {record.semester}</Text>
                        )}
                      </Td>
                      <Td fontSize="sm">{record.faculty || '—'}</Td>
                      <Td>
                        <Badge colorScheme={status.colorScheme}>{status.label}</Badge>
                      </Td>
                      <Td>
                        {dispute ? (
                          <VStack align="start" spacing={0}>
                            <Badge colorScheme={dispute.colorScheme}>{dispute.label}</Badge>
                            {record.dispute.coordinatorRemark && (
                              <Text fontSize="xs" color="lmFg.subtle" maxW="220px">
                                “{record.dispute.coordinatorRemark}”
                              </Text>
                            )}
                            <Text fontSize="xs" color="lmFg.muted">
                              {relativeTime(record.dispute.decidedAt || record.dispute.createdAt)}
                            </Text>
                          </VStack>
                        ) : (
                          <Text fontSize="xs" color="lmFg.faint">—</Text>
                        )}
                      </Td>
                      <Td textAlign="right">
                        {record.disputable && (
                          <Button size="xs" variant="outline" colorScheme="blue" onClick={() => openDispute(record)}>
                            Raise dispute
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </SectionCard>

      <Flex fontSize="xs" color="lmFg.muted" px={1}>
        <Text>
          An accepted dispute is the coordinator agreeing your marking was wrong; the correction
          itself is made through the ERP, so the attendance shown here may take a while to change.
        </Text>
      </Flex>

      <DisputeDialog
        record={active}
        reasons={reasons}
        isOpen={isOpen}
        onClose={onClose}
        onRaised={load}
      />
          </VStack>
        </TabPanel>

        {/* isLazy above: the photo tab fetches a blob per image, and a student
            who only came to check a marking should never pay for that. */}
        <TabPanel px={0}>
          <MyGroundTruthPhotos />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
