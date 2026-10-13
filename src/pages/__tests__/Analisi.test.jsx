import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthContext } from '../../App'
import { UTENTE } from '../../test/montaPagina'
import { COACHING_ID } from '../../lib/constants'

// Perché questi test esistono
// ────────────────────────────
//  · la lettura A PAGINE: con una squadra grande e 26 settimane le righe
//    superano il limite di una lettura sola, e una pagina troncata in silenzio
//    mostrerebbe un'aderenza più bassa del vero (Review Focus 1 del piano);
//  · la lettura fallita, che non deve sembrare una squadra ferma;
//  · il filtro sull'atleta, che vive nell'URL per poter tornare indietro;
//  · la guardia del desktop: sul telefono la pagina non esiste.

const dati = await vi.hoisted(async () => ({ atleti: [], assegnazioni: [], guasti: [], pagina: 0, comeStai: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(
    () => ({
      athletes: dati.atleti,
      come_stai: dati.comeStai,
      // Ogni lettura di `athlete_workouts` è una pagina successiva da 1000.
      // Un getter, perché la funzione gira a ogni `from()` di QUALUNQUE tabella.
      get athlete_workouts() { return dati.assegnazioni.slice(dati.pagina * 1000, ++dati.pagina * 1000) },
    }),
    { erroreSu: () => dati.guasti }
  )
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const Analisi = (await import('../Analisi')).default

// Mercoledì 14 ottobre 2026.
const OGGI = new Date('2026-10-14T10:00:00')

const atleta = (id, name) => ({ id, name, surname: 'Rossi', notes: '', photo_url: null })

let seme = 0
const fatto = (athlete_id, completed_date) => ({
  id: `aw-${++seme}`, athlete_id, completed_date, status: 'completed', notes: '[RPE: 7/10]', voice_note_url: null,
  workouts: { id: `w-${seme}`, title: 'Allenamento', sections: { category: 'Hyrox', blocks: [{ type: 'AMRAP', params: { duration: '30 min' } }] } },
})

function Sonda() {
  const l = useLocation()
  return <p>rotta:{l.pathname}{l.search}</p>
}
const rotta = () => screen.getByText(/^rotta:/).textContent.replace('rotta:', '')

const monta = (percorso = '/analisi') => render(
  <MemoryRouter initialEntries={[percorso]}>
    <AuthContext.Provider value={{ user: UTENTE, role: 'admin' }}>
      <Sonda />
      <Routes>
        <Route path="/analisi" element={<Analisi />} />
        <Route path="/report" element={<p>pagina report</p>} />
      </Routes>
    </AuthContext.Provider>
  </MemoryRouter>
)

const schermo = (largo) => {
  window.matchMedia = vi.fn(() => ({ matches: largo, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(OGGI)
  schermo(true)
  dati.atleti = [atleta('a1', 'Anna'), atleta('a2', 'Bruno'), atleta(COACHING_ID, 'Coach')]
  dati.assegnazioni = []
  dati.guasti = []
  dati.pagina = 0
  dati.comeStai = []
  finto.chiamate.length = 0
})
afterEach(() => vi.useRealTimers())

describe('Analisi', () => {
  it('legge a pagine finché ce ne sono, e conta tutte le sedute', async () => {
    const giorni = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']
    dati.assegnazioni = Array.from({ length: 1600 }, (_, i) => fatto('a1', giorni[i % giorni.length]))
    monta()
    const riga = await screen.findByRole('row', { name: /Anna/ })
    // it-IT non raggruppa sotto le 10.000: «1600». Con una pagina sola sarebbe 1000.
    expect(riga.textContent).toMatch(/Anna Rossi1600/)
    expect(finto.chiamateA('athlete_workouts', 'range')).toHaveLength(2)
    // Il coach non è un atleta da seguire.
    expect(screen.queryByRole('row', { name: /Coach/ })).toBeNull()
  })

  it('una lettura fallita lo dice, senza grafici vuoti', async () => {
    dati.guasti = ['athlete_workouts']
    const { container } = monta()
    expect(await screen.findByText(/Non sono riuscito a leggere/)).toBeInTheDocument()
    expect(container.querySelector('svg[role="img"]')).toBeNull()
  })

  it('un clic su un atleta filtra la pagina e lo scrive nell\'URL', async () => {
    dati.assegnazioni = [fatto('a1', '2026-10-05'), fatto('a2', '2026-10-06')]
    monta()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(await screen.findByRole('row', { name: /Bruno/ }))
    await waitFor(() => expect(rotta()).toMatch(/atleta=a2/))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Bruno/)
  })

  it('lo storico di un esercizio compare solo con un atleta scelto', async () => {
    const conEsercizio = { ...fatto('a1', '2026-10-05') }
    conEsercizio.workouts = { ...conEsercizio.workouts, sections: { category: 'Hyrox', blocks: [{ type: 'For Time', params: { rounds: '1' }, exercises: [{ id: 1, name: 'Wall Balls', reps: '20', kg: '9' }] }] } }
    dati.assegnazioni = [conEsercizio]
    const { unmount } = monta()
    await screen.findByRole('row', { name: /Anna/ })
    expect(screen.queryByRole('heading', { name: 'Storico di un esercizio' })).toBeNull()
    unmount()

    dati.pagina = 0
    monta('/analisi?atleta=a1')
    expect(await screen.findByRole('heading', { name: 'Storico di un esercizio' })).toBeInTheDocument()
    expect(await screen.findByText(/9 kg · 20 rip\./)).toBeInTheDocument()
  })

  it('«Esporta CSV» scarica la tabella degli atleti', async () => {
    dati.assegnazioni = [fatto('a1', '2026-10-05')]
    let blob = null
    const crea = vi.fn((b) => { blob = b; return 'blob:finto' })
    URL.createObjectURL = crea
    URL.revokeObjectURL = vi.fn()
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    monta()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(await screen.findByRole('button', { name: /Esporta CSV/ }))
    expect(crea).toHaveBeenCalledTimes(1)
    // `Blob.text()` toglie il BOM leggendo: lo si cerca nei byte (EF BB BF).
    const byte = new Uint8Array(await blob.arrayBuffer())
    expect([...byte.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const testo = await blob.text()
    expect(testo).toMatch(/^Atleta;In pausa;Sedute/)
    expect(testo).toMatch(/Anna Rossi;;1;100;0,5;7;/)
    expect(clic).toHaveBeenCalled()
    clic.mockRestore()
  })

  it('«Come sta»: la media del periodo per atleta, «—» per chi non ha mai risposto', async () => {
    dati.assegnazioni = [fatto('a1', '2026-10-05'), fatto('a2', '2026-10-06')]
    dati.comeStai = [
      { athlete_id: 'a1', giorno: '2026-10-05', sonno: 4, energia: 5, dolori: null, stress: null },
      { athlete_id: 'a1', giorno: '2026-10-12', sonno: 3, energia: 3, dolori: 3, stress: 3 },
    ]
    monta()
    const anna = await screen.findByRole('row', { name: /Anna/ })
    expect(screen.getByRole('columnheader', { name: /Come sta/ })).toBeInTheDocument()
    // (4,5 + 3) / 2 = 3,8 — la media dei giorni, non delle singole risposte.
    expect(anna.textContent).toMatch(/3,8/)
    expect(screen.getByRole('row', { name: /Bruno/ }).textContent).toMatch(/—/)
    expect(screen.getByRole('heading', { name: 'Come sta' })).toBeInTheDocument()
  })

  it('fuori dal desktop porta al report', async () => {
    schermo(false)
    monta()
    await waitFor(() => expect(rotta()).toBe('/report'))
    expect(finto.chiamateA('athlete_workouts')).toHaveLength(0)
  })
})
