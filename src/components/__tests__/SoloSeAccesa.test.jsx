import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../../App'
import SoloSeAccesa from '../SoloSeAccesa'

// Le pagine delle Scarpe con l'interruttore (funzioni_app, 06/11/2026): spenta,
// chi arriva da un link torna alla Home. setup.js finge l'interruttore.
const monta = () => render(
  <MemoryRouter initialEntries={['/scarpe']}>
    <AuthContext.Provider value={{ user: { id: 'u1' }, role: 'athlete' }}>
      <Routes>
        <Route path="/" element={<p>Home</p>} />
        <Route path="/scarpe" element={<SoloSeAccesa nome="scarpe"><p>Pagina scarpe</p></SoloSeAccesa>} />
      </Routes>
    </AuthContext.Provider>
  </MemoryRouter>
)

describe('SoloSeAccesa', () => {
  it('accesa: mostra la pagina', async () => {
    monta()
    expect(await screen.findByText('Pagina scarpe')).toBeInTheDocument()
  })

  it('spenta: porta alla Home e la pagina non compare', async () => {
    globalThis.funzioniSpente = ['scarpe']
    monta()
    expect(await screen.findByText('Home')).toBeInTheDocument()
    expect(screen.queryByText('Pagina scarpe')).not.toBeInTheDocument()
  })
})
