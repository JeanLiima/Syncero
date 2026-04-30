import { useState, useEffect } from 'react'
import { Pencil, Check, ChevronDown, ChevronRight, Info, Plus } from 'lucide-react'
import { Button, Checkbox, Modal } from '@syncero/ui'
import { useT } from '@/i18n'
import type { PlanEntry } from '@/lib/backend'
import { DEFAULT_PLAN } from '@/lib/defaultPlan'
import type { AccountType } from '@/types'

// ── Section metadata ──────────────────────────────────────────

const SECTION_COLORS: Record<AccountType, { color: string; subtleColor: string }> = {
  ativo:             { color: 'text-blue-400',   subtleColor: 'bg-blue-500/10'   },
  passivo:           { color: 'text-orange-400', subtleColor: 'bg-orange-500/10' },
  patrimonio_liquido:{ color: 'text-violet-400', subtleColor: 'bg-violet-500/10' },
  receita:           { color: 'text-green-400',  subtleColor: 'bg-green-500/10'  },
  despesa:           { color: 'text-red-400',    subtleColor: 'bg-red-500/10'    },
  custo:             { color: 'text-yellow-400', subtleColor: 'bg-yellow-500/10' },
}

// Segments that recommend each account type beyond the always-required core.
// Core types (ativo/passivo/pl/receita/despesa) are always recommended — null means all.
const SEGMENT_RECOMMENDATIONS: Partial<Record<AccountType, string[] | null>> = {
  ativo:             null, // always
  passivo:           null, // always
  patrimonio_liquido:null, // always
  receita:           null, // always
  despesa:           null, // always
  custo:             ['comercio', 'industria', 'agronegocio', 'construcao_civil'],
}

function isRecommended(type: AccountType, segment: string | null | undefined): boolean {
  const rule = SEGMENT_RECOMMENDATIONS[type]
  if (rule === null) return true                             // always recommended
  if (!segment) return false                                 // segment unknown → don't badge
  return rule?.includes(segment) ?? false
}

function getDepth(code: string) { return code.split('.').length - 1 }

// ── Inline edit row ───────────────────────────────────────────

