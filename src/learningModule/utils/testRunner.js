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
 * The text a test case is judged on: what the cell visibly produced.
 *
 * That is its printed output followed by the value of its last expression, the
 * same two things the cell shows the student, in the same order. Judging only
 * one of them made the verdict depend on how the answer was written rather than
 * on what it was — the last value used to count only when nothing was printed.
 *
 * `result` is the kernel's rendering of that value. For Python it is the
 * `repr`, so a returned string reads `'True'` with its quotes and a boolean
 * reads `True`, exactly as the cell displays them. C has no last expression;
 * its kernel reports an exit status there, which is not program output, and the
 * caller passes null for it.
 */
export function cellOutputText(stdout, result) {
  const text = stdout || '';
  if (result === null || result === undefined) return text;
  const separator = text && !text.endsWith('\n') ? '\n' : '';
  return `${text}${separator}${result}`;
}

/**
 * Words in an expected output that spell a boolean the way Python never prints
 * one — `true`, `FALSE` — so the editor can warn before every correct answer
 * fails on a capital letter. A warning and not a refusal: printing the word
 * `true` is a perfectly good thing for a program to do on purpose.
 */
export function misspelledPythonBooleans(expected) {
  const words = normalizeOutput(expected).split(/[^A-Za-z]+/);
  return [...new Set(words.filter((word) => /^(true|false)$/i.test(word) && word !== 'True' && word !== 'False'))];
}

/**
 * SHA-256 of a normalized output, as lowercase hex.
 *
 * The counterpart of `hashOutput` on the server, and the two must agree
 * byte-for-byte — `normalizeOutput` here and `canonicalOutput` there are the
 * same rule written twice, which is a thing to keep in step. A test pins them
 * against a known digest so a change to either one is caught.
 */
export async function hashOutput(text) {
  const bytes = new TextEncoder().encode(normalizeOutput(text));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Whether one run passed, against whichever form of the answer we were given.
 *
 * A sample case arrives with its expected output in full, because the student is
 * shown it anyway. Every other case arrives as a digest only: the server stopped
 * sending hidden answers to the browser, so matching means hashing what the
 * program printed and comparing. Same verdict either way, and the page no longer
 * has anything worth reading in it.
 */
export async function evaluateAgainstCase(actual, testCase) {
  if (typeof testCase.outputHash === 'string' && testCase.outputHash) {
    return (await hashOutput(actual)) === testCase.outputHash;
  }
  return evaluateOutputMatch(actual, testCase.output);
}

/**
 * Runs a cell against an array of test cases using the kernel's runCell function.
 *
 * @param {Object} options
 * @param {Object} options.cell - The notebook cell being tested
 * @param {Array} options.testCases - Array of { _id, input, isSample, and either
 *        `output` (sample cases) or `outputHash` (everything else)
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

    // Chunks are joined exactly as they arrive. Both kernels already carry the
    // program's own newlines, and a chunk boundary is only where a batch
    // happened to be flushed — a line printed in two writes, or a pause
    // mid-program, must not grow a line break the student never printed.
    let collectedStdout = '';
    const onOutput = (chunk) => {
      if (chunk.type === 'stdout') {
        collectedStdout += chunk.text || '';
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

      const outputText = cellOutputText(collectedStdout, isC ? null : result);
      // eslint-disable-next-line no-await-in-loop
      const passed = !error && (await evaluateAgainstCase(outputText, tc));

      testResults.push({
        testCaseId: tc._id || null,
        passed,
        // A sample case is shown to the student in the cell anyway, so there is
        // nothing to withhold. A hidden one has no expected output here to
        // record — the browser never received it.
        isSample: Boolean(tc.isSample),
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
        isSample: Boolean(tc.isSample),
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
