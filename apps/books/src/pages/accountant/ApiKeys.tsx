import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { Button, Card } from '@syncero/ui'
import { ApiKeyCreateModal } from '@/components/accountant/ApiKeyCreateModal'
import type { ApiKey } from '@/types'

async function sha256hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateRawKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return 'sk_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function Component() {
  const { user } = useAuth()
  const { id, isExternal, companyId, extCompanyId } = useCompanyContext()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const queryKey = ['api-keys', id]

  const { data: keys = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !id) return []
      const q = supabase
        .from('api_keys')
        .select('*')
        .eq('accountant_id', user.id)
        .order('created_at', { ascending: false })
      const filtered = isExternal
        ? q.eq('ext_company_id', id)
        : q.eq('company_id', id)
      const { data, error } = await filtered
      if (error) throw error
      return (data ?? []) as ApiKey[]
    },
    enabled: !!user?.id && !!id,
  })

  const handleCreate = async (data: { name: string; expiresAt: string | null }): Promise<string> => {
    if (!user?.id) throw new Error('Not authenticated')
    const rawKey = generateRawKey()
    const hash = await sha256hex(rawKey)
    const prefix = rawKey.slice(0, 11)

    const { error } = await supabase.from('api_keys').insert({
      accountant_id: user.id,
      name: data.name,
      company_id: isExternal ? null : (companyId ?? null),
      ext_company_id: isExternal ? (extCompanyId ?? null) : null,
      key_hash: hash,
      key_prefix: prefix,
      expires_at: data.expiresAt ?? null,
    })
    if (error) throw error
    qc.invalidateQueries({ queryKey })
    return rawKey
  }

  const handleRevoke = async (keyId: string) => {
    await supabase.from('api_keys').update({ is_active: false }).eq('id', keyId)
    qc.invalidateQueries({ queryKey })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">API Keys</h1>
          <p className="text-sm text-[var(--text-muted)]">Chaves para integração com sistemas externos</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova chave
        </Button>
      </div>

      <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] border border-[var(--bg-border)] text-sm text-[var(--text-secondary)]">
        <p className="font-medium text-[var(--text-primary)] mb-1">Como usar</p>
        <p>Inclua a chave no header <code className="font-mono text-xs bg-[var(--bg-surface)] px-1 py-0.5 rounded">Authorization: Bearer &lt;chave&gt;</code> ao fazer POST para a API de lançamentos.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : keys.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">Nenhuma chave criada ainda.</p>
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--bg-border)] text-left">
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Nome</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Prefixo</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Último uso</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Expira em</th>
                <th className="px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-[var(--bg-border)]/50 hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="px-4 py-3 text-[var(--text-primary)] font-medium">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{key.key_prefix}…</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {key.expires_at ? new Date(key.expires_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      key.is_active ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                    }`}>
                      {key.is_active ? 'Ativa' : 'Revogada'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {key.is_active && (
                      <button
                        onClick={() => handleRevoke(key.id)}
                        className="cursor-pointer p-1.5 rounded hover:bg-[var(--bg-border)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                        title="Revogar chave"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ApiKeyCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
