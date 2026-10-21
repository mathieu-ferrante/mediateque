/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// SINGLE=1 : version démo en un seul fichier HTML (aperçu sans installation)
const single = process.env.SINGLE === '1'

// BASE_PATH = "/nom-du-depot/" sur GitHub Pages (défini par le workflow de déploiement)
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  build: single ? { outDir: 'dist-demo', assetsInlineLimit: 100_000_000 } : undefined,
  plugins: single ? [react(), viteSingleFile()] : [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Médiathèque',
        short_name: 'Médiathèque',
        description: 'Films, séries, jeux et livres : ta pile, tes notes, ce soir je fais quoi.',
        lang: 'fr',
        theme_color: '#15100D',
        background_color: '#15100D',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            // polices Google, pour l'usage hors ligne
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'polices', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // affiches et couvertures : cache pour usage hors ligne
            urlPattern: /^https:\/\/(image\.tmdb\.org|images\.igdb\.com|books\.google\.com|covers\.openlibrary\.org)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'affiches',
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
