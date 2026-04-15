import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // VERCEL_ENV é "production" | "preview" | "development" — fonte confiável para distinguir ambientes.
  // VERCEL_BRANCH_URL só é usado em preview para derivar as URLs dos apps irmãos.
  // Não usar a presença de "-git-" na URL para detectar preview: builds de produção também têm
  // "-git-main-" em VERCEL_BRANCH_URL, o que causava isPreview=true em produção e redirects errados.
  const vercelEnv  = process.env.VERCEL_ENV ?? env.VERCEL_ENV ?? ''
  const isPreview  = vercelEnv === 'preview'
  const branchHost = isPreview ? (process.env.VERCEL_BRANCH_URL ?? env.VERCEL_BRANCH_URL ?? '') : ''
  const gitIdx     = branchHost.indexOf('-git-')
  const gitSuffix  = gitIdx !== -1 ? branchHost.slice(gitIdx) : '' // "-git-{branch}-{team}.vercel.app"

  const appUrl   = env.VITE_APP_URL   ?? (isPreview ? `https://${branchHost}`             : 'https://syncero.vercel.app')
  const flowUrl  = env.VITE_FLOW_URL  ?? (isPreview ? `https://syncero-flow${gitSuffix}`  : 'https://syncero-flow.vercel.app')
  const booksUrl = env.VITE_BOOKS_URL ?? (isPreview ? `https://syncero-books${gitSuffix}` : 'https://syncero-books.vercel.app')

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173 },
    define: {
      'import.meta.env.VITE_APP_URL':   JSON.stringify(appUrl),
      'import.meta.env.VITE_FLOW_URL':  JSON.stringify(flowUrl),
      'import.meta.env.VITE_BOOKS_URL': JSON.stringify(booksUrl),
    },
  }
})
