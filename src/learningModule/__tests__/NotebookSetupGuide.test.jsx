import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NotebookCell from '../components/NotebookCell';
import { EXAMPLE_CELL, SAMPLE_NOTEBOOK_CELLS } from '../sampleNotebook';

/**
 * The faculty-facing help on coding cells, and the sample notebook the Coding
 * tab hands out. The sample is only useful if it would actually save and pass:
 * the server rejects a C cell without main() (or a hidden one with it), and a
 * tested question with no test cases teaches nothing.
 */

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, editable }) => (
    <textarea data-testid="editor" readOnly={editable === false} value={value} onChange={() => {}} />
  ),
  keymap: { of: () => [] },
}));
vi.mock('@codemirror/lang-python', () => ({ python: () => ['python-mode'] }));
vi.mock('@codemirror/lang-cpp', () => ({ cpp: () => ['cpp-mode'] }));
vi.mock('@codemirror/state', () => ({ Prec: { highest: (k) => k } }));

const noop = () => {};
const props = { index: 0, total: 1, onRun: noop, onStop: noop, onMove: noop, onDelete: noop };
const codeCell = (overrides = {}) => ({
  _id: 'c1',
  type: 'code',
  source: '',
  stdin: '',
  locked: false,
  hidden: false,
  testCases: [],
  outputs: [],
  runCount: 0,
  ...overrides,
});

describe('learningModule coding cell setup guide', () => {
  it('opens on an empty cell in the editor', () => {
    render(<NotebookCell {...props} isEditor onChange={noop} cell={codeCell()} />);
    expect(screen.getByText('How to set up this exercise')).toBeInTheDocument();
  });

  it('stays closed on a cell that already has code, until asked', async () => {
    const user = userEvent.setup();
    render(<NotebookCell {...props} isEditor onChange={noop} cell={codeCell({ source: 'print(1)' })} />);
    expect(screen.queryByText('How to set up this exercise')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /setup guide/i }));
    expect(screen.getByText('How to set up this exercise')).toBeInTheDocument();
  });

  it('is never shown to students', () => {
    render(<NotebookCell {...props} onChange={noop} cell={codeCell()} />);
    expect(screen.queryByRole('button', { name: /setup guide/i })).not.toBeInTheDocument();
    expect(screen.queryByText('How to set up this exercise')).not.toBeInTheDocument();
  });

  it('fills an empty cell with starter code, sample input and test cases', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NotebookCell {...props} isEditor language="c" onChange={onChange} cell={codeCell()} />);
    await user.click(screen.getByRole('button', { name: /insert example/i }));
    expect(onChange).toHaveBeenCalledWith({
      source: EXAMPLE_CELL.c.source,
      stdin: EXAMPLE_CELL.c.stdin,
      testCases: EXAMPLE_CELL.c.testCases,
    });
  });

  it('explains a hidden setup cell instead of offering the guide', () => {
    render(<NotebookCell {...props} isEditor language="c" onChange={noop} cell={codeCell({ hidden: true })} />);
    expect(screen.getByText(/Hidden setup:/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /setup guide/i })).not.toBeInTheDocument();
  });
});

describe('learningModule sample notebook', () => {
  const HAS_MAIN = /\bmain\s*\(/;

  it.each(['python', 'c'])('%s sample has hidden setup, a locked example and tested questions', (language) => {
    const cells = SAMPLE_NOTEBOOK_CELLS[language];
    expect(cells.filter((cell) => cell.hidden)).toHaveLength(1);
    expect(cells.some((cell) => cell.locked)).toBe(true);
    const tested = cells.filter((cell) => cell.testCases?.length);
    expect(tested).toHaveLength(2);
    tested.forEach((cell) => expect(cell.stdin).toBeTruthy());
  });

  it('keeps main() out of the C hidden setup and in every visible C code cell', () => {
    SAMPLE_NOTEBOOK_CELLS.c
      .filter((cell) => cell.type === 'code')
      .forEach((cell) => expect(HAS_MAIN.test(cell.source)).toBe(!cell.hidden));
  });
});
