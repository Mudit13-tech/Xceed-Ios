/**
 * Taking a table off the screen and into a spreadsheet.
 *
 * A head of department reads these tables and then has to *use* them — in a
 * meeting, in a mail to the timetable office, in a sheet with three other
 * columns of their own. Retyping thirty rows is how a number gets copied wrong,
 * so every table on the HOD screens offers exactly what it is showing, in the
 * order it is showing it, filters and all.
 */

/**
 * One CSV cell.
 *
 * A leading `=`, `+`, `-` or `@` makes Excel and Sheets treat the text as a
 * formula, which is both wrong and a known way to smuggle something executable
 * into somebody else's spreadsheet. The value is prefixed with an apostrophe in
 * that case: the cell still reads as what it says, and the spreadsheet stops
 * trying to evaluate it. Same rule as the attendance module's exporter.
 */
export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** A header row and its rows, as CSV text. CRLF, which is what Excel expects. */
export function toCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

/**
 * Hands the browser a file.
 *
 * A BOM goes in front, because without one Excel on Windows opens a UTF-8 CSV
 * as the local codepage and turns every accented name and every "—" into
 * mojibake. The object URL is revoked on the next tick; letting it leak keeps
 * the whole file in memory for the life of the tab.
 */
export function downloadCsv(filename, csv) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Builds the CSV and hands it over, which is what every caller actually wants. */
export function exportCsv(filename, headers, rows) {
  downloadCsv(filename, toCsv(headers, rows));
}

/**
 * A filename that says what the file is and when it was taken.
 *
 * Downloads land in one folder and stay there; "hod-subjects.csv (3)" tells
 * nobody which department or which week it came from.
 */
export function csvFilename(...parts) {
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = parts
    .filter(Boolean)
    .map((part) => String(part).trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('-')
    .toLowerCase();
  return `${slug || 'export'}-${stamp}.csv`;
}
