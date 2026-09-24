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
  Text,
  Tooltip,
  useClipboard,
  useToast,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
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

/** Best-effort: some browsers refuse this outside a direct user gesture. */
export const requestFullscreen = () => {
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  } catch {
    // Fullscreen is a nicety here, never a requirement to fill in a form.
  }
};

/** Tracks whether the page is currently full screen, for full-screen-only styling. */
export function useIsFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  return isFullscreen;
}

/**
 * Consistent loading state for every panel in the module.
 *
 * It was a spinner and a sentence, and it was used by sixty-odd screens — which
 * made it the reason the module showed a spinner almost everywhere. A spinner
 * says only "something is happening"; it tells you nothing about what is coming,
 * it replaces the whole page with a blank centred box, and when the content
 * lands the layout jumps from that box to the real thing.
 *
 * So the default is now the neutral *shape* of a panel in this module — a
 * header, then a few cards — drawn in the same surface, border and radius as
 * the thing it stands in for. Pages that know their own shape pass a better one
 * (see `WorkListSkeleton`, `TableSkeleton`, `StatRowSkeleton` and the rest, and
 * `LoadingProps.skeleton` below); this is what the ones that have not yet been
 * given a specific shape fall back to, and it is deliberately still a skeleton
 * so that no screen in the module can show a spinner by default.
 *
 * `label` is kept in the signature — every call site passes one — but it is
 * rendered only to assistive technology. A skeleton that also prints "Loading
 * quizzes…" is a spinner with extra steps: sighted users are told by the shape,
 * and a screen reader gets the sentence it cannot see.
 *
 * @param {object} props
 * @param {string} [props.label] announced to screen readers, never drawn
 * @param {string} [props.minH] floor for the placeholder, so short panels do
 *        not collapse and then expand
 * @param {React.ReactNode} [props.skeleton] the page's own shape, when it has one
 */
