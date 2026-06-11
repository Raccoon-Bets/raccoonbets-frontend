import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Group tenants live on subdomains, so dev serves apex and wildcard
    // subdomains of lvh.me (which resolves to 127.0.0.1).
    host: true,
    allowedHosts: ['.lvh.me'],
  },
  preview: {
    host: true,
    allowedHosts: ['.lvh.me'],
  },
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      manifest: false,
      injectRegister: 'script',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2}'],
        // Crawler/OS-only assets that are never needed offline.
        globIgnores: ['**/og-image.png', '**/mstile-*.png'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    sourcemap: true,
  },
})
