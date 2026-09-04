import { readFileSync } from 'node:fs'

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

import { mobileOverrides } from './build/mobileOverrides.js'

// Mirrors the define in vite.config.js. Vitest does not read that file, so
// without this every module referencing __APP_VERSION__ throws under test the
// moment one gets imported - a failure that would show up as an unrelated
// ReferenceError in whichever test happens to reach main.jsx first.
const { version: appVersion } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
)

export default defineConfig({
  plugins: [mobileOverrides(), react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
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
