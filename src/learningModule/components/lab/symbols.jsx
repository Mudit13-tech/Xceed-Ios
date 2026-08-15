import React from 'react';

/**
 * The circuit symbols, and where each one's terminals are.
 *
 * ## Why these are drawn rather than imported
 *
 * A component here has to satisfy two things at once: it must look like the symbol
 * in the student's textbook, and its terminals must be at coordinates the wiring
 * code can compute. An icon font or an image sprite gives the first and not the
 * second — you cannot ask a PNG where its anode is — so the pin positions would
 * end up as a second, hand-maintained table beside the pictures, and the day it
 * drifted a wire would attach to empty space next to a terminal.
 *
 * So each symbol is a path *and* its pin offsets in the same object, in the same
 * coordinate system, and they cannot disagree.
 *
 * ## The coordinate system
 *
 * Every symbol is drawn centred on its own origin, and `pins` are offsets from
 * that centre. This is what makes rotation trivial: rotating about the origin
 * moves the drawing and its terminals together, with no bounding box to
 * recompute. A component's stored position is therefore its centre, not its
 * top-left corner.
 *
 * Pin *order* is not cosmetic — it is the contract with the solver. `COMPONENTS`
 * on the server says a wattmeter's pins 0–1 are the current coil and 2–3 the
 * pressure coil, and a diode's pin 0 is the anode. Reordering them here would
 * quietly rewire every circuit already saved, so the order matches the server's
 * `pinNames` and the two are checked against each other in the tests.
 */

const STROKE = 2;

/** A terminal: the little stub and the dot a student aims at. */
const lead = (x1, y1, x2, y2) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
);

/** The zig-zag of a resistor, so it reads as a resistor at a glance. */
const zigzag = (width = 32, height = 8, peaks = 6) => {
  const step = width / peaks;
  let path = `M ${-width / 2} 0`;
  for (let i = 0; i < peaks; i += 1) {
    const x = -width / 2 + step * (i + 0.5);
    path += ` L ${x} ${i % 2 === 0 ? -height : height}`;
  }
  return `${path} L ${width / 2} 0`;
};

const stroke = { stroke: 'currentColor', strokeWidth: STROKE, fill: 'none', strokeLinecap: 'round' };

