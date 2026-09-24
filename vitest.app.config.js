import { mergeConfig } from 'vitest/config'

import webConfig from './vitest.config.js'
import { mobileOverrides } from './build/mobileOverrides.js'

/**
 * The app's tests: AMS's vitest.config.js, unedited, with the overrides plugin
 * added. Same reasoning as vite.app.config.js: wrapped rather than edited, so a
 * sync can never conflict on it.
 *
 * With the plugin, AMS's own tests import our `.mobile` files. That is the
 * point: they check the app's code, not the web code beside it. The mobile
 * implementations take their web path when `isNativeApp()` is false, which it
 * always is under jsdom, so a web-behaviour test still passes against them.
 *
 * The app version reaches src/mobile/queryCache.mobile.js through a <meta> tag
 * that vite.app.config.js injects into index.html. Nothing renders index.html
 * under jsdom, so it falls back to 'dev', which is right: no test persists a
 * cache worth busting.
 */
export default mergeConfig(webConfig, {
  plugins: [mobileOverrides()],
})
