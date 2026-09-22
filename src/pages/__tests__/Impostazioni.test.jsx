import { describe, it, expect, vi, beforeEach } from 'vitest'
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
    // 3 righe in `athletes` e 2 in `workouts` nel finto Supabase.
    expect(await screen.findByText('3 atleti · 2 workout')).toBeInTheDocument()
  })

  it('🔴 un export riuscito lascia la data, e la riga la ricorda', async () => {
    montaCoach()
    await userEvent.click(await screen.findByRole('button', { name: /Esporta database/i }))
    await waitFor(() => expect(window.localStorage.getItem(CHIAVE_ULTIMO_EXPORT)).toBeTruthy())
    expect(await screen.findByText(/Ultimo export/)).toBeInTheDocument()
  })

  it('🔴 il ripristino totale è fuori dal gruppo e DICE che sovrascrive', async () => {
    // Prima aveva lo stesso aspetto di «Esporta»: due righe grigie identiche
    // di cui una può cancellare il lavoro di un anno. La conferma esisteva
    // già; quello che mancava era che il rischio si vedesse prima del tocco.
    montaCoach()
    const riga = screen.getByRole('button', { name: /Ripristina database totale/i })
    expect(within(riga).getByText('Sovrascrive tutti i dati esistenti')).toBeInTheDocument()
    expect(riga.className).toMatch(/red/)
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
