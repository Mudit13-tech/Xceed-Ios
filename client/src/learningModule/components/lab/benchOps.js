/**
 * The edits a bench supports, in one place.
 *
 * Placing, removing and rotating a component are each a couple of lines, which is
 * exactly why they were written twice — once in the canvas for drag-and-drop and
 * once in the page for click-to-place — and the two immediately disagreed about
 * naming: one minted `Rh1` for a rheostat and the other `R1`, which collides with
 * the first resistor. Since the id is what the net solver keys terminals by, a
 * collision merges two components into one net and the circuit solves as something
 * nobody drew.
 *
 * So there is one implementation, and both callers use it.
 */

/**
 * Reference designators, the way a textbook labels a circuit.
 *
 * Not uuids, deliberately. The id appears in every message the solver produces —
 * "R3 has a resistance of zero, which is a short circuit" — and that sentence has
 * to name something the student can point at on their own screen.
 */
const PREFIXES = {
  resistor: 'R',
  rheostat: 'Rh',
  capacitor: 'C',
  inductor: 'L',
  transformer: 'T',
  vsource: 'V',
  isource: 'I',
  ground: 'GND',
  ammeter: 'A',
  voltmeter: 'VM',
  wattmeter: 'W',
  cro: 'CRO',
  dso: 'DSO',
  diode: 'D',
  npn: 'Q',
  pnp: 'Q',
  opamp: 'U',
};

/** The next free designator for this type, given what is already on the bench. */
export function designator(components, type) {
  const prefix = PREFIXES[type] || 'X';
  const used = new Set((components || []).map((component) => component.id));
  for (let n = 1; n < 1000; n += 1) {
    if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`;
  }
  // Unreachable in any real circuit, and still not allowed to return a duplicate.
  return `${prefix}${Date.now()}`;
}

/** Where a click-to-place part lands: the middle of the canvas, in view. */
export const CANVAS_CENTRE = { x: 480, y: 300 };

/**
 * A component placed on the bench.
 *
 * Values come from the palette entry, which the server built from the solver's own
 * defaults table — so a part is placed set to exactly what the solver would assume
 * for it, rather than to a second copy of those numbers kept here.
 */
export function placeComponent(circuit, type, part, at = CANVAS_CENTRE) {
  const components = circuit?.components || [];
  const id = designator(components, type);
  const component = {
    id,
    type,
    label: id,
    x: at.x,
    y: at.y,
    rotation: 0,
    values: { ...(part?.defaults || {}) },
  };
  return { circuit: { ...circuit, components: [...components, component] }, id };
}

/**
 * A component removed, and every wire that touched it.
 *
 * The wires are the point. Left behind, they would name a component that is not
 * there, and the net solver resolves an unknown pin to node 0 — ground — rather
 * than complaining. The circuit would then solve, and solve as something nobody
 * drew, which is the failure this codebase keeps trying to avoid.
 */
export function removeComponent(circuit, id) {
  return {
    ...circuit,
    components: (circuit?.components || []).filter((component) => component.id !== id),
    wires: (circuit?.wires || []).filter(
      (wire) => wire.from.component !== id && wire.to.component !== id,
    ),
  };
}

/** A quarter turn. Four of them return the component to where it started. */
export function rotateComponent(circuit, id) {
  return {
    ...circuit,
    components: (circuit?.components || []).map((component) =>
      component.id === id
        ? { ...component, rotation: ((component.rotation || 0) + 90) % 360 }
        : component,
    ),
  };
}

/** One component's values replaced. */
export function updateComponent(circuit, next) {
  return {
    ...circuit,
    components: (circuit?.components || []).map((component) =>
      component.id === next.id ? next : component,
    ),
  };
}

export { PREFIXES };
