/**
 * The help desk's gate, its footer and where it leaves the page scrolled.
 *
 * Three rules are worth pinning because each of them is easy to undo by
 * accident and none of them shows up as a broken render:
 *
 *  - a visitor who is already signed in is not made to fetch a code out of
 *    their inbox to prove what their session already proves;
 *  - the support address is behind the gate, so the page answers first and
 *    hands out a human's mailbox only to somebody it could not help;
 *  - the newest reply is scrolled to its own start, not to the end of the
 *    thread — the answers here are long enough that the difference is the
 *    difference between reading one and never seeing its heading.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import HelpdeskPage from '../HelpdeskPage';

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));

const API = 'http://api.test/api/v1/helpdesk';

const MENU = [
  {
    category: 'Account and registration',
    topics: [
      { id: 'no-account', question: 'Am I registered?' },
      { id: 'cannot-sign-in', question: 'I cannot sign in' },
    ],
  },
  { category: 'Timetable', topics: [{ id: 'timetable-search', question: 'Where is my timetable?' }] },
  { category: 'XCEED team', topics: [{ id: 'ask-a-human', question: 'My question is not answered here' }] },
];

/**
 * Replies chosen by URL rather than by call order: the menu and the
 * signed-in probe both fire on mount and their order is an implementation
 * detail this file should not be asserting on.
 */
