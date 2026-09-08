import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Center,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  SimpleGrid,
  Skeleton,
  SkeletonText,
  Spinner,
  Text,
  Tooltip,
  useClipboard,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { formatDateTime, relativeTime } from '../format';
import { LmIcon } from './Icon';

/**
 * The text colour a bare-button control has to state for itself.
 *
 * Chakra renders MenuItem and AccordionButton as plain `<button>`s and its
 * theme sets no colour on them, so they take whatever they inherit — except a
 * global `button { color: #fff }` in timetableadmin/Timetable.css matches the
 * element directly, and a matched rule beats an inherited value however far
 * away it was written. The result is white text on a white menu. Spread this
 * onto any such control that is not already saying its own colour.
 */
export const buttonTextStyles = { color: 'lmFg.heading' };

/** Consistent loading state for every panel in the module. */
export function Loading({ label = 'Loading…', minH = '200px' }) {
  return (
    <Center minH={minH} flexDirection="column" gap={3}>
      <Spinner thickness="3px" speed="0.7s" color="blue.500" size="lg" />
      <Text color="lmFg.muted" fontSize="sm">
        {label}
      </Text>
    </Center>
  );
}

/**
 * The refusals a user can act on, keyed by the `code` the API sends alongside a
 * 403 (see server middleware/lmAuth.js loadClass). They are not failures: there
 * is nothing to retry, and "Something went wrong" would hide the one thing the
 * user needs to know — whether their account lacks the role, or they are simply
 * not enrolled in this subject.
 */
const ACCESS_DENIED = {
  ROLE_REQUIRED: { icon: 'locked', title: 'You do not have the necessary role for these pages' },
  NOT_ENROLLED: { icon: 'material', title: 'You do not have access to this subject' },
  JOIN_PENDING: { icon: 'pending', title: 'Waiting for your teacher to approve you' },
  // A teacher-paced tutorial is entered in the room. Missing the session is not
  // something the student can retry their way out of, so it reads as a closed
  // door rather than a failure.
  NOT_JOINED: { icon: 'exit', title: 'This tutorial opens during the live session' },
};

export const accessDeniedOf = (error) =>
  error?.status === 403 ? ACCESS_DENIED[error?.payload?.code] || null : null;

export function ErrorState({ error, onRetry }) {
  if (!error) return null;

  // The wording itself stays server-side, so it can name the subject and stay
  // in step with the rule that produced it.
  const denied = accessDeniedOf(error);
  if (denied) {
    return (
      <Box
        my={4}
        p={5}
        bg="lmBg.surface"
        borderWidth="1px"
        borderColor="lmHue.orange200"
        borderLeftWidth="4px"
        borderLeftColor="orange.400"
        borderRadius="lg"
      >
        <Flex align="flex-start" gap={4}>
          <Box color="orange.500" pt={0.5}>
            <LmIcon name={denied.icon} size={24} />
          </Box>
          <Box>
            <Heading size="sm" color="lmFg.heading">
              {denied.title}
            </Heading>
            <Text fontSize="sm" color="lmFg.subtle" mt={2}>
              {error.message}
            </Text>
          </Box>
        </Flex>
      </Box>
    );
  }

  return (
    <Alert status="error" borderRadius="md" my={4} alignItems="flex-start">
      <AlertIcon />
      <Box>
        <Text fontWeight="600">{error.message || 'Something went wrong.'}</Text>
        {onRetry && (
          <Text
            as="button"
            onClick={onRetry}
            mt={1}
            fontSize="sm"
            textDecoration="underline"
            color="lmHue.red700"
          >
            Try again
          </Text>
        )}
      </Box>
    </Alert>
  );
}

/**
 * `icon` is a name from the module's icon set (see components/Icon.jsx), drawn
 * in the muted body colour so it frames the message rather than competing with
 * it — an empty state is a signpost, not an illustration.
 */
export function EmptyState({ icon = 'empty', title, description, action }) {
  return (
    <Center flexDirection="column" py={12} px={6} textAlign="center" gap={2}>
      <Box color="lmFg.muted" mb={1}>
        <LmIcon name={icon} size={32} strokeWidth={1.5} />
      </Box>
      <Heading size="sm" color="lmFg.body">
        {title}
      </Heading>
      {description && (
        <Text color="lmFg.muted" fontSize="sm" maxW="420px">
          {description}
        </Text>
      )}
      {action && <Box pt={3}>{action}</Box>}
    </Center>
  );
}

