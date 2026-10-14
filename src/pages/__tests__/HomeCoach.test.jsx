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
// ⚠️ Dal 14/10/2026 la Home coach è un cruscotto (src/lib/cruscottoCoach.js):
// polso del team, oggi, da rivedere, da smaltire, prossimi giorni, gare.
// Feedback, fermi e scaduti stanno tutti in «Da smaltire»: i test su di loro
// restano — è il dato, non la posizione, a dover sopravvivere.

const OGGI = new Date()
const giorno = (scarto) => new Date(OGGI.getTime() + scarto * 86400000).toISOString().split('T')[0]

const ctrl = await vi.hoisted(async () => ({ atleti: { valore: [] }, assegnazioni: { valore: [] }, comeStai: { valore: [] } }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: ctrl.atleti.valore,
    athlete_workouts: ctrl.assegnazioni.valore,
    workouts: [{ id: 'w1' }, { id: 'w2' }],
    notifications: [],
    come_stai: ctrl.comeStai.valore,
    note_estratte: [],
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
  ctrl.comeStai.valore = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('Da smaltire: il feedback in entrata', () => {
  it('porta la citazione dell\'atleta e il suo RPE, non solo un contatore', async () => {
    // Il numero da solo obbliga ad aprire quattro schermate per sapere se una
    // delle quattro era urgente. La citazione è metà del valore della riga.
    ctrl.assegnazioni.valore = [fatta('f1', 'a1', -1, { notes: '[RPE: 9/10]\nGambe pesanti' })]
    montaCoach()
    await attendi('«Gambe pesanti»')
    expect(screen.getByLabelText('Leggi: Luca Rossi')).toHaveTextContent('RPE 9')
  })

  it('aprire un feedback segna letto SOLO quello', async () => {
    // Azzerare tutto al primo tocco cancellerebbe feedback che il coach non
    // ha ancora guardato.
    ctrl.assegnazioni.valore = [
      fatta('f1', 'a1', -1, { voice_note_url: 'https://x/nota.m4a' }),
      fatta('f2', 'a2', -2, { notes: '[RPE: 8/10]\nfaticoso' }),
    ]
    montaCoach()
    await userEvent.click(await screen.findByLabelText('Ascolta: Luca Rossi'))
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('fleofit_feedback_visti_u1'))).toEqual(['f1']))
  })

  it('una nota vocale cancellata non è una cosa da smaltire', async () => {
    ctrl.assegnazioni.valore = [
      fatta('f1', 'a1', -1, { voice_note_url: 'https://x/nota.m4a#deleted=1' }),
      ...['a2', 'a3'].map((id, i) => fatta(`ok${i}`, id, -1)),
      fatta('ok9', 'a1', -1),
    ]
    montaCoach()
    await attendi('Sei in pari: feedback letti, nessuno fermo, niente scaduto.')
  })

  it('oltre quattro voci le altre si chiedono, non si srotolano', async () => {
    ctrl.assegnazioni.valore = [
      ...['f1', 'f2', 'f3', 'f4', 'f5'].map((id, i) => fatta(id, 'a1', -i, { notes: `[RPE: 7/10]\nnota ${id}` })),
      // Gli altri due si sono allenati: non sono fermi, e la lista resta di cinque.
      fatta('ok2', 'a2', -1), fatta('ok3', 'a3', -1),
    ]
    montaCoach()
    await attendi('Altre 1')
    expect(screen.queryByText('«nota f5»')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Altre 1'))
    expect(screen.getByText('«nota f5»')).toBeInTheDocument()
  })
})

