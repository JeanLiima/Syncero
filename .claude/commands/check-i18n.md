# check-i18n

Valida se todas as traduções estão em sincronia em PT e EN — tanto nos apps (Flow/Books) quanto nos HTMLs do docs. Também detecta candidatos ao pacote compartilhado e erros do backend sem tradução.

## O que este comando faz

### 1. Apps — Flow e Books (`src/i18n/`)

Para cada app em `apps/flow` e `apps/books`:

**a) Chaves faltando no EN**
- Lê `src/i18n/pt.ts` (fonte de verdade)
- Lê `src/i18n/en.ts`
- Reporta chaves presentes em PT mas ausentes em EN

**b) Chaves órfãs no EN**
- Reporta chaves presentes em EN mas ausentes em PT (PT é a fonte de verdade)

**c) Chaves não utilizadas**
- Faz grep de cada chave no código-fonte (`src/**/*.tsx`, `src/**/*.ts`)
- Reporta chaves definidas em `pt.ts` que não aparecem em nenhum `useT()` call

**d) Valores vazios**
- Reporta chaves com string vazia `''` em PT ou EN

### 2. Traduções duplicadas — candidatos ao `@syncero/i18n`

**O que verificar:** Chaves que aparecem em ambos `apps/flow/src/i18n/pt.ts` E `apps/books/src/i18n/pt.ts` com valores idênticos, mas que NÃO estão em `packages/i18n/src/pt.ts`.

**Como detectar:**
- Extrair chaves explícitas de `apps/flow/src/i18n/pt.ts` (ignorar o `...sharedPt`)
- Extrair chaves explícitas de `apps/books/src/i18n/pt.ts` (ignorar o `...sharedPt`)
- Ler `packages/i18n/src/pt.ts` para saber o que já está compartilhado
- Para cada chave que aparece nos dois apps com mesmo valor PT E mesmo valor EN: reportar como candidata ao pacote compartilhado

**Ação esperada:** Mover a chave para `packages/i18n/src/pt.ts` e `en.ts`, e remover das cópias dos apps.

### 3. Erros do backend sem tradução (`api_error_*`)

**O que verificar:** Rotas do backend que retornam `c.json({ error: '...' })` onde o valor parece ser uma mensagem em linguagem natural (começa com maiúscula, contém espaços ou está em português/inglês) ao invés de um código `lowercase_underscore`.

**Arquivos a verificar:**
- `apps/flow/api/routes/*.ts`
- `apps/books/api/routes/*.ts`

**Padrão problemático:**
```ts
// ✗ mensagem hardcoded — não tem tradução
c.json({ error: 'This company already has an accountant.' }, 409)
c.json({ error: 'Usuário não encontrado.' }, 404)
```

**Padrão correto:**
```ts
// ✓ código — tem correspondência api_error_* no i18n
c.json({ error: 'accountant_already_linked' }, 409)
```

**Regra de detecção:** O valor de `error` é problemático se:
- Contém espaços, ou
- Começa com letra maiúscula, ou
- Termina com ponto final, ou
- Está em português (contém acentos ou palavras PT)

**Para cada erro problemático encontrado:**
- Reportar arquivo, linha e a mensagem atual
- Sugerir um código `lowercase_underscore` equivalente
- Verificar se já existe a chave `api_error_{código}` em `packages/i18n/src/pt.ts`

**Também verificar no sentido inverso:**
- Para cada `api_error_*` em `packages/i18n/src/pt.ts`, verificar se existe ao menos um `c.json({ error: 'código' })` correspondente no backend
- Reportar `api_error_*` orphans (chave de tradução sem erro de backend correspondente)

### 4. Uso de `error.message` direto no frontend

**O que verificar:** Procurar em `apps/flow/src/**` e `apps/books/src/**` por padrões como:
- `(error as Error)?.message`
- `err.message`
- `e.message`

quando usados em JSX para exibição direta ao usuário (dentro de `<p>`, `<span>`, ou em `toastError()`).

**Padrão problemático:**
```tsx
{(invite.error as Error)?.message ?? t('settings_inviteError')}
toastError(err instanceof Error ? err.message : t('common_errorGeneric'))
```

