import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// `cascata` (src/index.css) è l'entrata di tutta l'app: i figli di un
// contenitore entrano sfasati di 65ms invece che tutti insieme. È una classe
// sola, quindi è anche una riga sola da perdere — e perderla non rompe niente:
// la pagina si monta, si legge, e smette semplicemente di somigliare al
// riferimento. Nessun altro test la guarda.
//
// 🔴 E il secondo caso vale più del primo. Un elemento che porta SIA `cascata`
// dal padre SIA `hero-transition` sulla propria radice ha due animazioni di
// pari specificità sullo stesso nodo: a decidere quale vince è l'ordine nel
// foglio di stile, non quello nella stringa di classi. È esattamente la
// trappola di `CARTA_RIGA` (CLAUDE.md §9-octodecies), dove lo screenshot non
// mostrava niente e il primo test era verde per il motivo sbagliato — lì si
// verificava la PRESENZA della classe nuova, mentre il caso che prende il
// difetto è l'ASSENZA di quella vecchia. Questi test guardano l'assenza.
//
// ⚠️ jsdom non carica `index.css`: il ritardo calcolato NON è verificabile qui
// (è stato misurato nel browser — 0 / 65 / 130 / 195ms). Qui si protegge il
// cablaggio, che è la parte che si perde per distrazione.

const ctrl = vi.hoisted(() => ({ righe: [], atleti: [] }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athlete_workouts: ctrl.righe,
    athletes: ctrl.atleti,
    workouts: [],
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

const OGGI = new Date('2026-09-09T10:00:00')

/** Una seduta della Home atleta. `stato` decide se è chiusa o è quella di oggi. */
const seduta = (data, stato = 'completed') => ({
  id: `aw-${data}-${stato}`,
  completed_date: data,
  status: stato,
  notes: stato === 'completed' ? '[RPE: 7/10]\nBene' : null,
  workouts: {
    id: `w-${data}`,
    title: 'Hyrox Forza',
    sections: { category: 'Hyrox', intensity: '7', blocks: [{ type: 'AMRAP', params: { duration: '40 min' } }] },
  },
})

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(OGGI)
  window.localStorage.clear()
  ctrl.righe = []
  ctrl.atleti = []
})
afterEach(() => { vi.useRealTimers() })

/** Il contenitore del ramo atleta, risalendo da una card che sta dentro. */
const contenitore = (dentro) => dentro.closest('.cascata')

