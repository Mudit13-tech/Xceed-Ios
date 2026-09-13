import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { toDateTimeInput } from '../format';
import lmApi from '../api/lmApi';

vi.mock('../api/lmApi');

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ classId: 'c1', assignmentId: 'a1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Circuits' }, isTeacher: true }),
  };
});

// Quill needs a real selection API; the editor's own rich-text behaviour is not
// what is under test here, only what AssignmentEditor does with the date field.
vi.mock('../components/RichTextEditor', async () => {
  const React = await vi.importActual('react');
  return {
    default: React.forwardRef(function RichTextEditorMock({ value, onChange, placeholder }, ref) {
      return (
        <textarea
          data-testid="rich-text"
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange && onChange(e.target.value)}
        />
      );
    }),
  };
});

describe('Due Date Timezone & Formatting (Issue #2131)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Each answer row debounce-checks its formula 350ms after mount; give it
    // a well-shaped result so that timer firing mid-test doesn't crash on
    // `undefined.error` when the mount outlives the assertions.
    lmApi.validateAssignmentFormula.mockResolvedValue({ ok: true, error: null });
  });

  describe('toDateTimeInput helper', () => {
    it('formats a UTC ISO string to local wall-clock YYYY-MM-DDTHH:mm', () => {
      const now = new Date();
      const iso = now.toISOString();
      const result = toDateTimeInput(iso);

      const pad = (n) => String(n).padStart(2, '0');
      const expected = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

      expect(result).toBe(expected);
    });

    it('returns empty string for null, undefined, or invalid dates', () => {
      expect(toDateTimeInput(null)).toBe('');
      expect(toDateTimeInput(undefined)).toBe('');
      expect(toDateTimeInput('')).toBe('');
      expect(toDateTimeInput('invalid-date')).toBe('');
    });
  });

  describe('AssignmentEditor Due Date Input', () => {
    const mockAssignment = {
      _id: 'a1',
      title: 'Circuit Analysis Assignment',
      description: 'Solve the equations',
      topicId: null,
      questions: [
        {
          _id: 'q1',
          prompt: 'Find voltage across R1 with current {{I}}',
          variables: [{ name: 'I', type: 'range', min: 1, max: 10, step: 1, decimals: 0, values: [], unit: 'A' }],
          answers: [{ key: 'v', label: 'Voltage', formula: 'I*10', unit: 'V', marks: 5, tolerancePercent: 1 }],
          parts: [],
          constraint: '',
          hint: '',
          solutionSteps: '',
          difficulty: 'medium',
          topic: '',
        },
      ],
      settings: {
        passPercent: 50,
        // Preset ISO date
        dueDate: '2026-09-15T10:00:00.000Z',
        showSolutionAfterSubmit: false,
        showHints: true,
        instantFeedback: false,
        checksPerAnswer: 3,
        allowFileUpload: false,
      },
    };

    it('populates input with local wall-clock time without timezone loss', async () => {
      lmApi.getAssignment.mockResolvedValue(mockAssignment);
      lmApi.listTopics.mockResolvedValue([]);
      lmApi.assignmentFormulaReference.mockResolvedValue(null);

      // Dynamic import keeps the expensive AssignmentEditor transform outside
      // the per-test timeout budget when 36+ files load in parallel in CI.
      const { default: AssignmentEditor } = await import('../pages/AssignmentEditor');
      render(
        <ChakraProvider>
          <MemoryRouter initialEntries={['/learning/class/c1/assignment/a1/edit']}>
            <AssignmentEditor />
          </MemoryRouter>
        </ChakraProvider>,
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockAssignment.title)).toBeTruthy();
      });

      const dateInput = screen.getByDisplayValue(toDateTimeInput(mockAssignment.settings.dueDate));
      expect(dateInput).toBeTruthy();
    });

    it('converts newly selected local date into ISO format on change and save', async () => {
      lmApi.getAssignment.mockResolvedValue(mockAssignment);
      lmApi.listTopics.mockResolvedValue([]);
      lmApi.assignmentFormulaReference.mockResolvedValue(null);
      lmApi.updateAssignment.mockResolvedValue({ ...mockAssignment });

      const { default: AssignmentEditor } = await import('../pages/AssignmentEditor');
      render(
        <ChakraProvider>
          <MemoryRouter initialEntries={['/learning/class/c1/assignment/a1/edit']}>
            <AssignmentEditor />
          </MemoryRouter>
        </ChakraProvider>,
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockAssignment.title)).toBeTruthy();
      });

      const dateInput = screen.getByDisplayValue(toDateTimeInput(mockAssignment.settings.dueDate));

      // Simulate teacher changing due date to local 2026-10-01 15:30
      fireEvent.change(dateInput, { target: { value: '2026-10-01T15:30' } });

      // Two now: the header's, and the one at the bottom of each question. The
      // header's is the one this test is about, and it comes first in the DOM.
      const [saveButton] = screen.getAllByRole('button', { name: /^save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(lmApi.updateAssignment).toHaveBeenCalled();
        const callArgs = lmApi.updateAssignment.mock.calls[0];
        const payload = callArgs[2];
        expect(payload.settings.dueDate).toBe(new Date('2026-10-01T15:30').toISOString());
      });
    });
  });
});
