import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

import { mobileOverrides } from './build/mobileOverrides.js'

// The __APP_VERSION__ define that used to be mirrored here is gone from
// vite.config.js, so there is nothing left to mirror - see the note there for
// why the app's version is no longer baked into the bundle at all.

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
