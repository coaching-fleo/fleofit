import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { montaPagina, UTENTE } from '../../test/montaPagina'
import { TESTO_CONSENSO_GARMIN, MESSAGGI_ESITO, GARMIN_IN_ARRIVO } from '../../lib/garmin'

// Perché questi test esistono
// ────────────────────────────
// La riga Garmin in Impostazioni va in produzione PRIMA della migrazione: senza
// `stato_garmin` (PGRST202) non deve esserci, né rotta né con un errore
// (Review Focus 2). E il consenso è separato: «Collega» resta spento finché la
// casella non è spuntata, perché è quella spunta a renderlo un consenso.

const ctrl = await vi.hoisted(async () => ({ stato: { valore: [] } }))

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({ 'rpc:stato_garmin': ctrl.stato.valore }))
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

/** Mostra l'indirizzo corrente, per vedere che il `?garmin=` sparisce. */
function Indirizzo() {
  const l = useLocation()
  return <output data-testid="indirizzo">{l.pathname + l.search}</output>
}

const montaAtleta = (opzioni = {}) => montaPagina(<><Settings /><Indirizzo /></>, { role: 'athlete', ...opzioni })

const COLLEGATO = [{ stato: 'attivo', collegato_at: '2026-11-03T10:00:00Z', permessi: ['ACTIVITY_EXPORT', 'HEALTH_EXPORT'], invia_workout: true }]

