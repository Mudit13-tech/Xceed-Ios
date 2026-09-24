import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import UserManagementPage from '../userManagement';

/**
 * User management, after the screen stopped fetching the whole institute.
 *
 * It used to ask for every account in one response and filter the result in
 * the browser, which on a real database is megabytes of JSON — nearly all of
 * it students — rendered as thousands of table rows. The rules that replaced
 * it are the ones worth holding still:
 *
 *  - **Nothing is fetched for a tab nobody opened.** In particular the student
 *    tab, which is the one that would cost the most and is wanted the least.
 *  - **A tab asks for its own role.** Not "everything, then filter" wearing a
 *    new name — the request itself must carry the role.
 *  - **Students are last.** Wherever they land in the counts, their tab sits
 *    at the end of the strip.
 *  - **An account with two roles is listed under both**, because it really is
 *    both things; the server matches the role array and the screen must not
 *    undo that by picking one.
 *  - **Search reaches the server.** Filtering the page on screen would search
 *    the fifty rows that happen to be loaded and quietly miss the rest.
 */

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const ROLE_COUNTS = {
  roles: [
    { role: 'student', label: 'STUDENT', count: 8421 },
    { role: 'faculty', label: 'FACULTY', count: 210 },
    { role: 'admin', label: 'admin', count: 3 },
  ],
  withoutRole: 4,
  total: 8638,
};

const USERS = {
  admin: [
    { _id: 'u1', email: ['ada@nitj.ac.in'], role: ['admin', 'FACULTY'], dept: 'CSE', attendanceDepartments: [] },
  ],
  faculty: [
    { _id: 'u1', email: ['ada@nitj.ac.in'], role: ['admin', 'FACULTY'], dept: 'CSE', attendanceDepartments: [] },
    { _id: 'u2', email: ['grace@nitj.ac.in'], role: ['FACULTY'], dept: 'ECE', attendanceDepartments: [] },
  ],
  student: [
    { _id: 'u3', email: ['rollno@nitj.ac.in'], role: ['STUDENT'], dept: '', attendanceDepartments: [] },
  ],
};

const jsonResponse = (body, ok = true) => ({ ok, statusText: 'OK', json: async () => body });

/** Every /all request the component made, as parsed query strings. */
let listCalls = [];

