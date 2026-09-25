import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ClassLayout.mobile.jsx carries its own copy of the class tabs, because AMS's
 * ClassLayout.jsx does not export TABS and this repo does not edit AMS files.
 * A copy can go stale without a sound, so this reads AMS's list straight out of
 * the source and fails when a sync adds, renames or reorders a tab: copy the
 * new list across and it passes again.
 *
 * Both lists are read from source rather than imported. Importing the override
 * pulls in the whole class shell, which under a full-suite run can take longer
 * than a test is allowed, and the literal is all this needs.
 */
const tabsIn = (file) => {
  const source = readFileSync(path.resolve('src/learningModule/pages', file), 'utf8');
  const match = source.match(/const TABS = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error(`No \`const TABS = [...]\` in ${file} -- has it moved?`);
  // A plain array literal with comments; nothing in it needs a scope.
  return new Function(`return ${match[1]}`)();
};

describe('the iOS class tabs', () => {
  it('match the tabs AMS ships', () => {
    expect(tabsIn('ClassLayout.mobile.jsx')).toEqual(tabsIn('ClassLayout.jsx'));
  });
});
