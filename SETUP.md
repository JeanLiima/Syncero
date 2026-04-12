# Finflow — Setup do Projeto

## 1. Criar o projeto

```bash
npm create vite@latest finflow -- --template react-ts
cd finflow
```

## 2. Instalar dependências

```bash
# Core
npm install @supabase/supabase-js react-router-dom

# Estado e dados
npm install zustand @tanstack/react-query

# UI e gráficos
npm install tailwindcss @tailwindcss/vite recharts
npm install lucide-react

# Formulários e validação
npm install react-hook-form zod @hookform/resolvers

# PWA
npm install -D vite-plugin-pwa workbox-precaching workbox-routing
```

## 3. vite.config.ts — PWA configurado

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Finflow',
        short_name: 'Finflow',
        description: 'Controle financeiro empresarial',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Cache de páginas visitadas para uso offline
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
})
```

## 4. src/lib/supabase.ts

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types' // gerado pelo Supabase CLI

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

## 5. .env

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

## 6. Gerar tipos TypeScript do banco

```bash
# Instalar Supabase CLI
npx supabase login
npx supabase gen types typescript \
  --project-id SEU_PROJECT_ID \
  --schema public > src/lib/database.types.ts
```

## 7. Rodar localmente

```bash
npm run dev
```

---

## Fluxo de deploy sugerido

```
GitHub → Vercel (auto-deploy)
         └─ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas env vars do Vercel
```
