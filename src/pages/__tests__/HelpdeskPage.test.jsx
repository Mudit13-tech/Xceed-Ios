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

/* Enough questions that the search box appears and a module overflows its cap
   — the two behaviours that only exist above a threshold, and would otherwise
   be tested on a menu too small to have them. */
const BIG_MENU = [
  {
    category: 'Learning module',
    topics: Array.from({ length: 11 }, (_, index) => ({
      id: `lm-${index}`,
      question: `Learning question ${index}`,
    })),
  },
  {
    category: 'Attendance',
    topics: [
      { id: 'roll-number', question: 'My roll number is wrong' },
      { id: 'attendance-missing', question: 'My attendance is missing' },
    ],
  },
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

describe('the gate and a personal address', () => {
  /**
   * The help desk stays open to addresses with no account — "nobody has made me
   * an account" is the question it exists to answer — so a personal address is
   * asked about rather than refused. The server answers the first request with
   * a 409 carrying the question; the confirmed retry gets the code.
   */
  const gateWithConfirmation = () => {
    let codeCalls = 0;
    const fetchMock = vi.fn((url, options) => {
      const target = String(url);
      if (target.endsWith('/menu')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ menu: MENU }) });
      }
      if (target.endsWith('/session')) {
        return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
      }
      if (target.endsWith('/code')) {
        codeCalls += 1;
        const sent = JSON.parse(options.body);
        /* The server's rule, not a flag-only stand-in: it asks about the domain
           and takes the confirmation as the answer, so a test that reaches the
           code step on an institute address has shown the client added no step
           of its own. */
        const institute = /@(.+\.)?nitj\.ac\.in$/.test(sent.email.toLowerCase());
        if (!institute && !sent.confirmNonInstitute) {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: () =>
              Promise.resolve({
                message: `${sent.email} is not an institute address. Are you sure you want to continue with ${sent.email}?`,
                confirmNonInstitute: true,
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ message: `A six-digit code has been sent to ${sent.email}.` }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    return { fetchMock, codeCalls: () => codeCalls };
  };

  it('asks before sending a code to a personal address, and sends it once confirmed', async () => {
    gateWithConfirmation();
    const user = userEvent.setup();
    render(<HelpdeskPage />);

    await user.type(await screen.findByLabelText('Email address'), 'asha@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Send me a code' }));

    // The question, and — the point of it — no way to press past it by reflex.
    expect(await screen.findByText(/are you sure you want to continue/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send me a code' })).not.toBeInTheDocument();
    // Still on the address step until they answer.
    expect(screen.queryByLabelText('Six-digit code')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes, send the code anyway' }));
    expect(await screen.findByLabelText('Six-digit code')).toBeInTheDocument();
  });

  it('shows the question as a question, not as an error', async () => {
    gateWithConfirmation();
    const user = userEvent.setup();
    const { container } = render(<HelpdeskPage />);

    await user.type(await screen.findByLabelText('Email address'), 'asha@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Send me a code' }));

    await screen.findByText(/are you sure you want to continue/i);
    // `call` throws on any non-2xx, so the 409 arrives down the error path; it
    // must not land in the red box, which reads as a refusal.
    expect(container.querySelector('.hd-error')).toBeNull();
    expect(container.querySelector('.hd-confirm')).not.toBeNull();
  });

  it('takes the question back when the address is edited', async () => {
    gateWithConfirmation();
    const user = userEvent.setup();
    render(<HelpdeskPage />);

    const field = await screen.findByLabelText('Email address');
    await user.type(field, 'asha@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Send me a code' }));
    await screen.findByText(/are you sure you want to continue/i);

    // A "yes" standing over from the old address would let a typo the person is
    // in the middle of fixing through unasked.
    await user.type(field, 'x');
    await waitFor(() =>
      expect(screen.queryByText(/are you sure you want to continue/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Send me a code' })).toBeInTheDocument();
  });

  it('never asks about an institute address', async () => {
    const { fetchMock } = gateWithConfirmation();
    const user = userEvent.setup();
    render(<HelpdeskPage />);

    await user.type(await screen.findByLabelText('Email address'), 'asha@nitj.ac.in');
    await user.click(screen.getByRole('button', { name: 'Send me a code' }));

    // The mock applies the server's own rule, so reaching the code step in one
    // press is the assertion: an ordinary address collects no extra step on the
    // way through, and the request carries no confirmation it was never asked
    // for.
    expect(await screen.findByLabelText('Six-digit code')).toBeInTheDocument();
    const codeCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/code'));
    expect(JSON.parse(codeCall[1].body)).toEqual({ email: 'asha@nitj.ac.in' });
  });
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

/**
 * How often each question has been asked, shown to administrators.
 *
 * The number already ordered the menu; this shows it as a number. What is
 * worth holding is that it is the *administrator's* view and nothing else's:
 * the counts route is gated, and the page treats a refusal as "not an
 * administrator" rather than asking anybody what they are. So a visitor sees
 * exactly the page they always saw.
 */
describe('the ask counts', () => {
  const signedIn = (extra = {}) => ({
    '/menu': { body: { menu: MENU } },
    '/session': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in' } },
    ...extra,
  });

  it('shows the count beside each question for an administrator', async () => {
    routeFetch(signedIn({
      '/topic-counts': { body: { counts: { 'no-account': 31, 'cannot-sign-in': 4 }, total: 35 } },
    }));
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    const chip = await screen.findByRole('button', { name: 'Am I registered?' });
    expect(chip).toHaveTextContent('31');
    expect(screen.getByRole('button', { name: 'I cannot sign in' })).toHaveTextContent('4');
  });

  it('says nought for a question nobody has asked yet', async () => {
    routeFetch(signedIn({
      '/topic-counts': { body: { counts: { 'no-account': 31 }, total: 31 } },
    }));
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    const chip = await screen.findByRole('button', { name: 'I cannot sign in' });
    expect(chip).toHaveTextContent('0');
  });

  /* The count is a note on the button, not part of what the button is called.
     Folding it into the name makes every chip read "Am I registered? 31",
     which is worse for the administrator too — they navigate by the question
     like anybody else. */
  it('leaves the question as the name of the button', async () => {
    routeFetch(signedIn({
      '/topic-counts': { body: { counts: { 'no-account': 31 }, total: 31 } },
    }));
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    const chip = await screen.findByRole('button', { name: 'Am I registered?' });
    expect(chip).toHaveAttribute('title', expect.stringContaining('31'));
  });

  it('shows nothing at all when the counts route refuses', async () => {
    routeFetch(signedIn({ '/topic-counts': { ok: false, status: 403, body: {} } }));
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    const chip = await screen.findByRole('button', { name: 'Am I registered?' });
    expect(chip).toHaveTextContent('Am I registered?');
    expect(chip.textContent).toBe('Am I registered?');
    expect(chip).not.toHaveAttribute('title');
  });

  /* A 200 carrying something else — a proxy's error page, a stub — is not an
     administrator's counts, and treating it as one would draw a nought beside
     every question for a visitor who is not one. */
  it('shows nothing when a 200 carries no counts', async () => {
    routeFetch(signedIn({ '/topic-counts': { body: { something: 'else' } } }));
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    const chip = await screen.findByRole('button', { name: 'Am I registered?' });
    expect(chip.textContent).toBe('Am I registered?');
  });
});

/**
 * Finding a question among forty-one of them.
 *
 * The page answers by menu rather than by text box on purpose — every answer
 * is written and checked, and a box that takes a question invites the ones it
 * cannot answer. Searching the *menu* is not that: it filters titles and
 * nothing else, which is the difference between finding your question and
 * reading all of them.
 */
describe('searching the questions', () => {
  const big = (extra = {}) => ({
    '/menu': { body: { menu: BIG_MENU } },
    '/session': { body: { pass: 'pass-1', email: 'asha@nitj.ac.in' } },
    ...extra,
  });

  it('offers a search box once there are enough questions to need one', async () => {
    routeFetch(big());
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    expect(await screen.findByLabelText(/search the questions/i)).toBeInTheDocument();
  });

  it('does not offer one for a menu small enough to read', async () => {
    routeFetch({ '/menu': { body: { menu: MENU } }, '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } } });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    expect(screen.queryByLabelText(/search the questions/i)).not.toBeInTheDocument();
  });

  /* Somebody typing "roll number" does not know whether that lives under
     Attendance or the Learning module — that is why they are typing. */
  it('searches across every module, not the open one', async () => {
    const user = userEvent.setup();
    routeFetch(big());
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    await user.type(screen.getByLabelText(/search the questions/i), 'roll');

    expect(await screen.findByRole('button', { name: 'My roll number is wrong' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Learning question 0' })).not.toBeInTheDocument();
  });

  it('matches all the words in any order', async () => {
    const user = userEvent.setup();
    routeFetch(big());
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    await user.type(screen.getByLabelText(/search the questions/i), 'wrong roll');

    expect(await screen.findByRole('button', { name: 'My roll number is wrong' })).toBeInTheDocument();
  });

  /* A dead end is where this page loses people, so the empty state points at
     the way out rather than just saying there is nothing. */
  it('says so, usefully, when nothing matches', async () => {
    const user = userEvent.setup();
    routeFetch(big());
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    await user.type(screen.getByLabelText(/search the questions/i), 'zzzz');

    expect(await screen.findByText(/nothing matches/i)).toBeInTheDocument();
    expect(screen.getByText(/sends your question to a person/i)).toBeInTheDocument();
  });

  it('clears itself when a question is asked, so the answer is not buried', async () => {
    const user = userEvent.setup();
    routeFetch(big({
      '/topic/roll-number': {
        body: { answer: { id: 'roll-number', title: 'Roll numbers', blocks: [], actions: [], followUps: [] } },
      },
    }));
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    const box = screen.getByLabelText(/search the questions/i);
    await user.type(box, 'roll');
    await user.click(await screen.findByRole('button', { name: 'My roll number is wrong' }));
    await screen.findByText('Roll numbers');

    expect(box).toHaveValue('');
  });
});

/**
 * A module with fifteen questions in it.
 *
 * The modules are lopsided — fifteen under the Learning module, one under
 * Conferences — and every question of every module at once is a wall. The menu
 * arrives ordered most-asked-first, so showing the first few and offering the
 * rest hides what nobody asks rather than an arbitrary tail.
 */
describe('a module with more questions than fit', () => {
  it('shows the most-asked few and offers the rest', async () => {
    routeFetch({
      '/menu': { body: { menu: BIG_MENU } },
      '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } },
    });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    expect(await screen.findByRole('button', { name: 'Learning question 0' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Learning question 10' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 more/ })).toBeInTheDocument();
  });

  it('shows them all on request', async () => {
    const user = userEvent.setup();
    routeFetch({
      '/menu': { body: { menu: BIG_MENU } },
      '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } },
    });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    await user.click(await screen.findByRole('button', { name: /3 more/ }));

    expect(screen.getByRole('button', { name: 'Learning question 10' })).toBeInTheDocument();
  });

  /* A module that fits keeps every question on screen. */
  it('leaves a small module alone', async () => {
    routeFetch({
      '/menu': { body: { menu: BIG_MENU } },
      '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } },
    });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    expect(await screen.findByRole('button', { name: 'My roll number is wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My attendance is missing' })).toBeInTheDocument();
  });
});

/**
 * A link straight to one answer.
 *
 * A support reply, a mail or the manual can now point at the answer rather
 * than at "go to the help desk and look for". The link arrives before anybody
 * has verified an address, which is the whole reason it has to survive the
 * gate rather than being read once on the way in.
 */
describe('a question named in the URL', () => {
  const withSearch = (search) => {
    const url = new URL(window.location.href);
    url.search = search;
    window.history.replaceState({}, '', url);
  };

  afterEach(() => withSearch(''));

  it('asks it as soon as the gate is open', async () => {
    withSearch('?topic=cannot-sign-in');
    const fetchMock = routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } },
      '/topic/cannot-sign-in': {
        body: { answer: { id: 'cannot-sign-in', title: 'Signing in', blocks: [], actions: [], followUps: [] } },
      },
    });
    render(<HelpdeskPage />);

    /* Three requests deep: the session opens the gate, the menu turns the id
       into a question, and only then is the answer asked for. The default
       one-second wait is tight for that chain under a loaded suite. */
    /* Waited for on the request rather than on the rendered answer. The deep
       link's contract is that the page asks the question by itself; that the
       answer then renders is the ordinary answer path every other test here
       covers. Polling the DOM for it instead makes this assertion depend on
       when React flushes three chained fetches, which is not what is under
       test and is not stable across a loaded suite. */
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/topic/cannot-sign-in'))).toBe(true),
    );
    expect(await screen.findByText('Signing in', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  /* A stale link in an old mail should land somebody on the help desk, which
     is useful — not on a complaint about a link they did not write. */
  it('ignores an id that is not a question, in silence', async () => {
    withSearch('?topic=this-never-existed');
    routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } },
    });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    expect(screen.queryByText(/did not work/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Am I registered?' })).toBeInTheDocument();
  });

  it('asks it once, not on every render', async () => {
    withSearch('?topic=cannot-sign-in');
    const fetchMock = routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } },
      '/topic/cannot-sign-in': {
        body: { answer: { id: 'cannot-sign-in', title: 'Signing in', blocks: [], actions: [], followUps: [] } },
      },
    });
    render(<HelpdeskPage />);
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/topic/cannot-sign-in'))).toBe(true),
    );

    const asks = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/topic/cannot-sign-in'));
    expect(asks).toHaveLength(1);
  });
});

/**
 * Whether the answer helped.
 *
 * The count says an answer is popular; this says whether it works, and the gap
 * between the two is the work queue.
 */
describe('rating an answer', () => {
  const answered = (extra = {}) => ({
    '/menu': { body: { menu: MENU } },
    '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } },
    '/topic/no-account': {
      body: { answer: { id: 'no-account', title: 'About your account', blocks: [], actions: [], followUps: [] } },
    },
    ...extra,
  });

  const ask = async (user) => {
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);
    await user.click(screen.getByRole('button', { name: 'Am I registered?' }));
    await screen.findByText('About your account');
  };

  it('asks after an answer', async () => {
    const user = userEvent.setup();
    routeFetch(answered());
    await ask(user);

    expect(screen.getByText(/did this answer help/i)).toBeInTheDocument();
  });

  it('sends the rating with the question it is about', async () => {
    const user = userEvent.setup();
    const fetchMock = routeFetch(answered({ '/action/rate-answer': { body: {} } }));
    await ask(user);

    await user.click(screen.getByRole('button', { name: 'Yes' }));

    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/action/rate-answer'));
    expect(call).toBeDefined();
    expect(JSON.parse(call[1].body)).toEqual({ topicId: 'no-account', helpful: true });
  });

  it('distinguishes a no from a yes', async () => {
    const user = userEvent.setup();
    const fetchMock = routeFetch(answered({ '/action/rate-answer': { body: {} } }));
    await ask(user);

    await user.click(screen.getByRole('button', { name: 'No' }));

    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/action/rate-answer'));
    expect(JSON.parse(call[1].body).helpful).toBe(false);
  });

  /* The press has to be visibly received, or it gets pressed again. */
  it('thanks the reader and stops asking', async () => {
    const user = userEvent.setup();
    routeFetch(answered({ '/action/rate-answer': { body: {} } }));
    await ask(user);

    await user.click(screen.getByRole('button', { name: 'Yes' }));

    expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument();
  });

  /* The visitor did their part. A rating that did not record is the page's
     problem, not something to report back as their failure. */
  it('says nothing when the rating cannot be sent', async () => {
    const user = userEvent.setup();
    routeFetch(answered({ '/action/rate-answer': { ok: false, status: 500, body: {} } }));
    await ask(user);

    await user.click(screen.getByRole('button', { name: 'Yes' }));

    expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
    expect(screen.queryByText(/did not work/i)).not.toBeInTheDocument();
  });

  /* "Was this helpful?" under "that did not work" is a poor joke. */
  it('does not ask about an error', async () => {
    const user = userEvent.setup();
    routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } },
      '/topic/no-account': { ok: false, status: 500, body: { message: 'boom' } },
    });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    await user.click(screen.getByRole('button', { name: 'Am I registered?' }));
    await screen.findByText('That did not work');

    expect(screen.queryByText(/did this answer help/i)).not.toBeInTheDocument();
  });
});

