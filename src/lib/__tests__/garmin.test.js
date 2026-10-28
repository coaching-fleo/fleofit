import { describe, it, expect, vi } from 'vitest'
import {
  VERSIONE_CONSENSO_GARMIN, leggiStatoGarmin, etichettePermessi, permessiMancanti,
  ritornoGarmin, rottaDaDeepLinkGarmin, MESSAGGI_ESITO, messaggioEsito, dataCollegamento,
} from '../garmin'
import { MOTIVI_ERRORE } from '../../../supabase/functions/_shared/garminRegole.ts'

// Perché questi test esistono
// ────────────────────────────
// Il lato app del collegamento Garmin parla con un server che sta in un altro
// file e con una funzione SQL che prima della migrazione NON esiste. Due cose
// contano più delle altre:
//  1. senza `stato_garmin` (PGRST202) la riga deve sparire, non mostrare un
//     errore: il codice va in produzione prima della migrazione;
//  2. ogni motivo d'errore che il server può rimandare deve avere un messaggio
//     nell'app — un motivo nuovo sul server senza testo qui fa fallire il test.

const finto = (risposta) => ({ rpc: vi.fn(() => Promise.resolve(risposta)) })

describe('leggiStatoGarmin', () => {
  it('🔴 la funzione SQL che manca (PGRST202) → non disponibile, nessun errore', async () => {
    const s = await leggiStatoGarmin(finto({ data: null, error: { code: 'PGRST202' } }), 'a1')
    expect(s.disponibile).toBe(false)
  })

  it('una lettura che lancia → non disponibile', async () => {
    const supabase = { rpc: vi.fn(() => Promise.reject(new Error('rete'))) }
    expect((await leggiStatoGarmin(supabase, 'a1')).disponibile).toBe(false)
  })

  it('nessuna riga → disponibile, non collegato', async () => {
    const supabase = finto({ data: [], error: null })
    expect(await leggiStatoGarmin(supabase, 'a1'))
      .toEqual({ disponibile: true, stato: null, dal: null, permessi: [] })
    expect(supabase.rpc).toHaveBeenCalledWith('stato_garmin', { atleta: 'a1' })
  })

  it('una riga → i suoi campi', async () => {
    const riga = { stato: 'attivo', collegato_at: '2026-11-03T10:00:00Z', permessi: ['ACTIVITY_EXPORT'], invia_workout: true }
    expect(await leggiStatoGarmin(finto({ data: [riga], error: null }), 'a1'))
      .toEqual({ disponibile: true, stato: 'attivo', dal: '2026-11-03T10:00:00Z', permessi: ['ACTIVITY_EXPORT'] })
  })
})

describe('permessi', () => {
  it('etichette nell\'ordine dei permessi noti, gli sconosciuti ignorati', () => {
    expect(etichettePermessi(['WORKOUT_IMPORT', 'X', 'ACTIVITY_EXPORT'])).toEqual(['attività', 'workout all\'orologio'])
  })
  it('i mancanti sono i noti assenti', () => {
    expect(permessiMancanti(['ACTIVITY_EXPORT'])).toEqual(['salute e recupero', 'workout all\'orologio'])
  })
  it('niente permessi → nessuna etichetta, tutti mancanti', () => {
    expect(etichettePermessi(undefined)).toEqual([])
    expect(permessiMancanti(null)).toHaveLength(3)
  })
})

describe('ritorno da Garmin', () => {
  it('sul web il ritorno è l\'origine della pagina', () => {
    expect(ritornoGarmin()).toBe(window.location.origin)
  })

  it('il deep link di Garmin porta in Impostazioni', () => {
    expect(rottaDaDeepLinkGarmin('fleofit://garmin?esito=ok&motivo=x')).toBe('/settings?garmin=ok&motivo=x')
    expect(rottaDaDeepLinkGarmin('fleofit://garmin?esito=errore&motivo=altro_account'))
      .toBe('/settings?garmin=errore&motivo=altro_account')
  })

  it('🔴 non dipende dal parser degli URL (WebView Android vecchie: host vuoto)', () => {
    // Chromium prima della M130 legge `fleofit://garmin?…` come un percorso
    // opaco: hostname '' e pathname '//garmin'. Qui si finge quel parser.
    const Vero = globalThis.URL
    class URLVecchio extends Vero {
      get hostname() { return '' }
      get host() { return '' }
      get pathname() { return '//garmin' }
    }
    vi.stubGlobal('URL', URLVecchio)
    try {
      expect(rottaDaDeepLinkGarmin('fleofit://garmin?esito=ok&motivo=x')).toBe('/settings?garmin=ok&motivo=x')
      expect(rottaDaDeepLinkGarmin('FLEOFIT://garmin/?esito=errore#x')).toBe('/settings?garmin=errore')
      expect(rottaDaDeepLinkGarmin('fleofit://garmin')).toBe('/settings?garmin=errore')
      expect(rottaDaDeepLinkGarmin('fleofit://garminx?esito=ok')).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('🔴 il link del login e ogni altro indirizzo NON sono di Garmin', () => {
    expect(rottaDaDeepLinkGarmin('fleofit://login-callback#access_token=abc&refresh_token=def')).toBeNull()
    expect(rottaDaDeepLinkGarmin('https://x/garmin')).toBeNull()
    expect(rottaDaDeepLinkGarmin('non un url')).toBeNull()
    expect(rottaDaDeepLinkGarmin(undefined)).toBeNull()
  })
})

describe('messaggi dell\'esito', () => {
  it('🔴 ogni motivo d\'errore del server ha il suo messaggio', () => {
    for (const motivo of MOTIVI_ERRORE) {
      expect(MESSAGGI_ESITO.motivi[motivo], motivo).toBeTruthy()
    }
  })

  it('ok, motivi noti e un motivo sconosciuto', () => {
    expect(messaggioEsito('ok')).toEqual({
      title: 'Garmin collegato',
      message: 'I dati del tuo Garmin arriveranno a FLEOFIT dalla prossima sincronizzazione.',
      type: 'success',
    })
    expect(messaggioEsito('errore', 'altro_account').message)
      .toBe('Questo account Garmin è già collegato a un altro atleta.')
    expect(messaggioEsito('errore', 'scaduto').message).toBe('Il collegamento è rimasto aperto troppo a lungo: riprova.')
    expect(messaggioEsito('errore', 'garmin').message).toBe('Garmin non ha risposto: riprova fra qualche minuto.')
    expect(messaggioEsito('errore', 'boh').message).toBe(MESSAGGI_ESITO.errore.testo)
    expect(messaggioEsito('errore', 'boh').type).toBe('error')
  })
})

describe('varie', () => {
  it('la versione del consenso è 1', () => expect(VERSIONE_CONSENSO_GARMIN).toBe(1))
  it('la data del collegamento come quella del consenso', () => {
    expect(dataCollegamento('2026-11-03T10:00:00Z')).toBe('3 nov 2026')
    expect(dataCollegamento(null)).toBeNull()
    expect(dataCollegamento('non una data')).toBeNull()
  })
})
