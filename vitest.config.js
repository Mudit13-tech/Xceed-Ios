import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

import { mobileOverrides } from './build/mobileOverrides.js'

// This used to mirror vite.config.js's __APP_VERSION__ define, without which
// every module referencing it threw under test. There is no define to mirror
// any more: the app's version now reaches src/main.jsx through a <meta> tag
// that vite.config.js injects into index.html, so that a new version cannot
// rename the chunk every route imports. See the note there.
//
// Deliberately not reproduced for tests. Nothing renders index.html under
// jsdom, so the tag is absent and main.jsx falls back to 'dev' - which is
// correct, since no test persists a query cache worth busting. Should a test
// ever need a real version there, set the meta tag in src/test/setup.js rather
// than reintroducing a define here; a define would put the value back inside
// the module graph, which is the whole thing this avoids.

export default defineConfig({
  plugins: [mobileOverrides(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    /**
     * Vitest defaults to 5s per test, which this suite outgrew.
     *
     * Most page tests reach their component through `await import('../pages/X')`
     * inside the test body, so the first test in each file pays for
     * transforming and importing that page and everything under it — and pays
     * for it inside the per-test budget. Alone that costs a fraction of a
     * second; across 70-odd files running in parallel it does not, and whichever
     * files lose the scheduling race fail with "Test timed out in 5000ms"
     * while passing on their own. That was flaky in the worst way: a different
     * handful of files each run, none of them actually broken.
     *
     * These are wall-clock ceilings for work that is genuinely slow under
     * contention, not a symptom being papered over — nothing here hangs, and a
     * test that really does deadlock still fails, twenty seconds later.
     */
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
