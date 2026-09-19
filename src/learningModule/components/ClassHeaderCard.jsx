import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  SimpleGrid,
  Text,
} from '@chakra-ui/react';
import { FiCheck, FiCopy, FiMoreVertical } from 'react-icons/fi';

import { LmIcon } from './Icon';

/**
 * The class header, as it reads on a phone.
 *
 * The wide-screen header is one dense row — identity on the left, actions
 * pinned right — which is the right shape when there is room for it. Narrowed
 * to a phone it stopped being that: the row broke, the actions collapsed to a
 * wrap of unlabelled icon buttons, and the class name sat at the same size as
 * everything around it. A student opening a class on their phone got a strip of
 * glyphs to guess at.
 *
 * So the narrow view is its own composition rather than the wide one reflowed:
 * the class name is a heading, the three places worth going get a tile each
 * with its label spelled out, and the join code — the thing a teacher opens
 * this page to read aloud — is a panel instead of a pill.
 *
 * Only ever rendered below `md`; ClassLayout keeps the row for everything
 * above. See the note there.
 */

/** One of the three destinations, as a tile with its name under the icon. */
function HeaderTile({ to, icon, label, count, onMouseEnter }) {
  return (
    <Button
      as={NavLink}
      to={to}
      onMouseEnter={onMouseEnter}
      height="auto"
      py={3}
      px={2}
      bg="whiteAlpha.300"
      color="white"
      borderRadius="lg"
      fontWeight="500"
      _hover={{ bg: 'whiteAlpha.400', textDecoration: 'none' }}
      _active={{ bg: 'whiteAlpha.500' }}
      sx={{ '&.active': { bg: 'whiteAlpha.500' } }}
    >
      <Flex direction="column" align="center" gap={1} minW={0}>
        <Flex align="center" gap={1.5}>
          <LmIcon name={icon} size={18} />
          {count !== undefined && <Text fontSize="md" fontWeight="700">{count}</Text>}
        </Flex>
        <Text fontSize="xs" opacity={0.95} noOfLines={1}>
          {label}
        </Text>
      </Flex>
    </Button>
  );
}

export default function ClassHeaderCard({
  klass,
  classId,
  isTeacher,
  onCopyCode,
  hasCopiedCode,
  onOpenPrefs,
  onPreload,
}) {
  const meta = [klass.section, klass.subject, klass.room].filter(Boolean).join(' · ');
  // Insights is a teacher's read on the class, so the row is two tiles wide for
  // a student and three for staff rather than leaving a gap where it would be.
  const tiles = [
    {
      to: `/learning/class/${classId}/people`,
      icon: 'people',
      label: 'People',
      count: klass.counts?.studentCount ?? 0,
    },
    ...(isTeacher
      ? [{ to: `/learning/class/${classId}/insights`, icon: 'insights', label: 'Insights' }]
      : []),
    { to: `/learning/class/${classId}/leaderboard`, icon: 'leaderboard', label: 'Leaderboard' },
  ];

  return (
    <Box display={{ base: 'block', md: 'none' }}>
      <Flex align="flex-start" gap={2}>
        <Box flex="1" minW={0}>
          <Flex align="center" gap={2} wrap="wrap">
            <Heading size="lg" lineHeight="1.15">
              {klass.name}
            </Heading>
            {klass.status === 'archived' && <Badge colorScheme="orange">Archived</Badge>}
          </Flex>
          {meta && (
            <Text fontSize="sm" opacity={0.92} mt={1}>
              {meta}
            </Text>
          )}
          <Flex fontSize="sm" opacity={0.85} mt={2} gap={4} wrap="wrap">
            {klass.ownerName && (
              <Text display="flex" alignItems="center" gap={1.5} minW={0}>
                <LmIcon name="user" size={13} />
                <Box as="span" noOfLines={1}>{klass.ownerName}</Box>
              </Text>
            )}
            <Text display="flex" alignItems="center" gap={1.5} whiteSpace="nowrap">
              <LmIcon name="coursework" size={13} />
              {klass.counts?.courseworkCount ?? 0} items
            </Text>
          </Flex>
        </Box>

        {/* Notification preferences and settings were two more unlabelled icons
            in the wrap. They are both about this class rather than its work, and
            neither is opened often, so they fold into one menu. */}
        <Menu placement="bottom-end">
          <MenuButton
            as={IconButton}
            aria-label="Class options"
            icon={<FiMoreVertical />}
            size="sm"
            variant="ghost"
            color="white"
            borderRadius="full"
            _hover={{ bg: 'whiteAlpha.300' }}
            _active={{ bg: 'whiteAlpha.400' }}
          />
          <MenuList color="lmFg.body" minW="200px">
            <MenuItem
              icon={<LmIcon name="notifications" size={15} />}
              onClick={onOpenPrefs}
            >
              Notification preferences
            </MenuItem>
            {isTeacher && (
              <MenuItem
                as={NavLink}
                to={`/learning/class/${classId}/settings`}
                icon={<LmIcon name="settings" size={15} />}
              >
                Class settings
              </MenuItem>
            )}
          </MenuList>
        </Menu>
      </Flex>

      <SimpleGrid columns={tiles.length} spacing={2} mt={4}>
        {tiles.map((tile) => (
          <HeaderTile key={tile.label} {...tile} onMouseEnter={onPreload} />
        ))}
      </SimpleGrid>

      {/* The code a teacher reads out to a room. It was a pill among the other
          buttons, at the same weight as everything else; here it is the one
          thing on the card that is meant to be read from a distance. */}
      {isTeacher && klass.code && (
        <Flex
          mt={2}
          bg="whiteAlpha.300"
          borderRadius="lg"
          px={4}
          py={3}
          align="center"
          justify="space-between"
          gap={3}
        >
          <Box minW={0}>
            <Text fontSize="xs" fontWeight="700" letterSpacing="wider" opacity={0.85}>
              CLASS CODE
            </Text>
            <Text fontFamily="mono" fontSize="2xl" fontWeight="700" letterSpacing="wider" noOfLines={1}>
              {klass.code}
            </Text>
          </Box>
          <Button
            onClick={onCopyCode}
            size="sm"
            variant="ghost"
            color="white"
            flexShrink={0}
            leftIcon={hasCopiedCode ? <FiCheck /> : <FiCopy />}
            _hover={{ bg: 'whiteAlpha.400' }}
            _active={{ bg: 'whiteAlpha.500' }}
          >
            {hasCopiedCode ? 'Copied' : 'Copy'}
          </Button>
        </Flex>
      )}
    </Box>
  );
}
