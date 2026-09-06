import { describe, expect, it } from 'vitest';

import { csvCell, csvFilename, toCsv } from '../csv';

/**
 * The CSV a head of department downloads.
 *
 * Two of these are about the file being *safe* rather than merely correct: a
 * cell that starts with "=" is a formula to Excel, and a quote inside a value
 * splits the row in two if it is not doubled. The rest is about the file being
 * findable a week later, which is what the filename is for.
 */

describe('csvCell', () => {
  it('quotes every value, so a comma in a name cannot split the row', () => {
    expect(csvCell('Sharma, A')).toBe('"Sharma, A"');
  });

  it('doubles quotes rather than letting them end the field early', () => {
    expect(csvCell('the "lab" section')).toBe('"the ""lab"" section"');
  });

  it('defuses a value a spreadsheet would run as a formula', () => {
    // Leading =, +, - or @ makes Excel and Sheets evaluate the cell.
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('+A1')).toBe('"\'+A1"');
    expect(csvCell('-2')).toBe('"\'-2"');
    expect(csvCell('@name')).toBe('"\'@name"');
  });

  it('writes an empty cell for nothing at all, not "null"', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
    // Zero is a number somebody wants to see.
    expect(csvCell(0)).toBe('"0"');
  });
});

describe('toCsv', () => {
  it('puts the header first and separates rows with CRLF, which is what Excel expects', () => {
    expect(toCsv(['A', 'B'], [[1, 2], [3, 4]])).toBe('"A","B"\r\n"1","2"\r\n"3","4"');
  });
});

describe('csvFilename', () => {
  it('names the file after what is in it and when it was taken', () => {
    const name = csvFilename('subjects', 'Computer Science & Engineering', '2026-27 Odd');
    expect(name).toMatch(/^subjects-computer-science-engineering-2026-27-odd-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('skips the parts a filtered view does not have', () => {
    expect(csvFilename('semesters', '', null)).toMatch(/^semesters-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
