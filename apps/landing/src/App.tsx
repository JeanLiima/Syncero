import { useState } from 'react'
import { PersonaModal } from './components/PersonaModal'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { Footer } from './components/Footer'
import { Products } from './components/Products'
import { Comparison } from './components/Comparison'
import { CTA } from './components/CTA'
import { Pillars } from './components/Pillars'

export default function App() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar   onLogin={() => setModalOpen(true)} />
      <Hero     onLogin={() => setModalOpen(true)} />
      <Products />
      <Pillars />
      <Comparison />
      <CTA      onRegister={() => setModalOpen(true)} />
      <Footer />
      {modalOpen && (
        <PersonaModal onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}