describe('Oggi', () => {
  it('conta i completati sugli assegnati di oggi, non su tutta la rubrica', async () => {
    ctrl.assegnazioni.valore = [fatta('t1', 'a1', 0), riga('t2', 'a2', 0), fatta('t3', 'a3', -1)]
    montaCoach()
    // «1 su 2»: Marco si è allenato ieri, oggi non era programmato.
    await attendi('1 su 2 fatti')
  })

  it('senza assegnazioni lo dice, invece di mostrare una card vuota', async () => {
    montaCoach()
    await attendi('Nessun allenamento assegnato oggi.')
  })

  it('un allenamento duro per chi stamattina sta male suona, con il perché', async () => {
    // È la ragione per cui la sezione esiste: il coach deve saperlo PRIMA
    // dell'allenamento, quando può ancora cambiarlo.
    ctrl.assegnazioni.valore = [riga('t1', 'a1', 0, { workouts: { id: 'w-t1', title: 'Simulazione', sections: { category: 'Hyrox', intensity: '9' } } })]
    ctrl.comeStai.valore = [{ athlete_id: 'a1', giorno: giorno(0), sonno: 1, energia: 4, dolori: 2, stress: 4 }]
    montaCoach()
    await attendi('Sonno: pessimo · Dolori muscolari: parecchi')
    expect(screen.getByRole('button', { name: "Alleggerisci l'allenamento" })).toBeInTheDocument()
  })

  it('lo stesso allenamento per chi sta bene non suona', async () => {
    ctrl.assegnazioni.valore = [riga('t1', 'a1', 0, { workouts: { id: 'w-t1', title: 'Simulazione', sections: { category: 'Hyrox', intensity: '9' } } })]
    ctrl.comeStai.valore = [{ athlete_id: 'a1', giorno: giorno(0), sonno: 4, energia: 4, dolori: 4, stress: 4 }]
    montaCoach()
    await attendi('0 su 1 fatti')
    expect(screen.queryByRole('button', { name: "Alleggerisci l'allenamento" })).not.toBeInTheDocument()
  })
})

describe('Da rivedere nel programma', () => {
  it('chi dichiara più fatica di quella programmata, seduta dopo seduta', async () => {
    const dura = (id, scarto) => fatta(id, 'a2', scarto, {
      notes: '[RPE: 9/10]', workouts: { id: `w-${id}`, title: `Scheda ${id}`, sections: { category: 'Hyrox', intensity: '6' } },
    })
    ctrl.assegnazioni.valore = [dura('d1', -1), dura('d2', -3), dura('d3', -5)]
    montaCoach()
    await attendi('Giulia Rossi: allenamenti più faticosi del previsto')
  })

  it('senza segnali lo dice, invece di sparire', async () => {
    montaCoach()
    await attendi(/Nessun segnale nelle ultime 4 settimane/)
  })
})

describe('Fermi e scaduti', () => {
  it('elenca gli atleti fermi con i giorni', async () => {
    ctrl.assegnazioni.valore = [fatta('x1', 'a1', -9), fatta('x2', 'a2', -6), fatta('x3', 'a3', -1)]
    montaCoach()
    await attendi('Non si allena da 9 giorni')
    expect(screen.getByText('Non si allena da 6 giorni')).toBeInTheDocument()
    expect(screen.queryByLabelText('Scheda: Marco Rossi')).not.toBeInTheDocument()
  })

  it('chi non ha nessun allenamento nella finestra non riceve un numero preciso', async () => {
    // «45 giorni» tondi tondi sarebbe un numero falso.
    ctrl.atleti.valore = [atleta('a1', 'Luca')]
    montaCoach()
    await attendi('Non si allena da 45+ giorni')
  })

  it('l\'account del coach non finisce fra gli atleti da chiamare', async () => {
    const { COACHING_ID } = await import('../../lib/constants')
    ctrl.atleti.valore = [...ctrl.atleti.valore, { id: COACHING_ID, name: 'Federico', surname: 'Leo', photo_url: null }]
    ctrl.assegnazioni.valore = ctrl.atleti.valore.filter(a => a.id !== COACHING_ID).map((a, i) => fatta(`x${i}`, a.id, -1))
    montaCoach()
    await attendi('Sei in pari: feedback letti, nessuno fermo, niente scaduto.')
  })

  it('mostra gli allenamenti scaduti, non quelli di oggi né i completati', async () => {
    ctrl.assegnazioni.valore = [riga('s1', 'a1', -3), riga('s2', 'a2', 0), fatta('s3', 'a3', -4)]
    montaCoach()
    await attendi(/Scheda s1 · scaduto/)
    expect(screen.queryByText(/Scheda s2 · scaduto/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Scheda s3 · scaduto/)).not.toBeInTheDocument()
  })
})

