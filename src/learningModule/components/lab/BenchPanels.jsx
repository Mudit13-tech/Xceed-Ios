import React from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Heading,
  Input,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
} from '@chakra-ui/react';
import { symbolFor } from './symbols';
import { eng, phase } from './format';

/**
 * The panels around the canvas: what you can place, what the thing you selected is
 * set to, and what the instruments said.
 *
 * Three small components in one file because they only ever appear together, and
 * they share the value formatting and the symbol table.
 */

/* ──────────────────────────────── palette ─────────────────────────────── */

/** One symbol, drawn small, as its own draggable tile. */
function PaletteTile({ part, onPlace }) {
  const symbol = symbolFor(part.type);
  const [w, h] = symbol.box;
  const pad = 8;

  return (
    <Tooltip label={part.hint || part.name} placement="right" openDelay={400}>
      <Box
        draggable
        // The drag payload is the type and nothing else. The canvas mints the id
        // and reads the defaults from this same catalogue, so a dropped part
        // cannot arrive half-described.
        onDragStart={(event) => event.dataTransfer.setData('application/x-lab-part', part.type)}
        // Click as well as drag: dragging is fiddly on a touchscreen, and a lab
        // that can only be built with a mouse excludes anyone on a tablet.
        onClick={() => onPlace(part.type)}
        cursor="grab"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="md"
        p={2}
        bg="white"
        _hover={{ borderColor: 'teal.400', bg: 'teal.50' }}
        textAlign="center"
      >
        <Box
          as="svg"
          viewBox={`${-w / 2 - pad} ${-h / 2 - pad} ${w + pad * 2} ${h + pad * 2}`}
          width="100%"
          height="34px"
          color="gray.700"
        >
          {symbol.draw({ type: part.type, values: part.defaults })}
        </Box>
        <Text fontSize="10px" color="gray.600" noOfLines={1} mt={1}>
          {part.name}
        </Text>
      </Box>
    </Tooltip>
  );
}

export function Palette({ parts = [], onPlace }) {
  // Grouped the way a bench is laid out rather than alphabetically: sources and
  // passives are what you reach for first, instruments are what you add to
  // measure, and semiconductors are a separate box of parts.
  const groups = [
    { label: 'Sources', types: ['vsource', 'isource', 'ground'] },
    { label: 'Passive', types: ['resistor', 'rheostat', 'capacitor', 'inductor'] },
    { label: 'Instruments', types: ['ammeter', 'voltmeter', 'wattmeter', 'cro', 'dso'] },
    { label: 'Semiconductors', types: ['diode', 'npn', 'pnp', 'opamp'] },
  ];

  const byType = new Map(parts.map((part) => [part.type, part]));

  return (
    <VStack align="stretch" spacing={3}>
      {groups.map((group) => {
        const available = group.types.map((type) => byType.get(type)).filter(Boolean);
        // A group with nothing in it is not shown at all — an empty
        // "Semiconductors" heading on the electrical bench would read as a bug.
        if (!available.length) return null;
        return (
          <Box key={group.label}>
            <Text fontSize="xs" fontWeight="700" color="gray.500" mb={1} textTransform="uppercase">
              {group.label}
            </Text>
            <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
              {available.map((part) => (
                <PaletteTile key={part.type} part={part} onPlace={onPlace} />
              ))}
            </Box>
          </Box>
        );
      })}
    </VStack>
  );
}

/* ─────────────────────────── the selected part ────────────────────────── */

/**
 * The values of whatever is selected.
 *
 * `live` fields — a rheostat's setting — get a slider, because that is a knob a
 * student turns while the bench is running rather than a design decision. Everything
 * else is a number box. `advanced` fields are shown but visually demoted: a
 * transistor's reverse beta is real and occasionally wanted, and hiding it behind a
 * toggle would mean nobody ever finds it.
 */