const routeFetch = (routes) => {
  const fetchMock = vi.fn((url) => {
    const match = Object.keys(routes).find((key) => String(url).endsWith(key));
    const reply = match ? routes[match] : { ok: true, body: {} };
    return Promise.resolve({
      ok: reply.ok !== false,
      status: reply.status || (reply.ok === false ? 401 : 200),
      json: () => Promise.resolve(reply.body || {}),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const GATE = { '/menu': { body: { menu: MENU } }, '/session': { ok: false, status: 401, body: {} } };

const verifyAddress = async (user) => {
  await user.type(await screen.findByLabelText('Email address'), 'asha@nitj.ac.in');
  await user.click(screen.getByRole('button', { name: 'Send me a code' }));
  await user.type(await screen.findByLabelText('Six-digit code'), '123456');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
};

beforeEach(() => {
  vi.restoreAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('the gate', () => {
  it('asks an anonymous visitor for their address', async () => {
    routeFetch(GATE);
    render(<HelpdeskPage />);

    expect(await screen.findByLabelText('Email address')).toBeInTheDocument();
  });

  it('lets a signed-in visitor straight in, with no code emailed', async () => {
    const fetchMock = routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in', fromLogin: true } },
    });
    render(<HelpdeskPage />);

    expect(await screen.findByText(/You are signed in as asha@nitj.ac.in/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
    // The one thing that must not have happened: a code asked for anyway.
    expect(fetchMock.mock.calls.some(([url]) => String(url) === `${API}/code`)).toBe(false);
  });

  it('falls back to the address form when the session probe finds nobody', async () => {
    routeFetch({ '/menu': { body: { menu: MENU } }, '/session': { ok: false, status: 401, body: {} } });
    render(<HelpdeskPage />);

    expect(await screen.findByLabelText('Email address')).toBeInTheDocument();
    expect(screen.queryByText(/You are signed in as/)).not.toBeInTheDocument();
  });
});

describe('the footer', () => {
  /* The address is not printed anywhere, at any stage. A mailbox on the page
     collects the questions the page answers in seconds; the XCEED team card
     sends the same message with the module and the account state attached. */
  it('never prints a support address, before or after verification', async () => {
    routeFetch({
      ...GATE,
      '/code': { body: { message: 'A six-digit code has been sent to asha@nitj.ac.in.' } },
      '/verify': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in' } },
    });
    const user = userEvent.setup();
    render(<HelpdeskPage />);

    await screen.findByLabelText('Email address');
    expect(document.body.textContent).not.toMatch(/xceedsupport/i);
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();

    await verifyAddress(user);

    await screen.findByText(/asha@nitj.ac.in is verified/);
    expect(document.body.textContent).not.toMatch(/xceedsupport/i);
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  /* Naming the question and leaving the reader to find it again in the list is
     the friction that ends in a support email instead. */
  it('links straight to the question that reaches a person', async () => {
    routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in' } },
      '/topic/ask-a-human': {
        body: { answer: { id: 'ask-a-human', title: 'Ask the XCEED team', blocks: [], actions: [], followUps: [] } },
      },
    });
    const user = userEvent.setup();
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    await user.click(screen.getByRole('button', { name: /Send your question to the XCEED team/ }));

    expect(await screen.findByText('Ask the XCEED team')).toBeInTheDocument();
  });

  // Nobody is on a rota: it is a student team, and the wait is real.
  it('says who answers it and how long that takes', async () => {
    routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in' } },
    });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    expect(document.body.textContent).toMatch(/student team/i);
    expect(document.body.textContent).toMatch(/questions above first/i);
  });

  it('does not send the reader off to the full guide', async () => {
    routeFetch(GATE);
    render(<HelpdeskPage />);

    await screen.findByLabelText('Email address');
    expect(screen.queryByText(/full guide/i)).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/guide"]')).toBeNull();
  });
});

describe('the question list', () => {
  const enterChat = async () => {
    routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in' } },
      '/topic/no-account': {
        body: { answer: { id: 'no-account', title: 'About your account', blocks: [], actions: [], followUps: [] } },
      },
    });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);
  };

  /* Hiding the questions behind a card asked the visitor to classify their own
     problem before they could see a single question, and a wrong guess cost two
     clicks to discover. They are short and there are not many: showing them all
     lets somebody recognise their problem instead. */
  it('shows every question, under its module, from the start', async () => {
    await enterChat();

    expect(screen.getByText('Account and registration')).toBeInTheDocument();
    expect(screen.getByText('Timetable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Am I registered?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I cannot sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Where is my timetable?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My question is not answered here' })).toBeInTheDocument();
  });

  it('asks the question behind the chip', async () => {
    const user = userEvent.setup();
    await enterChat();

    await user.click(screen.getByRole('button', { name: 'Am I registered?' }));

    expect(await screen.findByText('About your account')).toBeInTheDocument();
  });

  // After an answer the list narrows to where the next question nearly always
  // is — the same module — rather than burying the answer under everything.
  it('narrows to the rest of that module once one is answered', async () => {
    const user = userEvent.setup();
    await enterChat();

    await user.click(screen.getByRole('button', { name: 'Am I registered?' }));
    await screen.findByText('About your account');

    expect(screen.getByRole('button', { name: 'I cannot sign in' })).toBeInTheDocument();
    // Not the one just answered, and not another module's.
    expect(screen.queryByRole('button', { name: 'Am I registered?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Where is my timetable?' })).not.toBeInTheDocument();
  });

  it('widens back out to everything on request', async () => {
    const user = userEvent.setup();
    await enterChat();

    await user.click(screen.getByRole('button', { name: 'Am I registered?' }));
    await screen.findByText('About your account');
    await user.click(screen.getByRole('button', { name: 'Show every question' }));

    expect(await screen.findByRole('button', { name: 'Where is my timetable?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Am I registered?' })).toBeInTheDocument();
  });

  // Conferences has one question; a module with nothing left to offer shows
  // everything rather than an empty heading.
  it('falls back to the full list when the module holds nothing else', async () => {
    const user = userEvent.setup();
    routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in' } },
      '/topic/timetable-search': {
        body: { answer: { id: 'timetable-search', title: 'Finding a timetable', blocks: [], actions: [], followUps: [] } },
      },
    });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    await user.click(screen.getByRole('button', { name: 'Where is my timetable?' }));
    await screen.findByText('Finding a timetable');

    expect(screen.getByRole('button', { name: 'Am I registered?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show every question' })).not.toBeInTheDocument();
  });
});

