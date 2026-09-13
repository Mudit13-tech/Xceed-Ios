#!/usr/bin/env node
/**
 * A git merge driver for JavaScript sources, used by the AMS sync.
 *
 * ## The conflict this exists to remove
 *
 * Every hand-resolved conflict this sync has produced in a source file has been
 * the same shape, and has been resolved the same way. From the log:
 *
 *   2026-09-07  src/main.jsx            AMS added a `queryPersister` import where
 *                                       we had added a `mobile/httpSession` one.
 *   2026-09-08  src/main.jsx            AMS added a `utils/favicon` import into
 *                                       the same block, two days later.
 *   2026-09-10  GpuMetrics.jsx          AMS added `import GpuInventory`, we had
 *                                       added `import getEnvironment`. One line
 *                                       each.
 *
 * Three lost OTA deploys. In all three the two sides *added different import
 * lines at the same point* and deleted nothing, so the resolution was purely
 * mechanical — keep both, AMS's first, ours trailing — and a human was needed
 * only because git cannot tell "we both appended here" from "we both rewrote
 * this". It conflicts on position, and an import block is the one place in a
 * file where position carries no meaning.
 *
 * This driver tells those apart and resolves the first kind. Anything else it
 * hands back to git untouched, with the ordinary markers.
 *
 * ## When it resolves, and why that is safe
 *
 * A conflicted hunk is auto-resolved only when ALL of these hold:
 *
 *   1. The base side of the hunk is EMPTY. That is the whole safety argument:
 *      an empty base means neither side changed or removed anything that was
 *      there, they only inserted at the same spot. Nothing can be lost by
 *      keeping both, because nothing was taken away by either.
 *   2. Every line both sides added is an import (or `export ... from`), a
 *      comment, or blank. Imports are order-independent, so concatenating two
 *      independent sets of them is the same program either way. A hunk holding
 *      real statements is left alone even when the base is empty, because two
 *      inserted *statements* can very much conflict in meaning — both sides
 *      adding a different early return, say — and that is a human's call.
 *   3. Neither side introduces a local binding the other also introduces. Two
 *      different `import GpuInventory from …` lines are a genuine disagreement
 *      about what that name means, and concatenating them is a syntax error
 *      rather than a merge. Identical lines on both sides are deduplicated
 *      instead, which is the same reasoning.
 *
 * Every hunk in the file must qualify. One that does not conflicts the whole
 * file, because a file half-resolved by a machine and half by a human is the
 * worst of both.
 *
 * The conservative direction is deliberate. A missed auto-resolution costs one
 * hand-merge, which is what happens today; a wrong one puts silently broken
 * code into an OTA bundle that goes out to every device. Those are not
 * symmetrical, so the rules above bail on anything they do not positively
 * recognise.
 *
 * ## Not a substitute for an override
 *
 * A file this repo has effectively rewritten still belongs beside its AMS copy
 * as `<name>.mobile.<ext>` — see build/mobileOverrides.js. This handles the
 * opposite case: files we and AMS both genuinely co-own, where an override
 * would mean forking a file neither side has rewritten.
 *
 * git calls this as: node build/mergeAdditive.mjs %O %A %B %L %P
 *   %O base   %A ours (also the file to write)   %B theirs
 *   %L conflict marker size   %P real path
 * Exit 0 for a clean merge, 1 to report a conflict.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const [, , basePath, oursPath, theirsPath, markerSizeArg, realPath = 'file'] = process.argv;
const markerSize = Number.parseInt(markerSizeArg, 10) || 7;

/**
 * Run git's own 3-way merge and hand back its output.
 *
 * `--diff3` is what makes rule 1 above checkable at all: without it the base
 * section is not printed, and "both sides inserted here" is indistinguishable
 * from "both sides replaced the same lines". `-p` sends the result to stdout so
 * neither input file is touched until we have decided what to write.
 *
 * A non-zero exit is the normal report of a conflict, not a failure, so the
 * status is read off the error rather than thrown.
 */
function mergeFile({ diff3 }) {
  const args = ['merge-file', '-p', `--marker-size=${markerSize}`];
  if (diff3) args.push('--diff3');
  args.push(oursPath, basePath, theirsPath);
  try {
    return { text: execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 }), conflicted: false };
  } catch (error) {
    // Exit codes above 127 mean git itself failed (could not run, bad usage);
    // anything at or below is its count of conflict hunks.
    if (error.status === undefined || error.status > 127) throw error;
    return { text: error.stdout ?? '', conflicted: true };
  }
}

