export function Footer() {
  return (
    <footer className="border-t border-[var(--bg-border)] py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-[var(--accent)] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-sm text-[var(--text-muted)]">Syncero</span>
        </div>
        {/* <div className="flex items-center gap-6">
          <a href={FLOW_URL}  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Syncero Flow</a>
          <a href={BOOKS_URL} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">Syncero Books</a>
        </div> */}
        <p className="text-xs text-[var(--text-muted)]">© {new Date().getFullYear()} Syncero. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}