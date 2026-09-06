/**
 * The two module introduction pages and the home-page badges that reach them.
 *
 * Three things are worth pinning, because each can break without the render
 * failing and without anybody noticing until an outside visitor is bounced:
 *
 *  - the badges at the top of the hero point at the introduction pages, not
 *    into the modules themselves — their readers usually have no account yet;
 *  - both pages are listed in Navbar's publicPaths, which is what keeps the
 *    auth redirect from sending that same audience to /login;
 *  - each page offers a way into its module and a way into its manual, since
 *    the manual is the only half a signed-out reader can actually follow.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import Hero from '../../components/home/Hero';
import XceedLearningIntro from '../XceedLearningIntro';
import ILeedIntro from '../ILeedIntro';

const renderAt = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

const hrefOf = (name) => screen.getByRole('link', { name }).getAttribute('href');

describe('home hero badges', () => {
  it('offers both new modules as "newly launched", above the rail', () => {
    renderAt(<Hero />);

    const badges = screen.getAllByText('Newly launched');
    expect(badges).toHaveLength(2);

    expect(hrefOf(/XCEED Learning/)).toBe('/xceed-learning');
    expect(hrefOf(/iLEED/)).toBe('/ileed');
  });

  it('keeps the rest on one scrollable line rather than wrapping', () => {
    const { container } = renderAt(<Hero />);

    const rail = container.querySelector('.hero-badge-rail');
    expect(rail).toBeTruthy();
    // A wrapping rail is the bug this replaced: it grew a row per year and
    // pushed the heading further down the page each time.
    expect(rail.className).toContain('tw-overflow-x-auto');
    expect(rail.className).not.toContain('tw-flex-wrap');
  });

  it('still carries the sites that were briefly dropped from the row', () => {
    renderAt(<Hero />);

    expect(hrefOf(/VISTA-2026/)).toBe('https://vistanitj.com/');
    expect(hrefOf(/Chemcon-2024/)).toBe('https://chemcon2024.com/');
    expect(hrefOf(/Timetable/)).toBe('/timetable');
  });
});

describe('institute services', () => {
  it('lists both new modules and sends their cards to the introduction pages', async () => {
    const { services } = await import('../../constants/services');
    const institute = services.filter((s) => s.type === 'institute');

    const learning = institute.find((s) => s.href === '/xceed-learning');
    const ileed = institute.find((s) => s.href === '/ileed');

    expect(learning?.title).toMatch(/XCEED Learning/);
    expect(ileed?.title).toMatch(/iLEED/);

    // Both wear the same pill as the hero badges, and nothing older does.
    expect(learning?.tag).toBe('Newly launched');
    expect(ileed?.tag).toBe('Newly launched');
    expect(services.filter((s) => s.tag)).toHaveLength(2);

    // Ids stay unique — /services/:id is matched by find(), so a duplicate
    // would silently shadow another service rather than fail.
    const ids = services.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows the tag on the card, and omits it where there is none', async () => {
    const { default: ServiceCard } = await import(
      '../../components/home/Services/ServiceCard'
    );

    const { rerender } = renderAt(
      <ServiceCard id={9} title="XCEED Learning" description="…" tag="Newly launched" />
    );
    expect(screen.getByText('Newly launched')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ServiceCard id={5} title="Institute Time Table Module" description="…" />
      </MemoryRouter>
    );
    expect(screen.queryByText('Newly launched')).not.toBeInTheDocument();
  });
});

describe('XCEED Learning introduction', () => {
  it('leads to the module and to the manual', () => {
    renderAt(<XceedLearningIntro />);

    expect(
      screen.getByRole('heading', { level: 1, name: /XCEED Learning/ })
    ).toBeInTheDocument();
    expect(hrefOf(/Open the module/)).toBe('/learning');
    expect(hrefOf(/Read the teacher manual/)).toBe('/learning/manual');
  });
});

describe('iLEED introduction', () => {
  it('leads to the module and to the manual', () => {
    renderAt(<ILeedIntro />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Attendance that marks itself/ })
    ).toBeInTheDocument();
    expect(hrefOf(/Open the module/)).toBe('/attendance');
    expect(hrefOf(/Read the manual/)).toBe('/ams-manual');
  });
});

describe('the introduction pages stay public', () => {
  /**
   * Read rather than rendered: reaching publicPaths through Navbar means
   * standing up Chakra, react-query and an auth fetch to assert one array
   * literal. The list is the contract, so the list is what is checked.
   */
  it('lists both paths in Navbar publicPaths', () => {
    // Relative to the client root, the way darkMode.test.jsx reads sources.
    const navbar = readFileSync('src/components/home/Navbar.jsx', 'utf8');
    const block = navbar.slice(
      navbar.indexOf('const publicPaths = ['),
      navbar.indexOf('];', navbar.indexOf('const publicPaths = ['))
    );

    expect(block).toContain("'/xceed-learning'");
    expect(block).toContain("'/ileed'");
  });
});
