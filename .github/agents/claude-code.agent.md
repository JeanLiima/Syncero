---
name: claude-code
description: Agente Claude Code para o monorepo Syncero. Use em todas as tarefas de desenvolvimento — frontend, backend, banco de dados e infraestrutura.
---

# Contexto do Projeto

**Syncero** — Plataforma de gestão financeira conectando empresas e contadores.

**Stack:** React 18 + Vite + TypeScript + Tailwind CSS v4 + Supabase + vite-plugin-pwa  
**Repositório:** `JeanLiima/Syncero` no GitHub

---

## Estrutura do Monorepo

```
Syncero/
├── apps/
│   ├── landing/          ← Hub público — ponto de entrada OAuth (porta 5173)
│   ├── flow/             ← App privado para company_user (porta 5174)
│   └── books/            ← App privado para contadores (porta 5175)
├── packages/
│   ├── auth/             ← useAuth, useAuthStore, usePreferencesStore, supabase, apiFetch
│   └── ui/               ← Design system compartilhado: Button, Input, Select, DatePicker, Modal…
├── supabase/
│   └── migrations/
└── package.json          ← Root: workspaces + turbo
```

---

## Infraestrutura

- **Supabase Project ID:** `kmcwjilzhiyooacdpfdo` | Região: sa-east-1 (São Paulo)
- **Vercel:** landing → `syncero.vercel.app` | flow → `syncero-flow.vercel.app` | books → `syncero-books.vercel.app`
- **Auth:** Login exclusivo no landing via Google OAuth. Flow e Books recebem `#access_token=` no hash e trocam a sessão com `setSession()`.

---

## Regras de Desenvolvimento

### Geral
- Alias de path: `@` → `src/` — sempre usar imports com `@/`
- Nunca usar `any` sem justificativa; preferir inferência ou interfaces explícitas
- Não adicionar features, refatorações ou "melhorias" além do que foi pedido
- Não criar arquivos de documentação (`.md`, `README`) salvo quando explicitamente solicitado
- Não adicionar comentários onde a lógica é auto-evidente

### Frontend (React/TypeScript)
- Componentes: extrair lógica de negócio para hooks customizados; manter componentes focados em UI
- State global: `useAuthStore` e `usePreferencesStore` do `@syncero/auth`
- Data fetching: React Query — sempre invalidar todas as queries dependentes ao mutar dados
- i18n: toda string visível ao usuário via `useT()` com chave em `pt.ts` e `en.ts`
- Estilização: Tailwind + tokens CSS do design system (variáveis `--bg-*`, `--text-*`, `--accent`, `--danger`, etc.)
- Tema: dark only — nunca usar cores hardcoded fora dos tokens

### Backend (API Routes)
- Verificar sempre autenticação e autorização antes de qualquer operação
- Usar `supabaseService` (service role) apenas quando necessário contornar RLS com justificativa
- Validar inputs na borda — nunca confiar em dados do cliente sem sanitização
- Nunca expor stack traces ou informações sensíveis em respostas de erro

### Banco de Dados
- Todo dado financeiro é scoped por `company_id` — sempre usar `activeCompany.id`
- RLS já cobre a maioria dos casos; usar funções SECURITY DEFINER quando necessário:
  - `is_company_member(company_id)` — membro aceito
  - `is_company_admin(company_id)` — admin da empresa
  - `is_accountant_of(company_id)` — contador aceito
- Contadores são **somente leitura** — nunca adicionar mutações em páginas de contador

### Segurança
- Nunca commitar `.env` ou chaves de API
- Nunca usar `--no-verify`, `--force-push` ou bypassar hooks de CI sem solicitação explícita
- Preferir ações reversíveis; confirmar com o usuário antes de operações destrutivas

---

## Design System

**Tokens principais:**
```css
--bg-base: #0b0f19        --text-primary: #f1f5f9
--bg-surface: #111827     --text-secondary: #94a3b8
--bg-elevated: #1a2236    --text-muted: #475569
--bg-border: #1e2d45      --accent: #3b82f6
--success: #10b981        --danger: #f43f5e
--warning: #f59e0b
```

**Fontes:** DM Sans (corpo) + JetBrains Mono (números)

---

## Comportamento Esperado

- Ler o arquivo relevante antes de sugerir ou aplicar qualquer modificação
- Ao editar, usar a ferramenta `Edit` com contexto suficiente para garantir uniqueness do match
- Ao criar novos arquivos de página, exportar como `export function Component()` para lazy loading via React Router
- Rodar `npx tsc --noEmit` após mudanças significativas para verificar erros de tipo
- Respostas curtas e diretas — sem resumos no final, sem emojis, sem formalidades desnecessárias
