import React, { useState } from 'react';
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
import { deviceSummary, eng, phase } from './format';

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
        borderColor="lmBorder.base"
        borderRadius="md"
        p={2}
        bg="lmBg.surface"
        _hover={{ borderColor: 'teal.400', bg: 'teal.50' }}
        textAlign="center"
      >
        <Box
          as="svg"
          viewBox={`${-w / 2 - pad} ${-h / 2 - pad} ${w + pad * 2} ${h + pad * 2}`}
          width="100%"
          height="34px"
          color="lmFg.body"
        >
          {symbol.draw({ type: part.type, values: part.defaults })}
        </Box>
        <Text fontSize="10px" color="lmFg.subtle" noOfLines={1} mt={1}>
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
    { label: 'Passive', types: ['resistor', 'rheostat', 'capacitor', 'inductor', 'transformer'] },
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
            <Text fontSize="xs" fontWeight="700" color="lmFg.muted" mb={1} textTransform="uppercase">
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
 * One value, typed rather than nudged.
 *
 * `type="number"` looks like the right control for a number and is not, because of
 * the browser's own value sanitisation: an input whose text is not a *valid*
 * floating-point number reports its value as empty, and every intermediate state a
 * decimal passes through is invalid — "0.", "-", "1e". A controlled input that maps
 * each keystroke straight through `Number()` therefore fights the person typing,
 * and the field snaps back to the old number as the decimal point is entered.
 *
 * A transformer is where this bites hardest, because every setting on one is
 * fractional — a turns ratio of 0.5, a coupling of 0.99 — so "the rating will not
 * change" is the honest description of what a teacher sees.
 *
 * So the text stays text while it is being edited, and a number is committed only
 * when the text parses as one. Leaving the field puts the component's own value
 * back, so a half-typed entry that never parsed cannot masquerade as a setting —
 * and an empty string is never written into `values`, where the solver would read
 * it as zero and quietly substitute a default.
 */
