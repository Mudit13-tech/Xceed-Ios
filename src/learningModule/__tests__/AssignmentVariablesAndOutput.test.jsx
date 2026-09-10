import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/renderWithProviders';
import { decimalPlacesHint, formatAnswerValue } from '../format';

/**
 * Two authoring complaints about parameterised assignments, and their fixes.
 *
 * 1. A variable could only exist by filling in a row under "Variables" first —
 *    typing `{{R}}` into the prompt declared nothing, so the placeholder bar
 *    stayed empty, the answer formula reported "undeclared variable R", and
 *    the student's paper showed a literal `{{R}}`. Typing now declares.
 *
 * 2. Every computed answer was rendered as `Math.round(v * 1e6) / 1e6` — a
 *    silent six-decimal rounding nobody asked for, which printed a 1.6e-19 C
 *    charge as "0" and overflowed past ~9e15 to "Infinity". Rounding is now
 *    the teacher's to set, per answer, and the student is told what it is.
 */

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ classId: 'c1', assignmentId: 'a1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Circuits' } }),
  };
});

// Quill needs a real selection API; the editor's own behaviour is not what is
// under test here, only what AssignmentEditor does with the text it emits.
// The factory is hoisted above the imports, so React comes from inside it.
vi.mock('../components/RichTextEditor', async () => {
  const React = await vi.importActual('react');
  return {
  default: React.forwardRef(function RichTextEditorMock({ value, onChange, placeholder, variables }, ref) {
    // Mirrors the real editor: insertAtCursor appends, returns the new HTML,
    // *and* fires onChange the way Quill does. That second update is what used
    // to clobber a table added in the same tick, so the mock has to do it.
    React.useImperativeHandle(ref, () => ({
      insertAtCursor: (text) => {
        const next = `${value || ''}${text}`;
        onChange(next);
        return next;
      },
    }));
    return (
      <div>
        <textarea
          aria-label={placeholder || 'rich text'}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
        />
        {variables && <div data-testid="insert-bar">{variables.join(',')}</div>}
      </div>
    );
  }),
  };
});

const getAssignment = vi.fn();
const previewAssignment = vi.fn();
const updateAssignment = vi.fn().mockResolvedValue({});
vi.mock('../api/lmApi', () => ({
  default: {
    getAssignment: (...a) => getAssignment(...a),
    previewAssignment: (...a) => previewAssignment(...a),
    assignmentFormulaReference: vi.fn().mockRejectedValue(new Error('no reference')),
    validateAssignmentFormula: vi.fn().mockResolvedValue({ ok: true, error: null }),
    updateAssignment: (...a) => updateAssignment(...a),
    publishAssignment: vi.fn(),
  },
}));

// A backend that remembers: updateAssignment stores the payload and getAssignment
// serves it back, which is what the editor's save-then-reload cycle needs.
const withPersistence = (base) => {
  let stored = base;
  getAssignment.mockImplementation(async () => JSON.parse(JSON.stringify(stored)));
  updateAssignment.mockImplementation(async (classId, assignmentId, body) => {
    stored = { ...stored, ...body };
    return stored;
  });
};

const assignmentWith = (question) => ({
  _id: 'a1',
  title: 'Ohm practice',
  description: '',
  topicId: null,
  published: false,
  totalMarks: 1,
  settings: { dueDate: null, passPercent: null, checksPerAnswer: 3 },
  questions: [
    {
      _id: 'q1',
      prompt: '',
      variables: [],
      answers: [{ key: 'a1', label: 'Answer', formula: 'x', unit: '', tolerancePercent: 1, toleranceAbs: 0, marks: 1 }],
      parts: [],
      constraint: '',
      hint: '',
      solutionSteps: '',
      difficulty: 'medium',
      ...question,
    },
  ],
});

const promptBox = () => screen.getByLabelText(/A resistor of/i);

// Not userEvent.type: it reads `{{` as its own escape for a literal `{`, so a
// typed placeholder would never reach the component as `{{R}}`.
const typePrompt = (text) => fireEvent.change(promptBox(), { target: { value: text } });

