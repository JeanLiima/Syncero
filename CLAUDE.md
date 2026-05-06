# CLAUDE.md — Syncero Monorepo Guide

> Read this before writing any code.

---

## API ↔ Docs Sync Rule (OBRIGATÓRIO)

**Toda alteração em rota de backend deve ser acompanhada de atualização nos specs OpenAPI.**

### Arquivos de rota
| App | Diretório |
|-----|-----------|
| Flow | `apps/flow/api/routes/*.ts` |
| Books | `apps/books/api/routes/*.ts` |

### Specs a manter atualizados
| Spec | Caminho |
|------|---------|
| Flow interno | `apps/docs/public/openapi-flow.json` |
| Books interno | `apps/docs/public/openapi-books.json` |
| Flow externo | `apps/docs/public/openapi-flow-external.json` (+ `-en.json`) |
| Books externo | `apps/docs/public/openapi-books-external.json` (+ `-en.json`) |

### O que deve ser atualizado quando uma rota muda
- **Novo endpoint** → adicionar path + operation no spec correto
- **Novo campo obrigatório no body** → adicionar em `required[]` e em `properties`
- **Novo campo opcional no body** → adicionar em `properties` com `nullable: true` se aplicável
- **Novo query param** → adicionar em `parameters`
- **Campo removido** → remover do spec
- **Mudança de status code** → corrigir no spec
- **Mudança de tipo/nullability** → corrigir no spec

### Como executar
Use `/sync-api-docs` para analisar automaticamente quais rotas mudaram e atualizar os specs.

---

## What This Project Is

**Syncero** — Financial management platform connecting businesses and accountants.

**Stack:** React 18 + Vite + TypeScript + Tailwind CSS v4 + Supabase + vite-plugin-pwa  
**Repository:** `JeanLiima/Syncero` on GitHub

---

## Monorepo Structure

```
Syncero/
├── apps/
│   ├── landing/          ← Public hub — Google OAuth entry point (port 5173)
│   ├── flow/             ← Private app for company_user (port 5174)
│   └── books/            ← Private app for accountants (port 5175)
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_fix_rls_recursion.sql
└── package.json          ← Root: workspaces + turbo
```

Each app is fully independent: its own `package.json`, `vite.config.ts`, `tsconfig.json`, `vercel.json`.

---

## Infrastructure

### Supabase (production)
- **Project ID:** `kmcwjilzhiyooacdpfdo`
- **URL:** `https://kmcwjilzhiyooacdpfdo.supabase.co`
- **Region:** sa-east-1 (São Paulo)
- **Anon key:** in each app's `.env` file — never commit

### Vercel (production URLs)
| App     | URL                              |
|---------|----------------------------------|
| landing | `https://syncero.vercel.app`     |
| flow    | `https://syncero-flow.vercel.app`|
| books   | `https://syncero-books.vercel.app`|

> Preview deployments usam as URLs de produção para links cross-app. Teste de novas features deve ser feito localmente.

---

## Database

### Migrations applied

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | All tables, indexes, RLS policies, helper functions, triggers |
| `002_fix_rls_recursion.sql` | Fixes infinite RLS recursion on `company_members`; adds `is_company_admin()` SECURITY DEFINER function; adds missing INSERT policies |

### Tables (10)

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles — `user_type`: `company_user` or `accountant` |
| `companies` | Company data (name, CNPJ, tax regime) |
| `company_members` | Membership with roles + invite tokens |
| `accountant_companies` | Accountant↔company links (accept/reject status) |
| `categories` | Transaction categories (income/expense) |
| `transactions` | Income and expense entries |
| `payables_receivables` | Accounts payable/receivable |
| `fiscal_documents` | NF-e, NFS-e, CFe, NFC-e documents |
| `fiscal_books` | SPED, ECF, ECD books |
| `tax_calculations` | Tax calculations by period |

### Helper functions (SECURITY DEFINER — bypass RLS safely)