function NumberField({ field, value, disabled, onCommit }) {
  // Null except while this field is being edited, so a value changed from
  // somewhere else — a rheostat's slider, a circuit loaded from the server —
  // still appears here.
  const [draft, setDraft] = useState(null);

  const clamp = (number) => {
    const low = field.min !== undefined ? Math.max(number, field.min) : number;
    return field.max !== undefined ? Math.min(low, field.max) : low;
  };

  return (
    <Box opacity={field.advanced ? 0.75 : 1}>
      <Flex justify="space-between" align="baseline" gap={2}>
        <Text fontSize="xs" color="lmFg.subtle">
          {field.label}
          {field.unit ? ` (${field.unit})` : ''}
          {field.advanced && (
            <Badge ml={1} fontSize="9px" colorScheme="gray">
              advanced
            </Badge>
          )}
        </Text>
        {/* The range, said out loud. It is enforced on the way out of the field,
            and a value that silently became something else on blur would be the
            second way this panel could look as though it ignored what was
            typed. */}
        {field.min !== undefined && field.max !== undefined && (
          <Text fontSize="9px" color="lmFg.muted" whiteSpace="nowrap">
            {eng(field.min)}–{eng(field.max)}
          </Text>
        )}
      </Flex>
      <Input
        size="sm"
        // Text, deliberately. `inputMode` still brings up a numeric keypad on a
        // phone, without the sanitisation that makes a decimal untypeable.
        type="text"
        inputMode="decimal"
        value={draft ?? (value ?? '')}
        isDisabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          // Committed as it is typed, so the canvas label and a following Run
          // both see the new value without anyone having to leave the field.
          // Anything that does not parse is simply not committed yet.
          const parsed = Number(raw);
          if (raw.trim() !== '' && Number.isFinite(parsed)) onCommit(parsed);
        }}
        onBlur={() => {
          const raw = draft;
          setDraft(null);
          if (raw === null) return;
          const parsed = Number(raw);
          // Unparseable or empty: the field goes back to what the component is
          // actually set to, rather than leaving the part valueless.
          if (raw.trim() === '' || !Number.isFinite(parsed)) return;
          const bounded = clamp(parsed);
          if (bounded !== parsed) onCommit(bounded);
        }}
      />
    </Box>
  );
}

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
      <Text fontSize="sm" color="lmFg.muted">
        Select a component on the bench to change its value, or drop a new one from the palette.
      </Text>
    );
  }

  const setValue = (key, value) => {
    onChange({ ...component, values: { ...component.values, [key]: value } });
  };

  return (
    <VStack align="stretch" spacing={3}>
      <Flex justify="space-between" align="center">
        <Box>
          <Heading size="sm">{part?.name || component.type}</Heading>
          <Text fontSize="xs" color="lmFg.muted">
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
            {/* Named, and told which component to remove.
                ────────────────────────────────────────
                The id goes out with the click rather than being read from
                whatever the page currently calls "selected". Those are the same
                thing right up until they are not — a click that lands on the
                canvas on the way to this button clears the selection, and a
                delete keyed to the selection then removes nothing while the part
                it is captioned with sits there. Handing over the id of the part
                this panel is showing makes that impossible. */}
            <Tooltip label={`Remove ${component.label || component.id} and its wires`}>
              <Button
                size="xs"
                variant="outline"
                colorScheme="red"
                onClick={() => onDelete(component.id)}
              >
                ✕ Delete
              </Button>
            </Tooltip>
          </HStack>
        )}
      </Flex>

      {part?.hint && (
        <Text fontSize="xs" color="lmFg.subtle" bg="lmBg.sunken" p={2} borderRadius="md">
          {part.hint}
        </Text>
      )}

      {!readOnly && (
        <Box>
          <Text fontSize="xs" color="lmFg.muted">
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
                <Text fontSize="xs" color="lmFg.subtle">
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
          <NumberField
            // Keyed by the component as well as the field: selecting a different
            // part of the same type reuses these inputs, and a draft left behind
            // in one of them would show the previous component's half-typed text
            // against the new component's value.
            key={`${component.id}:${field.key}`}
            field={field}
            value={value}
            disabled={readOnly}
            onCommit={(next) => setValue(field.key, next)}
          />
        );
      })}

      {!(part?.fields || []).length && (
        <Text fontSize="xs" color="lmFg.muted">
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
      <Text fontSize="sm" color="lmFg.muted">
        Press Run to solve the circuit and read the instruments.
      </Text>
    );
  }

  if (!result.ok) {
    return (
      <Box bg="lmHue.red50" borderWidth="1px" borderColor="lmHue.red200" borderRadius="md" p={3}>
        <Text fontSize="sm" fontWeight="600" color="lmHue.red700">
          The circuit did not solve
        </Text>
        <Text fontSize="sm" color="lmHue.red700" mt={1}>
          {result.message}
        </Text>
      </Box>
    );
  }

  const meters = (result.instruments || []).filter((meter) => meter.type !== 'cro' && meter.type !== 'dso');

  return (
    <VStack align="stretch" spacing={3}>
      {(result.warnings || []).map((warning) => (
        <Text key={warning} fontSize="xs" color="lmHue.orange700" bg="lmHue.orange50" p={2} borderRadius="md">
          {warning}
        </Text>
      ))}

      {!meters.length ? (
        <Text fontSize="sm" color="lmFg.muted">
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
                  <Text fontSize="10px" color="lmFg.muted" textTransform="uppercase">
                    {meter.type}
                  </Text>
                </Td>
                <Td px={1} isNumeric>
                  <Text fontSize="sm" fontWeight="700">
                    {eng(meter.magnitude, meter.unit)}
                  </Text>
                  {meter.type !== 'wattmeter' && result.analysis === 'ac' && (
                    <Text fontSize="10px" color="lmFg.muted">
                      {phase(meter.phase)}
                    </Text>
                  )}
                  {meter.type === 'wattmeter' && (
                    <>
                      <Text fontSize="10px" color="lmFg.subtle">
                        {eng(meter.apparent, 'VA')} apparent · {eng(meter.reactive, 'VAr')} reactive
                      </Text>
                      <Text fontSize="10px" color="lmFg.subtle">
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
      <Text fontSize="10px" color="lmFg.muted">
        {result.analysis === 'ac'
          ? `Steady-state AC at ${result.frequency} Hz. Amplitudes are peak values.`
          : result.analysis === 'dc'
            ? 'DC operating point. Capacitors are open circuits and inductors are shorts.'
            : `Transient over ${eng(result.duration, 's')}.`}
      </Text>
    </VStack>
  );
}

/* ────────────────────────── every component's numbers ─────────────────────── */

/**
 * The voltage across, current through and power in every component on the bench.
 *
 * The instruments answer "what does the meter say", which is the experiment a
 * student was asked to do. This answers "what is happening in R2", which is the
 * thing they are trying to understand — and on a real bench getting it means
 * moving the probes and running again, once per component. The solved system
 * already contains all of it, so making them go one at a time would be a
 * scarcity this bench invented rather than one it is modelling.
 *
 * The meters stay, and stay first: an experiment whose readings come from a table
 * that appears by itself is not an experiment in measurement any more. This is
 * the answer sheet beside it, which is roughly what a demonstrator leaning over a
 * bench is.
 */
export function DeviceReadings({ result }) {
  if (!result?.ok) return null;

  if (result.analysis === 'transient') {
    return (
      <Text fontSize="xs" color="lmFg.muted">
        A transient run gives a waveform rather than a single number, so the values are on the scope
        below. Switch to DC or AC for a table of voltage, current and power.
      </Text>
    );
  }

  // Instruments are left out: they have their own panel above, and a voltmeter
  // appearing in both — once as a reading and once as a part with a dash for its
  // current — would read as two different measurements of the same thing.
  const devices = (result.devices || []).filter((device) => !device.instrument);
  if (!devices.length) {
    return (
      <Text fontSize="xs" color="lmFg.muted">
        Nothing to report — put a component on the bench and run again.
      </Text>
    );
  }

  return (
    <VStack align="stretch" spacing={2}>
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th px={1}>Part</Th>
            <Th px={1} isNumeric>V</Th>
            <Th px={1} isNumeric>I</Th>
            <Th px={1} isNumeric>P</Th>
          </Tr>
        </Thead>
        <Tbody>
          {devices.flatMap((device) => {
            // A transformer occupies two rows, because it has two windings and
            // the pair *is* the reading: an open-circuit test is the primary's
            // current read against the secondary's voltage. One row would make a
            // student do the experiment with one probe.
            const rows = device.secondary
              ? [
                { ...device, key: `${device.id}-p`, label: `${device.label} primary` },
                { ...device.secondary, key: `${device.id}-s`, label: `${device.label} secondary` },
              ]
              : [{ ...device, key: device.id }];

            return rows.map((row) => {
              const shown = deviceSummary(row);
              return (
                <Tr key={row.key}>
                  <Td px={1}>
                    <Text fontSize="sm" fontWeight="600">
                      {row.label}
                    </Text>
                    {result.analysis === 'ac' && row.currentPhase !== null && row.currentPhase !== undefined && (
                      <Text fontSize="10px" color="lmFg.muted">
                        {phase(row.currentPhase)}
                      </Text>
                    )}
                  </Td>
                  <Td px={1} isNumeric fontSize="xs">
                    {shown.voltage}
                  </Td>
                  <Td px={1} isNumeric fontSize="xs">
                    {shown.current}
                  </Td>
                  <Td px={1} isNumeric fontSize="xs">
                    <Text as="span" color={shown.delivering ? 'purple.600' : undefined}>
                      {shown.power}
                    </Text>
                    {shown.delivering && (
                      // Said in words rather than shown as a minus sign, because a
                      // student meeting "−50 mW" on a battery learns the passive
                      // sign convention backwards and by accident.
                      <Text fontSize="9px" color="purple.600">
                        supplied
                      </Text>
                    )}
                  </Td>
                </Tr>
              );
            });
          })}
        </Tbody>
      </Table>

      <Text fontSize="10px" color="lmFg.muted">
        Voltage is across the part, current through it, power in it.
        {result.analysis === 'ac'
          ? ' At AC these are magnitudes of peak values, and P is real power — the part a wattmeter reads.'
          : ''}
        {' '}A dash means the solver will not put a number on it: a transistor’s terminal current
        depends on its own model rather than on one branch of the circuit.
      </Text>
    </VStack>
  );
}
