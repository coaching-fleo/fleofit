import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'
import { formatNotePausa } from '../../lib/pausa'

// Perché questi test esistono
// ────────────────────────────
// La logica dei numeri è coperta da src/lib/__tests__/statisticheCoach.test.js.
// Qui si verifica l'altra metà, quella che i test unitari non vedono: che
// Home.jsx passi al ramo coach i dati GIUSTI, e che le cose uscite dalla
// pagina il 27/08/2026 restino fuori.
//
// La rimozione è la parte fragile. «Calendario» e «Atleti» sono uscite dalla
// Home coach perché sono già due voci della navbar (corollario della Regola
// dell'Eroe Unico): senza un test, la prima persona che vuole "rendere più
// comodo" raggiungere gli atleti le rimette, e nessuno se ne accorge.
//
// ⚠️ L'eroe è cambiato: era «richiedono attenzione», dal 27/08/2026 sono i
// feedback. Chi è fermo resta in pagina, più in basso, e i test su di lui
// restano — è il dato, non la posizione, a dover sopravvivere.

const OGGI = new Date()
const giorno = (scarto) => new Date(OGGI.getTime() + scarto * 86400000).toISOString().split('T')[0]

const ctrl = await vi.hoisted(async () => ({ atleti: { valore: [] }, assegnazioni: { valore: [] } }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: ctrl.atleti.valore,
    athlete_workouts: ctrl.assegnazioni.valore,
    workouts: [{ id: 'w1' }, { id: 'w2' }],
    notifications: [],
  }))
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: true })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))

const Home = (await import('../Home')).default

const atleta = (id, name) => ({ id, name, surname: 'Rossi', photo_url: null })
const riga = (id, athlete_id, scarto, extra = {}) => ({
  id, athlete_id, completed_date: giorno(scarto), status: 'pending',
  notes: null, voice_note_url: null,
  athletes: { id: athlete_id, name: nomeDi(athlete_id), surname: 'Rossi', photo_url: null },
  workouts: { id: `w-${id}`, title: `Scheda ${id}`, sections: { category: 'Hyrox' } },
  ...extra,
})
const fatta = (id, athlete_id, scarto, extra = {}) => riga(id, athlete_id, scarto, { status: 'completed', ...extra })
/** Il nome dell'atleta nella rubrica corrente, così il join non contraddice la lista. */
const nomeDi = (id) => ctrl.atleti.valore.find(a => a.id === id)?.name || 'Nome'

const montaCoach = () => montaPagina(<Home />, { role: 'coach' })
const attendi = (testo) => waitFor(() => expect(screen.getByText(testo)).toBeInTheDocument())

beforeEach(() => {
  window.localStorage.clear()
  ctrl.atleti.valore = [atleta('a1', 'Luca'), atleta('a2', 'Giulia'), atleta('a3', 'Marco')]
  ctrl.assegnazioni.valore = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('L\'eroe: il feedback in entrata', () => {
  it('porta la citazione dell\'atleta, non solo un contatore', () => {
    // Il numero da solo obbliga ad aprire quattro schermate per sapere se una
    // delle quattro era urgente. La citazione è metà del valore della card.
    ctrl.assegnazioni.valore = [fatta('f1', 'a1', -1, { notes: '[RPE: 9/10]\nGambe pesanti' })]
    montaCoach()
    return waitFor(() => {
      expect(screen.getByText('«Gambe pesanti»')).toBeInTheDocument()
      expect(screen.getByText('RPE 9')).toBeInTheDocument()
      expect(screen.getByText('ieri')).toBeInTheDocument()
    })
  })

  it('il numero grande è il numero di righe da leggere, non la somma di vocali e note', async () => {
    // Una riga con vocale E nota vale due nei conteggi di composizione, ma
    // resta UNA cosa da leggere: se l'eroe dicesse «2 da leggere» sopra una
    // riga sola, il coach cercherebbe una riga che non esiste.
    ctrl.assegnazioni.valore = [
      fatta('f1', 'a1', -1, { notes: '[RPE: 8/10]\nok', voice_note_url: 'https://x/n.m4a' }),
    ]
    montaCoach()
    await attendi('Feedback nuovi')
    expect(screen.getByRole('heading', { level: 2 }).textContent.replace(/\s+/g, ' ')).toBe('1 da leggere')
  })

  it('aprire un feedback segna letto SOLO quello', async () => {
    // Prima il gesto era «apro la lista, li leggo tutti», perché la lista era
    // chiusa. Ora le citazioni sono in pagina: azzerare tutto al primo tocco
    // cancellerebbe feedback che il coach non ha ancora guardato.
    ctrl.assegnazioni.valore = [
      fatta('f1', 'a1', -1, { voice_note_url: 'https://x/nota.m4a' }),
      fatta('f2', 'a2', -2, { notes: '[RPE: 8/10]\nfaticoso' }),
    ]
    montaCoach()
    const primo = await screen.findByLabelText('Leggi il feedback di Luca Rossi')
    await userEvent.click(primo)
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('fleofit_feedback_visti_u1'))).toEqual(['f1']))
  })

  it('una nota vocale cancellata non gonfia l\'eroe', async () => {
    ctrl.assegnazioni.valore = [fatta('f1', 'a1', -1, { voice_note_url: 'https://x/nota.m4a#deleted=1' })]
    montaCoach()
    await attendi('Hai letto tutto quello che gli atleti ti hanno scritto.')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Nessuno')
  })

  it('oltre tre citazioni le altre si chiedono, non si srotolano', async () => {
    ctrl.assegnazioni.valore = ['f1', 'f2', 'f3', 'f4'].map((id, i) =>
      fatta(id, 'a1', -i, { notes: `[RPE: 7/10]\nnota ${id}` }))
    montaCoach()
    await attendi('+1 altro feedback')
    // ⚠️ Il numero grande conta TUTTO l'arretrato, non le righe stampate: è la
    // differenza fra «hai quattro cose da leggere» e «te ne mostro tre».
    expect(screen.getByRole('heading', { level: 2 }).textContent.replace(/\s+/g, ' ')).toBe('4 da leggere')
    expect(screen.queryByText('«nota f4»')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('+1 altro feedback'))
    expect(screen.getByText('«nota f4»')).toBeInTheDocument()
  })
})

