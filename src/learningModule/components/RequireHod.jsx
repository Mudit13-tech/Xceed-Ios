import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useOutletContext } from 'react-router-dom';

import lmApi from '../api/lmApi';

/**
 * The gate on the HOD dashboard.
 *
 * Same shape and same reasoning as `RequireLmAdmin` — the server is the
 * boundary (`requireHod` in middleware/lmAuth.js, plus the handler's own
 * department scoping), and this only stops the page from rendering for someone
 * who typed the URL and would get a screen full of 403s.
 *
 * Admits platform admins as well as heads of department, because the same
 * screen serves both: an admin sees the whole installation and an HOD sees
 * their own department, and which one you get is the server's decision, not
 * this component's.
 */
export default function RequireHod() {
  const context = useOutletContext();
  const [state, setState] = useState({ status: 'loading', allowed: false });

  useEffect(() => {
    let cancelled = false;
    lmApi
      .me()
      .then((me) => {
        if (!cancelled) {
          setState({ status: 'ready', allowed: Boolean(me?.isAdmin || me?.isHod) });
        }
      })
      .catch(() => {
        // Signed out, expired token, server down — none of them is an HOD.
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
