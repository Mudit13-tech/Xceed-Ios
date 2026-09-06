import React from 'react';
import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useChartTheme } from '../chartTheme';

/**
 * The charts on the HOD dashboard.
 *
 * Kept out of the page so the page stays a layout: what to show, in what order,
 * with which numbers. Everything about *how* a chart looks — its palette, its
 * axes, its tooltip — lives here once, so all six read as one set rather than
 * six charts that happen to sit on the same screen.
 *
 * Palette: the categorical slots are fixed and assigned in order, never cycled
 * and never reassigned when a filter drops a series — a colour belongs to
 * "Quizzes", not to "third thing on the chart". Both columns are validated as a
 * set for colourblind separation against the surface they sit on (worst adjacent
 * pair ΔE 9.1 light / 8.4 dark). Three of the light steps land under 3:1 against
 * a white card, which is allowed only with relief: every chart here is either
 * directly labelled or repeated in the semester table below it, so no number is
 * ever carried by hue alone.
 *
 * No chart here has two y-axes. Where two measures do not share a scale they are
 * two charts, not one chart with a second axis nobody can read against.
 */

const axisProps = (axis, grid) => ({
  tick: { fill: axis, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: grid },
});

/** Tooltip body — Chakra surfaces, so it matches the card it floats over. */
function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <Box
      bg="lmBg.elevated"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="md"
      boxShadow="lg"
      px={3}
      py={2}
      minW="150px"
    >
      <Text fontSize="xs" fontWeight="700" color="lmFg.heading" mb={1}>
        {label}
      </Text>
      {payload.map((entry) => (
        <Flex key={entry.dataKey ?? entry.name} justify="space-between" gap={4} align="center">
          <HStack spacing={2} minW={0}>
            <Box w="8px" h="8px" borderRadius="2px" bg={entry.color} flexShrink={0} />
            <Text fontSize="xs" color="lmFg.subtle" noOfLines={1}>
              {entry.name}
            </Text>
          </HStack>
          <Text fontSize="xs" fontWeight="600" color="lmFg.body" fontVariantNumeric="tabular-nums">
            {entry.value == null ? '—' : `${entry.value}${suffix}`}
          </Text>
        </Flex>
      ))}
    </Box>
  );
}

const legendProps = (axis) => ({
  wrapperStyle: { fontSize: 11, color: axis, paddingTop: 8 },
  iconType: 'circle',
  iconSize: 8,
});

/** Shown in place of a chart when the filters leave nothing to draw. */
function NoData({ height, message }) {
  return (
    <Flex h={`${height}px`} align="center" justify="center" px={4}>
      <Text fontSize="sm" color="lmFg.muted" textAlign="center">
        {message}
      </Text>
    </Flex>
  );
}

/**
 * Enrolled vs recently active students, per semester.
 *
 * Both series are students, so they share one axis honestly. The gap between
 * the two bars is the point of the chart: a semester whose enrolment bar towers
 * over its active bar is a cohort on the roll and off the platform.
 */
export function SemesterCohortChart({ semesters, windowDays = 30, height = 260 }) {
  const { series, grid, axis, surface } = useChartTheme();
  if (!semesters.length) return <NoData height={height} message="No semesters in view." />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={semesters} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisProps(axis, grid)} />
        <YAxis allowDecimals={false} {...axisProps(axis, grid)} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: grid, fillOpacity: 0.25 }} />
        <Legend {...legendProps(axis)} />
        <Bar
          dataKey="enrolments"
          name="Enrolled"
          fill={series[0]}
          radius={[4, 4, 0, 0]}
          stroke={surface}
          strokeWidth={2}
        />
        <Bar
          dataKey="activeStudents"
          name={`Active (${windowDays}d)`}
          fill={series[2]}
          radius={[4, 4, 0, 0]}
          stroke={surface}
          strokeWidth={2}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** The five content kinds a class can carry, stacked per semester. */
