import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // VERCEL_BRANCH_URL ex: "syncero-flow-git-fix-branch-jeanliimas-projects.vercel.app"
  // Deriva a landing URL removendo o prefixo "syncero-flow" e mantendo o sufixo "-git-..."
  const branchHost = process.env.VERCEL_BRANCH_URL ?? env.VERCEL_BRANCH_URL ?? ''
  const gitIdx     = branchHost.indexOf('-git-')
  const gitSuffix  = gitIdx !== -1 ? branchHost.slice(gitIdx) : ''
  const isPreview  = gitSuffix !== ''

  const landingUrl = env.VITE_LANDING_URL ?? (isPreview ? `https://syncero${gitSuffix}`  : 'https://syncero.vercel.app')
  const booksUrl   = env.VITE_BOOKS_URL   ?? (isPreview ? `https://syncero-books${gitSuffix}` : 'https://syncero-books.vercel.app')

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/*.png'],
        manifest: {
          name: 'Syncero Flow',
          short_name: 'Flow',
          description: 'Capture financeiro para empresas — Syncero Flow',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: { '@': '/src' },
    },
    server: { port: 5174 },
    define: {
      'import.meta.env.VITE_LANDING_URL': JSON.stringify(landingUrl),
      'import.meta.env.VITE_BOOKS_URL':   JSON.stringify(booksUrl),
    },
  }
})
