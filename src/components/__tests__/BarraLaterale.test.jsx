import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { montaPagina } from '../../test/montaPagina'

// La barra laterale del desktop (spec 2026-11-12 §1): la voce «Extra» al posto
// di «Scarpe», solo con almeno un extra acceso.

const dati = await vi.hoisted(async () => ({ extra: [] }))
vi.mock('../../useExtra', () => ({ useExtra: () => dati.extra }))

const BarraLaterale = (await import('../BarraLaterale')).default

describe('BarraLaterale ed Extra', () => {
  beforeEach(() => { dati.extra = [] })

  it('con un extra acceso c\'è «Extra», non «Scarpe»', () => {
    dati.extra = [{ id: 'scarpe' }]
    montaPagina(<BarraLaterale />, { role: 'coach' })
    expect(screen.getByRole('link', { name: 'Extra' })).toHaveAttribute('href', '/extra')
    expect(screen.queryByRole('link', { name: 'Scarpe' })).toBeNull()
  })
  it('tutto spento, o mentre si legge: niente voce', () => {
    montaPagina(<BarraLaterale />, { role: 'coach' })
    expect(screen.queryByRole('link', { name: 'Extra' })).toBeNull()
    dati.extra = null
    montaPagina(<BarraLaterale />, { role: 'coach' })
    expect(screen.queryByRole('link', { name: 'Extra' })).toBeNull()
  })
})
