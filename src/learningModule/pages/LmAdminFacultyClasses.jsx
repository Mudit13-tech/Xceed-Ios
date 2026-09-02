import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Flex,
  Link as RouterLinkStyle,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Link as RouterLink, useParams } from 'react-router-dom';

import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard, StatTile } from '../components/common';
import { relativeTime } from '../format';

/**
 * All classes owned by one faculty member, shown to an lm-admin.
 *
 * The entry point is the class-count link on the faculty directory page:
 * clicking the number lands here rather than requiring the administrator to
 * enrol in each class to see what is inside it. The class cards link into the
 * class stream so the administrator can look at anything that seems off.
 */

const STATUS_STYLE = {
  active: { colorScheme: 'green', label: 'Active' },
  archived: { colorScheme: 'gray', label: 'Archived' },
  completed: { colorScheme: 'blue', label: 'Completed' },
};

function ClassCard({ cls }) {
  const status = STATUS_STYLE[cls.status] || { colorScheme: 'gray', label: cls.status };
  return (
    <Box
      as={RouterLink}
      to={`/learning/class/${cls._id}`}
      borderWidth="1px"
      borderColor="lmBorder.default"
      borderRadius="lg"
      p={4}
      _hover={{ borderColor: 'blue.400', boxShadow: 'sm', textDecoration: 'none' }}
      transition="all 0.15s"
      display="block"
    >
      <Flex justify="space-between" align="flex-start" gap={2} mb={2}>
        <Text fontWeight="700" fontSize="sm" noOfLines={2} color="lmFg.heading">
          {cls.name}
        </Text>
        <Badge
          colorScheme={status.colorScheme}
          borderRadius="full"
          px={2}
          flexShrink={0}
          fontSize="xs"
        >
          {status.label}
        </Badge>
      </Flex>

      {cls.subject && (
        <Text fontSize="xs" color="lmFg.body" mb={1}>
          {cls.subjectCode ? `${cls.subjectCode} — ` : ''}
          {cls.subject}
        </Text>
      )}

      <Flex gap={3} wrap="wrap" mt={2}>
        {cls.semester && (
          <Text fontSize="xs" color="lmFg.muted">
            Sem {cls.semester}
          </Text>
        )}
        {cls.session && (
          <Text fontSize="xs" color="lmFg.muted">
            {cls.session}
          </Text>
        )}
        {cls.section && (
          <Text fontSize="xs" color="lmFg.muted">
            Section {cls.section}
          </Text>
        )}
      </Flex>

      <Flex justify="space-between" align="center" mt={3}>
        <Text fontSize="xs" color="lmFg.muted">
          {cls.studentCount} student{cls.studentCount !== 1 ? 's' : ''}
        </Text>
        <Text fontSize="xs" color="lmFg.subtle">
          {relativeTime(cls.created_at)}
        </Text>
      </Flex>
    </Box>
  );
}

export default function LmAdminFacultyClasses() {
  const { facultyId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await lmApi.adminGetFacultyClasses(facultyId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [facultyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Loading classes..." />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  const { faculty, classes } = data;
  const byStatus = classes.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
          <Box>
            <Text fontSize="xl" fontWeight="700" color="lmFg.heading">
              {faculty.name || faculty.email}&apos;s Classes
            </Text>
            <Text fontSize="sm" color="lmFg.muted">
              {faculty.email}
              {faculty.dept ? ` · ${faculty.dept}` : ''}
            </Text>
          </Box>
          <RouterLinkStyle
            as={RouterLink}
            to="/learning/lm-admin/faculty"
            fontSize="sm"
            color="blue.600"
          >
            ← Faculty directory
          </RouterLinkStyle>
        </Flex>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        <StatTile label="Total classes" value={classes.length} accent="blue.500" />
        <StatTile label="Active" value={byStatus.active || 0} accent="green.500" />
        <StatTile label="Completed" value={byStatus.completed || 0} accent="teal.500" />
        <StatTile label="Archived" value={byStatus.archived || 0} accent="gray.400" />
      </SimpleGrid>

      <SectionCard
        title="Classes"
        subtitle={
          classes.length === 0
            ? 'No classes yet.'
            : `${classes.length} class${classes.length !== 1 ? 'es' : ''}, most recent first.`
        }
      >
        {classes.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No classes"
            description="This faculty member has not created any classes yet."
          />
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
            {classes.map((cls) => (
              <ClassCard key={cls._id} cls={cls} />
            ))}
          </SimpleGrid>
        )}
      </SectionCard>
    </VStack>
  );
}
