import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, NavLink, Outlet, useMatch } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Heading,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Skeleton,
  SkeletonCircle,
  Text,
  Tooltip,
  useColorMode,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import getEnvironment from '../../getenvironment';
import { loginPathFor } from '../../authRedirect';
import lmApi from '../api/lmApi';
import useStableNavigate from '../hooks/useStableNavigate';
import { canCreateClass, isStudentOnly } from '../roles';
import NotificationBell from './NotificationBell';
import { LmIcon } from './Icon';
import { buttonTextStyles } from './common';

// Split out of the shell: every student sees it exactly once, and nobody else
// ever does, so it has no business in the bundle that loads on every page.
const CompleteProfile = lazy(() => import('../pages/CompleteProfile'));

// Same reasoning: the one-time correction is opened by a handful of accounts,
// once each, and never again — it has no business in the shell's bundle.
const EditIdentityModal = lazy(() => import('./EditIdentityModal'));

// Shared look for the header's square action buttons (theme toggle, logout) so
// they read as one pair. Mirrors the attendance shell's SQUARE_BTN.
const SQUARE_BTN = {
  w: '32px',
  h: '32px',
  minW: '32px',
  flexShrink: 0,
  bg: 'transparent',
  borderWidth: '1px',
  borderRadius: '8px',
};

// Power glyph for the header's logout button — the same mark the attendance
// module uses, so signing out looks identical wherever you are in the platform.
function PowerIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v10" />
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </svg>
  );
}

function MoonIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function SunIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: '/learning', label: 'Classes', icon: 'classes', end: true },
  { to: '/learning/todo', label: 'To-do', icon: 'todo' },
  { to: '/learning/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/learning/timetable', label: 'Timetable', icon: 'timetable' },
  { to: '/learning/notifications', label: 'Notifications', icon: 'notifications' },
  // Where the "you were marked Present/Absent" mail and notification land.
  // Students only: staff read the same markings from the attendance module,
  // and nobody else has a roll number to look up.
  { to: '/learning/attendance', label: 'My attendance', icon: 'attendance-card', studentOnly: true },
  // Points and badges are a student's record. Staff earn none — they set the
  // work rather than doing it, and the leaderboard leaves them off entirely —
  // so a "My progress" that was always empty would only invite the question.
  { to: '/learning/profile', label: 'My progress', icon: 'progress', studentOnly: true },
  // Last, and separated below. Reporting something broken — or asking for
  // something better — is not navigation: it is what you do *instead* of what
  // you came here for, and it has to be reachable from wherever the thing broke.
  { to: '/learning/bugs', label: 'Bug / Suggestion', icon: 'suggestion', foot: true },
  // The help desk, which lives outside this module (/help) because most of the
  // people it serves cannot get as far as this rail. Reachable from in here
  // too: "why can I not see my class?" is asked far more often from a signed-in
  // screen than from the login page, and a signed-in visitor skips its email
  // verification entirely — the server issues its pass off the session.
  { to: '/help', label: 'Help desk', icon: 'help-desk', foot: true },
  // Platform-wide stats and queues at a glance. Only an lm-admin (or other
  // platform-admin) account can open it — the server 403s everyone else — so
  // the link itself is hidden rather than left to dead-end.
  { to: '/learning/lm-admin', label: 'Admin', icon: 'admin', foot: true, adminOnly: true },
  // Shown to heads of department as well as admins — it is their screen, and
  // the server scopes it to their department. See RequireHod.
  { to: '/learning/hod-dashboard', label: 'HOD Dashboard', icon: 'dashboard', foot: true, hodOrAdmin: true },
  // What the timetable allocates to the department’s faculty, and which of it
  // has a classroom here. Same audience and same gate as the dashboard above.
  { to: '/learning/hod-subjects', label: 'Subjects', icon: 'subjects', foot: true, hodOrAdmin: true, section: 'subjects' },
  // The same two screens across every department, for the Dean (Academic).
  // A separate pair of items rather than a wider audience for the two above:
  // an account holding DEAN is refused /learning/hod-dashboard by the server,
  // and an HOD is refused these — so offering either the other's link would be
  // offering them a 403. See RequireDean.
  //
  // `deanOnly` rather than "dean or admin", unlike the pair above. An admin
  // already reads the whole installation through the HOD items — the server
  // scopes those to nothing for a platform admin — so adding these would put a
  // second "Subjects" in the rail pointing at the same numbers. An admin who
  // wants to see the dean's own screen can still open the URL; RequireDean and
  // requireDean both admit them.
  { to: '/learning/dean-dashboard', label: 'Dean Dashboard', icon: 'dashboard', foot: true, deanOnly: true },
  { to: '/learning/dean-subjects', label: 'Subjects', icon: 'subjects', foot: true, deanOnly: true, section: 'subjects' },
];

