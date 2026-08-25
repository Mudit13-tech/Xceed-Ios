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

export const ROLE_DESTINATIONS = {
  ITTC: '/tt/admin',
  DTTI: '/tt/dashboard',
  CM: '/cm/dashboard',
  admin: '/superadmin',
  EO: '/cf/dashboard',
  FACULTY: '/learning',
  'iams-admin': '/iams-admin',
  'iams-dept-admin': '/dept-admin/dashboard',
  STUDENT: '/learning',
  'lm-admin': '/learning/lm-admin',
  'learning-teacher': '/learning',
  'learning-student': '/learning',
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

/**
 * Returns the target URL for a user with a single confirmed role.
 */
export const singleRoleTarget = (role, user) => {
  const emailOrName = (user?.name || user?.email || '').toLowerCase();
  if (emailOrName === 'coe@nitj.ac.in') return '/tt/coe/facultyload';
  if (!role) return '#';
  if (ROLE_DESTINATIONS[role]) return ROLE_DESTINATIONS[role];
  const lower = String(role).toLowerCase();
  const matchedKey = Object.keys(ROLE_DESTINATIONS).find(
    (k) => k.toLowerCase() === lower,
  );
  return matchedKey ? ROLE_DESTINATIONS[matchedKey] : '#';
};

/**
 * Resolves the immediate landing page for a user object: single-role users go
 * straight to their respective module dashboard (e.g. /learning for students),
 * while multi-role users go to /userroles to choose.
 */
export const defaultTargetForUser = (user) => {
  if (!user) return '/userroles';
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

