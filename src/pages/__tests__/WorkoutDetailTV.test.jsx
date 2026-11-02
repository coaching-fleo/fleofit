import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom'

// Perché questo test esiste
// ──────────────────────────
// Il 30/10/2026 la finestra «Trasmetti in TV» è diventata un foglio dal basso
// (`FoglioCollegaTV`). Prima, scritto il codice, bisognava toccare «Trasmetti
// ora»: ma la finestra saliva col fuoco del campo e, chiusa la tastiera, il
// bottone scappava da sotto il dito («a volte non parte»). Ora alla quarta
// cifra si collega da solo, e a collegamento riuscito si apre il telecomando.
// Nell'app nativa c'è in più «Inquadra il QR» (spec: docs/superpowers/specs/
// 2026-10-30-tv-qr-design.md, §1).

// La scheda si può cambiare per test: Hyrox (col timer guidato) o Running (senza).
const HYROX = { category: 'Hyrox', blocks: [{ id: 1, type: 'AMRAP', params: { duration: '12:00' }, exercises: [{ name: 'Burpees' }] }] }
const RUNNING = { category: 'Running', steps: [{ id: 1, type: 'run', duration: '5 km', pace: 'Z2' }] }
const scheda = await vi.hoisted(async () => ({ sections: null }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    workouts: [{
      id: 'w1', title: 'Scheda di prova', date: '2026-08-26', coach_notes: '',
      sections: scheda.sections,
    }],
    athlete_workouts: [{ id: 'aw1', athlete_id: 'u1', workout_id: 'w1', completed_date: '2026-08-26', status: 'pending', notes: null }],
    athletes: [{ id: 'u1', name: 'Marco', surname: 'R' }],
  }))
})

// `fintoSupabase` non filtra per `.eq()`: per `tv_sessions` serve una catena che
// lo faccia, perché qui conta proprio la differenza fra un codice che esiste
// (4321) e uno che non esiste (9999).
const tv = await vi.hoisted(async () => {
  // `cancello`: una promise che trattiene le risposte di `tv_sessions`, per
  // tenere un collegamento «in corso» mentre arriva un secondo evento.
  const stato = { aggiornamenti: [], cancello: null }
  const SESSIONI = [{ code: '4321', workout_id: null, athlete_id: null }]
  const catena = () => {
    const q = { update: null, codice: null, singolo: false }
    const proxy = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') {
          let risultato
          if (q.update) {
            stato.aggiornamenti.push({ ...q.update, code: q.codice })
            risultato = { data: null, error: null }
          } else {
            const righe = SESSIONI.filter(s => s.code === q.codice)
            risultato = q.singolo
              ? (righe[0] ? { data: righe[0], error: null } : { data: null, error: { message: 'nessuna riga' } })
              : { data: righe, error: null }
          }
          return (ok, ko) => Promise.resolve(stato.cancello).then(() => risultato).then(ok, ko)
        }
        return (...args) => {
          if (prop === 'update') q.update = args[0]
          if (prop === 'eq' && args[0] === 'code') q.codice = args[1]
          if (prop === 'single' || prop === 'maybeSingle') q.singolo = true
          return proxy
        }
      },
    })
    return proxy
  }
  return { stato, catena }
})

const qr = await vi.hoisted(async () => {
  return {
    qrDisponibile: vi.fn(() => false),
    leggiQR: vi.fn(),
    apriImpostazioni: vi.fn(() => Promise.resolve()),
  }
})

vi.mock('../../supabaseClient', () => {
  const daFinto = finto.supabase.from
  return { supabase: { ...finto.supabase, from: vi.fn(t => (t === 'tv_sessions' ? tv.catena() : daFinto(t))) } }
})
vi.mock('../../lib/lettoreQR', () => qr)
// Chi costruisce la sequenza del timer è l'unico passaggio di «il timer si apre»:
// lo si spia per dire che NON si è aperto (su una corsa non si vede niente comunque).
const sequenza = await vi.hoisted(async () => ({ costruita: 0 }))
vi.mock('../../lib/timerSequence', async (importOriginal) => {
  const vero = await importOriginal()
  return { ...vero, buildTimerSequence: (w) => { sequenza.costruita++; return vero.buildTimerSequence(w) } }
})
// jspdf e html-to-image servono solo all'export: non vanno caricate per davvero.
vi.mock('jspdf', () => ({ default: class {}, jsPDF: class {} }))
vi.mock('html-to-image', () => ({ toPng: vi.fn(), toBlob: vi.fn() }))
vi.mock('@capacitor/network', () => ({ Network: {
  getStatus: vi.fn(() => Promise.resolve({ connected: true })),
  addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
} }))