describe('Gli atleti in pausa', () => {
  // Restano nella rubrica ma escono dalla Home: è la richiesta del committente
  // («mi hanno detto che vogliono essere messi in pausa, ma voglio continuare a
  // tenerli nella lista atleti»). Vedi docs/memoria/home-coach.md.
  const conPausa = (a) => ({ ...a, notes: formatNotePausa('2026-08-20', 'Ha chiesto una sosta') })

  beforeEach(() => {
    ctrl.atleti.valore = [conPausa(atleta('a1', 'Luca')), atleta('a2', 'Giulia'), atleta('a3', 'Marco')]
  })

  it('non compaiono fra i fermi, per quanto fermi siano', async () => {
    ctrl.assegnazioni.valore = [fatta('x2', 'a2', -8), fatta('x3', 'a3', -1)]
    montaCoach()
    await attendi('Non si allena da 8 giorni')
    expect(screen.queryByLabelText('Scheda: Luca Rossi')).not.toBeInTheDocument()
  })

  it('la testata dice quanti sono in pausa, altrimenti i numeri sotto sembrano sbagliati', async () => {
    montaCoach()
    await attendi('Da smaltire')
    expect(screen.getByText(/1 in pausa/)).toBeInTheDocument()
    expect(screen.getByText(/3 atleti/)).toBeInTheDocument()
  })

  it('la query degli atleti si porta `notes`, dove vive la pausa', async () => {
    // ⚠️ Test sulla FORMA della query: `fintoSupabase` restituisce le righe
    // qualunque `select` riceva, quindi togliere `notes` non farebbe fallire
    // nessun altro test — e in produzione spegnerebbe tutte le pause.
    montaCoach()
    await attendi('Da smaltire')
    const select = finto.chiamateA('athletes', 'select').map(c => String(c.args[0]))
    expect(select.some(s => s.includes('notes'))).toBe(true)
  })

  it('escono dal totale della copertura invece di contare come «senza allenamento»', async () => {
    ctrl.assegnazioni.valore = [riga('p1', 'a2', 0)]
    montaCoach()
    // Due seguiti, uno programmato: uno senza. Con Luca dentro sarebbero due.
    await attendi('1 atleta senza allenamento nei prossimi 3 giorni')
  })
})

describe('I prossimi giorni e le gare', () => {
  it('la copertura conta gli atleti programmati nei prossimi 3 giorni', async () => {
    ctrl.assegnazioni.valore = [riga('p1', 'a1', 0), riga('p2', 'a1', +1), riga('p3', 'a2', +2)]
    montaCoach()
    await attendi('1 atleta senza allenamento nei prossimi 3 giorni')
  })

  it('una gara assegnata a più atleti compare una volta, con i loro nomi', async () => {
    const garaDi = (id, athlete_id) => riga(id, athlete_id, +20, {
      workouts: { id: 'gara1', title: 'HYROX Milano', sections: { category: 'Event', isEvent: true, isAutonomous: true } },
    })
    ctrl.assegnazioni.valore = [garaDi('g1', 'a1'), garaDi('g2', 'a2')]
    montaCoach()
    await attendi('Gare in arrivo')
    expect(screen.getByText('Luca, Giulia')).toBeInTheDocument()
    expect(screen.getByText('tra 20 giorni')).toBeInTheDocument()
  })
})

describe('Cosa è uscito dalla Home coach', () => {
  it('non c\'è più una card verso Calendario o Atleti', async () => {
    montaCoach()
    await attendi('Da smaltire')
    expect(screen.queryByText('Calendario')).not.toBeInTheDocument()
    expect(screen.queryByText('Atleti')).not.toBeInTheDocument()
  })

  it('l\'archivio resta, come riga, con il numero di workout', async () => {
    montaCoach()
    expect(await screen.findByLabelText("Apri l'archivio dei workout")).toBeInTheDocument()
    expect(screen.getByText(/2 allenamenti · riusa e duplica/)).toBeInTheDocument()
  })
})

