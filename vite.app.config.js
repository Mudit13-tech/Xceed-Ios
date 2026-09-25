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
 * Settle the viewport at build time, because iOS only reads half of it once.
 *
 * Two separate faults came from the same place, and both were invisible in a
 * browser:
 *
 *  viewport-fit=cover. Without it iOS reports every safe-area inset as 0, which
 *  makes env(safe-area-inset-top) useless and src/mobile/safeArea.js -- the
 *  whole mechanism that keeps a sticky header clear of the Dynamic Island -- a
 *  no-op. safeArea.js knows it needs the directive and adds it by setting the
 *  meta tag's content at runtime, which was the only option available from a
 *  module: index.html is AMS's. It does not work. WKWebView re-reads width and
 *  scale from a mutated viewport tag but resolves viewport-fit when it parses
 *  the document, so a directive that arrives after load never takes effect and
 *  the insets stay 0 forever. Nothing errors; the padding is simply always
 *  zero.
 *
 *  maximum-scale. iOS zooms the page in whenever a focused form control
 *  computes to less than 16px, and -- in a WebView, with no browser chrome
 *  offering a way back -- never zooms out again. Tapping the comment box left
 *  the app stuck at ~1.3x with the Post button off the right edge, for the rest
 *  of the session. Capping the scale removes the behaviour rather than
 *  correcting it afterwards.
 *
 * It belongs in this file for the reason at the top of it: index.html is AMS's,
 * so a directive written into it is a line the next sync can take away, and
 * none of this should reach the web build in any case. A transform applies to
 * whatever index.html says at the time -- including one upstream rewrites.
 *
 * Existing directives are preserved and only missing ones appended, so this
 * stays correct if upstream sets any of them itself.
 *
 * Android gets the original tag back, before anything reads it. This is one
 * bundle for both platforms, so "at build time" would otherwise mean "on
 * Android too", where both directives do harm:
 *
 *  viewport-fit=cover. Capacitor's SystemBars reads the tag at DOMContentLoaded
 *  (capacitorSystemBarsCheckMetaViewport) and, finding cover on WebView 140+,
 *  stops padding the WebView clear of the system bars and leaves the page to
 *  pad itself with env(safe-area-inset-*). Nothing does that on Android --
 *  safeArea.js is iOS only -- so on Android 15+, where edge-to-edge is
 *  enforced, the header would slide under the status bar. Over OTA, no store
 *  build needed.
 *
 *  maximum-scale / user-scalable=no. Android's WebView honours these, so they
 *  would take away pinch-zoom on the timetable and certificate previews, the
 *  screens index.mobile.css keeps it for. The zoom they prevent is WebKit's.
 *
 * The script runs during parsing, after Capacitor's bridge (injected at
 * document start) and before DOMContentLoaded. It restores only on a positive
 * 'android', so an iOS build that somehow ran it early still keeps cover.
 */
function mobileViewport() {
  // user-scalable=no is belt and braces to maximum-scale, not a second policy:
  // WebKit has honoured one and ignored the other at different times.
  const REQUIRED = ['viewport-fit=cover', 'maximum-scale=1.0', 'user-scalable=no']

  return {
    name: 'mobile-viewport',
    transformIndexHtml(html) {
      return html.replace(
        /<meta\s+name="viewport"[^>]*content="([^"]*)"[^>]*>/i,
        (tag, content) => {
          const parts = content.split(',').map((part) => part.trim()).filter(Boolean)
          const present = new Set(parts.map((part) => part.split('=')[0].trim()))
          for (const directive of REQUIRED) {
            if (!present.has(directive.split('=')[0])) parts.push(directive)
          }
          const restoreOnAndroid =
            '<script>(function(){var c=window.Capacitor;' +
            "if(!c||!c.getPlatform||c.getPlatform()!=='android')return;" +
            'var m=document.querySelector(\'meta[name="viewport"]\');' +
            `if(m)m.setAttribute('content',${JSON.stringify(content)});})()</script>`
          return `<meta name="viewport" content="${parts.join(', ')}" />\n    ${restoreOnAndroid}`
        }
      )
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
  plugins: [
    mobileOverrides({ verbose: true }),
    appVersionMeta(),
    mobileViewport(),
    excludeWebOnlyAssets(),
  ],
})
