import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// «Scarpe da corsa» (02/11/2026, spec §2): la pagina /scarpe ha due facce. Per
// l'atleta le sue scarpe e il catalogo con «Ce l'ho»; per lo staff il catalogo
// da curare e le scarpe scritte a mano dagli atleti. Gli errori che non danno
// errore a schermo: la faccia sbagliata al ruolo sbagliato, un CustomAlert
// quando la migrazione non è ancora applicata (deve essere uno stato vuoto, e
// la card del profilo deve sparire), un «Elimina» che non chiede conferma.

const dati = await vi.hoisted(async () => ({
  scarpe: { disponibile: true, scarpe: [] },
  catalogo: [],
  scritte: [],
  erroreCatalogo: null,
}))

vi.mock('../../lib/scarpeDb', async (originale) => {
  const vero = await originale()
  return {
    tabelleAssenti: vero.tabelleAssenti,
    numeroKm: vero.numeroKm,
    leggiScarpeAtleta: vi.fn(async () => dati.scarpe),
    elencoCatalogo: vi.fn(async () => { if (dati.erroreCatalogo) throw dati.erroreCatalogo; return dati.catalogo }),
    scritteDagliAtleti: vi.fn(async () => dati.scritte),
    aggiungiScarpa: vi.fn(async ({ athleteId }) => ({ id: 'nuova', athlete_id: athleteId })),
    rendiPrincipale: vi.fn(async () => {}),
    salvaModelloCatalogo: vi.fn(async (m) => ({ id: 'cat-nuovo', ...m })),
    aggiornaModelloCatalogo: vi.fn(async (id, c) => ({ id, ...c })),
    eliminaModelloCatalogo: vi.fn(async () => {}),
  }
})
vi.mock('../../lib/alert', () => ({ mostraErrore: vi.fn(), mostraSuccesso: vi.fn(), mostraAlert: vi.fn() }))

// La scheda atleta legge anche altre tabelle: il finto client basta a montarla.
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase({
    athletes: [{ id: 'a1', name: 'Sara', surname: 'Bianchi', photo_url: null, notes: null }],
    athlete_workouts: [],
    personal_records: [],
  })
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const db = await import('../../lib/scarpeDb')
const alert = await import('../../lib/alert')
const Scarpe = (await import('../Scarpe')).default
const AthleteDetail = (await import('../AthleteDetail')).default

const CATALOGO = [
  { id: 'cat-1', marca: 'Nike', modello: 'Pegasus 41', tipo: 'allenamento', drop_mm: null },
  { id: 'cat-6', marca: 'Hoka', modello: 'Clifton 10', tipo: 'allenamento', drop_mm: null },
  { id: 'cat-7', marca: 'Hoka', modello: 'Speedgoat 6', tipo: 'trail', drop_mm: null },
  { id: 'cat-4', marca: 'Asics', modello: 'Novablast 4', tipo: 'allenamento', drop_mm: null },
]
const scarpa = (id, extra) => ({
  id, athlete_id: 'a1', catalogo_id: null, marca: 'Hoka', modello: 'Clifton 10',
  km_iniziali: 0, soglia_km: 700, principale: false, ritirata_at: null, km: 0, stato: 'ok', usi: [], ...extra,
})
const SCARPE_SARA = [
  scarpa('s1', { principale: true, km: 412, stato: 'ok' }),
  scarpa('s2', { marca: 'Nike', modello: 'Pegasus 41', km: 590, stato: 'quasi' }),
  scarpa('s3', { marca: 'Asics', modello: 'Novablast 4', km: 760, stato: 'oltre', ritirata_at: '2026-10-10T10:00:00Z' }),
]

const comeAtleta = () => montaPagina(<Scarpe />, { role: 'athlete', user: { id: 'a1', email: 'a@f.it' } })
const comeCoach = () => montaPagina(<Scarpe />, { role: 'admin', user: { id: 'c1', email: 'c@f.it' } })
const catalogo = () => screen.findByRole('list', { name: 'Catalogo' })

