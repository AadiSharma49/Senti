import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'

const REACT_REFRESH_PREAMBLE_PATH = '/@react-refresh-preamble.js'

/**
 * `@vitejs/plugin-react` injects an inline `<script type="module">` preamble
 * during `vite` dev serve. Externalizing it to a same-origin module URL lets
 * Electron's `onHeadersReceived` CSP keep `script-src` free of `'unsafe-inline'`
 * in development as well as production.
 */
function externalizeReactRefreshPreamble(): Plugin {
  let base = '/'
  return {
    name: 'externalize-react-refresh-preamble',
    apply: 'serve',
    enforce: 'post',
    configResolved(cfg) {
      base = cfg.base || '/'
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === REACT_REFRESH_PREAMBLE_PATH) {
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(react.preambleCode.replace('__BASE__', base))
          return
        }
        next()
      })
    },
    transformIndexHtml(html) {
      const src = `${base.replace(/\/$/, '')}${REACT_REFRESH_PREAMBLE_PATH}`
      return html.replace(
        /<script type="module">\s*import \{ injectIntoGlobalHook \} from "[^"]*\/@react-refresh";[\s\S]*?<\/script>/,
        `<script type="module" src="${src}"></script>`
      )
    },
  }
}

function removeCrossOrigin(): Plugin {
  return {
    name: 'remove-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '')
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    externalizeReactRefreshPreamble(),
    removeCrossOrigin(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'ws'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: false,
            rollupOptions: {
              input: 'electron/preload.ts',
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
              },
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    modulePreload: false,
    assetsInlineLimit: 0,
  },
})