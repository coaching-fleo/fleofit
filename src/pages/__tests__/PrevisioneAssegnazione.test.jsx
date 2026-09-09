import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Perché questi test esistono — FASE 2 del modello predittivo (02/09/2026).
// ────────────────────────────────────────────────────────────────────────
// Il foglio di assegnazione era una lista di nomi: si sceglieva a memoria chi
// stava reggendo il carico e chi no. Ora ogni riga può portare un avviso, e le
// regressioni qui sono tutte silenziose. Le cinque che questo file prende:
//
//  1. il semaforo compare quando c'è un salto di carico vero;
//  2. NON compare per chi non ha niente da segnalare — il verde non si
//     dichiara, o con dodici nomi l'unico ambra diventa invisibile;
//  3. l'avviso sta anche nell'`aria-label`, non solo nel colore: chi legge con
//     VoiceOver non ha modo di sapere che una riga è arancione;
//  4. l'avviso NON blocca — «Conferma» resta premibile;
//  5. se la lettura in più FALLISCE, i semafori spariscono e l'assegnazione
//     continua a funzionare esattamente come prima. ⚠️ È il test che conta di
//     più: un di più non deve poter togliere il gesto che c'era;
//  6. la `select` degli atleti chiede `notes`, che è dove vive la pausa.

