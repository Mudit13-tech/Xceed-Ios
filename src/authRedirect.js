// Signing in normally lands a user on /userroles, but when they arrived at the
// login page because a gate bounced them off a page they actually wanted, that
// page is where they expect to end up. The gates stash the interrupted location
// in the login URL rather than in router state, so it survives the full page
// reload the login form performs after authenticating.

export const REDIRECT_PARAM = 'redirect';

// Only same-origin paths are honoured: `//evil.com` and `/\evil.com` are read
// by browsers as protocol-relative URLs, so letting either through would turn
// the login page into an open redirect.
const isInternalPath = (path) =>
  typeof path === 'string' &&
  path.startsWith('/') &&
  !path.startsWith('//') &&
  !path.startsWith('/\\');

// Where the user would end up after signing in anyway — carrying these adds a
// query string for no benefit. (The login page itself is handled separately
// below, because it may already carry a destination worth keeping.)
const NOT_WORTH_RETURNING_TO = ['/', '/userroles', '/learning', '/learning/'];

/**
 * The login URL to send an unauthenticated visitor to, remembering where they
 * were. Pass the `useLocation()` object (or `window.location`).
 */
export const loginPathFor = (location) => {
  if (!location) return '/login';
  const { pathname = '', search = '', hash = '' } = location;
  // Already on the login page. More than one gate can fire for a single page —
  // the platform navbar redirects as soon as its session check fails, while a
  // request the page had already sent 401s a moment later and redirects again.
  // That straggler must not replace the login URL with a bare one, or the
  // destination the first gate recorded is lost.
  if (pathname === '/login') return `/login${search}`;
  if (NOT_WORTH_RETURNING_TO.includes(pathname)) return '/login';
  const from = `${pathname}${search}${hash}`;
  if (!isInternalPath(from)) return '/login';
  return `/login?${REDIRECT_PARAM}=${encodeURIComponent(from)}`;
};

export const EXCLUDED_ROLES = [
  'reviewer',
  'author',
  'editor',
  'prm',
  'doctor',
  'patient',
  'dm-admin',
];

// `email` is an array on the user schema and `name` is optional, so neither can
// be lowercased directly: an account with no name would throw on `.toLowerCase`
// and take the click handler down with it, leaving the role card doing nothing.
const identifiers = (user) => {
  const values = [user?.name, ...(Array.isArray(user?.email) ? user.email : [user?.email])];
  return values.filter((v) => typeof v === 'string' && v).map((v) => v.toLowerCase());
};

/**
 * Returns the target URL for a user with a single confirmed role.
 *
 * The exact role-to-route map is supplied by the authenticated server response
 * rather than hardcoded into the public client bundle. That keeps sensitive
 * admin paths out of the JavaScript shipped to every visitor while still letting
 * the currently signed-in user land on their own workspace.
 */
const roleTargets = (user) => {
  const source = user?.roleTargets || user?.dashboardRoutes || user?.routeMap || {};
  return typeof source === 'object' && source !== null ? source : {};
};

export const singleRoleTarget = (role, user) => {
  if (identifiers(user).includes('coe@nitj.ac.in')) return '/tt/coe/facultyload';
  if (!role) return '#';

  const targets = roleTargets(user);
  const direct = [
    String(role),
    String(role).toLowerCase(),
    String(role).toUpperCase(),
  ].find((key) => targets[key]);
  if (direct) return targets[direct];

  if (user?.landingPath && Array.isArray(user?.role) && user.role.length === 1) {
    return user.landingPath;
  }

  const lower = String(role).toLowerCase();
  if (['student', 'faculty', 'learning-teacher', 'learning-student'].includes(lower)) {
    return '/learning';
  }
  return '#';
};

/**
 * A head who reaches BOTH dashboards through the bare `HOD` appointment.
 *
 * `HOD` on its own has always opened the Learning dashboard AND the iLEED one,
 * so such an account has two destinations even though it holds one role. Every
 * "this account has only one role, skip the picker" shortcut has to know that,
 * or it drops a head onto one of their two screens and hides the other — which
 * is how a head comes to report that their cards never appear.
 *
 * False once either named role is held: the account then has exactly the
 * destinations its roles name, and the ordinary counting is right.
 * Mirrors `hasUnnamedHodDashboards` in server/src/services/departmentHeads.js.
 */
