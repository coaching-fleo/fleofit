import { describe, it, expect } from 'vitest'
import {
  GARMIN, PERMESSI_NOTI, MOTIVI_ERRORE, generaPkce, sfidaPkce, generaState, urlAutorizzazione,
  ritornoValido, urlRitorno, esitoCallback, cifra, decifra, leggiNotifiche, pianoScollegamento, scaduto,
  stessoSegreto, atletaEliminato, ammessoAllaProva,
} from '../../../supabase/functions/_shared/garminRegole.ts'

// Perché questi test esistono
// ────────────────────────────
// Le regole del collegamento Garmin stanno in un file puro (`garminRegole.ts`,
// senza import Deno né rete) per poterle provare qui. Tre cose contano:
//  1. il ritorno (`ritornoValido`) decide dove rimandiamo l'utente con un
//     esito: un'origine confrontata «a pezzi» è un open redirect;
//  2. `esitoCallback` impedisce che un account Garmin già di un atleta venga
//     agganciato a un altro, e che un `state` vecchio sia riusabile;
//  3. i token Garmin stanno nel database: se `cifra`/`decifra` sbagliano, o
//     sono deterministiche, la cifratura non protegge niente.

const MIN = 60_000
const ADESSO = new Date('2026-10-28T12:00:00Z')
const fa = (min) => new Date(ADESSO.getTime() - min * MIN).toISOString()
const riga = (min = 1, extra = {}) => ({ athlete_id: 'atleta-1', pkce_at: fa(min), ...extra })

