# CLAUDE.md — Finflow Codebase Guide

> Read this entire document before writing any code.
> Last updated to reflect actual implemented state (post-PR #1 merge).

---

## What This Project Is

**Finflow** — Multi-tenant business financial management PWA with an accounting module for tax professionals.

**Stack:** React 18 + Vite + TypeScript + Tailwind CSS v4 + Supabase + vite-plugin-pwa

**Repository:** `JeanLiima/Syncero` on GitHub (local folder is `/home/user/Syncero`)

---

## Provisioned Infrastructure

### Supabase (production)
- **Project ID:** `kmcwjilzhiyooacdpfdo`
- **URL:** `https://kmcwjilzhiyooacdpfdo.supabase.co`
- **Region:** sa-east-1 (São Paulo)
- **Anon key:** in `.env` file — never commit it

### Database — fully applied (single migration)

**Migration file:** `supabase/migrations/001_initial_schema.sql`

**Tables (10):**
| Table | Purpose |
|---|---|
| `profiles` | User profiles — type: `company_user` or `accountant` |
| `companies` | Company data (name, CNPJ, tax regime) |
| `company_members` | Membership with roles + invite tokens |
| `accountant_companies` | Accountant↔company links with accept/reject status |
| `categories` | Transaction categories (income/expense) |
| `transactions` | Income and expense entries |
| `payables_receivables` | Accounts payable/receivable |
| `fiscal_documents` | NF-e, NFS-e, CFe, NFC-e documents |
| `fiscal_books` | SPED, ECF, ECD books |
| `tax_calculations` | Tax calculations by period |

**DB helper functions:**
- `is_company_member(company_id)` → boolean
- `is_accountant_of(company_id)` → boolean

**RLS:** Enabled on all tables. Accountants have read access on `fiscal_documents`, `fiscal_books`, and `tax_calculations` via `accountant_companies` where `status = 'accepted'`.

---

## Full Source Tree (current state)

```
finflow/
├── index.html
├── package.json
├── vite.config.ts         ← React + Tailwind v4 + PWA (NetworkFirst for Supabase REST)
├── tsconfig.json          ← ES2020, strict, path alias @ = /src
├── tsconfig.node.json
├── vercel.json            ← SPA rewrites (all paths → index.html)
├── .env                   ← real credentials (never commit)
├── .env.example
├── .gitignore
│
├── public/
│   ├── favicon.svg
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
│
└── src/
    ├── main.tsx            ← React root: QueryClient + ToastProvider + RouterProvider
    ├── index.css           ← design tokens (dark theme, DM Sans + JetBrains Mono)
    ├── vite-env.d.ts
    │
    ├── lib/
    │   ├── supabase.ts     ← createClient with typed DB, persistent sessions
    │   └── router.tsx      ← createBrowserRouter with guards below
    │
    ├── store/
    │   ├── auth.ts         ← Zustand: user, profile, activeCompany (activeCompany persisted)
    │   └── preferences.ts  ← Zustand: language (persisted to localStorage as 'finflow-prefs')
    │
    ├── hooks/
    │   ├── useAuth.ts      ← Google OAuth: signInWithGoogle, createProfile, signOut, fetchProfile
    │   └── usePWAInstall.ts ← install prompt + resize detection
    │
    ├── i18n/
    │   ├── index.ts        ← useT() hook — reads from preferences store
    │   ├── pt.ts           ← Portuguese translation dictionary
    │   └── en.ts           ← English translation dictionary
    │
    ├── types/
    │   └── index.ts        ← All enums + interfaces derived from DB schema
    │
    ├── components/
    │   ├── Layout.tsx      ← Shell: sidebar (role-adaptive) + topbar + mobile nav
    │   ├── NoCompanyShell.tsx ← Focused UI for authenticated users without a company
    │   ├── PWABanner.tsx   ← Install banner (native prompt + iOS manual)
    │   └── ui/
    │       ├── index.ts    ← barrel export
    │       ├── Avatar.tsx  ← Image with initials fallback
    │       ├── Badge.tsx   ← variants: default | success | danger | warning | info
    │       ├── Button.tsx  ← variants: primary | ghost | danger; loading spinner built-in
    │       ├── Card.tsx    ← Surface container
    │       ├── ConfirmDialog.tsx ← Confirmation modal
    │       ├── Input.tsx   ← Form input with label, error state, icon support
    │       ├── Modal.tsx   ← Dialog with overlay
    │       ├── Select.tsx  ← Custom dropdown with search
    │       ├── Spinner.tsx ← Loading spinner
    │       ├── Table.tsx   ← Responsive striped table
    │       ├── Tabs.tsx    ← Tab switcher
    │       └── Toast.tsx   ← Toast context + Toaster component
    │
    ├── pages/
    │   ├── Login.tsx           ← Google OAuth sign-in page
    │   ├── Register.tsx        ← Registration (minimal — primary flow is OAuth)
    │   ├── AcceptInvite.tsx    ← Accepts member or accountant invite via token URL
    │   ├── Onboarding.tsx      ← First-login type selection: company_user or accountant
    │   ├── Dashboard.tsx       ← Metrics cards + 30-day chart + recent transactions
    │   ├── Lancamentos.tsx     ← Transactions list + create/edit form
    │   ├── FluxoCaixa.tsx      ← Cash flow chart (Recharts) + period selector
    │   ├── Contas.tsx          ← Payables/receivables with due-date grouping
    │   ├── DRE.tsx             ← Income statement table by category and period
    │   ├── Settings.tsx        ← Company info, members management, accountant invite
    │   ├── Preferences.tsx     ← Language toggle (PT/EN)
    │   └── contador/           ← Accountant-only section (read-only throughout)
    │       ├── Dashboard.tsx   ← List of linked companies via accountant_companies
    │       ├── EmpresaFiscal.tsx ← Fiscal summary for a given company
    │       ├── NFe.tsx         ← fiscal_documents list filtered by company
    │       ├── SPED.tsx        ← fiscal_books list
    │       └── Impostos.tsx    ← tax_calculations by period
    │
    └── modules/
        ├── lancamentos/
        │   ├── queries.ts      ← useTransactions(filters, page, pageSize), useCategories()
        │   ├── mutations.ts    ← useCreateTransaction, useUpdateTransaction, useMarkAsPaid, useDeleteTransaction
        │   └── types.ts        ← TransactionFormData, TransactionFilters
        ├── contas/
        │   ├── queries.ts      ← usePayables(type: PayableType)
        │   └── mutations.ts    ← CRUD for payables_receivables
        ├── fluxo/
        │   └── queries.ts      ← useCashFlow(period: 'month'|'30d'|'90d') → DailyFlow[]
        └── dre/
            └── queries.ts      ← useDRE(year, month) → DRERow[] aggregated by category
```

---

## Architecture Conventions

### Router Guards (`src/lib/router.tsx`)

Three guards wrap routes:

| Guard | Condition | Redirects |
|---|---|---|
| `RequireAuth` | Must be authenticated + onboarded | → `/login` or `/onboarding` |
| `RequireAuth` | `company_user` must have `activeCompany` | → renders `<NoCompanyShell />` inline |
| `RequireOnboarding` | Must have null profile (first login) | → `/dashboard` if already has profile |
| `RequireAccountant` | Must have `user_type === 'accountant'` | → `/dashboard` |

Routes use **English URL paths** (`/transactions`, `/cash-flow`, `/accounts`, `/dre`, `/accountant`).

### State Management

Two Zustand stores:

**`useAuthStore`** (`store/auth.ts`) — transient + partially persisted:
- `user` — Supabase `User` object (not persisted)
- `profile` — `Profile` interface (not persisted)
- `activeCompany` — `ActiveCompany` interface (persisted to localStorage as `'finflow-auth'`)

**`usePreferencesStore`** (`store/preferences.ts`) — fully persisted:
- `language: 'pt' | 'en'` (persisted as `'finflow-prefs'`)

### Data Fetching

React Query (TanStack Query v5). All queries:
- Use `activeCompany?.id` in `queryKey` to scope per company
- Use `enabled: !!activeCompany?.id` to skip when no company is selected
- Default stale time: React Query defaults (not overridden globally)

Query invalidation uses `queryKey` prefixes: `['transactions', companyId]`, `['categories', companyId]`, `['payables', companyId, type]`, `['cashflow', companyId, period]`, `['dre', companyId, year, month]`.

### Authentication Flow

1. User hits `/login` → clicks "Entrar com Google" → `signInWithGoogle()` starts OAuth
2. Supabase redirects back with session → `onAuthStateChange` fires
3. `fetchProfile(userId)` runs — returns `null` for brand-new users
4. If `profile === null` and `user` exists → `needsOnboarding = true` → router sends to `/onboarding`
5. User selects type (company/accountant) → `createProfile(type)` upserts to `profiles` table
6. On success, `fetchProfile` runs again → `profile` populated → router sends to `/dashboard`

### i18n

`useT()` from `src/i18n/index.ts` returns a translation lookup function:
```tsx
const t = useT()
// t('dashboard') → 'Painel' (PT) or 'Dashboard' (EN)
```
Keys are typed via `TranslationKey` exported from `i18n/pt.ts`. Add new keys to both `pt.ts` and `en.ts`.

### Component Conventions

- Path alias `@` maps to `/src` — always use `@/` imports instead of relative `../../`
- UI components re-exported from `@/components/ui` (barrel index)
- Toast notifications: `useToast()` from `@/components/ui/Toast`
- All financial values use `JetBrains Mono` font — apply via `font-mono` Tailwind class
- Buttons with async actions get `loading={isPending}` prop

---

## Design System

**Theme:** Dark by default (no light mode toggle)  
**Fonts:** DM Sans (body) + JetBrains Mono (numeric values)

**CSS variables** (`src/index.css`):
```css
--bg-base:        #0b0f19   /* page background */
--bg-surface:     #111827   /* cards */
--bg-elevated:    #1a2236   /* inputs, dropdowns */
--bg-border:      #1e2d45   /* borders */

--text-primary:   #f1f5f9
--text-secondary: #94a3b8
--text-muted:     #475569

--accent:         #3b82f6   /* primary blue */
--success:        #10b981   /* income / paid */
--danger:         #f43f5e   /* expense / overdue */
--warning:        #f59e0b   /* pending / upcoming */
```

---

## Business Rules

1. **All financial data has `company_id`** — always filter by `activeCompany.id` from the auth store
2. **Accountants are read-only** — never create mutations in pages under `src/pages/contador/`
3. **`accountant_companies.status` must be `'accepted'`** for accountant RLS to allow access
4. **Accountant invite flow** — company admin creates a record in `accountant_companies`; invite delivered via token URL (`/invite/:token`)
5. **Company switching** — stored in Zustand `activeCompany`, persisted in localStorage; changing it should invalidate all company-scoped queries
6. **PWA banner** — shown when `window.innerWidth < 768` and app is not installed as standalone
7. **CNPJ formatting** — mask as `00.000.000/0000-00` in the UI; store raw digits in DB
8. **Tax regime values in DB:** `'simples'`, `'lucro_presumido'`, `'lucro_real'` — send empty string as `null`/undefined (the DB rejects empty string due to enum constraint)

---

## What Still Needs Implementing

Items below are verified as not yet done:

### High priority
- [ ] **Tests** — no unit, integration, or e2e tests exist yet
- [ ] **Error boundaries** — uncaught React errors will white-screen the app
- [ ] **Real-time subscriptions** — currently polling via React Query; Supabase Realtime not wired up
- [ ] **Category management UI** — `categories` table exists and is queried, but no CRUD UI in Settings
- [ ] **Create company flow** — `NoCompanyShell` shows the UI but the actual Supabase insert + `setActiveCompany` may need completion/verification

### Medium priority
- [ ] **Export to PDF/Excel** — DRE and transactions have no export feature
- [ ] **Advanced transaction filtering** — date range picker, multi-category filter in Lancamentos
- [ ] **Batch mark as paid** — selecting multiple payables and bulk-updating status
- [ ] **Dashboard metrics** — verify the revenue/expense/result/pending calculations against real data
- [ ] **Accountant module data** — pages exist but may show empty states without seed data

### Lower priority
- [ ] **Tooltip.tsx UI component** — listed in original plan but not yet created
- [ ] **Deploy to Vercel** — `vercel.json` exists but project not connected to Vercel yet
- [ ] **Register.tsx** — minimal implementation; full sign-up flow with email/password not needed if Google-only

---

## Useful Commands

```bash
# Run dev server
npm run dev

# Production build (runs tsc first)
npm run build

# Type check only
npm run typecheck

# Lint
npm run lint

# Sync types from live DB schema
npx supabase gen types typescript \
  --project-id kmcwjilzhiyooacdpfdo \
  --schema public > src/types/database.types.ts
```

---

## Getting Started (new session)

```bash
# From the repo root
npm install

# Create .env if missing
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm run dev
# → http://localhost:5173
```

> In Claude Code, start with:
> _"Read CLAUDE.md and implement the next item from the pending list"_
