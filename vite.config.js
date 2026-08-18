import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react(), consoleBufferPlugin()],
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
    proxy: {
      '/api': {
        target: 'http://localhost:8010',
        changeOrigin: true,
      },
    },
  },
})
