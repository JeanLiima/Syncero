import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Busca o branchAlias real de um projeto irmão via API Vercel.
// Requer VERCEL_TOKEN configurado como env var de Preview no painel Vercel.
// O branchAlias é estável por branch+projeto — retorna o alias de qualquer
// deploy anterior do mesmo branch (o hash de truncagem varia por projeto e
// não é reproduzível sem a API).
async function getSiblingAlias(projectId: string, branch: string): Promise<string> {
  const token  = process.env.VERCEL_TOKEN ?? ''
  const teamId = 'team_ugTQMaYlYJET3z2zDs7B8K8n'
  if (!token || !branch) return ''
  try {
    const url  = `https://api.vercel.com/v6/deployments?teamId=${teamId}&projectId=${projectId}&meta-githubCommitRef=${encodeURIComponent(branch)}&limit=1`
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return ''
    const data = await res.json() as { deployments?: Array<{ meta?: { branchAlias?: string } }> }
    return data.deployments?.[0]?.meta?.branchAlias ?? ''
  } catch {
    return ''
  }
}

// VERCEL_ENV é "production" | "preview" | "development" — fonte confiável para distinguir ambientes.
export default defineConfig(async () => {
  const vercelEnv = process.env.VERCEL_ENV ?? ''
  const isPreview = vercelEnv === 'preview'

  let landingUrl: string
  let booksUrl: string

  if (vercelEnv === 'production') {
    landingUrl = process.env.VITE_LANDING_URL ?? 'https://syncero.vercel.app'
    booksUrl   = process.env.VITE_BOOKS_URL   ?? 'https://syncero-books.vercel.app'
  } else if (isPreview) {
    // Em preview, cada projeto Vercel gera um branchAlias com hash diferente
    // (depende do tamanho do nome do projeto). Buscamos o alias real via API
    // para garantir URLs corretas. VERCEL_TOKEN deve ser uma var de Preview.
    const branch = process.env.VERCEL_GIT_COMMIT_REF ?? ''
    const [landingAlias, booksAlias] = await Promise.all([
      getSiblingAlias('prj_HNBIF52QrbK81Ko4khxpMQ05Dpcr', branch),
      getSiblingAlias('prj_jQMFND7FLjqNSmhQfEVekNSRAzAT', branch),
    ])
    // Fallback para produção se ainda não houver deploy anterior no branch
    // (ex: primeiro commit de um PR novo — corrige-se automaticamente no 2º deploy)
    landingUrl = landingAlias ? `https://${landingAlias}` : 'https://syncero.vercel.app'
    booksUrl   = booksAlias   ? `https://${booksAlias}`   : 'https://syncero-books.vercel.app'
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