/**
 * The one coloured thing in the rail, sitting under the class list.
 *
 * Not in NAV_ITEMS because it is not navigation: it is an invitation, and it
 * belongs at the very bottom — after the classes, where the eye lands last —
 * rather than in the middle of a list of places to go. Teal rather than the
 * rail's blue, so it reads as a different kind of thing and not as the
 * selected item.
 *
 * Everyone sees it, staff included: the queue is read by admins, and a teacher
 * who wants in should not have to be told the link exists.
 */
function DevTeamCta({ onNavigate }) {
  const bg = useColorModeValue('teal.50', 'teal.900');
  const color = useColorModeValue('teal.800', 'teal.100');
  const borderColor = useColorModeValue('teal.200', 'teal.600');
  const hoverBg = useColorModeValue('teal.100', 'teal.800');
  const subColor = useColorModeValue('teal.700', 'teal.200');

  return (
    <Box
      as={NavLink}
      to="/learning/dev-team"
      onClick={onNavigate}
      display="block"
      mt={4}
      px={4}
      py={3}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={borderColor}
      bg={bg}
      color={color}
      _hover={{ bg: hoverBg, textDecoration: 'none' }}
      sx={{ '&.active': { bg: hoverBg, borderColor: 'teal.500' } }}
    >
      <Flex align="center" gap={2}>
        <LmIcon name="dev-team" size={18} />
        <Text fontSize="sm" fontWeight="700">
          Join our dev team
        </Text>
      </Flex>
      <Text fontSize="xs" color={subColor} mt={0.5}>
        XCEED invites developers to join the team.
      </Text>
    </Box>
  );
}

/**
 * Class tabs that exist under every class and need no further id in the path.
 *
 * Switching class from inside one of these keeps you on the same tab — the
 * reason to switch is usually to compare ("what did the other section get for
 * this?"), and landing on the stream every time means two clicks back to where
 * you were. Anything else — a quiz, a notebook, an id-bearing route — drops to
 * the class home, because that id does not exist in the class being switched to.
 *
 * `insights` and `playground` are on the list even though each is one role only.
 * Carrying a tab the new class will not show is handled: RequireTeacher (or the
 * server) redirects to the class stream, which is where the fallback would have
 * put them anyway.
 */
const PORTABLE_TABS = new Set([
  'material',
  'quizzes',
  'tutorials',
  'shorts',
  'notebooks',
  'grades',
  'studio',
  'playground',
  'insights',
  'feedback',
  'people',
]);

/**
 * The rail's class list.
 *
 * It replaced a card that showed the signed-in name, email and role badges —
 * three facts the user already knows about themselves, occupying the one piece
 * of always-visible furniture on the page. Identity still lives in the header
 * avatar menu, one click away, which is the only place it was ever needed.
 */
function ClassSwitcherSkeleton() {
  const switcherBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box mt={6} bg={switcherBg} borderRadius="lg" borderWidth="1px" borderColor={borderColor} p={4} data-testid="class-switcher-skeleton">
      <Skeleton height="10px" width="50%" borderRadius="sm" mb={4} />
      <HStack spacing={3} mb={3}>
        <SkeletonCircle size="3" flexShrink={0} />
        <Skeleton height="12px" width="70%" borderRadius="sm" />
      </HStack>
      <HStack spacing={3} mb={3}>
        <SkeletonCircle size="3" flexShrink={0} />
        <Skeleton height="12px" width="60%" borderRadius="sm" />
      </HStack>
      <HStack spacing={3}>
        <SkeletonCircle size="3" flexShrink={0} />
        <Skeleton height="12px" width="80%" borderRadius="sm" />
      </HStack>
    </Box>
  );
}

