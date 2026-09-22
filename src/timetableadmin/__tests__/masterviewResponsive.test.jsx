import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import TimetableMasterView from '../masterview';

/**
 * The master view on a phone.
 *
 * The table it draws is eight columns wide — department, code, two
 * timestamps, publish status and three actions. It was held to percentage
 * widths by `tableLayout: fixed` at `width: 100%`, and that is a table which
 * *cannot* outgrow its container: the `overflowX: auto` wrapped around it
 * never had anything to scroll, so on a 375px screen the columns did not
 * overflow, they crushed to roughly forty pixels each.
 *
 * What replaced it: a card per department below `md`, the table from `md` up
 * with a minimum width so its wrapper finally has something to scroll, and one
 * shared set of links and one shared publish control so the two layouts cannot
 * drift apart.
 *
 * ## Which layout these tests see
 *
 * jsdom parses media queries but never matches them, so every responsive style
 * Chakra emits resolves to its `base` branch — the phone one. That makes the
 * table `display: none` here, and Testing Library's *role* queries skip what
 * CSS has hidden. So `getByRole` sees the phone layout and nothing else, which
 * is the layout under test; `getByText` ignores visibility, so it sees both and
 * is what proves the table is still there. The two kinds of query are used
 * deliberately below, not interchangeably.
 */

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));
vi.mock('../../components/header', () => ({ default: () => <div>header</div> }));

const ROWS = [
  {
    _id: 'r1',
    dept: 'Computer Science and Engineering',
    code: 'CSE-2026',
    publish: false,
    datePublished: null,
  },
  {
    _id: 'r2',
    dept: 'Electronics',
    code: 'ECE-2026',
    publish: true,
    datePublished: '2026-09-21T07:00:00.000Z',
  },
];

const jsonResponse = (body) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn(async (url) => {
    if (url.includes('/allotment/session')) return jsonResponse(['2026-27']);
    if (url.includes('/lock/viewsem/')) {
      return jsonResponse({ updatedTime: { lockTimeIST: '21/09/2026, 12:30:00' } });
    }
    if (url.includes('viewsem') || url.includes('save')) {
      return jsonResponse({ updatedTime: { saveTimeIST: '21/09/2026, 12:00:00' } });
    }
    return jsonResponse(ROWS);
  });
});

afterEach(() => {
  delete global.fetch;
});

const settled = async () => {
  render(
    <HelmetProvider>
      <ChakraProvider>
        <MemoryRouter>
          <TimetableMasterView />
        </MemoryRouter>
      </ChakraProvider>
    </HelmetProvider>,
  );
  await waitFor(() => expect(screen.getAllByText('CSE-2026').length).toBeGreaterThan(0));
};

const table = () => document.querySelector('table');

describe('the phone layout', () => {
  /* Role queries see only what is visible, and at jsdom's width that is the
     cards. Two departments, so two of each action — named, not iconned: three
     unlabelled squares in a row is a guess, and the table can only leave them
     as icons because its column headings say what they are. */
  it('names the three actions instead of leaving bare icons', async () => {
    await settled();
    expect(screen.getAllByRole('link', { name: /view tt/i })).toHaveLength(ROWS.length);
    expect(screen.getAllByRole('link', { name: /^load$/i })).toHaveLength(ROWS.length);
    expect(screen.getAllByRole('link', { name: /^pdf$/i })).toHaveLength(ROWS.length);
  });

  it('labels each field, since a card has no column heading above it', async () => {
    await settled();
    for (const label of ['Last Saved', 'Last Locked', 'Publish']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('shows a timestamp where there is one', async () => {
    await settled();
    await waitFor(() =>
      expect(screen.getAllByText('21/09/2026, 12:30:00').length).toBeGreaterThan(0));
  });

  it('says plainly when a timetable has never been saved', async () => {
    await settled();
    expect(screen.getAllByText('Not saved yet').length).toBeGreaterThan(0);
  });

  /* Publishing mails every faculty member. One unpublished row means exactly
     one live button — and the other row must offer none at all. */
  it('offers Publish for the unpublished row only', async () => {
    await settled();
    expect(screen.getAllByRole('button', { name: /^publish$/i })).toHaveLength(1);
    expect(screen.getAllByText('Published').length).toBeGreaterThan(0);
  });
});

describe('the table, which the phone layout replaces rather than removes', () => {
  it('still renders every department', async () => {
    await settled();
    expect(within(table()).getByText('CSE-2026')).toBeInTheDocument();
    expect(within(table()).getByText('ECE-2026')).toBeInTheDocument();
  });

  it('keeps all eight columns', async () => {
    await settled();
    const headings = Array.from(table().querySelectorAll('thead th')).map((th) => th.textContent);
    expect(headings).toEqual([
      'Department',
      'Code',
      'Last Saved',
      'Last Locked',
      'Publish Status',
      'View TT',
      'Faculty Load',
      'Download',
    ]);
  });

  it('keeps its own icon actions per row', async () => {
    await settled();
    const row = within(table()).getByText('CSE-2026').closest('tr');
    for (const label of ['View Timetable', 'View Faculty Load Allocation', 'Download PDF']) {
      expect(within(row).getByLabelText(label)).toBeInTheDocument();
    }
  });

  /* The bug itself. A fixed-layout table at width 100% cannot exceed its
     container, so the overflowX around it never scrolled and the columns
     compressed instead. A minimum width is what makes the wrapper scroll. */
  it('is wide enough to overflow rather than compress', async () => {
    await settled();
    const styles = getComputedStyle(table());
    expect(styles.tableLayout).not.toBe('fixed');
    expect(styles.minWidth).toBe('900px');
  });

  it('sits in a wrapper that can scroll horizontally', async () => {
    await settled();
    expect(getComputedStyle(table().parentElement).overflowX).toBe('auto');
  });
});

describe('the two layouts do not drift', () => {
  /* The real risk in drawing one row twice: the same three destinations built
     in two places, so a link works on a desktop and 404s on a phone. */
  it('points both layouts at the same three URLs', async () => {
    await settled();
    const origin = window.location.origin;
    const hrefs = new Set(
      Array.from(document.querySelectorAll('a[href*="/tt/CSE-2026"]'))
        .map((a) => a.getAttribute('href')),
    );

    expect(hrefs).toEqual(new Set([
      `${origin}/tt/CSE-2026`,
      `${origin}/tt/CSE-2026/generatepdf`,
      `${origin}/tt/CSE-2026/generatepdf/loadallocation`,
    ]));
  });

  it('opens every action in a new tab from either layout', async () => {
    await settled();
    const links = document.querySelectorAll('a[href*="/tt/CSE-2026"]');
    expect(links.length).toBe(6); // three actions, drawn twice
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });
});