export function PartInspector({ component, part, onChange, onDelete, onRotate, readOnly }) {
  if (!component) {
    return (
      <Text fontSize="sm" color="gray.500">
        Select a component on the bench to change its value, or drop a new one from the palette.
      </Text>
    );
  }

  const setValue = (key, raw) => {
    const value = raw === '' ? '' : Number(raw);
    onChange({ ...component, values: { ...component.values, [key]: value } });
  };

  return (
    <VStack align="stretch" spacing={3}>
      <Flex justify="space-between" align="center">
        <Box>
          <Heading size="sm">{part?.name || component.type}</Heading>
          <Text fontSize="xs" color="gray.500">
            {component.label || component.id}
          </Text>
        </Box>
        {!readOnly && (
          <HStack>
            <Tooltip label="Rotate 90°">
              <Button size="xs" variant="outline" onClick={onRotate}>
                ⟳
              </Button>
            </Tooltip>
            <Tooltip label="Remove from the bench">
              <Button size="xs" variant="ghost" colorScheme="red" onClick={onDelete}>
                ✕
              </Button>
            </Tooltip>
          </HStack>
        )}
      </Flex>

      {part?.hint && (
        <Text fontSize="xs" color="gray.600" bg="gray.50" p={2} borderRadius="md">
          {part.hint}
        </Text>
      )}

      {!readOnly && (
        <Box>
          <Text fontSize="xs" color="gray.500">
            Label
          </Text>
          <Input
            size="sm"
            value={component.label || ''}
            onChange={(event) => onChange({ ...component, label: event.target.value })}
          />
        </Box>
      )}

      {(part?.fields || []).map((field) => {
        const value = component.values?.[field.key];

        if (field.live) {
          const max = Number(component.values?.max) || field.max || 1000;
          return (
            <Box key={field.key}>
              <Flex justify="space-between">
                <Text fontSize="xs" color="gray.600">
                  {field.label}
                </Text>
                <Text fontSize="xs" fontWeight="700">
                  {eng(value ?? 0, field.unit)}
                </Text>
              </Flex>
              <Slider
                value={Number(value) || 0}
                min={0}
                max={max}
                step={Math.max(max / 200, 0.01)}
                onChange={(next) => setValue(field.key, next)}
                isDisabled={readOnly}
              >
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider>
            </Box>
          );
        }

        return (
          <Box key={field.key} opacity={field.advanced ? 0.75 : 1}>
            <Text fontSize="xs" color="gray.600">
              {field.label}
              {field.unit ? ` (${field.unit})` : ''}
              {field.advanced && (
                <Badge ml={1} fontSize="9px" colorScheme="gray">
                  advanced
                </Badge>
              )}
            </Text>
            <Input
              size="sm"
              type="number"
              value={value ?? ''}
              isDisabled={readOnly}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
          </Box>
        );
      })}

      {!(part?.fields || []).length && (
        <Text fontSize="xs" color="gray.500">
          Nothing to set — wire it in and run.
        </Text>
      )}
    </VStack>
  );
}

/* ───────────────────────────── the readings ───────────────────────────── */

/**
 * What the instruments said.
 *
 * A wattmeter gets three numbers and a power factor rather than one, because that
 * is the point of the instrument: a student who has only met P = VI meets real,
 * reactive and apparent power here, and seeing them side by side is the lesson.
 */
export function InstrumentReadings({ result }) {
  if (!result) {
    return (
      <Text fontSize="sm" color="gray.500">
        Press Run to solve the circuit and read the instruments.
      </Text>
    );
  }

  if (!result.ok) {
    return (
      <Box bg="red.50" borderWidth="1px" borderColor="red.200" borderRadius="md" p={3}>
        <Text fontSize="sm" fontWeight="600" color="red.700">
          The circuit did not solve
        </Text>
        <Text fontSize="sm" color="red.700" mt={1}>
          {result.message}
        </Text>
      </Box>
    );
  }

  const meters = (result.instruments || []).filter((meter) => meter.type !== 'cro' && meter.type !== 'dso');

  return (
    <VStack align="stretch" spacing={3}>
      {(result.warnings || []).map((warning) => (
        <Text key={warning} fontSize="xs" color="orange.700" bg="orange.50" p={2} borderRadius="md">
          {warning}
        </Text>
      ))}

      {!meters.length ? (
        <Text fontSize="sm" color="gray.500">
          The circuit solved, but there are no meters on the bench. Add an ammeter, a voltmeter or a
          wattmeter to measure something.
        </Text>
      ) : (
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th px={1}>Meter</Th>
              <Th px={1} isNumeric>
                Reading
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {meters.map((meter) => (
              <Tr key={meter.id}>
                <Td px={1}>
                  <Text fontSize="sm" fontWeight="600">
                    {meter.label}
                  </Text>
                  <Text fontSize="10px" color="gray.500" textTransform="uppercase">
                    {meter.type}
                  </Text>
                </Td>
                <Td px={1} isNumeric>
                  <Text fontSize="sm" fontWeight="700">
                    {eng(meter.magnitude, meter.unit)}
                  </Text>
                  {meter.type !== 'wattmeter' && result.analysis === 'ac' && (
                    <Text fontSize="10px" color="gray.500">
                      {phase(meter.phase)}
                    </Text>
                  )}
                  {meter.type === 'wattmeter' && (
                    <>
                      <Text fontSize="10px" color="gray.600">
                        {eng(meter.apparent, 'VA')} apparent · {eng(meter.reactive, 'VAr')} reactive
                      </Text>
                      <Text fontSize="10px" color="gray.600">
                        PF {Number(meter.powerFactor).toFixed(3)}
                      </Text>
                    </>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Divider />
      <Text fontSize="10px" color="gray.500">
        {result.analysis === 'ac'
          ? `Steady-state AC at ${result.frequency} Hz. Amplitudes are peak values.`
          : result.analysis === 'dc'
            ? 'DC operating point. Capacitors are open circuits and inductors are shorts.'
            : `Transient over ${eng(result.duration, 's')}.`}
      </Text>
    </VStack>
  );
}
