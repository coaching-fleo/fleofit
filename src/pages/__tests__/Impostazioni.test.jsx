import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina, UTENTE } from '../../test/montaPagina'
import { CHIAVE_ULTIMO_EXPORT } from '../../lib/rigaImpostazioni'

// Perché questi test esistono
// ────────────────────────────
// I numeri delle tre righe sono coperti da rigaImpostazioni.test.js. Qui c'è
// l'altra metà: che `Settings.jsx` colleghi al posto giusto le cose che il
// rework del 01/09/2026 ha spostato, e che quelle uscite restino fuori.
//
// La rimozione è la parte fragile, come sempre. Il banner giallo «Operazione
// in corso» e il logo FLEOFIT in cima sono usciti per una ragione, e senza un
// test la prima persona che vuole «far vedere che sta caricando» li rimette.

const ctrl = await vi.hoisted(async () => ({ codici: { valore: [] } }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    invitation_codes: ctrl.codici.valore,
    athletes: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
    workouts: [{ id: 'w1' }, { id: 'w2' }],
  }))
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: vi.fn(() => Promise.resolve({ receive: 'prompt' })),
    requestPermissions: vi.fn(() => Promise.resolve({ receive: 'granted' })),
    removeAllListeners: vi.fn(() => Promise.resolve()),
    addListener: vi.fn(() => Promise.resolve()),
    register: vi.fn(() => Promise.resolve()),
  },
}))
vi.mock('@capacitor-community/fcm', () => ({ FCM: { getToken: vi.fn(() => Promise.resolve({ token: 't' })) } }))
vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn(() => Promise.resolve({ version: '1.1.0', build: '4' })) } }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { writeFile: vi.fn() }, Directory: {}, Encoding: {} }))
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }))

const Settings = (await import('../Settings')).default

const montaCoach = () => montaPagina(<Settings />, {
  role: 'admin', user: { ...UTENTE, email: 'coaching@federicoleo.it' },
})
const montaAtleta = () => montaPagina(<Settings />, { role: 'athlete' })

// ⚠️ `chiamate` è un registro di MODULO, che `vi.clearAllMocks()` non tocca:
// senza azzerarlo, il test sulle letture conta anche i montaggi dei test
// precedenti (CLAUDE.md §9-noviesdecies, stessa trappola).
beforeEach(() => {
  finto.chiamate.length = 0
  window.localStorage.clear()
  ctrl.codici.valore = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('L\'eroe: account e stato del dispositivo', () => {
  it('apre dicendo con quale account sei dentro e che ruolo hai', async () => {
    montaCoach()
    const eroe = screen.getByRole('region', { name: 'Account e dispositivo' })
    expect(within(eroe).getByText('coaching@federicoleo.it')).toBeInTheDocument()
    expect(within(eroe).getByText('Coach')).toBeInTheDocument()
  })

  it('🔴 le notifiche sono un INTERRUTTORE, non un bottone che dice dove andrà', async () => {
    // Prima il testo cambiava da «Abilita Notifiche» a «Disabilita Notifiche»:
    // un comando travestito da stato, che si legge al contrario la metà delle
    // volte. `aria-checked` è anche l'unico modo in cui VoiceOver può sapere
    // se le notifiche arrivano — che è tutta l'informazione della riga.
    montaCoach()
    const sw = await screen.findByRole('switch', { name: 'Notifiche push' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByText(/Disabilita Notifiche/i)).not.toBeInTheDocument()
  })

  it('🔴 il banner giallo «Operazione in corso» non esiste più: lo stato sta nella riga', async () => {
    // Con nove comandi in pagina, una rotella in cima costringe a ricordarsi
    // cosa si è appena premuto.
    //
    // ⚠️ L'attesa va TENUTA aperta a mano: con il finto Supabase l'export
    // finisce dentro la stessa `userEvent.click`, e un `waitFor` dopo il clic
    // troverebbe la riga già tornata a riposo — cioè passerebbe anche
    // rimettendo il banner in cima. Qui `from` non risolve mai finché il test
    // non ha guardato.
    const vera = finto.supabase.from.getMockImplementation()
    const appesa = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') return () => new Promise(() => {})
        return () => appesa
      },
    })
    montaCoach()
    await apriStrumenti()
    const riga = await screen.findByRole('button', { name: /Esporta database/i })
    try {
      finto.supabase.from.mockImplementation(() => appesa)
      await userEvent.click(riga)
      expect(within(riga).getByText('In corso…')).toBeInTheDocument()
      expect(screen.queryByText(/Operazione in corso/i)).not.toBeInTheDocument()
    } finally {
      finto.supabase.from.mockImplementation(vera)
    }
  })

  it('🔴 il logo FLEOFIT e il secondo titolo sono usciti: un solo h1', () => {
    montaCoach()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.queryByText('Gestisci la tua app')).not.toBeInTheDocument()
  })
})