describe('La squadra della giornata', () => {
  it('conta i completati sugli assegnati di oggi, non su tutta la rubrica', async () => {
    ctrl.assegnazioni.valore = [fatta('t1', 'a1', 0), riga('t2', 'a2', 0), fatta('t3', 'a3', -1)]
    montaCoach()
    await attendi('Attività di oggi')
    // «1/2»: Marco si è allenato ieri, oggi non era programmato.
    expect(screen.getByText('/2')).toBeInTheDocument()
    expect(screen.getByText('completati')).toBeInTheDocument()
  })

  it('la stessa card guarda ieri, su richiesta', async () => {
    ctrl.assegnazioni.valore = [fatta('t1', 'a1', 0), fatta('t3', 'a3', -1)]
    montaCoach()
    await attendi('Attività di oggi')
    await userEvent.click(screen.getByRole('button', { name: 'Ieri' }))
    expect(screen.getByText('Attività di ieri')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Marco:/ })).toBeInTheDocument()
  })

  it('la media RPE non inventa un 5 per chi non l\'ha dichiarato', async () => {
    ctrl.assegnazioni.valore = [fatta('t1', 'a1', 0, { notes: 'solo testo' })]
    montaCoach()
    await attendi('Nessun RPE dichiarato')
  })

  it('senza assegnazioni lo dice, invece di mostrare una card vuota', async () => {
    montaCoach()
    await attendi('Nessun allenamento assegnato')
  })
})

describe('Chi richiede attenzione', () => {
  it('elenca gli atleti fermi con i giorni e l\'ultimo allenamento', async () => {
    ctrl.assegnazioni.valore = [
      fatta('x1', 'a1', -9),
      fatta('x2', 'a2', -6),
      fatta('x3', 'a3', -1),          // si è allenato ieri: non richiede attenzione
    ]
    montaCoach()
    await attendi('Richiedono attenzione')
    expect(screen.getByLabelText('Apri la scheda di Luca Rossi')).toHaveTextContent('9')
    expect(screen.getByLabelText('Apri la scheda di Giulia Rossi')).toHaveTextContent('6')
    expect(screen.queryByLabelText('Apri la scheda di Marco Rossi')).not.toBeInTheDocument()
    expect(screen.getAllByText(/^ultimo /)).toHaveLength(2)
  })

  it('chi non ha nessun allenamento nella finestra non riceve una data inventata', async () => {
    // «45 giorni» tondi tondi e una data precisa sarebbero due numeri falsi.
    ctrl.atleti.valore = [atleta('a1', 'Luca')]
    montaCoach()
    await attendi('Richiedono attenzione')
    expect(screen.getByText('mai, di recente')).toBeInTheDocument()
    expect(screen.getByLabelText('Apri la scheda di Luca Rossi')).toHaveTextContent('45+')
  })

  it('quando nessuno è fermo lo dice, invece di mostrare una sezione vuota', async () => {
    ctrl.assegnazioni.valore = ctrl.atleti.valore.map((a, i) => fatta(`x${i}`, a.id, -1))
    montaCoach()
    await attendi(/Tutti e 3 gli atleti si sono allenati/)
    expect(screen.getByRole('heading', { level: 3, name: 'Nessuno' })).toBeInTheDocument()
  })

  it('l\'account del coach non finisce fra gli atleti da chiamare', async () => {
    // È una riga di `athletes` come le altre: se resta dentro, il coach compare
    // fra i propri atleti fermi ogni volta che non si allena, e falsa il totale.
    const { COACHING_ID } = await import('../../lib/constants')
    ctrl.atleti.valore = [...ctrl.atleti.valore, { id: COACHING_ID, name: 'Federico', surname: 'Leo', photo_url: null }]
    ctrl.assegnazioni.valore = ctrl.atleti.valore.map((a, i) => fatta(`x${i}`, a.id, -1))
    montaCoach()
    await attendi(/Tutti e 3 gli atleti/)
  })
})

