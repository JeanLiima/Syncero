import { ArrowRight } from "lucide-react";

export function Hero({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="pt-40 pb-28 px-4 sm:px-6 text-center relative overflow-hidden">
      {/* Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #3b82f6 0%, transparent 70%)' }}
      />

      <div className="relative max-w-3xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)] mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
          Plataforma PWA — acesse de qualquer dispositivo
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[var(--text-primary)] leading-tight mb-6">
          A verdade sincronizada<br />
          <span className="text-[var(--accent)]">dos seus números.</span>
        </h1>

        <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-10 leading-relaxed">
          O elo entre o seu negócio e a sua contabilidade.
          Transparência financeira, de ponta a ponta — em tempo real.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onLogin}
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-md)] bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity cursor-pointer text-sm"
          >
            Começar agora
            <ArrowRight className="h-4 w-4" />
          </button>
          <a
            href="#produtos"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors text-sm"
          >
            Conheça os produtos
          </a>
        </div>
      </div>
    </section>
  )
}