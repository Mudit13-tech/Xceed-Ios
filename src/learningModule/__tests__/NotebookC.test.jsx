import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NotebookCell from '../components/NotebookCell';
import useNotebookKernel from '../hooks/useNotebookKernel';

/**
 * The C side of coding notebooks.
 *
 * Two things here are not obvious from the component and are worth pinning.
 *
 * The **stdin box** is the only way a C program gets input — `scanf` cannot
 * prompt, because blocking a worker on input needs SharedArrayBuffer and the
 * cross-origin isolation headers this app does not send. So it has to be
 * present and usable for C, and it has to stay usable on a *locked* cell:
 * feeding a fixed program different numbers is usually the whole exercise, and
 * the server agrees — `applyStudentCells` takes stdin regardless of the lock.
 *
 * The **kernel picker** has to hand back the right one per language while
 * calling both hooks unconditionally, which is what the rules of hooks demand.
 */

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, editable }) => (
    <textarea data-testid="editor" readOnly={editable === false} value={value} onChange={() => {}} />
  ),
}));
vi.mock('@codemirror/lang-python', () => ({ python: () => ['python-mode'] }));
vi.mock('@codemirror/lang-cpp', () => ({ cpp: () => ['cpp-mode'] }));

// The real hooks would spawn workers and fetch a 50MB toolchain; the picker is
// what is under test, not either kernel.
vi.mock('../hooks/usePyodide', () => ({
  default: () => ({ status: 'idle', detail: '', busyCellId: null, kernel: 'python' }),
}));
vi.mock('../hooks/useCKernel', () => ({
  default: () => ({ status: 'idle', detail: '', busyCellId: null, kernel: 'c' }),
}));

const codeCell = (overrides = {}) => ({
  _id: 'c1',
  type: 'code',
  source: 'int main(void) { return 0; }',
  stdin: '',
  locked: false,
  outputs: [],
  runCount: 0,
  ...overrides,
});

const noop = () => {};
const props = {
  index: 0,
  total: 2,
  onChange: noop,
  onRun: noop,
  onStop: noop,
  onMove: noop,
  onDelete: noop,
};

describe('learningModule <NotebookCell /> in C', () => {
  it('shows the stdin box without being asked, because C reads input by default', () => {
    render(<NotebookCell {...props} language="c" cell={codeCell()} />);
    expect(screen.getByText('Input (stdin)')).toBeInTheDocument();
  });

  it('keeps the stdin box closed for Python, where input() is the exception', () => {
    render(<NotebookCell {...props} language="python" cell={codeCell({ source: 'print(1)' })} />);
    expect(screen.queryByText('Input (stdin)')).not.toBeInTheDocument();
  });

  it('opens the box for a Python cell that already has input saved', () => {
    // Hiding a value the student typed would read as having lost it.
    render(<NotebookCell {...props} language="python" cell={codeCell({ stdin: '42' })} />);
    expect(screen.getByText('Input (stdin)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
  });

  it('can be opened by hand on a Python cell', async () => {
    const user = userEvent.setup();
    render(<NotebookCell {...props} language="python" cell={codeCell({ source: 'print(1)' })} />);
    await user.click(screen.getByRole('button', { name: /input/i }));
    expect(screen.getByText('Input (stdin)')).toBeInTheDocument();
  });

  it('reports stdin edits through the same onChange the source uses', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NotebookCell {...props} onChange={onChange} language="c" cell={codeCell()} />);

    await user.type(screen.getByPlaceholderText(/as if at a terminal/i), '7');

    expect(onChange).toHaveBeenCalledWith({ stdin: '7' });
  });

  it('leaves stdin editable on a locked cell, whose source it still freezes', () => {
    render(<NotebookCell {...props} language="c" cell={codeCell({ locked: true })} />);

    // The editor is read-only...
    expect(screen.getByTestId('editor')).toHaveAttribute('readonly');
    // ...but the input the program reads is not.
    expect(screen.getByPlaceholderText(/as if at a terminal/i)).not.toBeDisabled();
  });

  it('disables stdin once the work is submitted', () => {
    render(<NotebookCell {...props} language="c" readOnly cell={codeCell()} />);
    expect(screen.getByPlaceholderText(/as if at a terminal/i)).toBeDisabled();
  });
});

describe('learningModule useNotebookKernel', () => {
  it('hands back the C kernel for a C notebook', () => {
    const { result } = renderHook(() => useNotebookKernel('c'));
    expect(result.current.kernel).toBe('c');
    expect(result.current.label).toBe('C');
    expect(result.current.language).toBe('c');
  });

  it('hands back the Python kernel for a Python notebook', () => {
    const { result } = renderHook(() => useNotebookKernel('python'));
    expect(result.current.kernel).toBe('python');
    expect(result.current.label).toBe('Python');
  });

  it('falls back to Python for a notebook stored before the field existed', () => {
    // `language` is absent on every notebook authored before C, and undefined
    // must not select a kernel that cannot run their cells.
    const { result } = renderHook(() => useNotebookKernel(undefined));
    expect(result.current.kernel).toBe('python');
    expect(result.current.label).toBe('Python');
  });
});