// ⚠️ Questi montano con role 'admin', non 'coach': il ruolo che esiste davvero
// nell'app è `admin`, e fino al 28/08/2026 era l'unico che vedeva in fondo alla
// Home coach anche il proprio ramo atleta.
describe('La Home dell\'admin non è anche la Home di un atleta', () => {
  const montaAdmin = () => montaPagina(<Home />, { role: 'admin' })

  it('non mostra il proprio allenamento di oggi né lo stato «senza storico»', async () => {
    montaAdmin()
    await attendi('Da smaltire')
    expect(screen.queryByText(/ti segue da oggi/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Oggi non ti alleni/i)).not.toBeInTheDocument()
  })

  it('non mostra le celle settimana, serie e volume/RPE', async () => {
    montaAdmin()
    await attendi('Da smaltire')
    expect(screen.queryByLabelText(/allenamenti completati su/)).not.toBeInTheDocument()
    expect(screen.queryByText('Serie')).not.toBeInTheDocument()
    expect(screen.queryByText('Volume · RPE')).not.toBeInTheDocument()
  })

  it('non ha più la riga «Profilo»', async () => {
    montaAdmin()
    await attendi('Da smaltire')
    expect(screen.queryByText('Profilo')).not.toBeInTheDocument()
  })

  it('il ramo coach c\'è tutto, ed è l\'unico', async () => {
    ctrl.assegnazioni.valore = [fatta('f1', 'a1', -1, { notes: '[RPE: 9/10]\nGambe pesanti' })]
    montaAdmin()
    await attendi('«Gambe pesanti»')
    expect(screen.getByRole('region', { name: 'Il polso del team' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Prossimi 3 giorni' })).toBeInTheDocument()
    expect(await screen.findByLabelText("Apri l'archivio dei workout")).toBeInTheDocument()
  })

  it('la testata è quella del coach, non il saluto dell\'atleta', async () => {
    montaAdmin()
    await attendi('Da smaltire')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('FLEOFIT Coach')
  })

  it('la testata dice quanti atleti segue, e la settimana ISO non c\'è più', async () => {
    montaAdmin()
    await attendi('Da smaltire')
    expect(screen.getByText(/· 3 atleti/)).toBeInTheDocument()
    expect(screen.queryByText(/Settimana \d+/)).not.toBeInTheDocument()
  })
})

describe('«Cerca con l\'IA» (09/10/2026)', () => {
  // Il bottone è solo del coach: la ricerca scorre TUTTI gli atleti, e lato
  // atleta per decisione del committente non c'è ancora niente.
  it('il coach ha il bottone, e apre il foglio', async () => {
    const utente = userEvent.setup()
    montaPagina(<Home />, { role: 'admin' })
    await utente.click(await screen.findByRole('button', { name: "Cerca con l'IA" }))
    expect(await screen.findByRole('dialog', { name: "Cerca con l'IA" })).toBeInTheDocument()
  })

  it('l\'atleta non ce l\'ha', async () => {
    montaPagina(<Home />, { role: 'athlete' })
    await screen.findByRole('button', { name: /centro notifiche/i })
    expect(screen.queryByRole('button', { name: "Cerca con l'IA" })).not.toBeInTheDocument()
  })
})

describe('Desktop: il cruscotto', () => {
  it('ha il polso del team, oggi, i segnali e la settimana intera', async () => {
    const prima = window.matchMedia
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    try {
      ctrl.assegnazioni.valore = [fatta('u1', 'a2', 0, { notes: '[RPE: 7/10]' }), riga('u2', 'a3', +1)]
      montaCoach()
      await screen.findByRole('heading', { name: 'La settimana' })
      expect(screen.getByRole('region', { name: 'Il polso del team' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /^Oggi · 1 allenamento$/ })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Da rivedere nel programma' })).toBeInTheDocument()
      // Sette colonne: la settimana comincia di lunedì e oggi è segnato.
      expect(screen.getByText('oggi')).toBeInTheDocument()
      // «Ultime sedute chiuse» è uscita il 14/10/2026: guardava solo indietro.
      expect(screen.queryByText('Ultime sedute chiuse')).not.toBeInTheDocument()
    } finally {
      window.matchMedia = prima
    }
  })
})

describe('Desktop: il centro notifiche', () => {
  it('si apre come pannello a destra e si chiude con Esc', async () => {
    const prima = window.matchMedia
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    try {
      montaCoach()
      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: /^Notifiche/ }))
      const pannello = await screen.findByRole('dialog', { name: 'Notifiche' })
      expect(pannello.dataset.pannello).toBe('destra')
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notifiche' })).toBeNull())
    } finally {
      window.matchMedia = prima
    }
  })
})