const { supabase } = await import('../../supabaseClient')
const { AuthContext } = await import('../../App')
const WorkoutDetail = (await import('../WorkoutDetail')).default
const { rottaDaLinkTV } = await import('../../lib/linkTimer')

function apriScheda() {
  return render(
    <MemoryRouter initialEntries={['/workout/w1?athlete_id=u1']}>
      <AuthContext.Provider value={{ user: { id: 'u1', email: 'a@b.it', user_metadata: {} }, role: 'athlete' }}>
        <Routes><Route path="/workout/:id" element={<WorkoutDetail />} /></Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

// L'indirizzo corrente, per vedere che `tv` sparisce (e `athlete_id` resta),
// più `navigate` per fare da DeeplinkHandler (il QR inquadrato a scheda aperta).
const indirizzo = { search: '', pathname: '', vai: null }
function Indirizzo() {
  const l = useLocation()
  indirizzo.search = l.search
  indirizzo.pathname = l.pathname
  indirizzo.vai = useNavigate()
  return null
}
// Come SchedaWorkout in App.jsx: la chiave è il solo id, quindi cambiare la
// query (o aggiungere `tv`) non rimonta la scheda.
function SchedaPerId() {
  const { id } = useParams()
  return <WorkoutDetail key={id} />
}

// La scheda aperta da un link con `?tv=` (spec 2026-11-02-tv-qr-scelta-workout, §4).
function apriConTV(query, { strict = false } = {}) {
  const albero = (
    <MemoryRouter initialEntries={[`/workout/w1?${query}`]}>
      <AuthContext.Provider value={{ user: { id: 'u1', email: 'a@b.it', user_metadata: {} }, role: 'athlete' }}>
        <Routes>
          <Route path="/workout/:id" element={<><SchedaPerId /><Indirizzo /></>} />
          <Route path="/collega-tv/:codice" element={<Indirizzo />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{albero}</StrictMode> : albero)
}

const chiamateTV = () => supabase.from.mock.calls.filter(([t]) => t === 'tv_sessions').length

async function apriFoglioTV() {
  apriScheda()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Scheda di prova' })).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: /^TV$/ }))
  return screen.getByRole('dialog', { name: /Trasmetti in TV/i })
}

const campoCodice = (foglio) => within(foglio).getByLabelText(/Codice della TV/i)

beforeEach(() => {
  scheda.sections = HYROX
  sequenza.costruita = 0
  tv.stato.aggiornamenti.length = 0
  tv.stato.cancello = null
  qr.qrDisponibile.mockImplementation(() => false)
  qr.leggiQR.mockReset()
  qr.apriImpostazioni.mockImplementation(() => Promise.resolve())
  supabase.from.mockClear()
  localStorage.removeItem('fleofit_tv_code')
  indirizzo.search = ''
  indirizzo.pathname = ''
  indirizzo.vai = null
})

describe('collegare la TV dal web', () => {
  it('apre subito il campo del codice, senza la scelta del QR', async () => {
    const foglio = await apriFoglioTV()
    expect(campoCodice(foglio)).toBeInTheDocument()
    expect(within(foglio).queryByRole('button', { name: /Inquadra il QR/i })).not.toBeInTheDocument()
  })

  it('alla quarta cifra si collega da solo e apre il telecomando', async () => {
    const foglio = await apriFoglioTV()
    await userEvent.type(campoCodice(foglio), '4321')

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Trasmetti in TV/i })).not.toBeInTheDocument())
    expect(tv.stato.aggiornamenti).toHaveLength(1)
    expect(tv.stato.aggiornamenti[0]).toMatchObject({ code: '4321', workout_id: 'w1', athlete_id: 'u1' })
    expect(localStorage.getItem('fleofit_tv_code')).toBe('4321')
    expect(await screen.findAllByRole('button', { name: 'Avvia il timer' })).not.toHaveLength(0)
    expect(screen.queryByText('Connesso!')).not.toBeInTheDocument()
  })

  it('un codice che non esiste lascia il foglio, svuota il campo e lo dice sotto', async () => {
    const foglio = await apriFoglioTV()
    await userEvent.type(campoCodice(foglio), '9999')

    expect(await within(foglio).findByText('Codice TV non trovato o scaduto.')).toBeInTheDocument()
    expect(campoCodice(foglio)).toHaveValue('')
    expect(screen.getByRole('dialog', { name: /Trasmetti in TV/i })).toBeInTheDocument()
    expect(tv.stato.aggiornamenti).toHaveLength(0)
    // Niente alert: il messaggio sta sotto il campo, non in una finestra sopra.
    expect(screen.queryByRole('heading', { name: 'Errore' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Avvia il timer' })).not.toBeInTheDocument()
  })

  it('incollando il codice due volte (e premendo Invio) si collega una volta sola', async () => {
    const foglio = await apriFoglioTV()
    const campo = campoCodice(foglio)
    // Il collegamento resta in corso finché non si apre il cancello: l'Invio
    // arriva mentre il primo è ancora per strada, come su un telefono vero.
    let apri
    tv.stato.cancello = new Promise(r => { apri = r })
    campo.focus()
    await userEvent.paste('43214321')
    expect(campo).toHaveValue('4321')
    expect(within(foglio).getByText('Collegamento…')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    apri()

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Trasmetti in TV/i })).not.toBeInTheDocument())
    expect(tv.stato.aggiornamenti).toHaveLength(1)
  })
})

