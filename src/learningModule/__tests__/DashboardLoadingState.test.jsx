import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  StatTileSkeleton,
  ClassCardSkeleton,
  ClassCardGridSkeleton,
} from '../components/common';

describe('Dashboard Loading State Skeletons', () => {
  it('renders StatTileSkeleton', () => {
    render(<StatTileSkeleton />);
    expect(screen.getByTestId('stat-tile-skeleton')).toBeInTheDocument();
  });

  it('renders ClassCardSkeleton', () => {
    render(<ClassCardSkeleton />);
    expect(screen.getByTestId('class-card-skeleton')).toBeInTheDocument();
  });

  it('renders ClassCardGridSkeleton with specified count of cards', () => {
    render(<ClassCardGridSkeleton count={4} />);
    const grid = screen.getByTestId('class-card-grid-skeleton');
    expect(grid).toBeInTheDocument();
    const cards = screen.getAllByTestId('class-card-skeleton');
    expect(cards).toHaveLength(4);
  });
});
