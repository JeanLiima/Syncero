# CLAUDE.md — Handoff para Claude Code
> Documento gerado na sessão de arquitetura. Leia inteiro antes de escrever qualquer código.

---

## O que é esse projeto

**Finflow** — PWA de controle financeiro empresarial, multi-tenant, com módulo fiscal para contadores.

Stack: React 18 + Vite + TypeScript + Tailwind CSS v4 + Supabase + vite-plugin-pwa

---

## Infraestrutura já provisionada

### Supabase (produção)
- **Project ID:** `kmcwjilzhiyooacdpfdo`
- **URL:** `https://kmcwjilzhiyooacdpfdo.supabase.co`
- **Região:** sa-east-1 (São Paulo)
- **Anon key:** no arquivo `.env` (não commitar)

### Banco de dados — 100% aplicado
5 migrations rodando em produção:

| Migration | Conteúdo |
|---|---|
| `enums_and_profiles` | Enums de tipo/role, tabela `profiles` |
| `companies_and_members` | `companies`, `company_members`, `accountant_companies` |
| `financial_tables` | `categories`, `transactions`, `payables_receivables` |
| `fiscal_tables` | `fiscal_documents`, `fiscal_books`, `tax_calculations` |
| `indexes_functions_rls` | Índices, funções RLS, todas as policies |

**Tabelas:** profiles · companies · company_members · accountant_companies · categories · transactions · payables_receivables · fiscal_documents · fiscal_books · tax_calculations

**Funções auxiliares no banco:**
- `is_company_member(company_id)` → boolean
- `is_accountant_of(company_id)` → boolean

**RLS:** ativado em todas as tabelas. Contador tem leitura em `fiscal_documents`, `fiscal_books` e `tax_calculations` via `accountant_companies`.

---

## Arquivos já criados

```
finflow/
├── index.html
├── package.json
├── vite.config.ts          ← React + Tailwind v4 + PWA configurado
├── tsconfig.json
├── tsconfig.node.json
├── .env                    ← credenciais reais (não commitar)
├── .env.example
├── .gitignore
├── setup-github.sh         ← script para criar repo no GitHub
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
│
└── src/
    ├── main.tsx            ← entry com QueryClient + RouterProvider
    ├── index.css           ← design tokens (dark theme, DM Sans)
    │
    ├── lib/
    │   ├── supabase.ts     ← createClient tipado
    │   └── router.tsx      ← rotas com guards RequireAuth + RequireAccountant
    │
    ├── store/
    │   └── auth.ts         ← Zustand store (user, profile, activeCompany)
    │
    ├── hooks/
    │   ├── useAuth.ts      ← auth completo: signIn/signUp/signOut + profile
    │   └── usePWAInstall.ts ← install prompt + detecção de resize
    │
    └── components/
        ├── PWABanner.tsx   ← banner de instalação (nativo + iOS manual)
        └── ui/
            ├── index.ts
            ├── Button.tsx  ← variants: primary | ghost | danger
            ├── Input.tsx   ← com label e estado de erro
            ├── Card.tsx
            └── Badge.tsx   ← variants: default | success | danger | warning | info
```

---

## O que falta implementar

### 1. Componentes UI base (continuar em `src/components/ui/`)
- [ ] `Spinner.tsx` — usado no Button (já importado, falta criar)
- [ ] `Select.tsx`
- [ ] `Modal.tsx`
- [ ] `Table.tsx`
- [ ] `Tabs.tsx`
- [ ] `Avatar.tsx`
- [ ] `Tooltip.tsx`
- [ ] `ConfirmDialog.tsx`

### 2. Layout shell (`src/components/Layout.tsx`)
- [ ] Sidebar com nav adaptada por role
  - Empresa: Dashboard · Lançamentos · Fluxo de Caixa · Contas · DRE · Configurações
  - Contador: Minhas Empresas
- [ ] Topbar com empresa ativa + seletor de empresa
- [ ] Menu mobile (bottom nav ou drawer)
- [ ] Integrar `PWABanner` no topo

### 3. Páginas de autenticação
- [ ] `src/pages/Login.tsx`
- [ ] `src/pages/Register.tsx` — campos: nome, e-mail, senha, tipo (empresa/contador)
- [ ] `src/pages/AcceptInvite.tsx` — aceita convite via token (membro ou contador)

### 4. Módulo: Lançamentos (`src/modules/lancamentos/`)
- [ ] `queries.ts` — React Query hooks para listagem, paginação, filtros
- [ ] `mutations.ts` — criar, editar, marcar como pago
- [ ] `types.ts`
- [ ] `src/pages/Lancamentos.tsx` — lista + formulário de novo lançamento