// 🔴 La fascia cardio è uscita il 21/09/2026 con tutto il BLE (§9-quintricies):
// era una funzione in prova, e costava due permessi di sistema
// (`NSBluetoothAlwaysUsageDescription` e `NSBluetoothPeripheralUsageDescription`)
// più il battito trasmesso via Realtime, che è ciò che rendeva «Salute» una
// dichiarazione obbligatoria sull'etichetta privacy.
//
// Questo test non protegge una funzione: protegge la sua ASSENZA. Rimettere
// l'interruttore senza rimettere le chiavi d'uso in `Info.plist` fa **crashare**
// l'app alla prima connessione, e rimettercele è un permesso in più davanti al
// revisore su un'app che ha già tre rifiuti. ⚠️ Si attende prima l'interruttore
// delle notifiche: senza, le `queryBy` girano su una pagina ancora vuota e
// passerebbero anche con il cardio al suo posto.
describe('La fascia cardio non c\'è più', () => {
  it("all'atleta non compare nessun comando del cardio", async () => {
    montaAtleta()
    await screen.findByRole('switch', { name: 'Notifiche push' })
    expect(screen.queryByRole('switch', { name: 'Fascia cardio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Come si collega/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Broadcast Heart Rate/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Polar, Wahoo, Garmin HRM/)).not.toBeInTheDocument()
  })
})

// Export e import atleta stanno dentro «Strumenti sviluppo», chiuso (27/10/2026).
async function apriStrumenti() {
  await userEvent.click(await screen.findByRole('button', { name: /Strumenti sviluppo/i }))
}

describe('Le righe del coach', () => {
  it('🔴 i codici invito sono una RIGA con il numero, non la prima card della pagina', async () => {
    // Erano una card con due accordion dentro — un pozzetto dentro un pozzetto
    // — messa davanti a tutto: la cosa che il coach fa una volta al mese in
    // cima alla schermata che apre per spegnere una notifica.
    ctrl.codici.valore = [
      { id: 'c1', code: 'AAA11111', is_active: true },
      { id: 'c2', code: 'BBB22222', is_active: true },
      { id: 'c3', code: 'CCC33333', is_active: false, used_by: 'a1', used_at: '2026-08-01T09:00:00Z' },
    ]
    montaCoach()
    await screen.findByText('2 attivi · 1 usato')
    // Il codice vero non è in pagina finché non si apre il foglio.
    expect(screen.queryByText('AAA11111')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Codici invito/i }))
    const foglio = await screen.findByRole('dialog', { name: 'Codici invito' })
    expect(within(foglio).getByText('AAA11111')).toBeInTheDocument()
  })

  it('la riga dell\'export dice cosa finirebbe nel file', async () => {
    montaCoach()
    await apriStrumenti()
    // 3 righe in `athletes` e 2 in `workouts` nel finto Supabase.
    expect(await screen.findByText('3 atleti · 2 workout')).toBeInTheDocument()
  })

  it('🔴 un export riuscito lascia la data, e la riga la ricorda', async () => {
    montaCoach()
    await apriStrumenti()
    await userEvent.click(await screen.findByRole('button', { name: /Esporta database/i }))
    await waitFor(() => expect(window.localStorage.getItem(CHIAVE_ULTIMO_EXPORT)).toBeTruthy())
    expect(await screen.findByText(/Ultimo export/)).toBeInTheDocument()
  })

  it('🔴 il ripristino totale non c\'è più, nemmeno fra gli strumenti', async () => {
    // Tolto il 27/10/2026 su richiesta del committente: sovrascriveva da un
    // file l'unico database, condiviso da web, iOS e Android.
    montaCoach()
    await apriStrumenti()
    expect(screen.queryByText(/Ripristina database totale/i)).not.toBeInTheDocument()
    // Resta un solo selettore di file: quello del backup atleta.
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1)
  })

  it('🔴 export e import atleta stanno chiusi sotto «Strumenti sviluppo»', async () => {
    montaCoach()
    await screen.findByRole('button', { name: /Codici invito/i })
    expect(screen.queryByText(/Esporta database/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Importa backup atleta/i)).not.toBeInTheDocument()
    await apriStrumenti()
    expect(screen.getByRole('button', { name: /Esporta database/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Importa backup atleta/i })).toBeInTheDocument()
  })

  it('🔴 i test mattina/sera sono chiusi in fondo, non fra le impostazioni', async () => {
    // Sono gli unici due comandi della pagina che spediscono qualcosa a TUTTI
    // gli atleti, e stavano dentro la card delle notifiche come se fossero
    // due preferenze.
    montaCoach()
    expect(screen.queryByRole('button', { name: /Test mattina/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Strumenti sviluppo/i }))
    expect(screen.getByRole('button', { name: /Test mattina/i })).toBeInTheDocument()
  })

  it('all\'atleta le righe del coach non si mostrano', () => {
    montaAtleta()
    expect(screen.queryByText(/Codici invito/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Esporta database/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Ripristina database totale/i)).not.toBeInTheDocument()
  })

  it('🔴 e la pagina dell\'atleta non LEGGE nemmeno i codici invito', () => {
    // La guardia sta in due punti — il fetch e il render — e verificarne uno
    // solo lascia passare una versione che scarica l'elenco degli inviti sul
    // telefono di chi non deve vederli (§9-vicies, stessa lezione).
    montaAtleta()
    expect(finto.chiamateA('invitation_codes')).toHaveLength(0)
  })
})

