import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// VERCEL_ENV é "production" | "preview" | "development" — fonte confiável para distinguir ambientes.
// Preview usa aliases fixos no Vercel; atualizar via CLI quando necessário:
//   vercel deploy && vercel alias set <deploy-url> syncero-books-preview-jeanliimas-projects.vercel.app
export default defineConfig(() => {
  const vercelEnv = process.env.VERCEL_ENV ?? ''

  let landingUrl: string
  let flowUrl: string

  if (vercelEnv === 'production') {
    landingUrl = process.env.VITE_LANDING_URL ?? 'https://syncero.vercel.app'
    flowUrl    = process.env.VITE_FLOW_URL    ?? 'https://syncero-flow.vercel.app'
  } else if (vercelEnv === 'preview') {
    // branchAlias do Vercel — URL canônica por projeto+branch, estável e sem redirect.
    // Atualizar quando o nome do branch mudar (novo PR).
    landingUrl = 'https://syncero-git-claude-sad-aryabhata-42e05c-jeanliimas-projects.vercel.app'
    flowUrl    = 'https://syncero-flow-git-claude-sad-aryabhat-fa9536-jeanliimas-projects.vercel.app'
  } else {
    // Desenvolvimento local
    landingUrl = process.env.VITE_LANDING_URL ?? 'http://localhost:5173'
    flowUrl    = process.env.VITE_FLOW_URL    ?? 'http://localhost:5174'
  }

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
      alias: {
        '@': '/src',
        '@syncero/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      },
    },
    server: { port: 5175 },
    define: {
      'import.meta.env.VITE_LANDING_URL': JSON.stringify(landingUrl),
      'import.meta.env.VITE_FLOW_URL':    JSON.stringify(flowUrl),
    },
  }
})
