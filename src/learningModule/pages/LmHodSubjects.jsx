import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Flex,
  Link as RouterLinkStyle,
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
  VStack,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

import lmApi from '../api/lmApi';
import { csvFilename, exportCsv } from '../csv';
import { EmptyState, ErrorState, Loading, SectionCard, StatTile } from '../components/common';

/**
 * Subjects & faculty — what the department has been allocated to teach.
 *
 * The HOD dashboard shows what is happening inside the learning module. This
 * shows what the *timetable* says the department teaches, and marks which of it
 * has a classroom here at all. The two columns side by side are the point: a
 * theory subject with no classroom is the one nobody has opened.
 *
 * Counting is by theory subjects. A department is planned around its theory
 * load, and adding labs and tutorials into one total produces a number that
 * cannot be compared with anything — so the tiles count theory, and the filter
 * is how you look at the rest.
 *
 * Every table here downloads as CSV exactly as displayed: same rows, same
 * order, same filter. A number that has to be retyped to be used is a number
 * that gets copied wrong.
 */

const TYPE_STYLE = {
  theory: { colorScheme: 'blue', label: 'Theory' },
  lab: { colorScheme: 'purple', label: 'Lab' },
  tutorial: { colorScheme: 'green', label: 'Tutorial' },
  others: { colorScheme: 'gray', label: 'Other' },
};

/** A count that shows 0 in a muted colour, so what exists stands out. */
function CountCell({ value }) {
  return (
    <Text fontSize="sm" color={value > 0 ? 'lmFg.body' : 'lmFg.subtle'} fontVariantNumeric="tabular-nums">
      {value}
    </Text>
  );
}