export const SYMBOLS = {
  resistor: {
    pins: [[-30, 0], [30, 0]],
    box: [64, 24],
    draw: () => (
      <>
        {lead(-30, 0, -16, 0)}
        <path d={zigzag()} {...stroke} />
        {lead(16, 0, 30, 0)}
      </>
    ),
  },

  rheostat: {
    pins: [[-30, 0], [30, 0]],
    box: [64, 34],
    draw: () => (
      <>
        {lead(-30, 0, -16, 0)}
        <path d={zigzag()} {...stroke} />
        {lead(16, 0, 30, 0)}
        {/* The arrow is the whole point of the symbol: this is a resistance
            someone reaches over and changes. */}
        <path d="M -12 -14 L 12 -14 L 12 -8" {...stroke} />
        <path d="M 8 -12 L 12 -8 L 16 -12" {...stroke} />
      </>
    ),
  },

  capacitor: {
    pins: [[-26, 0], [26, 0]],
    box: [56, 28],
    draw: () => (
      <>
        {lead(-26, 0, -5, 0)}
        {lead(-5, -12, -5, 12)}
        {lead(5, -12, 5, 12)}
        {lead(5, 0, 26, 0)}
      </>
    ),
  },

  inductor: {
    pins: [[-30, 0], [30, 0]],
    box: [64, 24],
    draw: () => (
      <>
        {lead(-30, 0, -18, 0)}
        {/* Four bumps, the way a coil is drawn. */}
        <path d="M -18 0 A 4.5 4.5 0 0 1 -9 0 A 4.5 4.5 0 0 1 0 0 A 4.5 4.5 0 0 1 9 0 A 4.5 4.5 0 0 1 18 0" {...stroke} />
        {lead(18, 0, 30, 0)}
      </>
    ),
  },

  vsource: {
    // Pin 0 is the + terminal, matching the server's pinNames.
    pins: [[0, -28], [0, 28]],
    box: [44, 60],
    draw: () => (
      <>
        {lead(0, -28, 0, -14)}
        <circle cx={0} cy={0} r={14} {...stroke} />
        {/* + and − inside the circle, so the polarity is visible without
            clicking the component. Students wire sources backwards constantly
            and the symbol should be the thing that tells them. */}
        {lead(-5, -6, 5, -6)}
        {lead(0, -11, 0, -1)}
        {lead(-5, 7, 5, 7)}
        {lead(0, 14, 0, 28)}
      </>
    ),
  },

  isource: {
    pins: [[0, -28], [0, 28]],
    box: [44, 60],
    draw: () => (
      <>
        {lead(0, -28, 0, -14)}
        <circle cx={0} cy={0} r={14} {...stroke} />
        {/* The arrow points the way the current is driven. */}
        <path d="M 0 8 L 0 -8" {...stroke} />
        <path d="M -4 -4 L 0 -8 L 4 -4" {...stroke} />
        {lead(0, 14, 0, 28)}
      </>
    ),
  },

  ground: {
    pins: [[0, -16]],
    box: [36, 36],
    draw: () => (
      <>
        {lead(0, -16, 0, 0)}
        {lead(-14, 0, 14, 0)}
        {lead(-9, 5, 9, 5)}
        {lead(-4, 10, 4, 10)}
      </>
    ),
  },

  /* ── instruments ───────────────────────────────────────────────────────── */

  /** A meter is a circle with a letter in it, which is exactly how it is drawn. */
  ammeter: meter('A', [[-26, 0], [26, 0]]),
  voltmeter: meter('V', [[-26, 0], [26, 0]]),

  wattmeter: {
    // 0–1 the current coil, 2–3 the pressure coil. Four terminals because a real
    // wattmeter has four, and because the connection students get wrong is
    // exactly the one a two-pin symbol would hide.
    pins: [[-30, -14], [30, -14], [-30, 14], [30, 14]],
    box: [72, 52],
    draw: () => (
      <>
        <circle cx={0} cy={0} r={18} {...stroke} />
        <text
          x={0}
          y={5}
          textAnchor="middle"
          fontSize={14}
          fontWeight="600"
          fill="currentColor"
          stroke="none"
        >
          W
        </text>
        {lead(-30, -14, -14, -11)}
        {lead(14, -11, 30, -14)}
        {lead(-30, 14, -14, 11)}
        {lead(14, 11, 30, 14)}
      </>
    ),
  },

  cro: scope('CRO'),
  dso: scope('DSO'),

  /* ── electronics ───────────────────────────────────────────────────────── */

  diode: {
    // Pin 0 anode, pin 1 cathode — the bar.
    pins: [[-26, 0], [26, 0]],
    box: [56, 28],
    draw: () => (
      <>
        {lead(-26, 0, -9, 0)}
        <path d="M -9 -10 L -9 10 L 9 0 Z" stroke="currentColor" strokeWidth={STROKE} fill="currentColor" />
        {lead(9, -10, 9, 10)}
        {lead(9, 0, 26, 0)}
      </>
    ),
  },

  npn: transistor(false),
  pnp: transistor(true),

  opamp: {
    // 0 non-inverting, 1 inverting, 2 output.
    pins: [[-30, -12], [-30, 12], [34, 0]],
    box: [72, 48],
    draw: () => (
      <>
        {lead(-30, -12, -18, -12)}
        {lead(-30, 12, -18, 12)}
        <path d="M -18 -20 L -18 20 L 20 0 Z" {...stroke} />
        {/* The + and − inside the triangle. Getting these the wrong way round
            turns negative feedback into a latch, so they are drawn rather than
            left to a tooltip. */}
        {lead(-14, -15, -8, -15)}
        {lead(-11, -18, -11, -12)}
        {lead(-14, 15, -8, 15)}
        {lead(20, 0, 34, 0)}
      </>
    ),
  },
};

