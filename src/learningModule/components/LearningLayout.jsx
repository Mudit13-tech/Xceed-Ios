import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, NavLink, Outlet, useMatch } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Heading,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
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
import { looksLikeEmail } from '../displayName';
import NotificationBell from './NotificationBell';
import { buttonTextStyles } from './common';

// Split out of the shell: every student sees it exactly once, and nobody else
// ever does, so it has no business in the bundle that loads on every page.
const CompleteProfile = lazy(() => import('../pages/CompleteProfile'));

// Opened from the account menu, by anyone whose name still reads as their email
// address — and by anyone who simply mistyped it. Lazy for the same reason:
// most sessions never open it.
const EditNameDialog = lazy(() => import('./EditNameDialog'));

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
  { to: '/learning', label: 'Classes', icon: '🏫', end: true },
  { to: '/learning/todo', label: 'To-do', icon: '✅' },
  { to: '/learning/calendar', label: 'Calendar', icon: '📅' },
  { to: '/learning/timetable', label: 'Timetable', icon: '⏰' },
  { to: '/learning/notifications', label: 'Notifications', icon: '🔔' },
  // Where the "you were marked Present/Absent" mail and notification land.
  // Students only: staff read the same markings from the attendance module,
  // and nobody else has a roll number to look up.
  { to: '/learning/attendance', label: 'My attendance', icon: '🪪', studentOnly: true },
  // Points and badges are a student's record. Staff earn none — they set the
  // work rather than doing it, and the leaderboard leaves them off entirely —
  // so a "My progress" that was always empty would only invite the question.
  { to: '/learning/profile', label: 'My progress', icon: '🎖️', studentOnly: true },
  // Last, and separated below. Reporting something broken — or asking for
  // something better — is not navigation: it is what you do *instead* of what
  // you came here for, and it has to be reachable from wherever the thing broke.
  { to: '/learning/bugs', label: 'Bug / Suggestion', icon: '🛠️', foot: true },
  // Platform-wide stats and queues at a glance. Only an lm-admin (or other
  // platform-admin) account can open it — the server 403s everyone else — so
  // the link itself is hidden rather than left to dead-end.
  { to: '/learning/lm-admin', label: 'Admin', icon: '🛡️', foot: true, adminOnly: true },
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
        <Text as="span">🚀</Text>
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
function ClassSwitcher({ classes, activeClassId, carriedTab, onNavigate }) {
  if (!classes) return null;

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

function NavItems({ onNavigate, studentOnly = false, isAdmin = false }) {
  const navColor = useColorModeValue('gray.700', 'gray.200');
  const navBorderColor = useColorModeValue('gray.200', 'gray.700');
  const navHoverBg = useColorModeValue('gray.100', 'gray.700');
  const activeBg = useColorModeValue('blue.50', 'blue.900');
  const activeColor = useColorModeValue('blue.700', 'blue.100');

  return (
    <>
      {NAV_ITEMS.filter((item) => (!item.studentOnly || studentOnly) && (!item.adminOnly || isAdmin)).map((item) => (
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
          <Text as="span">{item.icon}</Text>
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
  const [overview, setOverview] = useState(null);
  const [classes, setClasses] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  // The "Edit your name" dialog, kept apart from the drawer's disclosure above.
  const nameDialog = useDisclosure();
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

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${getEnvironment()}/user/getuser/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      // A failed call must not strand the user on a signed-in screen; the
      // local token still goes and the login page re-checks the session.
      console.error('Error during logout:', error.message);
    }
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  }, [navigate]);

  const mayCreateClass = canCreateClass(me?.roles);
  // Students have no platform navbar above this header, so it owns the page.
  const studentOnly = isStudentOnly(me?.roles);
  /**
   * Whether this account is going by its email address instead of a name.
   *
   * Students are marched through `CompleteProfile` for it, but staff have no
   * roll number to give and so never meet that gate — for them this prompt in
   * the account menu is the only way the placeholder ever gets corrected. The
   * server decides it (`lmAuth.nameIsEmail`); the local check is the fallback
   * for a `/me` served before that flag existed.
   */
  const nameIsEmail = Boolean(me && (me.nameIsEmail ?? looksLikeEmail(me.name)));

  /**
   * A student who has not yet given their name and roll number gets that form
   * and nothing else.
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
              icon={<span>☰</span>}
              onClick={onOpen}
              ml={-2}
              mr={-1}
            />
            <Flex as={RouterLink} to="/learning" align="center" gap={2} _hover={{ textDecoration: 'none' }}>
              <Text fontSize="xl">🎓</Text>
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
                onClick={handleLogout}
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
                    {/* Said plainly, because the account is being shown to
                        teachers and printed on result sheets under an address
                        rather than a name, and nothing else on screen makes
                        that look like a mistake. */}
                    {nameIsEmail && (
                      <Text fontSize="xs" color="orange.400" mt={1}>
                        Your email address is being used as your name.
                      </Text>
                    )}
                  </Box>
                  <MenuDivider />
                  <MenuItem
                    color={nameIsEmail ? 'orange.400' : menuTextColor}
                    onClick={nameDialog.onOpen}
                  >
                    {nameIsEmail ? 'Set your name' : 'Edit your name'}
                  </MenuItem>
                  <MenuItem color={menuTextColor} onClick={handleLogout}>
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
            <NavItems studentOnly={studentOnly} isAdmin={Boolean(me?.isAdmin)} />
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
            <Icon as="span">🎓</Icon> XCEED Learning
          </DrawerHeader>
          <DrawerBody>

            <NavItems onNavigate={onClose} studentOnly={studentOnly} isAdmin={Boolean(me?.isAdmin)} />
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

      {nameDialog.isOpen && (
        <Suspense fallback={null}>
          {/* `load` re-reads /me, so the header stops showing the address the
              moment the name is saved. */}
          <EditNameDialog
            isOpen={nameDialog.isOpen}
            onClose={nameDialog.onClose}
            onSaved={load}
          />
        </Suspense>
      )}
    </Box>
  );
}
