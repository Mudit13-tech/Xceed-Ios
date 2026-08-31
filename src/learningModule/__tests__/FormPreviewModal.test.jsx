import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import FormPreviewModal from '../components/FormPreviewModal';

const sampleForm = {
  _id: 'f123',
  title: 'Course Feedback Survey',
  description: 'Tell us how the course went',
  questions: [
    {
      _id: 'q1',
      type: 'short_answer',
      title: 'Your Name',
      description: 'Enter full name',
      required: true,
      options: [],
    },
    {
      _id: 'q2',
      type: 'multiple_choice',
      title: 'Overall Rating',
      required: false,
      options: ['Excellent', 'Good', 'Average', 'Poor'],
    },
  ],
};

describe('FormPreviewModal', () => {
  it('renders student preview header banner and form questions', () => {
    renderWithProviders(<FormPreviewModal isOpen={true} onClose={() => {}} form={sampleForm} classId="c1" />);

    expect(screen.getByText(/Student Preview: Course Feedback Survey/i)).toBeInTheDocument();
    expect(screen.getByText(/Student View Preview/i)).toBeInTheDocument();
    expect(screen.getByText('Your Name')).toBeInTheDocument();
    expect(screen.getByText('Overall Rating')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('handles empty questions list gracefully', () => {
    renderWithProviders(<FormPreviewModal isOpen={true} onClose={() => {}} form={{ _id: 'f1', title: 'Empty Form', questions: [] }} classId="c1" />);

    expect(screen.getByText(/No questions added to this form yet/i)).toBeInTheDocument();
  });

  it('triggers info toast when submit button is pressed in preview mode', async () => {
    renderWithProviders(<FormPreviewModal isOpen={true} onClose={() => {}} form={sampleForm} classId="c1" />);

    const nameInput = screen.getByRole('textbox', { name: /your name/i });
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });

    const submitBtn = screen.getByRole('button', { name: /^submit$/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/This is a preview. Form response was not saved/i)).toBeInTheDocument();
  });
});
