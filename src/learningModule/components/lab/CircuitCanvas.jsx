import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Text } from '@chakra-ui/react';
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
  /** Instrument readings, keyed by component id, drawn beside their meters. */
  readings = {},
  height = 460,
}) {
  const svgRef = useRef(null);
  const components = circuit?.components || [];
  const wires = circuit?.wires || [];

  // The wire being drawn: the terminal it started from, and where the pointer is.
  const [pending, setPending] = useState(null);
  const [drag, setDrag] = useState(null);
  const [hoverPin, setHoverPin] = useState(null);

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
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
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
        style={{ touchAction: 'none', cursor: pending ? 'crosshair' : 'default' }}
      >
        <defs>
          <pattern id="lab-grid" width={GRID * 2} height={GRID * 2} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID * 2} 0 L 0 0 0 ${GRID * 2}`} fill="none" stroke="#EDF2F7" strokeWidth="1" />
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
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#2B6CB0" strokeWidth={2.5} />
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
            stroke="#3182CE"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
        )}

        {components.map((component) => {
          const symbol = symbolFor(component.type);
          const part = byType.get(component.type);
          const selected = component.id === selectedId;
          const reading = readings[component.id];

          return (
            <g key={component.id}>
              <g
                transform={`translate(${component.x || 0} ${component.y || 0}) rotate(${component.rotation || 0})`}
                color={selected ? '#2C5282' : '#1A202C'}
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
                    fill="#EBF8FF"
                    stroke="#4299E1"
                    strokeDasharray="4 3"
                  />
                )}
                {symbol.draw(component)}
              </g>

              {/* Terminals are drawn *outside* the rotation group, at their
                  already-rotated positions, so the hit area is a circle rather
                  than a rotated ellipse and the click target does not move
                  around as a component is turned. */}
              {symbol.pins.map((_, pin) => {
                const at = pinPosition(component, pin);
                const isPending =
                  pending?.from.component === component.id && pending.from.pin === pin;
                const isHover = hoverPin === `${component.id}:${pin}`;
                return (
                  <circle
                    key={pin}
                    cx={at.x}
                    cy={at.y}
                    r={isHover || isPending ? PIN_RADIUS + 2 : PIN_RADIUS - 1}
                    fill={isPending ? '#3182CE' : isHover ? '#63B3ED' : '#A0AEC0'}
                    stroke="white"
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
              })}

              <text
                x={component.x}
                y={(component.y || 0) + symbol.box[1] / 2 + 16}
                textAnchor="middle"
                fontSize={11}
                fill="#4A5568"
              >
                {component.label || component.id}
                {part?.fields?.length ? ` · ${primaryValue(component, part.fields)}` : ''}
              </text>

              {/* A live reading sits with its instrument. Putting the meter's
                  value anywhere else would make the student match two lists. */}
              {reading && (
                <text
                  x={component.x}
                  y={(component.y || 0) - symbol.box[1] / 2 - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="700"
                  fill="#2F855A"
                >
                  {reading}
                </text>
              )}
            </g>
          );
        })}
      </Box>

      {!components.length && (
        <Box position="absolute" top="45%" left="0" right="0" textAlign="center" pointerEvents="none">
          <Text color="gray.400" fontSize="sm">
            Drag a component from the palette onto the bench, then click one terminal and another to
            wire them together.
          </Text>
        </Box>
      )}
    </Box>
  );
}