export function Loading({ label = 'Loading…', minH = '200px', skeleton = null }) {
  return (
    <Box minH={minH} data-testid="loading-skeleton" aria-busy="true" role="status">
      {/* The sentence, for anyone who cannot see the shape. Chakra's visually
          hidden utility rather than `display: none`, which would take it out of
          the accessibility tree along with the pixels. */}
      <Box position="absolute" width="1px" height="1px" overflow="hidden" clipPath="inset(50%)">
        {label}
      </Box>
      {skeleton || (
        <>
          <PageHeaderSkeleton />
          <Flex direction="column" gap={3}>
            {Array.from({ length: 3 }).map((_, index) => (
              <WorkCardSkeleton key={index} />
            ))}
          </Flex>
        </>
      )}
    </Box>
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
      // 20px of padding costs a phone an eighth of its width on each side, and
      // it is the card's own text that pays for it.
      p={{ base: 4, md: 5 }}
      {...rest}
    >
      {(title || action) && (
        <Flex
          justify="space-between"
          align="flex-start"
          mb={subtitle ? 1 : 4}
          gap={3}
          direction={{ base: 'column', sm: 'row' }}
        >
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

/**
 * The width at which a list card stops stacking and becomes a row.
 *
 * Written as a media query rather than a Chakra responsive prop because the
 * rules below live inside `sx` child selectors, where one query covering the
 * whole block is easier to read — and to keep in step with `CardRow` — than a
 * breakpoint object repeated on every declaration. 48em is Chakra's `md`.
 */
const CARD_ROW_QUERY = '@media (min-width: 48em)';

/**
 * The body of a list card: the item on one side, its controls on the other.
 *
 * Side by side is a desktop shape. On a phone the two halves were sharing a
 * wrapping row, so the controls came to rest wherever the text happened to
 * stop — sometimes beside it, sometimes below, never twice the same on two
 * cards in the same list. That is the clustering: not too many buttons, but no
 * line anywhere for the eye to follow down the list.
 *
 * So below `md` the card is two stacked blocks — everything you read, then
 * everything you tap — and every card in the list breaks in the same place.
 * From `md` up it is the row it always was.
 */
export function CardRow({ children, align = 'center', ...rest }) {
  return (
    <Flex
      direction={{ base: 'column', md: 'row' }}
      align={{ base: 'stretch', md: align }}
      gap={{ base: 3, md: 4 }}
      {...rest}
    >
      {children}
    </Flex>
  );
}

/**
 * The text half of a list card — title, badges, the line of detail under them.
 *
 * `minW` is the reason this exists rather than a bare `Box`: a card body needs
 * a floor wide enough to keep the controls from crushing the title on a
 * desktop row, and no floor at all on a phone, where any floor at all is a
 * horizontal scrollbar on a 320px screen.
 */
export function CardBody({ children, minW = '220px', ...rest }) {
  return (
    <Box flex="1" minW={{ base: 0, md: minW }} maxW="100%" {...rest}>
      {children}
    </Box>
  );
}

/**
 * The controls at the end of a list card, and of a page header.
 *
 * A teacher's card carries up to eight of these — Edit, Results, Preview,
 * Publish, a deadline field, a room code, a delete. Right-aligned and wrapping
 * at `sm` size, on a phone they arrive as a ragged block of pills of eight
 * different widths, several of them too small to hit accurately, with the last
 * row pushed to the right where nothing else on the card is.
 *
 * Here they are laid out two to a row at full width, so the block has an edge
 * on both sides and the eye can go down it; an odd one out takes the whole
 * last row rather than leaving a gap. Each one is given a 40px floor — Chakra's
 * `sm` button is 32px high, which is under every platform's minimum touch
 * target — without changing the `size` the call site asked for, so nothing
 * moves on a desktop.
 *
 * Badges are left out of the stretching: a "Missed" pill is a label that
 * happens to sit among the buttons, and a label stretched to half the card
 * reads as something to press.
 */
export function CardActions({ children, ...rest }) {
  return (
    <Flex
      w={{ base: '100%', md: 'auto' }}
      gap={2}
      wrap="wrap"
      align="center"
      justify={{ base: 'flex-start', md: 'flex-end' }}
      flexShrink={0}
      sx={{
        '& > *:not(.chakra-badge)': { flex: '1 1 calc(50% - 0.25rem)', minWidth: 0 },
        // For the ones that cannot halve: a split button, a date field, anything
        // whose label is a sentence. Marked at the call site with
        // `data-card-action-wide`.
        '& > [data-card-action-wide]': { flex: '1 1 100%' },
        '& .chakra-button, & .chakra-input, & .chakra-select': { minHeight: '40px' },
        [CARD_ROW_QUERY]: {
          '& > *:not(.chakra-badge)': { flex: '0 0 auto' },
          '& > [data-card-action-wide]': { flex: '0 0 auto' },
          '& .chakra-button, & .chakra-input, & .chakra-select': { minHeight: 'auto' },
        },
      }}
      {...rest}
    >
      {children}
    </Flex>
  );
}

/**
 * The title block at the top of a tab, with whatever the tab's own controls are.
 *
 * Same story as `CardActions`, one level up: "Tutorials", a sentence about
 * them, then Manual and + New tutorial — which on a phone came out as a
 * heading with one button hanging off its right-hand end and the other adrift
 * below. Stacked, the buttons are a row of their own at the width of the page.
 */
export function PageHeader({ title, description, actions, children, ...rest }) {
  return (
    <Flex
      direction={{ base: 'column', md: 'row' }}
      justify="space-between"
      align={{ base: 'stretch', md: 'flex-start' }}
      gap={{ base: 3, md: 4 }}
      mb={4}
      {...rest}
    >
      <Box minW={0}>
        {typeof title === 'string' ? <Heading size="md">{title}</Heading> : title}
        {description &&
          (typeof description === 'string' ? (
            <Text fontSize="sm" color="lmFg.muted" mt={1}>
              {description}
            </Text>
          ) : (
            description
          ))}
        {children}
      </Box>
      {actions && <CardActions>{actions}</CardActions>}
    </Flex>
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

export function AnnouncementCardSkeleton() {
  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      p={5}
      data-testid="announcement-card-skeleton"
    >
      <Flex gap={3} align="center" mb={4}>
        <Skeleton width="40px" height="40px" borderRadius="full" />
        <Box flex={1}>
          <Skeleton height="16px" width="35%" borderRadius="sm" mb={2} />
          <Skeleton height="12px" width="20%" borderRadius="sm" />
        </Box>
      </Flex>
      <Box mb={4}>
        <Skeleton height="14px" width="100%" borderRadius="sm" mb={2} />
        <Skeleton height="14px" width="90%" borderRadius="sm" mb={2} />
        <Skeleton height="14px" width="60%" borderRadius="sm" />
      </Box>
      <HStack spacing={3}>
        <Skeleton height="24px" width="60px" borderRadius="full" />
        <Skeleton height="24px" width="60px" borderRadius="full" />
      </HStack>
    </Box>
  );
}

export function AnnouncementStreamSkeleton({ count = 3 }) {
  return (
    <Flex direction="column" gap={4} data-testid="announcement-stream-skeleton">
      {Array.from({ length: count }).map((_, index) => (
        <AnnouncementCardSkeleton key={index} />
      ))}
    </Flex>
  );
}

export function MaterialCardSkeleton() {
  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      p={4}
      data-testid="material-card-skeleton"
    >
      <Flex align="center" gap={4}>
        <Skeleton height="40px" width="40px" borderRadius="md" flexShrink={0} />
        <Box flex={1}>
          <Skeleton height="16px" width="40%" borderRadius="sm" mb={2} />
          <Skeleton height="12px" width="25%" borderRadius="sm" />
        </Box>
        <Skeleton height="32px" width="80px" borderRadius="md" />
      </Flex>
    </Box>
  );
}

export function MaterialListSkeleton({ count = 4 }) {
  return (
    <Flex direction="column" gap={3} data-testid="material-list-skeleton">
      {Array.from({ length: count }).map((_, index) => (
        <MaterialCardSkeleton key={index} />
      ))}
    </Flex>
  );
}

export function ShortCardSkeleton() {
  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      p={4}
      data-testid="short-card-skeleton"
    >
      <Flex align="flex-start" justify="space-between" mb={3}>
        <Box flex={1} mr={3}>
          <Skeleton height="18px" width="60%" borderRadius="sm" mb={2} />
          <Skeleton height="12px" width="30%" borderRadius="sm" />
        </Box>
        <Skeleton height="20px" width="50px" borderRadius="full" />
      </Flex>
      <Box mb={4}>
        <Skeleton height="12px" width="100%" borderRadius="sm" mb={2} />
        <Skeleton height="12px" width="75%" borderRadius="sm" />
      </Box>
      <HStack justify="space-between" align="center">
        <Skeleton height="14px" width="80px" borderRadius="sm" />
        <Skeleton height="28px" width="70px" borderRadius="md" />
      </HStack>
    </Box>
  );
}

export function ShortsListSkeleton({ count = 3 }) {
  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4} data-testid="shorts-list-skeleton">
      {Array.from({ length: count }).map((_, index) => (
        <ShortCardSkeleton key={index} />
      ))}
    </SimpleGrid>
  );
}

export function TimetableSkeleton() {
  return (
    <Box data-testid="timetable-skeleton">
      <SectionCard title={<Skeleton height="20px" width="160px" borderRadius="sm" />}>
        <SimpleGrid columns={{ base: 1, md: 5 }} spacing={4} mt={2} data-testid="timetable-skeleton-grid">
          {Array.from({ length: 5 }).map((_, colIndex) => (
            <Box key={colIndex} p={3} borderWidth="1px" borderColor="lmBorder.base" borderRadius="md">
              <Skeleton height="16px" width="70%" borderRadius="sm" mb={3} />
              <Skeleton height="60px" width="100%" borderRadius="md" mb={2} />
              <Skeleton height="60px" width="100%" borderRadius="md" />
            </Box>
          ))}
        </SimpleGrid>
      </SectionCard>
    </Box>
  );
}


/* ─────────────────────── the rest of the loading vocabulary ───────────────
 *
 * Every tab in this module is one of a handful of shapes, and the skeletons
 * above covered four of them. What follows covers the rest, so a page says what
 * it is about to show rather than that something is happening somewhere.
 *
 * Three rules hold across all of them, and they are why these live here rather
 * than being written per page:
 *
 *   **The same box as the real thing.** `lmBg.surface`, a 1px `lmBorder.base`,
 *   the same radius and padding. A skeleton whose card is a different size from
 *   the card that replaces it makes the whole page jump on arrival, which is
 *   more distracting than the spinner it replaced.
 *
 *   **The right number of them.** Enough rows to fill the space a short list
 *   will occupy, never so many that the page grows and then collapses.
 *
 *   **No text.** A skeleton that says "Loading quizzes…" is a spinner with
 *   extra steps: it describes the wait instead of the page. The shape is the
 *   message.
 */

/**
 * The bar every tab opens with: title, one line about it, an action or two.
 *
 * Worth drawing rather than leaving blank, because it is the tallest thing
 * above the fold and a list skeleton that starts at the top of the panel sits
 * about sixty pixels higher than the list it becomes.
 */
export function PageHeaderSkeleton({ action = true }) {
  return (
    <Flex justify="space-between" align="flex-start" mb={4} gap={3} data-testid="page-header-skeleton">
      <Box flex="1" maxW="520px">
        <Skeleton height="24px" width="180px" borderRadius="md" mb={3} />
        <Skeleton height="12px" width="100%" borderRadius="sm" mb={2} />
        <Skeleton height="12px" width="70%" borderRadius="sm" />
      </Box>
      {action && <Skeleton height="36px" width="132px" borderRadius="md" flexShrink={0} />}
    </Flex>
  );
}

/**
 * One piece of classwork in a list — a quiz, a tutorial, an assignment, a form,
 * a notebook, an experiment.
 *
 * They are all the same card: a title with a status pill beside it, a line of
 * detail, a row of meta at the bottom and the controls on the right. One shape
 * serves all six tabs, which is also the honest answer to "what does this tab
 * look like" — they look alike on purpose.
 */
export function WorkCardSkeleton() {
  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      p={4}
      data-testid="work-card-skeleton"
    >
      <Flex align="flex-start" justify="space-between" gap={3} mb={3}>
        <Box flex="1" minW={0}>
          <HStack spacing={2} mb={2}>
            <Skeleton height="18px" width="45%" borderRadius="sm" />
            <Skeleton height="18px" width="56px" borderRadius="full" />
          </HStack>
          <Skeleton height="12px" width="72%" borderRadius="sm" />
        </Box>
        <Skeleton height="32px" width="88px" borderRadius="md" flexShrink={0} />
      </Flex>
      <HStack spacing={4}>
        <Skeleton height="12px" width="88px" borderRadius="sm" />
        <Skeleton height="12px" width="64px" borderRadius="sm" />
        <Skeleton height="12px" width="72px" borderRadius="sm" />
      </HStack>
    </Box>
  );
}