/**
 * The administrator's report.
 *
 * Behind the same gate as the counts on the chips: the route decides, and a
 * refusal means the page draws nothing.
 */
describe('the insights panel', () => {
  const INSIGHTS = {
    counts: { 'no-account': 300, 'cannot-sign-in': 20 },
    total: 320,
    windowDays: 30,
    recent: { 'no-account': 12 },
    misses: { 'cannot-sign-in': 9 },
    unhelpful: {},
    feedback: { 'no-account': { helpful: 8, notHelpful: 2 } },
    notices: {},
    funnel: { requested: 200, verified: 150, completion: 75 },
  };

  const asAdmin = () => routeFetch({
    '/menu': { body: { menu: MENU } },
    '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } },
    '/topic-counts': { body: INSIGHTS },
  });

  it('is offered to an administrator, folded away', async () => {
    asAdmin();
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    expect(await screen.findByRole('button', { name: /how this page is doing/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('is not offered when the counts route refuses', async () => {
    routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } },
      '/topic-counts': { ok: false, status: 403, body: {} },
    });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);

    expect(screen.queryByRole('button', { name: /how this page is doing/i })).not.toBeInTheDocument();
  });

  it('shows the total, the window and the gate funnel', async () => {
    const user = userEvent.setup();
    asAdmin();
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);
    await user.click(await screen.findByRole('button', { name: /how this page is doing/i }));

    expect(screen.getByText('320')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText(/150 of 200/)).toBeInTheDocument();
  });

  /* The queue: the answer most often read and then abandoned is the one to
     rewrite next, whatever its total. */
  it('puts the answers people gave up on at the top', async () => {
    const user = userEvent.setup();
    asAdmin();
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);
    await user.click(await screen.findByRole('button', { name: /how this page is doing/i }));

    const rows = screen.getAllByRole('row').slice(1); // past the header
    expect(rows[0]).toHaveTextContent('I cannot sign in');
    expect(rows[0]).toHaveTextContent('9');
  });

  it('shows a dash rather than nought when nobody reached the gate', async () => {
    const user = userEvent.setup();
    routeFetch({
      '/menu': { body: { menu: MENU } },
      '/session': { body: { pass: 'p', email: 'a@nitj.ac.in' } },
      '/topic-counts': { body: { ...INSIGHTS, funnel: { requested: 0, verified: 0, completion: null } } },
    });
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);
    await user.click(await screen.findByRole('button', { name: /how this page is doing/i }));

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('says outright that none of it records who asked', async () => {
    const user = userEvent.setup();
    asAdmin();
    render(<HelpdeskPage />);
    await screen.findByText(/You are signed in as/);
    await user.click(await screen.findByRole('button', { name: /how this page is doing/i }));

    expect(screen.getByText(/record who asked/i)).toBeInTheDocument();
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
