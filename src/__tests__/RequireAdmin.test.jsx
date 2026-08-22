import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RequireAdmin, { isPlatformAdmin } from '../components/RequireAdmin.jsx';

/**
 * The gate on /superadmin and /usermanagement.
 *
 * Not the security boundary — the server's `checkRole(['admin'])` is — but the
 * thing that decides whether an account with no business there gets a 404 and a
 * trip home, or an admin console full of failed requests.
 */

// The real one pulls in lottie and a 200 KB animation; the gate's behaviour is
// what is under test, not what a 404 looks like.
vi.mock('../pages/NotFound.jsx', () => ({
  default: () => <div>page does not exist</div>,
}));

const respondWith = (payload, ok = true) => {
  global.fetch = vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(payload) }));
};

// A fresh client per test, or one test's cached role answers the next.
const renderAt = (path) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/superadmin" element={<RequireAdmin />}>
            <Route index element={<div>super admin console</div>} />
          </Route>
          <Route path="/usermanagement" element={<RequireAdmin />}>
            <Route index element={<div>user management</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('<RequireAdmin />', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the console for a platform admin', async () => {
    respondWith({ user: { role: ['admin'] } });
    renderAt('/superadmin');
    expect(await screen.findByText('super admin console')).toBeInTheDocument();
  });

  it('tells a student the page does not exist', async () => {
    respondWith({ user: { role: ['STUDENT'] } });
    renderAt('/superadmin');
    expect(await screen.findByText('page does not exist')).toBeInTheDocument();
    expect(screen.queryByText('super admin console')).not.toBeInTheDocument();
  });

  it('guards /usermanagement the same way', async () => {
    respondWith({ user: { role: ['FACULTY'] } });
    renderAt('/usermanagement');
    expect(await screen.findByText('page does not exist')).toBeInTheDocument();
    expect(screen.queryByText('user management')).not.toBeInTheDocument();
  });

  it('never renders the console while the role is still unknown', () => {
    // Deliberately never resolves. Defaulting to "allowed" until the answer
    // arrives would show the console and take it away again, which is the one
    // outcome this component exists to prevent.
    global.fetch = vi.fn(() => new Promise(() => {}));
    const { container } = renderAt('/superadmin');
    expect(container.innerHTML).not.toContain('super admin console');
  });

  it('treats a failed lookup as not-an-admin', async () => {
    // Signed out, expired token, server down — none of them are an admin.
    respondWith({}, false);
    renderAt('/superadmin');
    expect(await screen.findByText('page does not exist')).toBeInTheDocument();
  });
});

describe('isPlatformAdmin', () => {
  it('accepts the admin role in any case, alone or alongside others', () => {
    expect(isPlatformAdmin(['admin'])).toBe(true);
    expect(isPlatformAdmin(['FACULTY', 'Admin'])).toBe(true);
    expect(isPlatformAdmin('admin')).toBe(true);
  });

  it('does not mistake a module admin for a platform admin', () => {
    // `lm-admin` and `iams-admin` administer one module and one department;
    // matching them here would hand both consoles to every one of them. The
    // server draws the same line in devApplicationController's isSuperAdmin.
    expect(isPlatformAdmin(['lm-admin'])).toBe(false);
    expect(isPlatformAdmin(['iams-admin', 'iams-dept-admin'])).toBe(false);
    expect(isPlatformAdmin(['ITTC'])).toBe(false);
  });

  it('treats a missing or empty role as not-an-admin', () => {
    expect(isPlatformAdmin(undefined)).toBe(false);
    expect(isPlatformAdmin([])).toBe(false);
    expect(isPlatformAdmin([null])).toBe(false);
  });
});
