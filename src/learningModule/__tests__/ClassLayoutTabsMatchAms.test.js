import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * ClassLayout.mobile.jsx carries its own copy of the class tabs, because AMS's
 * ClassLayout.jsx does not export TABS and this repo does not edit AMS files.
 * A copy can go stale without a sound, so this reads AMS's list straight out of
 * the source and fails when a sync adds, renames or reorders a tab: copy the
 * new list across and it passes again.
 */
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'web' } }));

const amsTabs = () => {
  const source = readFileSync(path.resolve(__dirname, '../pages/ClassLayout.jsx'), 'utf8');
  const match = source.match(/const TABS = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error('No `const TABS = [...]` in ClassLayout.jsx -- has AMS moved it?');
  // A plain array literal with comments; nothing in it needs a scope.
  return new Function(`return ${match[1]}`)();
};

describe('the iOS class tabs', () => {
  it('match the tabs AMS ships', async () => {
    const { TABS } = await import('../pages/ClassLayout.mobile.jsx');
    expect(TABS).toEqual(amsTabs());
  });
});
