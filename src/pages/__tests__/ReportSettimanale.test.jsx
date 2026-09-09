import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthContext } from '../../App'
import { UTENTE } from '../../test/montaPagina'
import { COACHING_ID } from '../../lib/constants'

// Perché questi test esistono
// ────────────────────────────
// Il report è una pagina di soli numeri, e i numeri si rompono restando verdi.
// I casi presi qui sono quelli in cui la pagina resterebbe **plausibile e
// sbagliata**, più il solo che non è un numero: che l'atleta non ci arrivi.
//
//  · la guardia sul ruolo, che non deve limitarsi a nascondere — deve anche
//    NON leggere le assegnazioni di tutta la squadra (§9-duodecies: una
//    guardia in due punti si rompe togliendone uno solo, senza che a schermo
//    cambi niente);
//  · l'aderenza del lunedì mattina, che con il denominatore sbagliato accende
//    un allarme su tutti prima che sia successo qualcosa;
//  · il carico parziale, che senza il `≈` si presenta come un totale;
//  · una lettura fallita, che senza uno stato suo si legge come una settimana
//    vuota — cioè un guasto travestito da dato.

const dati = await vi.hoisted(async () => ({ atleti: [], assegnazioni: [], guasti: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(
    () => ({ athletes: dati.atleti, athlete_workouts: dati.assegnazioni }),
    { erroreSu: () => dati.guasti }
  )
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const WeeklyReport = (await import('../WeeklyReport')).default

// Mercoledì 2 settembre 2026. La settimana va da lun 31 ago a dom 6 set.
const MERCOLEDI = new Date('2026-09-02T10:00:00')
const LUNEDI = new Date('2026-08-31T08:00:00')

const sezioni = (minuti = 60, intensity) => ({
  category: 'Hyrox',
  ...(intensity != null ? { intensity: String(intensity) } : {}),
  blocks: [{ type: 'AMRAP', params: { duration: `${minuti} min` } }],
})

const atleta = (id, name, extra = {}) => ({ id, name, surname: 'Rossi', notes: '', photo_url: null, ...extra })

let seme = 0
const ass = (athlete_id, completed_date, { status = 'pending', rpe = null, minuti = 60, intensity, testo = '' } = {}) => ({
  id: `aw-${++seme}`,
  athlete_id,
  completed_date,
  status,
  notes: rpe != null ? `[RPE: ${rpe}/10]\n${testo}` : (testo || null),
  voice_note_url: null,
  workouts: { id: `w-${seme}`, title: 'Allenamento', sections: sezioni(minuti, intensity) },
})
const fatto = (id, data, extra = {}) => ass(id, data, { status: 'completed', ...extra })

/** La sonda sta FUORI da <Routes>: così dice la rotta corrente anche quando la
 *  pagina è stata sostituita da un redirect. */
function Sonda() {
  const l = useLocation()
  return <p>rotta:{l.pathname}{l.search}</p>
}

const monta = (role = 'admin') => render(
  <MemoryRouter initialEntries={['/report']}>
    <AuthContext.Provider value={{ user: UTENTE, role }}>
      <Sonda />
      <Routes><Route path="/report" element={<WeeklyReport />} /></Routes>
    </AuthContext.Provider>
  </MemoryRouter>
)

const rotta = () => screen.getByText(/^rotta:/).textContent.replace('rotta:', '')

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(MERCOLEDI)
  finto.chiamate.length = 0
  dati.atleti = []
  dati.assegnazioni = []
  dati.guasti = []
  seme = 0
})
afterEach(() => { vi.useRealTimers() })

// ── La guardia ────────────────────────────────────────────────────────────

describe('Report — solo il coach', () => {
  // 🔴 Il test più importante del file, ed è quello che la richiesta chiedeva:
  // il report è visionabile UNICAMENTE dal coach. La guardia sta in due punti —
  // il redirect e il `return` prima del fetch — e verificare solo il primo
  // lascerebbe passare una versione che rimanda alla Home DOPO aver scaricato
  // le assegnazioni di tutta la squadra sul dispositivo dell'atleta.
  it('rimanda l\'atleta alla Home, e non legge niente', async () => {
    dati.atleti = [atleta('a1', 'Anna')]
    monta('athlete')

    await waitFor(() => expect(rotta()).toBe('/'))
    expect(finto.chiamateA('athlete_workouts')).toHaveLength(0)
    expect(finto.chiamateA('athletes')).toHaveLength(0)
    expect(screen.queryByRole('heading', { name: 'Report' })).not.toBeInTheDocument()
  })

  it('al coach la apre', async () => {
    dati.atleti = [atleta('a1', 'Anna')]
    monta('admin')
    expect(await screen.findByRole('heading', { name: 'Report' })).toBeInTheDocument()
  })

  // L'account del coach è una riga di `athletes` come le altre: se resta dentro
  // compare fra i propri atleti fermi ogni volta che non si allena, e falsa
  // aderenza, carico e copertura. Stesso filtro della Home e della rubrica.
  it('non conta il coach fra i propri atleti', async () => {
    dati.atleti = [atleta('a1', 'Anna'), atleta(COACHING_ID, 'Federico')]
    monta()
    expect(await screen.findByText('1 atleta')).toBeInTheDocument()
    expect(screen.queryByText(/Federico/)).not.toBeInTheDocument()
  })
})

// ── I numeri ──────────────────────────────────────────────────────────────

describe('Report — i numeri della settimana', () => {
  // 🔴 Il lunedì mattina nessuno ha ancora fatto niente e tutti hanno la
  // settimana davanti. Con il denominatore sulla settimana INTERA la pagina
  // direbbe «0%» e marchierebbe tutta la squadra di aderenza bassa: un allarme
  // acceso prima che sia successo qualcosa, che è il modo in cui un allarme
  // smette di essere letto.
  it('il lunedì non accusa nessuno di aderenza bassa', async () => {
    vi.setSystemTime(LUNEDI)
    dati.atleti = [atleta('a1', 'Anna')]
    dati.assegnazioni = [
      // ⚠️ Un allenamento chiuso venerdì scorso, altrimenti Anna sarebbe «da
      // richiamare» per non aver mai chiuso niente — che è un altro verdetto,
      // giusto ma diverso da quello che questo test misura.
      fatto('a1', '2026-08-28', { rpe: 7 }),
      ass('a1', '2026-09-02'), ass('a1', '2026-09-03'),
      ass('a1', '2026-09-04'), ass('a1', '2026-09-05'),
    ]
    const { container } = monta()

    await screen.findByRole('heading', { name: 'Report' })
    expect(container.textContent).toContain('giorno 1 di 7')
    expect(screen.queryByRole('button', { name: /Aderenza bassa/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Anna Rossi: Da iniziare/ })).toBeInTheDocument()
    expect(container.textContent).toContain('4 allenamenti ancora in programma')
  })

  it('l\'aderenza guarda solo i giorni già passati', async () => {
    dati.atleti = [atleta('a1', 'Anna')]
    dati.assegnazioni = [
      fatto('a1', '2026-08-31', { rpe: 7 }), fatto('a1', '2026-09-01', { rpe: 7 }),
      ass('a1', '2026-09-04'), ass('a1', '2026-09-05'),
    ]
    const { container } = monta()

    await screen.findByRole('heading', { name: 'Report' })
    // 2 su 2 fino a oggi, non 2 su 4: gli altri due sono venerdì e sabato.
    expect(container.textContent).toContain('100%')
    expect(container.textContent).toContain('2 di 2')
    expect(screen.getByRole('button', { name: /Anna Rossi: In linea/ })).toBeInTheDocument()
  })

  // 🔴 Senza il `≈` un totale a cui mancano delle sessioni si presenta come
  // completo. È lo stesso glifo del volume nel calendario, per la stessa
  // ragione: un carico incompleto letto come completo fa dosare male la
  // settimana dopo.
  it('dichiara il carico parziale quando qualcuno non ha segnato l\'RPE', async () => {
    dati.atleti = [atleta('a1', 'Anna'), atleta('a2', 'Bruno')]
    dati.assegnazioni = [
      fatto('a1', '2026-09-01', { rpe: 8, minuti: 60 }),
      fatto('a2', '2026-09-01', { minuti: 60 }),
    ]
    monta()

    const cella = (await screen.findByText('Carico')).parentElement
    expect(cella.textContent).toContain('≈480')
    expect(cella.textContent).toContain('1 senza RPE')
  })

  it('non inventa un RPE medio dove nessuno l\'ha dichiarato', async () => {
    dati.atleti = [atleta('a1', 'Anna')]
    dati.assegnazioni = [fatto('a1', '2026-09-01', { minuti: 60 })]
    monta()

    const cella = (await screen.findByText('RPE medio')).parentElement
    // 🔴 «5,0» sarebbe il ripiego di `parseNotesAndRpe` presentato come misura.
    expect(cella.textContent).toContain('—')
    expect(cella.textContent).not.toContain('5')
  })
})

// ── Le azioni ─────────────────────────────────────────────────────────────

describe('Report — cosa fare', () => {
  it('la fascia porta alla lista già filtrata, e ci si torna', async () => {
    const giorniFa = (n) => new Date(MERCOLEDI.getTime() - n * 86400000).toISOString().split('T')[0]
    dati.atleti = [atleta('a1', 'Anna'), atleta('a2', 'Bruno')]
    dati.assegnazioni = [
      fatto('a1', '2026-09-01', { rpe: 6 }),                 // Anna è in linea
      fatto('a2', giorniFa(11), { rpe: 6 }), ass('a2', '2026-09-01'),  // Bruno è sparito
    ]
    monta()

    const fascia = await screen.findByRole('button', { name: /richiede un'azione/ })
    expect(fascia.textContent).toContain('1 da richiamare')
    expect(screen.getByRole('button', { name: /Anna Rossi:/ })).toBeInTheDocument()

    await userEvent.click(fascia)
    // Filtrata: resta solo chi chiede qualcosa.
    expect(screen.getByRole('button', { name: /Bruno Rossi: Da richiamare/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Anna Rossi:/ })).not.toBeInTheDocument()

    await userEvent.click(fascia)
    expect(screen.getByRole('button', { name: /Anna Rossi:/ })).toBeInTheDocument()
  })

  it('quando non c\'è niente da fare lo dichiara invece di lasciare il vuoto', async () => {
    dati.atleti = [atleta('a1', 'Anna')]
    dati.assegnazioni = [fatto('a1', '2026-09-01', { rpe: 6 }), fatto('a1', '2026-09-02', { rpe: 6 })]
    monta()

    expect(await screen.findByText('Niente')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /richiede un'azione/ })).not.toBeInTheDocument()
  })

  // È l'unica sezione del report che guarda avanti, ed è la ragione per cui la
  // pagina è utile anche il lunedì, quando la settimana in corso non ha ancora
  // niente da raccontare.
  it('elenca chi non ha niente in programma la settimana prossima, e ci porta', async () => {
    dati.atleti = [atleta('a1', 'Anna'), atleta('a2', 'Bruno')]
    dati.assegnazioni = [ass('a1', '2026-09-08')]
    monta()

    expect(await screen.findByText('1 atleta senza allenamenti')).toBeInTheDocument()
    // «Assegna» resta sulla scheda: è lì che si assegna.
    await userEvent.click(screen.getByRole('button', { name: 'Programma per Bruno Rossi' }))
    expect(rotta()).toBe('/athletes/a2')
  })

  // ⚠️ Due destinazioni diverse dalla stessa pagina, ed è voluto: la riga è il
  // seguito della domanda «chi guardo per primo» e porta al report DI QUELL'ATLETA;
  // «Assegna» promette un'azione e deve aprire il posto in cui si assegna. Farle
  // coincidere è il modo in cui un bottone smette di mantenere quello che dice.
  it('la riga apre il report di quell\'atleta', async () => {
    dati.atleti = [atleta('a1', 'Anna')]
    dati.assegnazioni = [fatto('a1', '2026-09-01', { rpe: 6 })]
    monta()

    await userEvent.click(await screen.findByRole('button', { name: /Anna Rossi:/ }))
    expect(rotta()).toBe('/report/a1')
  })
})

// ── La navigazione fra settimane ──────────────────────────────────────────

describe('Report — la settimana che si guarda', () => {
  it('non si può andare in una settimana che non è ancora successa', async () => {
    dati.atleti = [atleta('a1', 'Anna')]
    monta()

    await screen.findByRole('heading', { name: 'Report' })
    expect(screen.getByRole('button', { name: 'Settimana successiva' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Settimana precedente' }))
    expect(screen.getByText(/24 – 30 ago/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settimana successiva' })).not.toBeDisabled()
  })

  // Programmare una settimana già passata non è un'azione: la sezione sparisce
  // invece di chiedere al coach una cosa che non si può fare.
  it('su una settimana lontana non chiede di programmare quella dopo', async () => {
    dati.atleti = [atleta('a1', 'Anna')]
    monta()

    await screen.findByRole('heading', { name: 'Report' })
    expect(screen.getByText('Settimana prossima')).toBeInTheDocument()

    const indietro = screen.getByRole('button', { name: 'Settimana precedente' })
    for (let i = 0; i < 3; i++) await userEvent.click(indietro)
    await waitFor(() => expect(screen.queryByText('Settimana prossima')).not.toBeInTheDocument())
  })
})

// ── Il guasto ─────────────────────────────────────────────────────────────

describe('Report — quando la lettura fallisce', () => {
  // 🔴 Senza uno stato suo, una `select` fallita produce zero righe, e zero
  // righe in questa pagina si leggono come «questa settimana non si è allenato
  // nessuno» — un guasto travestito da dato, che è il difetto peggiore
  // possibile per un report su cui si programma.
  it('lo dice, invece di mostrare una settimana vuota', async () => {
    dati.atleti = [atleta('a1', 'Anna')]
    dati.assegnazioni = [fatto('a1', '2026-09-01', { rpe: 7 })]
    dati.guasti = ['athlete_workouts']
    const errori = vi.spyOn(console, 'error').mockImplementation(() => {})
    monta()

    expect(await screen.findByText('Non sono riuscito a leggere la settimana')).toBeInTheDocument()
    expect(screen.queryByText('Aderenza della squadra')).not.toBeInTheDocument()
    expect(errori).toHaveBeenCalled()
    errori.mockRestore()
  })
})
