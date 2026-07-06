import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],

      manifest: {
        name: 'CineTrack',
        short_name: 'CineTrack',
        description: 'Suivi de films et séries — watchlist, notes, épisodes, stats.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#0B0D13',
        theme_color: '#0B0D13',
        lang: 'fr',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Assets du build (JS/CSS/HTML) — précachés à l'install, disponibles offline immédiatement
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],

        runtimeCaching: [
          // Affiches/backdrops TMDB — quasi immuables une fois publiées
          {
            urlPattern: /^https:\/\/image\.tmdb\.org\/t\/p\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tmdb-images',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 jours
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // API interne (watchlist, stats, épisodes, listes...) — SWR : réponse instantanée
          // depuis le cache, revalidation silencieuse en arrière-plan
          {
            urlPattern: /^\/api\/(watchlist|stats|episodes|lists)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-data',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }, // 1 jour
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Proxy TMDB de notre API (recherche, tendances, détail, recommandations, providers)
          {
            urlPattern: /^\/api\/tmdb\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-tmdb-proxy',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 6 }, // 6h — contenu qui bouge peu
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Ne PAS mettre en cache la config Cloudflare / les assets non-app
        navigateFallbackDenylist: [/^\/api\//],
      },

      devOptions: {
        enabled: false, // évite le SW en dev — Vite HMR seul suffit, pas de double-caching à déboguer
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
