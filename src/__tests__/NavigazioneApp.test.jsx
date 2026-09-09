import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Perché questi test esistono
// ────────────────────────────
// Nessuno dei 617 test montava App.jsx: i test delle pagine le montano da sole,
// con un AuthContext proprio (src/test/montaPagina.jsx). Il cancello delle
// pagine private, il router e la tab bar — cioè tutto ciò che sta FRA una
// pagina e l'altra — non erano coperti da niente.
//
// Il 31/08/2026 `ProtectedRoute` è diventato una route di LAYOUT: prima ogni
// <Route> aveva il proprio, ripetuto nove volte. Questi due test fissano le due
// proprietà che quella forma deve garantire, e sono due perché rompendone una
// l'altro test resta verde.
//
// ⚠️ Quello che questi test NON dicono: il passaggio da una pagina all'altra
// non mostrava lo splash di avvio nemmeno PRIMA del refactor. Verificato per
// mutazione — con il codice di prima `getSession` resta a uno, perché React
// conserva lo stato di un componente dello stesso tipo nella stessa posizione
// dell'albero, quindi `ProtectedRoute` non si rimontava. Il refactor toglie
// una ripetizione e mette al riparo dal caso in cui si rimonterebbe davvero
// (un secondo cancello annidato); la lentezza percepita fra le pagine ha
// un'altra causa — il peso dei chunk e il fetch di ogni pagina.

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../test/fintoSupabase')
  const { vi: v } = await import('vitest')
  const f = fintoSupabase({
    athletes: [{ id: 'u1', name: 'Marco', surname: 'Rossi' }],
    athlete_workouts: [],
    notifications: [],
  })
  const sessione = {
    user: { id: 'u1', email: 'atleta@fleofit.it', user_metadata: { first_name: 'Marco', role: 'athlete' } },
  }
  f.supabase.auth.getSession = v.fn(() => Promise.resolve({ data: { session: sessione } }))
  f.supabase.auth.onAuthStateChange = v.fn(() => ({ data: { subscription: { unsubscribe: v.fn() } } }))
  return f
})

// Il chunk di AthleteDetail si apre a comando: è l'unico modo di guardare l'app
// MENTRE una pagina caricata su richiesta sta arrivando.
//
// ⚠️ Il cancello sta su AthleteDetail e NON su Calendar, che il primo test usa
// libero: un modulo si risolve una volta sola e resta in cache, quindi due test
// sullo stesso chunk si legherebbero all'ordine in cui girano — il secondo
// troverebbe la pagina già arrivata e passerebbe senza guardare niente.
const cancello = vi.hoisted(() => {
  let apri
  const attesa = new Promise((r) => { apri = r })
  return { attesa, apri: () => apri() }
})