function ClassSwitcher({ classes, activeClassId, carriedTab, onNavigate }) {
  if (!classes) return <ClassSwitcherSkeleton />;

  const switcherBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const secondaryTextColor = useColorModeValue('gray.500', 'gray.400');
  const itemColor = useColorModeValue('gray.700', 'gray.200');
  const activeBg = useColorModeValue('blue.50', 'blue.900');
  const activeColor = useColorModeValue('blue.800', 'blue.100');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const href = (klass) =>
    `/learning/class/${klass._id}${carriedTab ? `/${carriedTab}` : ''}`;

  return (
    <Box mt={6} bg={switcherBg} borderRadius="lg" borderWidth="1px" borderColor={borderColor} overflow="hidden">
      <Text
        px={4}
        pt={3}
        pb={2}
        fontSize="xs"
        fontWeight="700"
        textTransform="uppercase"
        letterSpacing="wide"
        color={secondaryTextColor}
      >
        {activeClassId ? 'Switch class' : 'My classes'}
      </Text>

      {classes.length === 0 ? (
        <Text px={4} pb={3} fontSize="xs" color={secondaryTextColor}>
          You are not in any class yet. Use <b>Join class</b> above with the code your teacher gave you.
        </Text>
      ) : (
        <Box maxH="280px" overflowY="auto" pb={1}>
          {classes.map((klass) => {
            const active = String(klass._id) === String(activeClassId);
            return (
              <Tooltip
                key={klass._id}
                label={[klass.name, klass.section, klass.subject].filter(Boolean).join(' · ')}
                placement="right"
                openDelay={400}
              >
                <Flex
                  as={RouterLink}
                  to={href(klass)}
                  onClick={onNavigate}
                  align="center"
                  gap={2.5}
                  px={4}
                  py={2}
                  fontSize="sm"
                  bg={active ? activeBg : 'transparent'}
                  color={active ? activeColor : itemColor}
                  fontWeight={active ? '600' : '400'}
                  borderLeftWidth="3px"
                  borderLeftColor={active ? 'blue.500' : 'transparent'}
                  _hover={{ bg: active ? activeBg : hoverBg, textDecoration: 'none' }}
                >
                  {/* The class's own colour, the same one the header and the
                      dashboard card use — it is how people recognise a class
                      before they have read its name. */}
                  <Box
                    w="10px"
                    h="10px"
                    borderRadius="full"
                    bg={klass.coverColor || '#1967d2'}
                    flexShrink={0}
                  />
                  <Text noOfLines={1}>{klass.name}</Text>
                </Flex>
              </Tooltip>
            );
          })}
        </Box>
      )}

      <Box borderTopWidth="1px" borderColor="lmBorder.subtle">
        <Text
          as={RouterLink}
          to="/learning"
          onClick={onNavigate}
          display="block"
          px={4}
          py={2}
          fontSize="xs"
          fontWeight="600"
          color="blue.600"
          _hover={{ bg: 'gray.50', textDecoration: 'none' }}
        >
          All classes →
        </Text>
      </Box>
    </Box>
  );
}

