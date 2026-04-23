# books-api — Edge Function

Endpoint base: `https://kmcwjilzhiyooacdpfdo.supabase.co/functions/v1/books-api`

---

## Autenticação

Todas as rotas (exceto `GET /ping`) exigem uma API Key válida no header:

```
Authorization: Bearer <chave>
```

A chave é gerada no painel do Syncero Books em **Empresa → API Keys**. A raw key é exibida apenas uma vez no momento da criação.

Internamente, o servidor calcula `SHA-256(chave)` e compara com o campo `key_hash` na tabela `api_keys`. Apenas chaves com `is_active = true` e `expires_at > now()` (ou sem expiração) são aceitas.

---

## Rotas

### `GET /ping`

Verificação de saúde. Se uma API Key válida for enviada, retorna também os dados da empresa associada.

**Request**
```
GET /functions/v1/books-api/ping
Authorization: Bearer sk_...  (opcional)
```

**Response 200**
```json
{ "ok": true }
```

Com chave válida:
```json
{
  "ok": true,
  "company_id": "uuid | null",
  "ext_company_id": "uuid | null"
}
```

---

### `POST /entries`

Cria um lançamento contábil (partidas dobradas) na empresa associada à API Key.

**Request**
```
POST /functions/v1/books-api/entries
Authorization: Bearer sk_...
Content-Type: application/json
```

**Body**
```json
{
  "entry_date": "2025-01-15",
  "description": "Pagamento de fornecedor",
  "external_ref": "NF-1234",
  "lines": [
    {
      "account_code": "2.1.1.01",
      "side": "debit",
      "amount": 1500.00,
      "memo": "Fornecedor X"
    },
    {
      "account_code": "1.1.1.01",
      "side": "credit",
      "amount": 1500.00,
      "memo": ""
    }
  ]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `entry_date` | `string` (YYYY-MM-DD) | Sim | Data do lançamento |
| `description` | `string` | Sim | Histórico do lançamento |
| `external_ref` | `string` | Não | Número do documento (NF, boleto, etc.) |
| `lines` | `array` | Sim | Partidas do lançamento (mínimo 2) |
| `lines[].account_code` | `string` | Sim | Código da conta no Plano de Contas da empresa |
| `lines[].side` | `"debit"` \| `"credit"` | Sim | Lado da partida |
| `lines[].amount` | `number` | Sim | Valor positivo (> 0) |
| `lines[].memo` | `string` | Não | Complemento da partida |

**Regras de validação:**
- `sum(debits) === sum(credits)` — lançamento deve estar balanceado
- Todo `account_code` deve existir no Plano de Contas da empresa vinculada à API Key
- A conta deve ser analítica (`is_analytic = true`) para receber lançamentos

**Response 201**
```json
{ "id": "uuid-do-lancamento" }
```

**Erros**

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `missing_key` | Header Authorization ausente |
| 401 | `invalid_key` | Chave não encontrada, revogada ou expirada |
| 400 | `invalid_body` | JSON inválido ou campos obrigatórios ausentes |
| 400 | `unbalanced` | Soma de débitos ≠ soma de créditos |
| 400 | `account_not_found` | Um ou mais `account_code` não existem na empresa |
| 500 | `insert_error` | Erro interno ao salvar no banco |

Formato do erro:
```json
{ "error": "unbalanced", "message": "debits (1500.00) != credits (1000.00)" }
```

---

## Exemplo com curl

```bash
# Verificar chave
curl https://kmcwjilzhiyooacdpfdo.supabase.co/functions/v1/books-api/ping \
  -H "Authorization: Bearer sk_abc123..."

# Criar lançamento
curl -X POST https://kmcwjilzhiyooacdpfdo.supabase.co/functions/v1/books-api/entries \
  -H "Authorization: Bearer sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "entry_date": "2025-01-15",
    "description": "Pagamento fornecedor",
    "external_ref": "NF-001",
    "lines": [
      { "account_code": "2.1.1.01", "side": "debit",  "amount": 500.00 },
      { "account_code": "1.1.1.01", "side": "credit", "amount": 500.00 }
    ]
  }'
```

---

## Fonte do lançamento

Lançamentos criados via API recebem automaticamente `source = "api"` na tabela `journal_entries`. Isso permite filtrar no painel quais lançamentos vieram de integrações externas.
