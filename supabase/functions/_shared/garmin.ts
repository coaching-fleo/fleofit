// Le chiamate HTTP a Garmin, il rinnovo dei token e lo scollegamento.
//
// Le DECISIONI stanno in `garminRegole.ts` (puro, coperto dai test in
// src/lib/__tests__/garminServer.test.js); qui c'è solo la rete e il database.
// Lo usano `garmin-auth` e, più avanti, il webhook (`scollegaAtleta`).
//
// Secret letti da Deno.env: GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET,
// GARMIN_TOKEN_KEY (AES-GCM, base64 standard di 32 byte).
//
// 🔒 Nessun token, codice, verifier o segreto finisce mai in un log o in un
// messaggio d'errore: gli errori portano solo lo status HTTP.
import { GARMIN, cifra, decifra, permessiDaRisposta, pianoScollegamento, scaduto, urlBackfill, type TipoBackfill } from './garminRegole.ts'
import { GARMIN_TRAINING, idDaRisposta } from './garminTraining.ts'
import type { GarminWorkout } from './workoutGarmin.ts'

/** Il redirect URI registrato sul portale Garmin: il GET di `garmin-auth` è il callback. */
export const REDIRECT_URI = 'https://riyqtcssllupakjtoehj.supabase.co/functions/v1/garmin-auth'

export type Token = {
  access: string
  refresh: string
  accessScadeAt: string | null
  refreshScadeAt: string | null
}

function env(nome: string): string {
  const v = Deno.env.get(nome)
  if (!v) throw new Error(`${nome} non impostata`)
  return v
}

/** Una risposta non 2xx di Garmin: porta lo status (chi chiama lo salva), mai il corpo. */
export class ErroreGarmin extends Error {
  constructor(cosa: string, readonly status: number) {
    super(`Garmin ${cosa}: HTTP ${status}`)
  }
}

/** Ogni risposta non 2xx diventa un errore con lo status (mai il corpo: potrebbe contenere dati). */
async function chiama(cosa: string, url: string, init: RequestInit): Promise<Response> {
  const r = await fetch(url, init)
  if (!r.ok) {
    await r.body?.cancel().catch(() => {})
    throw new ErroreGarmin(cosa, r.status)
  }
  return r
}

const traSecondi = (s: unknown): string | null =>
  typeof s === 'number' && Number.isFinite(s) && s > 0 ? new Date(Date.now() + s * 1000).toISOString() : null

/** POST form-encoded al servizio token, comune a scambio e rinnovo. */
async function chiediToken(campi: Record<string, string>, refreshPrecedente?: string): Promise<Token> {
  const corpo = new URLSearchParams({
    ...campi,
    client_id: env('GARMIN_CLIENT_ID'),
    client_secret: env('GARMIN_CLIENT_SECRET'),
  })
  const r = await chiama(`token (${campi.grant_type})`, GARMIN.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: corpo.toString(),
  })
  // ⚠️ DA VERIFICARE nel portale Garmin (scritto il 28/10/2026 da conoscenza generale):
  // i nomi access_token, refresh_token, expires_in, refresh_token_expires_in.
  const j = await r.json() as {
    access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; refresh_token_expires_in?: unknown
  }
  const access = typeof j.access_token === 'string' ? j.access_token : ''
  // Se Garmin non manda un refresh nuovo, vale ancora quello di prima.
  const refresh = typeof j.refresh_token === 'string' ? j.refresh_token : (refreshPrecedente ?? '')
  if (!access || !refresh) throw new Error('Garmin token: risposta senza token')
  return {
    access,
    refresh,
    accessScadeAt: traSecondi(j.expires_in),
    refreshScadeAt: traSecondi(j.refresh_token_expires_in),
  }
}

/** Il codice del callback diventa una coppia di token (col segreto, solo lato server). */
export function scambiaCodice(
  { codice, verifier, redirectUri }: { codice: string; verifier: string; redirectUri: string },
): Promise<Token> {
  return chiediToken({
    grant_type: 'authorization_code',
    code: codice,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  })
}

export function rinnova(refreshToken: string): Promise<Token> {
  return chiediToken({ grant_type: 'refresh_token', refresh_token: refreshToken }, refreshToken)
}

const autorizzato = (access: string) => ({ Authorization: `Bearer ${access}`, Accept: 'application/json' })

/** L'id dell'utente Garmin (verificato il 28/10/2026: il campo `userId`). */
export async function leggiUtenteId(access: string): Promise<string> {
  const r = await chiama('utente', GARMIN.utenteId, { headers: autorizzato(access) })
  const j = await r.json() as { userId?: unknown }
  if (typeof j.userId !== 'string' || !j.userId) throw new Error('Garmin utente: risposta senza userId')
  return j.userId
}

