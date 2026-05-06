# sync-api-docs

Analisa os arquivos de rota do backend e mantém os specs OpenAPI em sincronia.

## Quando usar

- Após modificar qualquer arquivo em `apps/flow/api/routes/` ou `apps/books/api/routes/`
- Após adicionar um novo endpoint
- Após alterar campos de request/response, status codes, query params ou nullability

## O que este comando faz

1. **Detecta o escopo** — Determina quais apps foram alterados (Flow, Books ou ambos) com base nos arquivos modificados no git (`git diff --name-only HEAD`). Se nenhum arquivo de rota mudou, analisa tudo.

2. **Lê os routes** — Lê cada arquivo de rota relevante e extrai:
   - Todos os endpoints registrados (método + path)
   - Campos do body com required/optional e nullable
   - Query params (required/optional)
   - Status codes retornados
   - Constraints visíveis no código (`.min()`, `Math.min()`, checks de tipo, enums via `check()`)

3. **Lê os specs atuais** — Carrega `openapi-flow.json` e/ou `openapi-books.json` de `apps/docs/public/`

4. **Compara** — Para cada rota no código, verifica se o spec:
   - Tem o path/operation documentado
   - Tem todos os campos do body (required e optional)
   - Tem todos os query params
   - Documenta os status codes corretos
   - Tem nullable correto nos campos
   - Tem os campos de schema completos (ver seção abaixo)

5. **Atualiza os specs** — Aplica as correções necessárias diretamente nos arquivos JSON. Não inventa endpoints que não existem no código.

6. **Valida** — Roda `node -e "JSON.parse(...)"` para confirmar que o JSON resultante é válido.

7. **Reporta** — Lista o que foi alterado em cada spec.

---

## Schema completo por tipo de campo

**Regra geral:** use os campos estruturados do OpenAPI — nunca coloque default, exemplo ou constraint dentro de `description`. O Scalar renderiza cada campo no lugar correto da UI.

```jsonc
// ✓ Schema completo
"page_size": {
  "type": "integer",
  "default": 20,
  "minimum": 1,
  "maximum": 1000,
  "example": 50,
  "description": "Número de registros por página"
}

// ✗ Errado — constraint embutido na description
"page_size": {
  "type": "integer",
  "description": "Número de registros por página. Default: 20. Máximo: 1000."
}
```

### Campos a preencher por situação

| Campo | Quando usar |
|-------|-------------|
| `type` | sempre — `string`, `integer`, `number`, `boolean`, `array`, `object` |
| `format` | UUIDs → `uuid`; datas → `date`; timestamps → `date-time`; emails → `email` |
| `default` | quando o backend aplica um valor padrão (ex: `?? '20'`, `?? false`) |
| `example` | sempre que o valor esperado não for óbvio pelo tipo |
| `minimum` | inteiros/números com limite inferior (`amount > 0` → `minimum: 0.01`) |
| `maximum` | inteiros/números com limite superior (`Math.min(N, 1000)` → `maximum: 1000`) |
| `minItems` | arrays com quantidade mínima de elementos |
| `enum` | quando o código valida contra lista fixa (ex: `check(type in ('income','expense'))`) |
| `nullable` | quando o campo aceita `null` explicitamente |
| `description` | **apenas** para semântica de negócio — o "por quê", não o "o quê" |

### Exemplos por tipo de param

**Query param com default e máximo:**
```json
{
  "name": "page_size",
  "in": "query",
  "schema": {
    "type": "integer",
    "default": 20,
    "minimum": 1,
    "maximum": 1000
  }
}
```

**Query param enum:**
```json
{
  "name": "type",
  "in": "query",
  "schema": {
    "type": "string",
    "enum": ["income", "expense"]
  }
}
```

**Body field com formato e exemplo:**
```json
{
  "date": {
    "type": "string",
    "format": "date",
    "example": "2026-05-01",
    "description": "Data de competência"
  }
}
```