/** The classwork tabs' body: a header, then a short column of work cards. */
export function WorkListSkeleton({ count = 4, header = true }) {
  return (
    <Box data-testid="work-list-skeleton">
      {header && <PageHeaderSkeleton />}
      <Flex direction="column" gap={3}>
        {Array.from({ length: count }).map((_, index) => (
          <WorkCardSkeleton key={index} />
        ))}
      </Flex>
    </Box>
  );
}

/**
 * A row of stat tiles, as Insights, Profile, Feedback and the admin dashboards
 * open with.
 *
 * `columns` mirrors what the page itself passes to `SimpleGrid`, so the tiles
 * wrap at the same widths they will when the numbers arrive.
 */
export function StatRowSkeleton({ count = 4, columns = { base: 2, md: 4 } }) {
  return (
    <SimpleGrid columns={columns} spacing={4} data-testid="stat-row-skeleton">
      {Array.from({ length: count }).map((_, index) => (
        <StatTileSkeleton key={index} />
      ))}
    </SimpleGrid>
  );
}

/**
 * A table, drawn as a table rather than as a stack of grey bars.
 *
 * The header row is a shade heavier than the body so the shape reads as a
 * table at a glance — a gradebook and a list of announcements should not be
 * indistinguishable while they load, which is exactly what one generic
 * placeholder for both would produce.
 */
