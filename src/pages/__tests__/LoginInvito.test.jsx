import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'
import Login from '../Login'

// Perché questi test esistono
// ────────────────────────────
// Il rework del 04/09/2026 sposta il codice invito da PORTA D'INGRESSO a
// DOMANDA FINALE: il benvenuto offre solo modi di entrare, e il codice si
// chiede al passo 2, a chi serve. Sono cambiati insieme il numero di
// schermate, chi le apre e cosa succede quando il database dice di no — cioè
// esattamente le cose che a mano si provano una volta e poi mai più, perché
// per rifarle bisogna bruciare un codice invito vero sul database di
// produzione (CLAUDE.md regola 0-bis: non c'è staging).

const CODICE_VALIDO = { code: '7KQ2M4XB' }
const stato = { codici: [CODICE_VALIDO], errore: [] }

const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  const { vi: v } = await import('vitest')
  const f = fintoSupabase(
    () => ({ invitation_codes: globalThis.__codiciFinti ?? [] }),
    { erroreSu: () => globalThis.__erroreFinto ?? [] },
  )
  f.supabase.auth.getSession = v.fn(() => Promise.resolve({ data: { session: null } }))
  f.supabase.auth.onAuthStateChange = v.fn(() => ({ data: { subscription: { unsubscribe: v.fn() } } }))
  f.supabase.auth.signInWithPassword = v.fn(() => Promise.resolve({ data: {}, error: { message: 'Invalid login credentials' } }))
  f.supabase.auth.signUp = v.fn(() => Promise.resolve({ data: {}, error: null }))
  f.supabase.auth.signInWithOAuth = v.fn(() => Promise.resolve({ data: { url: null }, error: null }))
  return f
})

vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn(), close: vi.fn(() => Promise.resolve()) } }))
vi.mock('@capacitor-community/apple-sign-in', () => ({ SignInWithApple: { authorize: vi.fn() } }))

/** Scrive il codice nelle caselle come farebbe la tastiera. */
const scrivi = (utente, testo) => utente.type(screen.getByLabelText('Codice invito'), testo)

beforeEach(() => {
  globalThis.__codiciFinti = stato.codici
  globalThis.__erroreFinto = []
  stato.codici = [CODICE_VALIDO]
  localStorage.clear()
  finto.chiamate.length = 0
  vi.clearAllMocks()
})

describe('Il benvenuto', () => {
  // 🔴 È tutta la sostanza del rework: il bivio chiedeva all'utente una cosa
  // che l'utente non sa. Rimetterlo non romperebbe nient'altro.
  it('🔴 non chiede più di scegliere fra «Accedi» e «Nuovo Utente»', () => {
    montaPagina(<Login />)
    expect(screen.queryByRole('button', { name: 'Accedi' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nuovo Utente/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continua con Google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continua con email/i })).toBeInTheDocument()
  })

  // Il codice non è più un muro, ma va detto PRIMA che qualcuno lo cerchi:
  // «Lo chiediamo dopo» è la mezza riga che toglie l'ansia dell'ingresso.
  it('dice che il codice servirà, e che lo si chiede dopo', () => {
    montaPagina(<Login />)
    expect(screen.getByText(/Lo chiediamo dopo/i)).toBeInTheDocument()
  })
})