beforeEach(() => {
  vi.clearAllMocks()
  dati.scarpe = { disponibile: true, scarpe: SCARPE_SARA.map(s => ({ ...s })) }
  dati.catalogo = CATALOGO.map(c => ({ ...c }))
  dati.scritte = []
  dati.erroreCatalogo = null
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('/scarpe — atleta', () => {
  it('mostra le sue scarpe con i km, il bollino «Principale» e le ritirate chiuse', async () => {
    comeAtleta()
    const mie = await screen.findByRole('region', { name: 'Le mie scarpe' })
    expect(within(mie).getByText('412 / 700 km')).toBeInTheDocument()
    expect(within(mie).getByText('Principale')).toBeInTheDocument()
    const ritirate = within(mie).getByRole('button', { name: /Ritirate \(1\)/ })
    expect(ritirate).toHaveAttribute('aria-expanded', 'false')
    expect(within(mie).queryByText('Novablast 4')).not.toBeInTheDocument()
    await userEvent.click(ritirate)
    expect(within(mie).getByText('Novablast 4')).toBeInTheDocument()
  })

  it('«Ce l\'ho» apre il foglio e «Salva» aggiunge la scarpa dal catalogo', async () => {
    comeAtleta()
    const lista = await catalogo()
    const riga = within(lista).getByText('Speedgoat 6').closest('li')
    await userEvent.click(within(riga).getByRole('button', { name: /Ce l'ho/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Hoka Speedgoat 6' })
    await userEvent.type(within(foglio).getByLabelText('Km di partenza'), '150')
    await userEvent.click(within(foglio).getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(db.aggiungiScarpa).toHaveBeenCalledWith(expect.objectContaining({
      athleteId: 'a1', catalogo: expect.objectContaining({ id: 'cat-7' }), kmIniziali: '150',
    })))
  })

  it('km di partenza non validi: «Salva» resta spento', async () => {
    comeAtleta()
    const lista = await catalogo()
    await userEvent.click(within(within(lista).getByText('Speedgoat 6').closest('li')).getByRole('button', { name: /Ce l'ho/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Hoka Speedgoat 6' })
    await userEvent.type(within(foglio).getByLabelText('Km di partenza'), 'abc')
    expect(within(foglio).getByRole('button', { name: 'Salva' })).toBeDisabled()
    expect(db.aggiungiScarpa).not.toHaveBeenCalled()
  })

  it('salvata ma non resa principale: lo dice, e ricarica la lista', async () => {
    db.rendiPrincipale.mockRejectedValueOnce(new Error('rete'))
    comeAtleta()
    const lista = await catalogo()
    await userEvent.click(within(within(lista).getByText('Speedgoat 6').closest('li')).getByRole('button', { name: /Ce l'ho/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Hoka Speedgoat 6' })
    await userEvent.click(within(foglio).getByRole('switch', { name: 'Rendila principale' }))
    await userEvent.click(within(foglio).getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(alert.mostraErrore).toHaveBeenCalledWith(expect.stringMatching(/salvata.*principale/i), expect.anything()))
    expect(db.leggiScarpeAtleta).toHaveBeenCalledTimes(2)
  })

  it('il filtro per tipo «Trail» lascia solo i trail', async () => {
    comeAtleta()
    const lista = await catalogo()
    expect(within(lista).getAllByRole('listitem')).toHaveLength(4)
    await userEvent.click(screen.getByRole('button', { name: 'Trail' }))
    const righe = within(lista).getAllByRole('listitem')
    expect(righe).toHaveLength(1)
    expect(righe[0]).toHaveTextContent('Speedgoat 6')
  })

  it('tabelle assenti: stato vuoto, nessun alert', async () => {
    dati.scarpe = { disponibile: false, scarpe: [] }
    dati.erroreCatalogo = { code: 'PGRST205', message: 'manca la tabella' }
    comeAtleta()
    expect(await screen.findByText(/Le scarpe non sono ancora disponibili/)).toBeInTheDocument()
    expect(alert.mostraErrore).not.toHaveBeenCalled()
    expect(alert.mostraAlert).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Le mie scarpe' })).not.toBeInTheDocument()
  })
})

describe('/scarpe — coach', () => {
  it('c\'è «Aggiungi modello» e non «Le mie scarpe»; «Elimina» passa dalla conferma', async () => {
    comeCoach()
    const lista = await catalogo()
    expect(screen.getByRole('button', { name: /Aggiungi modello/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Le mie scarpe' })).not.toBeInTheDocument()
    expect(db.leggiScarpeAtleta).not.toHaveBeenCalled()
    expect(within(lista).queryByRole('button', { name: /Ce l'ho/ })).not.toBeInTheDocument()

    await userEvent.click(within(lista).getByRole('button', { name: 'Elimina Nike Pegasus 41' }))
    expect(db.eliminaModelloCatalogo).not.toHaveBeenCalled()
    const conferma = await screen.findByRole('dialog', { name: /Togliere il modello/ })
    await userEvent.click(within(conferma).getByRole('button', { name: 'Elimina' }))
    await waitFor(() => expect(db.eliminaModelloCatalogo).toHaveBeenCalledWith('cat-1'))
  })

  it('«Scritte dagli atleti» raggruppa e offre «Aggiungi al catalogo»', async () => {
    dati.scritte = [{ marca: 'Nike', modello: 'Pegasus 41', quante: 2 }, { marca: 'Karhu', modello: 'Fusion 3.5', quante: 1 }]
    dati.catalogo = CATALOGO.filter(c => c.id !== 'cat-1')
    comeCoach()
    const sezione = await screen.findByRole('region', { name: 'Scritte dagli atleti' })
    const riga = within(sezione).getByText('Pegasus 41 · 2 atleti').closest('li')
    await userEvent.click(within(riga).getByRole('button', { name: /Aggiungi al catalogo/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Nuovo modello' })
    expect(within(foglio).getByLabelText('Marca')).toHaveValue('Nike')
    expect(within(foglio).getByLabelText('Modello')).toHaveValue('Pegasus 41')
    await userEvent.click(within(foglio).getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(db.salvaModelloCatalogo).toHaveBeenCalledWith(expect.objectContaining({ marca: 'Nike', modello: 'Pegasus 41', drop_mm: null })))
  })

  it('un drop scritto male non si salva come vuoto', async () => {
    comeCoach()
    await catalogo()
    await userEvent.click(screen.getByRole('button', { name: /Aggiungi modello/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Nuovo modello' })
    await userEvent.type(within(foglio).getByLabelText('Marca'), 'Altra')
    await userEvent.type(within(foglio).getByLabelText('Modello'), 'Lone Peak 9')
    await userEvent.type(within(foglio).getByLabelText('Drop (mm)'), 'zero')
    expect(within(foglio).getByRole('button', { name: 'Salva' })).toBeDisabled()
    await userEvent.clear(within(foglio).getByLabelText('Drop (mm)'))
    await userEvent.type(within(foglio).getByLabelText('Drop (mm)'), '4,5')
    await userEvent.click(within(foglio).getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(db.salvaModelloCatalogo).toHaveBeenCalledWith(expect.objectContaining({ drop_mm: 4.5 })))
  })
})

describe('Card «Le mie scarpe» nel profilo', () => {
  const profilo = () => montaPagina(<AthleteDetail />, { role: 'athlete', user: { id: 'a1', email: 'a@f.it' } })

  it('c\'è, con la principale', async () => {
    profilo()
    const card = await screen.findByRole('link', { name: /Le mie scarpe/ })
    expect(card).toHaveAttribute('href', '/scarpe')
    expect(within(card).getByText(/Clifton 10/)).toBeInTheDocument()
  })

  it('non c\'è se le tabelle mancano', async () => {
    dati.scarpe = { disponibile: false, scarpe: [] }
    profilo()
    await screen.findByRole('heading', { name: /Sara Bianchi/ })
    await waitFor(() => expect(db.leggiScarpeAtleta).toHaveBeenCalled())
    expect(screen.queryByRole('link', { name: /Le mie scarpe/ })).not.toBeInTheDocument()
    expect(alert.mostraErrore).not.toHaveBeenCalled()
  })
})
