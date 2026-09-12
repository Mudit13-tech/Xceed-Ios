import { expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * `formatAnswerValue` renders the imaginary unit lowercase, correctly — the
 * capital "I" a teacher sees in a preview is put there by the Badge it is
 * displayed in. Chakra's Badge sets `textTransform: uppercase` in its base
 * style, which is right for the one-word status labels it is meant for and
 * wrong for a value.
 *
 * It is not only the "i". The unit rides in the same badge, so "3 + 4i mA"
 * reads as "3 + 4I MA" — the SI prefix is corrupted too, and mA and MA are
 * nine orders of magnitude apart.
 */

const previewAssignment = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    previewAssignment: (...a) => previewAssignment(...a),
    previewTutorial: vi.fn(),
  },
}));

const sample = {
  label: 'Sample 1',
  questions: [
    {
      questionId: 'q1',
      prompt: '<p>Find the impedance.</p>',
      values: { R: 30, X: 40 },
      parts: [],
      expected: [
        {
          key: 'z',
          label: 'Impedance',
          value: 30,
          valueIm: 40,
          decimals: null,
          unit: 'mA',
          partIndex: null,
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

it('does not uppercase a complex answer or its unit in the paper preview', async () => {
  previewAssignment.mockResolvedValueOnce({ samples: [sample], warnings: [] });

  const { default: PaperPreviewModal } = await import('../components/PaperPreviewModal');
  renderWithProviders(
    <PaperPreviewModal isOpen onClose={() => {}} classId="c1" kind="assignment" item={{ _id: 'a1' }} />,
  );

  const badge = await screen.findByText(/Impedance:/);
  // The text itself was always right; the CSS is what mangles it, so that is
  // what has to be asserted.
  expect(badge).toHaveTextContent('30 + 40i mA');
  expect(getComputedStyle(badge).textTransform).toBe('none');
});