export function TableSkeleton({ rows = 6, columns = 5, title = true }) {
  const widths = ['34%', '18%', '16%', '16%', '12%', '14%', '12%'];
  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      p={5}
      data-testid="table-skeleton"
    >
      {title && <Skeleton height="18px" width="200px" borderRadius="sm" mb={4} />}
      <Flex gap={4} pb={3} borderBottomWidth="1px" borderColor="lmBorder.base">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} height="12px" width={widths[index % widths.length]} borderRadius="sm" />
        ))}
      </Flex>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Flex
          key={rowIndex}
          gap={4}
          py={3}
          borderBottomWidth={rowIndex === rows - 1 ? 0 : '1px'}
          borderColor="lmBorder.base"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              height="14px"
              width={widths[colIndex % widths.length]}
              borderRadius="sm"
            />
          ))}
        </Flex>
      ))}
    </Box>
  );
}

/**
 * A titled card with a few lines in it — the shape most detail panels and
 * settings panes take.
 */
export function SectionCardSkeleton({ lines = 3, title = true, ...rest }) {
  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      p={5}
      data-testid="section-card-skeleton"
      {...rest}
    >
      {title && <Skeleton height="18px" width="45%" borderRadius="sm" mb={4} />}
      <SkeletonText noOfLines={lines} spacing={3} skeletonHeight="12px" />
    </Box>
  );
}

