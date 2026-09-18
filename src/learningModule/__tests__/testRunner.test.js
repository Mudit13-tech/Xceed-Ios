import { describe, expect, it, vi } from 'vitest';
import {
  cellOutputText,
  evaluateOutputMatch,
  misspelledPythonBooleans,
  normalizeOutput,
  runCellTestCases,
} from '../utils/testRunner';

describe('testRunner utility', () => {
  describe('normalizeOutput', () => {
    it('normalizes CRLF to LF and trims outer whitespace', () => {
      expect(normalizeOutput('Hello World\r\n')).toBe('Hello World');
      expect(normalizeOutput('\r\n  Result: 42 \r\n')).toBe('Result: 42');
    });

    it('trims trailing spaces on individual lines', () => {
      const input = 'line 1   \r\nline 2    ';
      expect(normalizeOutput(input)).toBe('line 1\nline 2');
    });

    it('handles null and undefined gracefully', () => {
      expect(normalizeOutput(null)).toBe('');
      expect(normalizeOutput(undefined)).toBe('');
    });
  });

  describe('evaluateOutputMatch', () => {
    it('returns true for matching output despite whitespace discrepancies', () => {
      expect(evaluateOutputMatch('30\r\n', '30')).toBe(true);
      expect(evaluateOutputMatch('hello world\n', '  hello world  ')).toBe(true);
    });

    it('returns false for non-matching output', () => {
      expect(evaluateOutputMatch('30', '40')).toBe(false);
      expect(evaluateOutputMatch('Hello', 'hello')).toBe(false);
    });
  });

  describe('cellOutputText', () => {
    it('puts the last value on its own line after printed output', () => {
      expect(cellOutputText('a\n', '1')).toBe('a\n1');
      expect(cellOutputText('a', '1')).toBe('a\n1');
      expect(cellOutputText('', "'True'")).toBe("'True'");
      expect(cellOutputText('a\n', null)).toBe('a\n');
    });
  });

  describe('misspelledPythonBooleans', () => {
    it('flags booleans spelled the C / JavaScript way', () => {
      expect(misspelledPythonBooleans('true')).toEqual(['true']);
      expect(misspelledPythonBooleans('Result: FALSE\ntrue, true')).toEqual(['FALSE', 'true']);
    });

    it('leaves Python spellings and other words alone', () => {
      expect(misspelledPythonBooleans('True\nFalse')).toEqual([]);
      expect(misspelledPythonBooleans('untrue statement')).toEqual([]);
      expect(misspelledPythonBooleans('')).toEqual([]);
    });
  });

  describe('runCellTestCases', () => {
    it('returns empty summary when no test cases are given', async () => {
      const result = await runCellTestCases({
        cell: { source: 'print(1)' },
        testCases: [],
        runCell: vi.fn(),
      });
      expect(result.testResults).toEqual([]);
      expect(result.testSummary).toEqual({
        total: 0,
        passed: 0,
        failed: 0,
        passedAll: false,
      });
    });

    it('runs each test case and marks pass/fail correctly', async () => {
      const mockRunCell = vi.fn()
        .mockImplementationOnce(async (id, src, onOutput, opts) => {
          onOutput({ type: 'stdout', text: '30\n' });
          return { result: null, error: null };
        })
        .mockImplementationOnce(async (id, src, onOutput, opts) => {
          onOutput({ type: 'stdout', text: '12\n' });
          return { result: null, error: null };
        });

      const cell = { key: 'c1', source: 'a, b = map(int, input().split()); print(a + b)' };
      const testCases = [
        { _id: 'tc1', input: '10 20', output: '30' },
        { _id: 'tc2', input: '5 5', output: '10' },
      ];

      const { testResults, testSummary } = await runCellTestCases({
        cell,
        testCases,
        runCell: mockRunCell,
      });

      expect(mockRunCell).toHaveBeenCalledTimes(2);
      expect(testResults).toHaveLength(2);
      expect(testResults[0].passed).toBe(true);
      expect(testResults[1].passed).toBe(false); // 12 != 10
      expect(testSummary).toEqual({
        total: 2,
        passed: 1,
        failed: 1,
        passedAll: false,
      });
    });

    /** A kernel that emits the given stdout chunks and then a last-expression value. */
    const kernel = (chunks, result = null) =>
      vi.fn(async (_id, _src, onOutput) => {
        chunks.forEach((text) => onOutput({ type: 'stdout', text }));
        return { result, error: null };
      });

    it('joins stdout chunks without inventing line breaks at flush boundaries', async () => {
      // A pause mid-program splits the output into two batches.
      const { testResults } = await runCellTestCases({
        cell: { key: 'c', source: 'print("a"); slow(); print("b")' },
        testCases: [{ input: '', output: 'a\nb' }],
        runCell: kernel(['a\n', 'b\n']),
      });
      expect(testResults[0].passed).toBe(true);
      expect(testResults[0].actualOutput).toBe('a\nb');
    });

    it('keeps a line written in two pieces on one line (C printf)', async () => {
      const { testResults } = await runCellTestCases({
        cell: { key: 'c', source: 'printf("Sum: "); printf("%d\\n", 7);' },
        testCases: [{ input: '', output: 'Sum: 7' }],
        runCell: kernel(['Sum: ', '7\n']),
        isC: true,
      });
      expect(testResults[0].passed).toBe(true);
    });

    it('judges a bare last expression by its repr, as the cell shows it', async () => {
      const cases = [{ input: '', output: 'True' }];
      const boolean = await runCellTestCases({
        cell: { key: 'c', source: 'is_even(4)' }, testCases: cases, runCell: kernel([], 'True'),
      });
      const string = await runCellTestCases({
        cell: { key: 'c', source: 'is_even(4)' }, testCases: cases, runCell: kernel([], "'True'"),
      });
      expect(boolean.testResults[0].passed).toBe(true);
      // Returned the string "True": the cell shows 'True' with quotes, and so is the verdict.
      expect(string.testResults[0].passed).toBe(false);
      expect(string.testResults[0].actualOutput).toBe("'True'");
    });

    it('includes the last expression after printed output rather than dropping it', async () => {
      const { testResults } = await runCellTestCases({
        cell: { key: 'c', source: 'print("total"); total' },
        testCases: [{ input: '', output: 'total\n2.0' }],
        runCell: kernel(['total\n'], '2.0'),
      });
      expect(testResults[0].passed).toBe(true);
    });

    it('does not treat a C exit status as program output', async () => {
      const { testResults } = await runCellTestCases({
        cell: { key: 'c', source: 'int main(){ puts("7"); return 1; }' },
        testCases: [{ input: '', output: '7' }],
        runCell: kernel(['7\n'], '[exited with status 1]'),
        isC: true,
      });
      expect(testResults[0].passed).toBe(true);
    });

    it('catches runtime errors in cells and marks test as failed', async () => {
      const mockRunCell = vi.fn().mockResolvedValue({
        result: null,
        error: 'ZeroDivisionError: division by zero',
      });

      const cell = { key: 'c2', source: 'print(1/0)' };
      const testCases = [{ _id: 'tc1', input: '', output: '1' }];

      const { testResults, testSummary } = await runCellTestCases({
        cell,
        testCases,
        runCell: mockRunCell,
      });

      expect(testResults[0].passed).toBe(false);
      expect(testResults[0].error).toContain('ZeroDivisionError');
      expect(testSummary.passedAll).toBe(false);
    });
  });
});
