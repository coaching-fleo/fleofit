import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// «Scarpe da corsa» (02/11/2026, spec §2 «Vista coach»): nella scheda di un
// atleta il coach vede UNA riga di sola lettura con la scarpa principale e,
// se serve, l'avviso «da cambiare». Gli errori che non danno errore a
// schermo: una riga «0 km» al posto del dato, un avviso per una scarpa
// ritirata, un alert quando le tabelle non esistono ancora, un tasto di
// scrittura che il coach non deve avere.

const dati = await vi.hoisted(async () => ({ scarpe: { disponibile: true, scarpe: [] }, errore: false }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [{ id: 'a5', name: 'Andrea', surname: 'Vitali', photo_url: null, weight: 74, height: 181, birth_date: '1992-04-03', instagram_url: null, strava_url: null, notes: null }],
    athlete_workouts: [], personal_records: [],
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('../../lib/scarpeDb', async (originale) => {
  const vero = await originale()
  return {
    ...vero,
    leggiScarpeAtleta: vi.fn(async () => { if (dati.errore) throw new Error('rete'); return dati.scarpe }),
  }
})

const AthleteDetail = (await import('../AthleteDetail')).default
const db = await import('../../lib/scarpeDb')

const scarpa = (extra) => ({ id: 's1', marca: 'Nike', modello: 'Pegasus 41', principale: true, ritirata_at: null, soglia_km: 700, km: 411.6, stato: 'ok', usi: [], ...extra })
const monta = () => montaPagina(<AthleteDetail />, { role: 'coach', user: { id: 'coach', email: 'c@f.it' }, percorso: '/athletes/a5', rotta: '/athletes/:id' })
const attendiScheda = () => waitFor(() => expect(screen.getByRole('heading', { name: /Andrea Vitali/ })).toBeInTheDocument())

beforeEach(() => {
  dati.scarpe = { disponibile: true, scarpe: [] }
  dati.errore = false
  db.leggiScarpeAtleta.mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('La riga scarpe nella scheda atleta (coach)', () => {
  it('mostra la principale con modello e km arrotondati', async () => {
    dati.scarpe = { disponibile: true, scarpe: [scarpa()] }
    monta(); await attendiScheda()
    expect(await screen.findByText('Scarpe: Pegasus 41 · 412 km')).toBeInTheDocument()
    expect(db.leggiScarpeAtleta).toHaveBeenCalledWith('a5')
    expect(screen.queryByText(/da cambiare/)).not.toBeInTheDocument()
  })

  it('avvisa «da cambiare» se una scarpa attiva è oltre la soglia', async () => {
    dati.scarpe = { disponibile: true, scarpe: [scarpa({ km: 720, stato: 'oltre' })] }
    monta(); await attendiScheda()
    expect(await screen.findByText(/da cambiare/)).toBeInTheDocument()
  })

  it('senza principale ma con una attiva oltre soglia: l\'avviso c\'è lo stesso', async () => {
    dati.scarpe = { disponibile: true, scarpe: [
      scarpa({ principale: false, km: 720, stato: 'oltre' }),
      scarpa({ id: 's2', principale: false, modello: 'Clifton 10', km: 100, stato: 'ok' }),
    ] }
    monta(); await attendiScheda()
    expect(await screen.findByText('Scarpe: 2 attive')).toBeInTheDocument()
    expect(screen.getByText(/da cambiare/)).toBeInTheDocument()
    expect(screen.getByText('Scarpe: 2 attive').closest('button')).toBeNull()
  })

  it('una scarpa ritirata oltre soglia non fa avvisare', async () => {
    dati.scarpe = { disponibile: true, scarpe: [scarpa(), scarpa({ id: 's2', principale: false, ritirata_at: '2026-10-01', stato: 'oltre' })] }
    monta(); await attendiScheda()
    await screen.findByText(/Scarpe: Pegasus 41/)
    expect(screen.queryByText(/da cambiare/)).not.toBeInTheDocument()
  })

  it('è di sola lettura: nessun bottone di modifica nella riga', async () => {
    dati.scarpe = { disponibile: true, scarpe: [scarpa()] }
    monta(); await attendiScheda()
    const riga = await screen.findByText(/Scarpe: Pegasus 41/)
    expect(riga.closest('button')).toBeNull()
    expect(riga.closest('a')).toBeNull()
  })

  it('tabelle assenti, atleta senza scarpe o errore: nessuna riga e nessun alert', async () => {
    for (const caso of [
      () => { dati.scarpe = { disponibile: false, scarpe: [] } },
      () => { dati.scarpe = { disponibile: true, scarpe: [] } },
      () => { dati.errore = true },
    ]) {
      caso()
      const { unmount } = monta(); await attendiScheda()
      await waitFor(() => expect(db.leggiScarpeAtleta).toHaveBeenCalled())
      await new Promise(r => setTimeout(r, 20))
      expect(screen.queryByText(/Scarpe:/)).not.toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      unmount(); db.leggiScarpeAtleta.mockClear(); dati.errore = false
    }
  })
})
