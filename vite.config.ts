import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pagesBasePath = process.env.VITE_BASE_PATH ?? '/cuentopolis/'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? pagesBasePath : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'image' &&
              (url.hostname === 'lh3.googleusercontent.com' ||
                url.pathname.endsWith('/api/image')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'cuentopolis-drive-cover-images',
              cacheableResponse: {
                statuses: [200],
              },
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'audio' &&
              (url.pathname.endsWith('/api/audio') ||
                url.hostname === 'drive.google.com' ||
                url.hostname === 'drive.usercontent.google.com' ||
                url.hostname.endsWith('.googleusercontent.com')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'cuentopolis-story-audio',
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
              rangeRequests: true,
            },
          },
        ],
      },
      manifest: {
        name: 'CuentoPolis',
        short_name: 'CuentoPolis',
        description: 'Historias interactivas que cobran vida',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
}))
