import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // VERCEL_ENV é "production" | "preview" | "development" — fonte confiável para distinguir ambientes.
  // VERCEL_PROJECT_PRODUCTION_URL é a URL de produção do projeto, sempre disponível, mesmo em preview.
  // VERCEL_BRANCH_URL só é usado em preview para derivar as URLs dos apps irmãos.
  // VERCEL_URL é a URL do ambiente atual, mas pode ser a de produção mesmo em preview, então não é confiável para distinguir ambientes.
  const vercelEnv = process.env.VERCEL_ENV ?? '';
  const isPreview = vercelEnv === 'preview';

  let landingUrl: string;
  let flowUrl: string;

  if (vercelEnv === 'production') {
    // Use hardcoded production URLs or env variables if set
    landingUrl = process.env.VITE_LANDING_URL ?? 'https://syncero.vercel.app';
    flowUrl    = process.env.VITE_FLOW_URL    ?? 'https://syncero-flow.vercel.app';
  } else if (isPreview) {
    // Derive from VERCEL_BRANCH_URL for preview environments
    const branchHost = process.env.VERCEL_BRANCH_URL ?? '';
    const gitIdx     = branchHost.indexOf('-git-');
    const gitSuffix  = gitIdx !== -1 ? branchHost.slice(gitIdx) : '';

    landingUrl = process.env.VITE_LANDING_URL ?? `https://syncero${gitSuffix}`;
    flowUrl = process.env.VITE_FLOW_URL    ?? `https://syncero-flow${gitSuffix}`; // Distinct subdomain for flow
  } else {
    // Development environment
    landingUrl = process.env.VITE_LANDING_URL ?? 'http://localhost:5173';
    flowUrl = process.env.VITE_FLOW_URL    ?? 'http://localhost:5174';
  }

  console.log({ vercelEnv, landingUrl, flowUrl });

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
