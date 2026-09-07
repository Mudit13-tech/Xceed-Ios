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
  Select,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Switch,
  Table,
  Tbody,
  Td,
  Spinner,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
} from '@chakra-ui/react';
import SketchEditor from './SketchEditor';
import { symbolFor } from './symbols';
import { deviceSummary, eng, phase, QUANTITY_COLOR } from './format';

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
export function PartInspector({ component, part, onChange, onDelete, onRotate, readOnly, sketchError }) {
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

        /* A state, not a quantity — a switch being closed, a button being a
           button. Rendered as a toggle rather than a 0/1 box because that is
           what it is, and because the switch is the one part a student changes
           *while* experimenting rather than while building. */
        if (field.type === 'boolean') {
          return (
            <Flex key={field.key} justify="space-between" align="center">
              <Text fontSize="xs" color="lmFg.subtle">
                {field.label}
              </Text>
              <Switch
                size="sm"
                colorScheme="teal"
                isChecked={Boolean(value)}
                isDisabled={readOnly}
                onChange={(event) => setValue(field.key, event.target.checked)}
              />
            </Flex>
          );
        }

        /* Code, which is a field only in the sense that it is stored on the
           component. Everything about editing it is different enough to be its
           own file — see SketchEditor. */
        if (field.type === 'code') {
          return (
            <SketchEditor
              key={`${component.id}:${field.key}`}
              value={typeof value === 'string' ? value : ''}
              // Narrowed to this component before it gets here: a bench with two
              // boards on it must not show one board's mistake against the other.
              error={sketchError?.component === component.id ? sketchError : null}
              readOnly={readOnly}
              onChange={(next) => setValue(field.key, next)}
            />
          );
        }

        /* A fixed choice — an LED's colour. Not a number, and not free text
           either: the bench can only draw the colours it has. */
        if (Array.isArray(field.options)) {
          return (
            <Flex key={field.key} justify="space-between" align="center" gap={2}>
              <Text fontSize="xs" color="lmFg.subtle">
                {field.label}
              </Text>
              <Select
                size="xs"
                maxW="110px"
                value={String(value ?? field.options[0])}
                isDisabled={readOnly}
                onChange={(event) => setValue(field.key, event.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Flex>
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
/**
 * A one-line verdict on the last run, under the bench controls.
 *
 * The bench had no such line, and the absence was the reason a working solver
 * read as a broken one: pressing Run on an unchanged circuit, or on one whose
 * only meter happens to read zero, updates nothing a student can see. Three
 * states, three colours, always in the same place:
 *
 *   grey   — never run. Says what to press rather than reporting a non-event.
 *   green  — solved, with the analysis it solved and how long it took. The
 *            timestamp is the part that matters: it changes on every run, so a
 *            second press is visibly a second run even when the numbers repeat.
 *   red    — refused, carrying the solver's own message. A circuit that will not
 *            solve is the normal way to learn that a node is floating, so this
 *            is a teaching surface and not merely an error.
 */
export function RunStatus({ lastRun, running, result }) {
  if (running) {
    return (
      <Flex align="center" gap={2} mb={2} px={2} py={1} borderRadius="md" bg="lmHue.blue50">
        <Spinner size="xs" color="lmHue.blue700" />
        <Text fontSize="xs" color="lmHue.blue700" fontWeight="600">
          Solving…
        </Text>
      </Flex>
    );
  }

  if (!lastRun) {
    return (
      <Text fontSize="xs" color="lmFg.muted" mb={2}>
        Not run yet — wire the circuit up and press <b>Run</b>.
      </Text>
    );
  }

  const at = lastRun.at instanceof Date ? lastRun.at : new Date(lastRun.at);
  const clock = at.toLocaleTimeString(undefined, { hour12: false });
  const label =
    lastRun.analysis === 'dc' ? 'DC operating point'
      : lastRun.analysis === 'ac' ? 'AC steady state'
        : 'Transient';

  // `result.ok` is the truth about what is on screen; `lastRun.ok` is the truth
  // about the request. They differ for a run the server refused outright, where
  // there is no result at all — hence both.
  const solved = lastRun.ok && result?.ok;

  return (
    <Flex
      align="center"
      gap={2}
      mb={2}
      px={2}
      py={1}
      borderRadius="md"
      borderWidth="1px"
      bg={solved ? 'lmHue.green50' : 'lmHue.red50'}
      borderColor={solved ? 'lmHue.green200' : 'lmHue.red200'}
      wrap="wrap"
    >
      <Text fontSize="xs" fontWeight="700" color={solved ? 'lmHue.green700' : 'lmHue.red700'}>
        {solved ? '✓ Solved' : '✕ Did not solve'}
      </Text>
      <Text fontSize="xs" color={solved ? 'lmHue.green700' : 'lmHue.red700'}>
        {label} · {clock}
        {solved && lastRun.ms !== undefined ? ` · ${lastRun.ms} ms` : ''}
      </Text>
      {!solved && (lastRun.error || result?.message) && (
        <Text fontSize="xs" color="lmHue.red700" flex="1 1 100%">
          {lastRun.error || result?.message}
        </Text>
      )}
    </Flex>
  );
}

/** Which quantity each meter reads, and therefore which hue its face takes. */
const METER_COLOR = {
  voltmeter: QUANTITY_COLOR.voltage,
  ammeter: QUANTITY_COLOR.current,
  wattmeter: QUANTITY_COLOR.power,
};

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
                  {/* The meter face takes the hue of what it measures, so an
                      ammeter reads in the same orange as the I column and a
                      voltmeter in the same blue as V — the panel and the table
                      are two views of one run, and matching them is what makes
                      that obvious without a legend. */}
                  <Text fontSize="sm" fontWeight="700" color={METER_COLOR[meter.type] || 'lmFg.body'}>
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

/* ───────────────────────────── the sketch's pins ──────────────────────────── */

/**
 * What each microcontroller's pins were doing when the run ended.
 *
 * The one panel here that reports something the solver did not compute. A pin's
 * *voltage* is in the device table like anything else; what is not anywhere else
 * is whether the sketch made that pin an output at all — and that is the first
 * thing to check when a circuit does nothing, because a `pinMode` left out of
 * `setup()` looks exactly like a wire that is not connected.
 *
 * A fault is shown here rather than as a run error because the run is not one: a
 * sketch that divided by zero on its four-hundredth pass still produced the four
 * hundred passes before it, and those are on the scope and worth looking at.
 */
export function ChipReadings({ result }) {
  const chips = result?.ok ? result.chips : null;
  if (!chips || !chips.length) return null;

  return (
    <VStack align="stretch" spacing={3}>
      {chips.map((chip) => (
        <Box key={chip.id}>
          {chips.length > 1 && (
            <Text fontSize="xs" fontWeight="700" mb={1}>
              {chip.id}
            </Text>
          )}
          {chip.fault && (
            <Text fontSize="xs" color="lmHue.red700" mb={1}>
              The sketch stopped
              {chip.fault.line ? ` on line ${chip.fault.line}` : ''}: {chip.fault.message}
            </Text>
          )}
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th px={1}>Pin</Th>
                <Th px={1}>Mode</Th>
                <Th px={1} isNumeric>Wrote</Th>
                <Th px={1} isNumeric color={QUANTITY_COLOR.voltage}>V</Th>
              </Tr>
            </Thead>
            <Tbody>
              {chip.pins.map((pin) => (
                <Tr key={pin.pin}>
                  <Td px={1} fontSize="xs" fontWeight="600">{pin.label}</Td>
                  <Td px={1} fontSize="xs" color={PIN_MODE_COLOR[pin.mode] || 'lmFg.muted'}>
                    {PIN_MODE_LABEL[pin.mode] || pin.mode}
                  </Td>
                  <Td px={1} isNumeric fontSize="xs" color={pin.level === null ? 'lmFg.muted' : 'lmFg.body'}>
                    {/* A level is a fraction because analogWrite writes one; 0 and
                        1 are shown as the words a student typed rather than as
                        numbers they did not. */}
                    {pin.level === null ? '—' : pin.level === 1 ? 'HIGH' : pin.level === 0 ? 'LOW' : `${Math.round(pin.level * 100)}%`}
                  </Td>
                  <Td px={1} isNumeric fontSize="xs" color={QUANTITY_COLOR.voltage} fontWeight="600">
                    {eng(pin.volts, 'V')}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      ))}
      {result.analysis !== 'transient' && (
        <Text fontSize="xs" color="lmFg.muted">
          This is the instant after setup() and the first pass through loop(). Run a transient
          (scope) analysis to watch the pins change.
        </Text>
      )}
    </VStack>
  );
}

/* An output is doing something to the circuit, an input is only watching it, and
   a pull-up is quietly doing both — three states worth telling apart at a glance
   on a panel a student reads while a circuit is not working. */
const PIN_MODE_LABEL = { output: 'output', input: 'input', pullup: 'input ⭡' };
const PIN_MODE_COLOR = {
  output: 'lmHue.green700',
  input: 'lmFg.muted',
  pullup: 'lmHue.blue700',
};

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
            {/* The headers carry the same hues, so the table needs no separate
                legend — V is blue here and blue everywhere. */}
            <Th px={1} isNumeric color={QUANTITY_COLOR.voltage}>V</Th>
            <Th px={1} isNumeric color={QUANTITY_COLOR.current}>I</Th>
            <Th px={1} isNumeric color={QUANTITY_COLOR.power}>P</Th>
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
                  {/* One hue per quantity, the same three used on the canvas
                      labels and the meters — see QUANTITY_COLOR. A dash is left
                      grey on purpose: it is the absence of a reading, and
                      colouring it would give "no number" the same weight as a
                      number. */}
                  <Td px={1} isNumeric fontSize="xs" color={QUANTITY_COLOR.voltage} fontWeight="600">
                    {shown.voltage}
                  </Td>
                  <Td
                    px={1}
                    isNumeric
                    fontSize="xs"
                    color={shown.current === '—' ? 'lmFg.muted' : QUANTITY_COLOR.current}
                    fontWeight={shown.current === '—' ? '400' : '600'}
                  >
                    {shown.current}
                  </Td>
                  <Td px={1} isNumeric fontSize="xs">
                    {/* Green, not the power hue, when the part is driving the
                        circuit: "this is a source" is a different fact from "this
                        is a power", and the table is the one place both are said
                        about the same number. */}
                    <Text
                      as="span"
                      fontWeight={shown.power === '—' ? '400' : '600'}
                      color={
                        shown.power === '—'
                          ? 'lmFg.muted'
                          : shown.delivering
                            ? 'lmHue.green700'
                            : QUANTITY_COLOR.power
                      }
                    >
                      {shown.power}
                    </Text>
                    {shown.delivering && (
                      // Said in words rather than shown as a minus sign, because a
                      // student meeting "−50 mW" on a battery learns the passive
                      // sign convention backwards and by accident.
                      <Text fontSize="9px" color="lmHue.green700">
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
