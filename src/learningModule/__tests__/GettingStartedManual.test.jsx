import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import GettingStartedManual from '../pages/GettingStartedManual';
import SetupManual from '../pages/SetupManual';
import FormsManual from '../pages/FormsManual';

describe('learningModule <GettingStartedManual />', () => {
  it('introduces the module and says where to sign in', () => {
    render(<GettingStartedManual />);
    expect(screen.getByText('XCEED Learning — Introduction and Manuals')).toBeInTheDocument();
    expect(screen.getByText(/built in-house/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /xceed\.nitj\.ac\.in\/login/ }).length).toBeGreaterThan(0);
  });

  /* The parts follow the tabs along the top of a class. If the navbar is
     reordered and this is not, the manual stops matching the product. */
  it('lists the parts in class-navbar order', () => {
    render(<GettingStartedManual />);
    const parts = ['Setting up the classroom', 'Shorts', 'Quizzes', 'Tutorials', 'Assignments', 'Forms', 'Coding'];
    parts.forEach((title, i) => {
      expect(screen.getByText(`Part ${i + 1}`)).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: new RegExp(title) }).length).toBeGreaterThan(0);
    });
  });

  it('opens every part in its own tab, at a public manual route', () => {
    const { container } = render(<GettingStartedManual />);
    const expected = [
      '/learning/setupmanual',
      '/learning/shortsmanual',
      '/learning/quizmanual',
      '/learning/tutorialmanual',
      '/learning/assignmentmanual',
      '/learning/formsmanual',
      '/learning/codingmanual',
    ];
    expected.forEach((href) => {
      const links = [...container.querySelectorAll(`a[href="${href}"]`)];
      expect(links.length, `no link to ${href}`).toBeGreaterThan(0);
      links.forEach((link) => expect(link.getAttribute('target')).toBe('_blank'));
    });
  });

  it('covers the features that have no manual of their own', () => {
    render(<GettingStartedManual />);
    ['Stream', 'Material', 'Grades', 'AI Studio', 'Forum', 'Anonymous Feedback',
      'Points and badges', 'Dashboard', 'To-do', 'Calendar', 'Timetable', 'Notifications',
    ].forEach((name) => expect(screen.getByText(name)).toBeInTheDocument());
  });

  it('says how to get a faculty account, and that there is an Android app', () => {
    const { container } = render(<GettingStartedManual />);
    expect(container.textContent).toMatch(/xceed@nitj\.ac\.in/);
    expect(container.textContent).toMatch(/Google form circulated/i);
    expect(container.textContent).toMatch(/Google Play Store/i);
  });

  /* The per-student variant is the thing about assignments and tutorials that
     teachers most need to know before setting one, so it is asserted rather
     than left to survive edits by luck. */
  it('explains that each student gets their own numbers', () => {
    const { container } = render(<GettingStartedManual />);
    const text = container.textContent;
    expect(text).toMatch(/every student gets their own version of the paper/i);
    expect(text).toMatch(/Tutorials are parameterised/i);
  });

  it('says Shorts are Mentimeter-like, without its student cap', () => {
    const { container } = render(<GettingStartedManual />);
    expect(container.textContent).toMatch(/Mentimeter/);
    expect(container.textContent).toMatch(/no cap on how many students/i);
  });

  it('asks faculty to report bugs and suggestions, and says how', () => {
    render(<GettingStartedManual />);
    expect(screen.getByText(/Bugs and suggestions — please report them/)).toBeInTheDocument();
    expect(screen.getByText(/what you did, what you expected/i)).toBeInTheDocument();
  });

  /* ERP import was pulled from the manual because the feature is not finished;
     documenting it would send teachers at a dead end. */
  it('says nothing about importing a roster from the ERP', () => {
    const { container } = render(<GettingStartedManual />);
    expect(container.textContent).not.toMatch(/ERP/i);
  });

  it('renders the standalone header when standalone is set', async () => {
    await React.act(async () => {
      render(<GettingStartedManual standalone />);
    });
    expect(screen.getByText('XCEED Learning — Manuals')).toBeInTheDocument();
  });
});

describe('learningModule <SetupManual />', () => {
  it('walks through creating a class and getting students in', () => {
    render(<SetupManual />);
    expect(screen.getAllByText('Creating a class').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/The class code, and how to use it/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Setting or resetting a password/).length).toBeGreaterThan(0);
  });

  it('names the platform sign-in address', () => {
    const { container } = render(<SetupManual />);
    expect(container.textContent).toMatch(/xceed\.nitj\.ac\.in\/login/);
  });

  /* Email is the only roster route the manual teaches. ERP import and
     roll-number invitation are both gone from the UI, so neither may grow
     back into instructions here. */
  it('teaches email invitation only', () => {
    const { container } = render(<SetupManual />);
    const text = container.textContent;
    expect(text).toMatch(/Adding students by email/);
    expect(text).not.toMatch(/ERP/i);
    expect(text).not.toMatch(/roll number/i);
  });

  it('tells a reader with no account how to ask for one', () => {
    const { container } = render(<SetupManual />);
    expect(container.textContent).toMatch(/xceed@nitj\.ac\.in/);
  });

  it('every section in the contents resolves to a heading below it', () => {
    const { container } = render(<SetupManual />);
    const anchors = [...container.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href').slice(1));
    expect(anchors.length).toBeGreaterThanOrEqual(7);
    anchors.forEach((id) => {
      expect(container.querySelector(`#${id}`), `no section with id "${id}"`).not.toBeNull();
    });
  });
});

describe('learningModule <FormsManual />', () => {
  it('renders the overview tab by default', () => {
    render(<FormsManual />);
    expect(screen.getByText('Forms — Teacher Manual')).toBeInTheDocument();
    expect(screen.getByText('Eight Question Types')).toBeInTheDocument();
  });

  it('renders every tab label', () => {
    render(<FormsManual />);
    ['Overview', 'Build a Form', 'Publish & Share', 'What Respondents See', 'Responses', 'Gotchas'].forEach(
      (label) => expect(screen.getByText(label)).toBeInTheDocument(),
    );
  });
});