/**
 * A list of posts with an author beside each — the forum, and the notification
 * list.
 *
 * Distinct from `AnnouncementCardSkeleton` above, which is a full stream card
 * with reactions under it; these are the tighter rows those two tabs use.
 */
export function ThreadListSkeleton({ count = 5, header = true }) {
  return (
    <Box data-testid="thread-list-skeleton">
      {header && <PageHeaderSkeleton />}
      <Flex direction="column" gap={3}>
        {Array.from({ length: count }).map((_, index) => (
          <Box
            key={index}
            bg="lmBg.surface"
            borderWidth="1px"
            borderColor="lmBorder.base"
            borderRadius="lg"
            p={4}
          >
            <Flex gap={3} align="flex-start">
              <Skeleton width="36px" height="36px" borderRadius="full" flexShrink={0} />
              <Box flex="1" minW={0}>
                <Flex justify="space-between" gap={3} mb={2}>
                  <Skeleton height="14px" width="38%" borderRadius="sm" />
                  <Skeleton height="11px" width="64px" borderRadius="sm" flexShrink={0} />
                </Flex>
                <Skeleton height="12px" width="100%" borderRadius="sm" mb={2} />
                <Skeleton height="12px" width="55%" borderRadius="sm" />
              </Box>
            </Flex>
          </Box>
        ))}
      </Flex>
    </Box>
  );
}

/**
 * A month grid.
 *
 * Six rows of seven, because that is what a month occupies however short
 * February is — a grid that grows a row when the real month arrives is the jump
 * these exist to prevent.
 */
export function CalendarSkeleton() {
  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      p={5}
      data-testid="calendar-skeleton"
    >
      <Flex justify="space-between" align="center" mb={4}>
        <Skeleton height="20px" width="160px" borderRadius="sm" />
        <HStack spacing={2}>
          <Skeleton height="32px" width="32px" borderRadius="md" />
          <Skeleton height="32px" width="32px" borderRadius="md" />
        </HStack>
      </Flex>
      <SimpleGrid columns={7} spacing={2}>
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={`head-${index}`} height="10px" borderRadius="sm" mb={1} />
        ))}
        {Array.from({ length: 42 }).map((_, index) => (
          <Skeleton key={index} height="64px" borderRadius="md" />
        ))}
      </SimpleGrid>
    </Box>
  );
}

