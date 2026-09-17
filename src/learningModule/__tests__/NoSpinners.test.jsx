import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderWithProviders } from '../../test/renderWithProviders';
import {
  BusyDots,
  ClassShellSkeleton,
  Loading,
  TableSkeleton,
  WorkListSkeleton,
} from '../components/common';

/**
 * The module does not spin.
 *
 * Every screen here used to answer "we are fetching something" with the same
 * centred spinner, from `Loading` — which sixty-odd screens imported. A spinner
 * is the least informative thing a loading state can be: it says something is
 * happening without saying what is coming, it replaces the whole panel with an
 * empty box, and the page jumps the moment the content lands because the box
 * was never the shape of the content.
 *
 * What replaced it is two things, and the distinction between them is the point:
 *
 *   **A skeleton**, wherever content is genuinely on its way. It is drawn in the
 *   shape the page is about to take, in the same surface and border as the real
 *   thing, so the arrival is a fill rather than a jump.
 *
 *   **`BusyDots`**, wherever nothing is arriving on a schedule — one operation
 *   in flight (a cell running, a code being checked) or a wait on another person
 *   ("waiting for your teacher to open the next question"). A skeleton there
 *   would promise content that is not coming; a spinner would claim the app is
 *   working when it is in fact idle, waiting.
 *
 * The sweep at the bottom is what stops this decaying: it is easy to add a new
 * page, reach for Chakra's `Spinner` because it is one import away, and undo the
 * whole thing one screen at a time.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(HERE, '..');

/** Every .jsx/.js under learningModule except the tests themselves. */
const sourceFiles = (dir = MODULE_ROOT, found = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') sourceFiles(full, found);
    } else if (/\.jsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
};

describe('no spinner anywhere in the learning module', () => {
  const files = sourceFiles();

  it('finds source files to check at all', () => {
    // Guards the sweep below: a glob that silently matches nothing would pass
    // every assertion in this file forever.
    expect(files.length).toBeGreaterThan(80);
  });

  it('renders no Chakra Spinner in any page or component', () => {
    const offenders = files
      .filter((file) => /<Spinner[\s/>]/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(MODULE_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('imports no Spinner from Chakra either', () => {
    // Catches the half-step: an import kept "for later" is how the first one
    // comes back.
    const offenders = files
      .filter((file) => {
        const src = fs.readFileSync(file, 'utf8');
        const chakra = /import \{([^}]*)\} from '@chakra-ui\/react';/s.exec(src);
        return chakra && /\bSpinner\b/.test(chakra[1]);
      })
      .map((file) => path.relative(MODULE_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('leaves no page loading state without a shape', () => {
    // `<Loading />` still works and still is not a spinner — it falls back to a
    // neutral panel skeleton. But a page that knows its own shape should say so,
    // and this keeps that the norm rather than the exception.
    const offenders = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const match of src.matchAll(/<Loading\b([^<>]*?)\/>/gs)) {
        if (!match[1].includes('skeleton=')) {
          offenders.push(`${path.relative(MODULE_ROOT, file)}: ${match[0].slice(0, 60)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('Loading', () => {
  it('draws a skeleton, not a spinner', () => {
    renderWithProviders(<Loading label="Loading quizzes…" />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    // Chakra's Spinner renders with this class; its absence is the assertion.
    expect(document.querySelector('.chakra-spinner')).toBeNull();
  });

  it('says what it is loading to a screen reader without printing it', () => {
    // The shape is the message for anyone who can see it. Someone who cannot
    // still needs the sentence, so it is in the accessibility tree and out of
    // the layout — not deleted.
    const { container } = renderWithProviders(<Loading label="Building the gradebook…" />);
    expect(screen.getByText('Building the gradebook…')).toBeInTheDocument();
    expect(container.querySelector('[role="status"]')).toHaveAttribute('aria-busy', 'true');
  });

  it('uses the page’s own shape when given one', () => {
    renderWithProviders(<Loading label="x" skeleton={<TableSkeleton rows={3} columns={4} />} />);
    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
    // And not the generic fallback underneath it.
    expect(screen.queryByTestId('work-card-skeleton')).toBeNull();
  });

  it('falls back to a panel shape when a page has not been given one', () => {
    renderWithProviders(<Loading label="x" />);
    expect(screen.getByTestId('page-header-skeleton')).toBeInTheDocument();
    expect(screen.getAllByTestId('work-card-skeleton').length).toBeGreaterThan(0);
  });
});

describe('the skeleton shapes', () => {
  it('draws a table as a table, with a header row and the rows asked for', () => {
    const { container } = renderWithProviders(<TableSkeleton rows={4} columns={3} />);
    expect(container.querySelectorAll('.chakra-skeleton').length).toBe(
      3 /* header cells */ + 4 * 3 /* body cells */ + 1 /* title */,
    );
  });

  it('draws the number of work cards a list was asked for', () => {
    renderWithProviders(<WorkListSkeleton count={5} />);
    expect(screen.getAllByTestId('work-card-skeleton')).toHaveLength(5);
  });

  it('draws the class shell as banner, tabs and panel', () => {
    // The most-seen loading state in the module: every class opens through it,
    // and a centred spinner there jumped the full height of the header and the
    // tab strip when the class arrived.
    renderWithProviders(<ClassShellSkeleton />);
    expect(screen.getByTestId('class-shell-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('page-header-skeleton')).toBeInTheDocument();
  });
});

describe('BusyDots', () => {
  it('names what is in flight, for anyone who cannot see it move', () => {
    render(<BusyDots label="Checking the code" />);
    expect(screen.getByLabelText('Checking the code')).toBeInTheDocument();
  });

  it('is not a spinner', () => {
    render(<BusyDots />);
    expect(document.querySelector('.chakra-spinner')).toBeNull();
    expect(screen.getByTestId('busy-dots')).toBeInTheDocument();
  });
});