/** A round meter with a letter in it. */
function meter(letter, pins) {
  return {
    pins,
    box: [56, 36],
    draw: () => (
      <>
        {lead(pins[0][0], 0, -14, 0)}
        <circle cx={0} cy={0} r={14} {...stroke} />
        <text
          x={0}
          y={5}
          textAnchor="middle"
          fontSize={14}
          fontWeight="600"
          fill="currentColor"
          stroke="none"
        >
          {letter}
        </text>
        {lead(14, 0, pins[1][0], 0)}
      </>
    ),
  };
}

/** A scope: a screen with a trace on it, and two probes. */
function scope(letters) {
  return {
    pins: [[-34, 10], [-14, 10]],
    box: [76, 62],
    draw: () => (
      <>
        <rect x={-30} y={-24} width={60} height={34} rx={4} {...stroke} />
        {/* A little sine on the screen, so a scope is recognisable at thumbnail
            size without reading the label. */}
        <path
          d="M -24 -7 Q -18 -20 -12 -7 Q -6 6 0 -7 Q 6 -20 12 -7 Q 18 6 24 -7"
          {...stroke}
          strokeWidth={1.4}
        />
        <text x={0} y={20} textAnchor="middle" fontSize={9} fontWeight="600" fill="currentColor" stroke="none">
          {letters}
        </text>
        {lead(-34, 10, -34, 4)}
        {lead(-14, 10, -14, 4)}
      </>
    ),
  };
}

/**
 * A bipolar transistor. Collector top, base left, emitter bottom — the way it is
 * drawn in every textbook, and the pin order the server expects.
 *
 * The only difference between npn and pnp is which way the emitter arrow points,
 * which is also the only difference that matters when a student is looking for
 * the right one in the palette.
 */
function transistor(inward) {
  return {
    pins: [[0, -32], [-28, 0], [0, 32]],
    box: [64, 74],
    draw: () => (
      <>
        {lead(-28, 0, -10, 0)}
        {/* The base bar. */}
        {lead(-10, -16, -10, 16)}
        {lead(-10, -8, 12, -20)}
        {lead(-10, 8, 12, 20)}
        {lead(12, -20, 12, -32)}
        {lead(0, -32, 12, -32)}
        {lead(12, 20, 12, 32)}
        {lead(0, 32, 12, 32)}
        {/* The emitter arrow: outward for npn ("not pointing iN"), inward for pnp. */}
        {inward ? (
          <path d="M 0 10 L 6 17 L -2 18 Z" fill="currentColor" stroke="none" />
        ) : (
          <path d="M 6 15 L 12 20 L 4 22 Z" fill="currentColor" stroke="none" />
        )}
      </>
    ),
  };
}

/** Anything the palette offers that has no drawing yet still gets a box. */
export const FALLBACK = {
  pins: [[-24, 0], [24, 0]],
  box: [52, 28],
  draw: () => <rect x={-16} y={-10} width={32} height={20} rx={3} {...stroke} />,
};

export const symbolFor = (type) => SYMBOLS[type] || FALLBACK;

/**
 * A pin's position on the canvas, with the component's rotation applied.
 *
 * The one piece of geometry the rest of the canvas depends on, so it lives here
 * beside the offsets it reads. Rotation is in degrees and about the component's
 * own centre; because pins are stored as offsets from that centre, this is a
 * plain rotation with nothing to correct for.
 */
export function pinPosition(component, index) {
  const symbol = symbolFor(component.type);
  const [dx, dy] = symbol.pins[index] || [0, 0];
  const angle = ((component.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: (component.x || 0) + dx * cos - dy * sin,
    y: (component.y || 0) + dx * sin + dy * cos,
  };
}

/** How many terminals a placed component has, without asking the server. */
export const pinCount = (type) => symbolFor(type).pins.length;
