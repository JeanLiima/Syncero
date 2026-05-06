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

3. **Lê os specs atuais** — Carrega `openapi-flow.json` e/ou `openapi-books.json` de `apps/docs/public/`

4. **Compara** — Para cada rota no código, verifica se o spec:
   - Tem o path/operation documentado
   - Tem todos os campos do body (required e optional)
   - Tem todos os query params
   - Documenta os status codes corretos
   - Tem nullable correto nos campos

5. **Atualiza os specs** — Aplica as correções necessárias diretamente nos arquivos JSON. Não inventa endpoints que não existem no código.

6. **Valida** — Roda `node -e "JSON.parse(...)"` para confirmar que o JSON resultante é válido.

7. **Reporta** — Lista o que foi alterado em cada spec.

## Regras importantes

- **Fonte de verdade é o código** — o spec deve refletir exatamente o que o backend faz, não o que deveria fazer
- **Não documentar comportamento aspiracional** — se uma validação não existe no código, não criar o status code 400 para ela
- **Spec externo** (`openapi-flow-external.json`, `openapi-books-external.json`) — atualizar apenas se o endpoint alterado estiver marcado como externo (usa `apiKeyOrJwtMiddleware` ou está listado no spec externo atual)
- **Nunca reescrever o spec inteiro** — usar edits cirúrgicos para preservar detalhes já documentados (descrições, exemplos, x-access tags)
- **JSON válido é obrigatório** — validar com `node -e "JSON.parse(...)"` após qualquer edição

## Checklist de campos por tipo de mudança

### Novo endpoint
```
- [ ] Adicionar em paths: { "method": { tags, summary, parameters/requestBody, responses } }
- [ ] Verificar se precisa de x-internal ou x-access tag
- [ ] Verificar se vai para spec externo também
```

### Campo obrigatório adicionado ao body
```
- [ ] Adicionar ao array required[]
- [ ] Adicionar a properties com type correto
- [ ] Verificar nullable (se o código aceita null → nullable: true)
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

## Arquivos relevantes

| Tipo | Caminho |
|------|---------|
| Rotas Flow | `apps/flow/api/routes/_*.ts` |
| Rotas Books | `apps/books/api/routes/_*.ts` |
| Spec Flow | `apps/docs/public/openapi-flow.json` |
| Spec Books | `apps/docs/public/openapi-books.json` |
| Spec Flow externo | `apps/docs/public/openapi-flow-external.json` |
| Spec Books externo | `apps/docs/public/openapi-books-external.json` |
