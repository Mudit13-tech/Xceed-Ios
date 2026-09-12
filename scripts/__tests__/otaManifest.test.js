import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { buildManifest, diffManifests, hashFile, isExcludedFromBundle } from '../otaManifest.cjs';

// sha256 of "hello" — a fixed value rather than one computed the same way the
// implementation computes it, so a change of algorithm fails here instead of
// agreeing with itself. The device compares against this digest in native code;
// nothing in JS would catch it drifting.
const HELLO_SHA256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

describe('otaManifest', () => {
  let dist;

  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'ota-manifest-'));
  });

  afterEach(() => {
    rmSync(dist, { recursive: true, force: true });
  });

  it('hashes file contents with sha256', () => {
    writeFileSync(join(dist, 'hello.txt'), 'hello');
    expect(hashFile(join(dist, 'hello.txt'))).toBe(HELLO_SHA256);
  });

  it('separates nested paths with / on every platform', () => {
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'assets', 'index-abc.js'), 'hello');

    const [entry] = buildManifest(dist, (hash) => `https://x/files/${hash}`);

    // The Android side resolves file_name inside the bundle directory. A
    // backslash from a Windows deploy is not a path there, it is a filename.
    expect(entry.file_name).toBe('assets/index-abc.js');
    expect(entry.file_name).not.toMatch(/[\\]/);
  });

  it('addresses each file by its own hash', () => {
    writeFileSync(join(dist, 'hello.txt'), 'hello');

    const [entry] = buildManifest(dist, (hash) => `https://x/files/${hash}`);

    expect(entry).toEqual({
      file_name: 'hello.txt',
      file_hash: HELLO_SHA256,
      download_url: `https://x/files/${HELLO_SHA256}`,
    });
  });

  it('includes every file, so the manifest defines the whole bundle', () => {
    mkdirSync(join(dist, 'assets'));
    mkdirSync(join(dist, 'home'));
    writeFileSync(join(dist, 'index.html'), 'a');
    writeFileSync(join(dist, 'assets', 'app.js'), 'b');
    writeFileSync(join(dist, 'home', 'pic.webp'), 'c');

    const names = buildManifest(dist, () => 'https://x').map((e) => e.file_name);

    // An omitted entry is not a file left alone — it is a file absent from the
    // new bundle, which is a blank screen rather than a failed download.
    expect(names).toEqual(['assets/app.js', 'home/pic.webp', 'index.html']);
  });

  it('is deterministic for the same tree', () => {
    writeFileSync(join(dist, 'b.txt'), 'b');
    writeFileSync(join(dist, 'a.txt'), 'a');

    const first = buildManifest(dist, (h) => `https://x/${h}`);
    const second = buildManifest(dist, (h) => `https://x/${h}`);

    expect(first).toEqual(second);
  });

  describe('the notebook runtimes, which must never reach a device', () => {
    // ~535MB of Pyodide and clang WebAssembly. AMS's build mirrors it into
    // public/ for the web client; this app points the kernels at the web origin
    // instead (.env.production), so these directories are normally absent. A
    // developer who has run `npm run fetch:runtimes` has them, and without this
    // the next deploy publishes half a gigabyte to every phone — silently,
    // because nothing about a large bundle is invalid.
    beforeEach(() => {
      mkdirSync(join(dist, 'pyodide'), { recursive: true });
      writeFileSync(join(dist, 'pyodide', 'pyodide.asm.wasm'), 'huge');
      mkdirSync(join(dist, 'clang'), { recursive: true });
      writeFileSync(join(dist, 'clang', 'clang.wasm'), 'huge');
      mkdirSync(join(dist, 'assets'), { recursive: true });
      writeFileSync(join(dist, 'assets', 'index-abc.js'), 'app');
    });

    it('leaves them out of the manifest', () => {
      const names = buildManifest(dist, (h) => `https://x/${h}`).map((e) => e.file_name);

      expect(names).toEqual(['assets/index-abc.js']);
    });

    it('excludes the directories themselves and everything under them', () => {
      expect(isExcludedFromBundle('pyodide/pyodide.asm.wasm')).toBe(true);
      expect(isExcludedFromBundle('clang/clang-fs.tar.gz')).toBe(true);
      expect(isExcludedFromBundle('pyodide')).toBe(true);
    });

    it('does not exclude a file that merely starts with the same letters', () => {
      // `clangd-notes.js` is not the clang toolchain, and a prefix test without
      // the separator would have dropped it from the bundle with no error — the
      // app would boot to a missing chunk.
      expect(isExcludedFromBundle('clangd-notes.js')).toBe(false);
      expect(isExcludedFromBundle('assets/pyodide-worker.js')).toBe(false);
      expect(isExcludedFromBundle('pyodide-worker.js')).toBe(false);
    });
  });

  describe('diffManifests', () => {
    it('counts a file as reused when its hash is unchanged, whatever its name', () => {
      const previous = [{ file_name: 'assets/app-old.js', file_hash: 'aaa', download_url: 'u' }];
      const next = [
        // Vite renames on content change, so an unchanged chunk keeps both its
        // name and hash. Matching on hash rather than name is what makes a
        // renamed-but-identical file free too.
        { file_name: 'assets/app-old.js', file_hash: 'aaa', download_url: 'u' },
        { file_name: 'assets/new-bbb.js', file_hash: 'bbb', download_url: 'u' },
      ];

      const { changed, unchanged, total } = diffManifests(previous, next);

      expect(changed.map((e) => e.file_hash)).toEqual(['bbb']);
      expect(unchanged).toBe(1);
      expect(total).toBe(2);
    });

    it('treats a missing previous manifest as everything changed', () => {
      const next = [{ file_name: 'a.js', file_hash: 'aaa', download_url: 'u' }];

      expect(diffManifests(undefined, next).changed).toHaveLength(1);
    });
  });
});
