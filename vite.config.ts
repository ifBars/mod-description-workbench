import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const tauriDevHost = process.env.TAURI_DEV_HOST

export default defineConfig({
  base: process.env.PAGES_BUILD ? '/mod-description-workbench/' : '/',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 600 },
  clearScreen: false,
  server: {
    host: tauriDevHost || false,
    port: 1420,
    strictPort: true,
    hmr: tauriDevHost ? { protocol: 'ws', host: tauriDevHost, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
})