const OURS_START = '<'.repeat(markerSize);
const BASE_START = '|'.repeat(markerSize);
const SPLIT = '='.repeat(markerSize);
const THEIRS_END = '>'.repeat(markerSize);

/**
 * Split diff3 output into plain text runs and conflict hunks.
 *
 * Returns a list of `{ type: 'text', lines }` and
 * `{ type: 'conflict', ours, base, theirs }`. Anything malformed throws, which
 * the caller treats as "leave it to git" — inventing a result from a shape we
 * do not understand is the one thing a merge driver must never do.
 */
function parseConflicts(text) {
  const lines = text.split('\n');
  const parts = [];
  let plain = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.startsWith(OURS_START)) {
      plain.push(line);
      index += 1;
      continue;
    }

    if (plain.length) parts.push({ type: 'text', lines: plain });
    plain = [];

    const hunk = { type: 'conflict', ours: [], base: [], theirs: [] };
    let side = 'ours';
    index += 1;

    for (; index < lines.length; index += 1) {
      const current = lines[index];
      if (current.startsWith(BASE_START)) side = 'base';
      else if (current.startsWith(SPLIT) && side === 'base') side = 'theirs';
      else if (current.startsWith(THEIRS_END)) break;
      else hunk[side].push(current);
    }

    if (index >= lines.length) throw new Error('unterminated conflict hunk');
    index += 1;
    parts.push(hunk);
  }

  if (plain.length) parts.push({ type: 'text', lines: plain });
  return parts;
}

/**
 * True when `block` is nothing but imports, `export … from` re-exports,
 * comments and blank lines.
 *
 * Written as a consume-from-the-front loop rather than one whole-string regex
 * so that a multi-line import — the `import {\n  a,\n  b,\n} from 'x'` shape
 * prettier produces — is recognised as the single statement it is. Each pass
 * removes one construct from the head of the text; if nothing matches and text
 * remains, the block holds something we do not positively recognise and the
 * answer is no.
 */
const CONSTRUCT = new RegExp(
  [
    String.raw`^\s*\/\/[^\n]*`, //                                 line comment
    String.raw`^\s*\/\*[\s\S]*?\*\/`, //                           block comment
    String.raw`^\s*(?:import|export)\s[\s\S]*?\sfrom\s*(['"])[^'"\n]*\1\s*;?`, // import/re-export with a source
    String.raw`^\s*import\s*(['"])[^'"\n]*\2\s*;?`, //             side-effect import
  ].join('|'),
);

function isImportOnly(block) {
  let text = block.join('\n');
  while (text.trim() !== '') {
    const match = CONSTRUCT.exec(text);
    if (!match || match[0].length === 0) return false;
    text = text.slice(match[0].length);
  }
  return true;
}

/**
 * The local names a block of imports binds into the module scope.
 *
 * `import A, { B as C, D } from 'x'` binds A, C and D — the names that would
 * collide if the other side bound them too. A side-effect import binds nothing.
 * Only the clause before `from` is examined, so the module specifier (which the
 * two sides are expected to differ on) never counts as a binding.
 */
