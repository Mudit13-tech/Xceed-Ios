import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Box,
  Flex,
  HStack,
  Skeleton,
  Text,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { LmIcon } from './Icon';

// Helper to normalize any date input (String "YYYY-MM-DD", Date object, or ISO timestamp) to "YYYY-MM-DD"
function toDateString(d) {
  if (!d) return null;
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format friendly date: "Mon, Mar 16, 2026"
function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Filter attendance records matching a specific Learning Module class/subject.
 * Uses exact matching and word-boundary comparisons to prevent accidental substring false positives.
 * Also bounds by active session dates to stay 100% in sync with StudentAttendanceMap.
 */
export function matchSubjectRecords(history = [], klass = {}, academicSessions = [], currentSession = null) {
  if (!Array.isArray(history) || history.length === 0 || !klass) return [];

  // Find active session object from Allotment config
  let activeSessionObj = null;
  if (currentSession && Array.isArray(academicSessions)) {
    activeSessionObj = academicSessions.find((s) => String(s.session) === String(currentSession));
  }
  if (!activeSessionObj && Array.isArray(academicSessions) && academicSessions.length > 0) {
    activeSessionObj = academicSessions[0];
  }

  const startStr = activeSessionObj?.startingDate ? toDateString(activeSessionObj.startingDate) : null;
  const endStr = activeSessionObj?.endingDate ? toDateString(activeSessionObj.endingDate) : null;

  const kSub = (klass.subject || '').trim().toLowerCase();
  const kCode = (klass.subjectCode || '').trim().toLowerCase();
  const kName = (klass.name || '').trim().toLowerCase();

  const matched = history.filter((r) => {
    // Filter by session date bounds if configured
    if (startStr && endStr && r.date) {
      if (r.date < startStr || r.date > endStr) return false;
    }

    const rSub = (r.subject || '').trim().toLowerCase();
    const rFull = (r.subjectFullName || '').trim().toLowerCase();

    // 1. Direct exact matches
    if (kSub && (rSub === kSub || rFull === kSub)) return true;
    if (kCode && (rSub === kCode || rFull === kCode)) return true;
    if (kName && (rSub === kName || rFull === kName)) return true;

    // 2. Word-boundary regex matching only (prevents "embedded" falsely matching "eed")
    if (kSub && kSub.length >= 2) {
      const regexSub = new RegExp(`(^|\\b|\\s|_|-)${kSub.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}($|\\b|\\s|_|-)`, 'i');
      if (regexSub.test(rSub) || regexSub.test(rFull)) return true;
    }
    if (kCode && kCode.length >= 2) {
      const regexCode = new RegExp(`(^|\\b|\\s|_|-)${kCode.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}($|\\b|\\s|_|-)`, 'i');
      if (regexCode.test(rSub) || regexCode.test(rFull)) return true;
    }

    return false;
  });

  // Sort chronologically (earliest class to latest class)
  return matched.sort((a, b) => {
    const dComp = (a.date || '').localeCompare(b.date || '');
    if (dComp !== 0) return dComp;
    return (a.timeSlot || '').localeCompare(b.timeSlot || '');
  });
}

export default function SubjectAttendanceStrip({ klass }) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const mutedText = useColorModeValue('gray.500', 'gray.400');
  const presentBg = useColorModeValue('green.400', 'green.400');
  const absentBg = useColorModeValue('red.400', 'red.400');
  const reviewBg = useColorModeValue('yellow.400', 'yellow.400');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['learning', 'profile'],
    queryFn: () => lmApi.myProfile(),
    staleTime: 60000,
  });

  const subjectRecords = useMemo(() => {
    return matchSubjectRecords(
      profile?.attendanceHistory || [],
      klass,
      profile?.academicSessions || [],
      profile?.currentSession || null
    );
  }, [profile?.attendanceHistory, profile?.academicSessions, profile?.currentSession, klass]);

  const stats = useMemo(() => {
    const total = subjectRecords.length;
    let present = 0;
    let absent = 0;

    subjectRecords.forEach((r) => {
      if (r.finalStatus === 'P' || r.status === 'present') {
        present += 1;
      } else {
        absent += 1;
      }
    });

    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    const colorScheme = percentage >= 75 ? 'green' : percentage >= 65 ? 'orange' : 'red';
    const statusText = percentage >= 75 ? 'Eligible' : 'Shortage (< 75%)';

    return { total, present, absent, percentage, colorScheme, statusText };
  }, [subjectRecords]);

  if (isLoading) {
    return (
      <Box
        px={3}
        py={2}
        mb={3}
        borderRadius="md"
        borderWidth="1px"
        borderColor={borderColor}
        bg={cardBg}
      >
        <Skeleton height="18px" borderRadius="sm" />
      </Box>
    );
  }

  return (
    <Box
      px={{ base: 3, md: 4 }}
      py={2}
      mb={3}
      borderRadius="md"
      borderWidth="1px"
      borderColor={borderColor}
      bg={cardBg}
      boxShadow="sm"
    >
      <Flex
        align="center"
        wrap="wrap"
        gap={3}
        w="100%"
      >
        {/* Left Side: Summary Metrics */}
        <HStack spacing={2} flexShrink={0} wrap="wrap">
          <Text fontSize="xs" fontWeight="700" color="lmFg.body">
            <LmIcon name="insights" size={12} style={{ marginRight: 4 }} />
            Attendance:
          </Text>
          {stats.total > 0 ? (
            <>
              <Text fontSize="xs" fontWeight="800" color={`${stats.colorScheme}.500`}>
                {stats.percentage}%
              </Text>
              <Text fontSize="2xs" color={mutedText}>
                ({stats.present}/{stats.total} Present)
              </Text>
              <Badge colorScheme={stats.colorScheme} fontSize="2xs" borderRadius="full" px={1.5}>
                {stats.statusText}
              </Badge>
            </>
          ) : (
            <Text fontSize="2xs" color={mutedText}>
              No attendance recorded yet for this subject
            </Text>
          )}
        </HStack>

        {/* Subtle separator */}
        {stats.total > 0 && (
          <Box h="14px" w="1px" bg={borderColor} display={{ base: 'none', sm: 'block' }} />
        )}

        {/* Inline Horizontal Box Sequence */}
        {stats.total > 0 && (
          <HStack
            spacing="3px"
            overflowX="auto"
            py={1}
            flex="1"
            minW="0"
            css={{
              scrollbarWidth: 'thin',
            }}
          >
            {subjectRecords.map((rec, idx) => {
              const isPresent = rec.finalStatus === 'P' || rec.status === 'present';
              const isReview = rec.finalStatus === 'R' || rec.status === 'review';
              const boxBg = isPresent ? presentBg : isReview ? reviewBg : absentBg;
              const statusLabel = isPresent ? 'Present' : isReview ? 'Under Review' : 'Absent';

              const tooltipLabel = [
                formatShortDate(rec.date),
                rec.timeSlot ? `Slot: ${rec.timeSlot}` : null,
                rec.room ? `Room: ${rec.room}` : null,
                `Status: ${statusLabel}`,
                rec.faculty ? `Faculty: ${rec.faculty}` : null,
              ]
                .filter(Boolean)
                .join('\n');

              return (
                <Tooltip
                  key={rec.reportId ? `${rec.reportId}-${idx}` : `strip-${idx}`}
                  label={tooltipLabel}
                  placement="top"
                  hasArrow
                  whiteSpace="pre-line"
                  fontSize="2xs"
                  p={1.5}
                >
                  <Box
                    w="13px"
                    h="13px"
                    minW="13px"
                    borderRadius="2px"
                    bg={boxBg}
                    cursor="pointer"
                    transition="transform 0.15s ease, box-shadow 0.15s ease"
                    _hover={{
                      transform: 'scale(1.35)',
                      zIndex: 2,
                      boxShadow: 'xs',
                    }}
                  />
                </Tooltip>
              );
            })}
          </HStack>
        )}
      </Flex>
    </Box>
  );
}