describe('collegare la TV dall app, con il QR', () => {
  beforeEach(() => { qr.qrDisponibile.mockImplementation(() => true) })

  it('offre le due strade', async () => {
    const foglio = await apriFoglioTV()
    expect(within(foglio).getByRole('button', { name: /Inquadra il QR/i })).toBeInTheDocument()
    expect(within(foglio).getByRole('button', { name: /Inserisci il codice/i })).toBeInTheDocument()
    expect(within(foglio).queryByLabelText(/Codice della TV/i)).not.toBeInTheDocument()

    await userEvent.click(within(foglio).getByRole('button', { name: /Inserisci il codice/i }))
    expect(campoCodice(foglio)).toBeInTheDocument()
  })

  it('un QR della TV collega e apre il telecomando', async () => {
    qr.leggiQR.mockResolvedValue({ valore: 'fleofit://tv/4321' })
    const foglio = await apriFoglioTV()
    await userEvent.click(within(foglio).getByRole('button', { name: /Inquadra il QR/i }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Trasmetti in TV/i })).not.toBeInTheDocument())
    expect(tv.stato.aggiornamenti).toHaveLength(1)
    expect(tv.stato.aggiornamenti[0]).toMatchObject({ code: '4321', workout_id: 'w1' })
    expect(await screen.findAllByRole('button', { name: 'Avvia il timer' })).not.toHaveLength(0)
  })

  it('un QR estraneo lo dice, e si può riprovare o passare al codice', async () => {
    qr.leggiQR.mockResolvedValue({ valore: 'https://x.it' })
    const foglio = await apriFoglioTV()
    await userEvent.click(within(foglio).getByRole('button', { name: /Inquadra il QR/i }))

    expect(await within(foglio).findByText('Questo non è il codice della TV FLEOFIT')).toBeInTheDocument()
    expect(within(foglio).getByRole('button', { name: /Inquadra il QR/i })).toBeInTheDocument()
    expect(within(foglio).getByRole('button', { name: /Inserisci il codice/i })).toBeInTheDocument()
    expect(tv.stato.aggiornamenti).toHaveLength(0)
  })

  it('senza permesso della fotocamera offre Impostazioni e il codice', async () => {
    qr.leggiQR.mockRejectedValue(Object.assign(new Error('Permesso fotocamera negato'), { code: 'permesso' }))
    const foglio = await apriFoglioTV()
    await userEvent.click(within(foglio).getByRole('button', { name: /Inquadra il QR/i }))

    const impostazioni = await within(foglio).findByRole('button', { name: /Apri Impostazioni/i })
    await userEvent.click(impostazioni)
    expect(qr.apriImpostazioni).toHaveBeenCalledTimes(1)

    await userEvent.click(within(foglio).getByRole('button', { name: /Inserisci il codice/i }))
    expect(campoCodice(foglio)).toBeInTheDocument()
  })

  it('annullare la fotocamera riporta alla scelta, senza messaggi', async () => {
    qr.leggiQR.mockResolvedValue({ annullato: true })
    const foglio = await apriFoglioTV()
    await userEvent.click(within(foglio).getByRole('button', { name: /Inquadra il QR/i }))

    await waitFor(() => expect(qr.leggiQR).toHaveBeenCalledTimes(1))
    expect(await within(foglio).findByRole('button', { name: /Inquadra il QR/i })).toBeEnabled()
    expect(within(foglio).getByRole('button', { name: /Inserisci il codice/i })).toBeInTheDocument()
    expect(within(foglio).queryByText('Questo non è il codice della TV FLEOFIT')).not.toBeInTheDocument()
    expect(within(foglio).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('se lo scanner non parte, si passa al codice con un messaggio breve', async () => {
    qr.leggiQR.mockRejectedValue(Object.assign(new Error('x'), { code: 'non_disponibile' }))
    const foglio = await apriFoglioTV()
    await userEvent.click(within(foglio).getByRole('button', { name: /Inquadra il QR/i }))

    expect(await within(foglio).findByLabelText(/Codice della TV/i)).toBeInTheDocument()
    expect(within(foglio).getByRole('alert')).toHaveTextContent(/fotocamera/i)
  })
})

describe('dopo il collegamento', () => {
  it('una corsa (senza timer guidato) si collega, il foglio si chiude e nessun timer si apre', async () => {
    scheda.sections = RUNNING
    const foglio = await apriFoglioTV()
    await userEvent.type(campoCodice(foglio), '4321')

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Trasmetti in TV/i })).not.toBeInTheDocument())
    expect(tv.stato.aggiornamenti).toHaveLength(1)
    expect(localStorage.getItem('fleofit_tv_code')).toBe('4321')
    expect(sequenza.costruita).toBe(0)
    expect(screen.queryByRole('button', { name: 'Avvia il timer' })).not.toBeInTheDocument()
  })

  // apriTimer() su un timer già aperto a tutto schermo lo RIMPICCIOLIREBBE: il
  // ramo «già aperto → a tutto schermo» esiste per questo.
  it('con il timer già aperto resta (o torna) a tutto schermo', async () => {
    apriScheda()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Scheda di prova' })).toBeInTheDocument())
    // Apre il timer dalla barra in basso («Come stai oggi?» si salta).
    await userEvent.click(screen.getByRole('button', { name: /Avvia allenamento/i }))
    const salta = screen.queryByRole('button', { name: 'Salta' })
    if (salta) await userEvent.click(salta)
    expect(await screen.findByRole('button', { name: /Minimizza timer/i })).toBeInTheDocument()
    expect(sequenza.costruita).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: /^TV$/ }))
    const foglio = screen.getByRole('dialog', { name: /Trasmetti in TV/i })
    await userEvent.type(campoCodice(foglio), '4321')

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Trasmetti in TV/i })).not.toBeInTheDocument())
    // A tutto schermo: la barra offre di nuovo di rimpicciolirlo, ora col nome del telecomando.
    expect(await screen.findByRole('button', { name: /Minimizza telecomando/i })).toBeInTheDocument()
    expect(sequenza.costruita).toBe(1)
  })

  it('chiuso il foglio durante «Collegamento…», il collegamento non apre il timer né chiude il foglio riaperto', async () => {
    const foglio = await apriFoglioTV()
    let apri
    tv.stato.cancello = new Promise(r => { apri = r })
    await userEvent.type(campoCodice(foglio), '4321')
    expect(within(foglio).getByText('Collegamento…')).toBeInTheDocument()

    // Chiude con la X e lo riapre mentre il primo collegamento è per strada.
    await userEvent.click(within(foglio).getByRole('button', { name: 'Chiudi' }))
    expect(screen.queryByRole('dialog', { name: /Trasmetti in TV/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^TV$/ }))
    expect(screen.getByRole('dialog', { name: /Trasmetti in TV/i })).toBeInTheDocument()

    apri()
    // Il collegamento al database si completa lo stesso…
    await waitFor(() => expect(tv.stato.aggiornamenti).toHaveLength(1))
    await waitFor(() => expect(localStorage.getItem('fleofit_tv_code')).toBe('4321'))
    // …ma l'interfaccia non salta: il foglio riaperto resta, nessun timer.
    expect(screen.getByRole('dialog', { name: /Trasmetti in TV/i })).toBeInTheDocument()
    expect(sequenza.costruita).toBe(0)
    expect(screen.queryByRole('button', { name: 'Avvia il timer' })).not.toBeInTheDocument()
  })
})

