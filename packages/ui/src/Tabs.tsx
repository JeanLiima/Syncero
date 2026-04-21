import { type ReactNode, createContext, useContext, useState } from 'react'
import { clsx } from 'clsx'

interface TabsContextValue {
  active: string
  setActive: (id: string) => void
}

const TabsContext = createContext<TabsContextValue>({ active: '', setActive: () => {} })

interface TabsProps {
  defaultTab: string
  children: ReactNode
  className?: string
}

export function Tabs({ defaultTab, children, className }: TabsProps) {
  const [active, setActive] = useState(defaultTab)
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex gap-1 border-b border-[var(--bg-border)]', className)}>
      {children}
    </div>
  )
}

export function Tab({ id, children }: { id: string; children: ReactNode }) {
  const { active, setActive } = useContext(TabsContext)
  return (
    <button
      onClick={() => setActive(id)}
      className={clsx(
        'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
        active === id
          ? 'border-[var(--accent)] text-[var(--accent)]'
          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
      )}
    >
      {children}
    </button>
  )
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const { active } = useContext(TabsContext)
  if (active !== id) return null
  return <div>{children}</div>
}
