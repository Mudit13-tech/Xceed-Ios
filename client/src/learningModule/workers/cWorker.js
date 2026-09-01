/* eslint-env worker */

/**
 * The C kernel for coding notebooks.
 *
 * Real clang (LLVM 8.0.1, from binji's wasm-clang via the Runno project),
 * compiled to WebAssembly and driven through a WASI shim, running in a Web
 * Worker in the student's own browser. Nothing here touches the server — the
 * same constraint the Python kernel works under, for the same reason.
 *
 * ## Why a compiler and not an interpreter
 *
 * The obvious cheap option is a JavaScript C interpreter. The one that exists,
 * JSCPP, has no `struct`, no `union`, no `enum` and no `malloc` — which is most
 * of a C syllabus after week three. A real compiler costs ~52MB of downloads
 * and gives real diagnostics; an interpreter that cannot express a linked list
 * is not a cheaper version of that, it is a different and much worse thing.
 *
 * ## A C cell is a whole program
 *
 * There is no REPL for C and no state carried between cells, so each code cell
 * is compiled and linked on its own. Hidden cells are the *prelude* — headers,
 * typedefs, helper functions — textually prepended to every cell before it is
 * compiled. That is why `validateCells` on the server insists a visible cell
 * has `main` and a hidden one does not.
 *
 * Because the prelude is prepended, clang's line numbers are offset from what
 * the student sees. `shiftDiagnostics` puts them back.
 *
 * ## stdin is supplied up front
 *
 * `scanf` blocks in real C. Blocking a worker on input needs SharedArrayBuffer
 * and `Atomics.wait`, which need cross-origin isolation headers this app does
 * not send. So the input is a per-cell field the student fills in before
 * running, and the WASI `stdin` callback drains it. A program that asks for
 * more input than was supplied reads EOF, exactly as it would from a pipe.
 *
 * ── protocol ──────────────────────────────────────────────────────────────
 * in:  { type: 'init', baseURL }
 *      { type: 'run', id, code, stdin, prelude }
 * out: { type: 'status', phase, detail }
 *      { type: 'stream', id, stream: 'stdout'|'stderr', text }
 *      { type: 'done', id, result, error, ms }
 */

import { WASI } from '@runno/wasi';

/** Where clang.wasm, wasm-ld.wasm and clang-fs.tar.gz are served from. */
let baseURL = '';

/**
 * The toolchain, fetched once and kept.
 *
 * `WebAssembly.Module` rather than the bytes: compiling 50MB of wasm takes real
 * time, and a notebook runs a cell far more than once. The sysroot is kept as a
 * parsed file map for the same reason.
 */
let clangModule = null;
let linkerModule = null;
let sysroot = null;
let ready = false;
let running = false;

const post = (message) => self.postMessage(message);

const now = () => ({ access: new Date(), modification: new Date(), change: new Date() });

const textFile = (path, content) => ({ path, timestamps: now(), mode: 'string', content });
const binaryFile = (path, content) => ({ path, timestamps: now(), mode: 'binary', content });

/**
 * Reads a gzipped tar into a WASI file map.
 *
 * `DecompressionStream` is native, so the gzip half is free. The tar half is a
 * few lines because the format is fixed-size headers and 512-byte blocks — a
 * dependency for this would be more code to audit than the parser is.
 *
 * Only regular files are kept. Directories carry no content, and the WASI shim
 * takes a flat path map with no directory entries at all.
 */
async function untarGz(response) {
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());

  const files = {};
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    // Two consecutive zero blocks end the archive; one is enough to stop on.
    if (header[0] === 0) break;

    const name = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, '');
    // Size is octal, space/NUL padded.
    const size = parseInt(decoder.decode(header.subarray(124, 136)).replace(/[^0-7]/g, ''), 8) || 0;
    const typeflag = String.fromCharCode(header[156]);
    offset += 512;

    // '0' and '\0' are both "regular file"; the rest are directories, links and
    // the GNU extensions, none of which a sysroot needs to compile against.
    if (typeflag === '0' || typeflag === '\0') {
      const path = `/${name.replace(/^\.?\//, '')}`;
      files[path] = binaryFile(path, bytes.slice(offset, offset + size));
    }

    // Entries are padded up to the next 512-byte boundary.
    offset += Math.ceil(size / 512) * 512;
  }

  return files;
}

const CACHE_NAME = 'c-toolchain-v1';

