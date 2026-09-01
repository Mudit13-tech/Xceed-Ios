import { describe, it, expect } from 'vitest';
import {
  loginPathFor,
  redirectTargetFrom,
  defaultTargetForUser,
  singleRoleTarget,
} from '../authRedirect';

describe('loginPathFor', () => {
  it('remembers the interrupted page, query and hash included', () => {
    const path = loginPathFor({
      pathname: '/learning/c/abc123/grades',
      search: '?tab=late',
      hash: '#row-7',
    });
    expect(path).toBe('/login?redirect=%2Flearning%2Fc%2Fabc123%2Fgrades%3Ftab%3Dlate%23row-7');
  });

  it('adds nothing for pages there is no point returning to', () => {
    expect(loginPathFor({ pathname: '/login', search: '', hash: '' })).toBe('/login');
    expect(loginPathFor({ pathname: '/', search: '', hash: '' })).toBe('/login');
    expect(loginPathFor({ pathname: '/userroles', search: '', hash: '' })).toBe('/login');
    expect(loginPathFor({ pathname: '/learning', search: '', hash: '' })).toBe('/login');
    expect(loginPathFor({ pathname: '/learning/', search: '', hash: '' })).toBe('/login');
    expect(loginPathFor(null)).toBe('/login');
  });

  // A page can trip two gates: the navbar redirects the moment its session
  // check fails, then a request the page had already sent 401s and redirects
  // again — by which point we are on /login and must keep what is there.
  it('keeps a destination already recorded on the login URL', () => {
    expect(
      loginPathFor({ pathname: '/login', search: '?redirect=%2Flearning%2Fshort%2Fjoin', hash: '' }),
    ).toBe('/login?redirect=%2Flearning%2Fshort%2Fjoin');
  });
});

describe('singleRoleTarget', () => {
  it('maps public single-role destinations without exposing admin route names', () => {
    expect(singleRoleTarget('STUDENT')).toBe('/learning');
    expect(singleRoleTarget('student')).toBe('/learning');
    expect(singleRoleTarget('FACULTY')).toBe('/learning');
    expect(singleRoleTarget('faculty')).toBe('/learning');
    expect(singleRoleTarget('admin')).toBe('#');
    expect(singleRoleTarget('ITTC')).toBe('#');
    expect(singleRoleTarget('DTTI')).toBe('#');
    expect(singleRoleTarget('CM')).toBe('#');
    expect(singleRoleTarget('EO')).toBe('#');
    expect(singleRoleTarget('iams-admin')).toBe('#');
    expect(singleRoleTarget('iams-dept-admin')).toBe('#');
    expect(singleRoleTarget('lm-admin')).toBe('#');
  });

  it('takes a server-provided role target when available', () => {
    const user = {
      role: ['ITTC'],
      roleTargets: { ITTC: '/tt/admin', DTTI: '/tt/dashboard', admin: '/superadmin' },
      landingPath: '/tt/admin',
    };
    expect(singleRoleTarget('ITTC', user)).toBe('/tt/admin');
    expect(singleRoleTarget('DTTI', user)).toBe('/tt/dashboard');
    expect(singleRoleTarget('admin', user)).toBe('/superadmin');
  });

  it('routes COE users via the server-shared faculty-load path', () => {
    expect(singleRoleTarget('FACULTY', { name: 'coe@nitj.ac.in' })).toBe('/tt/coe/facultyload');
    expect(singleRoleTarget('ITTC', { email: 'coe@nitj.ac.in' })).toBe('/tt/coe/facultyload');
    expect(singleRoleTarget('ITTC', { email: ['coe@nitj.ac.in'] })).toBe('/tt/coe/facultyload');
  });

  // The role map moved behind the authenticated API, so the client only has
  // the server-provided target when it is already signed in.
  it('uses the server-provided landing page for a single-role account', () => {
    const user = { role: ['DTTI'], landingPath: '/tt/dashboard' };
    expect(defaultTargetForUser(user)).toBe('/tt/dashboard');
  });
});

describe('defaultTargetForUser', () => {
  it('routes a single-role student directly to /learning', () => {
    expect(defaultTargetForUser({ role: ['STUDENT'] })).toBe('/learning');
    expect(defaultTargetForUser({ role: 'STUDENT' })).toBe('/learning');
  });

  it('routes a single-role faculty directly to /learning', () => {
    expect(defaultTargetForUser({ role: ['FACULTY'] })).toBe('/learning');
  });

  it('uses the authenticated landing path when the server provides one', () => {
    expect(defaultTargetForUser({ role: ['admin'], landingPath: '/superadmin' })).toBe('/superadmin');
  });

  it('filters out obsolete / deprecated roles and routes accordingly', () => {
    expect(defaultTargetForUser({ role: ['STUDENT', 'editor', 'reviewer'] })).toBe('/learning');
  });

  it('routes multi-role users to /userroles', () => {
    expect(defaultTargetForUser({ role: ['FACULTY', 'DTTI'] })).toBe('/userroles');
    expect(defaultTargetForUser({ role: ['admin', 'ITTC'] })).toBe('/userroles');
  });

  it('falls back to /userroles for empty or null user', () => {
    expect(defaultTargetForUser(null)).toBe('/userroles');
    expect(defaultTargetForUser({})).toBe('/userroles');
    expect(defaultTargetForUser({ role: [] })).toBe('/userroles');
  });
});

describe('redirectTargetFrom', () => {
  it('round-trips a path stashed by loginPathFor', () => {
    const search = loginPathFor({ pathname: '/tt/dashboard', search: '?dept=CSE', hash: '' })
      .replace('/login', '');
    expect(redirectTargetFrom(search)).toBe('/tt/dashboard?dept=CSE');
  });

  it('falls back to the roles picker when nothing was remembered and no user given', () => {
    expect(redirectTargetFrom('')).toBe('/userroles');
    expect(redirectTargetFrom('?other=1')).toBe('/userroles');
  });

  it('resolves directly to the single role destination when the user provides one', () => {
    expect(redirectTargetFrom('', { role: ['STUDENT'] })).toBe('/learning');
    expect(redirectTargetFrom('?other=1', { role: ['STUDENT'] })).toBe('/learning');
    expect(redirectTargetFrom('', { role: ['admin'], landingPath: '/superadmin' })).toBe('/superadmin');
    expect(redirectTargetFrom('', { role: ['FACULTY', 'DTTI'] })).toBe('/userroles');
  });

  it('prefers an explicit safe redirect query over user role default', () => {
    expect(redirectTargetFrom('?redirect=%2Ftimetable', { role: ['STUDENT'] })).toBe('/timetable');
  });

  it('refuses off-site targets so login cannot be used as an open redirect', () => {
    expect(redirectTargetFrom('?redirect=https%3A%2F%2Fevil.com')).toBe('/userroles');
    expect(redirectTargetFrom('?redirect=%2F%2Fevil.com')).toBe('/userroles');
    expect(redirectTargetFrom('?redirect=%2F%5Cevil.com')).toBe('/userroles');
    expect(redirectTargetFrom('?redirect=javascript%3Aalert(1)')).toBe('/userroles');
    expect(redirectTargetFrom('?redirect=https%3A%2F%2Fevil.com', { role: ['STUDENT'] })).toBe('/learning');
  });
});