export function SectionCard({ title, subtitle, action, children, ...rest }) {
  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      p={5}
      {...rest}
    >
      {(title || action) && (
        <Flex justify="space-between" align="flex-start" mb={subtitle ? 1 : 4} gap={3}>
          <Box>
            {title && (
              <Heading size="sm" color="lmFg.heading">
                {title}
              </Heading>
            )}
            {subtitle && (
              <Text fontSize="xs" color="lmFg.muted" mt={1}>
                {subtitle}
              </Text>
            )}
          </Box>
          {action}
        </Flex>
      )}
      {subtitle && <Box mb={4} />}
      {children}
    </Box>
  );
}

export function StatTile({ label, value, hint, accent = 'blue.500' }) {
  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      p={4}
    >
      <Text
        fontSize="xs"
        textTransform="uppercase"
        letterSpacing="wide"
        color="lmFg.muted"
      >
        {label}
      </Text>

      <Text
        fontSize="2xl"
        fontWeight="700"
        color={accent}
        lineHeight="1.2"
        mt={1}
      >
        {value ?? '—'}
      </Text>

      {hint && (
        <Text fontSize="xs" color="lmFg.muted" mt={1}>
          {hint}
        </Text>
      )}
    </Box>
  );
}

export function StatTileSkeleton() {
  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      p={4}
      data-testid="stat-tile-skeleton"
    >
      <Skeleton height="12px" width="60%" borderRadius="sm" mb={3} />
      <Skeleton height="28px" width="40%" borderRadius="md" mb={2} />
      <Skeleton height="10px" width="50%" borderRadius="sm" />
    </Box>
  );
}

export function ClassCardSkeleton() {
  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      overflow="hidden"
      data-testid="class-card-skeleton"
    >
      <Box p={5} pb={4} bg="lmBg.track">
        <Skeleton height="22px" width="75%" borderRadius="md" mb={2} />
        <Skeleton height="14px" width="45%" borderRadius="sm" />
      </Box>
      <Box p={5}>
        <Skeleton height="14px" width="60%" borderRadius="sm" mb={4} />
        <HStack spacing={4}>
          <Skeleton height="14px" width="50px" borderRadius="sm" />
          <Skeleton height="14px" width="50px" borderRadius="sm" />
          <Skeleton height="14px" width="60px" borderRadius="sm" />
        </HStack>
      </Box>
    </Box>
  );
}

export function ClassCardGridSkeleton({ count = 6 }) {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5} data-testid="class-card-grid-skeleton">
      {Array.from({ length: count }).map((_, index) => (
        <ClassCardSkeleton key={index} />
      ))}
    </SimpleGrid>
  );
}

/**
 * Copies an in-app route as a full, shareable URL. The stored value is absolute
 * because the link is meant to leave the app — pasted into a chat, an email or
 * a class announcement — where a bare "/learning/…" path is useless.
 */
export function CopyLinkButton({ to, label = 'Copy link', copiedLabel = 'Link copied!', ...rest }) {
  const url = typeof window === 'undefined' ? to : new URL(to, window.location.origin).href;
  const { onCopy, hasCopied } = useClipboard(url);
  return (
    <Tooltip label={hasCopied ? copiedLabel : url} placement="top">
      <Button size="sm" variant="outline" onClick={onCopy} {...rest}>
        <LmIcon name={hasCopied ? 'check' : 'link'} size={14} style={{ marginRight: 6 }} />
        {hasCopied ? 'Copied' : label}
      </Button>
    </Tooltip>
  );
}

/**
 * Theme-colour swatches. The selected state is drawn with a ring (box-shadow)
 * and a tick rather than a border width, so the choice reads at a glance and
 * does not depend on the global border-style reset.
 */
export function ColorPicker({ value, options, onChange, label = 'colour' }) {
  return (
    <HStack spacing={3} flexWrap="wrap">
      {options.map((color) => {
        const selected = value === color;
        return (
          <Box
            key={color}
            as="button"
            type="button"
            aria-label={`Use ${label} ${color}`}
            aria-pressed={selected}
            w="32px"
            h="32px"
            borderRadius="full"
            bg={color}
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="lmFg.onAccent"
            fontSize="sm"
            fontWeight="700"
            lineHeight="1"
            transition="transform 0.12s ease, box-shadow 0.12s ease"
            transform={selected ? 'scale(1.15)' : 'none'}
            boxShadow={
              selected
                ? `0 0 0 2px #fff, 0 0 0 4px ${color}`
                : 'inset 0 0 0 1px rgba(0, 0, 0, 0.15)'
            }
            _hover={{ transform: selected ? 'scale(1.15)' : 'scale(1.1)' }}
            _focusVisible={{ outline: '2px solid', outlineColor: 'blue.500', outlineOffset: '2px' }}
            onClick={() => onChange(color)}
          >
            {selected ? '✓' : ''}
          </Box>
        );
      })}
    </HStack>
  );
}

