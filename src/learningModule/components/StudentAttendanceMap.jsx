import React, { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Collapse,
  Divider,
  Flex,
  HStack,
  Icon,
  Progress,
  Select,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useColorModeValue,
  VStack,
} from '@chakra-ui/react';
import { SectionCard } from './common';

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

// Format friendly date: "Monday, Mar 16, 2026"
function formatFullDate(dateStr) {
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

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StudentAttendanceMap({
  history = [],
  academicSessions = [],
  currentSession = null,
  studentRollNo = '',
}) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const mutedText = useColorModeValue('gray.500', 'gray.400');
  const emptyCellColor = useColorModeValue('gray.100', 'gray.700');
  const holidayCellColor = useColorModeValue('blue.100', 'blue.800');
  const todayRingColor = useColorModeValue('blue.500', 'blue.300');
  const tableHoverBg = useColorModeValue('gray.50', 'gray.750');
  const selectedDayBg = useColorModeValue('gray.50', 'gray.700');
  const presentCellColor = useColorModeValue('green.400', 'green.400');
  const absentCellColor = useColorModeValue('red.400', 'red.400');
  const partialCellColor = useColorModeValue('yellow.400', 'yellow.400');

  // Build the list of selectable semesters/sessions
  const sessionOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const set = new Set();
    const list = [];

    // Helper to validate reasonable academic session names
    const isValidSession = (sessStr) => {
      if (!sessStr || sessStr === '__CURRENT_SESSION_MARKER__') return false;
      const match = sessStr.match(/(\d{4})/);
      if (match) {
        const yr = parseInt(match[1], 10);
        // Exclude dummy test sessions from far future (e.g. 2045, 2056) or distant past
        if (yr > currentYear + 1 || yr < 2018) return false;
      }
      return true;
    };

    // 1. Current Session first if available and valid
    if (currentSession && isValidSession(currentSession)) {
      set.add(currentSession);
      list.push({
        value: currentSession,
        label: `${currentSession} (Current)`,
        isCurrent: true,
        score: 999999,
      });
    }

    // 2. Academic sessions from Allotment that have configured dates or student records
    if (Array.isArray(academicSessions)) {
      academicSessions.forEach((s) => {
        if (isValidSession(s.session) && !set.has(s.session)) {
          const hasDates = Boolean(s.startingDate || s.endingDate);
          const hasAttendance =
            Array.isArray(history) &&
            history.some((h) => String(h.semester) === String(s.session) || (h.batch && h.batch.includes(s.session)));
          if (hasDates || hasAttendance) {
            set.add(s.session);
            const yrMatch = s.session.match(/(\d{4})/);
            const yr = yrMatch ? parseInt(yrMatch[1], 10) : 0;
            const isEven = /even/i.test(s.session);
            list.push({
              value: s.session,
              label: s.session,
              isCurrent: false,
              score: yr * 10 + (isEven ? 2 : 1),
            });
          }
        }
      });
    }

    // 3. Semesters found in student attendance history
    if (Array.isArray(history)) {
      history.forEach((h) => {
        if (h.semester && isValidSession(h.semester) && !set.has(h.semester)) {
          set.add(h.semester);
          const yrMatch = h.semester.match(/(\d{4})/);
          const yr = yrMatch ? parseInt(yrMatch[1], 10) : 0;
          const isEven = /even/i.test(h.semester);
          list.push({
            value: h.semester,
            label: h.semester.toLowerCase().includes('sem') ? h.semester : `Semester ${h.semester}`,
            isCurrent: false,
            score: yr * 10 + (isEven ? 2 : 1),
          });
        }
      });
    }

    // Sort: Current session at top, then descending chronological order
    list.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return b.score - a.score;
    });

    return list.map(({ value, label }) => ({ value, label }));
  }, [academicSessions, currentSession, history]);

  // Selected semester state (defaults to currentSession if present, else first option or "All")
  const [selectedSemester, setSelectedSemester] = useState(() => {
    if (currentSession) return currentSession;
    if (sessionOptions.length > 0) return sessionOptions[0].value;
    return 'All';
  });

  // Selected single day for detailed inspect view
  const [selectedDay, setSelectedDay] = useState(null);

  // Find active session object from Allotment config
  const activeSessionObj = useMemo(() => {
    if (!academicSessions || selectedSemester === 'All') return null;
    return academicSessions.find((s) => String(s.session) === String(selectedSemester)) || null;
  }, [academicSessions, selectedSemester]);

  // Map of non-working days for the selected session (or across all sessions if 'All' is selected)
  const holidaysMap = useMemo(() => {
    const map = {};
    if (activeSessionObj && Array.isArray(activeSessionObj.nonWorkingDays)) {
      activeSessionObj.nonWorkingDays.forEach((nwd) => {
        const dStr = toDateString(nwd.date);
        if (dStr) {
          map[dStr] = nwd.remark || 'Holiday';
        }
      });
    } else if (Array.isArray(academicSessions)) {
      // If 'All' is selected or semester string doesn't directly match, collect non-working days from all valid sessions
      academicSessions.forEach((sess) => {
        if (Array.isArray(sess.nonWorkingDays)) {
          sess.nonWorkingDays.forEach((nwd) => {
            const dStr = toDateString(nwd.date);
            if (dStr && !map[dStr]) {
              map[dStr] = nwd.remark || 'Holiday';
            }
          });
        }
      });
    }
    return map;
  }, [activeSessionObj, academicSessions]);

  // Filter attendance records by selected semester/session
  const filteredHistory = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return [];
    if (selectedSemester === 'All') return history;

    // If active session has date bounds, filter by date range or semester string
    const startStr = activeSessionObj ? toDateString(activeSessionObj.startingDate) : null;
    const endStr = activeSessionObj ? toDateString(activeSessionObj.endingDate) : null;

    return history.filter((h) => {
      if (String(h.semester) === String(selectedSemester)) return true;
      if (h.batch && h.batch.includes(selectedSemester)) return true;
      if (startStr && endStr && h.date) {
        return h.date >= startStr && h.date <= endStr;
      }
      return false;
    });
  }, [history, selectedSemester, activeSessionObj]);

  // Aggregate history by date
  const byDate = useMemo(() => {
    const map = {};
    filteredHistory.forEach((record) => {
      const dStr = toDateString(record.date);
      if (!dStr) return;

      if (!map[dStr]) {
        map[dStr] = {
          present: 0,
          absent: 0,
          total: 0,
          records: [],
        };
      }

      map[dStr].total += 1;
      const isPresent = record.finalStatus === 'P' || record.status === 'present';
      if (isPresent) {
        map[dStr].present += 1;
      } else {
        map[dStr].absent += 1;
      }
      map[dStr].records.push(record);
    });
    return map;
  }, [filteredHistory]);

  // Compute Overall Statistics for selected semester
  const stats = useMemo(() => {
    let totalClasses = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let distinctDays = Object.keys(byDate).length;

    filteredHistory.forEach((r) => {
      totalClasses += 1;
      if (r.finalStatus === 'P' || r.status === 'present') {
        totalPresent += 1;
      } else {
        totalAbsent += 1;
      }
    });

    const percentage = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;

    let standingColor = 'green';
    let standingText = 'Good Standing (≥ 75%)';
    if (percentage < 65) {
      standingColor = 'red';
      standingText = 'Critical Shortage (< 65%)';
    } else if (percentage < 75) {
      standingColor = 'orange';
      standingText = 'Warning (< 75%)';
    }

    return {
      totalClasses,
      totalPresent,
      totalAbsent,
      percentage,
      distinctDays,
      standingColor,
      standingText,
    };
  }, [filteredHistory, byDate]);

  // Compute Subject-Wise breakdown for selected semester
  const subjectBreakdown = useMemo(() => {
    const subMap = {};
    filteredHistory.forEach((r) => {
      const code = r.subject || 'Other';
      if (!subMap[code]) {
        subMap[code] = {
          code,
          name: r.subjectFullName || r.subject || 'Class',
          faculty: r.faculty || '',
          total: 0,
          present: 0,
          absent: 0,
        };
      }
      subMap[code].total += 1;
      if (r.finalStatus === 'P' || r.status === 'present') {
        subMap[code].present += 1;
      } else {
        subMap[code].absent += 1;
      }
    });

    return Object.values(subMap)
      .map((s) => ({
        ...s,
        pct: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredHistory]);

  // Compute GitHub Grid Structure (Weeks and Months)
  const { weeks, monthHeaders } = useMemo(() => {
    let startDate = null;
    let endDate = null;

    const startStr = activeSessionObj ? toDateString(activeSessionObj.startingDate) : null;
    const endStr = activeSessionObj ? toDateString(activeSessionObj.endingDate) : null;

    if (startStr && endStr) {
      const [sy, sm, sd] = startStr.split('-').map(Number);
      const [ey, em, ed] = endStr.split('-').map(Number);
      startDate = new Date(sy, sm - 1, sd);
      endDate = new Date(ey, em - 1, ed);
    } else {
      // Derive from records or default to last 16 weeks
      const dates = Object.keys(byDate).sort();
      if (dates.length > 0) {
        const [sy, sm, sd] = dates[0].split('-').map(Number);
        const [ey, em, ed] = dates[dates.length - 1].split('-').map(Number);
        startDate = new Date(sy, sm - 1, sd);
        endDate = new Date(ey, em - 1, ed);
      } else {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 16 * 7);
      }
    }

    if (!startDate || isNaN(startDate.getTime()) || !endDate || isNaN(endDate.getTime())) {
      return { weeks: [], monthHeaders: [] };
    }

    // Align startDate backwards to Sunday
    const startGrid = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    startGrid.setDate(startGrid.getDate() - startGrid.getDay());

    // Align endDate forwards to Saturday
    const endGrid = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    endGrid.setDate(endGrid.getDate() + (6 - endGrid.getDay()));

    const todayStr = toDateString(new Date());

    const weekList = [];
    let currentWeek = [];
    const cur = new Date(startGrid);

    while (cur <= endGrid) {
      const curStr = toDateString(cur);
      const dayStats = byDate[curStr] || null;
      const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const configuredHoliday = holidaysMap[curStr] || null;
      const isHoliday = Boolean(configuredHoliday) || isWeekend;
      const holidayRemark = configuredHoliday
        ? configuredHoliday
        : isWeekend
        ? (dayOfWeek === 0 ? 'Sunday' : 'Saturday')
        : 'Holiday';
      const isToday = curStr === todayStr;

      currentWeek.push({
        dateStr: curStr,
        dayOfWeek,
        month: cur.getMonth(),
        dayOfMonth: cur.getDate(),
        stats: dayStats,
        isHoliday,
        holidayRemark,
        isToday,
      });

      if (currentWeek.length === 7) {
        weekList.push(currentWeek);
        currentWeek = [];
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({
          dateStr: null,
          dayOfWeek: currentWeek.length,
          stats: null,
        });
      }
      weekList.push(currentWeek);
    }

    // Compute month headers
    const mHeaders = [];
    let lastMonth = -1;
    weekList.forEach((week, wIdx) => {
      const firstValidDay = week.find((d) => d && d.dateStr);
      if (firstValidDay && firstValidDay.month !== lastMonth) {
        mHeaders.push({
          label: MONTH_NAMES[firstValidDay.month],
          weekIndex: wIdx,
        });
        lastMonth = firstValidDay.month;
      }
    });

    return { weeks: weekList, monthHeaders: mHeaders };
  }, [activeSessionObj, byDate, holidaysMap]);

  // Determine cell color
  const getCellBg = (day) => {
    if (!day || !day.dateStr) return 'transparent';
    if (day.stats && day.stats.total > 0) {
      const ratio = day.stats.present / day.stats.total;
      if (ratio === 1) return presentCellColor;
      if (ratio === 0) return absentCellColor;
      return partialCellColor; // Partial attendance
    }
    if (day.isHoliday) return holidayCellColor;
    return emptyCellColor;
  };

  const hasAnyData = filteredHistory.length > 0 || weeks.length > 0;

  return (
    <SectionCard
      title="Attendance Contribution Map"
      subtitle={
        studentRollNo
          ? `Visual tracking for Roll No: ${studentRollNo}`
          : "A GitHub-style contribution map tracking your presence across academic sessions."
      }
      action={
        <HStack spacing={3} w={{ base: 'full', sm: 'auto' }} justify={{ base: 'flex-end', sm: 'flex-start' }}>
          <Select
            size="sm"
            w={{ base: 'full', sm: '210px', md: '250px' }}
            value={selectedSemester}
            onChange={(e) => {
              setSelectedSemester(e.target.value);
              setSelectedDay(null);
            }}
            borderColor={borderColor}
            borderRadius="md"
            fontWeight="500"
          >
            <option value="All">All Semesters / Sessions</option>
            {sessionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </HStack>
      }
    >
      {/* ── KPI Summary Cards ────────────────────────────────────── */}
      <SimpleGrid columns={{ base: 2, sm: 2, md: 4 }} spacing={{ base: 2.5, md: 4 }} mb={5}>
        <Box p={{ base: 2.5, md: 3 }} borderRadius="lg" borderWidth="1px" borderColor={borderColor} bg={cardBg}>
          <Text fontSize={{ base: '2xs', md: 'xs' }} fontWeight="600" color={mutedText} textTransform="uppercase" noOfLines={1}>
            Overall Attendance
          </Text>
          <HStack align="baseline" spacing={1.5} mt={1} wrap="wrap">
            <Text fontSize={{ base: 'xl', sm: '2xl' }} fontWeight="800" color={`${stats.standingColor}.500`}>
              {stats.percentage}%
            </Text>
            <Badge colorScheme={stats.standingColor} fontSize="2xs" borderRadius="full" px={1.5}>
              {stats.totalClasses > 0 ? (stats.percentage >= 75 ? 'Good' : stats.percentage >= 65 ? 'Warning' : 'Critical') : 'No Rec'}
            </Badge>
          </HStack>
        </Box>

        <Box p={{ base: 2.5, md: 3 }} borderRadius="lg" borderWidth="1px" borderColor={borderColor} bg={cardBg}>
          <Text fontSize={{ base: '2xs', md: 'xs' }} fontWeight="600" color={mutedText} textTransform="uppercase" noOfLines={1}>
            Classes Attended
          </Text>
          <HStack align="baseline" spacing={1} mt={1} wrap="wrap">
            <Text fontSize={{ base: 'xl', sm: '2xl' }} fontWeight="800" color="green.500">
              {stats.totalPresent}
            </Text>
            <Text fontSize="xs" color={mutedText}>
              / {stats.totalClasses}
            </Text>
          </HStack>
        </Box>

        <Box p={{ base: 2.5, md: 3 }} borderRadius="lg" borderWidth="1px" borderColor={borderColor} bg={cardBg}>
          <Text fontSize={{ base: '2xs', md: 'xs' }} fontWeight="600" color={mutedText} textTransform="uppercase" noOfLines={1}>
            Classes Missed
          </Text>
          <Text fontSize={{ base: 'xl', sm: '2xl' }} fontWeight="800" color="red.400" mt={1}>
            {stats.totalAbsent}
          </Text>
        </Box>

        <Box p={{ base: 2.5, md: 3 }} borderRadius="lg" borderWidth="1px" borderColor={borderColor} bg={cardBg}>
          <Text fontSize={{ base: '2xs', md: 'xs' }} fontWeight="600" color={mutedText} textTransform="uppercase" noOfLines={1}>
            Active Class Days
          </Text>
          <Text fontSize={{ base: 'xl', sm: '2xl' }} fontWeight="800" color="blue.500" mt={1}>
            {stats.distinctDays}
          </Text>
        </Box>
      </SimpleGrid>

      {/* ── GitHub Contribution Grid (Full Width & Responsive) ─────── */}
      {!hasAnyData ? (
        <Box py={8} textAlign="center">
          <Text color={mutedText} fontSize="sm">
            No attendance records found for this semester selection.
          </Text>
        </Box>
      ) : (
        <Box
          overflowX="auto"
          py={3}
          px={{ base: 2, md: 3 }}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="lg"
          bg={cardBg}
          css={{
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Box w="100%" minW={{ base: '580px', md: '100%' }}>
            {/* Month Label Row */}
            <Flex pl="32px" mb={1} position="relative" h="16px" w="100%">
              {monthHeaders.map((m, idx) => (
                <Text
                  key={`m-${idx}`}
                  position="absolute"
                  left={`calc(32px + ${(m.weekIndex / Math.max(weeks.length, 1)) * 100}% - ${(m.weekIndex / Math.max(weeks.length, 1)) * 32}px)`}
                  fontSize="xs"
                  fontWeight="600"
                  color={mutedText}
                >
                  {m.label}
                </Text>
              ))}
            </Flex>

            {/* Main Grid: Days along Y axis (Sun-Sat), Weeks along X axis */}
            <Flex gap="3px" w="100%" align="stretch">
              {/* Day-of-week labels on left side (sticky on mobile scroll) */}
              <VStack
                spacing="3px"
                w="28px"
                minW="28px"
                pr={1}
                align="flex-end"
                justify="space-between"
                position="sticky"
                left={0}
                bg={cardBg}
                zIndex={1}
              >
                {DAY_LABELS.map((dName, dIdx) => (
                  <Box key={`lbl-${dIdx}`} h="12px" display="flex" alignItems="center">
                    {(dIdx === 1 || dIdx === 3 || dIdx === 5) && (
                      <Text fontSize="9px" fontWeight="600" color={mutedText} lineHeight="1">
                        {dName}
                      </Text>
                    )}
                  </Box>
                ))}
              </VStack>

              {/* Week Columns (Stretches across 100% full width) */}
              <Flex gap="3px" flex="1" w="100%" justify="space-between">
                {weeks.map((week, wIdx) => (
                  <VStack key={`week-${wIdx}`} spacing="3px" flex="1" minW="10px" align="center">
                    {week.map((day, dIdx) => {
                      if (!day || !day.dateStr) {
                        return <Box key={`empty-${wIdx}-${dIdx}`} w="100%" maxW="15px" h="12px" />;
                      }

                      const isSelected = selectedDay && selectedDay.dateStr === day.dateStr;

                      // Tooltip generation
                      let tooltipContent = `${formatFullDate(day.dateStr)}: No classes`;
                      if (day.isHoliday) {
                        tooltipContent = `${formatFullDate(day.dateStr)}: ${day.holidayRemark || 'Holiday'}`;
                      }
                      if (day.stats && day.stats.total > 0) {
                        const p = day.stats.present;
                        const t = day.stats.total;
                        const pct = Math.round((p / t) * 100);
                        const classDetails = day.stats.records
                          .map((r) => `${r.subject || 'Class'} (${r.timeSlot || 'Slot'}): ${r.finalStatus === 'P' ? 'Present' : 'Absent'}`)
                          .join('\n');
                        tooltipContent = `${formatFullDate(day.dateStr)}\n${p}/${t} classes attended (${pct}%)\n${classDetails}`;
                      }

                      return (
                        <Tooltip
                          key={day.dateStr}
                          label={tooltipContent}
                          placement="top"
                          hasArrow
                          whiteSpace="pre-line"
                          fontSize="xs"
                          p={2}
                        >
                          <Box
                            w="100%"
                            maxW="15px"
                            h="12px"
                            borderRadius="2px"
                            bg={getCellBg(day)}
                            cursor={day.stats ? 'pointer' : 'default'}
                            outline={day.isToday ? `2px solid ${todayRingColor}` : undefined}
                            outlineOffset="1px"
                            border={isSelected ? '2px solid black' : undefined}
                            transition="transform 0.15s ease, box-shadow 0.15s ease"
                            _hover={{
                              transform: 'scale(1.25)',
                              zIndex: 2,
                              boxShadow: 'sm',
                            }}
                            onClick={() => {
                              if (day.stats && day.stats.records.length > 0) {
                                setSelectedDay(day);
                              }
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </VStack>
                ))}
              </Flex>
            </Flex>
          </Box>

          {/* ── Legends & Status Explanations (Matching Colors & Texts) ── */}
          <Flex
            mt={4}
            pt={3}
            borderTopWidth="1px"
            borderColor={borderColor}
            justify="space-between"
            align={{ base: 'flex-start', sm: 'center' }}
            direction={{ base: 'column', sm: 'row' }}
            wrap="wrap"
            gap={2.5}
            fontSize="xs"
            color={mutedText}
          >
            <HStack spacing={{ base: 3, md: 5 }} wrap="wrap">
              <HStack spacing={1.5}>
                <Box w="11px" h="11px" borderRadius="2px" bg={presentCellColor} />
                <Text fontSize={{ base: '2xs', sm: 'xs' }} fontWeight="500">Present (100%)</Text>
              </HStack>
              <HStack spacing={1.5}>
                <Box w="11px" h="11px" borderRadius="2px" bg={partialCellColor} />
                <Text fontSize={{ base: '2xs', sm: 'xs' }} fontWeight="500">Partial (&lt; 100%)</Text>
              </HStack>
              <HStack spacing={1.5}>
                <Box w="11px" h="11px" borderRadius="2px" bg={absentCellColor} />
                <Text fontSize={{ base: '2xs', sm: 'xs' }} fontWeight="500">Absent (0%)</Text>
              </HStack>
              <HStack spacing={1.5}>
                <Box w="11px" h="11px" borderRadius="2px" bg={holidayCellColor} />
                <Text fontSize={{ base: '2xs', sm: 'xs' }} fontWeight="500">Holiday / Weekend</Text>
              </HStack>
              <HStack spacing={1.5}>
                <Box w="11px" h="11px" borderRadius="2px" bg={emptyCellColor} />
                <Text fontSize={{ base: '2xs', sm: 'xs' }} fontWeight="500">No Classes</Text>
              </HStack>
            </HStack>
          </Flex>
        </Box>
      )}

      {/* ── Selected Day Detail Inspector ────────────────────────── */}
      <Collapse in={Boolean(selectedDay && selectedDay.stats)} animateOpacity>
        {selectedDay && selectedDay.stats && (
          <Box
            mt={4}
            p={4}
            borderRadius="lg"
            borderWidth="1px"
            borderColor="blue.300"
            bg={selectedDayBg}
          >
            <Flex justify="space-between" align="center" mb={3}>
              <VStack align="start" spacing={0}>
                <Text fontSize="sm" fontWeight="700">
                  {formatFullDate(selectedDay.dateStr)}
                </Text>
                <Text fontSize="xs" color={mutedText}>
                  {selectedDay.stats.present} / {selectedDay.stats.total} classes attended
                </Text>
              </VStack>
              <Badge
                colorScheme={
                  selectedDay.stats.present === selectedDay.stats.total
                    ? 'green'
                    : selectedDay.stats.present > 0
                    ? 'yellow'
                    : 'red'
                }
                borderRadius="full"
                px={2.5}
                py={0.5}
              >
                {selectedDay.stats.present === selectedDay.stats.total
                  ? 'All Present'
                  : selectedDay.stats.present > 0
                  ? 'Partial Attendance'
                  : 'Absent'}
              </Badge>
            </Flex>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
              {selectedDay.stats.records.map((r, rIdx) => (
                <Box
                  key={`day-rec-${rIdx}`}
                  p={2.5}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={borderColor}
                  bg={cardBg}
                >
                  <Flex justify="space-between" align="center">
                    <VStack align="start" spacing={0.5}>
                      <Text fontSize="xs" fontWeight="700">
                        {r.subjectFullName || r.subject || 'Class'}
                      </Text>
                      <Text fontSize="2xs" color={mutedText}>
                        {r.timeSlot ? `Slot: ${r.timeSlot}` : ''}
                        {r.room ? ` · Room: ${r.room}` : ''}
                        {r.faculty ? ` · Faculty: ${r.faculty}` : ''}
                      </Text>
                    </VStack>
                    <Badge
                      colorScheme={r.finalStatus === 'P' || r.status === 'present' ? 'green' : 'red'}
                      fontSize="2xs"
                      borderRadius="full"
                      px={2}
                    >
                      {r.finalStatus === 'P' || r.status === 'present' ? 'Present' : 'Absent'}
                    </Badge>
                  </Flex>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )}
      </Collapse>

      {/* ── Subject-Wise Attendance Breakdown Table ─────────────── */}
      {subjectBreakdown.length > 0 && (
        <Box mt={5}>
          <Text fontSize="sm" fontWeight="700" mb={2}>
            Subject-Wise Attendance Breakdown
          </Text>
          <Box
            overflowX="auto"
            borderRadius="lg"
            borderWidth="1px"
            borderColor={borderColor}
            bg={cardBg}
            css={{
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <Table size="sm" variant="simple" minW={{ base: '480px', md: '100%' }}>
              <Thead>
                <Tr>
                  <Th>Subject</Th>
                  <Th>Faculty</Th>
                  <Th isNumeric>Attended</Th>
                  <Th isNumeric>Total</Th>
                  <Th isNumeric w="120px">Percentage</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {subjectBreakdown.map((sub) => (
                  <Tr key={sub.code} _hover={{ bg: tableHoverBg }}>
                    <Td fontWeight="600" fontSize="xs">
                      {sub.name}
                      {sub.code !== sub.name && (
                        <Text fontSize="2xs" color={mutedText}>
                          {sub.code}
                        </Text>
                      )}
                    </Td>
                    <Td fontSize="xs" color={mutedText}>
                      {sub.faculty || '—'}
                    </Td>
                    <Td isNumeric fontWeight="700" color="green.500" fontSize="xs">
                      {sub.present}
                    </Td>
                    <Td isNumeric fontSize="xs" color={mutedText}>
                      {sub.total}
                    </Td>
                    <Td isNumeric>
                      <HStack spacing={2} justify="flex-end">
                        <Progress
                          value={sub.pct}
                          size="xs"
                          w="50px"
                          borderRadius="full"
                          colorScheme={sub.pct >= 75 ? 'green' : sub.pct >= 65 ? 'orange' : 'red'}
                        />
                        <Text fontSize="xs" fontWeight="700" minW="32px">
                          {sub.pct}%
                        </Text>
                      </HStack>
                    </Td>
                    <Td>
                      <Badge
                        colorScheme={sub.pct >= 75 ? 'green' : sub.pct >= 65 ? 'orange' : 'red'}
                        fontSize="2xs"
                        borderRadius="full"
                        px={2}
                      >
                        {sub.pct >= 75 ? 'Eligible' : 'Shortage'}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      )}
    </SectionCard>
  );
}
