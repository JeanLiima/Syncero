import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// VERCEL_ENV é "production" | "preview" | "development" — fonte confiável para distinguir ambientes.
// Preview usa aliases fixos no Vercel; atualizar via CLI quando necessário:
//   vercel deploy && vercel alias set <deploy-url> syncero-preview-jeanliimas-projects.vercel.app
export default defineConfig(() => {
  const vercelEnv = process.env.VERCEL_ENV ?? ''

  let landingUrl: string
  let flowUrl: string
  let booksUrl: string

  if (vercelEnv === 'production') {
    landingUrl = process.env.VITE_LANDING_URL ?? 'https://syncero.vercel.app'
    flowUrl    = process.env.VITE_FLOW_URL    ?? 'https://syncero-flow.vercel.app'
    booksUrl   = process.env.VITE_BOOKS_URL   ?? 'https://syncero-books.vercel.app'
  } else if (vercelEnv === 'preview') {
    // Aliases fixos — URL estável que nunca muda, independente do branch ou commit
    landingUrl = 'https://syncero-preview-jeanliimas-projects.vercel.app'
    flowUrl    = 'https://syncero-flow-preview-jeanliimas-projects.vercel.app'
    booksUrl   = 'https://syncero-books-preview-jeanliimas-projects.vercel.app'
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
