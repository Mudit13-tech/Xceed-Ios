import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  SimpleGrid,
  Spinner,
  Switch,
  Text,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { FiExternalLink, FiSave } from 'react-icons/fi';
import getEnvironment from '../getenvironment';
import { ALL_MENUS, LEADERSHIP_MENU_KEYS } from '../attendancemodule/menuCatalogue';

const apiUrl = getEnvironment();

/**
 * Which iLEED screens the two leadership views carry — a panel on the Academic
 * Administration screen, below the learning module's.
 *
 * It sits here for the same reason the appointments and the learning module's
 * panel do: who heads a department, who is Dean (Academic), and what each of
 * them may look at are one subject and one decision, and an administrator
 * making a round of appointments should not have to remember that half of the
 * answer lives inside the attendance module's own settings.
 *
 * ── Two audiences, two documents, one list of screens.
 *
 * The HOD column edits `hodMenus` and the Dean column edits `deanMenus`, two
 * separate fields with separate values on one institute-wide settings document
 * — see server/src/models/attendanceModule/leadershipMenuSettings.js, which
 * also records why they no longer live on the Batch model (a save used to go
 * nowhere when no batch existed, and adding an intake year reverted both sets
 * to "everything off"). That separation is the point: an institute that wants
 * the dean reading institute-wide reports very often does not want every head
 * watching a live camera preview, and a shared field would make those the same
 * decision. The screens themselves come from one catalogue, so the two columns
 * cannot come to disagree about what a menu is — see
 * attendancemodule/menuCatalogue.js.
 *
 * ── The HOD column is the same data as the attendance module's.
 *
 * Dept Menu Config still carries its Head of Department section, unchanged, and
 * this column reads and writes the very same document through the very same
 * endpoint. Two screens onto one setting, deliberately: whichever an
 * administrator opens, they are editing the same thing and will see what the
 * other one saved. There is no second copy to keep in step.
 *
 * ── It is a display preference, not an authorisation boundary.
 *
 * Both views are already gated by `attendanceLeadershipReadAccess` and refused
 * any request that is not a GET by `refuseAttendanceWrites`. A toggle here
 * grants visibility, never the ability to change anything — which is what
 * makes it safe that both views are now offered every iLEED screen: the
 * operational ones show their data and every button on them is refused.
 *
 * A toggle here is the control, in all three places it has to be: the link
 * leaves the shell's sidebar, the screen below refuses to render, and the
 * endpoints it reads close — `requireLeadershipMenu` is mounted on every iLEED
 * data mount a head or the Dean can reach, and reads whichever of the two
 * documents belongs to the viewer. Switching a menu off and being told by a
 * head that they can still open it is the bug this closed.
 *
 * What it is still NOT is an authorisation boundary. Every read behind it was
 * already scoped by the handlers and refused any method but a GET; this makes
 * a display preference enforceable, which is a different thing from being what
 * keeps anybody's data from anybody.
 *
 * ── View opens the real screen, not a copy of it.
 *
 * Unlike the learning module's panel, which links to `lm-admin` twins of its
 * dashboards, these go straight to `/ileed-hod` and `/ileed-dean`. No twin is
 * needed: `checkRole` lets the `admin` role past every gate, and
 * `resolveAttendanceAccess` has an explicit admin branch that sets
 * `attendanceFullAccess` with no department — so an administrator opening a
 * head's dashboard sees it at institute scope rather than being refused for
 * heading no department. What they are checking is which panels the toggles
 * above put on the screen, and that is the same answer at either scope.
 *
 * The gates above leave that intact in both directions. `requireLeadershipMenu`
 * defers for an admin, who is not a read-only viewer, so no endpoint closes on
 * them; the shells' own guard does apply, because it reads the toggles rather
 * than the viewer — which is what makes View a preview worth opening. An admin
 * following it sees the head's menu, and a screen the head cannot open answers
 * them the way it answers the head.
 */

const AUDIENCES = [
  {
    key: 'hod',
    field: 'hodMenus',
    endpoint: '/attendancemodule/settings/batches/hod-menus',
    view: '/ileed-hod/dashboard',
    title: 'HOD — iLEED menus',
    blurb:
      "What a head of department may look at, scoped to the department they head. Every iLEED screen can be given to them, and all of them are read-only. The same setting as the Head of Department section in the attendance module's Dept Menu Config.",
    accent: 'blue',
  },
  {
    key: 'dean',
    field: 'deanMenus',
    endpoint: '/attendancemodule/settings/batches/dean-menus',
    view: '/ileed-dean/dashboard',
    title: 'Dean (Academic) — iLEED menus',
    blurb:
      'What the Dean (Academic) may look at, across every department at once. The same screens as a head, at institute scope, and equally read-only. Its own document, so it need not match the heads.',
    accent: 'purple',
  },
];