export default function LmHodSubjects() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dept, setDept] = useState('');
  const [session, setSession] = useState('');
  // Which kinds of subject the table shows. "theory" by default, because that
  // is what the counts above it are about; "all" is one click away.
  const [type, setType] = useState('theory');

  const load = useCallback(async (deptValue, sessionValue) => {
    setLoading(true);
    setError(null);
    try {
      setData(await lmApi.getHodSubjects({ dept: deptValue, session: sessionValue }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(dept, session);
  }, [load, dept, session]);

  // Memoised so the filtered view below is not rebuilt on every render: the
  // fallback `[]` is a new array each time and would defeat it.
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const visibleRows = useMemo(
    () => (type === 'all' ? rows : rows.filter((row) => row.type === type)),
    [rows, type],
  );

  if (loading) return <Loading label="Loading subjects…" />;
  if (error) return <ErrorState error={error} onRetry={() => load(dept, session)} />;

  const { filters = {}, totals = {}, faculty = [], scope = {} } = data;
  const deptLocked = Boolean(scope.locked) && (filters.departments || []).length <= 1;
  const typeOptions = [
    { key: 'all', label: 'All' },
    ...(filters.types || []),
  ];

  const exportSubjects = () => {
    exportCsv(
      csvFilename('subjects', data.dept, data.session, type),
      [
        'Faculty', 'Designation', 'Subject code', 'Subject', 'Abbreviation',
        'Semester', 'Type', 'Periods/week', 'Credits', 'Students',
        'Rooms', 'Learning module classroom', 'Classroom students',
      ],
      visibleRows.map((row) => [
        row.faculty,
        row.designation,
        row.subjectCode,
        row.subjectName,
        row.subject,
        row.semester,
        TYPE_STYLE[row.type]?.label || row.type,
        row.slots,
        row.credits ?? '',
        row.studentCount ?? '',
        (row.rooms || []).join('; '),
        row.lmClass ? row.lmClass.name : 'None',
        row.lmClass ? row.lmClass.studentCount : '',
      ]),
    );
  };

  const exportFaculty = () => {
    exportCsv(
      csvFilename('faculty-load', data.dept, data.session),
      [
        'Faculty', 'Designation', 'Theory', 'Lab', 'Tutorial', 'Other',
        'All subjects', 'Periods/week', 'Semesters', 'With classroom',
        'Theory without classroom',
      ],
      faculty.map((member) => [
        member.name,
        member.designation,
        member.counts.theory,
        member.counts.lab,
        member.counts.tutorial,
        member.counts.others,
        member.counts.total,
        member.slots,
        (member.semesters || []).join('; '),
        member.lmClasses,
        member.missingClassrooms,
      ]),
    );
  };

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
          <Box>
            <Text fontSize="xl" fontWeight="700" color="lmFg.heading">
              Subjects &amp; faculty
            </Text>
            <Text fontSize="sm" color="lmFg.muted">
              {data.dept ? `${data.dept} — ` : ''}
              what the timetable allocates to each member of the department, and
              which of it has a classroom in the learning module.
            </Text>
          </Box>
          <RouterLinkStyle as={RouterLink} to="/learning/hod-dashboard" fontSize="sm" color="blue.600">
            ← HOD dashboard
          </RouterLinkStyle>
        </Flex>
      </Box>

      {/* One filter bar for the page. Department and session decide what is
          read; the type filter decides what the subject table shows. */}
      <Flex
        justify="space-between"
        align="center"
        gap={3}
        wrap="wrap"
        bg="lmBg.surface"
        borderWidth="1px"
        borderColor="lmBorder.base"
        borderRadius="lg"
        px={4}
        py={3}
      >
        <Flex gap={2} align="center" wrap="wrap">
          {deptLocked ? (
            <Badge colorScheme="purple" borderRadius="full" px={3} py={1}>
              {data.dept}
            </Badge>
          ) : (
            <Select
              size="sm"
              maxW="260px"
              value={dept || data.dept}
              onChange={(e) => setDept(e.target.value)}
            >
              {(filters.departments || []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          )}
          <Select
            size="sm"
            maxW="200px"
            value={session || data.session}
            onChange={(e) => setSession(e.target.value)}
          >
            {(filters.sessions || []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Flex>
        <ButtonGroup size="sm" isAttached variant="outline">
          {typeOptions.map((option) => (
            <Button
              key={option.key}
              onClick={() => setType(option.key)}
              colorScheme={type === option.key ? 'blue' : 'gray'}
              variant={type === option.key ? 'solid' : 'outline'}
            >
              {option.label}
            </Button>
          ))}
        </ButtonGroup>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        <StatTile
          label="Theory subjects"
          value={totals.theory ?? 0}
          hint={`${totals.subjects ?? 0} allocations of every kind`}
          accent="blue.500"
        />
        <StatTile
          label="Faculty teaching"
          value={totals.teaching ?? 0}
          hint={`of ${totals.faculty ?? 0} in the department`}
          accent="purple.500"
        />
        <StatTile
          label="With a classroom"
          value={totals.withClassroom ?? 0}
          hint="subjects opened in the learning module"
          accent="green.500"
        />
        <StatTile
          label="Theory, no classroom"
          value={totals.theoryWithoutClassroom ?? 0}
          hint="nothing opened in the module yet"
          accent="orange.500"
        />
      </SimpleGrid>

      <SectionCard
        title="Load per faculty member"
        subtitle="Everyone in the department, including anyone the timetable allocated nothing to."
        action={
          <Button size="sm" variant="outline" onClick={exportFaculty} isDisabled={!faculty.length}>
            Download CSV
          </Button>
        }
      >
        {faculty.length === 0 ? (
          <EmptyState
            icon="attendance"
            title="No faculty found"
            description="This department has no faculty records in the timetable."
          />
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Faculty</Th>
                  <Th>Designation</Th>
                  <Th isNumeric>Theory</Th>
                  <Th isNumeric>Lab</Th>
                  <Th isNumeric>Tutorial</Th>
                  <Th isNumeric>Other</Th>
                  <Tooltip label="Periods a week across every allocation" placement="top">
                    <Th isNumeric cursor="help">Periods</Th>
                  </Tooltip>
                  <Th>Semesters</Th>
                  <Tooltip label="Allocations that have a classroom in the learning module" placement="top">
                    <Th isNumeric cursor="help">Classrooms</Th>
                  </Tooltip>
                  <Tooltip label="Theory subjects with nothing opened in the module" placement="top">
                    <Th isNumeric cursor="help">To open</Th>
                  </Tooltip>
                </Tr>
              </Thead>
              <Tbody>
                {faculty.map((member) => (
                  <Tr key={member.name} _hover={{ bg: 'lmBg.hover' }}>
                    <Td>
                      <Text fontSize="sm" fontWeight="600" color="lmFg.heading">
                        {member.name}
                      </Text>
                      {member.email && (
                        <Text fontSize="xs" color="lmFg.muted">
                          {member.email}
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Text fontSize="sm" color="lmFg.body">{member.designation || '—'}</Text>
                    </Td>
                    <Td isNumeric><CountCell value={member.counts.theory} /></Td>
                    <Td isNumeric><CountCell value={member.counts.lab} /></Td>
                    <Td isNumeric><CountCell value={member.counts.tutorial} /></Td>
                    <Td isNumeric><CountCell value={member.counts.others} /></Td>
                    <Td isNumeric><CountCell value={member.slots} /></Td>
                    <Td>
                      <Text fontSize="sm" color="lmFg.body">
                        {(member.semesters || []).join(', ') || '—'}
                      </Text>
                    </Td>
                    <Td isNumeric><CountCell value={member.lmClasses} /></Td>
                    <Td isNumeric>
                      <Text
                        fontSize="sm"
                        fontVariantNumeric="tabular-nums"
                        color={member.missingClassrooms > 0 ? 'orange.500' : 'lmFg.subtle'}
                        fontWeight={member.missingClassrooms > 0 ? '600' : '400'}
                      >
                        {member.missingClassrooms}
                      </Text>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </SectionCard>

      <SectionCard
        title="Subject allocations"
        subtitle={
          type === 'all'
            ? `Every allocation on the timetable · ${visibleRows.length} row${visibleRows.length !== 1 ? 's' : ''}`
            : `${TYPE_STYLE[type]?.label || type} only · ${visibleRows.length} row${visibleRows.length !== 1 ? 's' : ''}`
        }
        action={
          <Button size="sm" variant="outline" onClick={exportSubjects} isDisabled={!visibleRows.length}>
            Download CSV
          </Button>
        }
      >
        {visibleRows.length === 0 ? (
          <EmptyState
            icon="subjects"
            title="Nothing allocated"
            description={
              rows.length
                ? 'No subject of this kind is on the timetable for this session.'
                : 'The timetable has no slots for this department and session yet.'
            }
          />
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Faculty</Th>
                  <Th>Subject</Th>
                  <Th>Sem</Th>
                  <Th>Type</Th>
                  <Tooltip label="Periods a week in the timetable" placement="top">
                    <Th isNumeric cursor="help">Periods</Th>
                  </Tooltip>
                  <Th isNumeric>Credits</Th>
                  <Th isNumeric>Students</Th>
                  <Th>Learning module</Th>
                </Tr>
              </Thead>
              <Tbody>
                {visibleRows.map((row) => {
                  const style = TYPE_STYLE[row.type] || TYPE_STYLE.others;
                  return (
                    <Tr
                      key={`${row.faculty}|${row.subject}|${row.semester}|${row.type}`}
                      _hover={{ bg: 'lmBg.hover' }}
                    >
                      <Td>
                        <Text fontSize="sm" color="lmFg.body">{row.faculty}</Text>
                        {!row.facultyKnown && (
                          // The timetable's spelling matched nobody in the
                          // department's faculty list — worth saying, because it
                          // is usually a typo in one of the two places.
                          <Text fontSize="xs" color="lmFg.muted">
                            not in the faculty list
                          </Text>
                        )}
                      </Td>
                      <Td>
                        <Text fontSize="sm" fontWeight="600" color="lmFg.heading">
                          {row.subjectName}
                        </Text>
                        <Text fontSize="xs" color="lmFg.muted">
                          {row.subjectCode ? `${row.subjectCode} · ` : ''}
                          {row.subject}
                        </Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm" color="lmFg.body">{row.semester || '—'}</Text>
                      </Td>
                      <Td>
                        <Tooltip
                          label={row.rawType ? `Timetable subject type: ${row.rawType}` : 'No subject record found for this slot'}
                          placement="top"
                        >
                          <Badge colorScheme={style.colorScheme} borderRadius="full" px={2} fontSize="xs">
                            {style.label}
                          </Badge>
                        </Tooltip>
                      </Td>
                      <Td isNumeric><CountCell value={row.slots} /></Td>
                      <Td isNumeric>
                        <Text fontSize="sm" color="lmFg.body" fontVariantNumeric="tabular-nums">
                          {row.credits ?? '—'}
                        </Text>
                      </Td>
                      <Td isNumeric>
                        <Text fontSize="sm" color="lmFg.body" fontVariantNumeric="tabular-nums">
                          {row.studentCount ?? '—'}
                        </Text>
                      </Td>
                      <Td>
                        {row.lmClass ? (
                          <>
                            <RouterLinkStyle
                              as={RouterLink}
                              to={`/learning/class/${row.lmClass._id}`}
                              color="blue.600"
                              fontWeight="600"
                              fontSize="sm"
                            >
                              {row.lmClass.name}
                            </RouterLinkStyle>
                            <Text fontSize="xs" color="lmFg.muted">
                              {row.lmClass.studentCount} student
                              {row.lmClass.studentCount === 1 ? '' : 's'}
                            </Text>
                          </>
                        ) : (
                          <Text fontSize="sm" color="lmFg.subtle">no classroom</Text>
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

      <Box>
        <Text fontSize="xs" color="lmFg.subtle">
          Allocations come from the department’s timetable for {data.session || 'this session'};
          the subject type, code and credits come from the subject master, and a slot whose
          subject has no master record is typed “Other”. A faculty name is matched to the
          department’s faculty list exactly — a name spelled differently in the two places shows
          as “not in the faculty list” rather than being attached to somebody else. Classrooms are
          matched by subject code and name, so a classroom named after something else will not be
          found here even if it exists.
        </Text>
      </Box>
    </VStack>
  );
}
