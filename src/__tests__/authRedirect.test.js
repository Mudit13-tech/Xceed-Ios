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
  it('maps single roles to their dedicated dashboards', () => {
    expect(singleRoleTarget('STUDENT')).toBe('/learning');
    expect(singleRoleTarget('student')).toBe('/learning');
    expect(singleRoleTarget('FACULTY')).toBe('/learning');
    expect(singleRoleTarget('faculty')).toBe('/learning');
    expect(singleRoleTarget('admin')).toBe('/superadmin');
    expect(singleRoleTarget('ITTC')).toBe('/tt/admin');
    expect(singleRoleTarget('ittc')).toBe('/tt/admin');
    expect(singleRoleTarget('DTTI')).toBe('/tt/dashboard');
    expect(singleRoleTarget('CM')).toBe('/cm/dashboard');
    expect(singleRoleTarget('EO')).toBe('/cf/dashboard');
    expect(singleRoleTarget('iams-admin')).toBe('/iams-admin');
    expect(singleRoleTarget('iams-dept-admin')).toBe('/dept-admin/dashboard');
    expect(singleRoleTarget('lm-admin')).toBe('/learning/lm-admin');
  });

  it('routes COE user to coe faculty load page', () => {
    expect(singleRoleTarget('FACULTY', { name: 'coe@nitj.ac.in' })).toBe('/tt/coe/facultyload');
    expect(singleRoleTarget('ITTC', { email: 'coe@nitj.ac.in' })).toBe('/tt/coe/facultyload');
    expect(singleRoleTarget('ITTC', { email: ['coe@nitj.ac.in'] })).toBe('/tt/coe/facultyload');
  });

  // `email` is an array on the user schema and `name` is optional, so an
  // account created without a name used to throw here and leave the role card
  // on /userroles doing nothing when clicked.
  it('resolves a target for a user with an array email and no name', () => {
    const user = { role: ['ITTC', 'DTTI'], email: ['ttc@nitj.ac.in'] };
    expect(singleRoleTarget('ITTC', user)).toBe('/tt/admin');
    expect(singleRoleTarget('DTTI', user)).toBe('/tt/dashboard');
    expect(defaultTargetForUser({ role: ['DTTI'], email: ['ttc@nitj.ac.in'] })).toBe('/tt/dashboard');
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

  it('routes a single-role admin directly to /superadmin', () => {
    expect(defaultTargetForUser({ role: ['admin'] })).toBe('/superadmin');
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

  it('resolves directly to the single role destination when user object is provided', () => {
    expect(redirectTargetFrom('', { role: ['STUDENT'] })).toBe('/learning');
    expect(redirectTargetFrom('?other=1', { role: ['STUDENT'] })).toBe('/learning');
    expect(redirectTargetFrom('', { role: ['admin'] })).toBe('/superadmin');
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

