import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import RicercaCoach from '../RicercaCoach'
import { ESEMPI, dettaglioAtleta } from '../../lib/rigaRicerca'
import { dimenticaRicerca, ricercaSospesa, daRiaprire } from '../../lib/ricercaSospesa'

// Perché questi test esistono
// ────────────────────────────
// Il foglio è il punto in cui una risposta dell'IA diventa qualcosa che il
// coach tocca. Tre cose devono reggere:
//  1. sotto la frase c'è la lista VERA, calcolata dagli strumenti, e ogni riga
//     porta alla sua scheda;
//  2. «apri» chiude il foglio e porta dove si è chiesto;
//  3. la X si chiama «Chiudi»: è quella che il tasto indietro di Android cerca
//     (src/lib/indietroAndroid.js).

const oggi = new Date().toISOString().slice(0, 10)
const DATI = {
  atleti: [{ id: 'a1', name: 'Sofia', surname: 'Neri', notes: '' }],
  assegnazioni: [{
    id: 'aw1', athlete_id: 'a1', completed_date: oggi, status: 'pending', notes: '',
    workouts: { id: 'w1', title: 'Motore · EM 12′ @7', sections: { category: 'Hyrox', blocks: [] } },
  }],
  dal: oggi, al: oggi,
}

function Dove() {
  const l = useLocation()
  return <p data-testid="dove">{l.pathname}{l.search}</p>
}

beforeEach(() => dimenticaRicerca())

function monta(invoca, caricaDati = vi.fn(() => Promise.resolve(DATI))) {
  const onChiudi = vi.fn()
  const servizi = { caricaDati, invoca, trascrivi: vi.fn() }
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes><Route path="*" element={<><Dove /><RicercaCoach onChiudi={onChiudi} servizi={servizi} /></>} /></Routes>
    </MemoryRouter>
  )
  return { onChiudi, caricaDati }
}

const chiamata = (name, args) => ({ contenuto: { role: 'model', parts: [{ functionCall: { name, args } }] } })
const testo = (t) => ({ contenuto: { role: 'model', parts: [{ text: t }] } })

describe('RicercaCoach', () => {
  it('ha la X «Chiudi» per il tasto indietro di Android', () => {
    monta(vi.fn())
    expect(screen.getByRole('button', { name: 'Chiudi' })).toBeInTheDocument()
  })

  it('mostra gli esempi quando i dati sono pronti', async () => {
    monta(vi.fn())
    expect(await screen.findByRole('button', { name: ESEMPI[0] })).toBeInTheDocument()
  })

  it('sotto la risposta c\'è la lista vera, e la riga apre il workout', async () => {
    const utente = userEvent.setup()
    const invoca = vi.fn()
      .mockResolvedValueOnce(chiamata('cercaWorkout', { stato: 'da_fare' }))
      .mockResolvedValueOnce(testo('Sofia ha un allenamento da fare oggi.'))
    const { onChiudi } = monta(invoca)

    await utente.type(await screen.findByRole('textbox', { name: 'Domanda' }), 'cosa c\'è da fare oggi?')
    await utente.click(screen.getByRole('button', { name: 'Cerca' }))

    expect(await screen.findByText('Sofia ha un allenamento da fare oggi.')).toBeInTheDocument()
    // il titolo senza il codice, lo stato, l'atleta
    await utente.click(screen.getByRole('button', { name: /Motore.*Sofia Neri/ }))
    expect(onChiudi).toHaveBeenCalled()
    expect(screen.getByTestId('dove').textContent).toBe('/workout/w1?athlete_id=a1')
  })

  it('«apri» chiude il foglio e porta alla schermata', async () => {
    const utente = userEvent.setup()
    const invoca = vi.fn().mockResolvedValueOnce(chiamata('apri', { schermata: 'scheda_atleta', atleta: 'Sofia' }))
    const { onChiudi } = monta(invoca)
    await utente.type(await screen.findByRole('textbox', { name: 'Domanda' }), 'apri Sofia')
    await utente.click(screen.getByRole('button', { name: 'Cerca' }))
    await waitFor(() => expect(screen.getByTestId('dove').textContent).toBe('/athletes/a1'))
    expect(onChiudi).toHaveBeenCalled()
  })

  it('un errore della rete si legge, e il foglio resta usabile', async () => {
    const utente = userEvent.setup()
    const invoca = vi.fn().mockRejectedValueOnce(new Error("L'IA è sovraccarica: riprova fra poco."))
    monta(invoca)
    await utente.click(await screen.findByRole('button', { name: ESEMPI[0] }))
    expect(await screen.findByText("L'IA è sovraccarica: riprova fra poco.")).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Domanda' })).toBeEnabled()
  })

  it('mostra il dettaglio tecnico sotto un errore', async () => {
    const utente = userEvent.setup()
    const e = new Error("L'IA non ha risposto.")
    e.dettaglio = 'gemini-2.5-flash-lite · 400 · Thought signature is not valid'
    monta(vi.fn().mockRejectedValueOnce(e))
    await utente.click(await screen.findByRole('button', { name: ESEMPI[0] }))
    expect(await screen.findByText(/Thought signature/)).toBeInTheDocument()
  })

  // Il difetto del 09/10/2026: toccare un risultato e tornare indietro
  // riportava a una Home vuota, e la domanda andava rifatta.
  it('toccando un risultato la conversazione resta da parte, e al ritorno riappare', async () => {
    const utente = userEvent.setup()
    const invoca = vi.fn()
      .mockResolvedValueOnce(chiamata('cercaWorkout', {}))
      .mockResolvedValueOnce(testo('Ecco cosa ha Sofia.'))
    monta(invoca)
    await utente.click(await screen.findByRole('button', { name: ESEMPI[1] }))
    await utente.click(await screen.findByRole('button', { name: /Motore.*Sofia Neri/ }))
    expect(daRiaprire()).toBe(true)
    expect(ricercaSospesa().turni).toHaveLength(1)

    // Il foglio si rimonta (la Home lo riapre al ritorno): stessa conversazione,
    // e i dati NON si ricaricano.
    cleanup()
    const caricaDati = vi.fn(() => Promise.resolve(DATI))
    monta(vi.fn(), caricaDati)
    expect(await screen.findByText('Ecco cosa ha Sofia.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Motore.*Sofia Neri/ })).toBeInTheDocument()
    expect(caricaDati).not.toHaveBeenCalled()
    // si riapre UNA volta sola
    expect(daRiaprire()).toBe(false)
  })

  it('chiudere il foglio con la X chiude anche la conversazione', async () => {
    const utente = userEvent.setup()
    const invoca = vi.fn()
      .mockResolvedValueOnce(chiamata('cercaWorkout', {}))
      .mockResolvedValueOnce(testo('Ecco.'))
    const { onChiudi } = monta(invoca)
    await utente.click(await screen.findByRole('button', { name: ESEMPI[1] }))
    await screen.findByText('Ecco.')
    await utente.click(screen.getByRole('button', { name: 'Chiudi' }))
    await waitFor(() => expect(onChiudi).toHaveBeenCalled())
    expect(ricercaSospesa()).toBeNull()
  })

  it('la riga di un atleta dice perché è nella lista', () => {
    expect(dettaglioAtleta({ giorniFermo: 9 })).toBe('fermo da 9 giorni')
    expect(dettaglioAtleta({ gara: 'Hyrox Milano', fraGiorni: 1 })).toBe('Hyrox Milano domani')
    expect(dettaglioAtleta({ rpeMassimo: 9, inPausa: true })).toBe('RPE 9 · in pausa')
  })
})