### 5. Módulo: Fluxo de Caixa (`src/modules/fluxo/`)
- [ ] Query que agrega transactions por período
- [ ] `src/pages/FluxoCaixa.tsx` — gráfico Recharts (área ou barras) + saldo acumulado

### 6. Módulo: Contas (`src/modules/contas/`)
- [ ] CRUD de `payables_receivables`
- [ ] `src/pages/Contas.tsx` — tabs Pagar / Receber, agrupado por vencimento

### 7. Módulo: DRE (`src/modules/dre/`)
- [ ] Query que agrega transactions por categoria e período
- [ ] `src/pages/DRE.tsx` — tabela DRE com receitas, despesas, resultado

### 8. Dashboard (`src/pages/Dashboard.tsx`)
- [ ] Cards de métricas: receita, despesa, resultado, a receber
- [ ] Gráfico de fluxo dos últimos 30 dias (Recharts)
- [ ] Lista dos últimos 5 lançamentos
- [ ] Integrar `PWABanner`

### 9. Configurações (`src/pages/Settings.tsx`)
- [ ] Dados da empresa (nome, CNPJ, regime tributário)
- [ ] Gerenciar membros (convidar, revogar)
- [ ] Convidar contador (gera link de convite)
- [ ] Criar nova empresa

### 10. Área do Contador
- [ ] `src/pages/contador/Dashboard.tsx` — lista empresas vinculadas via `accountant_companies`
- [ ] `src/pages/contador/EmpresaFiscal.tsx` — resumo fiscal (readonly)
- [ ] `src/pages/contador/NFe.tsx` — lista `fiscal_documents` filtrado por empresa
- [ ] `src/pages/contador/SPED.tsx` — lista `fiscal_books`
- [ ] `src/pages/contador/Impostos.tsx` — lista `tax_calculations` por período

### 11. Tipos globais (`src/types/`)
- [ ] `src/types/index.ts` — tipos derivados das tabelas do banco

### 12. PWA — finalizar
- [ ] Criar ícones em `public/icons/icon-192.png` e `icon-512.png`
- [ ] Criar `public/favicon.svg`
- [ ] Testar install prompt no Chrome e iOS Safari
- [ ] Verificar cache offline no Workbox

### 13. Deploy
- [ ] Criar projeto no Vercel
- [ ] Configurar env vars: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- [ ] Conectar repositório GitHub ao Vercel (auto-deploy na main)

---

## Design system

**Tema:** dark por padrão  
**Fonte:** DM Sans (body) + JetBrains Mono (valores numéricos)  
**Variáveis CSS principais** (definidas em `src/index.css`):

```css
--bg-base:        #0b0f19   /* fundo da página */
--bg-surface:     #111827   /* cards */
--bg-elevated:    #1a2236   /* inputs, dropdowns */
--bg-border:      #1e2d45   /* bordas */

--text-primary:   #f1f5f9
--text-secondary: #94a3b8
--text-muted:     #475569

--accent:         #3b82f6   /* azul principal */
--success:        #10b981   /* receitas / pago */
--danger:         #f43f5e   /* despesas / vencido */
--warning:        #f59e0b   /* a vencer */
```

---

## Regras de negócio importantes

1. **Todo dado financeiro tem `company_id`** — sempre filtrar pela empresa ativa
2. **Contador só lê** — nunca criar mutations nas páginas do contador
3. **`accountant_companies.status`** deve ser `'accepted'` para o acesso funcionar
4. **Convite de contador** — admin da empresa cria registro em `accountant_companies`, sistema envia e-mail via Supabase Auth invite
5. **Troca de empresa** — armazenada no Zustand (`activeCompany`), persistida no localStorage
6. **PWA banner** — aparece quando `window.innerWidth < 768` e o app não está instalado

---

## Comandos úteis

```bash
# Rodar local
npm run dev

# Build
npm run build

# Verificar tipos
npm run typecheck

# Sincronizar types do banco (após mudanças no schema)
npx supabase gen types typescript \
  --project-id kmcwjilzhiyooacdpfdo \
  --schema public > src/types/database.types.ts
```

---

## Como iniciar no Claude Code

```bash
# 1. Clone o repositório (após rodar setup-github.sh)
git clone https://github.com/SEU_USUARIO/finflow
cd finflow

# 2. Instale as dependências
npm install

# 3. Configure o .env
cp .env.example .env
# Preencha com as credenciais do Supabase (estão no documento compartilhado)

# 4. Rode
npm run dev

# 5. Abra o Claude Code
claude
```

> No Claude Code, comece pedindo:
> _"Leia o CLAUDE.md e implemente o próximo item da lista de pendências"_
