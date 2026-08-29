import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';

/**
 * The client-side gate on the module's lm-admin console.
 *
 * The server is the security boundary — every endpoint behind these pages is
 * gated by `requirePlatformAdmin`. What this covers is the direct-URL path the
 * navigation rail cannot: without it a student who typed /learning/lm-admin/faculty
 * got a faculty-provisioning console rendered around a set of 403s.
 *
 * The load is deliberately asynchronous, so the interesting property is that
 * nothing of the console paints *before* the answer arrives.
 */

const me = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: { me: (...a) => me(...a) },
}));

// A deferred promise, so the "still deciding" frame can be inspected.
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

async function renderGuard() {
  const { default: RequireLmAdmin } = await import('../components/RequireLmAdmin');
  return render(
    <MemoryRouter initialEntries={['/lm-admin/faculty']}>
      <Routes>
        <Route element={<Outlet context={{ me: null }} />}>
          <Route element={<RequireLmAdmin />}>
            <Route path="lm-admin/faculty" element={<div>Faculty console</div>} />
          </Route>
        </Route>
        <Route path="/learning" element={<div>Learning home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

it('renders the console for a platform admin', async () => {
  me.mockResolvedValue({ isAdmin: true });
  await renderGuard();
  expect(await screen.findByText('Faculty console')).toBeInTheDocument();
});

it('sends a non-admin to the module home instead of the console', async () => {
  me.mockResolvedValue({ isAdmin: false });
  await renderGuard();
  expect(await screen.findByText('Learning home')).toBeInTheDocument();
  expect(screen.queryByText('Faculty console')).not.toBeInTheDocument();
});

it('treats a failed lookup as not-an-admin rather than letting the page through', async () => {
  me.mockRejectedValue(new Error('401'));
  await renderGuard();
  expect(await screen.findByText('Learning home')).toBeInTheDocument();
  expect(screen.queryByText('Faculty console')).not.toBeInTheDocument();
});

it('shows nothing at all while the role is still unknown', async () => {
  const gate = deferred();
  me.mockReturnValue(gate.promise);
  await renderGuard();

  // The whole point: no console, and no redirect either — the decision has not
  // been made yet, so neither answer is shown.
  expect(screen.queryByText('Faculty console')).not.toBeInTheDocument();
  expect(screen.queryByText('Learning home')).not.toBeInTheDocument();

  gate.resolve({ isAdmin: true });
  expect(await screen.findByText('Faculty console')).toBeInTheDocument();
});
