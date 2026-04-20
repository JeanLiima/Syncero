import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// VERCEL_ENV é "production" | "preview" | "development" — fonte confiável para distinguir ambientes.
// VERCEL_BRANCH_URL só é usado em preview para derivar as URLs dos apps irmãos.
export default defineConfig(() => {
  const vercelEnv = process.env.VERCEL_ENV ?? ''
  const isPreview = vercelEnv === 'preview'

  let landingUrl: string
  let flowUrl: string
  let booksUrl: string

  if (vercelEnv === 'production') {
    landingUrl = process.env.VITE_LANDING_URL ?? 'https://syncero.vercel.app'
    flowUrl    = process.env.VITE_FLOW_URL    ?? 'https://syncero-flow.vercel.app'
    booksUrl   = process.env.VITE_BOOKS_URL   ?? 'https://syncero-books.vercel.app'
  } else if (isPreview) {
    // VERCEL_BRANCH_URL: host do branch atual sem https://, ex: "syncero-git-meu-pr-team.vercel.app"
    // Não usar VITE_*_URL aqui — são vars fixas de produção configuradas na Vercel
    // e sobrescrevem a URL dinâmica do PR antes do ?? alcançar a derivação.
    const branchHost = process.env.VERCEL_BRANCH_URL ?? ''
    const gitIdx     = branchHost.indexOf('-git-')
    const gitSuffix  = gitIdx !== -1 ? branchHost.slice(gitIdx) : ''
    landingUrl = `https://syncero${gitSuffix}`
    flowUrl    = `https://syncero-flow${gitSuffix}`
    booksUrl   = `https://syncero-books${gitSuffix}`
  } else {
    // Desenvolvimento local
    landingUrl = process.env.VITE_LANDING_URL ?? 'http://localhost:5173'
    flowUrl    = process.env.VITE_FLOW_URL    ?? 'http://localhost:5174'
    booksUrl   = process.env.VITE_BOOKS_URL   ?? 'http://localhost:5175'
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173 },
    define: {
      'import.meta.env.VITE_LANDING_URL': JSON.stringify(landingUrl),
      'import.meta.env.VITE_FLOW_URL':    JSON.stringify(flowUrl),
      'import.meta.env.VITE_BOOKS_URL':   JSON.stringify(booksUrl),
    },
  }
})
