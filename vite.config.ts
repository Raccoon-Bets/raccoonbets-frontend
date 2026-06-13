import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    server: {
      // Group tenants live on subdomains, so dev serves apex and wildcard
      // subdomains of lvh.me (which resolves to 127.0.0.1).
      host: true,
      allowedHosts: ['.lvh.me'],
      // Mirror production's same-origin OAuth (prod does this in nginx): the
      // apex brokers the OmniAuth handshake, so proxy /auth/* to the dev
      // backend. Leaving changeOrigin off keeps the incoming Host (lvh.me:5173),
      // so the backend builds its callback URL on the apex and the `state`
      // cookie stays first-party to the apex across the provider round trip.
      proxy: {
        '/auth': {
          target: env.VITE_API_URL || 'http://api.lvh.me:5000',
        },
      },
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
  }
})