function NavItems({
  onNavigate,
  studentOnly = false,
  isAdmin = false,
  isHod = false,
  isDean = false,
  // Panel key → shown. An absent map, or an absent key, means shown: the rail
  // must not lose an item because a preference read is still in flight.
  sections = null,
}) {
  const sectionOn = (key) => !key || !sections || sections[key] !== false;
  const navColor = useColorModeValue('gray.700', 'gray.200');
  const navBorderColor = useColorModeValue('gray.200', 'gray.700');
  const navHoverBg = useColorModeValue('gray.100', 'gray.700');
  const activeBg = useColorModeValue('blue.50', 'blue.900');
  const activeColor = useColorModeValue('blue.700', 'blue.100');

  return (
    <>
      {NAV_ITEMS.filter(
        (item) =>
          (!item.studentOnly || studentOnly)
          && (!item.adminOnly || isAdmin)
          && (!item.hodOrAdmin || isAdmin || isHod)
          && (!item.deanOnly || isDean)
          // The one nav item that is also a configurable panel: hidden when an
          // administrator has switched Subjects off for this reader's
          // dashboard, because the screen behind it then answers 403.
          && sectionOn(item.section),
      ).map((item) => (
        <Box
          key={item.to}
          as={NavLink}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          // Pushed away from the navigation proper: it is not another place to
          // go, it is the escape hatch when a place you went is broken.
          mt={item.foot ? 4 : undefined}
          borderTopWidth={item.foot ? '1px' : undefined}
          borderColor={navBorderColor}
          pt={item.foot ? 4 : undefined}
          px={4}
          py={2.5}
          borderRadius="full"
          display="flex"
          alignItems="center"
          gap={3}
          fontSize="sm"
          fontWeight="500"
          color={navColor}
          _hover={{ bg: navHoverBg }}
          sx={{
            '&.active': { bg: activeBg, color: activeColor, fontWeight: '600' },
          }}
        >
          <LmIcon name={item.icon} size={18} />
          {item.label}
        </Box>
      ))}
    </>
  );
}

/**
 * Shell for every learning-module screen: a left rail on desktop, a drawer on
 * mobile, and the header that carries the join/create actions.
 */