describe('costanti', () => {
  it('gli indirizzi sono https e i permessi noti quelli attesi', () => {
    for (const k of ['autorizza', 'token', 'utenteId', 'permessi', 'registrazione']) {
      expect(GARMIN[k]).toMatch(/^https:\/\//)
    }
    expect(PERMESSI_NOTI).toEqual(['ACTIVITY_EXPORT', 'HEALTH_EXPORT', 'WORKOUT_IMPORT'])
    expect(MOTIVI_ERRORE).toEqual(['annullato', 'scaduto', 'altro_account', 'garmin'])
  })
})

describe('PKCE', () => {
  it('il verifier ha 64 caratteri base64url', async () => {
    const { verifier } = await generaPkce()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{64}$/)
  })

  it('la sfida è la SHA-256 del verifier (esempio di RFC 7636)', async () => {
    expect(await sfidaPkce('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'))
      .toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('generaPkce usa la sfida del proprio verifier', async () => {
    const { verifier, sfida } = await generaPkce()
    expect(sfida).toBe(await sfidaPkce(verifier))
  })

  it('generaState: 32 byte, ogni volta diverso', () => {
    const a = generaState()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generaState()).not.toBe(a)
  })
})

describe('urlAutorizzazione', () => {
  it('porta S256, state e redirect_uri codificato', () => {
    const u = urlAutorizzazione({ clientId: 'cid', sfida: 'sf', state: 'st', redirectUri: 'https://x.it/cb?a=1' })
    expect(u.startsWith(GARMIN.autorizza)).toBe(true)
    expect(u).toContain('response_type=code')
    expect(u).toContain('code_challenge_method=S256')
    expect(u).toContain('state=st')
    expect(u).toContain('redirect_uri=' + encodeURIComponent('https://x.it/cb?a=1'))
  })
})

describe('ritornoValido', () => {
  it('app e origini esatte sì', () => {
    expect(ritornoValido('app', [])).toBe(true)
    expect(ritornoValido('https://fleofit.vercel.app', [])).toBe(true)
    expect(ritornoValido('http://localhost:5173', [])).toBe(true)
    expect(ritornoValido('https://staging.esempio.it', ['https://staging.esempio.it'])).toBe(true)
  })
  it('imitazioni e indirizzi no', () => {
    expect(ritornoValido('https://fleofit.vercel.app.evil.com', [])).toBe(false)
    expect(ritornoValido('https://fleofit.vercel.app/settings', [])).toBe(false)
    expect(ritornoValido('http://localhost:5174', [])).toBe(false)
    expect(ritornoValido('https://staging.esempio.it', [])).toBe(false)
    expect(ritornoValido('', [])).toBe(false)
    expect(ritornoValido(undefined, [])).toBe(false)
  })
})

describe('urlRitorno', () => {
  it('app → deep link', () => {
    expect(urlRitorno('app', 'errore', 'annullato')).toBe('fleofit://garmin?esito=errore&motivo=annullato')
    expect(urlRitorno('app', 'ok')).toBe('fleofit://garmin?esito=ok')
  })
  it('origine → /settings', () => {
    expect(urlRitorno('http://localhost:5173', 'ok')).toBe('http://localhost:5173/settings?garmin=ok')
    expect(urlRitorno('https://fleofit.vercel.app', 'errore', 'scaduto'))
      .toBe('https://fleofit.vercel.app/settings?garmin=errore&motivo=scaduto')
  })
})

describe('esitoCallback', () => {
  it('riga mancante → scaduto', () => {
    expect(esitoCallback({ riga: null, adesso: ADESSO, garminUserIdGiaDi: null })).toEqual({ ok: false, motivo: 'scaduto' })
  })
  it('16 minuti → scaduto, 14 → ok', () => {
    expect(esitoCallback({ riga: riga(16), adesso: ADESSO, garminUserIdGiaDi: null })).toEqual({ ok: false, motivo: 'scaduto' })
    expect(esitoCallback({ riga: riga(14), adesso: ADESSO, garminUserIdGiaDi: null })).toEqual({ ok: true })
  })
  it('pkce_at assente → scaduto', () => {
    expect(esitoCallback({ riga: riga(1, { pkce_at: null }), adesso: ADESSO, garminUserIdGiaDi: null })).toEqual({ ok: false, motivo: 'scaduto' })
  })
  it('account Garmin già di un altro atleta → altro_account', () => {
    expect(esitoCallback({ riga: riga(), adesso: ADESSO, garminUserIdGiaDi: 'altro-atleta' })).toEqual({ ok: false, motivo: 'altro_account' })
  })
  it('lo stesso atleta che ricollega → ok', () => {
    expect(esitoCallback({ riga: riga(), adesso: ADESSO, garminUserIdGiaDi: 'atleta-1' })).toEqual({ ok: true })
  })
})

describe('cifra / decifra', () => {
  const chiave = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))
  const altra = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)))
  it('andata e ritorno', async () => {
    expect(await decifra(await cifra('token segreto', chiave), chiave)).toBe('token segreto')
  })
  it('due cifrature dello stesso testo sono diverse', async () => {
    expect(await cifra('x', chiave)).not.toBe(await cifra('x', chiave))
  })
  it('con un\'altra chiave rifiuta', async () => {
    const c = await cifra('x', chiave)
    await expect(decifra(c, altra)).rejects.toThrow()
  })
})

describe('leggiNotifiche', () => {
  it('le due forme', () => {
    const r = leggiNotifiche({
      deregistrations: [{ userId: 'u1' }, { userId: 'u2' }],
      userPermissionsChange: [{ userId: 'u3', permissions: ['ACTIVITY_EXPORT'] }],
    })
    expect(r.revoche).toEqual(['u1', 'u2'])
    expect(r.permessi).toEqual([{ garminUserId: 'u3', permessi: ['ACTIVITY_EXPORT'] }])
  })
  it('input strani → liste vuote, mai eccezioni', () => {
    const vuoto = { revoche: [], permessi: [] }
    expect(leggiNotifiche(null)).toEqual(vuoto)
    expect(leggiNotifiche('ciao')).toEqual(vuoto)
    expect(leggiNotifiche({ activities: [{ userId: 'u' }] })).toEqual(vuoto)
    expect(leggiNotifiche({ deregistrations: 'no', userPermissionsChange: [null, { userId: 5 }] })).toEqual(vuoto)
  })
})

