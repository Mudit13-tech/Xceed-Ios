import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pruneLock, resolvePruned } from '../../../scripts/fetch-runtimes.mjs';

/**
 * The build-time mirror of the notebook runtimes.
 *
 * These exist because the pruning had three separate bugs before it was right,
 * every one of which produced a *plausible* mirror that failed later, in a
 * student's notebook, as a 404 or an unresolvable import:
 *
 *   1. The rescue walked dependencies the wrong way and kept the entire GIS
 *      stack it was meant to drop.
 *   2. The skip list used wheel-filename spellings (`python_flint`) against
 *      lock package names (`python-flint`), so the biggest entry on it — 156 MB
 *      — was mirrored anyway, silently.
 *   3. Test suites are registered as their own lock packages (`numpy-tests`) as
 *      well as a flag on the parent, so clearing the flag left fifty-four
 *      entries pointing at tarballs that had been deleted.
 *
 * None of the three is visible by reading the output; all three are one
 * assertion each.
 */

/** A miniature lock with the shapes that matter, and nothing else. */
const lockFixture = () => ({
  packages: {
    numpy: { file_name: 'numpy-1.0-any.whl', depends: [], unvendored_tests: true },
    'numpy-tests': { file_name: 'numpy-tests.tar', depends: ['numpy'] },
    pandas: { file_name: 'pandas-1.0-any.whl', depends: ['numpy'] },
    // The stack being dropped, and something built on top of it.
    fiona: { file_name: 'fiona-1.0-any.whl', depends: [] },
    geopandas: { file_name: 'geopandas-1.0-any.whl', depends: ['fiona', 'pandas'] },
    contextily: { file_name: 'contextily-1.0-any.whl', depends: ['geopandas'] },
  },
});

describe('choosing what not to mirror', () => {
  it('drops the named package and everything that depends on it', () => {
    // The bug this replaces kept fiona *because* geopandas depends on it, which
    // is precisely backwards: dropping a stack means dropping its dependents.
    const pruned = resolvePruned(lockFixture().packages, new Set(['fiona']), []);
    expect([...pruned].sort()).toEqual(['contextily', 'fiona', 'geopandas']);
  });

  it('leaves everything not reachable from the skip list alone', () => {
    const pruned = resolvePruned(lockFixture().packages, new Set(['fiona']), []);
    expect(pruned.has('numpy')).toBe(false);
    expect(pruned.has('pandas')).toBe(false);
  });

  it('refuses a name the lock does not have, rather than ignoring it', () => {
    // `python_flint` is the wheel filename; the lock says `python-flint`. The
    // mismatch used to be a silent no-op that mirrored 156 MB anyway.
    expect(() => resolvePruned(lockFixture().packages, new Set(['python_flint']), []))
      .toThrow(/not in pyodide-lock/);
  });

  it('refuses to drop a package the notebooks teach', () => {
    // Dropping fiona is fine; dropping numpy because something on the list
    // needs it is a term of broken labs, so the build stops instead.
    expect(() => resolvePruned(lockFixture().packages, new Set(['numpy']), ['numpy']))
      .toThrow(/which the notebooks teach/);
  });
});

describe('the pruned lock', () => {
  it('removes the test suites registered as their own packages', () => {
    const lock = lockFixture();
    const dropped = pruneLock(lock, new Set(), []);
    expect(lock.packages['numpy-tests']).toBeUndefined();
    expect(dropped.has('numpy-tests.tar')).toBe(true);
  });

  it('clears the flag on the parent, so nothing goes looking for one', () => {
    const lock = lockFixture();
    pruneLock(lock, new Set(), []);
    expect(lock.packages.numpy.unvendored_tests).toBe(false);
  });

  it('names every file that must not be copied', () => {
    const lock = lockFixture();
    const dropped = pruneLock(lock, new Set(['fiona']), []);
    expect(dropped.has('fiona-1.0-any.whl')).toBe(true);
    expect(dropped.has('geopandas-1.0-any.whl')).toBe(true);
    expect(dropped.has('contextily-1.0-any.whl')).toBe(true);
  });

  it('leaves no package advertised whose dependency it removed', () => {
    // The invariant the whole exercise is for: a surviving package whose
    // dependency is gone is an unresolvable import at the worst possible moment.
    const lock = lockFixture();
    pruneLock(lock, new Set(['fiona']), []);
    const normalise = (name) => name.replace(/[-_.]+/g, '-').toLowerCase();
    const known = new Set(Object.keys(lock.packages).map(normalise));
    Object.entries(lock.packages).forEach(([name, spec]) => {
      (spec.depends || []).forEach((dependency) => {
        expect(known.has(normalise(dependency)), `${name} depends on missing ${dependency}`).toBe(true);
      });
    });
  });
});

/**
 * The mirror as actually built, when there is one.
 *
 * Skipped rather than failed when `public/pyodide` is absent: a developer who has
 * only ever run `vite dev` has not downloaded 440 MB, and should not be told
 * their checkout is broken. On CI, where `yarn build` runs first, these do check
 * the real thing.
 */
// Relative to the Vitest root, which is the client package — `import.meta.url`
// is not a file: URL under Vitest's transform, and __dirname does not exist in
// an ES module.
const mirror = path.resolve('public/pyodide');
const built = fs.existsSync(path.join(mirror, 'pyodide-lock.json'));

describe.skipIf(!built)('the mirror on disk', () => {
  const lock = built
    ? JSON.parse(fs.readFileSync(path.join(mirror, 'pyodide-lock.json'), 'utf8'))
    : { packages: {} };
  const present = built ? new Set(fs.readdirSync(mirror)) : new Set();

  it('has the core runtime the worker imports', () => {
    ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip'].forEach((file) => {
      expect(present.has(file), file).toBe(true);
    });
  });

  it('has a wheel on disk for every package it advertises', () => {
    const missing = Object.entries(lock.packages)
      .filter(([, spec]) => !present.has(spec.file_name))
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it('still has everything the Coding Manual promises', () => {
    ['numpy', 'pandas', 'matplotlib', 'scipy', 'sympy', 'scikit-learn', 'micropip']
      .forEach((name) => {
        expect(lock.packages[name], name).toBeDefined();
        expect(present.has(lock.packages[name].file_name), name).toBe(true);
      });
  });

  it('carries no orphaned test tarballs', () => {
    expect([...present].filter((file) => file.endsWith('-tests.tar'))).toEqual([]);
  });
});