export default function LearningLayout() {
  const { colorMode, toggleColorMode } = useColorMode();
  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const menuTextColor = useColorModeValue('gray.800', 'gray.100');
  const headerBg = useColorModeValue('white', 'gray.800');
  const headerBorderColor = useColorModeValue('gray.200', 'gray.700');
  const headerTitleColor = useColorModeValue('gray.800', 'white');
  const headerSecondaryColor = useColorModeValue('gray.500', 'gray.400');

  const [me, setMe] = useState(null);
  /* Which panels the reader's own leadership dashboard shows — the rail needs
     it only to decide whether to offer "Subjects", whose screen refuses the
     request when that panel is off. Absent means every panel, so the rail
     behaves exactly as it did before this existed while the call is in flight
     or for the accounts that never make it. */
  const [dashSections, setDashSections] = useState(null);
  const [overview, setOverview] = useState(null);
  const [classes, setClasses] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useStableNavigate();

  // Which class is open, and where inside it. Read with useMatch rather than
  // useParams: `class/:classId` is a *descendant* route of this layout, so its
  // params are not visible here.
  const classMatch = useMatch('/learning/class/:classId/*');
  const activeClassId = classMatch?.params?.classId || null;
  const openTab = classMatch?.params?.['*'] || '';
  const carriedTab = PORTABLE_TABS.has(openTab) ? openTab : '';

  const load = useCallback(async () => {
    try {
      // Claiming invites first means a student who was added by email before
      // they had an account lands straight in their classes.
      await lmApi.claimInvites().catch(() => {});
      const [profile, summary, myClasses] = await Promise.all([
        lmApi.me(),
        lmApi.overview(),
        // The switcher must not be able to break the shell: a failed class list
        // costs the rail a panel, not the whole module.
        lmApi.listClasses().catch(() => []),
      ]);
      setMe(profile);
      setOverview(summary);
      setClasses(myClasses);

      /* Asked for separately, and only by the handful of accounts that have one
         of these dashboards. It is deliberately not a field on `/me`: that is
         resolved by middleware on every request in this module, including the
         heartbeat a live quiz sends every 30 seconds, and a database read there
         would be paid by every student sitting a paper.

         Fired after the three above rather than beside them so it can never
         delay the shell, and swallowed for the same reason the class list is —
         a failed preference read costs the rail a decision, not the module. */
      if (profile?.isHod || profile?.isDean || profile?.isAdmin) {
        lmApi
          .getMyDashboardSections()
          .then((result) => setDashSections(result?.sections || null))
          .catch(() => {});
      }
    } catch (error) {
      // `window.location` rather than `useLocation()` so the current page isn't
      // a dependency of `load` — that would refetch the profile on every hop
      // inside the module. Under BrowserRouter the two agree.
      if (error.status === 401) navigate(loginPathFor(window.location), { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // Kept apart from the drawer's `isOpen`: the account menu's one-time edit and
  // the mobile nav open on different things and must not share a switch.
  const identityEdit = useDisclosure();

  const logoutModal = useDisclosure();

  const confirmLogout = useCallback(async () => {
    logoutModal.onClose();
    try {
      await fetch(`${getEnvironment()}/user/getuser/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error during logout:', error.message);
    }
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  }, [navigate, logoutModal]);
  const mayCreateClass = canCreateClass(me?.roles);
  // Students have no platform navbar above this header, so it owns the page.
  const studentOnly = isStudentOnly(me?.roles);
  /**
   * An account that has not yet said who it is gets that form and nothing else.
   *
   * Every account is created with its email address in the name field, so this
   * catches a student on their first visit — name and roll number — and equally
   * a staff account still going by its address, which is the only time the
   * module ever asks either of them. There is no account-menu equivalent: the
   * name goes on rosters, gradebooks and result sheets, so it is given once and
   * then only an administrator changes it.
   *
   * Rendered *instead of* the shell rather than over it: it is mandatory, and
   * anything that still draws the nav, the class list and the page underneath
   * is inviting a way around it. `needsIdentity` is decided server-side, on the
   * user document, so it cannot be waved away from the client.
   */
  if (me?.needsIdentity) {
    return (
      <Suspense fallback={<Box minH="100vh" bg={pageBg} />}>
        <CompleteProfile onDone={load} />
      </Suspense>
    );
  }

  return (
    <Box minH={studentOnly ? '100vh' : 'calc(100vh - 64px)'} bg={pageBg}>
      <Box bg={headerBg} borderBottomWidth="1px" borderColor={headerBorderColor} position="sticky" top={0} zIndex={20}>
        <Container maxW="1400px" py={3}>
          <Flex align="center" gap={{ base: 2, md: 3 }}>
            {/* Pulled back into the container's own padding so it sits in the
                corner rather than inset next to the wordmark — the ghost
                button's box is wider than the glyph, which otherwise reads as
                a gap the header did not intend. */}
            <IconButton
              display={{ base: 'inline-flex', md: 'none' }}
              variant="ghost"
              aria-label="Open menu"
              icon={<LmIcon name="menu" size={20} />}
              onClick={onOpen}
              ml={-2}
              mr={-1}
            />
            <Flex as={RouterLink} to="/learning" align="center" gap={2} _hover={{ textDecoration: 'none' }}>
              <LmIcon name="brand" size={24} />
              <Box>
                <Heading size="sm" color={headerTitleColor} lineHeight="1.1">
                  XCEED Learning
                </Heading>
                <Text fontSize="xs" color={headerSecondaryColor} display={{ base: 'none', sm: 'block' }}>
                  Classes, coursework & AI study material
                </Text>
              </Box>
            </Flex>

            <Box flex="1" />

            {overview?.awaitingReview > 0 && (
              <Badge
                as={RouterLink}
                to="/learning/todo"
                colorScheme="orange"
                borderRadius="full"
                px={3}
                py={1}
                display={{ base: 'none', md: 'inline-flex' }}
              >
                {overview.awaitingReview} to review
              </Badge>
            )}

            <NotificationBell />

            {/* Theme and sign-out sit together in the bar as one pair of square
                buttons — the same 32px bordered treatment the attendance shell
                uses — rather than being buried in the avatar menu. */}
            <HStack spacing={2}>
              <IconButton
                onClick={toggleColorMode}
                variant="ghost"
                aria-label={colorMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                title={colorMode === 'light' ? 'Dark mode' : 'Light mode'}
                icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
                {...SQUARE_BTN}
                borderColor={headerBorderColor}
                color={headerTitleColor}
              />
              <IconButton
                onClick={logoutModal.onOpen}
                variant="ghost"
                aria-label="Logout"
                title="Logout"
                icon={<PowerIcon />}
                {...SQUARE_BTN}
                borderColor={headerBorderColor}
                color="red.500"
              />
            </HStack>

            {me && (
              <Menu placement="bottom-end">
                <MenuButton as={Button} variant="ghost" size="sm" px={2}>
                  <HStack spacing={2}>
                    <Avatar size="xs" name={me.name} />
                    <Text
                      fontSize="sm"
                      fontWeight="600"
                      noOfLines={1}
                      maxW="140px"
                      display={{ base: 'none', md: 'block' }}
                    >
                      {me.name}
                    </Text>
                  </HStack>
                </MenuButton>
                <MenuList>
                  <Box px={3} py={2}>
                    <Text fontSize="sm" fontWeight="600" noOfLines={1}>
                      {me.name}
                    </Text>
                    <Text fontSize="xs" color="lmFg.muted" noOfLines={1}>
                      {me.email}
                    </Text>
                  </Box>
                  <MenuDivider />
                  {/* One correction, and then it is an administrator's job.
                      The gate above takes the name and roll number in a hurry,
                      on a first sign-in, and locks them because result sheets
                      are read by them — but a student who mistyped their own
                      roll number should not need to find an administrator for
                      it. The item disappears the moment the edit is spent
                      (`canCorrectIdentity`, decided server-side), and says on
                      its face that it is the only one. */}
                  {me.canCorrectIdentity && (
                    <MenuItem color={menuTextColor} onClick={identityEdit.onOpen}>
                      <HStack spacing={2} w="100%">
                        <Text fontSize="sm">Edit name & roll number</Text>
                        <Box flex="1" />
                        <Badge colorScheme="orange" borderRadius="full" px={2} fontSize="0.65rem">
                          One-time
                        </Badge>
                      </HStack>
                    </MenuItem>
                  )}
                  <MenuItem color={menuTextColor} onClick={logoutModal.onOpen}>
                    Log out
                  </MenuItem>
                </MenuList>
              </Menu>
            )}
          </Flex>
        </Container>
      </Box>

      <Container maxW="1400px" py={{ base: 3, md: 6 }} px={{ base: 3, md: 4 }} w="100%">
        <Flex gap={6} align="flex-start">
          <Box
            as="nav"
            display={{ base: 'none', md: 'block' }}
            w="220px"
            flexShrink={0}
            position="sticky"
            top="88px"
          >
            <NavItems
              studentOnly={studentOnly}
              isAdmin={Boolean(me?.isAdmin)}
              isHod={Boolean(me?.isHod)}
              isDean={Boolean(me?.isDean)}
              sections={dashSections}
            />
            <ClassSwitcher
              classes={classes}
              activeClassId={activeClassId}
              carriedTab={carriedTab}
            />
            <DevTeamCta />
          </Box>

          <Box flex="1" minW={0} w="100%">
            <Outlet context={{ me, overview, reloadOverview: load }} />
          </Box>
        </Flex>
      </Container>

      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>
            <Flex align="center" gap={2}>
              <LmIcon name="brand" size={20} />
              XCEED Learning
            </Flex>
          </DrawerHeader>
          <DrawerBody>

            <NavItems
              onNavigate={onClose}
              studentOnly={studentOnly}
              isAdmin={Boolean(me?.isAdmin)}
              isHod={Boolean(me?.isHod)}
              isDean={Boolean(me?.isDean)}
              sections={dashSections}
            />
            <ClassSwitcher
              classes={classes}
              activeClassId={activeClassId}
              carriedTab={carriedTab}
              onNavigate={onClose}
            />
            <DevTeamCta onNavigate={onClose} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Mounted only once opened: the lazy chunk should not be fetched by every
          account that merely has the menu item. */}
      {identityEdit.isOpen && (
        <Suspense fallback={null}>
          <EditIdentityModal
            isOpen={identityEdit.isOpen}
            onClose={identityEdit.onClose}
            // `load` re-reads the profile, which is what removes the menu item
            // and puts the corrected name in the header.
            onSaved={load}
          />
        </Suspense>
      )}

      <Modal isOpen={logoutModal.isOpen} onClose={logoutModal.onClose} isCentered size="sm">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="lg">Log out</ModalHeader>
          <ModalBody>
            <Text>Are you sure you want to log out?</Text>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={logoutModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={confirmLogout}>
              Log out
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
