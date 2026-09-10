import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  AnnouncementCardSkeleton,
  AnnouncementStreamSkeleton,
  MaterialCardSkeleton,
  MaterialListSkeleton,
  ShortCardSkeleton,
  ShortsListSkeleton,
  TimetableSkeleton,
} from '../components/common';

describe('Card Loading State Skeletons', () => {
  it('renders AnnouncementCardSkeleton', () => {
    render(<AnnouncementCardSkeleton />);
    expect(screen.getByTestId('announcement-card-skeleton')).toBeInTheDocument();
  });

  it('renders AnnouncementStreamSkeleton with default and custom count', () => {
    render(<AnnouncementStreamSkeleton count={3} />);
    expect(screen.getByTestId('announcement-stream-skeleton')).toBeInTheDocument();
    const cards = screen.getAllByTestId('announcement-card-skeleton');
    expect(cards).toHaveLength(3);
  });

  it('renders MaterialCardSkeleton', () => {
    render(<MaterialCardSkeleton />);
    expect(screen.getByTestId('material-card-skeleton')).toBeInTheDocument();
  });

  it('renders MaterialListSkeleton with default and custom count', () => {
    render(<MaterialListSkeleton count={4} />);
    expect(screen.getByTestId('material-list-skeleton')).toBeInTheDocument();
    const cards = screen.getAllByTestId('material-card-skeleton');
    expect(cards).toHaveLength(4);
  });

  it('renders ShortCardSkeleton', () => {
    render(<ShortCardSkeleton />);
    expect(screen.getByTestId('short-card-skeleton')).toBeInTheDocument();
  });

  it('renders ShortsListSkeleton with default and custom count', () => {
    render(<ShortsListSkeleton count={3} />);
    expect(screen.getByTestId('shorts-list-skeleton')).toBeInTheDocument();
    const cards = screen.getAllByTestId('short-card-skeleton');
    expect(cards).toHaveLength(3);
  });

  it('renders TimetableSkeleton', () => {
    render(<TimetableSkeleton />);
    expect(screen.getByTestId('timetable-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('timetable-skeleton-grid')).toBeInTheDocument();
  });
});
