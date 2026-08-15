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
