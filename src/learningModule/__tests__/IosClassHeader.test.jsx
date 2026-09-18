import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';
import IosClassHeader from '../components/IosClassHeader';

/**
 * The iOS class card.
 *
 * The thing worth pinning down is not that it draws — it is that a student's
 * card is built from what a student may actually do. The old header hid the
 * teacher controls one `isTeacher &&` at a time, and a control added without
 * one would have shipped to every student in the class; these tests fail if
 * that happens to insights, the class code or class settings.
 */
const klass = {
  name: 'FE class',
  section: 'Sem B.Tech-BT+MCE-SectionA5',
  subject: 'CY-202',
  room: 'ES Lab(A5a)',
  ownerName: 'harimurugan@nitj.ac.in',
  code: '2smpay6',
  coverColor: '#1967d2',
  counts: { studentCount: 4, courseworkCount: 4 },
};

const renderCard = (isTeacher) =>
  renderWithProviders(<IosClassHeader klass={klass} classId="c1" isTeacher={isTeacher} />);

describe('learningModule <IosClassHeader />', () => {
  it('names the class, its section and who teaches it', () => {
    renderCard(true);
    expect(screen.getByRole('heading', { name: 'FE class' })).toBeInTheDocument();
    expect(screen.getByText('Sem B.Tech-BT+MCE-SectionA5 · CY-202 · ES Lab(A5a)')).toBeInTheDocument();
    expect(screen.getByText('harimurugan@nitj.ac.in')).toBeInTheDocument();
    expect(screen.getByText('4 items')).toBeInTheDocument();
  });

  it('gives a teacher all three destinations, with the roll count on People', () => {
    renderCard(true);
    const people = screen.getByRole('link', { name: /People/ });
    expect(within(people).getByText('4')).toBeInTheDocument();
    expect(people).toHaveAttribute('href', '/learning/class/c1/people');
    expect(screen.getByRole('link', { name: /Insights/ })).toHaveAttribute(
      'href',
      '/learning/class/c1/insights',
    );
    expect(screen.getByRole('link', { name: /Leaderboard/ })).toHaveAttribute(
      'href',
      '/learning/class/c1/leaderboard',
    );
  });

  it('puts the class code in its own panel for a teacher to copy', () => {
    renderCard(true);
    expect(screen.getByText('CLASS CODE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy class code 2smpay6/ })).toBeInTheDocument();
  });

  it('withholds insights and the class code from a student', () => {
    renderCard(false);
    expect(screen.getByRole('link', { name: /People/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Leaderboard/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Insights/ })).not.toBeInTheDocument();
    expect(screen.queryByText('CLASS CODE')).not.toBeInTheDocument();
    expect(screen.queryByText('2smpay6')).not.toBeInTheDocument();
  });

  it('marks an archived class', () => {
    renderWithProviders(
      <IosClassHeader klass={{ ...klass, status: 'archived' }} classId="c1" isTeacher />,
    );
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });
});