beforeEach(() => {
  finto.chiamate.length = 0
  window.localStorage.clear()
  ctrl.stato.valore = []
  finto.supabase.rpc.mockClear()
  finto.supabase.functions.invoke.mockReset()
  finto.supabase.functions.invoke.mockImplementation(() => Promise.resolve({ data: null, error: null }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('La riga Garmin in Impostazioni', () => {
  it('🔴 senza la funzione SQL (PGRST202) la riga non c\'è', async () => {
    ctrl.stato.valore = { error: { code: 'PGRST202' } }
    montaAtleta()
    await waitFor(() => expect(finto.supabase.rpc).toHaveBeenCalledWith('stato_garmin', { atleta: UTENTE.id }))
    // Un giro in più: lo stato si scrive dopo la risposta.
    await screen.findByRole('button', { name: /Informativa privacy/ })
    expect(screen.queryByText(/Garmin/)).not.toBeInTheDocument()
  })

  it('non collegato: «Collega» spento finché la casella del consenso è vuota', async () => {
    const utente = userEvent.setup()
    montaAtleta()
    const riga = await screen.findByRole('button', { name: /Garmin Connect/ })
    expect(within(riga).getByText('Non collegato')).toBeInTheDocument()

    await utente.click(riga)
    const foglio = await screen.findByRole('dialog', { name: 'Garmin Connect' })
    const collega = within(foglio).getByRole('button', { name: 'Collega' })
    expect(collega).toBeDisabled()

    await utente.click(within(foglio).getByRole('checkbox', { name: TESTO_CONSENSO_GARMIN }))
    expect(collega).toBeEnabled()

    // Senza `url` nella risposta niente si apre; qui conta cosa si chiede al server.
    await utente.click(collega)
    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('garmin-auth', {
      body: { azione: 'inizia', consenso: 1, ritorno: window.location.origin },
    }))
    // Il finto risponde senza `url`: non si resta zitti, lo dice un CustomAlert.
    expect(await screen.findByText(/Non siamo riusciti ad avviare il collegamento/)).toBeInTheDocument()
  })

  it('🔴 prima dell\'approvazione di Garmin (403 non_ancora): «Garmin in arrivo», non un errore', async () => {
    // Come supabase-js: un FunctionsHttpError con la Response in `context`.
    const errore = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: { status: 403, json: () => Promise.resolve({ error: 'non_ancora' }) },
    })
    finto.supabase.functions.invoke.mockImplementation(() => Promise.resolve({ data: null, error: errore }))
    const utente = userEvent.setup()
    montaAtleta()
    await utente.click(await screen.findByRole('button', { name: /Garmin Connect/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Garmin Connect' })
    await utente.click(within(foglio).getByRole('checkbox', { name: TESTO_CONSENSO_GARMIN }))
    await utente.click(within(foglio).getByRole('button', { name: 'Collega' }))

    expect(await screen.findByText(GARMIN_IN_ARRIVO.titolo)).toBeInTheDocument()
    expect(screen.getByText(GARMIN_IN_ARRIVO.testo)).toBeInTheDocument()
    expect(screen.queryByText(/Non siamo riusciti ad avviare il collegamento/)).not.toBeInTheDocument()
  })

  it('collegato: data, permessi, e «Scollega» chiede conferma', async () => {
    ctrl.stato.valore = COLLEGATO
    const utente = userEvent.setup()
    montaAtleta()
    const riga = await screen.findByRole('button', { name: /Garmin Connect/ })
    expect(within(riga).getByText('Collegato · dal 3 nov 2026')).toBeInTheDocument()

    await utente.click(riga)
    const foglio = await screen.findByRole('dialog', { name: 'Garmin Connect' })
    expect(within(foglio).getByText('Hai autorizzato: attività, salute e recupero')).toBeInTheDocument()

    await utente.click(within(foglio).getByRole('button', { name: 'Scollega' }))
    expect(finto.supabase.functions.invoke).not.toHaveBeenCalled()
    // Dopo lo scollegamento la lettura fallisce: la riga deve restare, «Non collegato».
    ctrl.stato.valore = { error: { message: 'rete assente' } }
    await utente.click(await screen.findByRole('button', { name: 'Sì, scollega' }))
    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('garmin-auth', {
      body: { azione: 'scollega' },
    }))
    expect(await screen.findByText('Garmin scollegato')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /Garmin Connect/ })).getByText('Non collegato')).toBeInTheDocument()
  })

  it('collegato: l\'interruttore dei workout c\'è; spegnerlo chiama garmin-training', async () => {
    ctrl.stato.valore = COLLEGATO
    finto.supabase.functions.invoke.mockImplementation(() => Promise.resolve({ data: { ok: true, invia_workout: false }, error: null }))
    const utente = userEvent.setup()
    montaAtleta()
    await utente.click(await screen.findByRole('button', { name: /Garmin Connect/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Garmin Connect' })
    expect(within(foglio).getByText('Le corse che ti assegna il coach compaiono nel calendario di Garmin')).toBeInTheDocument()
    const sw = within(foglio).getByRole('switch', { name: 'Manda i workout all\'orologio' })
    expect(sw).toHaveAttribute('aria-checked', 'true')

    await utente.click(sw)
    await waitFor(() => expect(finto.supabase.functions.invoke).toHaveBeenCalledWith('garmin-training', {
      body: { azione: 'invia_workout', acceso: false },
    }))
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false'))
    expect(within(foglio).getByText('Quelle già mandate per i prossimi giorni vengono tolte')).toBeInTheDocument()
  })

  it('🔴 un doppio tocco chiama garmin-training una volta sola', async () => {
    ctrl.stato.valore = COLLEGATO
    let rispondi
    finto.supabase.functions.invoke.mockImplementation(() => new Promise(r => { rispondi = () => r({ data: { ok: true }, error: null }) }))
    const utente = userEvent.setup()
    montaAtleta()
    await utente.click(await screen.findByRole('button', { name: /Garmin Connect/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Garmin Connect' })
    const sw = within(foglio).getByRole('switch', { name: 'Manda i workout all\'orologio' })
    await utente.click(sw)
    await utente.click(sw)
    expect(finto.supabase.functions.invoke).toHaveBeenCalledTimes(1)
    rispondi()
    await waitFor(() => expect(sw).toBeEnabled())
  })

  it('non collegato: nessun interruttore', async () => {
    const utente = userEvent.setup()
    montaAtleta()
    await utente.click(await screen.findByRole('button', { name: /Garmin Connect/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Garmin Connect' })
    expect(within(foglio).queryByRole('switch')).not.toBeInTheDocument()
  })

  it('🔴 se garmin-training fallisce l\'interruttore torna acceso e un avviso lo dice', async () => {
    ctrl.stato.valore = COLLEGATO
    finto.supabase.functions.invoke.mockImplementation(() => Promise.resolve({ data: null, error: new Error('500') }))
    const utente = userEvent.setup()
    montaAtleta()
    await utente.click(await screen.findByRole('button', { name: /Garmin Connect/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Garmin Connect' })
    const sw = within(foglio).getByRole('switch', { name: 'Manda i workout all\'orologio' })
    await utente.click(sw)
    expect(await screen.findByText(/Non siamo riusciti a cambiare l'impostazione/)).toBeInTheDocument()
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('da ricollegare: lo dice la riga, e il foglio offre «Collega di nuovo»', async () => {
    ctrl.stato.valore = [{ ...COLLEGATO[0], stato: 'da_ricollegare' }]
    const utente = userEvent.setup()
    montaAtleta()
    const riga = await screen.findByRole('button', { name: /Garmin Connect/ })
    expect(within(riga).getByText('Da ricollegare')).toBeInTheDocument()
    await utente.click(riga)
    const foglio = await screen.findByRole('dialog', { name: 'Garmin Connect' })
    expect(within(foglio).getByRole('button', { name: 'Collega di nuovo' })).toBeInTheDocument()
  })

  it('staff e admin in «Simula atleta» non hanno la riga', async () => {
    ctrl.stato.valore = COLLEGATO
    const { unmount } = montaPagina(<Settings />, { role: 'coach', user: { ...UTENTE, email: 'coach@fleofit.it' } })
    await screen.findByRole('button', { name: /Informativa privacy/ })
    expect(screen.queryByText(/Garmin/)).not.toBeInTheDocument()
    unmount()

    window.localStorage.setItem('adminRoleOverride', 'athlete')
    montaAtleta()
    await screen.findByRole('button', { name: /Informativa privacy/ })
    expect(screen.queryByText(/Garmin/)).not.toBeInTheDocument()
    expect(finto.supabase.rpc).not.toHaveBeenCalled()
  })

  it('🔴 il ritorno da Garmin con un errore: il messaggio, e il parametro sparisce', async () => {
    montaAtleta({ percorso: '/settings?garmin=errore&motivo=altro_account', rotta: '/settings' })
    expect(await screen.findByText(MESSAGGI_ESITO.motivi.altro_account)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('indirizzo')).toHaveTextContent(/^\/settings$/))
  })
})
