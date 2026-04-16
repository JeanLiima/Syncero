import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // VERCEL_ENV é "production" | "preview" | "development" — fonte confiável para distinguir ambientes.
  // VERCEL_PROJECT_PRODUCTION_URL é a URL de produção do projeto, sempre disponível, mesmo em preview.
  // VERCEL_BRANCH_URL só é usado em preview para derivar as URLs dos apps irmãos.
  // VERCEL_URL é a URL do ambiente atual, mas pode ser a de produção mesmo em preview, então não é confiável para distinguir ambientes.
  const vercelEnv = process.env.VERCEL_ENV ?? '';
  const isPreview = vercelEnv === 'preview';

  let landingUrl: string;
  let flowUrl: string;
  let booksUrl: string;

  if (vercelEnv === 'production') {
    // Use hardcoded production URLs or env variables if set
    landingUrl = process.env.VITE_LANDING_URL ?? 'https://syncero.vercel.app';
    flowUrl    = process.env.VITE_FLOW_URL    ?? 'https://syncero-flow.vercel.app';
    booksUrl    = process.env.VITE_BOOKS_URL    ?? 'https://syncero-books.vercel.app';
  } else if (isPreview) {
    // Derive from VERCEL_BRANCH_URL for preview environments
    const branchHost = process.env.VERCEL_BRANCH_URL ?? '';
    const gitIdx     = branchHost.indexOf('-git-');
    const gitSuffix  = gitIdx !== -1 ? branchHost.slice(gitIdx) : '';

    landingUrl = process.env.VITE_LANDING_URL ?? `https://syncero${gitSuffix}`;
    flowUrl = process.env.VITE_FLOW_URL    ?? `https://syncero-flow${gitSuffix}`; // Distinct subdomain for flow
    booksUrl = process.env.VITE_BOOKS_URL    ?? `https://syncero-books${gitSuffix}`; // Distinct subdomain for books
  } else {
    // Development environment
    landingUrl = process.env.VITE_LANDING_URL ?? 'http://localhost:5173';
    flowUrl = process.env.VITE_FLOW_URL    ?? 'http://localhost:5174';
    booksUrl = process.env.VITE_BOOKS_URL    ?? 'http://localhost:5174';
  }

  console.log({ vercelEnv, landingUrl, flowUrl, booksUrl });

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173 },
    define: {
      'import.meta.env.VITE_LANDING_URL':   JSON.stringify(landingUrl),
      'import.meta.env.VITE_FLOW_URL':  JSON.stringify(flowUrl),
      'import.meta.env.VITE_BOOKS_URL': JSON.stringify(booksUrl),
    },
  }
})