/**
 * Fetches a resource using persistent CacheStorage when available.
 * On cache hit: returns the cached Response instantly with zero network delay.
 * On cache miss: downloads from network and caches the response for future visits.
 */
async function fetchCached(url) {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) {
        return cached;
      }
      const response = await fetch(url);
      if (response.ok) {
        try {
          await cache.put(url, response.clone());
        } catch {
          // Ignore quota / cache write errors
        }
      }
      return response;
    } catch {
      // Fallback if caches is not accessible
    }
  }
  return fetch(url);
}

/** Fetches and compiles one wasm binary, reporting progress as it goes. */
async function loadBinary(name, label) {
  post({ type: 'status', phase: 'loading', detail: `Downloading ${label}…` });
  const response = await fetchCached(`${baseURL}${name}`);
  if (!response.ok) throw new Error(`Could not fetch ${name} (HTTP ${response.status}).`);
  post({ type: 'status', phase: 'loading', detail: `Preparing ${label}…` });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/wasm') && typeof WebAssembly.compileStreaming === 'function') {
    try {
      return await WebAssembly.compileStreaming(response.clone());
    } catch {
      // Fall back to buffer compilation if compileStreaming fails
    }
  }
  return WebAssembly.compile(await response.arrayBuffer());
}

async function init(url) {
  baseURL = url.endsWith('/') ? url : `${url}/`;

  post({ type: 'status', phase: 'loading', detail: 'Starting C toolchain…' });

  // Parallelize downloading and compiling all three toolchain components simultaneously:
  // - clang compiler wasm module (~30MB)
  // - wasm-ld linker wasm module (~15MB)
  // - clang-fs WASI sysroot (~7MB tar.gz)
  const clangPromise = loadBinary('clang.wasm', 'the C compiler');
  const linkerPromise = loadBinary('wasm-ld.wasm', 'the linker');
  const sysrootPromise = (async () => {
    const response = await fetchCached(`${baseURL}clang-fs.tar.gz`);
    if (!response.ok) throw new Error(`Could not fetch the C standard library (HTTP ${response.status}).`);
    post({ type: 'status', phase: 'loading', detail: 'Unpacking the C standard library…' });
    return untarGz(response);
  })();

  const [clang, linker, fs] = await Promise.all([clangPromise, linkerPromise, sysrootPromise]);

  clangModule = clang;
  linkerModule = linker;
  sysroot = fs;

  ready = true;
  post({ type: 'status', phase: 'ready', detail: '' });
}

/**
 * Runs one WASI binary over a file map and returns what it produced.
 *
 * Deliberately not `WASI.start`, the static helper: that takes a `Response` and
 * instantiates it by streaming, which would recompile 31MB of clang on every
 * single cell run. Instantiating an already-compiled `WebAssembly.Module`
 * against the same import object does the same job and keeps the compile.
 */
async function runWasi(module, { args, fs, stdin = '', onStdout, onStderr }) {
  let remaining = stdin;

  const wasi = new WASI({
    fs,
    args,
    env: {},
    isTTY: false,
    // Drains in one go and then reports EOF. A C program looping on `scanf`
    // until it fails terminates rather than spinning on an empty string.
    stdin: () => {
      if (!remaining) return null;
      const chunk = remaining;
      remaining = '';
      return chunk;
    },
    stdout: onStdout || (() => {}),
    stderr: onStderr || (() => {}),
  });

  const instance = await WebAssembly.instantiate(module, wasi.getImportObject());
  return wasi.start({ instance, module });
}

/**
 * clang's argv.
 *
 * Taken from binji's wasm-clang, with two deliberate changes for a teaching
 * setting: `-Werror` is dropped, because failing a first-year exercise over an
 * unused variable teaches the wrong lesson, and colour diagnostics are off
 * because the ANSI escapes would render as noise in the output pane. `-Wall`
 * stays on so the warnings are still *seen*.
 */
const clangArgs = (sourcePath) => [
  'clang',
  '-cc1',
  '-triple',
  'wasm32-unkown-wasi',
  '-isysroot',
  '/sys',
  '-internal-isystem',
  '/sys/include',
  '-internal-isystem',
  '/sys/lib/clang/8.0.1/include',
  '-ferror-limit',
  '4',
  '-fmessage-length',
  '80',
  '-fno-color-diagnostics',
  '-Wall',
  '-O2',
  '-emit-obj',
  '-o',
  '/program.o',
  sourcePath,
];