describe('La cascata sulla Home atleta', () => {
  it('il contenitore del ramo atleta la dichiara', async () => {
    ctrl.righe = []
    montaPagina(<Home />, { role: 'athlete' })

    const benvenuto = await screen.findByText(/ti segue da oggi/i)
    const padre = contenitore(benvenuto)
    expect(padre).not.toBeNull()
    // Più di un figlio, o non c'è niente da sfasare.
    expect(padre.children.length).toBeGreaterThan(1)
  })

  // 🔴 Il test che conta. Non verifica che `cascata` ci sia — quello lo fa il
  // primo — ma che nessun figlio si porti dietro la SECONDA animazione.
  it('nessun figlio della cascata dichiara anche `hero-transition`', async () => {
    ctrl.righe = []
    montaPagina(<Home />, { role: 'athlete' })

    const padre = contenitore(await screen.findByText(/ti segue da oggi/i))
    const doppi = [...padre.children].filter((el) => el.classList.contains('hero-transition'))
    expect(doppi).toHaveLength(0)
  })

  // 🔴 L'alone della card riposo NON dev'essere una sfocatura, e questo test è
  // l'unica cosa che lo ricorda. Con `blur-2xl` il colore cambiava nell'istante
  // in cui la cascata finiva — misurato sul simulatore il 21/09/2026, Y 48,08 →
  // 52,31 nei 17ms dopo che il movimento era già finito: WebKit rende la
  // sfocatura sul layer GPU durante l'animazione e la ridipinge dalla CPU
  // quando il layer viene liberato. Il difetto NON si vede in jsdom, non si
  // vede nel browser incorporato, e non fa cadere nessun altro test: rimettere
  // `blur-2xl` qui è una riga che nessuno segnalerebbe mai.
  it("l'alone della card riposo non è una sfocatura", async () => {
    // Storico nel passato e niente oggi: è la condizione di `HeroRiposo`.
    ctrl.righe = [seduta('2026-09-07'), seduta('2026-09-08')]
    montaPagina(<Home />, { role: 'athlete' })

    const card = (await screen.findByText(/Oggi non ti alleni/i)).closest('.cascata > *')
      || (await screen.findByText(/Oggi non ti alleni/i)).closest('div.relative')
    expect(card).not.toBeNull()
    const sfocati = [...card.querySelectorAll('*')]
      .filter((el) => [...el.classList].some((c) => c.startsWith('blur-')))
    expect(sfocati).toHaveLength(0)
    expect(card.querySelector('.alone')).not.toBeNull()
  })

  // ⚠️ SERVE UN ALLENAMENTO DI **OGGI**, e non è un dettaglio dello scenario.
  // La card dell'eroe è l'unico figlio della cascata che aveva
  // `hero-transition` scritto in `Home.jsx` invece che nel componente, e senza
  // una riga di oggi non viene renderizzata affatto: il test passa e non
  // verifica niente. Verificato per mutazione — con due sole sedute passate,
  // rimettere `hero-transition` sul wrapper NON faceva cadere nulla.
  it('vale anche sulla card di oggi, non solo al giorno 1', async () => {
    ctrl.righe = [seduta('2026-09-09', 'pending'), seduta('2026-09-07')]
    montaPagina(<Home />, { role: 'athlete' })

    // Fuori dal giorno 1, e con l'eroe di oggi in pagina.
    await waitFor(() => expect(screen.queryByText(/ti segue da oggi/i)).toBeNull())
    expect(await screen.findByText('Hyrox Forza')).toBeInTheDocument()
    const padre = document.querySelector('.cascata')
    expect(padre).not.toBeNull()
    expect(padre.children.length).toBeGreaterThan(1)
    expect([...padre.children].filter((el) => el.classList.contains('hero-transition'))).toHaveLength(0)
    // 🔴 E nemmeno l'eroe di oggi può avere una sfocatura: è la card più
    // esposta dell'app — quella che si scorre per completare — ed è figlia
    // della cascata, quindi il difetto del colore lì è ATTIVO.
    const sfocati = [...padre.querySelectorAll('*')]
      .filter((el) => [...el.classList].some((c) => c.startsWith('blur-')))
    expect(sfocati).toHaveLength(0)
    expect(padre.querySelector('.alone')).not.toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('La cascata sulla Home coach', () => {
  // 🔴 SERVE UN FEEDBACK VERO, e non è un dettaglio dello scenario: senza,
  // in pagina va `HeroNessunFeedback`, che l'alone non ce l'ha — il test sulla
  // sfocatura passerebbe senza verificare niente. Verificato per mutazione:
  // con la lista vuota, rimettere `blur-2xl` NON faceva cadere nulla.
  const montaCoach = ({ conFeedback = true } = {}) => {
    ctrl.atleti = [{ id: 'a1', name: 'Luca', surname: 'Rossi', photo_url: null, notes: null }]
    ctrl.righe = conFeedback ? [{
      id: 'aw1', athlete_id: 'a1', completed_date: oggiIso(), status: 'completed',
      notes: '[RPE: 8/10]\nTutto liscio', voice_note_url: null,
      athletes: { id: 'a1', name: 'Luca', surname: 'Rossi', photo_url: null },
      workouts: { id: 'w1', title: 'Hyrox Forza', sections: { category: 'Hyrox' } },
    }] : []
    montaPagina(<Home />, { role: 'admin' })
  }
  const oggiIso = () => new Date().toISOString().split('T')[0]

  it('il contenitore del ramo coach la dichiara, e riparte dalla voce 1', async () => {
    montaCoach()
    const cta = await screen.findByText(/Crea workout/i)
    const padre = cta.closest('.cascata')
    expect(padre).not.toBeNull()
    expect(padre.children.length).toBeGreaterThan(1)
    // 🔴 Lo sfasamento è la metà che si perde riscrivendo: senza, la testata e
    // la prima card partono insieme e la cascata comincia dal secondo elemento.
    expect(padre.style.getPropertyValue('--cascata-da')).toBe('1')
  })

  // 🔴 La testata sta FUORI dal contenitore della cascata — è condivisa fra i
  // due rami — quindi è l'unico elemento della pagina che, tolto
  // `page-transition` dalla radice, resterebbe senza entrata: comparirebbe di
  // colpo sopra una pagina che sale. `cascata-voce` è la sua.
  it('la testata ha la propria voce di cascata', async () => {
    montaCoach()
    // ⚠️ Non `findByText(/FLEOFIT/i)`: il marchio è spezzato in `FLEO` + uno
    // span `FIT`, quindi nessun nodo contiene quel testo di fila. L'h1 sì.
    const testata = await screen.findByRole('heading', { level: 1 })
    expect(testata.textContent).toMatch(/FLEO/)
    expect(testata.closest('.cascata-voce')).not.toBeNull()
  })

  // 🔴 La radice NON deve più animare tutta insieme: pagina che sale mentre i
  // figli salgono è movimento doppio, ed è la ragione per cui `page-transition`
  // è uscito da questa pagina. Rimetterlo non rompe niente e non si vede in
  // jsdom — si vede solo sul telefono.
  it('la radice della pagina non ha più `page-transition`', async () => {
    montaCoach()
    const padre = (await screen.findByText(/Crea workout/i)).closest('.cascata')
    expect(document.querySelector('.page-transition')).toBeNull()
    expect(padre.closest('.page-transition')).toBeNull()
  })

  it("l'eroe dei feedback non è una sfocatura e non porta una seconda entrata", async () => {
    montaCoach()
    // L'eroe c'è davvero: senza questa riga il test guarda una pagina in cui
    // l'alone non è mai stato renderizzato.
    expect(await screen.findByText(/Tutto liscio/i)).toBeInTheDocument()
    const padre = document.querySelector('.cascata')
    expect([...padre.children].filter((el) => el.classList.contains('hero-transition'))).toHaveLength(0)
    const sfocati = [...padre.querySelectorAll('*')]
      .filter((el) => [...el.classList].some((c) => c.startsWith('blur-')))
    expect(sfocati).toHaveLength(0)
  })
})
