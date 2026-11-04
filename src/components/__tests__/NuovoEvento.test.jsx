import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Perché questi test esistono
// ────────────────────────────
// «Nuovo evento» → «Prossima gara» ha la levetta Hyrox | Corsa. Con Corsa
// l'evento salvato porta `sections.corsa` e MAI `sections.hyrox`: la seconda
// la leggono RisultatoGara e InvitoRisultato per cercare il tempo su
// results.hyrox.com, e una maratona finirebbe a cercarlo lì.

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{ id: 'w-nuovo' }],
    athlete_workouts: [],
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const NuovoEvento = (await import('../NuovoEvento')).default

const giorno = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const gara = (id, nome, n, regione, distanza, citta, provincia, livello = 'nazionale') => ({
  id, nome, dal: giorno(n), al: giorno(n), tipo: distanza === 'trail' ? 'trail' : 'strada',
  citta, provincia, regione, distanza, livello, url: `https://www.fidal.it/calendario/${id}`,
})
const GARE_CORSA = [
  gara('c1', 'Maratona di Venezia', 12, 'veneto', 'maratona', 'Venezia', 'VE'),
  gara('c2', 'Mezza di Monza', 25, 'lombardia', 'mezza', 'Monza', 'MB'),
  gara('c3', 'Corri Roma 10', 40, 'lazio', '10k', 'Roma', 'RM', 'regionale'),
  gara('c4', 'Trail delle Dolomiti', 60, 'trentino-alto-adige', 'trail', 'Trento', 'TN', 'regionale'),
]

// Una gara HYROX nella forma attuale (con `immagine` e `paese`, come vuole formaAttuale).
const GARA_HYROX = {
  id: 'h1', nome: 'HYROX Valencia', codice: 'VLC', dal: giorno(30), al: giorno(30),
  url: 'https://hyrox.com/event/hyrox-valencia/', continente: 'europe', paese: 'ES', paeseNome: 'Spain', immagine: '', citta: 'Valencia',
}
const conGareHyrox = (gare) => finto.supabase.functions.invoke.mockImplementation((nome) => Promise.resolve(
  nome === 'gare-corsa' ? { data: { gare: GARE_CORSA }, error: null } : { data: { gare }, error: null },
))

beforeEach(() => {
  finto.chiamate.length = 0
  localStorage.clear()
  finto.supabase.functions.invoke.mockReset()
  finto.supabase.functions.invoke.mockImplementation((nome) => Promise.resolve(
    nome === 'gare-corsa' ? { data: { gare: GARE_CORSA }, error: null } : { data: { gare: [] }, error: null },
  ))
})

