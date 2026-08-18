import React from 'react';
import { Badge, Box, Grid, HStack, Text, VStack } from '@chakra-ui/react';

/**
 * A week's timetable that fits the screen it is on.
 *
 * ## Why not the existing table
 *
 * `timetableadmin/viewtt` renders a `TableContainer` with `overflowX="auto"` and
 * `minW` on every cell, so on a phone the week is a strip you drag sideways. That
 * is defensible for the admin who is editing eight periods across six days and
 * needs every column at a readable width. It is the wrong answer for a student
 * asking "what have I got today", because the answer is off-screen and they have to
 * go looking for it.
 *
 * This follows the Calendar's approach instead: a CSS grid whose columns are
 * `1fr` each, so they divide whatever width there is, with type and padding that
 * step down at the small breakpoint. Nothing overflows and nothing scrolls
 * horizontally. Cells get narrow on a phone — that is the trade — so the content
 * inside them is ordered by what a student needs first: subject, then room, then
 * faculty, with the last two dropping to a smaller line rather than being cut off.
 *
 * ## The two layouts
 *
 * A week-grid is genuinely unreadable below about 480 px however carefully it is
 * scaled: six columns of a four-character subject code is not information, it is
 * decoration. So under `md` this renders **day by day** — a short stack of
 * "Period 3 · DSP · L-204" rows per day, which is the same data in the shape a
 * phone can actually show. Above `md` it is the grid.
 *
 * Both are rendered and one is hidden by breakpoint rather than switched on a
 * `useBreakpointValue`, so there is no flash of the wrong layout on first paint
 * while the hook works out the width.
 */

/** Days across the top, slots down the side — the way a timetable is read. */
export default function TimetableGrid({ days = [], slots = [], cells = {} }) {
  const entriesAt = (day, slot) => cells[`${day}|${slot}`] || [];
  const shortDay = (day) => day.slice(0, 3);

  if (!days.length || !slots.length) return null;

  return (
    <Box>
      {/* ── the week, on anything wider than a phone ─────────────────── */}
      <Box display={{ base: 'none', md: 'block' }}>
        <Grid
          // One narrow column for the slot label, then an equal share for each day.
          // `minmax(0, 1fr)` rather than `1fr`: without the zero minimum a long
          // subject name forces the column wider than its share and brings back the
          // horizontal scroll this exists to remove.
          templateColumns={`minmax(0, 0.7fr) repeat(${days.length}, minmax(0, 1fr))`}
          gap={1}
        >
          <Box />
          {days.map((day) => (
            <Text
              key={day}
              fontSize="xs"
              fontWeight="700"
              color="lmFg.subtle"
              textAlign="center"
              py={1}
              textTransform="uppercase"
              letterSpacing="0.03em"
            >
              {day}
            </Text>
          ))}

          {slots.map((slot) => (
            <React.Fragment key={slot.key}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="flex-end"
                pr={2}
                py={2}
              >
                <Text fontSize="2xs" fontWeight="600" color="lmFg.muted" textAlign="right" noOfLines={2}>
                  {slot.label}
                </Text>
              </Box>

              {days.map((day) => {
                const entries = entriesAt(day, slot.key);
                const free = entries.length === 0;
                return (
                  <Box
                    key={`${day}-${slot.key}`}
                    minH="56px"
                    borderWidth="1px"
                    borderColor={free ? 'lmBorder.subtle' : 'lmHue.purple200'}
                    bg={free ? 'lmBg.sunken' : 'lmHue.purple50'}
                    borderRadius="md"
                    p={1.5}
                    overflow="hidden"
                  >
                    <VStack align="stretch" spacing={1}>
                      {entries.map((entry, index) => (
                        <Box key={index}>
                          <Text fontSize="xs" fontWeight="700" color="lmHue.purple800" noOfLines={2}>
                            {entry.subject || '—'}
                          </Text>
                          {/* Room before faculty: a student on the way to a class
                              needs the place first. Both are `noOfLines` rather
                              than truncated mid-word so a narrow column loses the
                              tail of a name instead of the whole line. */}
                          {entry.room && (
                            <Text fontSize="2xs" color="lmFg.subtle" noOfLines={1}>
                              {entry.room}
                            </Text>
                          )}
                          {entry.faculty && (
                            <Text fontSize="2xs" color="lmFg.muted" noOfLines={1}>
                              {entry.faculty}
                            </Text>
                          )}
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                );
              })}
            </React.Fragment>
          ))}
        </Grid>
      </Box>

      {/* ── day by day, on a phone ───────────────────────────────────── */}
      <VStack display={{ base: 'flex', md: 'none' }} align="stretch" spacing={3}>
        {days.map((day) => {
          const rows = slots
            .map((slot) => ({ slot, entries: entriesAt(day, slot.key) }))
            .filter((row) => row.entries.length > 0);

          return (
            <Box key={day} borderWidth="1px" borderColor="lmBorder.base" borderRadius="lg" overflow="hidden">
              <Box bg="lmHue.purple50" px={3} py={2}>
                <HStack justify="space-between">
                  <Text fontSize="sm" fontWeight="700" color="lmHue.purple800">
                    {day}
                  </Text>
                  <Badge colorScheme={rows.length ? 'purple' : 'gray'} fontSize="2xs">
                    {rows.length ? `${rows.length} class${rows.length === 1 ? '' : 'es'}` : 'free'}
                  </Badge>
                </HStack>
              </Box>

              {rows.length === 0 ? (
                <Text fontSize="xs" color="lmFg.muted" px={3} py={2}>
                  Nothing scheduled.
                </Text>
              ) : (
                <VStack align="stretch" spacing={0}>
                  {rows.map(({ slot, entries }, rowIndex) => (
                    <Box
                      key={slot.key}
                      px={3}
                      py={2}
                      borderTopWidth={rowIndex ? '1px' : 0}
                      borderColor="lmBorder.subtle"
                    >
                      <Text fontSize="2xs" color="lmFg.muted" fontWeight="600" textTransform="uppercase">
                        {slot.label}
                      </Text>
                      {entries.map((entry, index) => (
                        <Box key={index} mt={index ? 1 : 0.5}>
                          <Text fontSize="sm" fontWeight="600">
                            {entry.subject || '—'}
                          </Text>
                          {(entry.room || entry.faculty) && (
                            <Text fontSize="xs" color="lmFg.subtle">
                              {[entry.room, entry.faculty].filter(Boolean).join(' · ')}
                            </Text>
                          )}
                        </Box>
                      ))}
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>
          );
        })}
      </VStack>

      {/* Only the days and slots this timetable uses are drawn, which is what keeps
          the grid inside the width. A department running six periods gets six rows,
          not six plus two empty ones, and Saturday appears only where it is taught. */}
      <Text fontSize="2xs" color="lmFg.muted" mt={3}>
        Showing {slots.length} slot{slots.length === 1 ? '' : 's'} across {days.length} day
        {days.length === 1 ? '' : 's'} — only the periods this timetable uses.
      </Text>
    </Box>
  );
}