/**
 * Which menus these views draw — now every one of them, in both shells.
 *
 * One set rather than one per audience, because the two shells carry the same
 * screens again: a dean reads every department where a head reads the one they
 * head, and that is a difference of scope, not of which pages exist. Derived
 * from the layouts' own catalogue, so a screen added to them is marked here
 * without this file being edited.
 *
 * This was once per audience, and that was not paranoia — the shells really
 * did differ, and a single shared set had the HOD column promising a screen
 * only the Dean had. If they diverge again, this goes back to being per
 * audience at the same time, not afterwards.
 */
const hasScreen = new Set(LEADERSHIP_MENU_KEYS);

const AttendanceMenusPanel = () => {
  // Per audience: the stored map, or null while it is still being read. Kept
  // apart from `loading` so one column failing to load cannot blank the other.
  const [values, setValues] = useState({ hod: null, dean: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  // Which columns have been edited since they were last read or saved, so the
  // Save button says something true rather than being permanently available.
  const [dirty, setDirty] = useState({});
  const toast = useToast();

  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const rowBorder = useColorModeValue('gray.100', 'gray.700');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        AUDIENCES.map(async (audience) => {
          try {
            const res = await fetch(`${apiUrl}${audience.endpoint}`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.message || 'Failed to load');
            return [audience.key, data[audience.field] || {}];
          } catch (err) {
            if (!cancelled) {
              toast({
                title: `Could not load the ${audience.key === 'dean' ? 'Dean' : 'HOD'} menus`,
                description: err.message,
                status: 'error',
                duration: 5000,
                isClosable: true,
              });
            }
            return [audience.key, null];
          }
        }),
      );

      if (cancelled) return;
      setValues(Object.fromEntries(results));
      setDirty({});
      setLoading(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Absent means OFF here, which is the opposite of the learning module's panel
  // above and matches this module's own rule: every key on `hodMenus` and
  // `deanMenus` defaults to false, because a leadership view opens from a role
  // card the moment the appointment is made and nothing beyond its dashboard
  // should open until an admin has deliberately said so.
  const isOn = (audienceKey, menuKey) => values[audienceKey]?.[menuKey] === true;

  const toggle = (audienceKey, menuKey) => {
    setValues((current) => ({
      ...current,
      [audienceKey]: { ...(current[audienceKey] || {}), [menuKey]: !isOn(audienceKey, menuKey) },
    }));
    setDirty((current) => ({ ...current, [audienceKey]: true }));
  };

  // Written against the whole catalogue rather than against the keys already
  // stored, so a menu added to the list is included by "Enable all" even on a
  // document saved before it existed.
  const setAll = (audienceKey, value) => {
    setValues((current) => ({
      ...current,
      [audienceKey]: Object.fromEntries(ALL_MENUS.map((menu) => [menu.key, value])),
    }));
    setDirty((current) => ({ ...current, [audienceKey]: true }));
  };

  const save = async (audience) => {
    setSaving(audience.key);
    try {
      const res = await fetch(`${apiUrl}${audience.endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [audience.field]: values[audience.key] || {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to save');
      // Taken from the response rather than left as typed, so the form shows
      // what was actually stored rather than what was sent.
      setValues((current) => ({
        ...current,
        [audience.key]: data[audience.field] || current[audience.key],
      }));
      setDirty((current) => ({ ...current, [audience.key]: false }));
      toast({
        title: `${audience.key === 'dean' ? 'Dean' : 'HOD'} iLEED menus updated`,
        description: 'Anyone with that view sees the change on their next visit.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err.message,
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Box bg={cardBg} borderWidth="1px" borderColor={border} borderRadius="xl" p={6} mt={8}>
      <Box mb={4}>
        <Heading as="h2" size="md">
          What each iLEED view shows
        </Heading>
        <Text color={subColor} fontSize="sm" mt={1}>
          The attendance module&apos;s read-only views, for the two appointments above. Each
          column is its own setting, and everything is off until you turn it on.
        </Text>
      </Box>

      <Alert status="info" borderRadius="md" mb={5} fontSize="sm">
        <AlertIcon />
        <Box>
          These control what appears on a screen, not who may open it — both views are
          already restricted to the role they are named after, and refuse anything that is
          not a read. The HOD column is the same setting as the Head of Department section
          in the attendance module&apos;s Dept Menu Config; editing it in either place edits
          the same document. <strong>View</strong> opens that view in a new tab, at
          institute scope, so you can see what these switches put on the screen.
        </Box>
      </Alert>

      {loading ? (
        <Flex justify="center" py={8}>
          <Spinner />
        </Flex>
      ) : (
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          {AUDIENCES.map((audience) => {
            const stored = values[audience.key];
            const enabledCount = stored
              ? ALL_MENUS.filter((menu) => stored[menu.key] === true).length
              : 0;

            return (
              <Box
                key={audience.key}
                borderWidth="1px"
                borderColor={border}
                borderRadius="lg"
                p={4}
              >
                <Flex justify="space-between" align="flex-start" gap={3} mb={3} wrap="wrap">
                  <Box>
                    <Heading as="h3" size="sm">
                      {audience.title}
                    </Heading>
                    <Text fontSize="xs" color={subColor}>
                      {audience.blurb}
                    </Text>
                  </Box>
                  <Flex gap={2} flexShrink={0}>
                    {/* A new tab rather than a navigation: leaving this screen
                        to look at the view would throw away unsaved toggles,
                        and comparing the two is the whole point. */}
                    <Button
                      as="a"
                      href={audience.view}
                      target="_blank"
                      rel="noreferrer"
                      size="sm"
                      variant="outline"
                      colorScheme={audience.accent}
                      leftIcon={<FiExternalLink />}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      colorScheme={audience.accent}
                      leftIcon={<FiSave />}
                      onClick={() => save(audience)}
                      isLoading={saving === audience.key}
                      isDisabled={!dirty[audience.key] || !stored}
                    >
                      Save
                    </Button>
                  </Flex>
                </Flex>

                {!stored ? (
                  // One column failing to load leaves the other usable. Saving
                  // it is what would be dangerous: with nothing read, every
                  // switch would read "off" and a save would write that.
                  <Text fontSize="sm" color={subColor} py={6}>
                    These menus could not be loaded, so they cannot be edited here. Reload the
                    page to try again.
                  </Text>
                ) : (
                  <>
                    <Flex gap={2} align="center" mb={2} wrap="wrap">
                      <Button size="xs" variant="outline" onClick={() => setAll(audience.key, true)}>
                        Enable all
                      </Button>
                      <Button size="xs" variant="outline" onClick={() => setAll(audience.key, false)}>
                        Disable all
                      </Button>
                      <Badge ml="auto" colorScheme={audience.accent} borderRadius="full" px={2}>
                        {enabledCount} / {ALL_MENUS.length} enabled
                      </Badge>
                    </Flex>

                    {ALL_MENUS.map((menu) => {
                      const on = isOn(audience.key, menu.key);
                      return (
                        <Flex
                          key={menu.key}
                          align="flex-start"
                          justify="space-between"
                          gap={3}
                          py={3}
                          borderTopWidth="1px"
                          borderColor={rowBorder}
                        >
                          <Box>
                            <Flex align="center" gap={2} wrap="wrap">
                              <Text fontSize="sm" fontWeight="600">
                                {menu.label}
                              </Text>
                              {/* Every menu has a screen in both shells
                                  today — see hasScreen, and the note there
                                  about what happens if that stops being
                                  true. */}
                              {hasScreen.has(menu.key) && (
                                <Badge colorScheme="green" fontSize="0.6rem" borderRadius="full" px={2}>
                                  has a screen
                                </Badge>
                              )}
                            </Flex>
                            <Text fontSize="xs" color={subColor}>
                              {menu.desc}
                            </Text>
                          </Box>
                          <Switch
                            colorScheme={audience.accent}
                            isChecked={on}
                            onChange={() => toggle(audience.key, menu.key)}
                            aria-label={`${menu.label} on the ${audience.title}`}
                            flexShrink={0}
                            mt={1}
                          />
                        </Flex>
                      );
                    })}
                  </>
                )}
              </Box>
            );
          })}
        </SimpleGrid>
      )}

      <Text fontSize="xs" color={subColor} mt={4}>
        Every menu here has a screen behind it in both views: a head of department sees
        their own department, the Dean (Academic) sees every department. Both are read-only
        whatever is enabled — the operational screens (capture, roll assignment, ERP upload,
        embeddings, extra and altering classes) show their data, and the server refuses
        anything that would change it.
      </Text>
    </Box>
  );
};

export default AttendanceMenusPanel;
