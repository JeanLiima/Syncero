import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// VERCEL_ENV é "production" | "preview" | "development" — fonte confiável para distinguir ambientes.
// VERCEL_BRANCH_URL só é usado em preview para derivar as URLs dos apps irmãos.
export default defineConfig(() => {
  const vercelEnv = process.env.VERCEL_ENV ?? ''
  const isPreview = vercelEnv === 'preview'

  let landingUrl: string
  let booksUrl: string

  if (vercelEnv === 'production') {
    landingUrl = process.env.VITE_LANDING_URL ?? 'https://syncero.vercel.app'
    booksUrl   = process.env.VITE_BOOKS_URL   ?? 'https://syncero-books.vercel.app'
  } else if (isPreview) {
    // VERCEL_BRANCH_URL: host do branch atual sem https://, ex: "syncero-flow-git-meu-pr-team.vercel.app"
    // Não usar VITE_*_URL aqui — são vars fixas de produção e sobrescrevem a URL dinâmica do PR.
    const branchHost = process.env.VERCEL_BRANCH_URL ?? ''
    const gitIdx     = branchHost.indexOf('-git-')
    const gitSuffix  = gitIdx !== -1 ? branchHost.slice(gitIdx) : ''
    landingUrl = `https://syncero${gitSuffix}`
    booksUrl   = `https://syncero-books${gitSuffix}`
  } else {
    // Desenvolvimento local
    landingUrl = process.env.VITE_LANDING_URL ?? 'http://localhost:5173'
    booksUrl   = process.env.VITE_BOOKS_URL   ?? 'http://localhost:5175'
  }

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
      alias: {
        '@': '/src',
        '@syncero/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      },
    },
    server: { port: 5174 },
    define: {
      'import.meta.env.VITE_LANDING_URL': JSON.stringify(landingUrl),
      'import.meta.env.VITE_BOOKS_URL':   JSON.stringify(booksUrl),
    },
  }
})
