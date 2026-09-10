import { describe, expect, it } from 'vitest';

import { formatAnswerValue } from '../format.js';

describe('learningModule formatAnswerValue — complex answers', () => {
  it('formats a real value exactly as before (no regression)', () => {
    expect(formatAnswerValue(12)).toBe('12');
    expect(formatAnswerValue(3.14159, 2)).toBe('3.14');
    expect(formatAnswerValue(null)).toBe('—');
  });

  it('formats a complex value as "re + imi" when an imaginary part is given', () => {
    expect(formatAnswerValue(3, null, 4)).toBe('3 + 4i');
    expect(formatAnswerValue(3, null, -4)).toBe('3 - 4i');
  });

  it('rounds both parts of a complex value to the teacher-set decimals', () => {
    expect(formatAnswerValue(3.14159, 2, 4.98765)).toBe('3.14 + 4.99i');
  });

  it('ignores a zero imaginary part and formats as a plain real number', () => {
    expect(formatAnswerValue(5, null, 0)).toBe('5');
  });

  it('accepts a pre-joined {re, im} object as the value itself', () => {
    // This is the shape a live preview/reveal endpoint sends (expectedFor()'s
    // raw result), as opposed to the attempt schema's split value/valueIm
    // fields — both must render the same way.
    expect(formatAnswerValue({ re: 3, im: 4 })).toBe('3 + 4i');
    expect(formatAnswerValue({ re: 3.14159, im: 4.98765 }, 2)).toBe('3.14 + 4.99i');
    expect(formatAnswerValue({ re: 5, im: 0 })).toBe('5');
  });
});