describe('Gli atleti in pausa', () => {
  // Restano nella rubrica ma escono dalla Home: è la richiesta del committente
  // («mi hanno detto che vogliono essere messi in pausa, ma voglio continuare a
  // tenerli nella lista atleti»). Vedi CLAUDE.md §9-decies.
  const conPausa = (a) => ({ ...a, notes: formatNotePausa('2026-08-20', 'Ha chiesto una sosta') })

  beforeEach(() => {
    ctrl.atleti.valore = [conPausa(atleta('a1', 'Luca')), atleta('a2', 'Giulia'), atleta('a3', 'Marco')]
  })

  it('non compaiono fra chi richiede attenzione, per quanto fermi siano', async () => {
    ctrl.assegnazioni.valore = [fatta('x2', 'a2', -8), fatta('x3', 'a3', -1)]
    montaCoach()
    await attendi('Richiedono attenzione')
    expect(screen.queryByLabelText(/Luca Rossi/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Apri la scheda di Giulia Rossi')).toHaveTextContent('8')
  })

  it('l\'header dice quanti sono in pausa, altrimenti i numeri sotto sembrano sbagliati', async () => {
    montaCoach()
    await attendi('Richiedono attenzione')
    expect(screen.getByText(/1 in pausa/)).toBeInTheDocument()
    expect(screen.getByText(/3 atleti/)).toBeInTheDocument()
  })

  it('la query degli atleti si porta `notes`, dove vive la pausa', async () => {
    // ⚠️ Test sulla FORMA della query, che di solito è fragile — qui è
    // l'unico modo. `fintoSupabase` restituisce le righe della fixture
    // qualunque `select` riceva, quindi togliere `notes` dalla query non fa
    // fallire nessun altro test: in produzione spegnerebbe TUTTE le pause,
    // in silenzio, e l'unico sintomo sarebbe un atleta che ricompare.
    montaCoach()
    await attendi('Richiedono attenzione')
    const select = finto.chiamateA('athletes', 'select').map(c => String(c.args[0]))
    expect(select.some(s => s.includes('notes'))).toBe(true)
  })

  it('escono dal totale della copertura invece di contare come «senza allenamento»', async () => {
    ctrl.assegnazioni.valore = [riga('p1', 'a2', 0)]
    montaCoach()
    await attendi('Copertura 3 gg')
    expect(screen.getByText('1 atleta senza allenamento')).toBeInTheDocument()
    // Il denominatore racconta gli atleti che il coach sta seguendo: due, non tre.
    expect(screen.getByText('/2')).toBeInTheDocument()
  })
})

describe('Le liste di lavoro', () => {
  it('la copertura conta gli atleti programmati nei prossimi 3 giorni', async () => {
    ctrl.assegnazioni.valore = [riga('p1', 'a1', 0), riga('p2', 'a1', +1), riga('p3', 'a2', +2)]
    montaCoach()
    await attendi('Copertura 3 gg')
    expect(screen.getByText('1 atleta senza allenamento')).toBeInTheDocument()
  })

  it('mostra gli allenamenti scaduti, non quelli di oggi né i completati', async () => {
    ctrl.assegnazioni.valore = [
      riga('s1', 'a1', -3),
      riga('s2', 'a2', 0),
      fatta('s3', 'a3', -4),
    ]
    montaCoach()
    await attendi('Allenamenti scaduti')
    expect(screen.getByText(/Scheda s1 · scaduto/)).toBeInTheDocument()
    // Quello di oggi non è scaduto: compare nella squadra della giornata, non qui.
    expect(screen.queryByText(/Scheda s2 · scaduto/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Scheda s3 · scaduto/)).not.toBeInTheDocument()
  })
})

describe('Cosa è uscito dalla Home coach', () => {
  it('non c\'è più una card verso Calendario o Atleti', async () => {
    montaCoach()
    await attendi('Crea workout')
    expect(screen.queryByText('Calendario')).not.toBeInTheDocument()
    expect(screen.queryByText('Atleti')).not.toBeInTheDocument()
  })

  it('l\'archivio resta, come riga, con il numero di workout', async () => {
    montaCoach()
    expect(await screen.findByLabelText("Apri l'archivio dei workout")).toBeInTheDocument()
    expect(screen.getByText(/2 allenamenti · riusa e duplica/)).toBeInTheDocument()
  })
})