describe('Il passo 2 — il codice', () => {
  const apriPasso2 = async () => {
    const utente = userEvent.setup()
    montaPagina(<Login />, { percorso: '/login?serve=invito', rotta: '/login' })
    await screen.findByLabelText('Codice invito')
    return utente
  }

  // 🔴 Senza bottone «Prosegui»: la lunghezza è fissa e si vede, e un tocco in
  // più su un campo manifestamente pieno si legge come «non ha funzionato».
  it('🔴 alla ottava lettera la verifica parte da sola', async () => {
    const utente = await apriPasso2()
    await scrivi(utente, '7KQ2M4X')

    expect(finto.chiamateA('invitation_codes', 'select')).toHaveLength(0)

    await scrivi(utente, 'B')
    await waitFor(() => expect(finto.chiamateA('invitation_codes', 'select')).toHaveLength(1))
    expect(await screen.findByText(/Invito valido/i)).toBeInTheDocument()
  })

  // 🔴 Il codice verificato resta a schermo finché il profilo non esiste: era
  // il difetto vecchio — veniva messo da parte e non si vedeva più, quindi chi
  // si fermava a metà non sapeva più cosa aveva perso.
  it('🔴 l’invito accettato mostra il codice, e lo mette da parte per il cancello', async () => {
    const utente = await apriPasso2()
    await scrivi(utente, '7kq2m4xb')

    expect(await screen.findByText('7KQ2M4XB')).toBeInTheDocument()
    expect(localStorage.getItem('fleofit_invite_code')).toBe('7KQ2M4XB')
  })

  // ⚠️ La minuscola arriva davvero: la tastiera iOS parte in maiuscolo, ma
  // chi incolla la scavalca. Se il maiuscolo lo facesse solo `autoCapitalize`,
  // il codice partirebbe minuscolo verso una `eq()` che distingue le lettere.
  it('un codice scritto minuscolo cerca comunque quello maiuscolo', async () => {
    const utente = await apriPasso2()
    await scrivi(utente, '7kq2m4xb')

    await waitFor(() => expect(finto.chiamateA('invitation_codes', 'eq')).not.toHaveLength(0))
    expect(finto.chiamateA('invitation_codes', 'eq')[0].args).toEqual(['code', '7KQ2M4XB'])
  })

  // 🔴 Un codice rifiutato non manda avanti, e il messaggio porta ENTRAMBI i
  // rimedi: la RLS non distingue «non esiste» da «già usato» (la policy filtra
  // `used_by is null`), quindi indovinarne uno solo manderebbe metà delle
  // persone a rifare una cosa che hanno già fatto.
  it('🔴 un codice rifiutato lo dice, e non apre il profilo', async () => {
    stato.codici = []
    globalThis.__codiciFinti = []
    const utente = await apriPasso2()
    await scrivi(utente, 'V9DTR1LP')

    expect(await screen.findByText(/non è valido, o è già stato usato/i)).toBeInTheDocument()
    expect(screen.queryByText(/Invito valido/i)).not.toBeInTheDocument()
    expect(localStorage.getItem('fleofit_invite_code')).toBeNull()
  })

  // 🔴 Una lettura fallita NON è un codice sbagliato, e i due rimedi sono
  // opposti: «chiedine uno nuovo» contro «riprova fra un momento». È la
  // ragione per cui la query usa `maybeSingle()` e non `single()`, che
  // riporterebbe l'assenza di righe come un errore.
  it('🔴 la rete caduta non accusa il codice', async () => {
    globalThis.__erroreFinto = ['invitation_codes']
    const utente = await apriPasso2()
    await scrivi(utente, '7KQ2M4XB')

    expect(await screen.findByText(/Non riusciamo a verificare il codice/i)).toBeInTheDocument()
    expect(screen.queryByText(/già stato usato/i)).not.toBeInTheDocument()
  })

  // Chi arriva da `ProtectedRoute` ha già detto chi è: la schermata lo ripete,
  // perché «non c'è ancora un profilo» senza un nome è un'accusa generica.
  it('dice per quale indirizzo manca il profilo', async () => {
    localStorage.setItem('fleofit_invito_atteso', JSON.stringify({ email: 'marco.riva@gmail.com', provider: 'google' }))
    montaPagina(<Login />, { percorso: '/login?serve=invito', rotta: '/login' })

    expect(await screen.findByText(/marco\.riva@gmail\.com/)).toBeInTheDocument()
  })

  // 🔴 «Non ho un codice» aveva una sola risposta possibile: chiudere l'app.
  it('🔴 «Non ho un codice» ha una risposta, e riporta indietro', async () => {
    const utente = await apriPasso2()
    await utente.click(screen.getByRole('button', { name: /Non ho un codice/i }))

    const foglio = await screen.findByRole('dialog', { name: /Non ho un codice/i })
    expect(foglio).toHaveTextContent(/chiedigli il codice invito/i)
    expect(screen.getByRole('button', { name: /Torna al codice/i })).toBeInTheDocument()
  })
})

