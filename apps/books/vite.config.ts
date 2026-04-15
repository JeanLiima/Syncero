import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // VERCEL_ENV é "production" | "preview" | "development" — fonte confiável para distinguir ambientes.
  // VERCEL_BRANCH_URL só é usado em preview para derivar as URLs dos apps irmãos.
  const vercelEnv  = process.env.VERCEL_ENV ?? env.VERCEL_ENV ?? ''
  const isPreview  = vercelEnv === 'preview'
  const branchHost = isPreview ? (process.env.VERCEL_BRANCH_URL ?? env.VERCEL_BRANCH_URL ?? '') : ''
  const gitIdx     = branchHost.indexOf('-git-')
  const gitSuffix  = gitIdx !== -1 ? branchHost.slice(gitIdx) : ''

  const landingUrl = env.VITE_LANDING_URL ?? (isPreview ? `https://syncero${gitSuffix}`      : 'https://syncero.vercel.app')
  const flowUrl    = env.VITE_FLOW_URL    ?? (isPreview ? `https://syncero-flow${gitSuffix}` : 'https://syncero-flow.vercel.app')

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/*.png'],
        manifest: {
          name: 'Syncero Books',
          short_name: 'Books',
          description: 'Gestão contábil para contadores — Syncero Books',
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
    server: { port: 5175 },
    define: {
      'import.meta.env.VITE_LANDING_URL': JSON.stringify(landingUrl),
      'import.meta.env.VITE_FLOW_URL':    JSON.stringify(flowUrl),
    },
  }
})
