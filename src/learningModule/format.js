// Formatting helpers and shared constants.
//
// Deliberately not in components/common.jsx: mixing non-component exports into
// a component module breaks React Fast Refresh for that whole file.

const RELATIVE_UNITS = [
  ['year', 31536000000],
  ['month', 2592000000],
  ['day', 86400000],
  ['hour', 3600000],
  ['minute', 60000],
];

/** "in 3 days" / "2 hours ago" without pulling in another date library. */
export function relativeTime(value) {
  if (!value) return '';
  const diff = new Date(value).getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * An ISO date as `<input type="datetime-local">` wants it: local wall-clock,
 * no zone, minute precision. `toISOString` would shift the value into UTC and
 * show the teacher a time they never typed.
 */
export function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

/** Palette offered when picking a class colour. */
export const CLASS_COLORS = [
  '#1967d2',
  '#0f9d58',
  '#d93025',
  '#f4b400',
  '#7b1fa2',
  '#00838f',
  '#e65100',
  '#455a64',
];

const CODING_META = { icon: '🐍', label: 'Coding exercise', colorScheme: 'teal' };

export const WORK_TYPE_META = {
  assignment: { icon: '📄', label: 'Assignment', colorScheme: 'blue' },
  quiz: { icon: '🧠', label: 'Quiz', colorScheme: 'purple' },
  question: { icon: '❓', label: 'Question', colorScheme: 'orange' },
  material: { icon: '📚', label: 'Material', colorScheme: 'green' },
  coding: CODING_META,
  // Rows published before `coding` was a workType are stored as assignments
  // carrying a `notebookId`, and still resolve through here. Either shape has to
  // read as a coding exercise: "📄 Assignment due" tells a student nothing about
  // what they have to open.
  notebook: CODING_META,
};

/**
 * The calendar/classwork identity of a coursework row.
 *
 * A notebook is mirrored into Classwork so it inherits the due date and the
 * gradebook column, but everywhere it is listed it should say what it is and
 * link to the exercise rather than to its gradebook row.
 */
export const courseworkMeta = (item) =>
  item?.notebookId ? CODING_META : WORK_TYPE_META[item?.workType] || WORK_TYPE_META.assignment;

export const courseworkLink = (item) =>
  item?.notebookId
    ? `/learning/class/${item.classId}/notebook/${item.notebookId}`
    : `/learning/class/${item?.classId}/work/${item?._id}`;

/**
 * Renders a computed answer value — the number a parameterised tutorial or
 * assignment works out from the teacher's formula.
 *
 * Rounding is the teacher's call, not this function's. When they have set a
 * decimal count on the answer that count is honoured exactly, trailing zeros
 * and all ("2.50" when they asked for two places, because that is what the
 * student is being told to write). When they have not, the value is shown in
 * full and unrounded.
 *
 * The `Math.round(value * 1e6) / 1e6` this replaces did neither: it silently
 * rounded to six decimal places, which printed a 1.6e-19 C charge as "0", and
 * it overflowed the multiply past ~9e15 and printed "Infinity". Both look like
 * the formula miscalculated when it did not.
 */
export function formatAnswerValue(value, decimals = null) {
  const number = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(number)) return '—';

  const places = Number(decimals);
  if (decimals !== null && decimals !== undefined && decimals !== '' && Number.isFinite(places)) {
    return number.toFixed(Math.max(0, Math.min(20, Math.trunc(places))));
  }
  // Shortest string that round-trips to exactly this number: no rounding, and
  // correct at both ends of the range (1.6e-19, 2.5e+300).
  return String(number);
}

/** "to 2 decimal places", for the instruction shown beside a student's input. */
export function decimalPlacesHint(decimals) {
  const places = Number(decimals);
  if (decimals === null || decimals === undefined || decimals === '' || !Number.isFinite(places)) return '';
  const whole = Math.max(0, Math.trunc(places));
  return whole === 0 ? 'to the nearest whole number' : `to ${whole} decimal place${whole === 1 ? '' : 's'}`;
}