describe('pianoScollegamento', () => {
  it('Garmin non va avvisato se è stato lui a dircelo', () => {
    expect(pianoScollegamento({ origine: 'app' })).toEqual({ avvisaGarmin: true, cancellaDati: true })
    expect(pianoScollegamento({ origine: 'eliminato' })).toEqual({ avvisaGarmin: true, cancellaDati: true })
    expect(pianoScollegamento({ origine: 'garmin' })).toEqual({ avvisaGarmin: false, cancellaDati: true })
  })
})

describe('scaduto', () => {
  it('null → scaduto; margine di 5 minuti', () => {
    expect(scaduto(null, ADESSO)).toBe(true)
    expect(scaduto(new Date(ADESSO.getTime() + 10 * MIN).toISOString(), ADESSO)).toBe(false)
    expect(scaduto(new Date(ADESSO.getTime() + 4 * MIN).toISOString(), ADESSO)).toBe(true)
  })
})

describe('stessoSegreto', () => {
  it('vale solo per lo stesso segreto', () => {
    expect(stessoSegreto('abc123', 'abc123')).toBe(true)
    expect(stessoSegreto('abc124', 'abc123')).toBe(false)
    expect(stessoSegreto('abc12', 'abc123')).toBe(false)
    expect(stessoSegreto('abc1234', 'abc123')).toBe(false)
  })
  it('un segreto vuoto o mancante non vale mai', () => {
    expect(stessoSegreto('', '')).toBe(false)
    expect(stessoSegreto('', undefined)).toBe(false)
    expect(stessoSegreto('x', '')).toBe(false)
    expect(stessoSegreto(null, 'x')).toBe(false)
  })
})

describe('atletaEliminato', () => {
  // Il trigger manda SOLO identificatori (niente righe intere): per `athletes`
  // record e old_record sono `{ id }`. Che deleted_at sia passato da null a un
  // valore lo garantisce la clausola WHEN del trigger, non il corpo.
  const corpo = { type: 'UPDATE', table: 'athletes', record: { id: 'a1' }, old_record: { id: 'a1' } }
  it('legge l\'atleta dal corpo minimo del trigger', () => {
    expect(atletaEliminato(corpo)).toBe('a1')
  })
  it('null per tutto il resto', () => {
    expect(atletaEliminato(null)).toBeNull()
    expect(atletaEliminato({ ...corpo, type: 'INSERT' })).toBeNull()
    expect(atletaEliminato({ ...corpo, table: 'workouts' })).toBeNull()
    expect(atletaEliminato({ ...corpo, record: { id: '' } })).toBeNull()
    expect(atletaEliminato({ ...corpo, record: null })).toBeNull()
  })
})

describe('ammessoAllaProva', () => {
  // GARMIN_ATLETI_PROVA: finché Garmin non approva l'app in produzione, solo gli
  // atleti elencati possono avviare il collegamento. Vuoto o assente = tutti.
  it('senza elenco (o elenco vuoto) sono ammessi tutti', () => {
    expect(ammessoAllaProva('a1', undefined)).toBe(true)
    expect(ammessoAllaProva('a1', '')).toBe(true)
    expect(ammessoAllaProva('a1', '  , ,')).toBe(true)
  })
  it('con un elenco, solo chi ci sta', () => {
    expect(ammessoAllaProva('a1', 'a1')).toBe(true)
    expect(ammessoAllaProva('a2', ' a1 , a2 ')).toBe(true)
    expect(ammessoAllaProva('a3', 'a1,a2')).toBe(false)
  })
  it('niente confronti a pezzi', () => {
    expect(ammessoAllaProva('a', 'a1')).toBe(false)
    expect(ammessoAllaProva('a1', 'a12')).toBe(false)
    expect(ammessoAllaProva('', 'a1')).toBe(false)
  })
})
