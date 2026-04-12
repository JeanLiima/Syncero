finflow/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql     ← schema completo + RLS
│
├── public/
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
│
├── src/
│   ├── lib/
│   │   ├── supabase.ts                ← cliente Supabase tipado
│   │   ├── router.tsx                 ← rotas com guards por role
│   │   └── database.types.ts          ← gerado pelo Supabase CLI
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                 ← auth + profile + empresa ativa
│   │   ├── usePWAInstall.ts           ← install prompt + detecção resize
│   │   └── useActiveCompany.ts        ← empresa selecionada (zustand)
│   │
│   ├── components/
│   │   ├── PWABanner.tsx              ← banner de instalação
│   │   ├── Layout.tsx                 ← shell com nav + topbar
│   │   ├── CompanySelector.tsx        ← troca de empresa ativa
│   │   └── ui/                        ← botões, inputs, cards base
│   │
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── AcceptInvite.tsx           ← aceita convite (membro ou contador)
│   │   ├── Dashboard.tsx              ← visão geral (empresa)
│   │   ├── Lancamentos.tsx
│   │   ├── FluxoCaixa.tsx
│   │   ├── Contas.tsx
│   │   ├── DRE.tsx
│   │   ├── Settings.tsx
│   │   └── contador/
│   │       ├── Dashboard.tsx          ← lista empresas vinculadas
│   │       ├── EmpresaFiscal.tsx      ← resumo fiscal da empresa
│   │       ├── NFe.tsx                ← documentos NF-e / NFS-e
│   │       ├── SPED.tsx               ← livros fiscais
│   │       └── Impostos.tsx           ← apuração de impostos
│   │
│   └── modules/
│       ├── fiscal/
│       │   ├── queries.ts             ← React Query hooks (readonly)
│       │   └── types.ts
│       ├── lancamentos/
│       │   ├── queries.ts
│       │   ├── mutations.ts
│       │   └── types.ts
│       ├── fluxo/
│       ├── contas/
│       └── dre/
│
├── .env                               ← VITE_SUPABASE_URL + ANON_KEY
├── vite.config.ts                     ← React + PWA plugin
├── tailwind.config.ts
└── SETUP.md