**Padrão correto:**
```tsx
{apiError(invite.error, t, 'settings_inviteError')}
toastError(t('common_errorGeneric'))
```

Reportar cada ocorrência com arquivo e linha.

### 5. Docs — `apps/docs/*.html`

Para cada HTML que tenha um objeto `T = { pt: {...}, en: {...} }`:

**a) Paridade PT ↔ EN**
- Extrai chaves do bloco `T.pt` e do bloco `T.en`
- Reporta chaves em PT mas não em EN, e vice-versa

**b) Chaves não utilizadas**
- Extrai todos os `data-i18n="..."` usados no HTML
- Reporta chaves definidas em `T.pt`/`T.en` mas sem `data-i18n` correspondente

**c) Referências sem definição**
- Reporta `data-i18n="chave"` sem correspondência no dicionário

## Como executar

Use as ferramentas Read e Grep para inspecionar os arquivos. Não use Bash com grep — use a ferramenta Grep diretamente.

### Fluxo de execução

1. Ler `packages/i18n/src/pt.ts` → extrair chaves do pacote compartilhado
2. Ler `apps/flow/src/i18n/pt.ts` e `en.ts` → chaves explícitas do app
3. Ler `apps/books/src/i18n/pt.ts` e `en.ts` → chaves explícitas do app
4. Verificar sincronia PT ↔ EN em cada app (checks a/b/c/d)
5. Detectar chaves duplicadas entre os apps não presentes no shared (check 2)
6. Grep `c.json.*error` em todos os routes do backend (check 3)
7. Comparar códigos de backend com chaves `api_error_*` existentes (check 3 reverso)
8. Grep `error.*message` em JSX frontend (check 4)
9. Processar HTMLs do docs (check 5)
10. Reportar tudo

## Formato do relatório

```
## Flow i18n

✓ PT ↔ EN em sincronia
⚠ Chaves em PT sem EN: [lista]
⚠ Chaves em EN sem PT (órfãs): [lista]
⚠ Chaves não utilizadas no código: [lista]
⚠ Valores vazios: [lista]

## Books i18n
(mesmo formato)

## Traduções duplicadas → candidatas ao @syncero/i18n

⚠ Chaves idênticas em Flow e Books, mas não no shared:
  - chave_x: 'valor PT' / 'EN value'
  - chave_y: ...

## Erros do backend sem tradução

⚠ Mensagens hardcoded encontradas (não são códigos):
  apps/flow/api/routes/_companies.ts:23
    atual:    'Failed to create company'
    sugerido: 'company_create_failed'
    api_error_*: ✗ não existe

⚠ Chaves api_error_* sem erro de backend correspondente:
  - api_error_xyz (definida em shared/pt.ts, sem c.json({ error: 'xyz' }))

## Uso de error.message no frontend

⚠ error.message exibido diretamente ao usuário:
  apps/flow/src/pages/settings/Company.tsx:434
    {(save.error as Error)?.message}
    → usar: apiError(save.error, t, 'common_errorGeneric')

## Docs HTML

### index.html
✓ PT ↔ EN em sincronia
⚠ Chaves em PT sem EN: [lista]
...
```

## Após o relatório

Se houver problemas, pergunte ao usuário se deseja corrigir automaticamente. Se sim:
- Mover chaves duplicadas para `packages/i18n/src/`
- Substituir mensagens de backend por códigos
- Adicionar chaves `api_error_*` faltantes
- Substituir `error.message` direto por `apiError()`
- Não alterar valores de tradução existentes sem confirmação

## Arquivos relevantes

| Tipo | Caminho |
|------|---------|
| Shared PT | `packages/i18n/src/pt.ts` |
| Shared EN | `packages/i18n/src/en.ts` |
| App PT (fonte) | `apps/flow/src/i18n/pt.ts`, `apps/books/src/i18n/pt.ts` |
| App EN | `apps/flow/src/i18n/en.ts`, `apps/books/src/i18n/en.ts` |
| apiError helper | `apps/flow/src/i18n/apiError.ts` |
| Backend routes (Flow) | `apps/flow/api/routes/*.ts` |
| Backend routes (Books) | `apps/books/api/routes/*.ts` |
| Docs HTML | `apps/docs/index.html`, `apps/docs/flow-external.html`, `apps/docs/books-external.html` |
