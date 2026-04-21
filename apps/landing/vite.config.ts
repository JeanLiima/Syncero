import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Busca o branchAlias real de um projeto irmão via API Vercel.
// Requer VERCEL_TOKEN configurado como env var de Preview no painel Vercel.
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
  let flowUrl: string
  let booksUrl: string

  if (vercelEnv === 'production') {
    landingUrl = process.env.VITE_LANDING_URL ?? 'https://syncero.vercel.app'
    flowUrl    = process.env.VITE_FLOW_URL    ?? 'https://syncero-flow.vercel.app'
    booksUrl   = process.env.VITE_BOOKS_URL   ?? 'https://syncero-books.vercel.app'
  } else if (isPreview) {
    // Em preview, cada projeto Vercel gera um branchAlias com hash diferente
    // (depende do tamanho do nome do projeto). Buscamos o alias real via API
    // para garantir URLs corretas. VERCEL_TOKEN deve ser uma var de Preview.
    const branch = process.env.VERCEL_GIT_COMMIT_REF ?? ''
    const [flowAlias, booksAlias] = await Promise.all([
      getSiblingAlias('prj_chWYQDmiNmAk8OOXK7lHjW7k1k3d', branch),
      getSiblingAlias('prj_jQMFND7FLjqNSmhQfEVekNSRAzAT', branch),
    ])
    // Landing conhece a própria URL via VERCEL_BRANCH_URL (sem ambiguidade)
    landingUrl = process.env.VERCEL_BRANCH_URL
      ? `https://${process.env.VERCEL_BRANCH_URL}`
      : 'https://syncero.vercel.app'
    // Fallback para produção se ainda não houver deploy anterior no branch
    flowUrl  = flowAlias  ? `https://${flowAlias}`  : 'https://syncero-flow.vercel.app'
    booksUrl = booksAlias ? `https://${booksAlias}` : 'https://syncero-books.vercel.app'
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
