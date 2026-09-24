import React from 'react';
import { Box, Link, Text, Tooltip } from '@chakra-ui/react';

import { LmIcon } from './Icon';
import useRoomLocations from '../hooks/useRoomLocations';

/**
 * A class's room, with the way to it.
 *
 * The room number was already on the class card and was already the least
 * useful thing on it for anybody who did not know the campus: "CR205" tells a
 * first-year student nothing, and the map that would tell them sat behind the
 * classroom directory, in another module, two navigations away.
 *
 * The timetable module has held a Google Maps link per room all along — the
 * `landMark` on a master room, which is what the directory opens. This puts it
 * where the room is named.
 *
 * ## Why each room is its own link
 *
 * A class's `room` is whatever the timetable allotted it, and a subject taught
 * in a lecture theatre and a lab arrives as "LT1, CS-LAB-2". One pin for the
 * pair would have to pick one, so each room carries its own.
 *
 * A room the timetable has no location for keeps its name and gets no pin,
 * rather than a pin that goes nowhere.
 */
/**
 * The rooms in a class's `room` string, each listed once.
 *
 * Every slot of a class carries a room, and most classes meet in the same one
 * all week — so the list is collapsed: one room when every slot is in it, one
 * entry per room when they are not.
 *
 * Deduplicated by a folded key rather than by folding the value, so a room
 * written two ways is still one room and keeps the spelling the timetable uses.
 * That matters: the spelling is what the map lookup matches on.
 */
const distinctRooms = (room) => {
  const byKey = new Map();
  String(room || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => {
      const key = name.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, name);
    });
  return [...byKey.values()];
};

export default function RoomWithMap({ room, fontSize = 'sm', iconSize = 13 }) {
  const names = distinctRooms(room);

  const locations = useRoomLocations(names);

  if (!names.length) return null;

  return (
    <>
      {names.map((name, index) => {
        const mapUrl = locations[name]?.mapUrl;
        const where = [locations[name]?.building, locations[name]?.floor && `Floor ${locations[name].floor}`]
          .filter(Boolean)
          .join(' · ');

        return (
          <Box as="span" key={name} whiteSpace="nowrap">
            {index > 0 && <Text as="span">, </Text>}
            <Text as="span" fontSize={fontSize}>
              {name}
            </Text>
            {mapUrl && (
              <Tooltip label={where ? `${name} — ${where}` : `Find ${name} on the map`} openDelay={400}>
                <Link
                  href={mapUrl}
                  isExternal
                  aria-label={`Find ${name} on the map`}
                  display="inline-flex"
                  alignItems="center"
                  verticalAlign="text-bottom"
                  ml={1}
                  // The room text around it may be a link to the class itself,
                  // and a pin that opened the class instead of the map would be
                  // the one thing this is for.
                  onClick={(event) => event.stopPropagation()}
                  _hover={{ opacity: 1, transform: 'scale(1.15)' }}
                  opacity={0.85}
                  transition="all 0.15s"
                >
                  <LmIcon name="location" size={iconSize} />
                </Link>
              </Tooltip>
            )}
          </Box>
        );
      })}
    </>
  );
}
