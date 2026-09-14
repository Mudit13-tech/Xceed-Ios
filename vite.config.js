import { readFileSync } from 'node:fs'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { mobileOverrides } from './build/mobileOverrides.js'

/**
 * Publish the app's version as a <meta> tag, for the query cache buster in
 * src/main.jsx to read at runtime.
 *
 * It cannot go back to being a `define`. As __APP_VERSION__ it was inlined into
 * the module graph, and because src/main.jsx lands in the chunk every route
 * imports, each new version renamed that chunk, rewrote the import path inside
 * ~270 route chunks, and changed their hashes too - 9.79 MB of output churning
 * on a release with no source change at all, which a delta OTA then made every
 * user download.
 *
 * index.html is the one place a per-release value costs nothing: no JavaScript
 * imports it, so nothing can be renamed by it changing, and it already differs
 * on every release anyway because it names the hashed entry chunk.
 *
 * Read inside the hook rather than at module load so a long-lived dev server
 * does not serve a version from whenever it started. Note this is the version
 * *at build time*, one behind what the bundle publishes as - deploy-ota.cjs
 * builds first and bumps afterwards. That is fine for a buster, which only has
 * to differ between releases rather than name one.
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
 * Doing it here rather than in index.html is the same argument the rest of this
 * repo makes: index.html is AMS's and the web team edits it, so a directive
 * written into it is a line the next sync can take away. A transform is ours,
 * lives in a file AMS has no counterpart for, and applies to whatever
 * index.html says at the time -- including one upstream rewrites.
 *
 * Existing directives are preserved and only missing ones appended, so this
 * stays correct if upstream sets any of them itself.
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
          return `<meta name="viewport" content="${parts.join(', ')}" />`
        }
      )
    },
  }
}

// Buffers Vite's own console output (startup/HMR/build-error messages) and
// serves it at /__console-logs on the dev server's own origin, so the React
// Console page can show it the same way the Python ML service exposes its
// own /logs endpoint. Dev-only — this plugin only runs under `vite dev`.
function consoleBufferPlugin() {
  const MAX_LINES = 500
  const buffer = []

  function push(level, message) {
    buffer.push({ timestamp: new Date().toISOString(), level, logger: 'vite', message })
    if (buffer.length > MAX_LINES) buffer.shift()
  }

  return {
    name: 'console-buffer',
    configureServer(server) {
      const logger = server.config.logger
      const original = {
        info: logger.info.bind(logger),
        warn: logger.warn.bind(logger),
        error: logger.error.bind(logger),
      }
      logger.info = (msg, options) => { push('INFO', msg); original.info(msg, options) }
      logger.warn = (msg, options) => { push('WARN', msg); original.warn(msg, options) }
      logger.error = (msg, options) => { push('ERROR', msg); original.error(msg, options) }

      server.middlewares.use('/__console-logs', (req, res) => {
        const url = new URL(req.url, 'http://internal')
        const limit = parseInt(url.searchParams.get('limit'), 10) || 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({ logs: buffer.slice(-limit), total: buffer.length }))
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [mobileOverrides({ verbose: true }), react(), consoleBufferPlugin(), appVersionMeta(), mobileViewport()],
  build: {
    // Writes dist/.vite/manifest.json: every chunk with the chunks it pulls in.
    // Kept on so the cost of a route can be measured rather than guessed at —
    // see scripts/routeWeight.js. Costs a few KB that is never served.
    manifest: true,
    rollupOptions: {
      output: {
        /**
         * Pull the libraries that never change out of the app's own chunk.
         *
         * Not about total bytes — those are the same either way. It is about what
         * a *returning* visitor has to fetch after a deploy. React, the router and
         * Chakra move a few times a year; the app moves several times a week. In
         * one chunk, every deploy invalidates all of it and everyone re-downloads
         * the framework they already had.
         *
         * Only the three that are genuinely on every page. The heavy occasional
         * libraries — the PDF writers, xlsx, CodeMirror, recharts, Quill — are
         * deliberately *not* named here: naming them would pull them back into a
         * chunk fetched up front, undoing the route splitting that keeps them out
         * of the hands of people who never export a PDF.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('@chakra-ui') || id.includes('@emotion')) return 'vendor-chakra';
          // React itself is deliberately not named. A rule for it produced a
          // 0.19 kB chunk — the bundler already places react and react-dom well
          // on their own, and a near-empty chunk called `vendor-react` would
          // suggest the framework lives there when it does not.
          return undefined;
        },
      },
    },
  },
  server: {
    /* Listen on both IP stacks, not just the one Node picks.
       Vite's default binds `localhost`, which on Windows resolves to IPv6 and
       leaves `127.0.0.1:5173` refusing connections outright. An ordinary browser
       hides that — it resolves both and retries — but a client that picks IPv4
       and does not fall back simply cannot reach the dev server, which is how
       this surfaced: Safe Exam Browser reporting the site as unreachable, with
       nothing wrong on SEB's side at all.

       Note this also makes the dev server reachable from the local network. */
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8010',
        changeOrigin: true,
      },
    },
  },
})
