import { useState } from 'react'
import { Pencil, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { Button, Modal } from '@syncero/ui'
import { useT } from '@/i18n'
import type { PlanEntry } from '@/lib/backend'
import { DEFAULT_PLAN } from '@/lib/defaultPlan'
import type { AccountType } from '@/types'

// ── Section metadata ──────────────────────────────────────────

const SECTIONS: { type: AccountType; label: string; color: string; subtleColor: string; description: string }[] = [
  { type: 'ativo',             label: 'Ativo',             color: 'text-blue-400',   subtleColor: 'bg-blue-500/10',   description: 'Recursos controlados pela empresa (caixa, banco, imobilizado).' },
  { type: 'passivo',           label: 'Passivo',           color: 'text-orange-400', subtleColor: 'bg-orange-500/10', description: 'Obrigações com terceiros (fornecedores, empréstimos, tributos).' },
  { type: 'patrimonio_liquido',label: 'Patrimônio Líquido',color: 'text-violet-400', subtleColor: 'bg-violet-500/10', description: 'Capital próprio dos sócios (capital social, lucros acumulados).' },
  { type: 'receita',           label: 'Receita',           color: 'text-green-400',  subtleColor: 'bg-green-500/10',  description: 'Entradas de recursos pela atividade principal da empresa.' },
  { type: 'despesa',           label: 'Despesa',           color: 'text-red-400',    subtleColor: 'bg-red-500/10',    description: 'Gastos necessários para manter a operação.' },
  { type: 'custo',             label: 'Custo',             color: 'text-yellow-400', subtleColor: 'bg-yellow-500/10', description: 'Custo direto dos produtos/serviços vendidos (CMV/CSP).' },
]

function getDepth(code: string) { return code.split('.').length - 1 }

// ── Inline edit row ───────────────────────────────────────────

function PlanRow({
  entry, checked, onToggle, onEdit,
}: {
  entry: PlanEntry & { _key: string }
  checked: boolean
  onToggle: (key: string, checked: boolean) => void
  onEdit: (key: string, field: 'code' | 'name', value: string) => void
}) {
  const [editingField, setEditingField] = useState<'code' | 'name' | null>(null)
  const [editValue, setEditValue]       = useState('')
  const depth = getDepth(entry.code)

  const startEdit = (field: 'code' | 'name') => {
    setEditingField(field)
    setEditValue(field === 'code' ? entry.code : entry.name)
  }

  const commitEdit = () => {
    if (editingField && editValue.trim()) {
      onEdit(entry._key, editingField, editValue.trim())
    }
    setEditingField(null)
  }

  return (
    <tr className={`border-b border-[var(--bg-border)]/40 hover:bg-[var(--bg-elevated)]/50 group/row ${checked ? '' : 'opacity-40'} transition-opacity`}>
      {/* Checkbox */}
      <td className="pl-3 pr-1 py-2 w-8 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onToggle(entry._key, e.target.checked)}
          className="accent-[var(--accent)] cursor-pointer"
        />
      </td>

      {/* Code */}
      <td className="px-2 py-2 w-40 shrink-0">
        <div style={{ paddingLeft: `${depth * 14}px` }}>
          {editingField === 'code' ? (
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--accent)] rounded px-1.5 py-0.5 text-xs font-mono text-[var(--text-primary)] outline-none"
            />
          ) : (
            <button
              onClick={() => startEdit('code')}
              title="Clique para editar"
              className="flex items-center gap-1.5 group/code cursor-pointer"
            >
              <span className="font-mono text-xs text-[var(--text-secondary)]">{entry.code}</span>
              <Pencil className="h-2.5 w-2.5 text-[var(--text-muted)] opacity-0 group-hover/code:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      </td>

      {/* Name */}
      <td className="px-2 py-2">
        {editingField === 'name' ? (
          <input
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--accent)] rounded px-2 py-0.5 text-sm text-[var(--text-primary)] outline-none"
          />
        ) : (
          <button
            onClick={() => startEdit('name')}
            title="Clique para editar"
            className="flex items-center gap-1.5 group/name cursor-pointer text-left w-full"
          >
            <span className={`text-sm leading-snug ${entry.is_analytic ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] font-medium'}`}>
              {entry.name}
            </span>
            <Pencil className="h-2.5 w-2.5 text-[var(--text-muted)] opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
          </button>
        )}
      </td>

      {/* Class */}
      <td className="px-3 py-2 w-28 text-right shrink-0">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
          entry.is_analytic
            ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
            : 'bg-[var(--bg-border)] text-[var(--text-muted)]'
        }`}>
          {entry.is_analytic ? 'Analítica' : 'Sintética'}
        </span>
      </td>
    </tr>
  )
}

// ── Main modal ────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (accounts: PlanEntry[]) => void
  seeding: boolean
  hasCostSegment: boolean | null
}

export function CfcPreviewModal({ open, onClose, onConfirm, seeding, hasCostSegment }: Props) {
  const t = useT()

  // Build keyed entries (key = original index for stable identity)
  const [entries, setEntries] = useState<(PlanEntry & { _key: string })[]>(() =>
    DEFAULT_PLAN
      .filter(e => e.account_type !== 'custo' || hasCostSegment !== false)
      .map((e, i) => ({ ...e, _key: String(i) }))
  )

  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(DEFAULT_PLAN
      .filter(e => e.account_type !== 'custo' || hasCostSegment !== false)
      .map((_, i) => String(i))
    )
  )

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Collect all descendant keys for cascade
  const getDescendants = (key: string): string[] => {
    const entry = entries.find(e => e._key === key)
    if (!entry) return []
    const children = entries.filter(e => e.parent_code === entry.code)
    return children.flatMap(c => [c._key, ...getDescendants(c._key)])
  }

  const getAncestors = (key: string): string[] => {
    const entry = entries.find(e => e._key === key)
    if (!entry?.parent_code) return []
    const parent = entries.find(e => e.code === entry.parent_code)
    if (!parent) return []
    return [parent._key, ...getAncestors(parent._key)]
  }

  const toggle = (key: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(key)
        getAncestors(key).forEach(k => next.add(k)) // ensure parents selected
      } else {
        next.delete(key)
        getDescendants(key).forEach(k => next.delete(k)) // cascade to children
      }
      return next
    })
  }

  const editEntry = (key: string, field: 'code' | 'name', value: string) => {
    setEntries(prev => prev.map(e => {
      if (e._key !== key) return e
      if (field === 'code') {
        // Update parent_code references in children
        const oldCode = e.code
        setEntries(prev2 => prev2.map(e2 =>
          e2.parent_code === oldCode ? { ...e2, parent_code: value } : e2
        ))
        return { ...e, code: value }
      }
      return { ...e, name: value }
    }))
  }

  const toggleSection = (type: AccountType) => {
    setCollapsed(prev => {
      const next = new Set(prev); next.has(type) ? next.delete(type) : next.add(type); return next
    })
  }

  const selectedCount = selected.size

  const handleConfirm = () => {
    const finalAccounts = entries
      .filter(e => selected.has(e._key))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ _key, ...rest }) => rest)
    onConfirm(finalAccounts)
  }

  const visibleSections = SECTIONS.filter(s =>
    s.type !== 'custo' || hasCostSegment !== false
  )

  const footer = (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onClose} disabled={seeding}>
        {t('plano_cancel')}
      </Button>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--text-muted)]">
          {selectedCount} {selectedCount !== 1 ? t('plano_countPlural') : t('plano_countSingular')} selecionadas
        </span>
        <Button size="sm" onClick={handleConfirm} loading={seeding} disabled={selectedCount === 0}>
          <Check className="h-3.5 w-3.5" />
          {t('plano_previewConfirm')}
        </Button>
      </div>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={t('plano_previewTitle')} size="xl" footer={footer}>
      <p className="text-xs text-[var(--text-muted)] mb-4">{t('plano_previewSubtitle')}</p>

      <div className="flex flex-col gap-3">
        {visibleSections.map(section => {
          const sectionEntries = entries
            .filter(e => e.account_type === section.type)
            .sort((a, b) => a.code.localeCompare(b.code))

          const sectionSelected = sectionEntries.filter(e => selected.has(e._key)).length
          const isCollapsed = collapsed.has(section.type)

          return (
            <div key={section.type} className="rounded-[var(--radius-lg)] border border-[var(--bg-border)] overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.type)}
                className={`w-full flex items-start justify-between px-3 py-2.5 ${section.subtleColor} cursor-pointer`}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed
                    ? <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${section.color}`} />
                    : <ChevronDown  className={`h-3.5 w-3.5 shrink-0 ${section.color}`} />
                  }
                  <div className="text-left">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${section.color}`}>
                      {section.label}
                    </span>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{section.description}</p>
                  </div>
                </div>
                <span className="text-xs text-[var(--text-muted)] shrink-0 ml-4 mt-0.5">
                  {sectionSelected}/{sectionEntries.length}
                </span>
              </button>

              {!isCollapsed && (
                <table className="w-full text-sm">
                  <tbody>
                    {sectionEntries.map(entry => (
                      <PlanRow
                        key={entry._key}
                        entry={entry}
                        checked={selected.has(entry._key)}
                        onToggle={toggle}
                        onEdit={editEntry}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
