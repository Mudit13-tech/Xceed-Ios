/**
 * The class card, as iOS draws it.
 *
 * On a phone the old header was the desktop header with its buttons shrunk: one
 * wrapping row of icon-only circles — people, insights, leaderboard, the class
 * code, a bell, a cog — sitting under the class name. Six unlabelled targets of
 * roughly the same size and colour is a row you have to decode rather than read,
 * and the class code, the single thing a teacher opens this screen to read out
 * loud, was a 60px pill indistinguishable from the buttons beside it.
 *
 * So the card is laid out down the screen instead of across it, in the three
 * things it is actually made of:
 *
 *  - who and what: the class name, its section and room, and who teaches it;
 *  - where to go: the class-level destinations, as labelled tiles big enough to
 *    hit, sized in one equal row so they read as a set of peers;
 *  - the code: its own full-width panel, because it is a thing to be read aloud
 *    and copied, not a thing to be navigated to.
 *
 * Chrome that is neither — notification preferences, class settings — moves into
 * an overflow menu, which is where infrequent per-screen settings belong on iOS.
 *
 * What a student sees is not a greyed-out version of this. Tiles they have no
 * access to are not rendered at all: insights is a teacher's read on the class,
 * the code is a teacher's to hand out, and settings are a teacher's to change.
 * The tile row divides by however many are left, so two tiles fill the width
 * rather than leaving a gap where a third was refused.
 */
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Badge,
  Box,
  Flex,
  HStack,
  Heading,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  SimpleGrid,
  Text,
  useClipboard,
} from '@chakra-ui/react';
import { Copy, EllipsisVertical } from 'lucide-react';
import { LmIcon } from './Icon';
import NotificationPreferencesModal from './NotificationPreferencesModal';

// The two glyphs this header needs that AMS's Icon.jsx does not register.
// Drawn here, with LmIcon's own defaults, rather than added to its ICONS map:
// Icon.jsx is AMS's file, and an entry written into it is a line every sync
// has to merge around.
const LOCAL_GLYPHS = { copy: Copy, more: EllipsisVertical };

function HeaderIcon({ name, size }) {
  const Glyph = LOCAL_GLYPHS[name];
  if (!Glyph) return <LmIcon name={name} size={size} />;
  return (
    <Glyph
      size={size}
      strokeWidth={1.75}
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'text-bottom' }}
    />
  );
}

// Every interactive surface on the card is the same translucent white over the
// class colour, so the card reads as one object in whatever colour a class has
// chosen rather than as a blue card with grey controls pasted on.
const onAccentSurface = {
  bg: 'whiteAlpha.300',
  color: 'white',
  _hover: { bg: 'whiteAlpha.400', textDecoration: 'none' },
  _active: { bg: 'whiteAlpha.500' },
};

/**
 * One destination in the tile row.
 *
 * The count rides next to the icon rather than under the label because it
 * qualifies the icon — "people, four of them" — and putting it on the label line
 * made two tiles out of three taller than the third.
 */
function ClassTile({ to, icon, label, count }) {
  return (
    <Flex
      as={NavLink}
      to={to}
      direction="column"
      align="center"
      justify="center"
      gap={1}
      py={3}
      px={2}
      minH="66px"
      borderRadius="xl"
      textAlign="center"
      {...onAccentSurface}
    >
      <HStack spacing={1.5} lineHeight="1">
        <LmIcon name={icon} size={20} />
        {count != null && (
          <Text fontSize="md" fontWeight="700" lineHeight="1">
            {count}
          </Text>
        )}
      </HStack>
      <Text fontSize="xs" fontWeight="600" lineHeight="1.2" noOfLines={1}>
        {label}
      </Text>
    </Flex>
  );
}

