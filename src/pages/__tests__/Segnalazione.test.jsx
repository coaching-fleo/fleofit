import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina, UTENTE } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// Il foglio è coperto da FoglioSegnalazione.test.jsx. Qui c'è l'altra metà:
// che `Settings` lo apra per TUTTI i ruoli (è l'atleta quello che trova i
// problemi), e che lo colleghi alla Edge Function giusta con i dati tecnici
// veri — un nome di funzione sbagliato non dà errore a schermo finché qualcuno
// non prova a spedire, cioè quando ha già un problema.

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({ invitation_codes: [], athletes: [], workouts: [] }))
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

const TESTO = 'Le notifiche arrivano due volte ogni mattina'

beforeEach(() => {
  window.localStorage.clear()
  finto.supabase.functions.invoke.mockReset()
  finto.supabase.functions.invoke.mockImplementation(() => Promise.resolve({ data: { ok: true }, error: null }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/** Da Impostazioni fino al riepilogo di una segnalazione sulle notifiche. */
async function compila(utente) {
  await utente.click(screen.getByRole('button', { name: /Segnala un problema/ }))
  const foglio = screen.getByRole('dialog', { name: 'Segnala un problema' })
  await utente.click(within(foglio).getByRole('button', { name: /Notifiche/ }))
  await utente.click(within(foglio).getByRole('radio', { name: 'Arrivano doppie' }))
  await utente.type(within(foglio).getByRole('textbox', { name: /Descrivi/ }), TESTO)
  await utente.click(within(foglio).getByRole('button', { name: 'Continua' }))
  await utente.click(within(foglio).getByRole('button', { name: 'Invia' }))
}

describe('la riga «Segnala un problema»', () => {
  it('c\'è per l\'atleta, nel gruppo Aiuto', () => {
    montaPagina(<Settings />, { role: 'athlete' })
    const aiuto = screen.getByRole('region', { name: 'Aiuto' })
    expect(within(aiuto).getByRole('button', { name: /Segnala un problema/ })).toBeInTheDocument()
  })

  it('c\'è anche per il coach', () => {
    montaPagina(<Settings />, { role: 'admin', user: { ...UTENTE, email: 'coaching@federicoleo.it' } })
    expect(within(screen.getByRole('region', { name: 'Aiuto' }))
      .getByRole('button', { name: /Segnala un problema/ })).toBeInTheDocument()
  })
})

describe('l\'invio', () => {
  it('chiama la Edge Function «segnalazione» con il corpo e i dati tecnici', async () => {
    const utente = userEvent.setup()
    montaPagina(<Settings />, { role: 'athlete' })
    await compila(utente)
    expect(await screen.findByText('Grazie, Federico la legge')).toBeInTheDocument()
    expect(finto.supabase.functions.invoke).toHaveBeenCalledTimes(1)
    const [nome, { body }] = finto.supabase.functions.invoke.mock.calls[0]
    expect(nome).toBe('segnalazione')
    expect(body.tipo).toBe('notifiche')
    expect(body.descrizione).toBe(TESTO)
    expect(body.risposte).toEqual([{ domanda: 'Cosa succede?', risposta: 'Arrivano doppie' }])
    expect(body.tecnici.Ruolo).toBe('Atleta')
    expect(body.tecnici.Piattaforma).toBe('web')
  })

  it('un errore detto dal server arriva a chi scrive', async () => {
    finto.supabase.functions.invoke.mockImplementation(() =>
      Promise.resolve({ data: { error: 'Troppe segnalazioni, riprova fra un\'ora' }, error: null }))
    const utente = userEvent.setup()
    montaPagina(<Settings />, { role: 'athlete' })
    await compila(utente)
    expect(await screen.findByText('Troppe segnalazioni, riprova fra un\'ora')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument()
  })

  it('un errore di rete senza messaggio dice comunque cosa fare', async () => {
    finto.supabase.functions.invoke.mockImplementation(() =>
      Promise.resolve({ data: null, error: new Error('FunctionsFetchError') }))
    const utente = userEvent.setup()
    montaPagina(<Settings />, { role: 'athlete' })
    await compila(utente)
    expect(await screen.findByText('Invio non riuscito. Riprova tra poco.')).toBeInTheDocument()
  })
})
