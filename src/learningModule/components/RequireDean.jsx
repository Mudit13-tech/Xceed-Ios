import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useOutletContext } from 'react-router-dom';

import lmApi from '../api/lmApi';

/**
 * The gate on the Dean (Academic) dashboard.
 *
 * Same shape and same reasoning as `RequireHod` — the server is the boundary
 * (`requireDean` in middleware/lmAuth.js, plus the handlers' own scoping), and
 * this only stops the page from rendering for someone who typed the URL and
 * would get a screen full of 403s.
 *
 * Admits platform admins alongside the dean, because the same screen serves
 * both: each sees the whole installation, and neither is scoped to a
 * department. It deliberately does *not* admit heads of department — an HOD is
 * scoped to their own department, and letting one through would render an
 * institute-wide heading over a single department's numbers.
 */
export default function RequireDean() {
  const context = useOutletContext();
  const [state, setState] = useState({ status: 'loading', allowed: false });

  useEffect(() => {
    let cancelled = false;
    lmApi
      .me()
      .then((me) => {
        if (!cancelled) {
          setState({ status: 'ready', allowed: Boolean(me?.isAdmin || me?.isDean) });
        }
      })
      .catch(() => {
        // Signed out, expired token, server down — none of them is the dean.
        if (!cancelled) setState({ status: 'ready', allowed: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') return null;
  if (!state.allowed) return <Navigate to="/learning" replace />;

  return <Outlet context={context} />;
}
