import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useOutletContext } from 'react-router-dom';

import lmApi from '../api/lmApi';

/**
 * The administrator gate on the module's `lm-admin` pages.
 *
 * Not the security boundary — every endpoint these consoles call is behind
 * `requirePlatformAdmin` and its handler's own check, and that is what actually
 * stops a student reading anything. This is the other half: without it the pages
 * still *rendered* for anyone who typed the URL, filled themselves with 403s,
 * and left a faculty-provisioning console on screen for an account with no
 * business knowing one exists. The navigation rail already hides these items;
 * this closes the direct-URL path it cannot cover.
 *
 * Deliberately not the platform-wide `components/RequireAdmin`, which tests for
 * `admin` exactly. This module's administrators are `admin` *and* `lm-admin` —
 * so rather than restate that list here and let the two drift, the answer is
 * taken from `isAdmin` on `/me`, which the server computes from the same
 * `PLATFORM_ADMIN_ROLES` the route guard uses.
 *
 * A refusal goes to the module's home, which is where an unrecognised
 * `/learning/*` URL already lands — so a non-admin gets the answer they would
 * get for a route that never existed, rather than a "forbidden" screen that
 * confirms the surface is there.
 */
export default function RequireLmAdmin() {
  // Forwarded so the pages below keep the shell's context. It is deliberately
  // not what the check reads: LearningLayout renders its Outlet before `me`
  // arrives, so gating on the context's `me` would bounce a real administrator
  // on the first render, every time.
  const context = useOutletContext();
  const [state, setState] = useState({ status: 'loading', isAdmin: false });

  useEffect(() => {
    let cancelled = false;
    lmApi
      .me()
      .then((me) => {
        if (!cancelled) setState({ status: 'ready', isAdmin: Boolean(me?.isAdmin) });
      })
      .catch(() => {
        // Signed out, expired token, server down — none of them is an admin.
        if (!cancelled) setState({ status: 'ready', isAdmin: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing renders while the role is unknown. Defaulting the other way would
  // show the console first and take it away afterwards, which is the one
  // outcome this component exists to prevent.
  if (state.status === 'loading') return null;
  if (!state.isAdmin) return <Navigate to="/learning" replace />;

  return <Outlet context={context} />;
}
