import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/renderWithProviders';
import TutorialManual from '../pages/TutorialManual';
import AssignmentManual from '../pages/AssignmentManual';

/**
 * The Tutorial and Assignment manuals: every tab opens, and the question-type
 * and re-evaluate sections are where a teacher would look for them.
 */
describe.each([
  ['Tutorial', TutorialManual, 'Results & Marks'],
  ['Assignment', AssignmentManual, 'Grading & Results'],
])('%s manual', (name, Manual, resultsTab) => {
  it('opens every tab', async () => {
    renderWithProviders(<Manual />);
    const tabs = [
      'Overview', 'Create & Author', 'Question Types', 'Settings',
      'Import a Paper', 'What Students See', resultsTab, 'Gotchas',
    ];
    for (const label of tabs) {
      // eslint-disable-next-line no-await-in-loop
      await userEvent.click(screen.getByText(label));
    }
    expect(screen.getByText(/things worth knowing/)).toBeInTheDocument();
  });

  it('explains the four question types and their colour badges', async () => {
    renderWithProviders(<Manual />);
    await userEvent.click(screen.getByText('Question Types'));
    expect(screen.getByText('The Four Types at a Glance')).toBeInTheDocument();
    expect(screen.getByText('Telling Types Apart — the Colour Badges')).toBeInTheDocument();
    ['Numerical with random variables', 'Multiple choice', 'Multiple answers', 'Numerical'].forEach((label) =>
      expect(screen.getAllByText(label).length).toBeGreaterThan(0),
    );
  });

  it('documents Re-evaluate beside the results', async () => {
    renderWithProviders(<Manual />);
    await userEvent.click(screen.getByText(resultsTab));
    expect(screen.getByText('Re-evaluating Papers Already Issued')).toBeInTheDocument();
    // The warning that a manual adjustment is dropped by a re-mark.
    expect(screen.getByText('not added back')).toBeInTheDocument();
  });
});
