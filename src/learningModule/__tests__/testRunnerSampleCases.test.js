import { describe, expect, it, vi } from 'vitest';
import { evaluateAgainstCase, hashOutput, runCellTestCases } from '../utils/testRunner';

/**
 * The browser half of hidden test cases.
 *
 * The server stopped sending expected outputs for anything not marked as a
 * sample, so the browser can no longer compare text — it hashes what the
 * program printed and compares digests. These check that it still reaches the
 * same verdict, and that the page genuinely has nothing worth reading in it.
 */

/** A kernel that prints whatever it is told, so the runner can be driven. */
const kernelPrinting = (text) =>
  vi.fn(async (_id, _source, onOutput) => {
    onOutput({ type: 'stdout', text });
    return { result: null, error: null };
  });

describe('matching against a digest', () => {
  // The same value the server test pins, so a change on either side is caught
  // by whichever suite runs first.
  const HASH_OF_2_5 = 'b8736b999909049671d0ea075a42b308a5fbe2df1854899123fe09eb0ee9de61';

  it('hashes an output the way the server does', async () => {
    await expect(hashOutput('2.5')).resolves.toBe(HASH_OF_2_5);
  });

  it('ignores the trailing newline every print adds', async () => {
    await expect(hashOutput('2.5\n')).resolves.toBe(HASH_OF_2_5);
    await expect(hashOutput('  2.5  ')).resolves.toBe(HASH_OF_2_5);
  });

  it('passes a hidden case the student got right', async () => {
    await expect(evaluateAgainstCase('2.5\n', { outputHash: HASH_OF_2_5 })).resolves.toBe(true);
  });

  it('fails the formatting mistake the sample exists to prevent', async () => {
    await expect(evaluateAgainstCase('2.50', { outputHash: HASH_OF_2_5 })).resolves.toBe(false);
    await expect(evaluateAgainstCase('Mean: 2.5', { outputHash: HASH_OF_2_5 })).resolves.toBe(false);
  });

  it('still compares text for a sample case, which arrives in full', async () => {
    await expect(evaluateAgainstCase('2.5', { output: '2.5', isSample: true })).resolves.toBe(true);
    await expect(evaluateAgainstCase('2.50', { output: '2.5', isSample: true })).resolves.toBe(false);
  });
});

describe('running a cell against both kinds of case', () => {
  const HASH_OF_2_5 = 'b8736b999909049671d0ea075a42b308a5fbe2df1854899123fe09eb0ee9de61';

  it('reaches the same verdict for a hidden case as it would from the text', async () => {
    const { testResults, testSummary } = await runCellTestCases({
      cell: { _id: 'c1', source: 'print(2.5)' },
      testCases: [{ _id: 't1', input: '1 2 3 4', outputHash: HASH_OF_2_5 }],
      runCell: kernelPrinting('2.5'),
    });
    expect(testResults[0].passed).toBe(true);
    expect(testSummary.passedAll).toBe(true);
  });

  it('records nothing a student could read the answer from', async () => {
    const { testResults } = await runCellTestCases({
      cell: { _id: 'c1', source: 'print(9)' },
      testCases: [{ _id: 't1', input: '1 2 3 4', outputHash: HASH_OF_2_5 }],
      runCell: kernelPrinting('9'),
    });
    expect(testResults[0].passed).toBe(false);
    // The expected output was never sent, so it cannot be recorded either.
    expect(testResults[0].expectedOutput).toBe('');
    expect(testResults[0].isSample).toBe(false);
    // What they printed is theirs to see, and is what makes a failure fixable.
    expect(testResults[0].actualOutput).toBe('9');
  });

  it('keeps a sample case’s expected output, which is already public', async () => {
    const { testResults } = await runCellTestCases({
      cell: { _id: 'c1', source: 'print(2.5)' },
      testCases: [{ _id: 't1', input: '1 2 3 4', output: '2.5', isSample: true }],
      runCell: kernelPrinting('2.50'),
    });
    expect(testResults[0].passed).toBe(false);
    expect(testResults[0].isSample).toBe(true);
    expect(testResults[0].expectedOutput).toBe('2.5');
    expect(testResults[0].actualOutput).toBe('2.50');
  });

  it('marks a case failed when the kernel errored, without hashing anything', async () => {
    const broken = vi.fn(async () => ({ result: null, error: 'SyntaxError' }));
    const { testResults } = await runCellTestCases({
      cell: { _id: 'c1', source: 'oops(' },
      testCases: [{ _id: 't1', input: '', outputHash: HASH_OF_2_5 }],
      runCell: broken,
    });
    expect(testResults[0].passed).toBe(false);
    expect(testResults[0].error).toBe('SyntaxError');
  });
});