describe('typing a placeholder declares the variable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a variable row for a {{name}} typed into the prompt', async () => {
    getAssignment.mockResolvedValue(assignmentWith({}));
    const { default: AssignmentEditor } = await import('../pages/AssignmentEditor');
    renderWithProviders(<AssignmentEditor />);

    await waitFor(() => expect(promptBox()).toBeInTheDocument());
    expect(screen.getAllByTestId('insert-bar')[0]).toHaveTextContent('');

    typePrompt('A {{R}} ohm resistor');

    await waitFor(() => expect(screen.getAllByTestId('insert-bar')[0]).toHaveTextContent('R'));
    expect(screen.getByDisplayValue('R')).toBeInTheDocument();
  });

  it('leaves a variable the teacher deleted deleted, even with the placeholder still there', async () => {
    getAssignment.mockResolvedValue(assignmentWith({}));
    const { default: AssignmentEditor } = await import('../pages/AssignmentEditor');
    renderWithProviders(<AssignmentEditor />);

    await waitFor(() => expect(promptBox()).toBeInTheDocument());
    typePrompt('{{R}}');
    await waitFor(() => expect(screen.getByDisplayValue('R')).toBeInTheDocument());

    // The ✕ on the variable row.
    await userEvent.click(screen.getAllByRole('button', { name: '✕' })[0]);
    expect(screen.queryByDisplayValue('R')).not.toBeInTheDocument();

    // Editing the prompt again must not resurrect it.
    typePrompt('{{R}} ohms');
    expect(screen.queryByDisplayValue('R')).not.toBeInTheDocument();
  });

  it('does not edit a question just because it was opened', async () => {
    // A saved question whose placeholder was never declared: it is reported,
    // with a button, rather than silently rewritten (which would leave the
    // teacher with unsaved changes they did not make).
    getAssignment.mockResolvedValue(assignmentWith({ prompt: 'A {{R}} ohm resistor', variables: [] }));
    const { default: AssignmentEditor } = await import('../pages/AssignmentEditor');
    renderWithProviders(<AssignmentEditor />);

    await waitFor(() => expect(promptBox()).toBeInTheDocument());
    expect(screen.queryByDisplayValue('R')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /declare it/i }));
    expect(screen.getByDisplayValue('R')).toBeInTheDocument();
  });

  it('fills a blank row rather than leaving it behind', async () => {
    getAssignment.mockResolvedValue(assignmentWith({}));
    const { default: AssignmentEditor } = await import('../pages/AssignmentEditor');
    renderWithProviders(<AssignmentEditor />);

    await waitFor(() => expect(promptBox()).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /\+ Add variable/i }));
    typePrompt('{{R}}');

    await waitFor(() => expect(screen.getByDisplayValue('R')).toBeInTheDocument());
    expect(screen.getAllByPlaceholderText('R')).toHaveLength(1);
  });
});

