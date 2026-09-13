import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const driver = join(dirname(dirname(fileURLToPath(import.meta.url))), 'mergeAdditive.mjs');

/**
 * Drive the merge driver exactly as git does — three files on disk, ours also
 * being the output — and report what a caller would see.
 *
 * Going through the real executable rather than importing a function is
 * deliberate: the argv contract, the exit code and the in-place write to %A are
 * the parts git actually depends on, and a unit test of an exported helper
 * would check none of them.
 */
function merge({ base, ours, theirs }) {
  const dir = mkdtempSync(join(tmpdir(), 'merge-additive-'));
  const paths = {
    base: join(dir, 'base.jsx'),
    ours: join(dir, 'ours.jsx'),
    theirs: join(dir, 'theirs.jsx'),
  };
  writeFileSync(paths.base, base);
  writeFileSync(paths.ours, ours);
  writeFileSync(paths.theirs, theirs);

  let status = 0;
  try {
    execFileSync('node', [driver, paths.base, paths.ours, paths.theirs, '7', 'src/test.jsx'], { stdio: 'pipe' });
  } catch (error) {
    status = error.status;
  }

  const result = readFileSync(paths.ours, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  return { status, result, conflicted: status !== 0 };
}

const BASE = `import React from 'react';\n\nexport default function App() {\n  return <div />;\n}\n`;

describe('mergeAdditive', () => {
  describe('the conflicts it exists to remove', () => {
    // The GpuMetrics conflict of 2026-09-10, which cost an OTA deploy: one
    // added import each, at the same point, resolved by hand as "keep both".
    it('keeps both sides when each adds a different import at the same point', () => {
      const { conflicted, result } = merge({
        base: BASE,
        ours: BASE.replace("import React from 'react';\n", "import React from 'react';\nimport getEnvironment from '../getenvironment';\n"),
        theirs: BASE.replace("import React from 'react';\n", "import React from 'react';\nimport GpuInventory from './GpuInventory';\n"),
      });

      expect(conflicted).toBe(false);
      expect(result).toContain("import getEnvironment from '../getenvironment';");
      expect(result).toContain("import GpuInventory from './GpuInventory';");
      expect(result).not.toContain('<<<<<<<');
    });

    it('puts AMS\'s line first and ours after it', () => {
      const { result } = merge({
        base: BASE,
        ours: `import ours from './ours';\n${BASE}`,
        theirs: `import theirs from './theirs';\n${BASE}`,
      });

      expect(result.indexOf("from './theirs'")).toBeLessThan(result.indexOf("from './ours'"));
    });

    // The main.jsx conflict of 2026-09-08: a single upstream line landing in the
    // same region as a multi-line block of ours.
    it('handles a block on one side against a single line on the other', () => {
      const ours = `import React from 'react';\nimport { startSession } from './mobile/httpSession';\nimport { attachShell } from './mobile/shell';\n${BASE.slice(BASE.indexOf('\n') + 1)}`;
      const theirs = `import React from 'react';\nimport './utils/favicon';\n${BASE.slice(BASE.indexOf('\n') + 1)}`;

      const { conflicted, result } = merge({ base: BASE, ours, theirs });

      expect(conflicted).toBe(false);
      expect(result).toContain("import './utils/favicon';");
      expect(result).toContain("from './mobile/httpSession'");
      expect(result).toContain("from './mobile/shell'");
    });

    it('recognises a multi-line import as one statement', () => {
      const ours = `import React from 'react';\nimport {\n  useState,\n  useEffect,\n} from 'react';\n${BASE.slice(BASE.indexOf('\n') + 1)}`;
      const theirs = `import React from 'react';\nimport clsx from 'clsx';\n${BASE.slice(BASE.indexOf('\n') + 1)}`;

      const { conflicted, result } = merge({ base: BASE, ours, theirs });

      expect(conflicted).toBe(false);
      expect(result).toContain('useEffect');
      expect(result).toContain("import clsx from 'clsx';");
    });

    it('resolves a re-export the same way as an import', () => {
      const { conflicted, result } = merge({
        base: BASE,
        ours: `export { shouldPersistQuery } from './queryPersister';\n${BASE}`,
        theirs: `export { buildKey } from './keys';\n${BASE}`,
      });

      expect(conflicted).toBe(false);
      expect(result).toContain('shouldPersistQuery');
      expect(result).toContain('buildKey');
    });

    it('emits a line added identically by both sides only once', () => {
      const line = "import shared from './shared';";
      const { conflicted, result } = merge({
        base: BASE,
        ours: `${line}\nimport ours from './ours';\n${BASE}`,
        theirs: `${line}\nimport theirs from './theirs';\n${BASE}`,
      });

      expect(conflicted).toBe(false);
      expect(result.match(/import shared/g)).toHaveLength(1);
    });
  });

  describe('what it refuses', () => {
    // Rule 1. A non-empty base means a side changed or removed something, so
    // "keep both" is no longer lossless and the driver must not guess.
    it('conflicts when both sides rewrote the same import', () => {
      const base = `import old from './old';\n${BASE}`;
      const { conflicted, result } = merge({
        base,
        ours: `import ours from './ours';\n${BASE}`,
        theirs: `import theirs from './theirs';\n${BASE}`,
      });

      expect(conflicted).toBe(true);
      expect(result).toContain('<<<<<<<');
    });

    // Rule 2. This is the one that keeps the driver from putting broken logic
    // into an OTA bundle: two inserted statements can conflict in meaning even
    // though neither side deleted anything.
    it('conflicts when the inserted lines are statements, not imports', () => {
      const { conflicted, result } = merge({
        base: BASE,
        ours: BASE.replace('  return <div />;', '  if (!user) return null;\n  return <div />;'),
        theirs: BASE.replace('  return <div />;', '  if (!ready) return <Spinner />;\n  return <div />;'),
      });

      expect(conflicted).toBe(true);
      expect(result).toContain('<<<<<<<');
    });

    // Rule 3. Concatenating these would redeclare the binding — a syntax error
    // rather than a merge.
    it('conflicts when both sides bind the same local name', () => {
      const { conflicted } = merge({
        base: BASE,
        ours: `import Panel from './ours/Panel';\n${BASE}`,
        theirs: `import Panel from './theirs/Panel';\n${BASE}`,
      });

      expect(conflicted).toBe(true);
    });

    it('conflicts when the same name arrives inside braces on both sides', () => {
      const { conflicted } = merge({
        base: BASE,
        ours: `import { format } from './ours/date';\n${BASE}`,
        theirs: `import { format } from 'date-fns';\n${BASE}`,
      });

      expect(conflicted).toBe(true);
    });

    it('conflicts when only one hunk of several is unresolvable', () => {
      const base = `import React from 'react';\n\nconst a = 1;\n\nexport default a;\n`;
      const { conflicted, result } = merge({
        base,
        ours: `import React from 'react';\nimport ours from './ours';\n\nconst a = 2;\n\nexport default a;\n`,
        theirs: `import React from 'react';\nimport theirs from './theirs';\n\nconst a = 3;\n\nexport default a;\n`,
      });

      // The import hunk alone would have qualified; the `const a` hunk does not,
      // and a file resolved half by machine and half by hand is worse than one
      // a human opens whole.
      expect(conflicted).toBe(true);
      expect(result).toContain('<<<<<<<');
    });

    it('does not treat a dynamic import() as an import statement', () => {
      const { conflicted } = merge({
        base: BASE,
        ours: BASE.replace('  return <div />;', "  const m = await import('./ours');\n  return <div />;"),
        theirs: BASE.replace('  return <div />;', "  const m = await import('./theirs');\n  return <div />;"),
      });

      expect(conflicted).toBe(true);
    });
  });

  // The conflict of 2026-09-12, and the second shape of the same thing: the two
  // sides edit members inside ONE import statement rather than adding whole
  // statements next to each other.
  describe('a member list both sides edited', () => {
    const list = (members) => `import {\n${members.map((m) => `  ${m},`).join('\n')}\n} from '@chakra-ui/react';\n\nexport default function App() {\n  return <Box />;\n}\n`;

    it('keeps every member either side added', () => {
      const { conflicted, result } = merge({
        base: list(['Box', 'MenuList', 'Text']),
        ours: list(['Box', 'MenuList', 'Spinner', 'Text']),
        theirs: list(['Box', 'MenuList', 'Modal', 'ModalOverlay', 'Text']),
      });

      expect(conflicted).toBe(false);
      expect(result).not.toContain('<<<<<<<');
      expect(result).toBe(list(['Box', 'MenuList', 'Modal', 'ModalOverlay', 'Spinner', 'Text']));
    });

    // The LearningLayout conflict exactly: AMS added the Modal family *and*
    // moved Text/Tooltip down into sorted position, so the naive "keep both
    // sides of the hunk" answer declares Text twice and the file will not parse.
    it('does not duplicate a member the other side moved', () => {
      const { conflicted, result } = merge({
        base: list(['MenuList', 'Text', 'Tooltip', 'Skeleton', 'useDisclosure']),
        ours: list(['MenuList', 'Spinner', 'Text', 'Tooltip', 'Skeleton', 'useDisclosure']),
        theirs: list(['MenuList', 'Modal', 'ModalOverlay', 'Skeleton', 'Text', 'Tooltip', 'useDisclosure']),
      });

      expect(conflicted).toBe(false);
      expect(result.match(/\bText\b/g)).toHaveLength(1);
      expect(result).toBe(list(['MenuList', 'Modal', 'ModalOverlay', 'Skeleton', 'Spinner', 'Text', 'Tooltip', 'useDisclosure']));
    });

    // A removal is not honoured, deliberately: dropping a member we still
    // reference fails at the user, keeping one we do not costs an unused
    // import — and fails the build loudly if the export is really gone.
    it('keeps a member AMS removed while we were adding one', () => {
      const { conflicted, result } = merge({
        base: list(['Box', 'Divider', 'Text']),
        ours: list(['Box', 'Divider', 'Spinner', 'Text']),
        theirs: list(['Box', 'Text']),
      });

      expect(conflicted).toBe(false);
      expect(result).toContain('Divider');
      expect(result).toContain('Spinner');
    });

    it('emits a member both sides added only once', () => {
      const { conflicted, result } = merge({
        base: list(['Box', 'Text']),
        ours: list(['Box', 'Spinner', 'Text']),
        theirs: list(['Box', 'Spinner', 'Tooltip', 'Text']),
      });

      expect(conflicted).toBe(false);
      expect(result.match(/\bSpinner\b/g)).toHaveLength(1);
    });

    it('carries an alias through', () => {
      const { conflicted, result } = merge({
        base: list(['Box', 'Text']),
        ours: list(['Box', 'Link as ChakraLink', 'Text']),
        theirs: list(['Box', 'Modal', 'Text']),
      });

      expect(conflicted).toBe(false);
      expect(result).toContain('Link as ChakraLink,');
    });

    it('leaves a list alone that was not sorted to begin with', () => {
      const { conflicted, result } = merge({
        base: list(['useToast', 'Box']),
        ours: list(['useToast', 'Box', 'Spinner']),
        theirs: list(['useToast', 'Box', 'Modal']),
      });

      expect(conflicted).toBe(false);
      expect(result).toBe(list(['useToast', 'Box', 'Modal', 'Spinner']));
    });

    it('conflicts when the two sides bind the same local name to different members', () => {
      const { conflicted, result } = merge({
        base: list(['Box', 'Text']),
        ours: list(['Box', 'Spinner as Loader', 'Text']),
        theirs: list(['Box', 'Skeleton as Loader', 'Text']),
      });

      expect(conflicted).toBe(true);
      expect(result).toContain('<<<<<<<');
    });

    it('conflicts when the hunk holds anything but plain members', () => {
      const base = `import {\n  Box,\n} from '@chakra-ui/react';\n\nconst value = 1;\n\nexport default value;\n`;
      const { conflicted } = merge({
        base,
        ours: base.replace('const value = 1;', 'const value = 2;'),
        theirs: base.replace('const value = 1;', 'const value = 3;'),
      });

      expect(conflicted).toBe(true);
    });

    // The ends of the statement are what prove it IS a statement. Without a
    // visible `import {` above the hunk these are just bare words.
    it('conflicts when the lines only look like members', () => {
      const base = `const theme = {\n  Box,\n  Text,\n};\n\nexport default theme;\n`;
      const { conflicted } = merge({
        base,
        ours: base.replace('  Text,', '  Spinner,\n  Text,'),
        theirs: base.replace('  Text,', '  Modal,\n  Text,'),
      });

      expect(conflicted).toBe(true);
    });
  });

  describe('the cases that are not conflicts at all', () => {
    it('passes a clean merge through unchanged', () => {
      const ours = BASE.replace('<div />', '<main />');
      const theirs = `import clsx from 'clsx';\n${BASE}`;

      const { conflicted, result } = merge({ base: BASE, ours, theirs });

      expect(conflicted).toBe(false);
      expect(result).toContain('<main />');
      expect(result).toContain("import clsx from 'clsx';");
    });

    it('leaves a file neither side touched byte-identical', () => {
      const { conflicted, result } = merge({ base: BASE, ours: BASE, theirs: BASE });

      expect(conflicted).toBe(false);
      expect(result).toBe(BASE);
    });

    it('keeps the trailing newline when it resolves', () => {
      const { result } = merge({
        base: BASE,
        ours: `import ours from './ours';\n${BASE}`,
        theirs: `import theirs from './theirs';\n${BASE}`,
      });

      expect(result.endsWith('\n')).toBe(true);
    });
  });
});
