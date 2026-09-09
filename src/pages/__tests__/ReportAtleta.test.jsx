import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthContext } from '../../App'
import { UTENTE } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// Questa pagina non riassume: propone. Un numero sbagliato non produce una
// schermata brutta, produce un allenamento sbagliato. I casi presi sono quelli
// in cui la pagina resterebbe **plausibile e sbagliata**:
//
//  · la guardia sul ruolo, che deve anche NON leggere (§9-duodecies: una
//    guardia in due punti si rompe togliendone uno, e a schermo non cambia niente);
//  · i giri del blocco sui movimenti, che fanno sembrare leggera la seduta più dura;
//  · «saltato» contro «da fare», che nei dati sono la stessa riga;
//  · una lettura fallita, che qui non si limita a mostrare il vuoto — arriva a
//    proporre di telefonare a un atleta che si è allenato regolarmente.

const dati = await vi.hoisted(async () => ({ atleti: [], assegnazioni: [], guasti: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(
    () => ({ athletes: dati.atleti, athlete_workouts: dati.assegnazioni }),
    { erroreSu: () => dati.guasti }
  )
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const AthleteReport = (await import('../AthleteReport')).default

// Domenica 6 settembre 2026, a settimana finita. La settimana va da lun 31 ago.
const DOMENICA = new Date('2026-09-06T20:00:00')

const ex = (name, extra = {}) => ({ name, reps: '-', meters: '-', kg: '', ...extra })
const hyrox = (blocks, intensity) => ({
  category: 'Hyrox', ...(intensity != null ? { intensity: String(intensity) } : {}), blocks,
})
const amrap = (minuti = 60, esercizi = []) =>
  [{ type: 'AMRAP', params: { duration: `${minuti} min` }, exercises: esercizi }]

let seme = 0
const ass = (data, { done = false, rpe = null, sections, testo = '', vocale = null, minuti = 60, intensity, titolo = 'Seduta' } = {}) => ({
  id: `aw${++seme}`,
  athlete_id: 'a1',
  completed_date: data,
  status: done ? 'completed' : 'pending',
  notes: rpe != null ? `[RPE: ${rpe}/10]\n${testo}` : (testo || null),
  voice_note_url: vocale,
  workouts: { id: `w${seme}`, title: titolo, sections: sections || hyrox(amrap(minuti), intensity) },
})
const fatto = (data, extra = {}) => ass(data, { done: true, ...extra })
const giorniFa = (n) => new Date(DOMENICA.getTime() - n * 86400000).toISOString().split('T')[0]

const ATLETA = { id: 'a1', name: 'Marco', surname: 'Bianchi', notes: '', photo_url: null }

function Sonda() {
  const l = useLocation()
  return <p>rotta:{l.pathname}{l.search}</p>
}

const monta = (role = 'admin') => render(
  <MemoryRouter initialEntries={['/report/a1']}>
    <AuthContext.Provider value={{ user: UTENTE, role }}>
      <Sonda />
      <Routes><Route path="/report/:id" element={<AthleteReport />} /></Routes>
    </AuthContext.Provider>
  </MemoryRouter>
)
const rotta = () => screen.getByText(/^rotta:/).textContent.replace('rotta:', '')

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(DOMENICA)
  finto.chiamate.length = 0
  dati.atleti = [ATLETA]
  dati.assegnazioni = []
  dati.guasti = []
  seme = 0
})
afterEach(() => { vi.useRealTimers() })

// ── La guardia ────────────────────────────────────────────────────────────

describe('Report atleta — solo il coach', () => {
  // 🔴 La guardia sta in due punti: il redirect e il `return` prima del fetch.
  // Verificare solo il primo lascia passare una versione che rimanda alla Home
  // DOPO aver scaricato tutto lo storico sul dispositivo dell'atleta.
  it('rimanda l\'atleta alla Home, e non legge niente', async () => {
    monta('athlete')
    await waitFor(() => expect(rotta()).toBe('/'))
    expect(finto.chiamateA('athlete_workouts')).toHaveLength(0)
    expect(finto.chiamateA('athletes')).toHaveLength(0)
  })

  it('al coach mostra il nome dell\'atleta e le indicazioni', async () => {
    dati.assegnazioni = [fatto(giorniFa(2), { rpe: 7 })]
    monta()
    expect(await screen.findByRole('heading', { name: 'Marco Bianchi' })).toBeInTheDocument()
    expect(screen.getByText('Come programmare la prossima')).toBeInTheDocument()
  })

  it('legge solo le assegnazioni di quell\'atleta', async () => {
    dati.assegnazioni = [fatto(giorniFa(2), { rpe: 7 })]
    monta()
    await screen.findByRole('heading', { name: 'Marco Bianchi' })
    // ⚠️ Senza il filtro la pagina scaricherebbe lo storico di tutta la
    // squadra per mostrarne uno: `reportAtleta` non se ne accorgerebbe — i
    // numeri sarebbero quelli di dodici persone sotto il nome di una.
    const filtri = finto.chiamateA('athlete_workouts', 'eq')
    expect(filtri.some(c => c.args[0] === 'athlete_id' && c.args[1] === 'a1')).toBe(true)
  })
})

// ── Le proposte ───────────────────────────────────────────────────────────

describe('Report atleta — cosa fargli fare', () => {
  it('ogni indicazione porta il numero da cui esce', async () => {
    dati.assegnazioni = [
      // Tre settimane tranquille, poi una molto più dura: il carico schizza.
      ...[26, 19, 12].map(d => fatto(d === 12 ? giorniFa(12) : giorniFa(d), { rpe: 5, minuti: 45 })),
      ...[4, 3, 2, 1].map(d => fatto(giorniFa(d), { rpe: 9, minuti: 75 })),
    ]
    monta()

    const voce = await screen.findByText(/Togli circa il \d+% di volume/)
    const riga = voce.closest('li')
    expect(riga.textContent).toMatch(/× la sua media di 4 settimane/)
    expect(riga.textContent).toMatch(/punti contro/)
  })

  // 🔴 Senza abbastanza sedute misurate il rapporto è rumore: la pagina non
  // deve proporre di scaricare o caricare su un numero che non ha.
  it('senza abbastanza dati non propone di scaricare né di caricare', async () => {
    dati.assegnazioni = [fatto(giorniFa(2), { rpe: 9, minuti: 90 })]
    monta()

    await screen.findByText('Come programmare la prossima')
    expect(screen.queryByText(/Togli circa/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Puoi aggiungere/)).not.toBeInTheDocument()
  })

  it('dice di rimettere i movimenti che non tocca da settimane', async () => {
    dati.assegnazioni = [
      fatto(giorniFa(40), { rpe: 7, sections: hyrox(amrap(60, [ex('Sled Push', { meters: '50m', kg: '80' })])) }),
      ...[4, 2].map(d => fatto(giorniFa(d), { rpe: 7, sections: hyrox(amrap(60, [ex('Wall Balls', { reps: '15', kg: '9' })])) })),
    ]
    monta()
    expect(await screen.findByText(/Rimetti Sled Push/)).toBeInTheDocument()
  })

  it('quando non c\'è niente da correggere lo dice, invece di lasciare il vuoto', async () => {
    // Una seduta per settimana, sempre uguale: il carico è esattamente la sua
    // media, l'aderenza è piena, e la settimana prossima è già programmata.
    dati.assegnazioni = [
      ...['2026-08-12', '2026-08-19', '2026-08-26', '2026-09-02']
        .map(d => fatto(d, { rpe: 7, minuti: 60 })),
      ass('2026-09-09'),
    ]
    monta()
    expect(await screen.findByText(/Ripeti la struttura di questa settimana/)).toBeInTheDocument()
  })
})

// ── I movimenti ───────────────────────────────────────────────────────────

describe('Report atleta — movimenti e carichi', () => {
  // 🔴 Dieci burpees in un For Time da cinque round sono cinquanta. Contarli
  // dieci fa sembrare leggera la seduta più dura della settimana, e il coach
  // programma la successiva su quel numero.
  it('conta le ripetizioni moltiplicate per i giri del blocco', async () => {
    dati.assegnazioni = [fatto(giorniFa(2), {
      rpe: 8,
      sections: hyrox([{
        type: 'For Time', params: { rounds: '5' },
        exercises: [ex('Burpees', { reps: '10' })],
      }]),
    })]
    monta()

    const riga = (await screen.findByText('Burpees')).closest('div')
    expect(riga.textContent).toContain('50 reps')
  })

  // 🔴 Il caso deve avere l'ultimo carico PIÙ BASSO del massimo storico, o non
  // distingue niente: con «12 kg il mese scorso, 6 la settimana scorsa», il
  // massimo dice 12 e il coach programma 12 a chi ha appena scaricato. Il primo
  // tentativo di questo test usava 9 e 6 in quest'ordine — passava anche
  // mostrando il massimo, cioè verificava un'altra cosa.
  it('mostra il carico dell\'ultima volta, non il massimo storico', async () => {
    dati.assegnazioni = [
      fatto(giorniFa(2), { rpe: 8, sections: hyrox(amrap(60, [ex('Wall Balls', { reps: '15', kg: '6' })])) }),
      fatto(giorniFa(20), { rpe: 8, sections: hyrox(amrap(60, [ex('Wall Balls', { reps: '15', kg: '12' })])) }),
    ]
    monta()

    const riga = (await screen.findByText('Wall Balls')).closest('div').parentElement
    expect(within(riga).getByText('6')).toBeInTheDocument()
    expect(within(riga).queryByText('12')).not.toBeInTheDocument()
  })

  // 🔴 Un elenco che tace su una seduta su due si legge come «ha fatto poco»,
  // e la proposta che ne segue è quella sbagliata.
  it('dichiara le sedute di corsa che non può elencare', async () => {
    dati.assegnazioni = [
      fatto(giorniFa(3), { rpe: 6, sections: { category: 'Running', steps: [{ type: 'run', duration: '40 min' }] } }),
      fatto(giorniFa(2), { rpe: 7, sections: hyrox(amrap(60, [ex('Wall Balls', { reps: '15' })])) }),
    ]
    monta()
    expect(await screen.findByText(/1 seduta di corsa non è elencata/)).toBeInTheDocument()
  })
})

// ── Il diario ─────────────────────────────────────────────────────────────

describe('Report atleta — seduta per seduta', () => {
  // 🔴 Nei dati sono la stessa riga (`status !== 'completed'`) e per chi legge
  // sono opposti: senza la distinzione, il venerdì ancora da fare compare come
  // un buco già scavato.
  it('distingue quello che ha saltato da quello che deve ancora fare', async () => {
    vi.setSystemTime(new Date('2026-09-02T10:00:00'))   // mercoledì
    dati.assegnazioni = [
      fatto('2026-08-31', { rpe: 7, titolo: 'Lunedì Hyrox' }),
      ass('2026-09-01', { titolo: 'Martedì saltato' }),
      ass('2026-09-04', { titolo: 'Venerdì da fare' }),
    ]
    monta()

    expect(await screen.findByRole('button', { name: /Lunedì Hyrox: Fatto/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Martedì saltato: Saltato/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Venerdì da fare: Da fare/ })).toBeInTheDocument()
  })

  it('mostra previsto e sentito, e lo scarto fra i due', async () => {
    dati.assegnazioni = [fatto(giorniFa(2), { rpe: 9, intensity: 6, titolo: 'Simulazione' })]
    monta()

    const riga = await screen.findByRole('button', { name: /Simulazione: Fatto/ })
    expect(riga.textContent).toContain('previsto 6')
    expect(riga.textContent).toContain('sentito 9')
    expect(riga.textContent).toContain('(+3)')
  })

  it('la seduta apre il workout di quell\'atleta', async () => {
    dati.assegnazioni = [fatto(giorniFa(2), { rpe: 7, titolo: 'Simulazione' })]
    monta()

    await userEvent.click(await screen.findByRole('button', { name: /Simulazione: Fatto/ }))
    expect(rotta()).toBe('/workout/w1?athlete_id=a1')
  })
})

// ── Navigazione e guasti ──────────────────────────────────────────────────

describe('Report atleta — la settimana e i guasti', () => {
  it('non si può andare in una settimana che non è ancora successa', async () => {
    monta()
    await screen.findByRole('heading', { name: 'Marco Bianchi' })
    expect(screen.getByRole('button', { name: 'Settimana successiva' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Settimana precedente' }))
    expect(screen.getByRole('button', { name: 'Settimana successiva' })).not.toBeDisabled()
  })

  it('si torna al report della squadra', async () => {
    monta()
    await userEvent.click(await screen.findByRole('button', { name: 'Torna al report della squadra' }))
    expect(rotta()).toBe('/report')
  })

  // 🔴 Qui una lettura fallita non si limita a mostrare il vuoto: senza righe
  // la pagina proporrebbe di telefonare a un atleta che si è allenato
  // regolarmente, e il coach agirebbe su quella proposta.
  it('una lettura fallita lo dice, e non propone niente', async () => {
    dati.assegnazioni = [fatto(giorniFa(1), { rpe: 7 })]
    dati.guasti = ['athlete_workouts']
    const errori = vi.spyOn(console, 'error').mockImplementation(() => {})
    monta()

    expect(await screen.findByText('Non sono riuscito a leggere la settimana')).toBeInTheDocument()
    expect(screen.queryByText('Come programmare la prossima')).not.toBeInTheDocument()
    expect(errori).toHaveBeenCalled()
    errori.mockRestore()
  })
})
