import { readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

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

/**
 * Leave the web-only parts of public/ out of the app's build.
 *
 * Vite copies all of public/ into dist, and `cap sync` copies all of dist into
 * the APK. AMS's public/ carries 222 MB of explainer videos (and, when fetched,
 * the ~490 MB notebook runtimes). The app never loads them from the bundle:
 * mediaUrl in nativeCapabilities.mobile.js points the players at the API host,
 * and the notebooks load their runtimes from the web origin. Shipped anyway,
 * they made the APK ~258 MB.
 *
 * The list is the OTA's own (scripts/otaManifest.cjs), so the APK and an OTA
 * update always contain the same files. The web build is untouched: it runs
 * from vite.config.js, which never loads this plugin, and serves the videos
 * from public/ as before. The dev server also still serves public/.
 */
function excludeWebOnlyAssets() {
  const { BUNDLE_EXCLUDES } = createRequire(import.meta.url)('./scripts/otaManifest.cjs')
  let outDir
  return {
    name: 'exclude-web-only-assets',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      for (const dir of BUNDLE_EXCLUDES) {
        rmSync(path.join(outDir, dir), { recursive: true, force: true })
      }
    },
  }
}

// mobileOverrides is `enforce: 'pre'`, so it resolves ahead of AMS's plugins
// even though mergeConfig appends it after them.
export default mergeConfig(webConfig, {
  plugins: [mobileOverrides({ verbose: true }), appVersionMeta(), excludeWebOnlyAssets()],
})