| Function | Returns | Purpose |
|----------|---------|---------|
| `is_company_member(company_id)` | boolean | User is accepted member of company |
| `is_company_admin(company_id)` | boolean | User is admin member of company |
| `is_accountant_of(company_id)` | boolean | User is accepted accountant of company |

### RLS summary

- **profiles** — user sees/edits own row; INSERT allowed for onboarding upsert
- **companies** — member or owner sees; owner inserts/updates
- **company_members** — member sees; admin manages via `is_company_admin()`; owner inserts self as admin
- **accountant_companies** — accountant sees own links; admin inserts; accountant updates (accept)
- **categories / transactions / payables_receivables** — member CRUD
- **fiscal_documents / fiscal_books / tax_calculations** — member or accountant reads; member inserts

---

## Auth Flow (cross-domain)

Login lives **only on landing**. Flow and Books have no login page.

```
landing (OAuth hub)
  │
  ├─ Google OAuth → callback to landing
  ├─ getProfileType() → DB query
  ├─ redirectWithSession(session, type)
  │     builds: window.location.replace(`${appUrl}#access_token=X&refresh_token=Y`)
  │
  ├─→ flow/#access_token=...   (company_user)
  └─→ books/#access_token=...  (accountant)

flow / books (useAuth bootstrapAuth)
  │
  ├─ reads hash manually → supabase.auth.setSession()  ← bypasses PKCE detectSessionInUrl
  ├─ history.replaceState (cleans tokens from URL)
  └─ getSession() → fetchProfile() → app ready
```

**Why manual hash reading?** Supabase project uses PKCE mode where `detectSessionInUrl` looks for `?code=`, not `#access_token=`. Manual `setSession()` works regardless of flowType.

---

## App Structure (flow and books — identical pattern)

```
apps/{flow|books}/
├── public/
│   ├── favicon.svg
│   └── icons/{icon-192,icon-512}.png
├── src/
│   ├── main.tsx            ← QueryClient + ToastProvider + RouterProvider
│   ├── index.css           ← Design tokens (dark theme)
│   ├── lib/
│   │   ├── supabase.ts     ← createClient (persistSession: true, flowType: implicit)
│   │   └── router.tsx      ← Route guards: RequireAuth / RequireAccountant / RequireOnboarding
│   ├── store/
│   │   ├── auth.ts         ← Zustand: user, profile, activeCompany (activeCompany persisted)
│   │   └── preferences.ts  ← Zustand: language, sidebarCollapsed (persisted as 'syncero-prefs')
│   ├── hooks/
│   │   ├── useAuth.ts      ← bootstrapAuth, fetchProfile, signOut, createProfile
│   │   └── usePWAInstall.ts
│   ├── i18n/
│   │   ├── index.ts        ← useT() hook
│   │   ├── pt.ts           ← PT dictionary (source of truth for keys)
│   │   └── en.ts           ← EN dictionary
│   ├── types/
│   │   └── index.ts        ← Enums + interfaces from DB schema
│   ├── components/
│   │   ├── Layout.tsx      ← Collapsible sidebar + topbar + mobile nav
│   │   ├── NoCompanyShell.tsx  ← (flow only) UI for users without a company
│   │   ├── PWABanner.tsx
│   │   └── ui/             ← Avatar, Badge, Button, Card, Input, Modal, Select, Table, Tabs, Toast…
│   └── pages/
│       └── …               ← Lazy-loaded via router
├── vite.config.ts          ← Derives sibling URLs from VERCEL_BRANCH_URL
├── vercel.json             ← SPA rewrite: all paths → index.html
└── .env                    ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (never commit)
```

**Path alias:** `@` → `src/` — always use `@/` imports.

---

## Route Guards

### Flow (`apps/flow/src/lib/router.tsx`)

