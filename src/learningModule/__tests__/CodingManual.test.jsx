import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import CodingManual from '../pages/CodingManual';

describe('learningModule <CodingManual />', () => {
  it('renders overview tab by default with title and workflow details', () => {
    render(<CodingManual />);
    expect(screen.getByText('Coding Notebooks — Teacher Manual')).toBeInTheDocument();
    expect(screen.getByText(/Universal Hidden Test Cases & Verification/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Hidden Test Case/i)).toBeInTheDocument();
  });

  it('renders all 7 tabs including Hidden Test Cases', () => {
    render(<CodingManual />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Author a Notebook')).toBeInTheDocument();
    expect(screen.getAllByText('Hidden Test Cases').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('What Can Run')).toBeInTheDocument();
    expect(screen.getByText('What Students See')).toBeInTheDocument();
    expect(screen.getByText('Grading')).toBeInTheDocument();
    expect(screen.getByText('Gotchas')).toBeInTheDocument();
  });

  it('switches to Hidden Test Cases tab and displays authoring and verification instructions', () => {
    render(<CodingManual />);
    const testCasesTabs = screen.getAllByText('Hidden Test Cases');
    fireEvent.click(testCasesTabs[0]);

    // Section Titles and Key Concepts
    expect(screen.getByText(/Universal Hidden Test Cases:/i)).toBeInTheDocument();
    expect(screen.getByText(/Faculty Authoring & Verification Interface/i)).toBeInTheDocument();
    expect(screen.getByText(/Step-by-Step Guide for Teachers/i)).toBeInTheDocument();

    // 5 Steps
    expect(screen.getByText(/Open the Test Cases Panel in the Notebook Editor/i)).toBeInTheDocument();
    expect(screen.getByText(/Add Test Cases \(Stdin & Expected Stdout\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Start the Kernel & Write Reference Solution/i)).toBeInTheDocument();
    expect(screen.getByText(/Verify Your Solution with 'Test Solution on Cell'/i)).toBeInTheDocument();
    expect(screen.getByText(/Provide Starter Prompt \/ Skeleton & Publish/i)).toBeInTheDocument();

    // Language specifics
    expect(screen.getByText(/Python Test Execution/i)).toBeInTheDocument();
    expect(screen.getByText(/C Test Execution/i)).toBeInTheDocument();
    expect(screen.getByText(/Smart Output Normalization:/i)).toBeInTheDocument();
  });

  it('switches to Grading tab and shows test cases grading information', () => {
    render(<CodingManual />);
    const gradingTab = screen.getByText('Grading');
    fireEvent.click(gradingTab);

    expect(screen.getByText(/Automated Test Summaries \+ Manual Grading:/i)).toBeInTheDocument();
    expect(screen.getByText(/Detailed Test Diffs/i)).toBeInTheDocument();
  });

  it('switches to Gotchas tab and displays updated test case behavior', () => {
    render(<CodingManual />);
    const gotchasTab = screen.getByText('Gotchas');
    fireEvent.click(gotchasTab);

    expect(screen.getByText(/Hidden test cases evaluate locally inside the browser kernel/i)).toBeInTheDocument();
  });

  it('renders standalone header when standalone prop is true', async () => {
    await React.act(async () => {
      render(<CodingManual standalone />);
    });
    const headers = screen.getAllByText('Coding Notebooks — Teacher Manual');
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });
});