describe('the table builder', () => {
  it('drops a token at the cursor and keeps the table on the question', async () => {
    // Quill 1.3.7 has no table blot and flattens any <table> in its input, so
    // the table is stored on the question and referenced from the text.
    withPersistence(
      assignmentWith({ prompt: 'Given: ', variables: [{ name: 'R', type: 'integer', min: 1, max: 9, step: 1 }] }),
    );
    const { default: AssignmentEditor } = await import('../pages/AssignmentEditor');
    renderWithProviders(<AssignmentEditor />);

    await waitFor(() => expect(promptBox()).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /insert table/i }));

    // The declared variables are offered inside the modal, not just on the prompt.
    const chip = await screen.findByRole('button', { name: '{{R}}' });
    await userEvent.type(screen.getByLabelText('Row 1 column 1'), 'Resistance');
    await userEvent.click(screen.getByLabelText('Row 1 column 2'));
    await userEvent.click(chip);

    await userEvent.click(screen.getByRole('button', { name: /insert at cursor/i }));

    // Saving reloads the assignment, so the fake backend has to hand back what it
    // was given — otherwise the reload would wipe the table and hide the very
    // bug this test is about.
    await waitFor(() => expect(updateAssignment).toHaveBeenCalled());

    // The token is placed, and the table survives the onChange the insertion
    // itself triggers — it used to be wiped by that second update, which left
    // no table to see, edit or save.
    const tokens = await screen.findAllByText(/\{\{table:t/);
    expect(tokens.length).toBeGreaterThan(0);
    expect(promptBox().value).toMatch(/\{\{table:t/);

    // Rendered as a table in the editor, not just named in a list.
    expect(screen.getByText('Resistance')).toBeInTheDocument();

    // And it is saved on the spot, so it can be retrieved.
    await waitFor(() => expect(updateAssignment).toHaveBeenCalled());
    const saved = updateAssignment.mock.calls.at(-1)[2];
    expect(saved.questions[0].tables).toHaveLength(1);
    expect(saved.questions[0].tables[0].rows[0]).toEqual(['Resistance', '{{R}}']);
    expect(saved.questions[0].prompt).toContain(`{{table:${saved.questions[0].tables[0].key}}}`);

    await userEvent.click(screen.getByRole('button', { name: /edit table/i }));
    expect(await screen.findByDisplayValue('{{R}}')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Resistance')).toBeInTheDocument();
  });
});

describe('the per-question preview', () => {
  it('shows this question only, with its sub-questions and their answers', async () => {
    getAssignment.mockResolvedValue(
      assignmentWith({
        prompt: 'A {{R}} ohm resistor',
        variables: [{ name: 'R', type: 'integer', min: 1, max: 9, step: 1 }],
        parts: [{ label: '(a)', prompt: 'Find the current', answers: [] }],
      }),
    );
    previewAssignment.mockResolvedValue({
      warnings: [],
      samples: [
        {
          label: 'Student 1',
          questions: [
            {
              prompt: 'A 7 ohm resistor',
              values: { R: 7 },
              parts: [{ label: '(a)', prompt: 'Find the current' }],
              expected: [
                { key: 'a1', label: 'Answer', value: 3.14159, decimals: 2, unit: 'A', partIndex: null },
                { key: 'a2', label: 'Current', value: 0.5, decimals: 1, unit: 'A', partIndex: 0 },
              ],
            },
          ],
        },
      ],
    });

    const { default: AssignmentEditor } = await import('../pages/AssignmentEditor');
    renderWithProviders(<AssignmentEditor />);

    await waitFor(() => expect(screen.getByRole('button', { name: /roll samples/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /roll samples/i }));

    // The stem's own answer, at the precision the teacher set.
    expect(await screen.findByText(/Answer: 3.14 A/)).toBeInTheDocument();
    // And the sub-question, with the answer that belongs to it. The prompt also
    // appears in the part's own editor above, hence getAllByText.
    expect(screen.getAllByText('Find the current').length).toBeGreaterThan(1);
    expect(screen.getByText(/Current: 0.5 A/)).toBeInTheDocument();
  });
});

describe('adding a question', () => {
  it('opens the question that was just added', async () => {
    getAssignment.mockResolvedValue(assignmentWith({ prompt: 'first' }));
    const { default: AssignmentEditor } = await import('../pages/AssignmentEditor');
    renderWithProviders(<AssignmentEditor />);

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Question 1' })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Question 1' })).toHaveAttribute('aria-selected', 'true');

    // The type is chosen first, from the menu the button opens.
    await userEvent.click(screen.getByRole('button', { name: /\+ Add question/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /random variables/i }));

    const added = await screen.findByRole('tab', { name: 'Question 2' });
    await waitFor(() => expect(added).toHaveAttribute('aria-selected', 'true'));
    // And the panel showing is the new one: a blank prompt, not "first".
    expect(screen.getByRole('heading', { name: 'Question 2' })).toBeInTheDocument();
  });
});

describe('formatAnswerValue', () => {
  it('rounds to the decimal places the teacher asked for, and only those', () => {
    expect(formatAnswerValue(29.9712, 2)).toBe('29.97');
    expect(formatAnswerValue(2.5, 2)).toBe('2.50');
    expect(formatAnswerValue(29.97, 0)).toBe('30');
  });

  it('leaves the value unrounded when the teacher set no precision', () => {
    expect(formatAnswerValue(29.9712)).toBe('29.9712');
    expect(formatAnswerValue(1 / 3)).toBe('0.3333333333333333');
  });

  it('keeps a very small or very large answer intact', () => {
    expect(formatAnswerValue(1.6e-19)).toBe('1.6e-19');
    expect(formatAnswerValue(2.5e300)).toBe('2.5e+300');
  });

  it('shows a dash where there is no value to show', () => {
    expect(formatAnswerValue(null)).toBe('—');
    expect(formatAnswerValue(undefined)).toBe('—');
    expect(formatAnswerValue(NaN)).toBe('—');
    expect(formatAnswerValue(Infinity)).toBe('—');
  });
});

describe('decimalPlacesHint', () => {
  it('states the precision in words for the student', () => {
    expect(decimalPlacesHint(2)).toBe('to 2 decimal places');
    expect(decimalPlacesHint(1)).toBe('to 1 decimal place');
    expect(decimalPlacesHint(0)).toBe('to the nearest whole number');
  });

  it('says nothing when the teacher set no precision', () => {
    expect(decimalPlacesHint(null)).toBe('');
    expect(decimalPlacesHint(undefined)).toBe('');
    expect(decimalPlacesHint('')).toBe('');
  });
});
