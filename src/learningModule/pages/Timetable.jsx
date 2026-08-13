import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Box, Flex, Heading, Text } from '@chakra-ui/react';
import { SectionCard } from '../components/common';
import TimetableWidget from '../components/TimetableWidget';

export default function Timetable() {
  const { me } = useOutletContext();

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
        <Box>
          <Heading size="lg">Timetable</Heading>
          <Text color="gray.500" fontSize="sm">
            Your weekly schedule of classes.
          </Text>
        </Box>
      </Flex>

      <Box mb={5}>
        <SectionCard title="Weekly Timetable">
          <TimetableWidget me={me} />
        </SectionCard>
      </Box>
    </Box>
  );
}
