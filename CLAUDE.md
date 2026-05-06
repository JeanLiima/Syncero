# CLAUDE.md — Syncero

> Read this before writing any code.

---

## Campos nos specs OpenAPI (OBRIGATÓRIO)

Use os campos nativos do OpenAPI — **não** coloque default ou exemplo dentro de `description`.  
Cada spec tem um idioma: PT ou EN. **Todas as descriptions, summaries e examples devem estar no idioma do spec** — nunca misturar.

```jsonc
// ✓ correto
"page_size": {
  "type": "integer",
  "default": 20,
  "maximum": 1000,
  "example": 50
}

// ✗ errado — poluí a description
"page_size": {
  "type": "integer",
  "description": "Tamanho da página. Default: 20. Exemplo: 50."
}
```

**Regra:** `description` é para semântica de negócio. `default`, `example`, `minimum`, `maximum`, `enum` e `format` são campos estruturados do schema — use-os diretamente. Scalar renderiza cada um no lugar correto da UI.

---

## API ↔ Docs Sync (OBRIGATÓRIO)

**Toda alteração em rota de backend deve atualizar os specs OpenAPI.**

- Rotas: `apps/flow/api/routes/*.ts` e `apps/books/api/routes/*.ts`
- Specs: `apps/docs/public/openapi-{flow,books}.json` (+ `-external*.json`)
- O que atualizar: novo endpoint, campo required/optional, query param, status code, nullable
- Use `/sync-api-docs` para automatizar a análise e atualização

---

## Projeto

**Syncero** — Plataforma financeira conectando empresas e contadores.

**Stack:** React 18 + Vite + TypeScript + Tailwind CSS v4 + Supabase + Hono (Edge Functions)  
**Monorepo:** `apps/landing` (5173) · `apps/flow` (5174) · `apps/books` (5175) · `apps/docs` (5176)  
**Repo:** `JeanLiima/Syncero`

---

## Infraestrutura

**Supabase:** project `kmcwjilzhiyooacdpfdo` · sa-east-1 · anon key em `.env` (nunca commitar)

**Vercel:**
| App | URL |
|-----|-----|
| landing | `https://syncero.vercel.app` |
| flow | `https://syncero-flow.vercel.app` |
| books | `https://syncero-books.vercel.app` |

> Preview deployments usam URLs de produção para links cross-app.

---

## Banco de dados

**Schema compacto:** `db-schema.md` — leia quando precisar de tipos, nullability ou relações FK.  
**Migrations:** `supabase/migrations/001…023_*.sql` — fonte de verdade para DDL.  
**Enums importantes:** `invite_status(pending|accepted|revoked)`, `company_role(admin|member|viewer|…)`, `entry_source(manual|api|syncero_import|…)`

**Helper functions (SECURITY DEFINER):**
- `is_company_member(id)` · `is_company_admin(id)` · `is_accountant_of(id)`

---

## Auth Flow (cross-domain)

Login **apenas no landing**. Flow e Books não têm página de login.

```
landing → Google OAuth → callback
  → getProfileType() → DB
  → window.location.replace(`${appUrl}#access_token=X&refresh_token=Y`)

flow/books → lê hash manualmente → supabase.auth.setSession()
  → history.replaceState (limpa tokens da URL) → app pronto
```

**Por quê hash manual?** Supabase usa PKCE mode onde `detectSessionInUrl` procura `?code=`, não `#access_token=`. `setSession()` manual funciona independente do flowType.

---

## Regras de negócio

1. Dados financeiros sempre escopados por `company_id` — usar `activeCompany.id` da auth store
2. Contadores são **somente leitura** — nunca adicionar mutations em `pages/accountant/` no Books
3. `accountant_companies.status = 'accepted'` é necessário para RLS liberar acesso do contador
4. Troca de empresa invalida todas as React Query keys prefixadas com `companyId`
5. CNPJ armazenado como dígitos brutos no DB; formatado como `00.000.000/0000-00` na UI
6. Tax regime: `'simples' | 'lucro_presumido' | 'lucro_real'` — string vazia → enviar null
7. **Uma empresa pode ter no máximo um contador** — POST `/api/accountant-companies` retorna 409 se já existe vínculo `status IN ('accepted', 'pending')`
8. `company_id XOR ext_company_id` em `transactions`, `account_plans`, `journal_entries`, `api_keys` — exatamente um dos dois deve estar preenchido
9. `counterpart` é required em `POST /api/transactions` (Flow e Books)

---

## i18n (OBRIGATÓRIO)

**Todo texto visível ao usuário deve ter tradução em PT e EN.** Nunca adicionar texto em só um idioma.

### Apps — Flow e Books
- Hook: `useT()` de `@/i18n`
- Fonte de verdade das chaves: `pt.ts` — adicione a chave lá primeiro, depois em `en.ts`
- Ao remover texto da UI: remover a chave de ambos `pt.ts` e `en.ts`

### Docs — `apps/docs/*.html`
- Cada HTML tem um objeto `T = { pt: {...}, en: {...} }` inline
- Ao adicionar texto: criar a chave em `T.pt` e `T.en`
- Ao remover texto: remover a chave de ambos os idiomas e o `data-i18n` do HTML
- Ao atualizar texto: atualizar nas duas línguas

---

## Convenção de nomes na API (OBRIGATÓRIO)

**Tudo snake_case** — query params, body fields e path params.  
Consistente com as colunas do banco e com a maioria dos campos já existentes.

```
✓ GET /api/transactions?company_id=...&date_from=...&page_size=20
✓ POST /api/categories  { "company_id": "...", "name": "...", "type": "income" }
✗ GET /api/transactions?companyId=...&pageSize=20   ← nunca
✗ POST /api/categories  { "companyId": "...", ... }  ← nunca
```

**Campos que foram padronizados (referência):**

| Antes (camelCase) | Depois (snake_case) |
|-------------------|---------------------|
| `companyId` | `company_id` |
| `extCompanyId` | `ext_company_id` |
| `pageSize` | `page_size` |
| `transferTo` | `transfer_to` |
| `targetId` | `target_id` |
| `expiresAt` | `expires_at` |
| `seedPlan` | `seed_plan` |

**Frontend `buildQuery()`** — auto-converte camelCase → snake_case nas URLs.  
Parâmetros de função TypeScript podem ser camelCase (`companyId: string`), mas o que vai para o wire deve ser snake_case.

---

## Padrões de código

- **Path alias:** `@` → `src/` — sempre usar `@/` imports
- **Backend:** Hono em Vercel Edge Functions — sem Node.js APIs (usar `crypto.subtle`, `globalThis.crypto`)
- **Auth middleware:** `authMiddleware` (Bearer JWT) · `apiKeyOrJwtMiddleware` (API Key ou JWT, rotas externas Books)
- **Origin Guard:** `originGuard` middleware em todas as rotas internas — em produção bloqueia origens não listadas em `ALLOWED_ORIGINS`

---

## Dev Commands

```bash
npm install          # instalar todas as dependências

npm run dev          # todos os apps em paralelo

# Type check
npm run typecheck

# Sync tipos do DB (gera database.types.ts)
npx supabase gen types typescript \
  --project-id kmcwjilzhiyooacdpfdo \
  --schema public > apps/flow/src/types/database.types.ts
```

**Variáveis de ambiente necessárias (cada app tem `.env`):**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — todos os apps
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server-side (Flow + Books API)
- `RESEND_API_KEY` — envio de e-mails (Flow)
- `ALLOWED_ORIGINS` — domínios permitidos (produção)
