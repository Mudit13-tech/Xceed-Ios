/**
 * The virtual lab's client-side arithmetic.
 *
 * Three things on this side compute rather than display, and each of them is
 * wrong in a way that looks right:
 *
 *   · **Pin geometry.** A wire attaches to a coordinate. Get the rotation
 *     arithmetic wrong and the wire lands *near* the terminal — close enough to
 *     look connected on screen while the circuit the server solves is a different
 *     one. Nothing about the picture would tell anybody.
 *   · **The scope's measurements.** A DSO prints RMS, mean and frequency, and a
 *     student writes them down. These come out of the samples here, so a wrong
 *     formula is a wrong number in a lab report with a plausible unit on it.
 *   · **Designators.** The id is what the net solver keys terminals by, so two
 *     components sharing one are merged into a single net and the circuit solves
 *     as something nobody drew.
 *
 * So all three are checked against values computed in the test: √2/2 for the RMS
 * of a unit sine, the mean of a half-wave rectified sine, rotation by hand.
 */

import { describe, expect, it } from 'vitest';
import { pinPosition, symbolFor } from '../components/lab/symbols';
import { measure } from '../components/lab/ScopeView';
import { designator, placeComponent, removeComponent, rotateComponent } from '../components/lab/benchOps';
import { eng } from '../components/lab/format';

describe('pin geometry', () => {
  it('puts a resistor’s terminals either side of it', () => {
    const resistor = { id: 'R1', type: 'resistor', x: 100, y: 50, rotation: 0 };
    const a = pinPosition(resistor, 0);
    const b = pinPosition(resistor, 1);
    expect(a.y).toBeCloseTo(50, 9);
    expect(b.y).toBeCloseTo(50, 9);
    expect(a.x).toBeLessThan(100);
    expect(b.x).toBeGreaterThan(100);
    // Symmetric about the component's own centre, which is what makes rotation
    // work without a bounding box to correct for.
    expect(a.x - 100).toBeCloseTo(-(b.x - 100), 9);
  });

  it('rotates terminals about the component, not about the origin', () => {
    // The bug this guards: rotating about (0,0) instead of the component's centre
    // flings its terminals across the canvas while the drawing stays put.
    const resistor = { id: 'R1', type: 'resistor', x: 200, y: 120, rotation: 90 };
    const a = pinPosition(resistor, 0);
    const b = pinPosition(resistor, 1);
    // Turned a quarter turn, a horizontal component becomes vertical.
    expect(a.x).toBeCloseTo(200, 9);
    expect(b.x).toBeCloseTo(200, 9);
    expect(a.y).toBeLessThan(120);
    expect(b.y).toBeGreaterThan(120);
  });

  it('brings a terminal back to where it started after four quarter turns', () => {
    const at = (rotation) => pinPosition({ id: 'Q1', type: 'npn', x: 300, y: 300, rotation }, 1);
    const start = at(0);
    const round = at(360);
    expect(round.x).toBeCloseTo(start.x, 6);
    expect(round.y).toBeCloseTo(start.y, 6);
  });

  it('keeps a terminal the same distance from the centre however it is turned', () => {
    // A rotation that is not a rotation — a shear, from a sign error in the matrix
    // — changes this distance, and a sheared component's terminals no longer line
    // up with the grid the snapping relies on.
    const radius = (rotation) => {
      const at = pinPosition({ id: 'W1', type: 'wattmeter', x: 0, y: 0, rotation }, 2);
      return Math.hypot(at.x, at.y);
    };
    [0, 45, 90, 180, 270].forEach((rotation) => {
      expect(radius(rotation)).toBeCloseTo(radius(0), 6);
    });
  });

  it('gives every symbol as many terminals as the solver expects', () => {
    // The pin *order* is the contract with the server: a wattmeter's 0–1 is the
    // current coil and 2–3 the pressure coil, and a diode's 0 is the anode.
    // Reordering them here would silently rewire every saved circuit.
    expect(symbolFor('wattmeter').pins).toHaveLength(4);
    expect(symbolFor('npn').pins).toHaveLength(3);
    expect(symbolFor('pnp').pins).toHaveLength(3);
    expect(symbolFor('opamp').pins).toHaveLength(3);
    expect(symbolFor('ground').pins).toHaveLength(1);
    expect(symbolFor('resistor').pins).toHaveLength(2);
  });

  it('falls back to a box rather than crashing on a part it has no drawing for', () => {
    // A component added to the solver before a symbol is drawn for it should
    // appear as a labelled box, not take the canvas down.
    const unknown = symbolFor('something-new');
    expect(unknown.pins.length).toBeGreaterThan(0);
    expect(typeof unknown.draw).toBe('function');
  });
});

