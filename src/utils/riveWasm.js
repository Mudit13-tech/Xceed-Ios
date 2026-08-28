/**
 * Point Rive's WebAssembly runtime at our own copy of it.
 *
 * `@rive-app/canvas` fetches `rive.wasm` from unpkg by default, with jsdelivr as
 * its fallback. Both are third-party origins, and Safe Exam Browser's URL filter
 * only lets through the exam's own host — so inside SEB the fetch is refused,
 * the runtime never initialises, and every Rive animation renders as an empty
 * box with nothing in the console a student could report. The same happens on an
 * exam LAN with no route to the internet.
 *
 * Importing the file through Vite (rather than copying it into `public/`) keeps
 * it in step with the installed package: the emitted asset is whatever version
 * of the wasm the resolved `@rive-app/canvas` ships, so a dependency bump cannot
 * leave a stale binary behind to mismatch the JS that loads it.
 *
 * Import this module for its side effect before rendering anything that uses
 * Rive; it is idempotent and safe to import from more than one place.
 */
import { RuntimeLoader } from '@rive-app/react-canvas';
import riveWasmUrl from '@rive-app/canvas/rive.wasm?url';

RuntimeLoader.setWasmUrl(riveWasmUrl);
// No CDN second chance: a fallback that can only fail turns "no animation" into
// "no animation, after a long wait for a blocked request to time out".
RuntimeLoader.setWasmFallbackUrl(null);
