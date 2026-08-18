/**
 * Engineering notation, because a lab bench does not speak in exponents.
 *
 * A student reading `0.000001 F` has to count zeros; `1 µF` is the value they were
 * taught and the value printed on the part. And the exponent has to move in steps
 * of three — 47000 Ω is 47 kΩ, never 4.7e4 Ω — because those are the prefixes that
 * exist. Anything else is technically the same number and unreadable on a meter.
 */

const PREFIXES = [
  { exp: 12, symbol: 'T' },
  { exp: 9, symbol: 'G' },
  { exp: 6, symbol: 'M' },
  { exp: 3, symbol: 'k' },
  { exp: 0, symbol: '' },
  { exp: -3, symbol: 'm' },
  { exp: -6, symbol: 'µ' },
  { exp: -9, symbol: 'n' },
  { exp: -12, symbol: 'p' },
];

/**
 * @param value      the number
 * @param unit       'Ω', 'V', 'A'… appended after the prefix
 * @param digits     significant figures, 3 by default — what a bench meter shows
 */
export function eng(value, unit = '', digits = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (number === 0) return `0${unit ? ` ${unit}` : ''}`;

  const magnitude = Math.abs(number);
  // Below a picounit there is no prefix left, so it is reported as zero rather
  // than as a wall of zeros. A reverse-biased diode's leakage genuinely is 1e-14 A
  // and "0 A" is the honest reading for it on any real instrument.
  const chosen = PREFIXES.find((prefix) => magnitude >= 10 ** prefix.exp) || PREFIXES[PREFIXES.length - 1];
  const scaled = number / 10 ** chosen.exp;

  // Significant figures, not decimal places: 4.70 kΩ and 470 Ω both read as three
  // figures, which is what a three-and-a-half digit meter does.
  const whole = Math.floor(Math.abs(scaled)).toString().length;
  const decimals = Math.max(0, digits - whole);
  const fixed = scaled.toFixed(decimals);
  // Trailing zeros come off the *decimal* part only. Stripping them from a whole
  // number turns 470 Ω into 47 Ω — a real reading, off by a factor of ten, with
  // nothing about it to suggest anything went wrong. This guard is the whole
  // reason the formatter has tests.
  const text = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;

  return `${text}${chosen.symbol ? ` ${chosen.symbol}` : ' '}${unit}`.trim();
}

/** A phase angle, or nothing when the analysis has no phase to report. */
export const phase = (degrees) =>
  degrees === null || degrees === undefined || !Number.isFinite(Number(degrees))
    ? ''
    : `∠${Number(degrees).toFixed(1)}°`;

/**
 * What a run says about one component, as three strings.
 *
 * Shared by the canvas labels and the readings table so the number a student
 * reads off the bench is character-for-character the number in the table. Two
 * formatters would eventually round differently, and a student comparing them
 * would be right to think one of them was wrong.
 *
 * A `null` current is not zero — it is a component whose current the solver will
 * not claim to know (a transistor, an op-amp), and it is shown as a dash for
 * exactly that reason.
 */
export function deviceSummary(device) {
  const power = device.power === null || device.power === undefined
    ? null
    // Sources come back with the power they *absorb*, which is negative when
    // they are driving the circuit. A student reading "−50 mW" off a battery
    // learns the sign convention by accident and the wrong way round, so the
    // magnitude is shown and the direction is said in words.
    : eng(Math.abs(device.power), 'W');

  return {
    voltage: eng(device.voltage, 'V'),
    current: device.current === null || device.current === undefined ? '—' : eng(device.current, 'A'),
    power: power === null ? '—' : power,
    delivering: Boolean(device.delivering),
  };
}

/**
 * What each component is labelled with on the canvas after a run.
 *
 * A meter gets the one number it measures, because that is what a meter is. Every
 * other part gets its voltage, current and power stacked over it — the three
 * numbers the run already solved for, put where the component is rather than in a
 * table the student has to match ids against.
 *
 * Here rather than in the bench screen because the teacher's editor draws the same
 * canvas from the same result, and a second copy of this mapping would eventually
 * label one of the two benches differently from the other.
 *
 * @param detailed  false leaves only the meters. A dense circuit is easier to
 *                  *wire* without three numbers over every part, so it is a switch
 *                  rather than a decision made here.
 */
export function benchReadings(result, { detailed = true } = {}) {
  if (!result?.ok) return {};

  const meters = Object.fromEntries(
    (result.instruments || [])
      .filter((meter) => meter.type !== 'cro' && meter.type !== 'dso')
      .map((meter) => [meter.id, eng(meter.magnitude, meter.unit)]),
  );

  if (!detailed) return meters;

  const parts = Object.fromEntries(
    (result.devices || [])
      .filter((device) => !device.instrument)
      .map((device) => {
        const shown = deviceSummary(device);
        // Voltage first and nearest the part, because it is the one a student can
        // also get by putting a voltmeter across it — so the canvas and the meter
        // agree at a glance.
        const lines = [
          shown.voltage,
          shown.current,
          shown.delivering ? `${shown.power} out` : shown.power,
        ];
        // A transformer's secondary voltage, because it is half of every reading
        // taken from one and it is not on the primary side of the symbol where
        // the other three sit.
        if (device.secondary) lines.push(`sec ${deviceSummary(device.secondary).voltage}`);
        return [device.id, lines];
      }),
  );

  // Meters last: an ammeter is also a device, and the one number it measures is
  // what it should be labelled with.
  return { ...parts, ...meters };
}

/**
 * The one value worth printing next to a component on the canvas.
 *
 * A resistor is its resistance; a source is its amplitude. Showing every field
 * would turn a circuit diagram into a table, and showing none would make a
 * student click each part to find out what it is set to.
 */
export function primaryValue(component, fields = []) {
  const first = fields.find((field) => !field.advanced) || fields[0];
  if (!first) return '';
  const value = component.values?.[first.key];
  if (value === undefined || value === null || value === '') return '';
  return eng(value, first.unit || '');
}