function PlanRow({
  entry, checked, onToggle, onEdit, onAddChild, onSwapRequest, allEntries,
}: {
  entry: PlanEntry & { _key: string }
  checked: boolean
  onToggle: (key: string, checked: boolean) => void
  onEdit: (key: string, field: 'code' | 'name', value: string) => void
  onAddChild: (key: string) => void
  onSwapRequest: (keyA: string, keyB: string) => void
  allEntries: (PlanEntry & { _key: string })[]
}) {
  const t = useT()
  const [editingField, setEditingField] = useState<'code' | 'name' | null>(null)
  const [editValue, setEditValue]       = useState('')
  const [codeError, setCodeError]       = useState<string | null>(null)
  const depth = getDepth(entry.code)

  // For child entries, only the last segment is editable; prefix is locked
  const codePrefix  = entry.parent_code ? entry.code.slice(0, entry.code.lastIndexOf('.') + 1) : ''
  const codeSuffix  = entry.parent_code ? entry.code.slice(entry.code.lastIndexOf('.') + 1)    : entry.code

  const startEdit = (field: 'code' | 'name') => {
    setEditingField(field)
    setCodeError(null)
    setEditValue(field === 'code' ? codeSuffix : entry.name)
  }

  const commitEdit = () => {
    if (!editingField) return
    const val = editValue.trim()
    if (!val) { setEditingField(null); return }

    if (editingField === 'code') {
      const fullCode   = codePrefix + val
      const conflicting = allEntries.find(e => e.code === fullCode && e._key !== entry._key)
      if (conflicting) {
        onSwapRequest(entry._key, conflicting._key)
        setEditingField(null)
        setCodeError(null)
        return
      }
      onEdit(entry._key, 'code', fullCode)
      setEditingField(null)
      setCodeError(null)
      return
    }

    onEdit(entry._key, editingField, val)
    setEditingField(null)
    setCodeError(null)
  }

  return (
    <tr className={`border-b border-[var(--bg-border)]/40 hover:bg-[var(--bg-elevated)]/50 group/row ${checked ? '' : 'opacity-40'} transition-opacity`}>
      {/* Checkbox */}
      <td className="pl-3 pr-1 py-2 w-8 shrink-0">
        <Checkbox
          checked={checked}
          onChange={e => onToggle(entry._key, (e.target as HTMLInputElement).checked)}
        />
      </td>

      {/* Code */}
      <td className="px-2 py-2 w-40 shrink-0">
        <div style={{ paddingLeft: `${depth * 14}px` }}>
          {editingField === 'code' ? (
            <div className="flex flex-col gap-1">
              <div className={`flex items-center rounded border text-xs font-mono bg-[var(--bg-elevated)] ${codeError ? 'border-[var(--danger)]' : 'border-[var(--accent)]'}`}>
                {codePrefix && (
                  <span className="pl-1.5 text-[var(--text-muted)] select-none">{codePrefix}</span>
                )}
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => { setEditValue(e.target.value); setCodeError(null) }}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingField(null); setCodeError(null) } }}
                  className={`bg-transparent text-[var(--text-primary)] outline-none py-0.5 ${codePrefix ? 'pl-0.5 pr-1.5' : 'px-1.5'} min-w-0 w-10`}
                />
              </div>
              {codeError && <span className="text-[10px] text-[var(--danger)] whitespace-nowrap">{codeError}</span>}
            </div>
          ) : (
            <button
              onClick={() => startEdit('code')}
              title={t('plano_clickToEdit')}
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
            title={t('plano_clickToEdit')}
            className="flex items-center gap-1.5 group/name cursor-pointer text-left w-full"
          >
            <span className={`text-sm leading-snug ${entry.is_analytic ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] font-medium'}`}>
              {entry.name}
            </span>
            <Pencil className="h-2.5 w-2.5 text-[var(--text-muted)] opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
          </button>
        )}
      </td>

      {/* Class + add child */}
      <td className="px-2 py-2 w-36 shrink-0">
        <div className="flex items-center justify-end gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            entry.is_analytic
              ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
              : 'bg-[var(--bg-border)] text-[var(--text-muted)]'
          }`}>
            {entry.is_analytic ? t('plano_analytic') : t('plano_synthetic')}
          </span>
          <div className="relative group/add">
            <button
              onClick={() => onAddChild(entry._key)}
              className="cursor-pointer p-1 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--success)] transition-colors opacity-0 group-hover/row:opacity-100"
            >
              <Plus className="h-3 w-3" />
            </button>
            <span className="pointer-events-none absolute -top-7 right-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover/add:opacity-100 transition-opacity z-50">
              {t('plano_addChildTooltip')}
            </span>
          </div>
        </div>
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
  segment?: string | null
}

export function CfcPreviewModal({ open, onClose, onConfirm, seeding, hasCostSegment, segment }: Props) {
  const t = useT()

  const SECTIONS = [
    { type: 'ativo'             as AccountType, label: t('plano_ativo'),             description: t('plano_sectionDesc_ativo'),              ...SECTION_COLORS.ativo              },
    { type: 'passivo'           as AccountType, label: t('plano_passivo'),            description: t('plano_sectionDesc_passivo'),             ...SECTION_COLORS.passivo            },
    { type: 'patrimonio_liquido'as AccountType, label: t('plano_patrimonioLiquido'), description: t('plano_sectionDesc_patrimonioLiquido'),  ...SECTION_COLORS.patrimonio_liquido },
    { type: 'receita'           as AccountType, label: t('plano_receita'),            description: t('plano_sectionDesc_receita'),             ...SECTION_COLORS.receita            },
    { type: 'despesa'           as AccountType, label: t('plano_despesa'),            description: t('plano_sectionDesc_despesa'),             ...SECTION_COLORS.despesa            },
    { type: 'custo'             as AccountType, label: t('plano_custo'),              description: t('plano_sectionDesc_custo'),               ...SECTION_COLORS.custo              },
  ]

  // Build keyed entries (key = original index for stable identity)
  const [entries, setEntries] = useState<(PlanEntry & { _key: string })[]>(() =>
    DEFAULT_PLAN
      .filter(e => e.account_type !== 'custo' || hasCostSegment !== false)
      .map((e, i) => ({ ...e, _key: String(i) }))
  )

  const buildSelected = () => new Set(
    entries
      .filter(e => isRecommended(e.account_type as AccountType, segment))
      .map(e => e._key)
  )

  const [selected, setSelected] = useState<Set<string>>(buildSelected)

  // Re-compute selection each time the modal opens (segment may load after mount)
  useEffect(() => {
    if (open) setSelected(buildSelected())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, segment])

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
    setEntries(prev => {
      const entry = prev.find(e => e._key === key)
      if (!entry) return prev
      if (field === 'name') return prev.map(e => e._key === key ? { ...e, name: value } : e)

      // Code change: cascade to all descendants in one pass
      const oldCode = entry.code
      const prefix  = oldCode + '.'
      return prev.map(e => {
        if (e._key === key) return { ...e, code: value }

        const codeUpdated = e.code.startsWith(prefix)
          ? value + e.code.slice(oldCode.length)
          : null

        const parentUpdated = e.parent_code === oldCode
          ? value
          : e.parent_code?.startsWith(prefix)
            ? value + e.parent_code.slice(oldCode.length)
            : null

        if (codeUpdated === null && parentUpdated === null) return e
        return {
          ...e,
          ...(codeUpdated   !== null ? { code:        codeUpdated   } : {}),
          ...(parentUpdated !== null ? { parent_code: parentUpdated } : {}),
        }
      })
    })
  }

  // ── Swap ────────────────────────────────────────────────────
  const [swapPending, setSwapPending] = useState<{ keyA: string; keyB: string } | null>(null)

  const swapEntryA = swapPending ? entries.find(e => e._key === swapPending.keyA) : null
  const swapEntryB = swapPending ? entries.find(e => e._key === swapPending.keyB) : null

  const confirmSwap = () => {
    if (!swapEntryA || !swapEntryB) return
    const codeA   = swapEntryA.code
    const codeB   = swapEntryB.code
    const prefixA = codeA + '.'
    const prefixB = codeB + '.'

    const mapCode = (c: string | null | undefined): string | null => {
      if (!c) return c ?? null
      if (c === codeA) return codeB
      if (c === codeB) return codeA
      if (c.startsWith(prefixA)) return codeB + c.slice(codeA.length)
      if (c.startsWith(prefixB)) return codeA + c.slice(codeB.length)
      return c
    }

    setEntries(prev => prev.map(e => {
      const newCode       = mapCode(e.code)       ?? e.code
      const newParentCode = mapCode(e.parent_code ?? undefined)
      if (newCode === e.code && newParentCode === e.parent_code) return e
      return { ...e, code: newCode, ...(newParentCode !== undefined ? { parent_code: newParentCode } : {}) }
    }))
    setSwapPending(null)
  }

  const suggestChildCode = (parentCode: string): string => {
    const prefix = parentCode + '.'
    const siblings = entries.filter(e => {
      if (!e.code.startsWith(prefix)) return false
      return !e.code.slice(prefix.length).includes('.')
    })
    if (siblings.length === 0) return `${parentCode}.01`
    const nums = siblings.map(s => parseInt(s.code.slice(prefix.length), 10) || 0)
    const max = Math.max(...nums)
    const padLen = Math.max(...siblings.map(s => s.code.slice(prefix.length).length))
    return prefix + String(max + 1).padStart(padLen, '0')
  }

  const addChild = (parentKey: string) => {
    const parent = entries.find(e => e._key === parentKey)
    if (!parent) return
    const newKey  = `new-${Date.now()}`
    const newCode = suggestChildCode(parent.code)
    const newEntry: PlanEntry & { _key: string } = {
      _key:         newKey,
      code:         newCode,
      name:         '',
      account_type: parent.account_type,
      nature:       parent.nature,
      is_analytic:  true,
      parent_code:  parent.code,
    }
    // Insert right after the last descendant of the parent
    setEntries(prev => {
      const parentIdx = prev.findIndex(e => e._key === parentKey)
      const prefix    = parent.code + '.'
      let insertAt    = parentIdx + 1
      for (let i = parentIdx + 1; i < prev.length; i++) {
        if (prev[i].code.startsWith(prefix)) insertAt = i + 1
        else break
      }
      const next = [...prev]
      next.splice(insertAt, 0, newEntry)
      return next
    })
    // Auto-select the new entry
    setSelected(prev => new Set([...prev, newKey]))
    // If parent was analytic, mark it as synthetic now it has a child
    if (parent.is_analytic) {
      setEntries(prev => prev.map(e => e._key === parentKey ? { ...e, is_analytic: false } : e))
    }
  }

  const toggleCollapse = (type: AccountType) => {
    setCollapsed(prev => {
      const next = new Set(prev); next.has(type) ? next.delete(type) : next.add(type); return next
    })
  }

  const toggleSectionSelection = (type: AccountType) => {
    const sectionKeys = entries.filter(e => e.account_type === type).map(e => e._key)
    const allIn = sectionKeys.every(k => selected.has(k))
    setSelected(prev => {
      const next = new Set(prev)
      if (allIn) sectionKeys.forEach(k => next.delete(k))
      else       sectionKeys.forEach(k => next.add(k))
      return next
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
          {selectedCount} {selectedCount !== 1 ? t('plano_countPlural') : t('plano_countSingular')}
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
      <div className="flex items-start gap-2.5 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] px-3 py-2.5 mb-4">
        <Info className="h-4 w-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('plano_previewInfo')}</p>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-4">{t('plano_previewSubtitle')}</p>

      <div className="flex flex-col gap-3">
        {visibleSections.map(section => {
          const sectionEntries = entries
            .filter(e => e.account_type === section.type)
            .sort((a, b) => a.code.localeCompare(b.code))

          const sectionSelectedCount = sectionEntries.filter(e => selected.has(e._key)).length
          const noneInSection = sectionSelectedCount === 0
          const allInSection  = sectionSelectedCount === sectionEntries.length
          const isCollapsed   = collapsed.has(section.type)

          return (
            <div key={section.type} className="rounded-[var(--radius-lg)] border border-[var(--bg-border)]">
              {/* Section header */}
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-[var(--radius-lg)] ${section.subtleColor}`}>
                {/* Arrow — collapse toggle, leftmost */}
                <button
                  onClick={() => toggleCollapse(section.type)}
                  className="cursor-pointer p-0.5 shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5" />
                    : <ChevronDown  className="h-3.5 w-3.5" />
                  }
                </button>

                {/* Section checkbox */}
                <div className="relative group/stoggle shrink-0">
                  <Checkbox
                    checked={!noneInSection}
                    indeterminate={!noneInSection && !allInSection}
                    onChange={() => toggleSectionSelection(section.type)}
                  />
                  <span className="pointer-events-none absolute -top-8 left-0 whitespace-nowrap rounded px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-[var(--text-secondary)] opacity-0 group-hover/stoggle:opacity-100 transition-opacity z-50">
                    {noneInSection ? t('plano_previewSelectAll') : t('plano_previewDeselectAll')}
                  </span>
                </div>

                {/* Title + description — clicking expands/collapses */}
                <button
                  onClick={() => toggleCollapse(section.type)}
                  className="flex-1 text-left min-w-0 cursor-pointer ml-1"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${section.color}`}>
                      {section.label}
                    </span>
                    {isRecommended(section.type, segment) && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--success)]/15 text-[var(--success)]">
                        {t('plano_recommended')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{section.description}</p>
                </button>

                <span className="text-xs text-[var(--text-muted)] shrink-0 ml-2">
                  {sectionSelectedCount}/{sectionEntries.length}
                </span>
              </div>

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
                        onAddChild={addChild}
                        onSwapRequest={(kA, kB) => setSwapPending({ keyA: kA, keyB: kB })}
                        allEntries={entries}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>

      {/* Swap confirmation dialog */}
      {swapPending && swapEntryA && swapEntryB && (
        <Modal
          open
          onClose={() => setSwapPending(null)}
          title={t('plano_swapTitle')}
          size="sm"
          footer={
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setSwapPending(null)}>
                {t('plano_cancel')}
              </Button>
              <Button size="sm" onClick={confirmSwap}>
                {t('plano_swapConfirm')}
              </Button>
            </div>
          }
        >
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {t('plano_swapDesc').replace('{code}', swapEntryB.code).replace('{name}', swapEntryB.name)}
          </p>
          <div className="flex items-center gap-3 rounded-lg border border-[var(--bg-border)] bg-[var(--bg-elevated)] p-3 text-sm">
            <div className="flex flex-col gap-1 flex-1 text-center">
              <span className="text-xs text-[var(--text-muted)]">{swapEntryA.name}</span>
              <span className="font-mono font-semibold text-[var(--text-primary)]">{swapEntryA.code}</span>
              <span className="text-[10px] text-[var(--text-muted)]">→ {swapEntryB.code}</span>
            </div>
            <span className="text-[var(--text-muted)]">⇄</span>
            <div className="flex flex-col gap-1 flex-1 text-center">
              <span className="text-xs text-[var(--text-muted)]">{swapEntryB.name}</span>
              <span className="font-mono font-semibold text-[var(--text-primary)]">{swapEntryB.code}</span>
              <span className="text-[10px] text-[var(--text-muted)]">→ {swapEntryA.code}</span>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3">{t('plano_swapNote')}</p>
        </Modal>
      )}
    </Modal>
  )
}