const installFetch = () => {
  listCalls = [];
  global.fetch = vi.fn(async (url) => {
    if (url.includes('/user/getuser/rolecounts')) return jsonResponse(ROLE_COUNTS);
    if (url.includes('/allsessanddept')) return jsonResponse({ uniqueDept: ['CSE', 'ECE'] });
    if (url.includes('/user/getuser/all')) {
      const params = new URL(url).searchParams;
      listCalls.push(params);
      const role = params.get('role');
      const search = params.get('search');
      let rows = role ? USERS[role.toLowerCase()] || [] : Object.values(USERS).flat();
      if (search) {
        rows = rows.filter((u) => u.email.join(' ').includes(search));
      }
      return jsonResponse({ user: rows, page: 1, limit: 50, hasMore: false });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
};

const open = async () => {
  render(
    <ChakraProvider>
      <MemoryRouter>
        <UserManagementPage />
      </MemoryRouter>
    </ChakraProvider>,
  );
  await screen.findByRole('tab', { name: /faculty/i });
};

/** The per-row "Add Role" select. */
const addRoleSelect = () =>
  screen
    .getAllByRole('combobox')
    .find((candidate) =>
      Array.from(candidate.options).some((o) => o.textContent === 'Select role'));

const tabNames = () =>
  screen.getAllByRole('tab').map((tab) => tab.textContent.replace(/\d+$/, '').trim());

beforeEach(() => {
  vi.clearAllMocks();
  installFetch();
});

afterEach(() => {
  delete global.fetch;
});

describe('user management', () => {
  it('shows a tab per role, with students last', async () => {
    await open();
    const names = tabNames();
    expect(names[0]).toMatch(/all users/i);
    expect(names[names.length - 1]).toMatch(/student/i);
    expect(names).toEqual(expect.arrayContaining([
      expect.stringMatching(/admin/i),
      expect.stringMatching(/faculty/i),
      expect.stringMatching(/no role/i),
    ]));
  });

  it('never fetches students until their tab is opened', async () => {
    await open();
    await waitFor(() => expect(listCalls.length).toBeGreaterThan(0));
    expect(listCalls.some((params) => params.get('role') === 'student')).toBe(false);

    await userEvent.click(screen.getByRole('tab', { name: /student/i }));
    await waitFor(() =>
      expect(listCalls.some((params) => params.get('role') === 'student')).toBe(true),
    );
  });

  it('asks the server for one role rather than filtering everything here', async () => {
    await open();
    await userEvent.click(screen.getByRole('tab', { name: /faculty/i }));

    await waitFor(() => {
      const faculty = listCalls.filter((params) => params.get('role') === 'faculty');
      expect(faculty.length).toBeGreaterThan(0);
      expect(faculty[0].get('limit')).toBe('50');
      expect(faculty[0].get('page')).toBe('1');
    });
  });

  it('lists a two-role account under each of its roles', async () => {
    await open();

    await userEvent.click(screen.getByRole('tab', { name: /faculty/i }));
    expect(await screen.findByText('ada@nitj.ac.in')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /^admin/i }));
    expect(await screen.findByText('ada@nitj.ac.in')).toBeInTheDocument();
  });

  it('sends the email search to the server instead of filtering the loaded page', async () => {
    await open();
    await userEvent.type(
      screen.getByPlaceholderText(/search by email/i),
      'grace',
    );

    await waitFor(() => {
      expect(listCalls.some((params) => params.get('search') === 'grace')).toBe(true);
    }, { timeout: 2000 });
  });

  /* The role existed everywhere except here: accounts got it from enrolment
     (accountProvisioning) or the ERP import, so an administrator with somebody
     in front of them had no way to grant it. */
  it('offers Student in the Add Role dropdown', async () => {
    await open();
    await userEvent.click(screen.getByRole('tab', { name: /faculty/i }));
    await screen.findByText('ada@nitj.ac.in');

    const select = addRoleSelect();
    expect(Array.from(select.options).map((o) => o.textContent))
      .toContain('Student');
  });

  /* The casing is the whole trap. Most of the platform folds role case when it
     reads, but the places that decide whether somebody IS a student do not:
     studentRoute's `role.includes("STUDENT")`, the learning module's
     `User.find({ role: "STUDENT" })` roster queries, and the help-desk account
     snapshot are exact matches. A lowercase `student` would assign a role that
     looked right on this screen and was invisible to all of them. */
  it('assigns it spelled STUDENT, which the exact-match readers require', async () => {
    await open();
    await userEvent.click(screen.getByRole('tab', { name: /faculty/i }));
    await screen.findByText('ada@nitj.ac.in');

    const student = Array.from(addRoleSelect().options)
      .find((o) => o.textContent === 'Student');
    expect(student.value).toBe('STUDENT');
  });

  /* Every role in the dropdown is also a tab, ordered by that same list — so
     adding Student to it must not drag the student tab up out of last place. */
  it('keeps the student tab last even though Student is now in the list', async () => {
    await open();
    const names = tabNames();
    expect(names[names.length - 1]).toMatch(/student/i);
  });

  it('counts the whole institute in the header, not the rows on screen', async () => {
    await open();
    expect(await screen.findByText(/8638 users/i)).toBeInTheDocument();
  });

  it('offers Load more only while the server says there is more', async () => {
    await open();
    await waitFor(() => expect(screen.queryByRole('button', { name: /load more/i })).toBeNull());

    global.fetch = vi.fn(async (url) => {
      if (url.includes('/user/getuser/rolecounts')) return jsonResponse(ROLE_COUNTS);
      if (url.includes('/allsessanddept')) return jsonResponse({ uniqueDept: [] });
      return jsonResponse({ user: USERS.faculty, page: 1, limit: 50, hasMore: true });
    });
    await userEvent.click(screen.getByRole('tab', { name: /faculty/i }));

    expect(await screen.findByRole('button', { name: /load more/i })).toBeInTheDocument();
  });
});
