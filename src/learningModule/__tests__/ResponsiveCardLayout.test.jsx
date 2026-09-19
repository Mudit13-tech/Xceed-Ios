import React from 'react';
import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, ChakraProvider } from '@chakra-ui/react';

import { CardActions, CardBody, CardRow, PageHeader } from '../components/common';

/**
 * Reported from a phone: "the arrangement of button and text in all the cards
 * is clustered". Every list in the module drew its cards as one wrapping row —
 * the text on the left, five or six `sm` buttons right-aligned on the end of
 * it — which on a desktop is a row and on a phone is a ragged block of pills
 * that lands in a different place on every card in the list.
 *
 * What holds the fix is the phone layout, so that is what is asserted here:
 * jsdom applies the rules outside the media query, which are exactly the ones
 * below `md`.
 */

const MODULE_ROOT = path.resolve(__dirname, '..');

/**
 * A responsive prop is compiled against the theme's breakpoints, so without the
 * provider Chakra emits no rule at all and every assertion below would pass on
 * an element that has no styles.
 */
const renderWithChakra = (ui) => render(<ChakraProvider>{ui}</ChakraProvider>);

/** Everything emotion has written for the render, as one string. */
const emittedCss = () =>
  Array.from(document.querySelectorAll('style'))
    .map((tag) => tag.textContent)
    .join('\n');

describe('learningModule responsive card layout', () => {
  it('stacks the card body above its controls on a phone', () => {
    renderWithChakra(
      <CardRow data-testid="row">
        <CardBody>Quiz one</CardBody>
        <CardActions>
          <Button>Edit</Button>
        </CardActions>
      </CardRow>,
    );

    expect(screen.getByTestId('row')).toHaveStyle({ flexDirection: 'column' });
    // And is still a row on a desktop. jsdom never applies the media query, so
    // the rule itself is what is read.
    expect(emittedCss()).toMatch(/min-width: 48em\)\{[^@]*flex-direction:row/);
  });

  it('gives the controls the full width of the card, left-aligned', () => {
    renderWithChakra(
      <CardActions data-testid="actions">
        <Button>Edit</Button>
        <Button>Results</Button>
      </CardActions>,
    );

    expect(screen.getByTestId('actions')).toHaveStyle({
      width: '100%',
      justifyContent: 'flex-start',
      flexWrap: 'wrap',
    });
    // Two to a row, each half the card, with the badge among them left alone.
    expect(emittedCss()).toContain('>*:not(.chakra-badge){');
    expect(emittedCss()).toContain('calc(50% - 0.25rem)');
    // And a thumb-sized target, whatever `size` the call site asked for.
    expect(emittedCss()).toContain('min-height:40px');
  });

  it('lets the card body shrink below its desktop floor, so nothing scrolls sideways', () => {
    renderWithChakra(<CardBody data-testid="body">Quiz one</CardBody>);

    expect(screen.getByTestId('body')).toHaveStyle({ minWidth: '0px', maxWidth: '100%' });
  });

  it('stacks a page header above the tab controls', () => {
    renderWithChakra(
      <PageHeader
        data-testid="header"
        title="Tutorials"
        description="Numerical practice."
        actions={<Button>+ New tutorial</Button>}
      />,
    );

    expect(screen.getByTestId('header')).toHaveStyle({ flexDirection: 'column' });
    expect(screen.getByText('Tutorials')).toBeInTheDocument();
    expect(screen.getByText('Numerical practice.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ New tutorial' })).toBeInTheDocument();
  });

  /**
   * The guard that matters over time. A card written next month in the old
   * shape looks right on the reviewer's desktop and is clustered again on a
   * phone, and no render test would catch it — so the source is read instead.
   * These are the lists a student or a teacher meets on a phone.
   */
  it('builds every list card out of the shared parts', () => {
    const LIST_CARDS = [
      'components/FormCard.jsx',
      'pages/AiStudio.jsx',
      'pages/Assignments.jsx',
      'pages/FormResponses.jsx',
      'pages/Labs.jsx',
      'pages/Notebooks.jsx',
      'pages/Quizzes.jsx',
      'pages/ShortReport.jsx',
      'pages/Shorts.jsx',
      'pages/Tutorials.jsx',
    ];

    const offenders = LIST_CARDS.filter((file) => {
      const source = readFileSync(path.join(MODULE_ROOT, file), 'utf8');
      return !source.includes('<CardActions') || !source.includes('<CardRow');
    });

    expect(offenders).toEqual([]);
  });
});