/**
 * Three dots, breathing — the module's inline "this is in flight" mark.
 *
 * Not everything a spinner was doing here was a page load, and the other two
 * jobs cannot be done by a skeleton at all:
 *
 *   **An operation on one thing.** A code being checked, a cell running, a
 *   circuit solving, one invitation going out. There is no layout coming, so
 *   there is no shape to draw; what is wanted is a mark the size of a word,
 *   sitting next to the thing it belongs to.
 *
 *   **A wait on a person.** "Waiting for your teacher to open the next
 *   question." A skeleton would be a lie — it promises content is arriving, and
 *   nothing is arriving until somebody decides. A spinner reads as "the app is
 *   working", which is equally untrue, and after thirty seconds of it students
 *   reload a page that was fine.
 *
 * Dots rather than a spinner for both, because a spinner's implied contract is
 * "wait, this will finish shortly" and neither of these can promise that. Dots
 * say only that the screen is live, which is exactly what is true.
 *
 * `currentColor`, so it takes the colour of the text it sits beside rather than
 * carrying its own — these appear in a dozen different contexts and a fixed
 * blue was wrong in most of them.
 */
const busyPulse = keyframes`
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
  40%           { opacity: 1;    transform: scale(1); }
`;

export function BusyDots({ size = '5px', label = 'Working…', ...rest }) {
  return (
    <HStack
      as="span"
      spacing="3px"
      aria-label={label}
      role="status"
      display="inline-flex"
      verticalAlign="middle"
      data-testid="busy-dots"
      {...rest}
    >
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          as="span"
          width={size}
          height={size}
          borderRadius="full"
          bg="currentColor"
          sx={{
            animation: `${busyPulse} 1.4s ease-in-out infinite`,
            animationDelay: `${index * 0.16}s`,
            // A reader who has asked for less motion gets three steady dots
            // rather than none: the mark still says "in flight", it just stops
            // moving. Removing it entirely would leave them nothing at all.
            '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.6 },
          }}
        />
      ))}
    </HStack>
  );
}

/**
 * The class shell: the coloured banner, the tab row, and the panel under them.
 *
 * The most-seen loading state in the module — every class opens through it —
 * and the one where a centred spinner was worst, because what arrives is not a
 * panel but a whole page furniture set, so the jump was the full height of the
 * header and the tab strip.
 *
 * The banner keeps its real height and `lmBg.track` tone rather than being
 * drawn as a grey bar: the class colour is not known until the class is, and a
 * bright block that changes colour on arrival is more startling than a neutral
 * one that fills in.
 */
export function ClassShellSkeleton() {
  return (
    <Box data-testid="class-shell-skeleton">
      <Box bg="lmBg.track" borderRadius="lg" p={6} mb={4}>
        <Skeleton height="28px" width="46%" borderRadius="md" mb={3} />
        <Skeleton height="14px" width="28%" borderRadius="sm" />
      </Box>
      <Flex gap={2} mb={5} wrap="wrap">
        {[92, 84, 76, 88, 96, 120, 80].map((width, index) => (
          <Skeleton key={index} height="32px" width={`${width}px`} borderRadius="md" />
        ))}
      </Flex>
      <PageHeaderSkeleton />
      <Flex direction="column" gap={3}>
        {Array.from({ length: 3 }).map((_, index) => (
          <WorkCardSkeleton key={index} />
        ))}
      </Flex>
    </Box>
  );
}

/**
 * A form or editor: a few labelled fields and the buttons under them.
 *
 * Used by the authoring screens, which are the one place a whole page really is
 * unusable until it has loaded — there is nothing to read while you wait, so
 * the shape of what is coming is all a skeleton can offer.
 */
export function FormSkeleton({ fields = 4, header = true }) {
  return (
    <Box data-testid="form-skeleton">
      {header && <PageHeaderSkeleton action={false} />}
      <Box
        bg="lmBg.surface"
        borderWidth="1px"
        borderColor="lmBorder.base"
        borderRadius="lg"
        p={5}
      >
        {Array.from({ length: fields }).map((_, index) => (
          <Box key={index} mb={5}>
            <Skeleton height="12px" width="120px" borderRadius="sm" mb={2} />
            <Skeleton height="40px" width="100%" borderRadius="md" />
          </Box>
        ))}
        <HStack spacing={3}>
          <Skeleton height="36px" width="104px" borderRadius="md" />
          <Skeleton height="36px" width="84px" borderRadius="md" />
        </HStack>
      </Box>
    </Box>
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
                    <MenuItem color="red.600" icon={<LmIcon name="delete" size={15} />} onClick={() => remove(topic._id)}>
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
