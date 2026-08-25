/**
 * Universal test runner for coding notebook cells (Python and C).
 *
 * Runs cells against input/output test case pairs using the existing kernel
 * runCell interface and normalizes outputs for comparison.
 */

/**
 * Normalizes output strings to ensure consistent matching across platforms:
 * - Converts CRLF to LF
 * - Trims trailing whitespace from each line
 * - Trims overall leading and trailing whitespace
 */
export function normalizeOutput(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Checks if the actual output matches expected output after normalization.
 */
export function evaluateOutputMatch(actual, expected) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

/**
 * Runs a cell against an array of test cases using the kernel's runCell function.
 *
 * @param {Object} options
 * @param {Object} options.cell - The notebook cell being tested
 * @param {Array} options.testCases - Array of { _id, input, output }
 * @param {Boolean} [options.isC] - Whether this is a C cell (requires prelude)
 * @param {Array} [options.prelude] - Hidden setup sources for C compilation
 * @param {Function} options.runCell - Kernel runCell function (cellId, source, onOutput, opts)
 * @param {Function} [options.onProgress] - Optional progress callback (index, total)
 * @returns {Promise<{ testResults: Array, testSummary: Object }>}
 */
export async function runCellTestCases({
  cell,
  testCases = [],
  isC = false,
  prelude = [],
  runCell,
  onProgress,
}) {
  if (!testCases || testCases.length === 0) {
    return {
      testResults: [],
      testSummary: { total: 0, passed: 0, failed: 0, passedAll: false },
    };
  }

  const testResults = [];

  for (let i = 0; i < testCases.length; i += 1) {
    const tc = testCases[i];
    if (typeof onProgress === 'function') {
      onProgress(i, testCases.length);
    }

    let collectedStdout = '';
    const onOutput = (chunk) => {
      if (chunk.type === 'stdout' || chunk.type === 'result') {
        collectedStdout += (chunk.text || '') + '\n';
      }
    };

    try {
      const cellIdentifier = cell._id || cell.key || 'cell';
      const runId = `tc-${cellIdentifier}-${i}-${Date.now()}`;
      // eslint-disable-next-line no-await-in-loop
      const { result, error } = await runCell(runId, cell.source, onOutput, {
        stdin: tc.input || '',
        prelude: isC ? prelude : [],
      });

      // If the cell produced a result expression, append if not already captured
      const outputText = collectedStdout || (result !== null && result !== undefined ? String(result) : '');
      const passed = !error && evaluateOutputMatch(outputText, tc.output);

      testResults.push({
        testCaseId: tc._id || null,
        passed,
        input: tc.input || '',
        expectedOutput: tc.output || '',
        actualOutput: outputText.trim(),
        error: error || null,
        executedAt: new Date().toISOString(),
      });
    } catch (err) {
      testResults.push({
        testCaseId: tc._id || null,
        passed: false,
        input: tc.input || '',
        expectedOutput: tc.output || '',
        actualOutput: '',
        error: err.message || String(err),
        executedAt: new Date().toISOString(),
      });
    }
  }

  if (typeof onProgress === 'function') {
    onProgress(testCases.length, testCases.length);
  }

  const passedCount = testResults.filter((r) => r.passed).length;
  const testSummary = {
    total: testResults.length,
    passed: passedCount,
    failed: testResults.length - passedCount,
    passedAll: testResults.length > 0 && passedCount === testResults.length,
  };

  return { testResults, testSummary };
}
