import React from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import getEnvironment from '../getenvironment';
import NotFound from '../pages/NotFound.jsx';

/**
 * The platform-admin gate for /superadmin and /usermanagement.
 *
 * Not the security boundary — every endpoint those consoles call is already
 * behind `checkRole(['admin'])` on the server, and that is what actually stops
 * a student reading anything. This is the other half: without it the pages
 * still *rendered* for anyone who typed the URL, filled themselves with 401s
 * and left an admin console on screen for an account that has no business
 * seeing one exists.
 *
 * A refusal is rendered as the ordinary 404 rather than a "forbidden" screen,
 * so the answer a non-admin gets is the same one they would get for a URL that
 * was never a route: the page does not exist, and they are sent home. Telling
 * them it exists but is barred is a map of the admin surface for free.
 */

// `admin` exactly — not a substring test. `lm-admin` and `iams-admin` are
// module and department administrators and are deliberately not this, the same
// distinction the server draws in devApplicationController's `isSuperAdmin`.
export const isPlatformAdmin = (role) =>
  (Array.isArray(role) ? role : [role])
    .filter(Boolean)
    .some((value) => String(value).toLowerCase() === 'admin');

export default function RequireAdmin() {
  const apiUrl = getEnvironment();

  /* The same key and shape Navbar already fetches under, so this shares its
     cache instead of asking a second time — the navbar is mounted on every one
     of these pages, so the answer is normally in hand before the route renders. */
  const { data, isPending } = useQuery({
    queryKey: ['user', 'details'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/user/getuser/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch user details');
      return response.json();
    },
    retry: false,
  });

  // Nothing is rendered while the role is unknown. Defaulting the other way
  // would show the console first and take it away afterwards, which is the one
  // outcome this component exists to prevent.
  if (isPending) return null;

  // A failed lookup — signed out, expired token, server down — is not an admin.
  if (!isPlatformAdmin(data?.user?.role)) return <NotFound />;

  return <Outlet />;
}