**Body field numérico com constraint:**
```json
{
  "amount": {
    "type": "number",
    "minimum": 0.01,
    "example": 1500
  }
}
```

**UUID com exemplo:**
```json
{
  "company_id": {
    "type": "string",
    "format": "uuid",
    "example": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Regras de idioma nas descriptions

Cada spec tem um idioma definido — PT ou EN. **Todas as descriptions, summaries e examples devem estar no idioma do spec.** Nunca misturar.

| Spec | Idioma | Regra |
|------|--------|-------|
| `openapi-flow.json` | PT | tudo em português |
| `openapi-books.json` | PT | tudo em português |
| `openapi-flow-external.json` | PT | tudo em português |
| `openapi-books-external.json` | PT | tudo em português |
| `openapi-flow-external-en.json` | EN | tudo em inglês |
| `openapi-books-external-en.json` | EN | tudo em inglês |

**Termos técnicos no spec PT:** escrever em português, sem termos técnicos em inglês dentro de prose. Exemplos corretos:
- `"case-insensitive"` → `"sem distinção de maiúsculas/minúsculas"`
- `"Bulk-update"` → `"Atualização em lote"`
- `"accountingly"` → não é inglês válido — usar `"classified in Books"`

**Examples em specs EN:** os campos `example`, `value` dentro de `examples` e `summary` de exemplos também devem estar em inglês — incluindo textos de exemplo dentro dos objetos.

## Regras de nomenclatura

- **Tudo snake_case** — query params, body fields e path params. Nunca camelCase no wire.
- `buildQuery()` no frontend auto-converte camelCase → snake_case — mas o spec deve documentar snake_case diretamente.

---

## Regras importantes

- **Fonte de verdade é o código** — o spec deve refletir exatamente o que o backend faz, não o que deveria fazer
- **Não documentar comportamento aspiracional** — se uma validação não existe no código, não criar o status code 400 para ela
- **Spec externo** (`openapi-flow-external.json`, `openapi-books-external.json`) — atualizar apenas se o endpoint alterado estiver marcado como externo (usa `apiKeyOrJwtMiddleware` ou está listado no spec externo atual)
- **Nunca reescrever o spec inteiro** — usar edits cirúrgicos para preservar detalhes já documentados (descrições, exemplos, x-access tags)
- **JSON válido é obrigatório** — validar com `node -e "JSON.parse(...)"` após qualquer edição

---

## Checklist de campos por tipo de mudança

### Novo endpoint
```
- [ ] Adicionar em paths: { "method": { tags, summary, parameters/requestBody, responses } }
- [ ] Verificar se precisa de x-internal ou x-access tag
- [ ] Verificar se vai para spec externo também
- [ ] Preencher schema completo de cada param/field (type, format, default, example, enum, minimum, maximum)
```

### Novo query param
```
- [ ] Adicionar em parameters[] com in: "query"
- [ ] required: true se o backend retorna 400 quando ausente
- [ ] schema: type + format + default + enum + minimum + maximum conforme aplicável
- [ ] description apenas se a semântica não for óbvia
```

### Novo campo no body
```
- [ ] Adicionar ao array required[] se obrigatório
- [ ] Adicionar a properties com schema completo
- [ ] nullable: true se o código aceita null
- [ ] example se o valor esperado não for óbvio
```

### Campo removido
```
- [ ] Remover de required[] se estiver lá
- [ ] Remover de properties
```

### Status code novo
```
- [ ] Adicionar responses["NNN"] com description
- [ ] Incluir schema $ref: Error se for erro
```

---

## Arquivos relevantes

| Tipo | Caminho |
|------|---------|
| Rotas Flow | `apps/flow/api/routes/_*.ts` |
| Rotas Books | `apps/books/api/routes/_*.ts` |
| Spec Flow | `apps/docs/public/openapi-flow.json` |
| Spec Books | `apps/docs/public/openapi-books.json` |
| Spec Flow externo | `apps/docs/public/openapi-flow-external.json` |
| Spec Books externo | `apps/docs/public/openapi-books-external.json` |
