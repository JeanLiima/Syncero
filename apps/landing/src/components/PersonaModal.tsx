import { Building2, Calculator, X } from 'lucide-react'

const FLOW_URL  = import.meta.env.VITE_FLOW_URL  as string
const BOOKS_URL = import.meta.env.VITE_BOOKS_URL as string

export function PersonaModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-md bg-[var(--bg-surface)] border border-[var(--bg-border)] rounded-[var(--radius-xl)] p-8 shadow-2xl"
        style={{ animation: 'fadeUp .2s ease' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex justify-center mb-6">
          <div className="h-10 w-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-base">S</span>
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Como você vai usar a plataforma?</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Escolha o produto certo para o seu perfil</p>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href={`${FLOW_URL}/login`}
            className="flex items-center gap-4 p-4 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all"
          >
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[var(--accent-subtle)]">
              <Building2 className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <div>
              <p className="font-medium text-sm text-[var(--text-primary)]">Sou Empresa</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Syncero Flow — gestão financeira</p>
            </div>
          </a>

          <a
            href={`${BOOKS_URL}/login`}
            className="flex items-center gap-4 p-4 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] hover:border-[var(--books)] hover:bg-[var(--books-subtle)] transition-all"
          >
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[var(--books-subtle)]">
              <Calculator className="h-6 w-6 text-[var(--books)]" />
            </div>
            <div>
              <p className="font-medium text-sm text-[var(--text-primary)]">Sou Contador</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Syncero Books — acesso fiscal</p>
            </div>
          </a>
        </div>

        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  )
}