describe('L\'anteprima come atleta', () => {
  it('è un interruttore, e dice nella pillola che sei un coach in anteprima', () => {
    window.localStorage.setItem('adminRoleOverride', 'athlete')
    montaPagina(<Settings />, { role: 'athlete', user: { ...UTENTE, email: 'coaching@federicoleo.it' } })
    const sw = screen.getByRole('switch', { name: 'Anteprima come atleta' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Anteprima atleta')).toBeInTheDocument()
  })

  it('a un atleta vero non compare', () => {
    montaAtleta()
    expect(screen.queryByRole('switch', { name: 'Anteprima come atleta' })).not.toBeInTheDocument()
  })
})

describe('Elimina il mio account (5.1.1v di App Store)', () => {
  // 🔴 Fino al 09/09/2026 la cancellazione esisteva solo dentro la modale
  // «Modifica profilo» della scheda atleta: c'era, funzionava, e nessuno
  // l'avrebbe trovata. La 5.1.1(v) non chiede che esista, chiede che sia
  // «easy to find» — e il posto in cui la si cerca sono le Impostazioni.

  it('🔴 la riga c’è, ed è sopra «Esci dall’account»', async () => {
    montaAtleta()
    const elimina = await screen.findByText('Elimina il mio account')
    const esci = screen.getByText(/Esci dall'account/i)
    // compareDocumentPosition: 4 = «esci» viene DOPO «elimina» nel documento.
    expect(elimina.compareDocumentPosition(esci) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // ⚠️ Al coach si mostra ANCHE, e non è una svista: nasconderla a chi è in
  // ADMIN_EMAILS vorrebbe dire nasconderla a `demo@fleofit.it`, cioè
  // esattamente all'account con cui entra il revisore di Apple.
  it('🔴 si mostra anche al coach, o il revisore non la troverebbe', async () => {
    montaCoach()
    expect(await screen.findByText('Elimina il mio account')).toBeInTheDocument()
  })

  it('chiede conferma prima di fare qualunque cosa', async () => {
    const utente = userEvent.setup()
    montaAtleta()
    await utente.click(await screen.findByText('Elimina il mio account'))

    expect(await screen.findByText('Eliminare il tuo account?')).toBeInTheDocument()
    expect(finto.chiamateA('athletes', 'update')).toHaveLength(0)
  })

  // Il messaggio NON deve promettere che riaccedendo si annulla: `ProtectedRoute`
  // non filtra `deleted_at`, quindi si rientra e la riga resta comunque marcata.
  // L'unica via indietro è il cestino del coach, ed è quella che si dichiara.
  it('🔴 dice i 7 giorni e che a fermarla è il COACH, non un nuovo accesso', async () => {
    const utente = userEvent.setup()
    montaAtleta()
    await utente.click(await screen.findByText('Elimina il mio account'))

    const messaggio = (await screen.findByText(/7 giorni/)).textContent
    expect(messaggio).toMatch(/coach/i)
    expect(messaggio).not.toMatch(/riacced|rientr/i)
  })

  it('confermando marca il PROPRIO profilo e fa uscire dall’account', async () => {
    const utente = userEvent.setup()
    montaAtleta()
    await utente.click(await screen.findByText('Elimina il mio account'))
    await utente.click(await screen.findByRole('button', { name: 'Conferma' }))

    await waitFor(() => expect(finto.supabase.auth.signOut).toHaveBeenCalled())
    const scritture = finto.chiamateA('athletes', 'update')
    expect(scritture).toHaveLength(1)
    expect(scritture[0].args[0].deleted_at).toEqual(expect.any(Number))
    // Sul PROPRIO id: un `.eq` sbagliato qui cancellerebbe il profilo di un altro.
    expect(finto.chiamateA('athletes', 'eq').some(c => c.args[0] === 'id' && c.args[1] === UTENTE.id)).toBe(true)
  })

  it('annullando non tocca niente', async () => {
    const utente = userEvent.setup()
    montaAtleta()
    await utente.click(await screen.findByText('Elimina il mio account'))
    await utente.click(await screen.findByRole('button', { name: 'Annulla' }))

    expect(finto.chiamateA('athletes', 'update')).toHaveLength(0)
    expect(finto.supabase.auth.signOut).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// La cascata (CLAUDE.md, il rework delle animazioni del 21/09/2026).
// ⚠️ jsdom non carica `index.css`: il ritardo non è verificabile qui — è stato
// misurato nel browser. Qui si protegge il CABLAGGIO, che è la parte che si
// perde per distrazione e che non fa cadere nessun altro test.
describe('La cascata sulle impostazioni', () => {
  it('la radice la dichiara e non ha più `page-transition`', async () => {
    montaCoach()
    await screen.findByRole('switch', { name: /Notifiche push/i })
    const radice = document.querySelector('.cascata')
    expect(radice).not.toBeNull()
    expect(radice.children.length).toBeGreaterThan(3)
    expect(document.querySelector('.page-transition')).toBeNull()
  })
})

describe('Impostazioni — versione desktop', () => {
  // `setup.js` mette un `matchMedia` finto per tutti: si ripristina quello.
  const originale = window.matchMedia
  const schermo = (largo) => {
    window.matchMedia = vi.fn(() => ({ matches: largo, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  }
  afterEach(() => { window.matchMedia = originale })

  it('sul desktop del coach: account a sinistra, strumenti del coach a destra, niente freccia indietro', async () => {
    schermo(true)
    const { container } = montaCoach()
    await screen.findByRole('heading', { name: 'Impostazioni' })
    const destra = container.querySelector('[data-disposizione="desktop"] [data-colonna="destra"]')
    expect(destra).not.toBeNull()
    expect(within(destra).getByText('Codici invito')).toBeInTheDocument()
    expect(within(destra).getByRole('button', { name: /Strumenti sviluppo/i })).toBeInTheDocument()
    const sinistra = container.querySelector('[data-colonna="sinistra"]')
    expect(within(sinistra).getByText('Modifica password')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Torna indietro' })).toBeNull()
  })

  it('le due colonne partono alla stessa altezza: un\'etichetta in cima a ciascuna', async () => {
    // Segnalato dal committente il 13/10: la destra partiva con «Solo coach»
    // sopra la carta, la sinistra direttamente con la carta, e i due riquadri
    // non erano allineati. jsdom non misura, quindi si controlla la forma:
    // il primo elemento di ogni colonna è un'etichetta di sezione.
    schermo(true)
    const { container } = montaCoach()
    await screen.findByRole('heading', { name: 'Impostazioni' })
    const prima = (lato) => container.querySelector(`[data-colonna="${lato}"]`).firstElementChild
    expect(prima('sinistra').querySelector('[data-etichetta-sezione]')?.textContent).toBe('Profilo')
    expect(prima('destra').querySelector('[data-etichetta-sezione]')?.textContent).toBe('Solo coach')
  })

  it('sul telefono resta com\'era', async () => {
    schermo(false)
    const { container } = montaCoach()
    expect(await screen.findByRole('button', { name: 'Torna indietro' })).toBeInTheDocument()
    expect(container.querySelector('[data-disposizione="desktop"]')).toBeNull()
  })
})

describe('La password per chi è entrato con Apple', () => {
  // 🔴 Sign in with Apple c'è solo sull'app iPhone: sul sito chi si è
  // registrato così non ha un bottone per entrare. Fino al 13/10/2026 il
  // foglio chiedeva «la password attuale», che quell'atleta non ha mai avuto,
  // e verificarla con `signInWithPassword` falliva sempre: niente web, mai.
  const APPLE = {
    ...UTENTE, email: 'x7k2@privaterelay.appleid.com',
    app_metadata: { provider: 'apple', providers: ['apple'] },
  }

  it('🔴 la riga dice a cosa serve, e il foglio non chiede la password attuale', async () => {
    const utente = userEvent.setup()
    montaPagina(<Settings />, { role: 'athlete', user: APPLE })
    await utente.click(await screen.findByText('Password per il sito'))

    expect(screen.queryByText('Password attuale')).not.toBeInTheDocument()
    // L'indirizzo nascosto da Apple, che nessuno ricorda: è quello da scrivere sul sito.
    expect(screen.getByLabelText('La tua email di accesso')).toHaveValue('x7k2@privaterelay.appleid.com')
  })

  it('🔴 salva la password senza verificarne una che non esiste', async () => {
    const utente = userEvent.setup()
    montaPagina(<Settings />, { role: 'athlete', user: APPLE })
    await utente.click(await screen.findByText('Password per il sito'))
    await utente.type(screen.getByLabelText('Password'), 'segreta123')
    await utente.click(screen.getByText('Salva password'))

    await waitFor(() => expect(finto.supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'segreta123' }))
    expect(await screen.findByText(/Dal computer entra con x7k2@privaterelay\.appleid\.com/)).toBeInTheDocument()
  })

  it('chi ha email e password vede il foglio di sempre', async () => {
    const utente = userEvent.setup()
    montaPagina(<Settings />, { role: 'athlete', user: { ...UTENTE, app_metadata: { providers: ['email'] } } })
    await utente.click(await screen.findByText('Modifica password'))

    expect(screen.getByText('Password attuale')).toBeInTheDocument()
    expect(screen.queryByLabelText('La tua email di accesso')).not.toBeInTheDocument()
  })
})

describe('La voce «Coach» (multi-coach, solo admin)', () => {
  const montaRuolo = (role) => montaPagina(<Settings />, {
    role, user: { ...UTENTE, email: 'federico_leo@hotmail.it' },
  })

  it('🔴 un coach non vede «Coach» né il backup: sono dell\'admin', async () => {
    montaRuolo('coach')
    await screen.findByRole('button', { name: /Codici invito/i })
    expect(screen.queryByRole('button', { name: /^Coach/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Esporta database/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Importa backup atleta/i)).not.toBeInTheDocument()
  })

  it('l\'admin la vede, accanto al backup', async () => {
    montaRuolo('admin')
    expect(await screen.findByRole('button', { name: /^Coach/ })).toBeInTheDocument()
    await apriStrumenti()
    expect(screen.getByRole('button', { name: /Esporta database/i })).toBeInTheDocument()
  })

  it('prima della migrazione il foglio lo dice e non rompe niente', async () => {
    finto.supabase.rpc = vi.fn(() => Promise.resolve({ data: null, error: { message: 'function not found' } }))
    montaRuolo('admin')
    await userEvent.click(await screen.findByRole('button', { name: /^Coach/ }))
    expect(await screen.findByText(/sarà disponibile dopo l'aggiornamento del database/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chiudi' })).toBeInTheDocument()
  })

  it('con l\'elenco: ruolo, numero di atleti, e «Togli» solo per i coach', async () => {
    finto.supabase.rpc = vi.fn(() => Promise.resolve({ data: [
      { email: 'coaching@federicoleo.it', ruolo: 'admin', user_id: 'u-a', nome: 'Federico Leo' },
      { email: 'federico_leo@hotmail.it', ruolo: 'coach', user_id: 'u-c', nome: null },
    ], error: null }))
    montaRuolo('admin')
    await userEvent.click(await screen.findByRole('button', { name: /^Coach/ }))
    expect(await screen.findByText('Federico Leo')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Togli/ })).toHaveLength(1)
  })

  it('se coach_atleti non si legge il numero di atleti è «—», mai 0', async () => {
    finto.supabase.rpc = vi.fn(() => Promise.resolve({ data: [
      { email: 'federico_leo@hotmail.it', ruolo: 'coach', user_id: 'u-c', nome: 'Federico' },
    ], error: null }))
    const fromVero = finto.supabase.from
    finto.supabase.from = vi.fn((t) => t === 'coach_atleti'
      ? { select: () => Promise.resolve({ data: null, error: { message: 'rete assente' } }) }
      : fromVero(t))
    try {
      montaRuolo('admin')
      await userEvent.click(await screen.findByRole('button', { name: /^Coach/ }))
      expect(await screen.findByText(/Coach · — atleti/)).toBeInTheDocument()
      expect(screen.queryByText(/0 atleti/)).toBeNull()
    } finally {
      finto.supabase.from = fromVero
    }
  })
})

describe('Privacy e consenso', () => {
  // L'informativa la deve poter aprire chiunque; il consenso lo può ritirare
  // solo chi l'ha dato, cioè l'atleta (src/lib/consenso.js). Ritirarlo deve
  // essere facile quanto darlo (GDPR art. 7.3).
  const conConsenso = { ...UTENTE, user_metadata: { ...UTENTE.user_metadata, consenso: { versione: 1, il: '2026-10-27T09:30:00Z' } } }

  it('all\'atleta dice quando ha dato il consenso e gli lascia ritirarlo', async () => {
    montaPagina(<Settings />, { role: 'athlete', user: conConsenso })
    expect(await screen.findByText('Consenso dato il 27 ott 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ritira il consenso/i })).toBeInTheDocument()
  })

  it('al coach mostra l\'informativa ma non un consenso che non ha dato', async () => {
    montaCoach()
    expect(await screen.findByRole('button', { name: /Informativa privacy/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ritira il consenso/i })).not.toBeInTheDocument()
  })

  it('🔴 ritirare chiede conferma, azzera il consenso ed esce', async () => {
    const utente = userEvent.setup()
    montaPagina(<Settings />, { role: 'athlete', user: conConsenso })
    await utente.click(await screen.findByRole('button', { name: /Ritira il consenso/i }))
    expect(finto.supabase.auth.updateUser).not.toHaveBeenCalled()

    await utente.click(await screen.findByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(finto.supabase.auth.signOut).toHaveBeenCalled())
    expect(finto.supabase.auth.updateUser).toHaveBeenCalledWith({ data: { consenso: null } })
  })
})