function bindings(block) {
  const names = new Set();
  const text = block.join('\n');
  const statement = /(?:import|export)\s+([\s\S]*?)\s+from\s*['"]/g;

  for (const [, clause] of text.matchAll(statement)) {
    const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause);
    if (namespace) names.add(namespace[1]);

    const braced = /\{([\s\S]*?)\}/.exec(clause);
    if (braced) {
      for (const entry of braced[1].split(',')) {
        const parts = entry.trim().split(/\s+as\s+/);
        const name = (parts[1] ?? parts[0]).trim();
        if (name) names.add(name);
      }
    }

    // The default binding is whatever sits before the first brace or star.
    const head = clause.split(/[{*]/)[0].replace(/,\s*$/, '').trim();
    if (/^[A-Za-z_$][\w$]*$/.test(head)) names.add(head);
  }

  return names;
}

/**
 * Decide a single hunk, returning the resolved lines or null to refuse it.
 *
 * AMS's lines lead and ours trail — the order every one of these has been
 * resolved by hand, kept so the file reads the same whichever route it took.
 */
function resolveHunk({ ours, base, theirs }) {
  if (base.some((line) => line.trim() !== '')) return null; // rule 1: not a pure insertion
  if (!isImportOnly(ours) || !isImportOnly(theirs)) return null; // rule 2: not only imports

  const ourNames = bindings(ours);
  const theirNames = bindings(theirs);
  const identical = new Set(ours.map((line) => line.trim()));
  for (const name of theirNames) {
    // Rule 3. A name both sides bind is a real disagreement — unless it arrives
    // on a line the two sides spell identically, which is duplication, not
    // conflict, and is dropped below.
    if (ourNames.has(name) && !theirs.every((line) => identical.has(line.trim()) || !bindings([line]).has(name))) {
      return null;
    }
  }

  const seen = new Set();
  const out = [];
  for (const line of [...theirs, ...ours]) {
    const key = line.trim();
    if (key !== '' && seen.has(key)) continue; // the same import added by both sides
    if (key !== '') seen.add(key);
    out.push(line);
  }

  // Collapse a run of blank lines the concatenation may have left in the middle.
  return out.filter((line, at) => line.trim() !== '' || at === 0 || out[at - 1].trim() !== '');
}

/* ─────────────────── the named-import specifier list ───────────────────── */

/**
 * The second shape of the same conflict, which cost the deploy of 2026-09-12.
 *
 * The rules above work on whole import *statements*. They cannot help when
 * both sides edit the member list *inside* one statement, because the lines in
 * the hunk are then bare specifiers — `  Spinner,` — and none of them parses as
 * an import:
 *
 *     import {
 *       MenuList,
 *   <<<<<<<
 *       Spinner,          ← we added Spinner
 *   =======
 *       Modal,            ← AMS added the Modal family
 *       ModalOverlay,
 *   >>>>>>>
 *       Skeleton,
 *     } from '@chakra-ui/react';
 *
 * A shared Chakra import is the single most-edited line range in this repo and
 * in AMS both, so this is the shape most likely to keep recurring.
 *
 * A specifier list is a set, which makes the merge well-defined: the answer is
 * every member either side has, once each. The driver takes the UNION and never
 * honours a removal — if AMS dropped a member we still use, honouring that
 * would leave our code referencing an unbound name and only fail when a user
 * opened the screen; keeping a member AMS dropped costs, at worst, an unused
 * import, and if the export is genuinely gone the build says so before anything
 * is published. Those are not symmetrical either.
 *
 * It refuses, as everywhere else here, on anything it does not positively
 * recognise: a line in the list that is not a plain specifier, a list it cannot
 * see the `import {` and `} from '…'` ends of, or two sides binding the same
 * local name to different members.
 */
const SPECIFIER = /^\s*([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*,?\s*$/;
const LIST_OPENS = /^\s*(?:import|export)\b[^{}]*\{\s*$/;
const LIST_CLOSES = /^\s*\}\s*from\s*['"][^'"\n]*['"]\s*;?\s*$/;

/** `{ name, local, text }` for a specifier line, or null if it is not one. */
function specifier(line) {
  const match = SPECIFIER.exec(line);
  if (!match || line.trim() === '') return null;
  return { name: match[1], local: match[2] ?? match[1], text: line };
}

/**
 * Every line is a specifier — the test applied to both sides of a hunk.
 *
 * An empty side passes: that is the side that removed a member the other side
 * was adding next to, and the union below is what keeps the removal from
 * taking effect.
 */
function allSpecifiers(block) {
  return block.every((line) => specifier(line) !== null);
}

/** Case-insensitive, the order both this repo and AMS keep these lists in. */
const byName = (a, b) => a.local.toLowerCase().localeCompare(b.local.toLowerCase()) || a.local.localeCompare(b.local);

function isSorted(specs) {
  return specs.every((spec, at) => at === 0 || byName(specs[at - 1], spec) <= 0);
}

/**
 * Try to read the conflict at `index` as an edit inside one specifier list.
 *
 * Returns the three rewritten line blocks — what is left of the text before the
 * list, the merged list itself, and what is left of the text after it — or null
 * to decline. The caller splices them back in place of the three parts.
 */
function resolveSpecifierList(parts, index) {
  const hunk = parts[index];
  const before = parts[index - 1];
  const after = parts[index + 1];
  if (!before || before.type !== 'text' || !after || after.type !== 'text') return null;
  if (hunk.ours.length + hunk.theirs.length === 0) return null;
  if (!allSpecifiers(hunk.ours) || !allSpecifiers(hunk.theirs)) return null;
  if (hunk.base.some((line) => specifier(line) === null && line.trim() !== '')) return null;

  // Walk back to the `import {` that opens the list, over specifiers only.
  let open = before.lines.length - 1;
  while (open >= 0 && specifier(before.lines[open])) open -= 1;
  if (open < 0 || !LIST_OPENS.test(before.lines[open])) return null;

  // Walk forward to the `} from '…'` that closes it, over specifiers only. A
  // close that is not in this part means another conflict sits inside the same
  // list; one list rewritten around two independent hunks is past what this can
  // reason about, so it declines and the file goes to a human whole.
  let close = 0;
  while (close < after.lines.length && specifier(after.lines[close])) close += 1;
  if (close >= after.lines.length || !LIST_CLOSES.test(after.lines[close])) return null;

  const head = before.lines.slice(open + 1).map(specifier);
  const tail = after.lines.slice(0, close).map(specifier);
  // AMS's members lead and ours trail, the convention the rest of this file
  // follows; `head` and `tail` are the parts git merged without conflict.
  const all = [...head, ...hunk.theirs.map(specifier), ...hunk.ours.map(specifier), ...tail];

  const merged = [];
  const seen = new Map();
  for (const spec of all) {
    const already = seen.get(spec.local);
    // The same member, named the same way, reached here from both sides: one
    // copy. A local name bound to two different members is a real
    // disagreement — and emitting both would redeclare it — so decline.
    if (already) {
      if (already.name !== spec.name) return null;
      continue;
    }
    seen.set(spec.local, spec);
    merged.push(spec);
  }

  // Sort only a list that was already sorted on the way in. Reordering a list
  // somebody deliberately grouped would be a diff nobody asked for; leaving a
  // sorted one unsorted would be too.
  const sorted = isSorted(head.concat(tail)) ? merged.slice().sort(byName) : merged;

  const indent = /^\s*/.exec(sorted[0]?.text ?? '  ')[0];
  const lines = sorted.map((spec) => `${indent}${spec.name === spec.local ? spec.name : `${spec.name} as ${spec.local}`},`);

  return { before: before.lines.slice(0, open + 1), merged: lines, after: after.lines.slice(close) };
}

/* ──────────────────────────────── main ─────────────────────────────────── */

let clean;
try {
  clean = mergeFile({ diff3: false });
} catch (error) {
  console.error(`[merge-additive] ${realPath}: git merge-file failed (${error.message.split('\n')[0]}); leaving it to git.`);
  process.exit(1);
}

if (!clean.conflicted) {
  fs.writeFileSync(oursPath, clean.text);
  process.exit(0);
}

// Conflicted. Try to resolve it; on any doubt at all, write git's own ordinary
// two-sided markers so what a human opens is exactly what they would have seen
// without this driver installed.
const fallback = () => {
  fs.writeFileSync(oursPath, clean.text);
  process.exit(1);
};

let parts;
try {
  parts = parseConflicts(mergeFile({ diff3: true }).text);
} catch {
  fallback();
}

let hunks = 0;

// First pass: the hunks that are an edit inside one import's member list. They
// are rewritten in place because the resolution reaches past the hunk into the
// unconflicted text on either side of it — the rest of the same statement.
for (let at = 0; at < parts.length; at += 1) {
  if (parts[at].type !== 'conflict') continue;
  if (resolveHunk(parts[at])) continue; // the whole-statement rules have it
  const list = resolveSpecifierList(parts, at);
  if (!list) continue; // leave it for the second pass to refuse
  parts[at - 1].lines = list.before;
  parts[at] = { type: 'text', lines: list.merged };
  parts[at + 1].lines = list.after;
  hunks += 1;
}

const resolved = [];
for (const part of parts) {
  if (part.type === 'text') {
    resolved.push(...part.lines);
    continue;
  }
  const lines = resolveHunk(part);
  if (!lines) fallback(); // one unresolvable hunk conflicts the whole file
  hunks += 1;
  resolved.push(...lines);
}

fs.writeFileSync(oursPath, resolved.join('\n'));
console.error(
  `[merge-additive] ${realPath}: auto-resolved ${hunks} import-only conflict${hunks === 1 ? '' : 's'} by keeping both sides.`,
);
process.exit(0);
