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
import { FiSave } from 'react-icons/fi';
import getEnvironment from '../getenvironment';
import { ALL_MENUS, leadershipMenuKeysFor } from '../attendancemodule/menuCatalogue';

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
 * Both views are already gated by `attendanceLeadershipReadAccess`, refused any
 * request that is not a GET by `refuseAttendanceWrites`, and re-checked per
 * menu on the server by `requireHodMenu` / `requireDeanMenu`. A toggle here
 * grants visibility, never the ability to change anything.
 */

const AUDIENCES = [
  {
    key: 'hod',
    field: 'hodMenus',
    endpoint: '/attendancemodule/settings/batches/hod-menus',
    title: 'HOD — iLEED menus',
    blurb:
      "What a head of department may look at, scoped to the department they head. The same setting as the Head of Department section in the attendance module's Dept Menu Config.",
    accent: 'blue',
  },
  {
    key: 'dean',
    field: 'deanMenus',
    endpoint: '/attendancemodule/settings/batches/dean-menus',
    title: 'Dean (Academic) — iLEED menus',
    blurb:
      'What the Dean (Academic) may look at, across every department at once. Its own document, so it need not match the heads.',
    accent: 'purple',
  },
];

/**
 * Which menus each column's view actually draws, per audience.
 *
 * Per audience and not one shared set, because the two views do not draw the
 * same screens: Confidence Monitor and Class Verification are the Dean's and
 * not a head's, and are not merely unlinked in the HOD shell — there is no
 * route for them under `/ileed-hod` at all. Marked as one list, the HOD column
 * told an administrator those two switches "had a screen"; they turned them on
 * and nothing ever appeared. Derived from the layouts' own catalogue, so a
 * screen added to either view is marked here without this file being edited.
 */
const screensFor = {
  hod: new Set(leadershipMenuKeysFor('hod')),
  dean: new Set(leadershipMenuKeysFor('dean')),
};

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
          the same document.
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
                              {/* Which menus THIS column's view draws today
                                  — see screensFor. The other toggles are
                                  stored and honoured by the server, but no
                                  link appears for them, and an admin
                                  switching one on deserves to be told rather
                                  than to go looking. */}
                              {screensFor[audience.key].has(menu.key) && (
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
        Menus marked <b>has a screen</b> are the ones that column&apos;s view draws today. The
        head of department&apos;s view has the dashboard, attendance reports and the manual;
        the Dean&apos;s has those plus the confidence monitor and class verification, which
        judge the recognition system rather than report a department&apos;s attendance. Every
        other toggle is stored and enforced by the server, but draws no link yet — turning
        one on changes nothing visible until its screen arrives.
      </Text>
    </Box>
  );
};

export default AttendanceMenusPanel;
