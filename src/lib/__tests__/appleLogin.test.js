import { describe, it, expect } from 'vitest'
import { webcrypto } from 'node:crypto'
import { generaNonce, nomeDaApple, annullatoDallUtente } from '../appleLogin'

// Perché questi test esistono
// ────────────────────────────
// Sign in with Apple ha tre punti che, sbagliati, non producono nessun errore
// leggibile: il nonce hashato dal lato sbagliato (un 400 che sembra un
// problema di configurazione su Apple), il nome perso per sempre alla prima
// autorizzazione, e l'annullamento mostrato come un guasto.

async function sha256(testo) {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(testo))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

describe('generaNonce', () => {
  // 🔴 IL test di questo file. Il plugin scrive nel token la stringa che gli
  // diamo, Supabase confronta l'HASH di quella che diamo a lui: se le due metà
  // tornassero uguali, il login fallirebbe sempre e il messaggio non direbbe
  // perché. Un `hash: chiaro` di comodo passa qualunque altra asserzione.
  it('hash è lo SHA-256 del valore in chiaro, e i due non coincidono', async () => {
    const nonce = await generaNonce(webcrypto)
    expect(nonce.hash).toBe(await sha256(nonce.chiaro))
    expect(nonce.hash).not.toBe(nonce.chiaro)
  })

  it('due chiamate danno nonce diversi', async () => {
    const [a, b] = [await generaNonce(webcrypto), await generaNonce(webcrypto)]
    expect(a.chiaro).not.toBe(b.chiaro)
  })

  // Senza subtle il login deve ENTRARE lo stesso, senza nonce: un throw qui
  // vorrebbe dire nessun accesso possibile su una WebView che non lo espone.
  it('torna null invece di lanciare quando crypto.subtle non c’è', async () => {
    await expect(generaNonce({ getRandomValues: () => {} })).resolves.toBeNull()
    await expect(generaNonce({})).resolves.toBeNull()
    await expect(generaNonce(undefined)).resolves.toBeDefined()
  })
})

describe('nomeDaApple', () => {
  it('compone nome, cognome e nome completo', () => {
    expect(nomeDaApple({ givenName: 'Marco', familyName: 'Rossi' }))
      .toEqual({ first_name: 'Marco', last_name: 'Rossi', full_name: 'Marco Rossi' })
  })

  it('con il solo nome non lascia uno spazio in coda al nome completo', () => {
    expect(nomeDaApple({ givenName: 'Marco', familyName: null }).full_name).toBe('Marco')
  })

  // Agli accessi successivi Apple manda i due campi a null: scrivere lo stesso
  // in user_metadata cancellerebbe il nome salvato la prima volta.
  it('torna null quando non c’è niente da salvare', () => {
    expect(nomeDaApple({ givenName: null, familyName: null })).toBeNull()
    expect(nomeDaApple({ givenName: '  ', familyName: '' })).toBeNull()
    expect(nomeDaApple(undefined)).toBeNull()
  })
})

describe('annullatoDallUtente', () => {
  it('riconosce la chiusura del foglio di sistema', () => {
    expect(annullatoDallUtente(
      'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)'
    )).toBe(true)
  })

  // Gli altri codici sono guasti veri: inghiottirli rimetterebbe in piedi il
  // difetto dei catch muti (CLAUDE.md §9-quater).
  it('un guasto vero NON passa per un annullamento', () => {
    expect(annullatoDallUtente('AuthorizationError error 1004.')).toBe(false)
    expect(annullatoDallUtente('')).toBe(false)
    expect(annullatoDallUtente(undefined)).toBe(false)
  })
})