describe('Il link del coach', () => {
  // 🔴 È il percorso normale di un invito, ed è quello che il link esiste per
  // accorciare: chi lo apre non deve vedere le caselle nemmeno per un istante.
  it('🔴 salta le caselle e arriva sull’invito già accettato', async () => {
    montaPagina(<Login />, { percorso: '/login?invite=7KQ2M4XB', rotta: '/login' })

    expect(await screen.findByText(/Invito valido/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Codice invito')).not.toBeInTheDocument()
  })

  // Nessuna email in mano: si torna a chiedere COME entrare, invece di
  // mostrare una card «Il tuo profilo» con un indirizzo inventato dentro.
  it('senza sapere chi sei, ripropone i modi per entrare', async () => {
    montaPagina(<Login />, { percorso: '/login?invite=7KQ2M4XB', rotta: '/login' })

    await screen.findByText(/Invito valido/i)
    expect(screen.getByRole('button', { name: /Continua con Google/i })).toBeInTheDocument()
    expect(screen.queryByText(/Il tuo profilo/i)).not.toBeInTheDocument()
  })
})

describe('Il passo 1 — l’email', () => {
  // 🔴 Supabase non dice se un account esiste (è la difesa contro
  // l'enumerazione degli indirizzi): password sbagliata e profilo inesistente
  // tornano lo stesso «Invalid login credentials». Quindi il ramo non si
  // indovina — si offrono le due uscite, o una delle due metà resta chiusa
  // fuori senza sapere perché.
  it('🔴 quando l’accesso fallisce offre ENTRAMBE le uscite', async () => {
    const utente = userEvent.setup()
    montaPagina(<Login />)
    await utente.click(screen.getByRole('button', { name: /Continua con email/i }))
    await utente.type(screen.getByLabelText('Email'), 'marco.riva@gmail.com')
    await utente.type(screen.getByLabelText('Password'), 'sbagliata')
    await utente.click(screen.getByRole('button', { name: /Continua/i }))

    expect(await screen.findByRole('button', { name: /Password dimenticata$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ho un codice invito/i })).toBeInTheDocument()
  })

  it('«Ho un codice invito» porta al passo 2 con l’email già scritta', async () => {
    const utente = userEvent.setup()
    montaPagina(<Login />)
    await utente.click(screen.getByRole('button', { name: /Continua con email/i }))
    await utente.type(screen.getByLabelText('Email'), 'marco.riva@gmail.com')
    await utente.type(screen.getByLabelText('Password'), 'sbagliata')
    await utente.click(screen.getByRole('button', { name: /Continua/i }))
    await utente.click(await screen.findByRole('button', { name: /Ho un codice invito/i }))

    expect(await screen.findByLabelText('Codice invito')).toBeInTheDocument()
    expect(screen.getByText(/marco\.riva@gmail\.com/)).toBeInTheDocument()
  })

  // Sul percorso email il profilo nasce qui, e la password si sceglie DOPO che
  // l'invito è stato accettato: chiederla prima vorrebbe dire farla scrivere a
  // chi poi scoprirà di non poter entrare.
  it('dopo il codice valido si sceglie la password e nasce il profilo', async () => {
    const utente = userEvent.setup()
    montaPagina(<Login />)
    await utente.click(screen.getByRole('button', { name: /Continua con email/i }))
    await utente.type(screen.getByLabelText('Email'), 'marco.riva@gmail.com')
    await utente.type(screen.getByLabelText('Password'), 'sbagliata')
    await utente.click(screen.getByRole('button', { name: /Continua/i }))
    await utente.click(await screen.findByRole('button', { name: /Ho un codice invito/i }))
    await scrivi(utente, '7KQ2M4XB')

    await utente.clear(await screen.findByLabelText('Scegli una password'))
    await utente.type(screen.getByLabelText('Scegli una password'), 'nuova-password')
    await utente.click(screen.getByRole('button', { name: /Crea il profilo/i }))

    await waitFor(() => expect(finto.supabase.auth.signUp).toHaveBeenCalled())
    const inviato = finto.supabase.auth.signUp.mock.calls[0][0]
    expect(inviato.email).toBe('marco.riva@gmail.com')
    expect(inviato.options.emailRedirectTo).toContain('inviteCode=7KQ2M4XB')
  })
})