vi.mock('../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: true })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))
// ⚠️ Il finto calendario porta un comando che apre l'archivio, e non è un
// ornamento: dal 02/09 la tab bar naviga in `replace` (una tab non impila,
// src/components/Navbar.jsx), quindi le sue voci NON creano più una voce di
// history su cui tornare indietro. Il test sul `POP` ha bisogno di una
// navigazione vera dentro una pagina, che è anche il caso che descrive.
vi.mock('../pages/Calendar', async () => {
  const { useNavigate } = await import('react-router-dom')
  const Finto = () => {
    const navigate = useNavigate()
    return (
      <div>
        <div>Pagina calendario</div>
        <button onClick={() => navigate('/archive')}>Apri archivio</button>
      </div>
    )
  }
  return { default: Finto }
})
vi.mock('../pages/WorkoutsArchive', () => ({ default: () => <div>Pagina archivio</div> }))
vi.mock('../pages/AthleteDetail', async () => {
  await cancello.attesa
  return { default: () => <div>Pagina profilo</div> }
})

const App = (await import('../App')).default

// ⚠️ `BrowserRouter` legge la history VERA del documento, che i test si
// passano l'un l'altro: senza questo, il secondo test parte dalla rotta su cui
// il primo l'ha lasciata e verifica un'altra pagina (§9-sexies).
// ⚠️ `finto.chiamate` è un registro di MODULO: si accumula fra un test e
// l'altro, e `vi.clearAllMocks()` non lo tocca. Senza questo azzeramento il
// test sulle letture conta anche gli avvii dei test precedenti.
// ⚠️ In jsdom `window.scrollTo` esiste ma non è implementata (stampa «Not
// implemented» e basta): la spia serve sia a osservarla sia a zittirla.
let scrollTo
beforeEach(() => {
  window.history.pushState({}, '', '/')
  finto.chiamate.length = 0
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { scrollTo.mockRestore() })

/** Monta l'app e aspetta che l'avvio sia finito, cioè che la tab bar esista. */
async function avvia() {
  render(<App />)
  await waitFor(() => expect(document.querySelector('nav')).toBeInTheDocument())
}

describe('Navigazione fra le pagine private', () => {
  it('risolve la sessione UNA volta sola per tutta l\'app', async () => {
    const utente = userEvent.setup()
    await avvia()
    expect(finto.supabase.auth.getSession).toHaveBeenCalledTimes(1)

    await utente.click(screen.getByRole('link', { name: /Calendario/i }))
    await screen.findByText('Pagina calendario')

    // 🔴 Il cancello è UNO. Chi riavvolge una pagina in un secondo
    // <ProtectedRoute> lo scopre qui: quel secondo giro rifà `getSession()` e
    // una `select` su athletes, e rimette la schermata di avvio sulla sua
    // rotta. Verificato per mutazione annidandone uno.
    expect(finto.supabase.auth.getSession).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Caricamento/i)).not.toBeInTheDocument()
  })

  it('tiene a schermo la pagina precedente mentre il chunk della nuova arriva', async () => {
    const utente = userEvent.setup()
    await avvia()
    const nav = document.querySelector('nav')

    await utente.click(screen.getByRole('link', { name: /Profilo/i }))

    // Il chunk non è ancora arrivato.
    expect(screen.queryByText('Pagina profilo')).not.toBeInTheDocument()

    // 🔴 E NON si vede uno schermo vuoto: `BrowserRouter` avvolge ogni cambio
    // di rotta in `startTransition`, quindi React tiene a schermo l'albero
    // precedente invece di scoprire il fallback del Suspense. È il motivo per
    // cui fra una pagina e l'altra non lampeggia il nero — e si perde in
    // silenzio passando `useTransitions={false}` a BrowserRouter, che è la
    // mutazione con cui questo test è stato verificato.
    // ⚠️ «ti segue da oggi» e non più «Giorno di rest»: questo finto atleta ha
    // `athlete_workouts: []`, quindi dal 09/09/2026 la Home gli mostra il ramo
    // del GIORNO 1 (CLAUDE.md §9-duodetricies) invece del tratteggio del
    // riposo. Serve solo come marcatore di «la Home è ancora a schermo»: se un
    // giorno cambia anche questa frase, va cambiato qui — non è la frase che il
    // test protegge, è la visibilità.
    expect(screen.getByText(/ti segue da oggi/i)).toBeVisible()
    expect(nav).toBeVisible()

    // ⚠️ `toBeVisible` e non `toBeInTheDocument`: quando un confine Suspense
    // scopre il fallback, React NON smonta ciò che era già montato — lo
    // nasconde con `display: none` e ne conserva lo stato. Sulla presenza la
    // mutazione non cade, sulla visibilità sì (§9-duodecies, la grafica IG).

    cancello.apri()
    await screen.findByText('Pagina profilo')
  })

  // 🔴 Mancava da sempre in tutta l'app, non solo nelle pagine nuove:
  // `BrowserRouter` non tocca lo scorrimento, e le pagine sono figlie di una
  // route di LAYOUT — cambia ciò che sta dentro <Outlet /> e la finestra resta
  // dov'era. Si scorre la Home fino in fondo, si tocca una voce, e la pagina
  // nuova si apre a metà: a schermo non sembra una pagina aperta male, sembra
  // che il tocco non abbia funzionato.
  it('apre ogni pagina nuova dall\'inizio', async () => {
    const utente = userEvent.setup()
    await avvia()

    // All'avvio no: la pagina è già in cima, e un `scrollTo` al montaggio
    // scavalcherebbe il ripristino del browser su un ricaricamento.
    expect(scrollTo).not.toHaveBeenCalled()

    await utente.click(screen.getByRole('link', { name: /Calendario/i }))
    await screen.findByText('Pagina calendario')
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  // Toccare di nuovo la voce già attiva è il gesto con cui su iOS si torna in
  // cima a una lista lunga, e deve funzionare anche qui: è una navigazione allo
  // STESSO percorso.
  // ⚠️ Questo test NON discrimina la dipendenza `key` da `pathname`, e va detto
  // perché sembra che lo faccia: al secondo tocco React Router passa da `PUSH` a
  // `REPLACE`, quindi cambia `tipo` e l'effetto riparte comunque. Verificato per
  // mutazione. Il caso che `key` copre davvero — due deep link allo stesso
  // workout con `athlete_id` diversi — non è provocabile montando `App`.
  it('riporta in cima anche toccando di nuovo la voce già aperta', async () => {
    const utente = userEvent.setup()
    await avvia()

    await utente.click(screen.getByRole('link', { name: /Calendario/i }))
    await screen.findByText('Pagina calendario')
    scrollTo.mockClear()

    await utente.click(screen.getByRole('link', { name: /Calendario/i }))
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0))
  })

  // 🔴 L'altra metà della regola, ed è quella che si perde riscrivendola: il
  // ritorno indietro deve riportare la pagina DOV'ERA. Chi scorre la Home fino
  // agli allenamenti scaduti, ne apre uno e torna, deve ritrovarsi lì. Un
  // `scrollTo` senza la guardia su `POP` scambia un difetto con un altro più
  // fastidioso, perché indietro è il gesto che si ripete di più.
  it('ma tornando indietro NON riporta in cima', async () => {
    const utente = userEvent.setup()
    await avvia()

    await utente.click(screen.getByRole('link', { name: /Calendario/i }))
    await screen.findByText('Pagina calendario')
    await utente.click(screen.getByRole('button', { name: /Apri archivio/i }))
    await screen.findByText('Pagina archivio')
    scrollTo.mockClear()

    window.history.back()
    await waitFor(() => expect(screen.getByText('Pagina calendario')).toBeInTheDocument())
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('legge la riga dell\'atleta UNA volta sola in tutto l\'avvio', async () => {
    await avvia()
    await screen.findByText(/ti segue da oggi/i)

    // 🔴 Erano TRE letture della stessa riga di `athletes` in un solo avvio, e
    // due di esse in FILA: `select('id')` per sapere se la riga esiste,
    // `select('id, name, surname')` per il nome, e una terza da `Home` per il
    // nome un'altra volta. Misurato con 100 ms di latenza per query, l'avvio
    // spendeva ~5 giri di rete di cui 4 in serie; ora sono 3 e 2
    // (§9-noviesdecies).
    //
    // ⚠️ L'asserzione è UNA e prende entrambe le regressioni: risepararle in
    // `ProtectedRoute`, o rimettere la `select('name')` in `Home`, portano il
    // conto a due. Nessuna delle due dà il minimo errore a schermo.
    expect(finto.chiamateA('athletes', 'select')).toHaveLength(1)
  })
})
