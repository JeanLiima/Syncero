# check-i18n

Valida se todas as traduções estão em sincronia em PT e EN — tanto nos apps (Flow/Books) quanto nos HTMLs do docs.

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

### 2. Docs — `apps/docs/*.html`

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

1. Ler `apps/flow/src/i18n/pt.ts` → extrair todas as chaves
2. Ler `apps/flow/src/i18n/en.ts` → comparar chaves
3. Grep por cada chave em `apps/flow/src/**` para checar uso
4. Repetir para `apps/books/src/i18n/`
5. Para cada HTML em `apps/docs/`: ler o arquivo, extrair `T.pt`, `T.en` e todos os `data-i18n`
6. Reportar todas as inconsistências encontradas

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

## Docs HTML

### index.html
✓ PT ↔ EN em sincronia
⚠ Chaves em PT sem EN: [lista]
⚠ Chaves em EN sem PT: [lista]
⚠ Chaves definidas mas sem data-i18n: [lista]
⚠ data-i18n sem chave no dicionário: [lista]

(repetir para flow-external.html, books-external.html)
```

## Após o relatório

Se houver problemas, pergunte ao usuário se deseja corrigir automaticamente. Se sim:
- Adicionar chaves faltantes (PT como base para sugerir EN)
- Remover chaves órfãs
- Não alterar valores existentes sem confirmação

## Arquivos relevantes

| Tipo | Caminho |
|------|---------|
| App PT (fonte) | `apps/flow/src/i18n/pt.ts`, `apps/books/src/i18n/pt.ts` |
| App EN | `apps/flow/src/i18n/en.ts`, `apps/books/src/i18n/en.ts` |
| Docs HTML | `apps/docs/index.html`, `apps/docs/flow-external.html`, `apps/docs/books-external.html` |
