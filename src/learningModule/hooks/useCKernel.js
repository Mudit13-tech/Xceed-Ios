import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Owns the C kernel for a notebook page.
 *
 * Deliberately the same shape as `usePyodide` — `{ status, detail, busyCellId,
 * start, restart, runCell, stop }` — so a page picks a kernel by language and
 * otherwise cannot tell which one it has. `useNotebookKernel` is the picker.
 *
 * The toolchain (clang, wasm-ld and a WASI sysroot, ~52MB) is fetched from a
 * CDN at first use rather than bundled, for the same reason Pyodide is: putting
 * it in the app bundle would slow every page in the platform down to pay for
 * one. `VITE_CLANG_URL` points it at a self-hosted mirror for a campus network
 * that blocks the CDN, or for offline use.
 *
 * Stopping a run means terminating the worker, exactly as it does for Python —
 * a `while (1) {}` in a compiled program cannot be interrupted cooperatively,
 * so Stop is a kernel restart and the UI says so.
 */

const CLANG_URL = import.meta.env.VITE_CLANG_URL || 'https://runno.dev/langs/';

export default function useCKernel() {
  // 'idle' until something actually needs C — a notebook that is only being
  // read should not pull fifty megabytes.
  const [status, setStatus] = useState('idle');
  const [detail, setDetail] = useState('');
  const [busyCellId, setBusyCellId] = useState(null);

  const workerRef = useRef(null);
  // Resolver for the run currently in flight, keyed so a stale worker's late
  // message cannot resolve a newer run.
  const pendingRef = useRef(null);

  const teardown = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (pendingRef.current) {
      pendingRef.current.reject(new Error('The kernel was stopped.'));
      pendingRef.current = null;
    }
    setBusyCellId(null);
  }, []);

  useEffect(() => teardown, [teardown]);

  const spawn = useCallback(() => {
    // A module worker rather than a file in /public: this one imports an npm
    // package, so it wants the bundler. The Python worker cannot, because it
    // needs `importScripts` to pull Pyodide, which a module worker forbids.
    const worker = new Worker(new URL('../workers/cWorker.js', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const message = event.data || {};
      const pending = pendingRef.current;

      if (message.type === 'status') {
        if (message.phase === 'ready') {
          setStatus('ready');
          setDetail('');
        } else if (message.phase === 'failed') {
          setStatus('failed');
          setDetail(message.detail);
          teardown();
        } else {
          setDetail(message.detail);
        }
        return;
      }

      if (!pending || pending.id !== message.id) return;

      if (message.type === 'stream') {
        pending.onOutput({ type: message.stream, text: message.text });
      } else if (message.type === 'done') {
        pendingRef.current = null;
        setBusyCellId(null);
        pending.resolve({ result: message.result, error: message.error, ms: message.ms });
      }
    };

    worker.onerror = (event) => {
      setStatus('failed');
      setDetail(event.message || 'The C kernel crashed.');
      teardown();
    };

    return worker;
  }, [teardown]);

  const boot = useCallback(
    (label) => {
      setStatus('loading');
      setDetail(label);
      spawn().postMessage({ type: 'init', baseURL: CLANG_URL });
    },
    [spawn],
  );

  /** Starts the kernel. Safe to call repeatedly; only the first does work. */
  const start = useCallback(() => {
    if (workerRef.current) return;
    boot('Starting the C compiler…');
  }, [boot]);

  /** Throws away the kernel and starts a clean one — the notebook "restart". */
  const restart = useCallback(() => {
    teardown();
    boot('Restarting the C compiler…');
  }, [boot, teardown]);

  /**
   * Compiles, links and runs one cell.
   *
   * `prelude` is the notebook's hidden setup, prepended to the cell before it
   * is compiled — C has no kernel state to carry between cells, so shared
   * headers and helpers have to arrive as source every time.
   *
   * `onOutput` is called as output arrives rather than only at the end, so a
   * long loop prints progressively the way it would in a terminal.
   */
  const runCell = useCallback(
    (cellId, code, onOutput, { stdin = '', prelude = [] } = {}) =>
      new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('The C compiler is not running yet.'));
          return;
        }
        if (pendingRef.current) {
          reject(new Error('Another cell is still running.'));
          return;
        }
        const id = `${cellId}:${Date.now()}`;
        pendingRef.current = { id, resolve, reject, onOutput };
        setBusyCellId(cellId);
        workerRef.current.postMessage({ type: 'run', id, code, stdin, prelude });
      }),
    [],
  );

  /** Kills whatever is running. The kernel goes with it; see the note above. */
  const stop = useCallback(() => {
    teardown();
    setStatus('idle');
    setDetail('Stopped.');
  }, [teardown]);

  // `kernelPackages` is null forever: C has no package installer, and the
  // shape is here only so the two kernels stay interchangeable.
  return { status, detail, busyCellId, kernelPackages: null, start, restart, runCell, stop };
}