export function SemesterContentChart({ semesters, height = 260 }) {
  const { series, grid, axis, surface } = useChartTheme();
  if (!semesters.length) return <NoData height={height} message="No semesters in view." />;

  const stack = [
    { key: 'posts', name: 'Posts' },
    { key: 'shorts', name: 'Shorts' },
    { key: 'quizzes', name: 'Quizzes' },
    { key: 'coding', name: 'Coding' },
    { key: 'forms', name: 'Forms' },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={semesters} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisProps(axis, grid)} />
        <YAxis allowDecimals={false} {...axisProps(axis, grid)} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: grid, fillOpacity: 0.25 }} />
        <Legend {...legendProps(axis)} />
        {stack.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId="content"
            fill={series[i]}
            // A 2px gap in the card's own colour between segments, so a stack of
            // five fills reads as five things and not one tall block.
            stroke={surface}
            strokeWidth={2}
            radius={i === stack.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * The three rates that say whether a semester is working: how students scored,
 * how much work arrived on time, and how much of what arrived has been marked.
 * All three are percentages, which is what lets them share one 0–100 axis.
 */
export function SemesterOutcomeChart({ semesters, height = 260 }) {
  const { series, grid, axis, surface } = useChartTheme();
  const data = semesters.map((s) => ({
    label: s.label,
    avgQuiz: s.quiz.avgPercent,
    onTime: s.submissions.onTimeRate,
    graded: s.submissions.gradedRate,
  }));
  const hasAny = data.some((d) => d.avgQuiz != null || d.onTime != null || d.graded != null);
  if (!hasAny) {
    return (
      <NoData
        height={height}
        message="Nothing has been attempted or handed in yet, so there are no rates to plot."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisProps(axis, grid)} />
        <YAxis domain={[0, 100]} unit="%" {...axisProps(axis, grid)} />
        <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: grid, fillOpacity: 0.25 }} />
        <Legend {...legendProps(axis)} />
        <Bar dataKey="avgQuiz" name="Avg quiz score" fill={series[0]} radius={[4, 4, 0, 0]} stroke={surface} strokeWidth={2} />
        <Bar dataKey="onTime" name="Handed in on time" fill={series[2]} radius={[4, 4, 0, 0]} stroke={surface} strokeWidth={2} />
        <Bar dataKey="graded" name="Marked" fill={series[3]} radius={[4, 4, 0, 0]} stroke={surface} strokeWidth={2} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Six months of the department, month by month: what faculty published against
 * what students did with it. Four counts of events on one axis — the distance
 * between the "Classwork set" line and the "Submissions" line is the reading.
 */
export function ActivityTrendChart({ trend, height = 280 }) {
  const { series, grid, axis } = useChartTheme();
  const empty = trend.every(
    (m) => !m.coursework && !m.submissions && !m.quizAttempts && !m.posts,
  );
  if (empty) {
    return <NoData height={height} message="No activity recorded in the last six months." />;
  }

  const lines = [
    { key: 'coursework', name: 'Classwork set' },
    { key: 'submissions', name: 'Submissions' },
    { key: 'quizAttempts', name: 'Quiz attempts' },
    { key: 'posts', name: 'Posts' },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisProps(axis, grid)} />
        <YAxis allowDecimals={false} {...axisProps(axis, grid)} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: grid, strokeWidth: 1 }} />
        <Legend {...legendProps(axis)} />
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name}
            stroke={series[i]}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 0, fill: series[i] }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Student engagement per semester, as a share of that semester’s enrolment —
 * separate from the trend chart above rather than squeezed onto a second axis,
 * because a percentage and a count do not belong on one scale.
 */
export function SemesterEngagementChart({ semesters, height = 260 }) {
  const { series, grid, axis, surface } = useChartTheme();
  const data = semesters
    .filter((s) => s.engagementRate != null)
    .map((s) => ({ label: s.label, engagement: s.engagementRate }));
  if (!data.length) {
    return <NoData height={height} message="No enrolments to measure engagement against." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisProps(axis, grid)} />
        <YAxis domain={[0, 100]} unit="%" {...axisProps(axis, grid)} />
        <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: grid, fillOpacity: 0.25 }} />
        {/* One series, so the card's title names it and no legend box is needed. */}
        <Bar
          dataKey="engagement"
          name="Students active"
          fill={series[0]}
          radius={[4, 4, 0, 0]}
          stroke={surface}
          strokeWidth={2}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * A donut with its slices labelled on the chart, not only in the legend — the
 * relief that lets the lighter categorical steps be used on a white card.
 */
export function DonutChart({ data, height = 240, emptyMessage = 'Nothing to show yet.' }) {
  const { series, surface, axis } = useChartTheme();
  const slices = data.filter((d) => d.value > 0);
  if (!slices.length) return <NoData height={height} message={emptyMessage} />;

  const total = slices.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          innerRadius="52%"
          outerRadius="78%"
          paddingAngle={2}
          stroke={surface}
          strokeWidth={2}
          label={({ name, value }) => `${name} ${Math.round((value / total) * 100)}%`}
          labelLine={false}
          style={{ fontSize: 11, fill: axis }}
        >
          {slices.map((slice, i) => (
            <Cell key={slice.name} fill={slice.color || series[i % series.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend {...legendProps(axis)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/**
 * A labelled proportion bar — for the one-number-out-of-another facts that do
 * not need a plot at all (faculty running a classroom, work still to mark).
 */
export function ProportionBar({ label, value, total, hint, colorIndex = 0 }) {
  const { series, grid } = useChartTheme();
  const share = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <Box>
      <Flex justify="space-between" align="baseline" gap={3} mb={1.5}>
        <Text fontSize="sm" color="lmFg.body">
          {label}
        </Text>
        <Text fontSize="sm" fontWeight="600" color="lmFg.heading" fontVariantNumeric="tabular-nums">
          {value}
          <Text as="span" color="lmFg.muted" fontWeight="400">
            {' / '}
            {total}
          </Text>
        </Text>
      </Flex>
      <Box h="8px" borderRadius="full" bg={grid} overflow="hidden">
        <Box h="100%" w={`${share}%`} bg={series[colorIndex]} borderRadius="full" />
      </Box>
      {hint && (
        <Text fontSize="xs" color="lmFg.muted" mt={1}>
          {hint}
        </Text>
      )}
    </Box>
  );
}
