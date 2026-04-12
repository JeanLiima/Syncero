# Finflow

Controle financeiro empresarial — PWA multi-tenant com módulo fiscal para contadores.

## Stack

- **Frontend**: React + Vite + TypeScript
- **Estilo**: Tailwind CSS
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Realtime)
- **PWA**: vite-plugin-pwa + Workbox
- **Estado**: Zustand + React Query

## Módulos

- Lançamentos de receitas e despesas
- Fluxo de caixa
- Contas a pagar e receber
- DRE e relatórios
- Módulo fiscal para contadores (NF-e, NFS-e, SPED, apuração de impostos)

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

# 3. Rodar em desenvolvimento
npm run dev
```

## Banco de dados

O schema completo está em `supabase/migrations/`. Para aplicar em um novo projeto:

```bash
npx supabase login
npx supabase link --project-ref kmcwjilzhiyooacdpfdo
npx supabase db push
```

## Deploy

O projeto está configurado para deploy automático via Vercel.
Adicione as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas env vars do projeto no Vercel.