/** I permessi concessi (verificato il 28/10/2026: un oggetto con `permissions`). */
export async function leggiPermessi(access: string): Promise<string[]> {
  const r = await chiama('permessi', GARMIN.permessi, { headers: autorizzato(access) })
  return permessiDaRisposta(await r.json())
}

/** Toglie la registrazione dell'utente presso Garmin (lancia se Garmin non risponde 2xx). */
export async function cancellaRegistrazione(access: string): Promise<boolean> {
  const r = await chiama('registrazione', GARMIN.registrazione, { method: 'DELETE', headers: autorizzato(access) })
  await r.body?.cancel().catch(() => {})
  return true
}

/**
 * Chiede a Garmin i riepiloghi di un tipo in un intervallo (epoch UTC, in secondi):
 * Garmin risponde 202 e i dati arrivano poi dal Push, non da questa risposta.
 * Verificato sullo Swagger il 28/10/2026 (activities) e il 29/10/2026 (dailies, sleeps, hrv);
 * entrambi i parametri sono obbligatori.
 */
export async function chiediBackfillGarmin(access: string, tipo: TipoBackfill, daSec: number, aSec: number): Promise<void> {
  const r = await chiama(`backfill ${tipo}`, urlBackfill(tipo, daSec, aSec), { headers: autorizzato(access) })
  await r.body?.cancel().catch(() => {})
}

// ── Training API: i workout sull'orologio ─────────────────────────────────
// Gli indirizzi stanno in GARMIN_TRAINING (garminTraining.ts), da verificare
// alla prima prova. Come sopra: nei messaggi d'errore solo lo status.

/** Il corpo di una risposta come JSON, o `null` se è vuoto o non è JSON (Garmin può mandare un numero nudo). */
async function jsonOppureNull(r: Response): Promise<unknown> {
  const t = await r.text()
  if (!t) return null
  try { return JSON.parse(t) } catch { return t.trim() }
}

const conJson = (access: string) => ({ ...autorizzato(access), 'Content-Type': 'application/json' })

/** Crea il workout nella libreria Garmin dell'atleta e ne restituisce l'id. */
export async function creaWorkoutGarmin(access: string, w: GarminWorkout): Promise<string> {
  const r = await chiama('crea workout', GARMIN_TRAINING.workout, {
    method: 'POST', headers: conJson(access), body: JSON.stringify(w),
  })
  const id = idDaRisposta(await jsonOppureNull(r), 'workoutId')
  if (!id) throw new Error('Garmin crea workout: risposta senza workoutId')
  return id
}

