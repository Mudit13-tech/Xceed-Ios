import { readFileSync } from 'node:fs'

import { mergeConfig } from 'vite'

import webConfig from './vite.config.js'
import { mobileOverrides } from './build/mobileOverrides.js'

/**
 * The app's build: AMS's vite.config.js, unedited, plus what only the app needs.
 *
 * vite.config.js arrives from AMS on every sync, so editing it here guarantees
 * a conflict the next time the web team touches it. Wrapping it can't conflict,
 * because nothing upstream ever touches this file, and it still inherits every
 * change they make to theirs. `package.json`'s dev/build/preview scripts point
 * here. See src/mobile/README.md for the other half of the arrangement.
 */

/**
 * Publish the app's version as a <meta> tag, for the query cache buster in
 * src/mobile/queryCache.mobile.js to read at runtime.
 *
 * It cannot be a `define`. Inlined into the module graph, a new version renamed
 * the chunk every route imports, rewrote the import path inside ~270 route
 * chunks and changed their hashes too: 9.79 MB of output churning on a release
 * with no source change, which a delta OTA then made every user download.
 * index.html is imported by no JavaScript, so a per-release value there renames
 * nothing.
 *
 * Read inside the hook so a long-lived dev server does not serve a version from
 * whenever it started. This is the version *at build time*, one behind what the
 * bundle publishes as (deploy-ota.cjs builds first and bumps afterwards). That
 * is fine for a buster, which only has to differ between releases.
 */
function appVersionMeta() {
  return {
    name: 'app-version-meta',
    transformIndexHtml() {
      const { version } = JSON.parse(
        readFileSync(new URL('./package.json', import.meta.url), 'utf8')
      )
      return [{ tag: 'meta', attrs: { name: 'app-version', content: version }, injectTo: 'head' }]
    },
  }
}

// mobileOverrides is `enforce: 'pre'`, so it resolves ahead of AMS's plugins
// even though mergeConfig appends it after them.
export default mergeConfig(webConfig, {
  plugins: [mobileOverrides({ verbose: true }), appVersionMeta()],
})
