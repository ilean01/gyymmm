import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/gyymmm/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '/gyymmm/',
        name: 'GymBro',
        short_name: 'GymBro',
        description:
          'PWA personal para registrar entrenamientos, rutinas y progreso dentro y fuera del gimnasio.',
        lang: 'es',
        start_url: '/gyymmm/',
        scope: '/gyymmm/',
        display: 'standalone',
        background_color: '#0B0D12',
        theme_color: '#0B0D12',
        categories: ['fitness', 'sports'],
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
})