describe('the scope’s measurements', () => {
  /**
   * `n` samples of a sine: `cycles` complete cycles spread over `duration`
   * seconds, so the frequency under test is `cycles / duration` and not always 1.
   */
  const sine = (n, cycles, amplitude = 1, offset = 0, duration = cycles) => {
    const samples = [];
    const times = [];
    for (let i = 0; i < n; i += 1) {
      const t = (i / (n - 1)) * duration;
      times.push(t);
      samples.push(offset + amplitude * Math.sin((2 * Math.PI * cycles * t) / duration));
    }
    return { samples, times };
  };

  it('gets the RMS of a sine right', () => {
    // A/√2 = 0.7071. The number every student is asked to verify on a scope, and
    // the one a mean-of-absolute-values mistake returns as 0.637 instead.
    const { samples } = sine(2001, 4);
    expect(measure(samples, sine(2001, 4).times).rms).toBeCloseTo(Math.SQRT1_2, 3);
  });

  it('gets peak-to-peak right', () => {
    const { samples, times } = sine(2001, 2, 5);
    expect(measure(samples, times).peakToPeak).toBeCloseTo(10, 3);
  });

  it('reports a sine’s mean as zero and a rectified one’s as 2A/π', () => {
    const clean = sine(4001, 6);
    expect(measure(clean.samples, clean.times).mean).toBeCloseTo(0, 3);

    // Half-wave rectified: the mean is A/π ≈ 0.3183, which is the DC component a
    // rectifier delivers and the number the experiment is about.
    const rectified = {
      samples: clean.samples.map((value) => Math.max(0, value)),
      times: clean.times,
    };
    expect(measure(rectified.samples, rectified.times).mean).toBeCloseTo(1 / Math.PI, 2);
  });

  it('finds the frequency of a plain sine', () => {
    // Four cycles over four seconds is 1 Hz.
    const { samples, times } = sine(4001, 4);
    expect(measure(samples, times).frequency).toBeCloseTo(1, 2);
  });

  it('finds the frequency of a rectified wave, which has no zero crossings', () => {
    // The reason the mean is removed before hunting for crossings. A rectified
    // sine never goes below zero, so counting sign changes of the raw signal finds
    // none and the frequency comes back as null — on the one trace an electronics
    // lab looks at most.
    const { samples, times } = sine(4001, 4);
    const rectified = samples.map((value) => Math.max(0, value));
    expect(measure(rectified, times).frequency).toBeCloseTo(1, 1);
  });

  it('finds the frequency of a signal riding on a DC offset', () => {
    // Five cycles in four seconds is 1.25 Hz, on top of 12 V of DC.
    const { samples, times } = sine(4001, 5, 1, 12, 4);
    const stats = measure(samples, times);
    expect(stats.frequency).toBeCloseTo(1.25, 2);
    expect(stats.mean).toBeCloseTo(12, 2);
  });

  it('says nothing rather than guessing when there is no periodicity', () => {
    // A DC level has no frequency. Returning one — or a divide-by-zero infinity —
    // would be a number a student would write down.
    const flat = { samples: new Array(500).fill(3), times: Array.from({ length: 500 }, (_, i) => i / 499) };
    expect(measure(flat.samples, flat.times).frequency).toBeNull();
    expect(measure(flat.samples, flat.times).rms).toBeCloseTo(3, 9);
  });

  it('returns nothing for an empty trace', () => {
    expect(measure([], [])).toBeNull();
    expect(measure(undefined, undefined)).toBeNull();
  });
});