/** Miniature of the dashboard class card, so the theme colour is visible while picking it. */
export function ClassCardPreview({ color, title, subtitle }) {
  return (
    <Box borderWidth="1px" borderColor="lmBorder.base" borderRadius="lg" overflow="hidden">
      <Box bg={color} px={4} py={3} color="lmFg.onAccent" transition="background-color 0.15s ease">
        <Text fontWeight="700" noOfLines={1}>
          {title}
        </Text>
        <Text fontSize="xs" opacity={0.9} noOfLines={1}>
          {subtitle || ' '}
        </Text>
      </Box>
    </Box>
  );
}

const STATE_STYLES = {
  assigned: { colorScheme: 'gray', label: 'Assigned' },
  turned_in: { colorScheme: 'green', label: 'Turned in' },
  returned: { colorScheme: 'blue', label: 'Returned' },
  reclaimed: { colorScheme: 'orange', label: 'Returned for edits' },
  draft: { colorScheme: 'gray', label: 'Draft' },
  scheduled: { colorScheme: 'purple', label: 'Scheduled' },
  published: { colorScheme: 'green', label: 'Published' },
};

export function StateBadge({ state, late }) {
  const style = STATE_STYLES[state] || { colorScheme: 'gray', label: state };
  return (
    <Flex gap={1} align="center" display="inline-flex">
      <Badge colorScheme={style.colorScheme} borderRadius="full" px={2} fontSize="0.7rem">
        {style.label}
      </Badge>
      {late && (
        <Badge colorScheme="red" borderRadius="full" px={2} fontSize="0.7rem">
          Late
        </Badge>
      )}
    </Flex>
  );
}

/**
 * A deadline that counts down rather than sitting there as a date.
 *
 * "Due 14 Aug, 23:59" is a date a student has to do arithmetic on. A clock that
 * says "4h 12m left" is the thing they actually want to know, and it is the
 * last hour — where this switches to seconds and turns red — that the format
 * exists for.
 *
 * The tick rate follows the urgency: once a second under the last hour, once a
 * minute otherwise. A class list can hold thirty of these, and thirty
 * per-second timers to redraw "in 6 days" would be pure waste.
 */
