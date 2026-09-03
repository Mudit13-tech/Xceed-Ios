import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Text, useColorModeValue } from '@chakra-ui/react';
import { pinPosition, symbolFor } from './symbols';
import { primaryValue } from './format';
import { placeComponent } from './benchOps';

/**
 * The bench: drag parts on, wire them together, drag them around.
 *
 * ## Why this is an SVG and not a library
 *
 * A wire has to attach to a *terminal*, and a terminal is at a coordinate this
 * component computes from the symbol's own geometry (see `symbols.jsx`). A generic
 * diagramming library gives boxes with anchor points on their edges, which is the
 * wrong model — a transistor's base is not on the edge of a bounding box, and a
 * wattmeter has four terminals in two pairs that mean different things. Every one
 * of those libraries would then need the pin table anyway, and drawing an SVG line
 * between two points I already know is the small half of the job.
 *
 * ## What it does not do, deliberately
 *
 * It does not route wires around components. A wire here is a straight line between
 * two terminals, and a busy circuit looks like a busy circuit. Orthogonal
 * auto-routing is a genuinely hard problem (it is a maze search per wire, redone
 * whenever anything moves) and getting it half-right is worse than not doing it:
 * a wire that takes a scenic route past three other components reads as though it
 * connects to them. The student's own layout is the thing that makes a circuit
 * legible, which is also true on a real breadboard.
 *
 * It also does not check the circuit. That is the server's job, on Run, using the
 * same net solver that computes the answer — so the canvas never has an opinion
 * about connectivity that the solver might disagree with.
 */

/** Snap step. Coarse enough that terminals line up by themselves. */
const GRID = 10;
const snap = (value) => Math.round(value / GRID) * GRID;

/** The radius a student has to hit to grab a terminal. Generous on purpose. */
const PIN_RADIUS = 6;

