import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import NotificationSettingsTab from '../NotificationSettingsTab';

const SETTINGS = {
  enabled: true,
  roles: [
    { role: 'admin', alertTypes: { serverDown: false } },
    { role: 'coordinator', alertTypes: {} },
    { role: 'head', alertTypes: {} },
  ],
  recipients: [{ _id: 'r1', email: 'admin@x.com', role: 'admin' }],
  dailySummaryConfig: { enabled: false, frequency: 'daily', mode: 'all', threshold: 75 },
};

function mockFetchRouter(overrides = {}) {
  global.fetch = vi.fn((url, opts) => {
    const method = opts?.method || 'GET';
    for (const [matcher, handler] of Object.entries(overrides)) {
      if (String(url).includes(matcher)) return handler(url, opts, method);
    }
    if (String(url).includes('/settings/notifications/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ settings: SETTINGS }) });
    }
    if (String(url).includes('/ground-truth/departments')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: [{ dept: 'CSE' }] }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  mockFetchRouter();
});

describe('NotificationSettingsTab', () => {
  it('renders roles and the seeded recipient from the initial GET', async () => {
    renderWithProviders(<NotificationSettingsTab />);
    await waitFor(() => expect(screen.getByText(/notifications enabled/i)).toBeInTheDocument());

    expect(screen.getByText('admin@x.com')).toBeInTheDocument();
    expect(screen.getByText('1 total')).toBeInTheDocument();
  });

  it('toggling a role alert type PUTs the updated alertTypes for that role', async () => {
    const user = userEvent.setup();
    mockFetchRouter({
      '/roles/admin': () =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              settings: { ...SETTINGS, roles: [{ role: 'admin', alertTypes: { serverDown: true } }, ...SETTINGS.roles.slice(1)] },
            }),
        }),
    });
    renderWithProviders(<NotificationSettingsTab />);
    await waitFor(() => expect(screen.getByText(/notifications enabled/i)).toBeInTheDocument());

    const toggle = screen.getAllByTitle('Click to enable')[0];
    await user.click(toggle);

    await waitFor(() => {
      const call = global.fetch.mock.calls.find(([url]) => String(url).includes('/roles/admin'));
      expect(call).toBeDefined();
      const [, opts] = call;
      expect(opts.method).toBe('PUT');
      expect(JSON.parse(opts.body)).toEqual({ alertTypes: { serverDown: true } });
    });
  });

  it('disables Add until an email is entered, and requires a dept for coordinator/head', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationSettingsTab />);
    await waitFor(() => expect(screen.getByText(/notifications enabled/i)).toBeInTheDocument());

    const addButton = screen.getByRole('button', { name: /add$/i });
    expect(addButton).toBeDisabled();

    const emailInput = screen.getByPlaceholderText('email@example.com');
    await user.type(emailInput, 'coord@x.com');
    expect(addButton).not.toBeDisabled();

    // Found by one of its own options rather than by position: the tab has
    // several selects and a new card above this one used to silently retarget
    // this line at the wrong control.
    const roleSelect = screen.getByRole('option', { name: 'Dept Coordinator' }).closest('select');
    await user.selectOptions(roleSelect, 'coordinator');
    await user.click(addButton);

    expect(await screen.findByText(/dept is required/i)).toBeInTheDocument();
  });

  it('shows a server error message when adding a recipient fails', async () => {
    const user = userEvent.setup();
    mockFetchRouter({
      '/recipients': (url, opts, method) =>
        method === 'POST'
          ? Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Recipient already exists' }) })
          : Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    });
    renderWithProviders(<NotificationSettingsTab />);
    await waitFor(() => expect(screen.getByText(/notifications enabled/i)).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('email@example.com'), 'admin@x.com');
    await user.click(screen.getByRole('button', { name: /add$/i }));

    expect(await screen.findByText(/recipient already exists/i)).toBeInTheDocument();
  });

  /* The appointed heads come from the platform mapping, not from the recipients
     list, and are shown here because this page decides who gets mailed — a list
     that leaves them out reads as the whole answer when it is not. */
  it('lists the appointed heads of department, without a Remove button', async () => {
    mockFetchRouter({
      '/settings/notifications/': () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            settings: SETTINGS,
            departmentHeads: [
              { dept: 'CSE', name: 'Dr A Sharma', email: 'cse-head@x.com' },
              { dept: 'ECE', name: 'Dr B Kaur', email: 'ece-head@x.com' },
            ],
          }),
        }),
    });
    renderWithProviders(<NotificationSettingsTab />);
    await waitFor(() => expect(screen.getByText(/notifications enabled/i)).toBeInTheDocument());

    expect(await screen.findByText('cse-head@x.com')).toBeInTheDocument();
    expect(screen.getByText('ece-head@x.com')).toBeInTheDocument();
    expect(screen.getByText('2 mapped')).toBeInTheDocument();

    // The appointment is made on the superadmin screen; there is nothing to
    // remove here, and the one Remove button on the page is the recipient's.
    expect(screen.getAllByRole('button', { name: /^remove$/i })).toHaveLength(1);
  });

  it('says plainly when no department has a head yet', async () => {
    renderWithProviders(<NotificationSettingsTab />);
    await waitFor(() => expect(screen.getByText(/notifications enabled/i)).toBeInTheDocument());

    expect(screen.getByText(/no department has a head assigned yet/i)).toBeInTheDocument();
  });
});
