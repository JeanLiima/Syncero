import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Select, Card } from '@syncero/ui'
import { DEFAULT_ACCOUNT_PLAN } from '@/lib/defaultAccountPlan'
import type { TaxRegime, CompanyIntegration } from '@/types'

const taxRegimeOptions = [
  { value: '', label: '— Não definido —' },
  { value: 'simples', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
]

const integrationOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'dominio', label: 'Domínio Sistemas' },
  { value: 'other', label: 'Outro sistema' },
]

export function Component() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [taxRegime, setTaxRegime] = useState<TaxRegime | ''>('')
  const [integration, setIntegration] = useState<CompanyIntegration>('manual')
  const [notes, setNotes] = useState('')
  const [seedPlan, setSeedPlan] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Informe o nome da empresa.'); return }
    if (!user?.id) return

    setSubmitting(true)
    try {
      const rawCnpj = cnpj.replace(/\D/g, '')
      const { data: company, error: insertErr } = await supabase
        .from('external_companies')
        .insert({
          accountant_id: user.id,
          name: name.trim(),
          cnpj: rawCnpj || null,
          trade_name: tradeName.trim() || null,
          tax_regime: taxRegime || null,
          integration,
          notes: notes.trim() || null,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr

      if (seedPlan && company) {
        // Build id map for parent references
        const codeToId = new Map<string, string>()
        for (const account of DEFAULT_ACCOUNT_PLAN) {
          const parentId = account.parent_code ? (codeToId.get(account.parent_code) ?? null) : null
          const { data: row } = await supabase
            .from('account_plans')
            .insert({
              ext_company_id: company.id,
              accountant_id: user.id,
              parent_id: parentId,
              code: account.code,
              name: account.name,
              account_type: account.account_type,
              nature: account.nature,
              is_analytic: account.is_analytic,
            })
            .select('id')
            .single()
          if (row) codeToId.set(account.code, row.id)
        }
      }

      qc.invalidateQueries({ queryKey: ['external-companies', user.id] })
      navigate(`/accountant/external/${company.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar empresa.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <button
          onClick={() => navigate('/accountant')}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-3 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Nova empresa externa</h1>
        <p className="text-sm text-[var(--text-muted)]">Empresa que não usa o Syncero Flow.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Razão social *"
            placeholder="Nome da empresa"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Input
            label="Nome fantasia"
            placeholder="Nome comercial"
            value={tradeName}
            onChange={e => setTradeName(e.target.value)}
          />
          <Input
            label="CNPJ"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={e => setCnpj(e.target.value)}
            maxLength={18}
          />
          <Select
            label="Regime tributário"
            options={taxRegimeOptions}
            value={taxRegime}
            onChange={v => setTaxRegime(v as TaxRegime | '')}
          />
          <Select
            label="Sistema de origem"
            options={integrationOptions}
            value={integration}
            onChange={v => setIntegration(v as CompanyIntegration)}
          />
          <Input
            label="Observações"
            placeholder="Notas internas sobre a empresa"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={seedPlan}
              onChange={e => setSeedPlan(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--bg-border)] bg-[var(--bg-elevated)] accent-[var(--accent)]"
            />
            Criar Plano de Contas padrão CFC
          </label>

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => navigate('/accountant')}>Cancelar</Button>
            <Button type="submit" loading={submitting}>Criar empresa</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
