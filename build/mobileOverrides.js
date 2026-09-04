import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const SRC = path.join(ROOT, 'src');
const SRC_PREFIX = SRC + path.sep;

// The extensions this project uses, in the order Vite would try them.
const EXTENSIONS = ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.json'];
const MOBILE = '.mobile';
const SKIP_DIRS = new Set(['node_modules', '__tests__', '__snapshots__']);

const toPosix = (p) => p.split(path.sep).join('/');

/** `src/a/B.mobile.jsx` -> `src/a/B.jsx`; null if not an override. */
function originalOf(file) {
  const ext = path.extname(file);
  const stem = file.slice(0, file.length - ext.length);
  return stem.endsWith(MOBILE) ? stem.slice(0, -MOBILE.length) + ext : null;
}

/** Every `*.mobile.*` under src, keyed by the path it stands in for. */
function indexOverrides(dir, into) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return into;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) indexOverrides(full, into);
    } else {
      const original = originalOf(full);
      if (original) {
        into.map.set(original, full);
        // The cheap pre-filter below tests the last segment of the specifier,
        // so record every last segment that could name this override: its own
        // stem, and for a directory index, the directory's name.
        const stem = path.basename(original, path.extname(original));
        into.names.add(stem);
        if (stem === 'index') into.names.add(path.basename(path.dirname(original)));
      }
    }
  }
  return into;
}

/**
 * Resolves `X.mobile.ext` in place of `X.ext` whenever the sibling exists.
 *
 * Why this exists
 * ---------------
 * This repo's `src/` is not ours. It is unpacked wholesale from the AMS client
 * on every sync (see .github/workflows/deploy-ota.yml), and the sync lands as a
 * three-way merge against the `ams-update` vendor branch. Anything we edit in
 * place is a line the web team may also edit, and every such line is a merge
 * conflict waiting for the sync that touches it — which is exactly how
 * LoginForm.jsx kept stopping the OTA pipeline: we had not patched it, we had
 * rewritten it, and git kept trying to patch the rewrite.
 *
 * So a file we have genuinely forked is not edited at all. Its AMS copy stays
 * byte-identical to upstream — nothing of ours on those lines, nothing to
 * conflict — and our version lives beside it under a name AMS will never
 * create. New files merge cleanly no matter what upstream does to the original.
 *
 * The sibling layout (rather than a parallel `src/mobile-overrides/` tree) is
 * deliberate: an override sits in the same directory as the file it replaces,
 * so its relative imports — `./FormHeader`, `../../getenvironment` — keep
 * resolving to the same modules they did before the move. Migrating a fork is
 * then a rename and nothing else, which is the property that made this safe to
 * do to a shipping app.
 *
 * The cost is real and is paid deliberately: an overridden file stops
 * inheriting upstream changes. `npm run drift` reports what AMS has changed in
 * each original since, so porting is a decision made with the diff in hand
 * rather than something discovered as a conflict mid-deploy.
 *
 * Two things about the implementation are load-bearing, both learned the hard
 * way on this build:
 *
 *  - Resolution joins paths here instead of delegating to `this.resolve()`.
 *    Under Vite 8's Rolldown backend a `pre` plugin calling `this.resolve()`
 *    gets nothing back for a plain relative specifier, so the delegating
 *    version redirected nothing at all — a failure indistinguishable from the
 *    plugin not being installed. Every src-to-src import in this codebase is
 *    relative, so joining is both sufficient and predictable.
 *
 *  - The overrides are indexed once, up front, rather than probed for per
 *    import. Probing meant a dozen `existsSync` calls on each of ~6000 modules'
 *    imports, which Rolldown reported as significant build time. A single scan
 *    of src turns the hot path into map lookups.
 */
export function mobileOverrides({ verbose = false } = {}) {
  /** original absolute path -> override absolute path */
  let overrides = null;
  const announced = new Set();

  const load = () => {
    overrides = indexOverrides(SRC, { map: new Map(), names: new Set() });
    return overrides;
  };

  return {
    name: 'mobile-overrides',
    // Ahead of the resolvers that would otherwise claim the id first.
    enforce: 'pre',

    buildStart() {
      load();
    },

    configureServer(server) {
      // Adding or deleting an override during `vite dev` should take effect
      // without restarting the server; nothing else needs to invalidate.
      const refresh = (file) => {
        if (file.includes(MOBILE + '.')) load();
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },

    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return null; // entry, or a package
      const { map, names } = overrides ?? load();
      if (map.size === 0) return null;

      // The pre-filter. A JS resolveId hook is called for every import in the
      // graph and each call crosses into JS from Rolldown's native resolver, so
      // the ~6000-module build notices anything done here unconditionally.
      // Comparing the specifier's last segment against a small set of names is
      // one slice and one lookup, and it rejects all but a handful of imports
      // before any path work happens at all.
      const lastSegment = source.slice(source.lastIndexOf('/') + 1);
      const dot = lastSegment.indexOf('.');
      if (!names.has(dot === -1 ? lastSegment : lastSegment.slice(0, dot))) return null;

      // Vite hands ids with forward slashes even on Windows, so they have to be
      // put back into the platform's own form before any of the path work below
      // — otherwise the SRC_PREFIX test never matches and every import silently
      // declines its override, which is a failure that looks exactly like the
      // plugin not being installed at all.
      const importerFile = path.normalize(importer.split('?')[0]);
      if (!importerFile.startsWith(SRC_PREFIX)) return null;

      const target = path.resolve(path.dirname(importerFile), source.split('?')[0]);
      if (!target.startsWith(SRC_PREFIX)) return null;

      // The specifier may carry its extension, omit it, or name a directory.
      // These are map lookups, so trying all three shapes costs nothing.
      let override = map.get(target);
      if (!override) {
        for (const ext of EXTENSIONS) {
          override = map.get(target + ext) ?? map.get(path.join(target, `index${ext}`));
          if (override) break;
        }
      }
      if (!override) return null;

      // An override wrapping the file it replaces — `import base from './Foo'`
      // inside `Foo.mobile.js` — must reach the real AMS module, or it would
      // import itself. Every *other* import from an override still gets its own
      // override, so overrides compose normally.
      if (importerFile === override) return null;

      if (verbose && !announced.has(override)) {
        announced.add(override);
        console.log(`[mobile-overrides] ${toPosix(path.relative(ROOT, override))}`);
      }
      return toPosix(override);
    },
  };
}

export default mobileOverrides;
