import { describe, expect, it } from 'vitest';
import { buildNotebookFile, parseNotebookFile } from '../notebookTransfer';

/**
 * The sample flag has to survive every path a test case takes.
 *
 * It was added to the schema, the editor and the server in one change, and
 * missed in three places that each copy a test case field by field: the
 * editor's save payload, the file writer, and the file reader. Every one of
 * them would have lost it silently — the tick would stay on screen until the
 * next reload and then be gone, which is worse than never having had it.
 */

const NOTEBOOK = {
  title: 'Mean of a List',
  description: '',
  language: 'python',
  packages: [],
  settings: {},
};

const CELLS = [
  {
    type: 'code',
    source: 'print(sum(xs) / len(xs))',
    stdin: '',
    locked: false,
    hidden: false,
    testCases: [
      { input: '1 2 3 4', output: '2.5', isSample: true },
      { input: '10 20 30', output: '20.0', isSample: false },
    ],
    order: 0,
  },
];

/** What the download button would write, as text. */
const asFile = (notebook = NOTEBOOK, cells = CELLS) =>
  JSON.stringify(buildNotebookFile(notebook, cells), null, 2);

describe('downloading and re-importing a notebook', () => {
  it('writes the sample flag into the file', () => {
    const [sample, hidden] = buildNotebookFile(NOTEBOOK, CELLS).cells[0].testCases;
    expect(sample.isSample).toBe(true);
    expect(hidden.isSample).toBe(false);
  });

  it('reads it back, so the worked example survives the round trip', () => {
    const { cells } = parseNotebookFile(asFile());
    expect(cells[0].testCases.map((tc) => tc.isSample)).toEqual([true, false]);
  });

  it('keeps the inputs and outputs alongside it', () => {
    const { cells } = parseNotebookFile(asFile());
    expect(cells[0].testCases[0]).toMatchObject({
      input: '1 2 3 4',
      output: '2.5',
      isSample: true,
    });
  });

  it('defaults to hidden for a file written before samples existed', () => {
    // An older export carries no flag at all. Publishing its answers on import
    // would be the worst possible failure, so the default has to be false.
    const older = buildNotebookFile(NOTEBOOK, CELLS);
    older.cells[0].testCases.forEach((tc) => { delete tc.isSample; });
    const { cells } = parseNotebookFile(JSON.stringify(older));
    expect(cells[0].testCases.every((tc) => tc.isSample === false)).toBe(true);
  });

  it('carries the notebook’s settings through as well', () => {
    // Same class of bug, one level up: the settings are copied field by field.
    const withSettings = { ...NOTEBOOK, settings: { requireFullscreen: true, blockPaste: true } };
    const { notebook } = parseNotebookFile(asFile(withSettings));
    expect(notebook.settings).toMatchObject({ requireFullscreen: true, blockPaste: true });
  });
});

describe('the built-in sample notebook', () => {
  // The notebook a teacher opens to learn how to set up a tested exercise. It
  // has to *demonstrate* a sample case, not describe one — a template whose
  // every case is hidden teaches the opposite of the lesson.
  it('marks a worked example in every tested cell', async () => {
    const { SAMPLE_NOTEBOOK_CELLS } = await import('../sampleNotebook');
    ['python', 'c'].forEach((language) => {
      const tested = SAMPLE_NOTEBOOK_CELLS[language].filter(
        (cell) => (cell.testCases || []).length > 0,
      );
      expect(tested.length).toBeGreaterThan(0);
      tested.forEach((cell) => {
        expect(
          cell.testCases.some((tc) => tc.isSample),
          `${language}: a cell with tests and no sample`,
        ).toBe(true);
      });
    });
  });

  it('keeps the rest hidden', async () => {
    const { SAMPLE_NOTEBOOK_CELLS } = await import('../sampleNotebook');
    const all = SAMPLE_NOTEBOOK_CELLS.python.flatMap((cell) => cell.testCases || []);
    expect(all.filter((tc) => tc.isSample).length).toBeLessThan(all.length);
  });

  it('samples the worked example cell too, in both languages', async () => {
    const { EXAMPLE_CELL } = await import('../sampleNotebook');
    ['python', 'c'].forEach((language) => {
      expect(EXAMPLE_CELL[language].testCases.some((tc) => tc.isSample)).toBe(true);
    });
  });
});
