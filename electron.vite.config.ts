import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { thirdPartyNotices } from './scripts/notices-plugin'

const shared = resolve(__dirname, 'src/shared')

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': shared } },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    resolve: { alias: { '@shared': shared } },
    build: {
      // Sandboxed preloads can only require('electron'), so they must not
      // share runtime code (Rollup would split it into a chunk). They import
      // types only; scripts/verify-preload.mjs enforces this after each build.
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/preload/overlay.ts'),
          settings: resolve(__dirname, 'src/preload/settings.ts')
        },
        output: { format: 'cjs' }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    publicDir: resolve(__dirname, 'src/renderer/public'),
    resolve: { alias: { '@shared': shared } },
    plugins: [
      react(),
      thirdPartyNotices({
        output: resolve(__dirname, 'out/THIRD_PARTY_NOTICES.txt'),
        oflText: readFileSync(resolve(__dirname, 'licenses/OFL-1.1.txt'), 'utf8')
      })
    ],
    // Required by @excalidraw/excalidraw when bundled with Vite.
    define: { 'process.env.IS_PREACT': JSON.stringify('false') },
    build: {
      chunkSizeWarningLimit: 6000,
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/renderer/overlay.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html')
        }
      }
    }
  }
})
