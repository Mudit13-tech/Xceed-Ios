// The shell around the head-of-department timetable pages.
//
// A sibling of the timetable coordinator's pages rather than a mode of them,
// for the reason HodLayout gives about the attendance module: every page here
// is a read of what the department's coordinator produced, not an operation on
// it, and a shared shell with a read-only flag is how that distinction gets
// lost. The server is the real boundary — `timetableHodReadAccess` admits the
// role, and `refuseTimetableHodWrites` rejects anything that is not a read.

import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Text,
} from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';

// One entry for now. The list exists so the next page added here appears in
// the bar rather than being reachable only by typing its URL.
const TIMETABLE_HOD_MENUS = [
  { route: '/timetable-hod/dashboard', label: 'Department Load', exact: true },
];

export default function TimetableHodLayout() {
  const navigate = useNavigate();

  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="white" borderBottomWidth="1px" borderColor="gray.200" px={{ base: 3, md: 6 }} py={3}>
        <Flex
          align={{ base: 'flex-start', md: 'center' }}
          justify="space-between"
          direction={{ base: 'column', md: 'row' }}
          gap={3}
          maxW="8xl"
          mx="auto"
        >
          <HStack spacing={3}>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<ArrowBackIcon />}
              onClick={() => navigate('/userroles')}
            >
              Roles
            </Button>
            <Box>
              <Heading as="h2" size="sm">
                Timetable — Head of Department
              </Heading>
              <Text fontSize="xs" color="gray.500">
                Read-only
              </Text>
            </Box>
          </HStack>

          <HStack spacing={2} flexWrap="wrap">
            {TIMETABLE_HOD_MENUS.map((item) => (
              <Button
                key={item.route}
                as={NavLink}
                to={item.route}
                end={item.exact}
                size="sm"
                variant="ghost"
                _activeLink={{ bg: 'blue.50', color: 'blue.700', fontWeight: 'semibold' }}
              >
                {item.label}
              </Button>
            ))}
          </HStack>
        </Flex>
      </Box>

      <Outlet />
    </Box>
  );
}