describe('dal link con ?tv= (il QR della TV letto fuori dalla scheda)', () => {
  it('si collega da solo, toglie tv dall indirizzo e apre il telecomando', async () => {
    apriConTV('athlete_id=u1&tv=4321')

    await waitFor(() => expect(tv.stato.aggiornamenti).toHaveLength(1))
    expect(tv.stato.aggiornamenti[0]).toMatchObject({ code: '4321', workout_id: 'w1', athlete_id: 'u1' })
    await waitFor(() => expect(indirizzo.search).not.toMatch(/tv=/))
    expect(indirizzo.search).toMatch(/athlete_id=u1/)
    expect(await screen.findAllByRole('button', { name: 'Avvia il timer' })).not.toHaveLength(0)
    expect(screen.queryByText('Connesso!')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Trasmetti in TV/i })).not.toBeInTheDocument()
  })

  it('un codice che non esiste apre il foglio con il messaggio, senza timer', async () => {
    apriConTV('tv=9999')

    const foglio = await screen.findByRole('dialog', { name: /Trasmetti in TV/i })
    expect(within(foglio).getByText('Codice TV non trovato o scaduto.')).toBeInTheDocument()
    expect(campoCodice(foglio)).toBeInTheDocument()
    await waitFor(() => expect(indirizzo.search).not.toMatch(/tv=/))
    expect(tv.stato.aggiornamenti).toHaveLength(0)
    expect(sequenza.costruita).toBe(0)
    expect(screen.queryByRole('button', { name: 'Avvia il timer' })).not.toBeInTheDocument()
  })

  it('nell app (col QR) il codice sbagliato apre sul campo, non sulla scelta', async () => {
    qr.qrDisponibile.mockImplementation(() => true)
    apriConTV('tv=9999')

    const foglio = await screen.findByRole('dialog', { name: /Trasmetti in TV/i })
    expect(within(foglio).getByRole('alert')).toHaveTextContent('Codice TV non trovato o scaduto.')
    expect(campoCodice(foglio)).toBeInTheDocument()
  })

  it('una corsa si collega, ma nessun timer si apre', async () => {
    scheda.sections = RUNNING
    apriConTV('tv=4321')

    await waitFor(() => expect(tv.stato.aggiornamenti).toHaveLength(1))
    await waitFor(() => expect(localStorage.getItem('fleofit_tv_code')).toBe('4321'))
    expect(sequenza.costruita).toBe(0)
    expect(screen.queryByRole('button', { name: 'Avvia il timer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Trasmetti in TV/i })).not.toBeInTheDocument()
  })

  it('un codice che non è di quattro cifre si ignora', async () => {
    apriConTV('tv=12a')

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Scheda di prova' })).toBeInTheDocument())
    // Un giro in più, per dare all'effetto il tempo di (non) partire.
    await new Promise(r => setTimeout(r, 50))
    expect(chiamateTV()).toBe(0)
    expect(screen.queryByRole('dialog', { name: /Trasmetti in TV/i })).not.toBeInTheDocument()
  })

  // Fissa la promessa «un collegamento solo», non la guardia `tvDaLinkTentato`:
  // l'effetto toglie `tv` dall'indirizzo e StrictMode non lo ripete, quindi il
  // test passa anche senza la guardia. La guardia resta come difesa (ruling 4).
  it('in StrictMode si collega una volta sola', async () => {
    apriConTV('tv=4321', { strict: true })

    await waitFor(() => expect(tv.stato.aggiornamenti).toHaveLength(1))
    await waitFor(() => expect(indirizzo.search).not.toMatch(/tv=/))
    await new Promise(r => setTimeout(r, 50))
    expect(tv.stato.aggiornamenti).toHaveLength(1)
  })
})

// Il QR inquadrato con la fotocamera di sistema mentre la scheda è aperta
// (ruling 7): DeeplinkHandler resta sulla scheda con `?tv=<c>&chiedi=1` e la
// scheda chiede prima di collegare. Uscire verso /collega-tv la smontava, e un
// timer in corso ripartiva da zero.
describe('dal link con ?tv=…&chiedi=1 (il QR inquadrato a scheda aperta)', () => {
  const domanda = () => screen.findByRole('dialog', { name: 'Vuoi mandare in TV questo?' })

  it('chiede, col titolo della scheda, e non collega niente prima del «Sì»', async () => {
    apriConTV('athlete_id=u1&tv=4321&chiedi=1')
    const foglio = await domanda()
    expect(within(foglio).getByText('Scheda di prova')).toBeInTheDocument()
    await waitFor(() => expect(indirizzo.search).not.toMatch(/tv=|chiedi=/))
    expect(indirizzo.search).toMatch(/athlete_id=u1/)
    await new Promise(r => setTimeout(r, 50))
    expect(chiamateTV()).toBe(0)
    expect(sequenza.costruita).toBe(0)
  })

  it('«Sì» collega e apre il telecomando', async () => {
    apriConTV('athlete_id=u1&tv=4321&chiedi=1')
    await userEvent.click(within(await domanda()).getByRole('button', { name: 'Sì' }))

    await waitFor(() => expect(tv.stato.aggiornamenti).toHaveLength(1))
    expect(tv.stato.aggiornamenti[0]).toMatchObject({ code: '4321', workout_id: 'w1', athlete_id: 'u1' })
    expect(await screen.findAllByRole('button', { name: 'Avvia il timer' })).not.toHaveLength(0)
    expect(screen.queryByRole('dialog', { name: 'Vuoi mandare in TV questo?' })).not.toBeInTheDocument()
  })

  it('«Sì» con un codice che non esiste apre «Collega TV» con il messaggio', async () => {
    apriConTV('tv=9999&chiedi=1')
    await userEvent.click(within(await domanda()).getByRole('button', { name: 'Sì' }))

    const foglio = await screen.findByRole('dialog', { name: /Trasmetti in TV/i })
    expect(within(foglio).getByText('Codice TV non trovato o scaduto.')).toBeInTheDocument()
    expect(sequenza.costruita).toBe(0)
  })

  it('«No, un altro» porta alla scelta, con la lista', async () => {
    apriConTV('athlete_id=u1&tv=4321&chiedi=1')
    await userEvent.click(within(await domanda()).getByRole('button', { name: 'No, un altro' }))

    await waitFor(() => expect(indirizzo.pathname).toBe('/collega-tv/4321'))
    expect(indirizzo.search).toBe('?altro=1')
    expect(chiamateTV()).toBe(0)
  })

  it('la X chiude e basta', async () => {
    apriConTV('tv=4321&chiedi=1')
    await userEvent.click(within(await domanda()).getByRole('button', { name: 'Chiudi' }))

    expect(screen.queryByRole('dialog', { name: 'Vuoi mandare in TV questo?' })).not.toBeInTheDocument()
    expect(indirizzo.pathname).toBe('/workout/w1')
    expect(chiamateTV()).toBe(0)
  })

  it('lo stesso QR inquadrato una seconda volta richiede di nuovo', async () => {
    apriConTV('tv=4321&chiedi=1')
    await userEvent.click(within(await domanda()).getByRole('button', { name: 'Chiudi' }))
    await waitFor(() => expect(indirizzo.search).not.toMatch(/tv=/))

    const rotta = rottaDaLinkTV('fleofit://tv/4321', { pathname: indirizzo.pathname, search: indirizzo.search })
    act(() => indirizzo.vai(rotta, { replace: true }))
    expect(await domanda()).toBeInTheDocument()
  })

  it('con il timer in corso il timer resta lì: niente rimontaggio, e «Sì» lo porta a tutto schermo', async () => {
    apriConTV('athlete_id=u1')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Scheda di prova' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Avvia allenamento/i }))
    const salta = screen.queryByRole('button', { name: 'Salta' })
    if (salta) await userEvent.click(salta)
    expect(await screen.findByRole('button', { name: /Minimizza timer/i })).toBeInTheDocument()
    expect(sequenza.costruita).toBe(1)

    // Quello che fa DeeplinkHandler col QR inquadrato.
    const rotta = rottaDaLinkTV('fleofit://tv/4321', { pathname: indirizzo.pathname, search: indirizzo.search })
    act(() => indirizzo.vai(rotta, { replace: true }))

    const foglio = await domanda()
    // Il timer è ancora quello di prima: non ricostruito, ancora aperto.
    expect(screen.getByRole('button', { name: /Minimizza timer/i })).toBeInTheDocument()
    expect(sequenza.costruita).toBe(1)

    await userEvent.click(within(foglio).getByRole('button', { name: 'Sì' }))
    await waitFor(() => expect(tv.stato.aggiornamenti).toHaveLength(1))
    expect(await screen.findByRole('button', { name: /Minimizza telecomando/i })).toBeInTheDocument()
    expect(sequenza.costruita).toBe(1)
  })
})
