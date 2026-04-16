import { ArrowRight } from "lucide-react";

export function CTA({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="py-24 px-4 sm:px-6 border-t border-[var(--bg-border)]">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-base">S</span>
          </div>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
          Pronto para sincronizar<br />seus números?
        </h2>
        <p className="text-[var(--text-secondary)] mb-10">
          Comece hoje. Sem cartão de crédito, sem complicação.
        </p>
        <button
          onClick={onRegister}
          className="inline-flex items-center gap-2 h-12 px-8 rounded-[var(--radius-md)] bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          Criar conta gratuita
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}