| Guard | Passes when | Otherwise |
|-------|------------|-----------|
| `RequireAuth` | authenticated + onboarded | → landing (not logged in) or `/onboarding` |
| `RequireAuth` | `company_user` has `activeCompany` | → `<NoCompanyShell />` |
| `RequireAuth` | not accountant | → redirect to Books with session hash |
| `RequireOnboarding` | `profile === null` | → `/dashboard` if already profiled |
| `RequireAccountant` | `user_type === 'accountant'` | → `/dashboard` |

### Books (`apps/books/src/lib/router.tsx`)

| Guard | Passes when | Otherwise |
|-------|------------|-----------|
| `RequireAccountant` | authenticated + accountant | → landing or `<WrongApp />` |
| `RequireOnboarding` | `profile === null` | → `/` if already profiled |

---

## State Management

### `useAuthStore` (per-app, partially persisted)
- `user` — Supabase `User` (in-memory)
- `profile` — `Profile` from DB (in-memory)
- `activeCompany` — `{ id, name, role }` (persisted as `'syncero-auth'`)

### `usePreferencesStore` (per-app, fully persisted as `'syncero-prefs'`)
- `language: 'pt' | 'en'`
- `sidebarCollapsed: boolean`

---

## Design System

**Theme:** Dark only. **Fonts:** DM Sans (body) + JetBrains Mono (numbers).

```css
--bg-base:        #0b0f19   /* page background */
--bg-surface:     #111827   /* cards */
--bg-elevated:    #1a2236   /* inputs, dropdowns */
--bg-border:      #1e2d45   /* borders */
--text-primary:   #f1f5f9
--text-secondary: #94a3b8
--text-muted:     #475569
--accent:         #3b82f6   /* blue — Flow brand */
--success:        #10b981   /* green — Books brand / income */
--danger:         #f43f5e
--warning:        #f59e0b
```

---

## Business Rules

1. All financial data scoped by `company_id` — always use `activeCompany.id` from auth store
2. Accountants are **read-only** — never add mutations to `pages/accountant/` in Books
3. `accountant_companies.status = 'accepted'` required for RLS to allow accountant access
4. Company switching invalidates all React Query keys prefixed with `companyId`
5. CNPJ stored as raw digits in DB; formatted as `00.000.000/0000-00` in UI
6. Tax regime enum values: `'simples'` | `'lucro_presumido'` | `'lucro_real'` (empty string → send null)
7. **Each company may have at most one accountant** — `POST /api/accountant-companies` rejects with 409 if a row with `status IN ('accepted', 'pending')` already exists for that `company_id`. The invite button is only shown in the table empty state (no external trigger when an accountant already exists).

---

## Accountant Invite Flow

### Overview

Company admins (in Flow) invite accountants by email. The accountant receives an email with a unique link, logs in via Google OAuth, and accepts. After acceptance, the accountant can access the company's data read-only in Books.

### Database: `accountant_companies`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `accountant_id` | uuid \| null | null until invite accepted |
| `company_id` | uuid | FK → companies |
| `invited_by` | uuid | FK → profiles (who sent the invite) |
| `email` | text | Accountant's email (invite target) |
| `invite_token` | text unique | UUID generated client-side |
| `status` | invite_status | `'pending'` → `'accepted'` |
| `invited_at` | timestamptz | Auto-set on insert |
| `accepted_at` | timestamptz | Set on acceptance |

Unique indexes:
- `(company_id, email) WHERE status = 'pending'` — prevents duplicate pending invites
- `(company_id, accountant_id) WHERE status = 'accepted'` — one accountant per company

### Step-by-step Flow