export default function IosClassHeader({ klass, classId, isTeacher }) {
  const [prefsOpen, setPrefsOpen] = useState(false);
  const { onCopy, hasCopied } = useClipboard(klass?.code || '');

  const meta = [klass.section, klass.subject, klass.room].filter(Boolean).join(' · ');

  // Built as a list rather than written out as JSX so the grid can count them:
  // a student gets two and they share the width evenly.
  const tiles = [
    {
      key: 'people',
      to: `/learning/class/${classId}/people`,
      icon: 'people',
      label: 'People',
      count: klass.counts?.studentCount ?? 0,
    },
    isTeacher && {
      key: 'insights',
      to: `/learning/class/${classId}/insights`,
      icon: 'insights',
      label: 'Insights',
    },
    {
      key: 'leaderboard',
      to: `/learning/class/${classId}/leaderboard`,
      icon: 'leaderboard',
      label: 'Leaderboard',
    },
  ].filter(Boolean);

  return (
    <>
      <Box
        bg={klass.coverColor || '#1967d2'}
        color="lmFg.onAccent"
        borderRadius="2xl"
        px={5}
        pt={5}
        pb={4}
        mb={4}
        position="relative"
        overflow="hidden"
      >
        {/* The title and the overflow menu share a row so the menu keeps to the
            corner however many lines the class name runs to. */}
        <Flex align="flex-start" justify="space-between" gap={3}>
          <Box minW={0}>
            <Flex align="center" gap={2} wrap="wrap">
              <Heading size="lg" lineHeight="1.15" letterSpacing="-0.01em">
                {klass.name}
              </Heading>
              {klass.status === 'archived' && <Badge colorScheme="orange">Archived</Badge>}
            </Flex>
            {meta && (
              <Text fontSize="sm" fontWeight="600" opacity={0.95} mt={1.5}>
                {meta}
              </Text>
            )}
            <HStack fontSize="sm" opacity={0.85} mt={1} spacing={4} wrap="wrap">
              <Text display="flex" alignItems="center" gap={1.5} minW={0}>
                <LmIcon name="user" size={14} />
                <Box as="span" noOfLines={1}>
                  {klass.ownerName}
                </Box>
              </Text>
              <Text display="flex" alignItems="center" gap={1.5} whiteSpace="nowrap">
                <LmIcon name="coursework" size={14} />
                {klass.counts?.courseworkCount ?? 0} items
              </Text>
            </HStack>
          </Box>

          <Menu placement="bottom-end" autoSelect={false}>
            <MenuButton
              as={IconButton}
              aria-label="Class options"
              icon={<HeaderIcon name="more" size={18} />}
              size="sm"
              borderRadius="full"
              flexShrink={0}
              {...onAccentSurface}
            />
            <MenuList minW="220px" color="lmFg.body">
              <MenuItem icon={<LmIcon name="notifications" size={16} />} onClick={() => setPrefsOpen(true)}>
                Notification preferences
              </MenuItem>
              {isTeacher && (
                <MenuItem
                  as={NavLink}
                  to={`/learning/class/${classId}/settings`}
                  icon={<LmIcon name="settings" size={16} />}
                >
                  Class settings
                </MenuItem>
              )}
            </MenuList>
          </Menu>
        </Flex>

        <SimpleGrid columns={tiles.length} spacing={2.5} mt={4}>
          {tiles.map(({ key, ...tile }) => (
            <ClassTile key={key} {...tile} />
          ))}
        </SimpleGrid>

        {/* Teachers only: the code is theirs to hand out, and a student holding
            one has nobody to give it to. */}
        {isTeacher && (
          <Flex
            as="button"
            type="button"
            onClick={onCopy}
            align="center"
            justify="space-between"
            gap={3}
            w="100%"
            mt={2.5}
            px={4}
            py={3}
            borderRadius="xl"
            textAlign="left"
            aria-label={`Copy class code ${klass.code}`}
            {...onAccentSurface}
          >
            <Box minW={0}>
              <Text fontSize="10px" fontWeight="700" letterSpacing="0.14em" opacity={0.8}>
                CLASS CODE
              </Text>
              <Text fontFamily="mono" fontSize="xl" fontWeight="600" letterSpacing="0.08em" lineHeight="1.3">
                {klass.code}
              </Text>
            </Box>
            <HStack spacing={2} flexShrink={0} fontSize="sm" fontWeight="600">
              <HeaderIcon name={hasCopied ? 'check' : 'copy'} size={18} />
              <Text>{hasCopied ? 'Copied' : 'Copy'}</Text>
            </HStack>
          </Flex>
        )}
      </Box>

      <NotificationPreferencesModal
        isOpen={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        classId={classId}
        className={klass.name}
        isTeacher={isTeacher}
      />
    </>
  );
}
