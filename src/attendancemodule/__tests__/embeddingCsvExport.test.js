import { describe, expect, it } from 'vitest';
import {
  buildMissingGroundTruthCsv,
  buildSemesterEmbeddingCsv,
  csvFilenamePart,
} from '../embeddingCsvExport';

const files = [
  {
    displayName: 'Signals, Systems',
    rosterRollNos: ['21ECE003', '21ECE001', '21ECE002'],
    rollNos: ['21ECE001', '21ECE002'],
    missedRollNos: [{ rollNo: '21ECE002' }],
  },
  {
    subject: 'Algorithms',
    rosterRollNos: ['21ECE004', '21ECE002'],
    rollNos: ['21ECE004'],
    missedRollNos: ['21ECE002', '21ECE005'],
  },
];

describe('embedding semester CSV exports', () => {
  it('exports one row per subject with roster, embedded and missing rolls', () => {
    expect(buildSemesterEmbeddingCsv(files)).toBe([
      '"Subject","Subject Roster Roll Nos","Embedded Roll Nos","Ground Truth Missing Roll Nos"',
      '"Algorithms","21ECE002; 21ECE004","21ECE004","21ECE002; 21ECE005"',
      '"Signals, Systems","21ECE001; 21ECE002; 21ECE003","21ECE001","21ECE002"',
    ].join('\r\n'));
  });

  it('combines missing-ground-truth rolls across subjects without duplicates', () => {
    expect(buildMissingGroundTruthCsv(files)).toBe([
      '"Ground Truth Missing Roll No"',
      '"21ECE002"',
      '"21ECE005"',
    ].join('\r\n'));
  });

  it('creates filesystem-safe filename segments', () => {
    expect(csvFilenamePart('Computer Science & Engineering', 'department'))
      .toBe('Computer_Science_Engineering');
    expect(csvFilenamePart('', 'semester')).toBe('semester');
  });
});