describe('the question sent to a person', () => {
  it('sends the module, the question and what was already asked', async () => {
    const fetchMock = routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in' } },
      '/topic/ask-a-human': {
        body: {
          answer: {
            id: 'ask-a-human',
            title: 'Ask the XCEED team',
            blocks: [],
            followUps: [],
            actions: [
              {
                id: 'ask-question',
                label: 'Send this to the XCEED team',
                kind: 'primary',
                fields: [
                  { name: 'module', label: 'Which part of XCEED is this about?', type: 'select', required: true, options: ['Timetable'] },
                  { name: 'question', label: 'What is the problem?', type: 'textarea', required: true },
                ],
              },
            ],
          },
        },
      },
      '/action/ask-question': {
        body: { answer: { id: 'action:ask-question', title: 'Sent to the XCEED team', blocks: [], actions: [], followUps: [] } },
      },
    });
    const user = userEvent.setup();
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    await user.click(screen.getByRole('button', { name: 'My question is not answered here' }));

    await user.selectOptions(await screen.findByLabelText(/Which part of XCEED/), 'Timetable');
    await user.type(
      screen.getByLabelText(/What is the problem/),
      'My timetable shows no slots for this semester at all.',
    );
    await user.click(screen.getByRole('button', { name: 'Send this to the XCEED team' }));

    await screen.findByText('Sent to the XCEED team');
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/action/ask-question'));
    const body = JSON.parse(call[1].body);
    expect(body.module).toBe('Timetable');
    expect(body.question).toMatch(/no slots/);
    // The questions already asked travel with it, so the reply does not have to
    // begin by asking what was tried.
    expect(body.context).toMatch(/My question is not answered here/);
  });
});

describe('the manuals', () => {
  const enter = async (extra) => {
    routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in', ...extra } },
    });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);
  };

  /* Staff documents: how to run a class, an event, a timetable. For somebody
     running one they are frequently the whole answer, so they sit above the
     conversation. */
  it('offers the shelf to a member of staff', async () => {
    await enter({ isStaff: true });

    expect(screen.getByRole('navigation', { name: 'Manuals' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Certificates' })).toHaveAttribute('href', '/certificate-manual');
    expect(screen.getByRole('link', { name: 'Quizzes and tests' })).toHaveAttribute('href', '/learning/quizmanual');
  });

  // For a student they are three screens between them and their question.
  it('keeps it away from a student', async () => {
    await enter({ isStaff: false });

    expect(screen.queryByRole('navigation', { name: 'Manuals' })).not.toBeInTheDocument();
  });
});

describe('the counters at the foot of the page', () => {
  const STATS = { people: 1204, sessions: 1560, answered: 4820 };

  it('shows people, sessions and answers', async () => {
    routeFetch({ ...GATE, '/stats': { body: STATS } });
    render(<HelpdeskPage />);

    expect(await screen.findByText('1,204')).toBeInTheDocument();
    expect(screen.getByText('people verified here')).toBeInTheDocument();
    expect(screen.getByText('4,820')).toBeInTheDocument();
  });

  /* A reply missing a field — an older server, a proxy that dropped it — leaves
     the footer off rather than taking the page down on a number that is not
     there. */
  it('stays off rather than crashing on a partial reply', async () => {
    routeFetch({ ...GATE, '/stats': { body: { people: 12 } } });
    render(<HelpdeskPage />);

    await screen.findByLabelText('Email address');
    expect(screen.queryByText('people verified here')).not.toBeInTheDocument();
  });

  it('re-reads them after each answer, so the count it shows includes it', async () => {
    const fetchMock = routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in' } },
      '/stats': { body: STATS },
      '/topic/no-account': {
        body: { answer: { id: 'no-account', title: 'About your account', blocks: [], actions: [], followUps: [] } },
      },
    });
    const user = userEvent.setup();
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);
    const before = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/stats')).length;

    await user.click(screen.getByRole('button', { name: 'Am I registered?' }));
    await screen.findByText('About your account');

    const after = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/stats')).length;
    expect(after).toBeGreaterThan(before);
  });
});

describe('where the page is left scrolled', () => {
  it('brings the newest answer to its own start, not the end of the thread', async () => {
    routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in' } },
    });
    render(<HelpdeskPage />);

    await screen.findByText(/You are signed in as/);

    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    for (const call of Element.prototype.scrollIntoView.mock.calls) {
      expect(call[0]).toMatchObject({ block: 'start' });
    }
  });
});
