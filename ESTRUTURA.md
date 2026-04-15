syncero/                                   ← monorepo root
├── apps/
│   ├── landing/                           ← hub público de auth (port 5173)
│   │   ├── src/
│   │   │   ├── App.tsx                    ← landing page + LoginModal + OAuth hub
│   │   │   ├── lib/
│   │   │   │   └── supabase.ts            ← persistSession: false (hub apenas)
│   │   │   └── main.tsx
│   │   ├── vite.config.ts                 ← deriva FLOW_URL/BOOKS_URL do VERCEL_BRANCH_URL
│   │   └── vercel.json
│   │
│   ├── flow/                              ← app privado empresa (port 5174)
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts            ← persistSession: true, flowType: implicit
│   │   │   │   └── router.tsx             ← RequireAuth / RequireOnboarding / RequireAccountant
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts             ← bootstrapAuth (hash→setSession), fetchProfile+activeCompany
│   │   │   │   └── usePWAInstall.ts
│   │   │   ├── store/
│   │   │   │   ├── auth.ts                ← user, profile, activeCompany (activeCompany persisted)
│   │   │   │   └── preferences.ts         ← language, sidebarCollapsed (persisted 'syncero-prefs')
│   │   │   ├── components/
│   │   │   │   ├── Layout.tsx             ← sidebar colapsável + topbar + mobile nav
│   │   │   │   ├── NoCompanyShell.tsx     ← tela para usuário sem empresa
│   │   │   │   ├── PWABanner.tsx
│   │   │   │   └── ui/                    ← Avatar, Badge, Button, Card, Input, Modal…
│   │   │   ├── pages/
│   │   │   │   ├── AcceptInvite.tsx
│   │   │   │   ├── Onboarding.tsx
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Lancamentos.tsx
│   │   │   │   ├── FluxoCaixa.tsx
│   │   │   │   ├── Contas.tsx
│   │   │   │   ├── DRE.tsx
│   │   │   │   ├── Settings.tsx
│   │   │   │   ├── Preferences.tsx        ← seletor compacto PT/EN
│   │   │   │   └── contador/              ← rotas de contador dentro do Flow (legado)
│   │   │   ├── modules/
│   │   │   │   ├── lancamentos/           ← queries + mutations + types
│   │   │   │   ├── contas/
│   │   │   │   ├── fluxo/
│   │   │   │   └── dre/
│   │   │   ├── i18n/                      ← useT(), pt.ts, en.ts
│   │   │   └── types/index.ts
│   │   ├── vite.config.ts                 ← deriva LANDING_URL/BOOKS_URL do VERCEL_BRANCH_URL
│   │   └── vercel.json
│   │
│   └── books/                             ← app privado contador (port 5175)
│       ├── src/
│       │   ├── lib/
│       │   │   ├── supabase.ts            ← persistSession: true, flowType: implicit
│       │   │   └── router.tsx             ← RequireAccountant / RequireOnboarding
│       │   ├── hooks/
│       │   │   ├── useAuth.ts             ← bootstrapAuth (hash→setSession), fetchProfile
│       │   │   └── usePWAInstall.ts
│       │   ├── store/
│       │   │   ├── auth.ts
│       │   │   └── preferences.ts         ← language, sidebarCollapsed (persisted 'syncero-prefs')
│       │   ├── components/
│       │   │   ├── Layout.tsx             ← sidebar colapsável + topbar + mobile nav
│       │   │   ├── PWABanner.tsx
│       │   │   └── ui/
│       │   ├── pages/
│       │   │   ├── Onboarding.tsx
│       │   │   ├── Preferences.tsx        ← seletor compacto PT/EN
│       │   │   └── accountant/            ← Dashboard, EmpresaFiscal, NFe, SPED, Impostos
│       │   ├── i18n/
│       │   └── types/index.ts
│       ├── vite.config.ts                 ← deriva LANDING_URL/FLOW_URL do VERCEL_BRANCH_URL
│       └── vercel.json
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql         ← tabelas, RLS, funções, triggers
│       └── 002_fix_rls_recursion.sql      ← is_company_admin() + policies corrigidas
│
├── CLAUDE.md                              ← guia completo do projeto para Claude Code
├── ESTRUTURA.md                           ← este arquivo
└── package.json                           ← workspaces root