export function DeadlineCountdown({ dueDate, prefix = 'Due in', size = 'sm', ...rest }) {
  const target = dueDate ? new Date(dueDate).getTime() : null;
  const [remaining, setRemaining] = useState(() => (target ? target - Date.now() : null));

  useEffect(() => {
    if (!target) {
      setRemaining(null);
      return undefined;
    }
    const tick = () => setRemaining(target - Date.now());
    tick();
    // Re-armed each tick rather than a fixed interval, so crossing into the
    // last hour speeds it up without waiting for a remount.
    let timer = null;
    const schedule = () => {
      const left = target - Date.now();
      timer = setTimeout(() => {
        tick();
        schedule();
      }, Math.abs(left) < 3600_000 ? 1000 : 60_000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [target]);

  if (!target || remaining === null) return null;

  const overdue = remaining < 0;
  const left = Math.abs(remaining);
  const days = Math.floor(left / 864e5);
  const hours = Math.floor((left % 864e5) / 36e5);
  const minutes = Math.floor((left % 36e5) / 6e4);
  const seconds = Math.floor((left % 6e4) / 1000);

  let text;
  if (days > 0) text = `${days}d ${hours}h`;
  else if (hours > 0) text = `${hours}h ${minutes}m`;
  else if (minutes > 0) text = `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  else text = `${seconds}s`;

  // Urgency in the colour, so a glance down a list finds the one closing today.
  const scheme = overdue ? 'red' : left < 36e5 ? 'red' : left < 864e5 ? 'orange' : 'gray';

  return (
    <Tooltip label={`Deadline: ${formatDateTime(dueDate)}`}>
      <Badge
        colorScheme={scheme}
        borderRadius="full"
        px={2}
        fontSize={size === 'xs' ? '0.65rem' : '0.75rem'}
        fontVariantNumeric="tabular-nums"
        {...rest}
      >
        {overdue ? `Overdue by ${text}` : `${prefix} ${text}`}
      </Badge>
    </Tooltip>
  );
}

export function DueBadge({ dueDate, isTeacher = false }) {
  if (!dueDate) {
    return (
      <Text fontSize="xs" color="lmFg.muted">
        No due date
      </Text>
    );
  }
  // A teacher owns the assignment, not a submission for it, so a passed
  // deadline is never "overdue" for them the way it is for a student.
  const overdue = !isTeacher && new Date(dueDate) < new Date();
  return (
    <Tooltip label={formatDateTime(dueDate)}>
      <Text fontSize="xs" color={overdue ? 'red.500' : 'lmFg.subtle'} fontWeight={overdue ? '600' : '400'}>
        Due {relativeTime(dueDate)}
      </Text>
    </Tooltip>
  );
}

/**
 * Manages the class-wide list of topics (`klass.topics`) used to group items
 * into categories — shared by Material and Forms, so a topic created on one
 * tab is immediately available on the other.
 */
export function TopicManager({ classId, topics, onChanged, itemNoun = 'Material' }) {
  const [name, setName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const toast = useToast();

  const add = async () => {
    if (!name.trim()) return;
    try {
      await lmApi.createTopic(classId, name.trim());
      setName('');
      onChanged();
    } catch (error) {
      toast({ status: 'error', title: error.message });
    }
  };

  const saveEdit = async (topicId) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast({ status: 'error', title: 'Topic name is required.' });
      return;
    }
    try {
      await lmApi.updateTopic(classId, topicId, { name: trimmed });
      setEditingTopicId(null);
      setEditingName('');
      onChanged();
    } catch (error) {
      toast({ status: 'error', title: error.message });
    }
  };

  const remove = async (topicId) => {
    const topic = topics.find((entry) => entry._id === topicId);
    if (!topic) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete topic "${topic.name}"? ${itemNoun} in it will move to Other.`)) return;
    try {
      await lmApi.deleteTopic(classId, topicId);
      setEditingTopicId(null);
      setEditingName('');
      onChanged();
    } catch (error) {
      toast({ status: 'error', title: error.message });
    }
  };

  const startEdit = (topic) => {
    setEditingTopicId(topic._id);
    setEditingName(topic.name);
  };

  return (
    <Box bg="lmBg.surface" borderWidth="1px" borderColor="lmBorder.base" borderRadius="lg" p={4}>
      <Heading size="xs" mb={3} color="lmFg.body">
        Topics
      </Heading>
      {topics.length === 0 && (
        <Text fontSize="sm" color="lmFg.muted" mb={3}>
          Group {itemNoun.toLowerCase()} into units, chapters or weeks.
        </Text>
      )}
      {topics.map((topic) => {
        const isEditing = editingTopicId === topic._id;
        return (
          <Flex key={topic._id} align="center" justify="space-between" py={1} gap={2}>
            {isEditing ? (
              <>
                <Input
                  size="sm"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(topic._id);
                    if (e.key === 'Escape') {
                      setEditingTopicId(null);
                      setEditingName('');
                    }
                  }}
                />
                <HStack spacing={1}>
                  <Button size="xs" onClick={() => saveEdit(topic._id)}>
                    Save
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => {
                    setEditingTopicId(null);
                    setEditingName('');
                  }}>
                    Cancel
                  </Button>
                </HStack>
              </>
            ) : (
              <>
                <Text fontSize="sm" flex="1" minW={0} noOfLines={1}>
                  {topic.name}
                </Text>
                <Menu>
                  <MenuButton as={IconButton} size="xs" variant="ghost" icon={<span>⋮</span>} aria-label={`Topic actions for ${topic.name}`} />
                  <MenuList>
                    <MenuItem {...buttonTextStyles} onClick={() => startEdit(topic)}>
                      Edit
                    </MenuItem>
                    <MenuItem color="red.600" onClick={() => remove(topic._id)}>
                      Delete
                    </MenuItem>
                  </MenuList>
                </Menu>
              </>
            )}
          </Flex>
        );
      })}
      <Flex gap={2} mt={3}>
        <Input
          size="sm"
          placeholder="New topic"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button size="sm" onClick={add} isDisabled={!name.trim()}>
          Add
        </Button>
      </Flex>
    </Box>
  );
}

/** Groups items that carry a `topicId` under their class topic, with an "Other" bucket for the rest. */
export function groupByTopic(items, topics) {
  const grouped = topics
    .map((topic) => ({ topic, items: items.filter((item) => String(item.topicId) === String(topic._id)) }))
    .filter((group) => group.items.length);
  const untopiced = items.filter((item) => !item.topicId);
  return { grouped, untopiced };
}