const ctrl = await vi.hoisted(async () => ({ stato: {} }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(
    () => ({
      workouts: [{ id: 'w1', title: 'Hyrox Strength', date: '2026-09-01', coach_notes: '', sections: ctrl.stato.sections }],
      athlete_workouts: ctrl.stato.assegnazioni ?? [],
      athletes: ctrl.stato.atleti ?? [],
    }),
    { erroreSu: () => ctrl.stato.erroreSu ?? [] },
  )
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('jspdf', () => ({ default: class {}, jsPDF: class {} }))
vi.mock('html-to-image', () => ({ toPng: vi.fn(), toBlob: vi.fn() }))
vi.mock('@capacitor/network', () => ({ Network: {
  getStatus: vi.fn(() => Promise.resolve({ connected: true })),
  addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
} }))

const { AuthContext } = await import('../../App')
const WorkoutDetail = (await import('../WorkoutDetail')).default

/** Un Hyrox con durata e intensità dichiarate: 30 minuti a 9. */
const PESANTE = { category: 'Hyrox', intensity: '9',
  blocks: [{ id: 'b1', type: 'EMOM', params: { interval: '1:00', rounds: '30' },
    exercises: [{ id: 'e1', name: 'Wall Balls', reps: '20', intensity: '9' }] }] }

const ATLETI = [
  { id: 'a1', name: 'Marco', surname: 'Rossi', photo_url: null, notes: '' },
  { id: 'a2', name: 'Luca', surname: 'Bianchi', photo_url: null, notes: '' },
]

/**
 * Una seduta chiusa con RPE dichiarato.
 *
 * ⚠️ `sections` con `intensity`: senza, `rpeAtteso` ripiegherebbe sui tipi di
 * blocco e lo scarto misurato non sarebbe quello che il test crede di preparare.
 */
const chiusa = (atleta, data, rpe, rounds = 20) => ({
  id: `${atleta}-${data}`, athlete_id: atleta, workout_id: 'w0', completed_date: data,
  status: 'completed', notes: `[RPE: ${rpe}/10]\n`, voice_note_url: null,
  athletes: { id: atleta, name: 'X', surname: 'Y', photo_url: null },
  workouts: { id: 'w0', title: 'Passata', sections: {
    category: 'Hyrox', intensity: String(rpe),
    blocks: [{ id: 'b', type: 'EMOM', params: { interval: '1:00', rounds: String(rounds) },
      exercises: [{ id: 'e', name: 'Row', reps: '10', intensity: String(rpe) }] }] } },
})

/** Quattro settimane regolari e leggere: uno storico vero, ma piccolo. */
const storicoLeggero = (atleta) => [
  '2026-08-04', '2026-08-06', '2026-08-11', '2026-08-13',
  '2026-08-18', '2026-08-20', '2026-08-25', '2026-08-27',
].map(d => chiusa(atleta, d, 4, 10))

function apri() {
  return render(
    <MemoryRouter initialEntries={['/workout/w1']}>
      <AuthContext.Provider value={{ user: { id: 'coach', email: 'c@f.it', user_metadata: {} }, role: 'admin' }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

/** Apre il foglio di assegnazione e aspetta che le righe ci siano. */
async function apriAssegna() {
  apri()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Hyrox Strength' })).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: /^Assegna/ }))
  await waitFor(() => expect(screen.getByRole('button', { name: /Marco Rossi/ })).toBeInTheDocument())
}

const rigaDi = (nome) => screen.getByRole('button', { name: new RegExp(nome) })

beforeEach(() => {
  ctrl.stato = { sections: PESANTE, atleti: ATLETI, assegnazioni: [], erroreSu: [] }
  vi.setSystemTime(new Date('2026-09-01T09:00:00'))
})

describe('FASE 2 — il semaforo sulle righe del foglio di assegnazione', () => {
  it('un salto di carico si vede, e porta il numero da cui esce', async () => {
    ctrl.stato.assegnazioni = storicoLeggero('a1')
    await apriAssegna()

    await waitFor(() => expect(rigaDi('Marco Rossi')).toHaveAccessibleName(/Carico \+/))
    // ⚠️ Non basta che ci sia un avviso: deve essere QUELLO del carico, con la
    // percentuale in chiaro. Una riga che dice solo «attenzione» non si discute.
    expect(within(rigaDi('Marco Rossi')).getByText(/Carico \+\d+% sulla sua media/)).toBeInTheDocument()
  })

  it('chi non ha niente da segnalare NON riceve un «tutto ok»', async () => {
    // Storico regolare E settimana in corso allo stesso passo: nessun salto,
    // nessun fermo, nessuna aderenza bassa.
    // ⚠️ Un allenamento MORBIDO: con uno duro il giorno dopo una seduta dura
    // scatterebbe l'avviso di accumulo, che è giusto e non è il caso in prova.
    ctrl.stato.sections = { category: 'Hyrox', intensity: '5',
      blocks: [{ id: 'b1', type: 'EMOM', params: { interval: '1:00', rounds: '20' },
        exercises: [{ id: 'e1', name: 'Wall Balls', reps: '20', intensity: '5' }] }] }
    ctrl.stato.assegnazioni = ['2026-08-04', '2026-08-06', '2026-08-11', '2026-08-13',
      '2026-08-18', '2026-08-20', '2026-08-25', '2026-08-27', '2026-08-31']
      .map(d => chiusa('a1', d, 7, 20))
    await apriAssegna()

    // La riga resta com'era: il nome e basta.
    await waitFor(() => expect(rigaDi('Marco Rossi')).toBeInTheDocument())
    expect(rigaDi('Marco Rossi')).toHaveAccessibleName('Marco Rossi')
  })

  it('un atleta nuovo dice «storico insufficiente», NON tace', async () => {
    // ⚠️ Due sedute in UNA settimana sola, e a tre giorni da oggi: sotto il
    // minimo del rapporto, ma non abbastanza indietro da farlo risultare fermo
    // né abbastanza vicine da far scattare l'accumulo. È l'unica finestra in
    // cui il caso «storico insufficiente» si esercita da solo.
    ctrl.stato.assegnazioni = ['2026-08-28', '2026-08-29'].map(d => chiusa('a1', d, 7))
    await apriAssegna()

    // ⚠️ Il silenzio si leggerebbe come verde, ed è il caso in cui un ACWR
    // costruito su due sedute manderebbe a scaricare chi sta benissimo.
    await waitFor(() =>
      expect(within(rigaDi('Marco Rossi')).getByText('Storico insufficiente')).toBeInTheDocument())
  })

  it('un atleta in pausa RESTA nella lista, con il suo avviso', async () => {
    ctrl.stato.atleti = [{ ...ATLETI[0], notes: '[PAUSA: 2026-08-20]\nCi sentiamo a settembre' }]
    ctrl.stato.assegnazioni = storicoLeggero('a1')
    await apriAssegna()

    await waitFor(() =>
      expect(within(rigaDi('Marco Rossi')).getByText('In pausa dal 20 ago')).toBeInTheDocument())
    // Il marcatore non si vede MAI come testo grezzo.
    expect(document.body.textContent).not.toContain('[PAUSA')

    // ⚠️ E la colonna da cui esce dev'essere CHIESTA. Il finto Supabase non
    // filtra le colonne — restituisce le righe che gli si danno — quindi
    // togliere `notes` dalla `select` non farebbe cadere l'asserzione sopra:
    // in produzione la pausa smetterebbe di vedersi, e in silenzio.
    expect(finto.chiamateA('athletes', 'select').some(c => String(c.args[0]).includes('notes')))
      .toBe(true)
  })

  it('l\'avviso NON blocca: si può confermare lo stesso', async () => {
    ctrl.stato.assegnazioni = storicoLeggero('a1')
    await apriAssegna()
    await waitFor(() => expect(rigaDi('Marco Rossi')).toHaveAccessibleName(/Carico \+/))

    await userEvent.click(rigaDi('Marco Rossi'))
    await userEvent.click(screen.getByRole('button', { name: /Procedi/ }))

    // Al passo 2 l'avviso si apre per esteso…
    expect(screen.getByText(/la settimana arriva a/)).toBeInTheDocument()
    // …e «Conferma» resta premibile. Un avviso che impedisce un gesto è un
    // avviso che si impara a disattivare.
    expect(screen.getByRole('button', { name: 'Conferma' })).toBeEnabled()
  })

  it('se la lettura dello storico FALLISCE l\'assegnazione funziona lo stesso', async () => {
    ctrl.stato.assegnazioni = storicoLeggero('a1')
    ctrl.stato.erroreSu = ['athlete_workouts']
    await apriAssegna()

    // Nessun semaforo, e lo dice invece di lasciare intendere che vada tutto bene.
    await waitFor(() => expect(screen.getByText(/Storico non disponibile/)).toBeInTheDocument())
    expect(rigaDi('Marco Rossi')).toHaveAccessibleName('Marco Rossi')

    // E il gesto che c'era prima c'è ancora, per intero.
    await userEvent.click(rigaDi('Marco Rossi'))
    await userEvent.click(screen.getByRole('button', { name: /Procedi/ }))
    expect(screen.getByRole('button', { name: 'Conferma' })).toBeEnabled()
  })
})
