import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import { format, subDays } from 'date-fns'

const { permesso, app } = vi.hoisted(() => ({
  permesso: {
    statoPermesso: vi.fn(),
    chiediPermesso: vi.fn(),
    apriImpostazioniTelefono: vi.fn(),
  },
  app: { ascoltatore: null, togli: vi.fn() },
}))

vi.mock('../../lib/permessoNotifiche', async (originale) => ({
  ...(await originale()),
  ...permesso,
}))
vi.mock('../../lib/pushToken', () => ({ rinfrescaTokenPush: vi.fn() }))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_nome, fn) => {
      app.ascoltatore = fn
      return { remove: app.togli }
    }),
  },
}))

import InvitoNotifiche, { _azzeraApertura } from '../InvitoNotifiche'
import { segnalaMomentoNotifiche } from '../../lib/permessoNotifiche'
import { CHIAVE_PROMEMORIA_NOTIFICHE, leggiStato } from '../../lib/promemoriaNotifiche'

const oggi = () => format(new Date(), 'yyyy-MM-dd')
const segnala = async (ruolo = 'athlete') => { await act(async () => { segnalaMomentoNotifiche(ruolo) }) }

beforeEach(() => {
  _azzeraApertura()
  localStorage.removeItem(CHIAVE_PROMEMORIA_NOTIFICHE)
  Object.values(permesso).forEach(f => f.mockReset())
  permesso.statoPermesso.mockResolvedValue('da-chiedere')
  permesso.chiediPermesso.mockResolvedValue(false)
  permesso.apriImpostazioniTelefono.mockResolvedValue()
  app.ascoltatore = null
  app.togli.mockReset()
})
afterEach(cleanup)

describe('InvitoNotifiche', () => {
  it('atleta: compare con il suo testo, senza «Non chiedermelo più» la prima volta', async () => {
    render(<InvitoNotifiche userId="u1" />)
    await segnala('athlete')
    expect(await screen.findByText('Non perderti un allenamento')).toBeTruthy()
    expect(screen.queryByText('Non chiedermelo più')).toBeNull()
  })

  it('coach: compare con il suo testo', async () => {
    render(<InvitoNotifiche userId="u1" />)
    await segnala('coach')
    expect(await screen.findByText('Sappi quando si allenano')).toBeTruthy()
  })

  it('notifiche già attive: niente foglio e lo stato si azzera', async () => {
    localStorage.setItem(CHIAVE_PROMEMORIA_NOTIFICHE, JSON.stringify({ rifiuti: 6, ultimo: '2026-01-01', mai: false }))
    permesso.statoPermesso.mockResolvedValue('attive')
    render(<InvitoNotifiche userId="u1" />)
    await segnala()
    await waitFor(() => expect(leggiStato().rifiuti).toBe(0))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('due momenti di fila: un foglio solo, e dopo «Non ora» non torna nella stessa apertura', async () => {
    render(<InvitoNotifiche userId="u1" />)
    await segnala()
    await segnala()
    await screen.findByRole('dialog')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.click(screen.getByText('Non ora'))
    // Anche senza la pausa (stato cancellato), nella stessa apertura non torna.
    localStorage.removeItem(CHIAVE_PROMEMORIA_NOTIFICHE)
    await segnala()
    await act(async () => {})
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('«Non ora» conta un rifiuto con la data di oggi', async () => {
    render(<InvitoNotifiche userId="u1" />)
    await segnala()
    fireEvent.click(await screen.findByText('Non ora'))
    expect(leggiStato()).toEqual({ rifiuti: 1, ultimo: oggi(), mai: false })
  })

  it('la X vale come «Non ora»', async () => {
    render(<InvitoNotifiche userId="u1" />)
    await segnala()
    fireEvent.click(await screen.findByLabelText('Chiudi'))
    expect(leggiStato().rifiuti).toBe(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('dalla seconda volta c\'è «Non chiedermelo più», che spegne per sempre', async () => {
    const ultimo = format(subDays(new Date(), 5), 'yyyy-MM-dd')
    localStorage.setItem(CHIAVE_PROMEMORIA_NOTIFICHE, JSON.stringify({ rifiuti: 1, ultimo, mai: false }))
    render(<InvitoNotifiche userId="u1" />)
    await segnala()
    fireEvent.click(await screen.findByText('Non chiedermelo più'))
    expect(leggiStato().mai).toBe(true)
  })

  it('in pausa: non compare', async () => {
    localStorage.setItem(CHIAVE_PROMEMORIA_NOTIFICHE, JSON.stringify({ rifiuti: 1, ultimo: oggi(), mai: false }))
    render(<InvitoNotifiche userId="u1" />)
    await segnala()
    await waitFor(() => expect(permesso.statoPermesso).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('«Attiva» concesso: chiede il permesso con l\'utente e azzera', async () => {
    permesso.chiediPermesso.mockResolvedValue(true)
    render(<InvitoNotifiche userId="u1" />)
    await segnala()
    await act(async () => { fireEvent.click(await screen.findByText('Attiva')) })
    expect(permesso.chiediPermesso).toHaveBeenCalledWith('u1')
    expect(leggiStato().rifiuti).toBe(0)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('«Attiva» rifiutato dal sistema conta come «Non ora»', async () => {
    render(<InvitoNotifiche userId="u1" />)
    await segnala()
    await act(async () => { fireEvent.click(await screen.findByText('Attiva')) })
    expect(leggiStato().rifiuti).toBe(1)
  })

  it('permesso negato: apre le Impostazioni e al ritorno, se attive, azzera', async () => {
    permesso.statoPermesso.mockResolvedValue('negate')
    render(<InvitoNotifiche userId="u1" />)
    await segnala()
    await act(async () => { fireEvent.click(await screen.findByText('Apri Impostazioni')) })
    expect(permesso.apriImpostazioniTelefono).toHaveBeenCalled()
    permesso.statoPermesso.mockResolvedValue('attive')
    await act(async () => { await app.ascoltatore({ isActive: true }) })
    expect(leggiStato()).toEqual({ rifiuti: 0, ultimo: null, mai: false })
    expect(app.togli).toHaveBeenCalled()
  })

  it('permesso negato e al ritorno ancora spente: conta come «Non ora»', async () => {
    permesso.statoPermesso.mockResolvedValue('negate')
    render(<InvitoNotifiche userId="u1" />)
    await segnala()
    await act(async () => { fireEvent.click(await screen.findByText('Apri Impostazioni')) })
    await act(async () => { await app.ascoltatore({ isActive: true }) })
    expect(leggiStato().rifiuti).toBe(1)
  })

  it('sul web non compare mai', async () => {
    permesso.statoPermesso.mockResolvedValue('non-disponibile')
    render(<InvitoNotifiche userId="u1" />)
    await segnala()
    await waitFor(() => expect(permesso.statoPermesso).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