export default function CircuitCanvas({
  circuit,
  onChange,
  palette = [],
  readOnly = false,
  selectedId = null,
  onSelect = () => {},
  /**
   * Remove one component, by id.
   *
   * The canvas does not do this itself because removing a component means
   * removing every wire that touched it, and that lives in `benchOps` where both
   * screens share it. Here it is only the gesture: select a part and press
   * Delete, which is what a person who has just placed the wrong thing tries
   * before hunting for a button.
   */
  onDelete = null,
  /**
   * Readings keyed by component id, drawn beside the part they belong to.
   *
   * A string, or several — a meter has one number and a resistor has three
   * (volts, amps, watts), and stacking them over the component is what keeps a
   * student from having to match a table of ids against a diagram.
   */
  readings = {},
  /* Ids of the LEDs the last run found conducting.
   *
   * Passed in rather than read off the component, because "lit" is a property of
   * the *run*, not of the part: the same LED on the same bench is lit or not
   * depending on a switch somewhere else. Merged in at draw time so the stored
   * circuit never gains a field that only means something after a solve. */
  litIds = null,
  height = 460,
}) {
  const svgRef = useRef(null);
  const components = circuit?.components || [];
  const wires = circuit?.wires || [];

  // The wire being drawn: the terminal it started from, and where the pointer is.
  const [pending, setPending] = useState(null);
  const [drag, setDrag] = useState(null);
  const [hoverPin, setHoverPin] = useState(null);

  /**
   * The schematic palette.
   *
   * These are raw SVG `stroke` and `fill` attributes, not Chakra props, so they
   * cannot take a semantic token — an SVG attribute needs a colour string. Hence
   * a hook rather than the `lm*` tokens the rest of the module uses.
   *
   * A drawing has to be re-pitched for a dark sheet rather than inverted: ink
   * goes light, the grid goes just visible against the sheet instead of just
   * visible against white, and the wire and reading colours move to the bright
   * end of their ramps so a thin 2px line still reads. The alternative — keeping
   * a white sheet in dark mode — leaves a glaring panel in the middle of a dark
   * page, and the bench is the largest thing on it.
   */
  const paper = {
    grid: useColorModeValue('#EDF2F7', '#2D3748'),
    wire: useColorModeValue('#2B6CB0', '#63B3ED'),
    pendingWire: useColorModeValue('#3182CE', '#90CDF4'),
    ink: useColorModeValue('#1A202C', '#E2E8F0'),
    inkSelected: useColorModeValue('#2C5282', '#90CDF4'),
    haloFill: useColorModeValue('#EBF8FF', '#1A365D'),
    haloStroke: useColorModeValue('#4299E1', '#4299E1'),
    label: useColorModeValue('#4A5568', '#A0AEC0'),
    plateFill: useColorModeValue('#F0FFF4', '#1C4532'),
    plateStroke: useColorModeValue('#C6F6D5', '#276749'),
    reading: useColorModeValue('#2F855A', '#9AE6B4'),
    pin: useColorModeValue('#A0AEC0', '#718096'),
    pinHover: useColorModeValue('#63B3ED', '#63B3ED'),
    pinPending: useColorModeValue('#3182CE', '#90CDF4'),
    // The ring that separates a terminal dot from whatever is behind it, so it
    // has to be the sheet's own colour rather than white.
    pinRing: useColorModeValue('#FFFFFF', '#1A202C'),
  };

  const byType = useMemo(() => {
    const map = new Map();
    palette.forEach((part) => map.set(part.type, part));
    return map;
  }, [palette]);

  /** Pointer position in the SVG's own coordinates, not the page's. */
  const pointAt = useCallback((event) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    // The SVG scales to its container, so page pixels are not user units. Missing
    // this makes every drop land at an offset that grows with the window size.
    return {
      x: ((event.clientX - rect.left) / rect.width) * viewBox.width,
      y: ((event.clientY - rect.top) / rect.height) * viewBox.height,
    };
  }, []);

  const update = (next) => {
    if (readOnly) return;
    onChange({ components, wires, ...next });
  };

  /* ─────────────────────────────── placing ───────────────────────────────── */

  const place = (type, at) => {
    const part = byType.get(type);
    if (!part) return;
    // Shared with the page's click-to-place, so a component gets the same
    // designator and the same defaults whichever way it arrives. See `benchOps`.
    const { circuit: next, id } = placeComponent({ components, wires }, type, part, {
      x: snap(at.x),
      y: snap(at.y),
    });
    update(next);
    onSelect(id);
  };

  const onDrop = (event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/x-lab-part');
    if (type) place(type, pointAt(event));
  };

  /* ─────────────────────────────── moving ────────────────────────────────── */

  const startDrag = (event, component) => {
    if (readOnly) return;
    event.stopPropagation();
    // Grabbing a component's body is not aiming at a terminal, so a wire that was
    // half-drawn is abandoned here rather than left trailing off the pointer while
    // the student drags something else around.
    setPending(null);
    const at = pointAt(event);
    onSelect(component.id);
    setDrag({ id: component.id, dx: component.x - at.x, dy: component.y - at.y });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    const at = pointAt(event);
    if (pending) setPending({ ...pending, to: at });
    if (!drag) return;
    update({
      components: components.map((component) =>
        component.id === drag.id
          ? { ...component, x: snap(at.x + drag.dx), y: snap(at.y + drag.dy) }
          : component,
      ),
    });
  };

  const endDrag = () => setDrag(null);

  /* ─────────────────────────────── wiring ────────────────────────────────── */

  const clickPin = (event, component, pin) => {
    if (readOnly) return;
    event.stopPropagation();

    if (!pending) {
      setPending({ from: { component: component.id, pin }, to: pinPosition(component, pin) });
      return;
    }

    const from = pending.from;
    setPending(null);

    // A wire from a terminal to itself is a no-op, not an error worth a message.
    if (from.component === component.id && from.pin === pin) return;

    const duplicate = wires.some(
      (wire) =>
        (wire.from.component === from.component
          && wire.from.pin === from.pin
          && wire.to.component === component.id
          && wire.to.pin === pin)
        || (wire.to.component === from.component
          && wire.to.pin === from.pin
          && wire.from.component === component.id
          && wire.from.pin === pin),
    );
    if (duplicate) return;

    update({ wires: [...wires, { from, to: { component: component.id, pin } }] });
  };

  const removeWire = (index) => {
    if (readOnly) return;
    update({ wires: wires.filter((_, i) => i !== index) });
  };

  /* ─────────────────────────────── drawing ───────────────────────────────── */

  const positionOf = (componentId, pin) => {
    const component = components.find((candidate) => candidate.id === componentId);
    return component ? pinPosition(component, pin) : null;
  };

  return (
    <Box position="relative">
      <Box
        as="svg"
        ref={svgRef}
        viewBox="0 0 1000 620"
        width="100%"
        height={`${height}px`}
        bg="lmBg.surface"
        borderWidth="1px"
        borderColor="lmBorder.base"
        borderRadius="md"
        onDrop={onDrop}
        onDragOver={(event) => event.preventDefault()}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        // Clicking bare canvas cancels a half-drawn wire and clears the
        // selection, which is what every drawing tool does and what a student
        // will try first when they change their mind.
        onPointerDown={() => {
          setPending(null);
          onSelect(null);
        }}
        // Focusable so Delete can reach it. Only ever *given* focus by clicking
        // the bench, so the key handler below cannot fire while someone is typing
        // a value into the panel beside it — where Backspace has to keep meaning
        // backspace.
        tabIndex={0}
        onKeyDown={(event) => {
          if (readOnly || !onDelete || !selectedId) return;
          if (event.key !== 'Delete' && event.key !== 'Backspace') return;
          // Backspace is the browser's Back on some setups, and a student who
          // deletes a resistor should not lose the bench.
          event.preventDefault();
          onDelete(selectedId);
        }}
        style={{ touchAction: 'none', cursor: pending ? 'crosshair' : 'default', outline: 'none' }}
      >
        <defs>
          <pattern id="lab-grid" width={GRID * 2} height={GRID * 2} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID * 2} 0 L 0 0 0 ${GRID * 2}`} fill="none" stroke={paper.grid} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lab-grid)" />

        {/* Wires under the components, so a terminal is never hidden by a wire
            crossing it — the terminal is what a student has to hit. */}
        {wires.map((wire, index) => {
          const from = positionOf(wire.from.component, wire.from.pin);
          const to = positionOf(wire.to.component, wire.to.pin);
          if (!from || !to) return null;
          return (
            <g key={`${wire.from.component}${wire.from.pin}-${wire.to.component}${wire.to.pin}-${index}`}>
              {/* A fat invisible line under the thin visible one, so a wire can
                  be clicked without demanding pixel accuracy. */}
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="transparent"
                strokeWidth={12}
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  removeWire(index);
                }}
              />
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={paper.wire} strokeWidth={2.5} />
            </g>
          );
        })}

        {/* The wire in progress. */}
        {pending && pending.to && (
          <line
            x1={positionOf(pending.from.component, pending.from.pin)?.x}
            y1={positionOf(pending.from.component, pending.from.pin)?.y}
            x2={pending.to.x}
            y2={pending.to.y}
            stroke={paper.pendingWire}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
        )}

        {components.map((component) => {
          const symbol = symbolFor(component.type);
          const part = byType.get(component.type);
          const selected = component.id === selectedId;
          // One reading or several, handled the same way from here on.
          const lines = [].concat(readings[component.id] ?? []).filter(Boolean);
          // Stacked upwards from just above the symbol, so the *first* line —
          // the voltage — always sits nearest the component it belongs to and
          // the block grows away from the circuit rather than into it.
          const lineHeight = 13;
          const readingTop = (component.y || 0) - symbol.box[1] / 2 - 8 - (lines.length - 1) * lineHeight;

          return (
            <g key={component.id}>
              <g
                transform={`translate(${component.x || 0} ${component.y || 0}) rotate(${component.rotation || 0})`}
                color={selected ? paper.inkSelected : paper.ink}
                onPointerDown={(event) => startDrag(event, component)}
                style={{ cursor: readOnly ? 'default' : 'move' }}
              >
                {selected && (
                  <rect
                    x={-symbol.box[0] / 2 - 6}
                    y={-symbol.box[1] / 2 - 6}
                    width={symbol.box[0] + 12}
                    height={symbol.box[1] + 12}
                    rx={4}
                    fill={paper.haloFill}
                    stroke={paper.haloStroke}
                    strokeDasharray="4 3"
                  />
                )}
                {symbol.draw(
                  litIds?.has(component.id)
                    ? { ...component, values: { ...component.values, lit: true } }
                    : component,
                )}
              </g>

              <text
                x={component.x}
                y={(component.y || 0) + symbol.box[1] / 2 + 16}
                textAnchor="middle"
                fontSize={11}
                fill={paper.label}
              >
                {component.label || component.id}
                {part?.fields?.length ? ` · ${primaryValue(component, part.fields)}` : ''}
              </text>

              {/* A live reading sits with the part it was measured on. Putting
                  it anywhere else would make the student match two lists. */}
              {lines.length > 0 && (
                <g pointerEvents="none">
                  {/* A pale plate behind the numbers. Wires cross this area
                      constantly and green text on a blue line is unreadable. */}
                  <rect
                    x={(component.x || 0) - 44}
                    y={readingTop - 10}
                    width={88}
                    height={lines.length * lineHeight + 4}
                    rx={3}
                    fill={paper.plateFill}
                    fillOpacity={0.92}
                    stroke={paper.plateStroke}
                  />
                  {lines.map((line, index) => (
                    <text
                      key={line}
                      x={component.x}
                      y={readingTop + index * lineHeight}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight="700"
                      fill={paper.reading}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              )}
            </g>
          );
        })}

        {/* Every terminal, in a pass of its own after every component body.
            ────────────────────────────────────────────────────────────────
            This ordering is the difference between a bench that wires up and one
            that does not. SVG has no z-index — later elements are simply drawn on
            top — so with the terminals inside each component's group, a part
            dropped near an existing one covers that one's terminals with its own
            body. The click then lands on the *body*, which starts a drag, and the
            student watches a component slide around while trying to attach a
            wire to it. Nothing is broken enough to produce an error; the wire
            just never appears, which reads as "the components will not connect".

            Terminals are also outside the rotation transform, at their
            already-rotated positions, so the hit area stays a circle rather than
            becoming a rotated ellipse that moves as a part is turned. */}
        {components.map((component) => {
          const symbol = symbolFor(component.type);
          const part = byType.get(component.type);
          return symbol.pins.map((_, pin) => {
            const at = pinPosition(component, pin);
            const isPending = pending?.from.component === component.id && pending.from.pin === pin;
            const isHover = hoverPin === `${component.id}:${pin}`;
            return (
              <circle
                key={`${component.id}:${pin}`}
                cx={at.x}
                cy={at.y}
                r={isHover || isPending ? PIN_RADIUS + 2 : PIN_RADIUS - 1}
                fill={isPending ? paper.pinPending : isHover ? paper.pinHover : paper.pin}
                stroke={paper.pinRing}
                strokeWidth={1.5}
                style={{ cursor: readOnly ? 'default' : 'crosshair' }}
                onPointerEnter={() => setHoverPin(`${component.id}:${pin}`)}
                onPointerLeave={() => setHoverPin(null)}
                onPointerDown={(event) => clickPin(event, component, pin)}
              >
                {/* The terminal's name, so a student can tell a wattmeter's
                    current coil from its pressure coil without guessing. */}
                <title>{`${component.label || component.id} · ${part?.pinNames?.[pin] ?? pin}`}</title>
              </circle>
            );
          });
        })}
      </Box>

      {!components.length && (
        <Box position="absolute" top="45%" left="0" right="0" textAlign="center" pointerEvents="none">
          <Text color="lmFg.muted" fontSize="sm">
            Drag a component from the palette onto the bench, then click one terminal and another to
            wire them together.
          </Text>
        </Box>
      )}
    </Box>
  );
}
