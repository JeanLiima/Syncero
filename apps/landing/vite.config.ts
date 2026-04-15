import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // VERCEL_BRANCH_URL é injetado pela Vercel em todo build de preview
  // ex: "syncero-git-fix-post-auth-7-issues-jeanliimas-projects.vercel.app"
  // A partir dele derivamos as URLs dos apps irmãos sem configuração manual.
  const branchHost = env.VERCEL_BRANCH_URL ?? ''
  const gitIdx     = branchHost.indexOf('-git-')
  const gitSuffix  = gitIdx !== -1 ? branchHost.slice(gitIdx) : '' // "-git-{branch}-{team}.vercel.app"
  const isPreview  = gitSuffix !== ''

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
