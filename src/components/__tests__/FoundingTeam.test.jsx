/**
 * The founding team section: the batch in its heading, and the "Now:" line on
 * each card.
 *
 * The current roles are a hand-compiled snapshot (see the comment above
 * `dohit` in constants/members.js — LinkedIn refuses automated readers, so
 * there is nothing to refresh them from). What is pinned here is therefore the
 * plumbing rather than the values: that every founding member carries one, that
 * it reaches the card, and that a member without one renders no empty line.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import TeamCard from '../home/TeamSection/TeamCard';
import TeamSection from '../home/TeamSection';
import { coreTeam, faculty } from '../../constants/members';

describe('founding team data', () => {
  it('gives every founding member a current role', () => {
    for (const member of coreTeam) {
      expect(member.currentRole, `${member.name} has no currentRole`).toBeTruthy();
    }
  });

  it('leaves the faculty mentors alone — their designation is the department', () => {
    for (const member of faculty) {
      expect(member.currentRole).toBeUndefined();
    }
  });
});

describe('the team card', () => {
  it('shows the current role under the club role', () => {
    render(
      <TeamCard
        name="Dohit Deegwal"
        designation="Club Lead"
        currentRole="Software Development Engineer, Urban Company"
        image="/home/team/Dohit.webp"
      />
    );

    expect(screen.getByText('Club Lead')).toBeInTheDocument();
    expect(
      screen.getByText('Software Development Engineer, Urban Company')
    ).toBeInTheDocument();
    expect(screen.getByText('Now:')).toBeInTheDocument();
  });

  it('renders nothing at all when the current role is unknown', () => {
    render(
      <TeamCard
        name="Dr. D. Harimurugan"
        designation="Department of Electrical Engineering"
        image="/home/team/Hari.webp"
        variant="faculty"
      />
    );

    expect(screen.queryByText('Now:')).not.toBeInTheDocument();
  });
});

describe('the founding team heading', () => {
  it('names the batch on a second line inside the heading', () => {
    render(<TeamSection />);

    const heading = screen.getByRole('heading', { name: /Founding Team Members/ });
    const batch = screen.getByText('Batch of 2020-2024');

    // Part of the heading, but its own block — running it on would have been
    // swallowed by the underline SectionHeader draws after the first word.
    expect(heading).toContainElement(batch);
    expect(batch.className).toContain('tw-block');
  });

  it('leaves headings without a batch as one line', () => {
    render(<TeamSection />);

    const faculty = screen.getByRole('heading', { name: /Faculty Mentors/ });
    expect(faculty.querySelector('.tw-block')).toBeNull();
  });
});

describe('the faculty grid', () => {
  it('is centred, unlike the founding team grid', () => {
    const { container } = render(<TeamSection />);

    const grids = container.querySelectorAll('.tw-grid');
    const [founding, facultyGrid] = grids;

    // Six tracks, two per card, first card starting at track 2: one empty
    // track each side. The span is what keeps the cards the size they are in
    // the founding grid — widening them instead would have been the easy
    // wrong answer here.
    expect(facultyGrid.className).toContain('lg:tw-grid-cols-6');
    expect(facultyGrid.className).toContain('lg:*:tw-col-span-2');
    expect(facultyGrid.className).toContain('lg:[&>*:first-child]:tw-col-start-2');

    // Nothing that would resize the cards.
    expect(facultyGrid.className).not.toMatch(/tw-max-w-|tw-mx-auto/);
    expect(founding.className).toContain('lg:tw-grid-cols-3');
  });
});

describe('joining the club', () => {
  it('points at the learning module rather than a Google Form', async () => {
    const { default: JoinUs } = await import('../home/JoinUs');
    const { MemoryRouter } = await import('react-router-dom');

    render(
      <MemoryRouter>
        <JoinUs />
      </MemoryRouter>
    );

    const apply = screen.getByRole('link', { name: /XCEED Learning module/ });
    expect(apply).toHaveAttribute('href', '/learning/dev-team');
    // The old form is gone, not merely demoted.
    expect(screen.queryByText(/forms\.gle/)).not.toBeInTheDocument();
  });
});