const apriCorsa = async () => {
  render(<NuovoEvento athleteId="u1" dataIniziale={giorno(0)} onClose={vi.fn()} onSaved={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Corsa' }))
  await screen.findByRole('button', { name: /Maratona di Venezia/ })
}

describe('NuovoEvento → Corsa', () => {
  it('mostra le gare di corsa raggruppate per mese', async () => {
    await apriCorsa()
    expect(screen.getAllByRole('region').length).toBeGreaterThanOrEqual(2)
    for (const g of GARE_CORSA) expect(screen.getByRole('button', { name: new RegExp(g.nome) })).toBeInTheDocument()
    expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('gare-corsa', { body: {} })
  })

  it('filtra per distanza, sceglie la gara e salva con sections.corsa, senza hyrox', async () => {
    const onSaved = vi.fn()
    render(<NuovoEvento athleteId="u1" dataIniziale={giorno(0)} onClose={vi.fn()} onSaved={onSaved} />)
    await userEvent.click(screen.getByRole('button', { name: 'Corsa' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Mezza' }))
    expect(screen.queryByRole('button', { name: /Maratona di Venezia/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Mezza di Monza/ }))

    expect(screen.getByRole('link', { name: /Pagina FIDAL/ })).toHaveAttribute('href', 'https://www.fidal.it/calendario/c2')
    expect(screen.getByDisplayValue('Mezza di Monza')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al Calendario' }))
    const [insert] = finto.chiamateA('workouts', 'insert')
    const riga = insert.args[0]
    expect(riga.title).toBe('Mezza di Monza')
    expect(riga.date).toBe(giorno(25))
    expect(riga.sections.corsa.id).toBe('c2')
    expect(riga.sections.category).toBe('Event')
    expect(riga.sections).not.toHaveProperty('hyrox')
    expect(onSaved).toHaveBeenCalled()
  })

  it('«Tutte» toglie il filtro distanza e fa riapparire le gare', async () => {
    await apriCorsa()
    await userEvent.click(screen.getByRole('button', { name: 'Tutta Italia' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Lombardia' }))
    await userEvent.click(screen.getByRole('button', { name: '10 km' })) // in Lombardia non c'è nessuna 10 km
    expect(screen.getByText(/Nessuna gara trovata/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tutte' }))
    expect(screen.queryByText(/Nessuna gara trovata/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mezza di Monza/ })).toBeInTheDocument()
  })

  it('«Tutta Italia» nel foglio regione toglie il filtro regione e fa riapparire le gare', async () => {
    await apriCorsa()
    await userEvent.click(screen.getByRole('button', { name: '10 km' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tutta Italia' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Lombardia' }))
    expect(screen.getByText(/Nessuna gara trovata/)).toBeInTheDocument() // la 10 km è nel Lazio
    await userEvent.click(screen.getByRole('button', { name: 'Lombardia' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tutta Italia' }))
    expect(screen.queryByText(/Nessuna gara trovata/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Corri Roma 10/ })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('fleofit_corsa_regione'))).toBe('')
  })

  it('una ricerca senza risultati lascia i filtri toccabili', async () => {
    await apriCorsa()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Cerca gara di corsa' }), 'zzz')
    expect(screen.getByText(/Nessuna gara trovata/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tutte' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Tutta Italia' })).toBeEnabled()
  })

  it('il foglio regione filtra e si ricorda la scelta', async () => {
    await apriCorsa()
    await userEvent.click(screen.getByRole('button', { name: 'Tutta Italia' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Lombardia' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mezza di Monza/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Maratona di Venezia/ })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('fleofit_corsa_regione'))).toBe('lombardia')

    await userEvent.click(screen.getByRole('button', { name: 'Lombardia' }))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Lombardia' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('una gara HYROX si salva con sections.hyrox e senza corsa', async () => {
    conGareHyrox([GARA_HYROX])
    render(<NuovoEvento athleteId="u1" dataIniziale={giorno(0)} onClose={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: /HYROX Valencia/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al Calendario' }))
    const [insert] = finto.chiamateA('workouts', 'insert')
    expect(insert.args[0].title).toBe('HYROX Valencia')
    expect(insert.args[0].sections.hyrox.id).toBe('h1')
    expect(insert.args[0].sections).not.toHaveProperty('corsa')
  })

  it('Hyrox → Corsa → Hyrox ritrova la gara HYROX e la salva come hyrox', async () => {
    conGareHyrox([GARA_HYROX])
    render(<NuovoEvento athleteId="u1" dataIniziale={giorno(0)} onClose={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: /HYROX Valencia/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Corsa' }))
    await screen.findByRole('button', { name: /Maratona di Venezia/ })
    expect(screen.queryByDisplayValue('HYROX Valencia')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hyrox' }))
    expect(screen.getByDisplayValue('HYROX Valencia')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi al Calendario' }))
    const [insert] = finto.chiamateA('workouts', 'insert')
    expect(insert.args[0].title).toBe('HYROX Valencia')
    expect(insert.args[0].sections.hyrox.id).toBe('h1')
    expect(insert.args[0].sections).not.toHaveProperty('corsa')
  })

  it('con Hyrox, all\'apertura, non carica le gare di corsa', async () => {
    render(<NuovoEvento athleteId="u1" dataIniziale={giorno(0)} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Hyrox' })).toHaveAttribute('aria-pressed', 'true')
    await screen.findByText(/Calendario HYROX non disponibile/)
    expect(finto.supabase.functions.invoke).not.toHaveBeenCalledWith('gare-corsa', expect.anything())
  })
})
