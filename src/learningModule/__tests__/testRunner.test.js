import { describe, expect, it, vi } from 'vitest';
import { normalizeOutput, evaluateOutputMatch, runCellTestCases } from '../utils/testRunner';

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
