import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// «Scarpe da corsa» (02/11/2026, spec §2 «/scarpe/:id»): il dettaglio di una
// scarpa. Gli errori che non danno errore a schermo: il codice del workout
// lasciato nel titolo, un km sconosciuto scritto come 0, «Ritirala» senza
// conferma, una soglia non numerica salvata, la scarpa di un'altra persona
// (o di un id inventato) mostrata invece di «Scarpa non trovata».

const dati = await vi.hoisted(async () => ({ scarpe: { disponibile: true, scarpe: [] } }))

vi.mock('../../lib/scarpeDb', async (originale) => {
  const vero = await originale()
  return {
    tabelleAssenti: vero.tabelleAssenti,
    numeroKm: vero.numeroKm,
    leggiScarpeAtleta: vi.fn(async () => dati.scarpe),
    aggiornaScarpa: vi.fn(async () => {}),
    ritiraScarpa: vi.fn(async () => {}),
    rendiPrincipale: vi.fn(async () => {}),
  }
})
vi.mock('../../lib/alert', () => ({ mostraErrore: vi.fn(), mostraSuccesso: vi.fn(), mostraAlert: vi.fn() }))

const db = await import('../../lib/scarpeDb')
const DettaglioScarpa = (await import('../DettaglioScarpa')).default

const scarpa = (id, extra) => ({
  id, athlete_id: 'a1', catalogo_id: null, marca: 'Hoka', modello: 'Clifton 10',
  km_iniziali: 120, soglia_km: 700, principale: false, ritirata_at: null, km: 412, stato: 'ok',
  usi: [
    { athlete_workout_id: 'w1', data: '2026-10-20', titolo: 'Lungo domenicale · EM 24′ @8', km: 14.2, fonte: 'orologio' },
    { athlete_workout_id: 'w2', data: '2026-10-18', titolo: 'Ripetute', km: 10, fonte: 'stima' },
    { athlete_workout_id: 'w3', data: '2026-10-15', titolo: 'Corsa libera', km: null, fonte: 'stima' },
  ],
  ...extra,
})

const monta = (id = 's1', { role = 'athlete' } = {}) =>
  montaPagina(<DettaglioScarpa />, {
    role, user: { id: 'a1', email: 'a@f.it' }, percorso: `/scarpe/${id}`, rotta: '/scarpe/:id',
  })

beforeEach(() => {
  vi.clearAllMocks()
  dati.scarpe = { disponibile: true, scarpe: [scarpa('s1'), scarpa('s2', { modello: 'Pegasus', principale: true })] }
})

describe('/scarpe/:id', () => {
  it('mostra totale, km di partenza e gli usi senza codice, con la fonte; km ignoto = «—»', async () => {
    monta()
    expect(await screen.findByText('412 / 700 km')).toBeInTheDocument()
    expect(screen.getByText(/Km di partenza/)).toHaveTextContent('120')
    const usi = screen.getByRole('list', { name: 'Usi' })
    expect(within(usi).getByText('Lungo domenicale')).toBeInTheDocument()
    expect(within(usi).queryByText(/EM 24/)).not.toBeInTheDocument()
    expect(within(usi).getByText(/dall'orologio/)).toBeInTheDocument()
    expect(within(usi).getAllByText(/stimato/).length).toBe(2)
    const senzaKm = within(usi).getByText('Corsa libera').closest('li')
    expect(within(senzaKm).getByText('—')).toBeInTheDocument()
  })

  it('«Ritirala» passa dalla conferma e poi chiama ritiraScarpa', async () => {
    monta()
    await userEvent.click(await screen.findByRole('button', { name: 'Ritirala' }))
    expect(db.ritiraScarpa).not.toHaveBeenCalled()
    const conferma = await screen.findByRole('dialog', { name: /Ritirare/ })
    await userEvent.click(within(conferma).getByRole('button', { name: 'Ritirala' }))
    await waitFor(() => expect(db.ritiraScarpa).toHaveBeenCalledWith('s1'))
  })

  it('soglia non numerica: «Salva» spento; «800» salva soglia_km: 800', async () => {
    monta()
    const campo = await screen.findByLabelText('Soglia di cambio (km)')
    const salva = screen.getByRole('button', { name: 'Salva' })
    await userEvent.clear(campo)
    await userEvent.type(campo, 'abc')
    expect(salva).toBeDisabled()
    await userEvent.clear(campo)
    await userEvent.type(campo, '800')
    expect(salva).toBeEnabled()
    await userEvent.click(salva)
    await waitFor(() => expect(db.aggiornaScarpa).toHaveBeenCalledWith('s1', { soglia_km: 800 }))
  })

  it('«Rendila principale» chiama rendiPrincipale', async () => {
    monta()
    await userEvent.click(await screen.findByRole('button', { name: 'Rendila principale' }))
    await waitFor(() => expect(db.rendiPrincipale).toHaveBeenCalledWith('a1', 's1'))
  })

  it('«Rendila principale» fallita: errore e la scarpa si rilegge (lo stato può essere cambiato a metà)', async () => {
    db.rendiPrincipale.mockRejectedValueOnce(new Error('rete'))
    monta()
    await userEvent.click(await screen.findByRole('button', { name: 'Rendila principale' }))
    const alert = await import('../../lib/alert')
    await waitFor(() => expect(alert.mostraErrore).toHaveBeenCalled())
    await waitFor(() => expect(db.leggiScarpeAtleta).toHaveBeenCalledTimes(2))
  })

  it('id che non è dell\'atleta: «Scarpa non trovata» e il tasto indietro', async () => {
    monta('inventata')
    expect(await screen.findByText('Scarpa non trovata')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Torna indietro' })).toBeInTheDocument()
  })

  it('uno staff non apre scarpe: «Scarpa non trovata»', async () => {
    monta('s1', { role: 'admin' })
    expect(await screen.findByText('Scarpa non trovata')).toBeInTheDocument()
  })
})
