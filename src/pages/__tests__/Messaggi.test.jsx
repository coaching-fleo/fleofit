import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { montaPagina, UTENTE } from '../../test/montaPagina'
import { CHIAVE_VISTO } from '../../lib/messaggiCoach'

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase({
    messaggi_coach: [
      { id: 'nuovo', testo: 'Messaggio nuovo', fissato: false, creato_at: '2026-10-10T10:00:00Z' },
      { id: 'vecchio', testo: 'Avviso vecchio', fissato: false, creato_at: '2026-09-01T10:00:00Z' },
      { id: 'fiss', testo: 'Fissato vecchio', fissato: true, creato_at: '2026-08-01T10:00:00Z' },
    ],
  })
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const Messaggi = (await import('../Messaggi')).default
const atleta = { ...UTENTE, created_at: '2026-10-01T00:00:00Z' }

beforeEach(() => { finto.chiamate.length = 0; localStorage.clear() })

describe('Messaggi', () => {
  it("l'atleta vede fissato e nuovo, non l'avviso vecchio, e nessun comando da coach", async () => {
    montaPagina(<Messaggi />, { user: atleta, role: 'athlete', percorso: '/messaggi', rotta: '/messaggi' })
    expect(await screen.findByText('Messaggio nuovo')).toBeTruthy()
    expect(screen.getByText('Fissato vecchio')).toBeTruthy()
    expect(screen.queryByText('Avviso vecchio')).toBeNull()
    expect(screen.queryByText(/Messaggio a tutti/)).toBeNull()
    expect(screen.queryByLabelText('Azioni messaggio')).toBeNull()
  })

  it("un admin che simula l'atleta vede la vista dell'atleta", async () => {
    montaPagina(<Messaggi />, { user: { ...atleta, email: 'coaching@federicoleo.it' }, role: 'athlete' })
    expect(await screen.findByText('Messaggio nuovo')).toBeTruthy()
    expect(screen.queryByText('Avviso vecchio')).toBeNull()
  })

  it('segna lette le notifiche /messaggi e ricorda il più recente', async () => {
    montaPagina(<Messaggi />, { user: atleta, role: 'athlete' })
    await screen.findByText('Messaggio nuovo')
    await waitFor(() => {
      const upd = finto.chiamateA('notifications', 'update')
      expect(upd.length).toBe(1)
      expect(upd[0].args[0]).toEqual({ is_read: true })
    })
    expect(finto.chiamateA('notifications', 'like').some(c => c.args[0] === 'route' && c.args[1] === '/messaggi%')).toBe(true)
    expect(JSON.parse(localStorage.getItem(CHIAVE_VISTO))).toBe('2026-10-10T10:00:00Z')
  })

  it('?m= inesistente: lista presente, niente evidenza, niente errori', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = montaPagina(<Messaggi />, { user: atleta, role: 'athlete', percorso: '/messaggi?m=x9', rotta: '/messaggi' })
    expect(await screen.findByText('Messaggio nuovo')).toBeTruthy()
    expect(container.querySelector('[data-evidenziato="true"]')).toBeNull()
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })

  it('?m= esistente: la riga è evidenziata', async () => {
    const { container } = montaPagina(<Messaggi />, { user: atleta, role: 'athlete', percorso: '/messaggi?m=nuovo', rotta: '/messaggi' })
    await screen.findByText('Messaggio nuovo')
    await waitFor(() => expect(container.querySelector('#messaggio-nuovo').dataset.evidenziato).toBe('true'))
  })
})