describe('designators', () => {
  it('numbers each type from one', () => {
    expect(designator([], 'resistor')).toBe('R1');
    expect(designator([{ id: 'R1' }], 'resistor')).toBe('R2');
    expect(designator([{ id: 'R1' }, { id: 'R2' }], 'resistor')).toBe('R3');
  });

  it('does not let a rheostat collide with a resistor', () => {
    // The bug that prompted extracting this: two code paths minted ids, one used
    // `Rh` and the other took the first letter, so a rheostat could be handed `R1`
    // — and the net solver keys terminals by id, so the two components' pins merge
    // into one net and the circuit solves as something nobody drew.
    expect(designator([{ id: 'R1' }], 'rheostat')).toBe('Rh1');
    expect(designator([{ id: 'Rh1' }], 'resistor')).toBe('R1');
  });

  it('fills a gap rather than always taking the highest number', () => {
    expect(designator([{ id: 'R1' }, { id: 'R3' }], 'resistor')).toBe('R2');
  });

  it('never returns an id already in use', () => {
    const components = Array.from({ length: 60 }, (_, i) => ({ id: `R${i + 1}` }));
    const next = designator(components, 'resistor');
    expect(components.map((c) => c.id)).not.toContain(next);
  });
});

describe('bench edits', () => {
  const bench = {
    components: [
      { id: 'V1', type: 'vsource', x: 100, y: 100, rotation: 0, values: {} },
      { id: 'R1', type: 'resistor', x: 200, y: 100, rotation: 0, values: { resistance: 100 } },
    ],
    wires: [{ from: { component: 'V1', pin: 0 }, to: { component: 'R1', pin: 0 } }],
  };

  it('places a part with the palette’s own defaults', () => {
    // The defaults come from the server, which read them from the solver's table.
    // A second copy kept here is a second source of truth for what a 1 kΩ resistor
    // is.
    const { circuit, id } = placeComponent(bench, 'resistor', { defaults: { resistance: 4700 } });
    expect(id).toBe('R2');
    expect(circuit.components).toHaveLength(3);
    expect(circuit.components[2].values.resistance).toBe(4700);
    expect(circuit.components[2].label).toBe('R2');
  });

  it('takes a removed component’s wires with it', () => {
    // Left behind, a wire names a component that is not there — and the server's
    // net solver resolves an unknown pin to node 0, which is ground. The circuit
    // then solves, as something nobody drew, which is worse than an error.
    const next = removeComponent(bench, 'R1');
    expect(next.components.map((c) => c.id)).toEqual(['V1']);
    expect(next.wires).toHaveLength(0);
  });

  it('leaves unrelated wires alone', () => {
    const wider = {
      ...bench,
      components: [...bench.components, { id: 'G1', type: 'ground', x: 0, y: 0 }],
      wires: [
        ...bench.wires,
        { from: { component: 'R1', pin: 1 }, to: { component: 'G1', pin: 0 } },
      ],
    };
    expect(removeComponent(wider, 'V1').wires).toHaveLength(1);
  });

  it('rotates in quarter turns and wraps at a full turn', () => {
    let circuit = bench;
    for (let i = 0; i < 4; i += 1) circuit = rotateComponent(circuit, 'R1');
    expect(circuit.components.find((c) => c.id === 'R1').rotation).toBe(0);
    expect(rotateComponent(bench, 'R1').components.find((c) => c.id === 'R1').rotation).toBe(90);
  });
});

describe('engineering notation', () => {
  it('moves the exponent in steps of three, as the prefixes do', () => {
    expect(eng(47000, 'Ω')).toBe('47 kΩ');
    expect(eng(0.000001, 'F')).toBe('1 µF');
    expect(eng(0.0043, 'A')).toBe('4.3 mA');
    expect(eng(1200000, 'Hz')).toBe('1.2 MHz');
  });

  it('keeps three significant figures, not three decimal places', () => {
    // What a three-and-a-half digit bench meter shows.
    expect(eng(4.7015, 'V')).toBe('4.7 V');
    expect(eng(470.15, 'V')).toBe('470 V');
  });

  it('reports zero as zero rather than as a prefix', () => {
    expect(eng(0, 'V')).toBe('0 V');
  });

  it('reports a reverse-biased diode’s leakage as the zero any real meter shows', () => {
    // 1e-14 A is genuinely what the solver returns, and it is genuinely zero on
    // any instrument a student will ever hold.
    expect(eng(1e-14, 'A')).toMatch(/^0/);
  });

  it('does not pretend a non-number is a reading', () => {
    expect(eng(NaN, 'V')).toBe('—');
    expect(eng(undefined, 'V')).toBe('—');
    expect(eng(Infinity, 'V')).toBe('—');
  });
});
