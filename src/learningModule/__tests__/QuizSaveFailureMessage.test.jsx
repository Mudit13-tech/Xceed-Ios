import { describe, expect, it } from 'vitest';

import { saveFailureMessage } from '../saveFailure';

/**
 * What a student is told when a save fails mid-exam.
 *
 * A student sitting EM-I was shown this, in a red banner across the top of
 * question 8:
 *
 *   No matching document found for id "6a86ca8a8b397eaac09d463a" version 19
 *   modifiedPaths "responses, responses.7, responses.7.selected, cursor,
 *   currentServedAt"
 *
 * That is Mongoose reporting a version clash between two requests writing the
 * same attempt (fixed at the source — see the server's `withVersionRetry`), but
 * the *message* is a second, separate failure. It reached the screen because
 * every failed save shows `err.message`, and an unhandled 500's message is
 * whatever threw somewhere inside the request. To the person reading it during
 * an exam it says only that something is badly wrong with the paper they are
 * being marked on.
 *
 * The split is on the status, not on the text, so it holds for the next
 * internal error as well as that one.
 */
describe('saveFailureMessage', () => {
  it('shows what the server deliberately said', () => {
    // These are worth reading: each one tells the student what to do next.
    expect(saveFailureMessage({ status: 400, message: 'Going back is not allowed in this quiz.' }))
      .toBe('Going back is not allowed in this quiz.');
    expect(saveFailureMessage({ status: 409, message: 'This test is already open in another browser.' }))
      .toBe('This test is already open in another browser.');
  });

  it('never puts an internal error on an exam paper', () => {
    const internal = {
      status: 500,
      message:
        'No matching document found for id "6a86ca8a8b397eaac09d463a" version 19 '
        + 'modifiedPaths "responses, responses.7, responses.7.selected, cursor, currentServedAt"',
    };
    const shown = saveFailureMessage(internal);

    expect(shown).not.toContain('No matching document');
    expect(shown).not.toContain('modifiedPaths');
    // And it still says the one thing that matters to a student mid-question.
    expect(shown).toContain('still on screen');
  });

  it('says the same for a request that never reached the server', () => {
    // A dropped connection throws a plain Error with no status at all.
    expect(saveFailureMessage(new Error('Failed to fetch'))).toContain('check your connection');
    expect(saveFailureMessage(undefined)).toContain('check your connection');
  });
});