```
1. COMPANY ADMIN — Flow Settings > Accountant tab
   ├─ Enters: contador@escritorio.com
   └─ Clicks: "Send invite"

2. FRONTEND — apps/flow/src/pages/Settings.tsx
   ├─ crypto.randomUUID() → invite_token
   └─ POST /api/accountant-companies { companyId, email, invite_token }

3. API — apps/flow/api/routes/accountantCompanies.ts (POST /)
   ├─ Validates: user is company admin (company_members.role = 'admin')
   ├─ Checks: no duplicate pending invite for this email
   ├─ Inserts: accountant_companies { company_id, email, status:'pending', invite_token, invited_by }
   ├─ Fetches: company name + inviter full_name
   └─ Sends email via Resend → invite link: {FLOW_URL}/invite/{token}

4. EMAIL — apps/flow/api/emails/accountantInvite.ts
   └─ Dark HTML template with CTA button + fallback link

5. ACCOUNTANT — receives email, clicks link
   └─ Visits: {FLOW_URL}/invite/{token}

6. FRONTEND — apps/flow/src/pages/AcceptInvite.tsx
   ├─ GET /api/invites/{token} (no auth) → resolves { type, companyName, status }
   ├─ Shows: "You've been invited to access {companyName}"
   └─ Clicks: "Accept" → Google OAuth login if not logged in

7. API — apps/flow/api/routes/invites.ts (POST /:token/accept)
   ├─ UPDATE accountant_companies SET status='accepted', accountant_id=userId
   └─ RLS for Books is now unlocked for this accountant+company pair

8. ACCOUNTANT — redirected to Books dashboard
   └─ Can now see company data read-only
```

### Environment Variables Required (Flow — server-side)

| Variable | Value | Purpose |
|----------|-------|---------|
| `RESEND_API_KEY` | `re_...` | Email delivery |
| `VITE_FLOW_URL` | `https://syncero-flow.vercel.app` | Invite link base URL (reused from frontend config) |
| `SUPABASE_URL` | Supabase project URL | Service client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Service client (bypasses RLS) |

### Key Files

| File | Purpose |
|------|---------|
| `apps/flow/src/pages/Settings.tsx` | Invite form UI (AccountantTab) |
| `apps/flow/api/routes/accountantCompanies.ts` | POST invite + send email |
| `apps/flow/api/routes/invites.ts` | GET resolve token + POST accept |
| `apps/flow/src/pages/AcceptInvite.tsx` | Acceptance page |
| `apps/flow/api/emails/accountantInvite.ts` | Email HTML template |
| `supabase/migrations/008_accountant_invite.sql` | Schema changes |

### Error Handling

- Duplicate pending invite → API returns 409 "An invite has already been sent to this email."
- Already accepted → API returns 409 "This accountant already has access to this company."
- Email delivery failure → logged server-side, invite record still created (best-effort)

---

## What Still Needs Implementing

### High priority
- [ ] **Error boundaries** — white-screen on unhandled React errors
- [ ] **Tests** — no unit/integration/e2e tests
- [ ] **Real-time subscriptions** — polling only; Supabase Realtime not wired
- [ ] **Category management UI** — table exists, no CRUD in Settings
- [ ] **Create company flow** — `NoCompanyShell` needs verification of full insert + `setActiveCompany`

### Medium priority
- [ ] **Export PDF/Excel** — DRE and transactions
- [ ] **Advanced filtering** — date range + multi-category in Lancamentos
- [ ] **Batch mark as paid** — bulk payables update
- [ ] **Multi-company selector** — fetchProfile restores first company only; selector needed for users with 2+

### Lower priority
- [ ] **Retry limit on sessionHandled** in landing (`App.tsx`) — currently resets on any network error

---

## Dev Commands

```bash
# From repo root
npm install

# Run all apps in parallel
npm run dev

# Or individually (from each app dir)
cd apps/landing && npm run dev   # → localhost:5173
cd apps/flow    && npm run dev   # → localhost:5174
cd apps/books   && npm run dev   # → localhost:5175

# Type check
npm run typecheck

# Sync DB types
npx supabase gen types typescript \
  --project-id kmcwjilzhiyooacdpfdo \
  --schema public > apps/flow/src/types/database.types.ts
```

---

## Getting Started (new session)

```bash
npm install

# Each app needs its own .env:
cp apps/flow/.env.example    apps/flow/.env
cp apps/books/.env.example   apps/books/.env
cp apps/landing/.env.example apps/landing/.env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in each

npm run dev
```
