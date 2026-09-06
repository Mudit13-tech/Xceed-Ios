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
  it('offers both new modules as "newly launched", ahead of the conference links', () => {
    renderAt(<Hero />);

    const badges = screen.getAllByText('Newly launched');
    expect(badges).toHaveLength(2);

    expect(hrefOf(/XCEED Learning/)).toBe('/xceed-learning');
    expect(hrefOf(/iLEED/)).toBe('/ileed');
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