const linkerArgs = () => [
  'wasm-ld',
  '--no-threads',
  '--export-dynamic',
  '-z',
  'stack-size=1048576',
  '-L/sys/lib/wasm32-wasi',
  '/sys/lib/wasm32-wasi/crt1.o',
  '/program.o',
  '-lc',
  '-o',
  '/program.wasm',
];

/**
 * Rewrites `main.c:12:5:` line numbers to account for the prepended prelude.
 *
 * Without this a student is told the error is on line 34 of a nine-line cell.
 * A diagnostic pointing into the prelude itself is left alone but relabelled,
 * so "this came from your teacher's setup, not your cell" is still legible.
 */
function shiftDiagnostics(text, preludeLines) {
  if (!preludeLines) return text;
  return text.replace(/^(\/?main\.c):(\d+):/gm, (match, file, line) => {
    const shifted = Number(line) - preludeLines;
    return shifted > 0 ? `${file}:${shifted}:` : `${file} (setup cell):${line}:`;
  });
}

async function run(id, code, stdin, prelude) {
  if (!ready) {
    post({ type: 'done', id, error: 'The C compiler is still loading.', ms: 0 });
    return;
  }
  if (running) {
    post({ type: 'done', id, error: 'Another cell is still running.', ms: 0 });
    return;
  }

  running = true;
  const startedAt = Date.now();

  const preludeText = (prelude || []).filter(Boolean).join('\n');
  const source = preludeText ? `${preludeText}\n${code}` : code;
  const preludeLines = preludeText ? preludeText.split('\n').length : 0;

  let error = null;
  let result = null;

  try {
    // ── compile ──
    const compileFS = { ...sysroot, '/main.c': textFile('/main.c', source) };
    let diagnostics = '';
    const compiled = await runWasi(clangModule, {
      args: clangArgs('/main.c'),
      fs: compileFS,
      onStderr: (text) => { diagnostics += text; },
      onStdout: (text) => { diagnostics += text; },
    });

    if (compiled.exitCode !== 0) {
      // A compile error is the student's answer, not a kernel failure — it goes
      // back as the cell's error with clang's own text, which is the useful part.
      error = shiftDiagnostics(diagnostics, preludeLines).trim() || 'The program did not compile.';
      return;
    }

    // Warnings on a successful compile are worth showing, but must not read as
    // a failure — they go to stderr the way a terminal would show them.
    if (diagnostics.trim()) {
      post({ type: 'stream', id, stream: 'stderr', text: shiftDiagnostics(diagnostics, preludeLines) });
    }

    // ── link ──
    const objectFile = compiled.fs['/program.o'];
    if (!objectFile) {
      error = 'The compiler produced no output.';
      return;
    }

    let linkErrors = '';
    const linked = await runWasi(linkerModule, {
      args: linkerArgs(),
      fs: { ...sysroot, '/program.o': objectFile },
      onStderr: (text) => { linkErrors += text; },
    });

    if (linked.exitCode !== 0 || !linked.fs['/program.wasm']) {
      // Overwhelmingly this is an undefined symbol — a function declared and
      // never defined, or a missing `main`.
      error = linkErrors.trim() || 'The program did not link.';
      return;
    }

    // ── run ──
    const program = linked.fs['/program.wasm'].content;
    const programModule = await WebAssembly.compile(program);

    const executed = await runWasi(programModule, {
      args: ['program'],
      fs: {},
      stdin: stdin || '',
      onStdout: (text) => post({ type: 'stream', id, stream: 'stdout', text }),
      onStderr: (text) => post({ type: 'stream', id, stream: 'stderr', text }),
    });

    // A notebook shows the value a cell produced; for C that is the exit
    // status, which is only worth saying when it is not the silent success.
    if (executed.exitCode !== 0) {
      result = `[exited with status ${executed.exitCode}]`;
    }
  } catch (thrown) {
    error = String(thrown?.message || thrown);
  } finally {
    running = false;
    post({ type: 'done', id, result, error, ms: Date.now() - startedAt });
  }
}

self.onmessage = async (event) => {
  const { type } = event.data || {};
  try {
    if (type === 'init') await init(event.data.baseURL);
    else if (type === 'run') await run(event.data.id, event.data.code, event.data.stdin, event.data.prelude);
  } catch (error) {
    post({ type: 'status', phase: 'failed', detail: String(error?.message || error) });
  }
};