export const hasUnnamedHodDashboards = (roles) => {
  const held = (Array.isArray(roles) ? roles : [roles])
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase());
  return held.includes('hod')
    && !held.includes('hod-learning')
    && !held.includes('hod-ileed');
};

/**
 * A head who reaches the timetable dashboard through the `HOD` appointment.
 *
 * Unconditional where `hasUnnamedHodDashboards` is not, and for the dean's
 * reason rather than the head's: splitting `HOD` into `hod-learning` and
 * `hod-ileed` was about those two screens, and neither half was ever a way of
 * withdrawing the timetable view — it did not exist then. So every account
 * holding the appointment has this destination on top of whatever its named
 * roles give it.
 *
 * Which means a head holding `HOD` and one named role has TWO destinations
 * while holding, as far as the cards are concerned, one role — and the
 * "only one role, skip the picker" shortcut would drop them on the named one
 * and hide this card completely.
 */
export const hasTimetableHodDashboard = (roles) =>
  (Array.isArray(roles) ? roles : [roles])
    .filter(Boolean)
    .some((role) => String(role).trim().toLowerCase() === 'hod');

/**
 * A dean who reaches BOTH dashboards through the one role they hold.
 *
 * `DEAN` opens the Learning dean dashboard and the iLEED one, so such an
 * account has two destinations even though it holds a single role — and every
 * "this account has only one role, skip the picker" shortcut has to know that,
 * or it drops a dean onto one of their two screens and hides the other.
 *
 * Unconditional where `hasUnnamedHodDashboards` is not: a head stops having two
 * destinations once an administrator takes one of the named roles away, but
 * there are no named dean roles to take — what an administrator withdraws from
 * a dean is the menus behind the screen, not the screen.
 *
 * Mirrors `hasDeanDashboards` in server/src/services/deans.js.
 */
export const hasDeanDashboards = (roles) =>
  (Array.isArray(roles) ? roles : [roles])
    .filter(Boolean)
    .some((role) => String(role).trim().toLowerCase() === 'dean');

/**
 * Resolves the immediate landing page for a user object: single-role users go
 * straight to their respective module dashboard (e.g. /learning for students),
 * while multi-role users go to /userroles to choose.
 */
export const defaultTargetForUser = (user) => {
  if (!user) return '/userroles';
  // Before `landingPath` is trusted: a server that predates the two named
  // roles still answers a bare head with one of their two dashboards, and
  // honouring it here would skip the picker that shows the other.
  if (hasUnnamedHodDashboards(user.role)) return '/userroles';
  // And any head at all, named roles or not: the timetable card is theirs on
  // the appointment alone, so there is always a second destination.
  if (hasTimetableHodDashboard(user.role)) return '/userroles';
  // And the dean, for the same reason: one role, two dashboards.
  if (hasDeanDashboards(user.role)) return '/userroles';
  if (typeof user.landingPath === 'string' && user.landingPath.startsWith('/')) {
    return user.landingPath;
  }
  const rawRoles = Array.isArray(user.role)
    ? user.role
    : user.role
    ? [user.role]
    : [];
  const activeRoles = rawRoles.filter(
    (r) => r && !EXCLUDED_ROLES.includes(String(r).toLowerCase()),
  );
  if (activeRoles.length === 1) {
    const target = singleRoleTarget(activeRoles[0], user);
    if (target && target !== '#') return target;
  }
  return '/userroles';
};

/**
 * Where to go once login succeeds: the remembered page if there is a safe one,
 * or the user's role-based landing destination (e.g. /learning for students),
 * otherwise the roles picker.
 */
export const redirectTargetFrom = (search, userOrFallback = '/userroles') => {
  const raw = new URLSearchParams(search || '').get(REDIRECT_PARAM);
  if (raw && isInternalPath(raw)) return raw;

  if (typeof userOrFallback === 'object' && userOrFallback !== null) {
    return defaultTargetForUser(userOrFallback);
  }
  if (typeof userOrFallback === 'string') {
    return userOrFallback;
  }
  return '/userroles';
};

