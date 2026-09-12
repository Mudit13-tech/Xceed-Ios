import { describe, expect, it } from 'vitest';

import {
  NOTEBOOK_FILE_FORMAT,
  buildNotebookFile,
  countTestCases,
  isNotebookFile,
  notebookFileName,
  parseNotebookFile,
} from '../notebookTransfer';
import { SAMPLE_NOTEBOOK_CELLS } from '../sampleNotebook';

/**
 * The notebook file is how one teacher hands a notebook to another, so the
 * round trip has to lose nothing: every cell, every hidden test case and every
 * setting. And a file from somewhere else must fail with a message, not a crash.
 */

const notebook = {
  title: 'Lab 2: Arrays in C',
  description: 'Each cell is its own program.',
  language: 'c',
  packages: [],
  colabUrl: '',
  dueDate: '2030-01-01T10:00:00.000Z',
  settings: { allowAddCells: false, showSolutionAfterSubmit: true, requireFullscreen: true, blockPaste: true },
};

const roundTrip = (nb, cells) => parseNotebookFile(JSON.stringify(buildNotebookFile(nb, cells)));

describe('learningModule notebook file', () => {
  it('carries every cell, hidden test case and setting through a round trip', () => {
    const cells = SAMPLE_NOTEBOOK_CELLS.c.map((cell) => ({ ...cell, _id: 'db-id', outputs: [{ type: 'stdout', text: 'x' }] }));
    const { notebook: back, cells: backCells } = roundTrip(notebook, cells);

    expect(back).toMatchObject({
      title: notebook.title,
      description: notebook.description,
      language: 'c',
      dueDate: notebook.dueDate,
      settings: notebook.settings,
    });
    expect(backCells).toHaveLength(cells.length);
    backCells.forEach((cell, i) => {
      expect(cell.source).toBe(cells[i].source);
      expect(cell.hidden).toBe(Boolean(cells[i].hidden));
      expect(cell.locked).toBe(Boolean(cells[i].locked));
      expect(cell.stdin).toBe(cells[i].stdin || '');
      expect(cell.testCases).toEqual((cells[i].testCases || []).map(({ input, output }) => ({ input, output })));
    });
    expect(countTestCases(backCells)).toBe(8);
  });

  it('leaves out database ids and run output, which belong to the class it came from', () => {
    const file = buildNotebookFile(notebook, [{ _id: 'x', type: 'code', source: 'int main(void){}', outputs: [1], testCases: [{ _id: 't', input: '1', output: '2' }] }]);
    expect(JSON.stringify(file)).not.toContain('"_id"');
    expect(file.cells[0]).not.toHaveProperty('outputs');
    expect(file.format).toBe(NOTEBOOK_FILE_FORMAT);
  });

  it('refuses files that are not notebook files, with a message a teacher can act on', () => {
    expect(() => parseNotebookFile('not json')).toThrow(/damaged/);
    expect(() => parseNotebookFile('{"cells": []}')).toThrow(/not a notebook file/);
    expect(() => parseNotebookFile(JSON.stringify({ format: NOTEBOOK_FILE_FORMAT, version: 99, cells: [] }))).toThrow(/newer version/);
  });

  it('recognises its own files by name or by content', () => {
    expect(isNotebookFile('Week 4.xnb.json', '')).toBe(true);
    expect(isNotebookFile('export.json', JSON.stringify({ format: NOTEBOOK_FILE_FORMAT }))).toBe(true);
    expect(isNotebookFile('data.json', '{"a":1}')).toBe(false);
    expect(isNotebookFile('lab.ipynb', '{}')).toBe(false);
  });

  it('makes a file name every OS accepts', () => {
    expect(notebookFileName('Lab 2: Arrays / C?')).toBe('Lab 2 Arrays C.xnb.json');
    expect(notebookFileName('')).toBe('notebook.xnb.json');
  });
});