/** Toglie il workout (e con lui il suo programma). 404 = già tolto: non è un errore. */
export async function cancellaWorkoutGarmin(access: string, id: string): Promise<void> {
  const r = await fetch(`${GARMIN_TRAINING.workout}/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: autorizzato(access),
  })
  await r.body?.cancel().catch(() => {})
  if (!r.ok && r.status !== 404) throw new ErroreGarmin('cancella workout', r.status)
}

/** Mette il workout nel calendario Garmin in quel giorno (`YYYY-MM-DD`); restituisce l'id del programma. */
export async function programmaGarmin(access: string, workoutId: string, data: string): Promise<string> {
  const r = await chiama('programma', GARMIN_TRAINING.schedule, {
    method: 'POST', headers: conJson(access), body: JSON.stringify({ workoutId: Number(workoutId), date: data }),
  })
  const id = idDaRisposta(await jsonOppureNull(r), 'scheduleId')
  if (!id) throw new Error('Garmin programma: risposta senza scheduleId')
  return id
}

/** Sposta un programma esistente in un altro giorno. */
export async function spostaProgrammaGarmin(access: string, scheduleId: string, workoutId: string, data: string): Promise<void> {
  // ⚠️ DA VERIFICARE alla prima prova (28/10/2026): il corpo del PUT (qui con scheduleId, workoutId e date).
  const r = await chiama('sposta programma', `${GARMIN_TRAINING.schedule}/${encodeURIComponent(scheduleId)}`, {
    method: 'PUT', headers: conJson(access),
    body: JSON.stringify({ scheduleId: Number(scheduleId), workoutId: Number(workoutId), date: data }),
  })
  await r.body?.cancel().catch(() => {})
}

type RigaToken = {
  athlete_id: string
  access_cifrato: string | null
  refresh_cifrato: string | null
  access_scade_at: string | null
}

/**
 * Un access token valido, o `null`. Se è scaduto (o lo sarà fra 5 minuti) lo
 * rinnova e salva i token nuovi cifrati. Se il rinnovo non riesce (token
 * revocato, refresh scaduto) il collegamento diventa `da_ricollegare`.
 */
// deno-lint-ignore no-explicit-any
export async function accessValido(admin: any, riga: RigaToken): Promise<string | null> {
  const chiave = env('GARMIN_TOKEN_KEY')
  if (riga.access_cifrato && !scaduto(riga.access_scade_at, new Date())) {
    try {
      return await decifra(riga.access_cifrato, chiave)
    } catch {
      console.error(`garmin: access di ${riga.athlete_id} non decifrabile, provo a rinnovarlo`)
    }
  }
  try {
    if (!riga.refresh_cifrato) throw new Error('nessun refresh token')
    const t = await rinnova(await decifra(riga.refresh_cifrato, chiave))
    const { error } = await admin.from('garmin_collegamenti').update({
      access_cifrato: await cifra(t.access, chiave),
      refresh_cifrato: await cifra(t.refresh, chiave),
      access_scade_at: t.accessScadeAt,
      refresh_scade_at: t.refreshScadeAt,
      aggiornato_at: new Date().toISOString(),
    }).eq('athlete_id', riga.athlete_id)
    if (error) console.error(`garmin: token rinnovati ma non salvati per ${riga.athlete_id}:`, error.message)
    return t.access
  } catch (e) {
    console.error(`garmin: rinnovo fallito per ${riga.athlete_id}:`, (e as Error).message)
    const { error } = await admin.from('garmin_collegamenti')
      .update({ stato: 'da_ricollegare', aggiornato_at: new Date().toISOString() })
      .eq('athlete_id', riga.athlete_id)
    if (error) console.error(`garmin: stato da_ricollegare non salvato per ${riga.athlete_id}:`, error.message)
    return null
  }
}

/**
 * Riscrive `user_metadata.consenso_garmin` partendo dai metadati RILETTI e
 * riscritti tutti: un oggetto parziale potrebbe cancellare `consenso` (quello
 * generale, senza il quale l'app richiede la schermata).
 */
// deno-lint-ignore no-explicit-any
export async function scriviConsensoGarmin(admin: any, userId: string, valore: { versione: number; il: string } | null): Promise<void> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data?.user) throw new Error(`utente non letto: ${error?.message ?? 'assente'}`)
  const metadati = data.user.user_metadata ?? {}
  const { error: e2 } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { ...metadati, consenso_garmin: valore },
  })
  if (e2) throw new Error(`metadati non salvati: ${e2.message}`)
}

/**
 * Scollega un atleta: avvisa Garmin (se non è stato lui a dircelo), poi
 * cancella SUBITO collegamento, attività, giornate e invii, poi toglie il
 * consenso dai metadati. Un errore con Garmin si logga e si va avanti: non
 * blocca MAI la cancellazione dei dati locali. Se una cancellazione locale
 * fallisce, le altre si fanno comunque e alla fine si lancia (chi chiama
 * risponde con un errore e l'atleta riprova).
 */
// deno-lint-ignore no-explicit-any
export async function scollegaAtleta(admin: any, athleteId: string, origine: 'app' | 'garmin' | 'eliminato'): Promise<void> {
  const piano = pianoScollegamento({ origine })

  if (piano.avvisaGarmin) {
    try {
      const { data: riga, error } = await admin.from('garmin_collegamenti')
        .select('athlete_id, access_cifrato, refresh_cifrato, access_scade_at')
        .eq('athlete_id', athleteId).maybeSingle()
      if (error) throw new Error(`collegamento non letto: ${error.message}`)
      if (riga && (riga.access_cifrato || riga.refresh_cifrato)) {
        const access = await accessValido(admin, riga)
        if (access) await cancellaRegistrazione(access)
        else console.warn(`garmin: nessun token valido per ${athleteId}, Garmin non avvisato`)
      }
    } catch (e) {
      console.error(`garmin: avviso a Garmin fallito per ${athleteId} (${origine}):`, (e as Error).message)
    }
  }

  const falliti: string[] = []
  // Si prova a cancellare TUTTE le tabelle, anche se una fallisce (il
  // collegamento per ultimo, dopo i dati); le tabelle non cancellate finiscono
  // in `falliti` e alla fine si lancia, perché chi chiama lo logghi e risponda
  // con un errore. Nessun nuovo tentativo automatico.
  for (const tabella of ['garmin_invii', 'garmin_attivita', 'garmin_giornate', 'garmin_collegamenti']) {
    try {
      const { error } = await admin.from(tabella).delete().eq('athlete_id', athleteId)
      if (error) throw new Error(error.message)
    } catch (e) {
      console.error(`garmin: ${tabella} non cancellata per ${athleteId}:`, (e as Error).message)
      falliti.push(tabella)
    }
  }

  try {
    await scriviConsensoGarmin(admin, athleteId, null)
  } catch (e) {
    console.error(`garmin: consenso_garmin non tolto per ${athleteId}:`, (e as Error).message)
    falliti.push('metadati')
  }

  if (falliti.length) throw new Error(`scollegamento incompleto: ${falliti.join(', ')}`)
  console.log(`garmin: ${athleteId} scollegato (${origine})`)
}
