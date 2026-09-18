/**
 * The "Upcoming" panel at the top of a class stream.
 *
 * On desktop this is a sidebar column with room to spare, so it spells the
 * situation out over three lines and offers a way into the class material.
 *
 * On iOS the same card sits above the stream at full width, where those three
 * lines are three lines of vertical budget spent saying that nothing is due.
 * The state itself is the whole message, so it collapses to one: what is
 * happening, and the one place to go if you want the detail. The material
 * button goes with it — on the phone the Material tab is two centimetres up the
 * screen, and a second route to it is furniture.
 *
 * Both layouts live here so the stream renders `<UpcomingCard />` and nothing
 * else has to know there are two of them.
 */
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Heading, Text } from '@chakra-ui/react';
import { isIosApp } from '../../mobile/platform';

const IOS = isIosApp();

const cardStyles = {
  bg: 'lmBg.surface',
  borderWidth: '1px',
  borderColor: 'lmBorder.base',
  borderRadius: 'lg',
};

export default function UpcomingCard({ classId }) {
  if (IOS) {
    return (
      <Box {...cardStyles} px={4} py={3.5} mb={4}>
        <Heading size="xs" color="lmFg.body" mb={1}>
          Upcoming
        </Heading>
        <Text fontSize="sm" color="lmFg.muted">
          No work due soon{' · '}
          <Text as={RouterLink} to="/learning/todo" color="blue.600" fontWeight="600" textDecoration="underline">
            To-do
          </Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box {...cardStyles} p={4} mb={4}>
      <Heading size="xs" mb={3} color="lmFg.body">
        Upcoming
      </Heading>
      <Text fontSize="sm" color="lmFg.muted">
        Track due dates on the{' '}
        <Text as={RouterLink} to="/learning/todo" color="blue.600" textDecoration="underline">
          To-do page
        </Text>
        .
      </Text>
      <Button as={RouterLink} to={`/learning/class/${classId}/material`} size="sm" mt={3} w="100%" variant="outline">
        View class material
      </Button>
    </Box>
  );
}
