// Le regole del collegamento Garmin, senza Deno né rete.
//
// Stanno in un file PURO perché così le provano i test
// (`src/lib/__tests__/garminServer.test.js`) e le importano sia le Edge Function
// sia l'app (`MOTIVI_ERRORE`). Solo API web standard: crypto, TextEncoder, URL,
// btoa/atob.

// ── Indirizzi di Garmin ───────────────────────────────────────────────────
// ⚠️ DA VERIFICARE nel portale Garmin (scritto il 28/10/2026 da conoscenza
// generale: la documentazione pubblica non li riporta). Ognuno è marcato.
export const GARMIN = {
  // ⚠️ DA VERIFICARE nel portale Garmin (scritto il 28/10/2026 da conoscenza generale della Connect Developer Program)
  autorizza: 'https://connect.garmin.com/oauth2Confirm',
  // ⚠️ DA VERIFICARE nel portale Garmin (scritto il 28/10/2026 da conoscenza generale della Connect Developer Program)
  token: 'https://diauth.garmin.com/di-oauth2-service/oauth/token',
  // ⚠️ DA VERIFICARE nel portale Garmin (scritto il 28/10/2026 da conoscenza generale della Connect Developer Program)
  utenteId: 'https://apis.garmin.com/wellness-api/rest/user/id',
  // ⚠️ DA VERIFICARE nel portale Garmin (scritto il 28/10/2026 da conoscenza generale della Connect Developer Program)
  permessi: 'https://apis.garmin.com/wellness-api/rest/user/permissions',
  // ⚠️ DA VERIFICARE nel portale Garmin (scritto il 28/10/2026 da conoscenza generale della Connect Developer Program)
  registrazione: 'https://apis.garmin.com/wellness-api/rest/user/registration',
};

export const PERMESSI_NOTI = ['ACTIVITY_EXPORT', 'HEALTH_EXPORT', 'WORKOUT_IMPORT'];

/** Le origini web sempre ammesse come ritorno (sito e sviluppo locale); altre arrivano da `extra` (GARMIN_ORIGINI_EXTRA). */
const ORIGINI_FISSE = ['https://fleofit.vercel.app', 'http://localhost:5173'];

export const MOTIVI_ERRORE = ['annullato', 'scaduto', 'altro_account', 'garmin'];

const MINUTI_PKCE = 15;

// ── base64 / base64url ────────────────────────────────────────────────────
const aBase64Url = (byte: Uint8Array) => btoa(String.fromCharCode(...byte))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const daBase64 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

// ── PKCE ──────────────────────────────────────────────────────────────────
/** base64url(SHA-256(verifier)), senza padding (RFC 7636). */
export async function sfidaPkce(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return aBase64Url(new Uint8Array(hash));
}

export async function generaPkce(): Promise<{ verifier: string; sfida: string }> {
  // 48 byte → 64 caratteri base64url
  const verifier = aBase64Url(crypto.getRandomValues(new Uint8Array(48)));
  return { verifier, sfida: await sfidaPkce(verifier) };
}

export const generaState = (): string => aBase64Url(crypto.getRandomValues(new Uint8Array(32)));

export function urlAutorizzazione(
  { clientId, sfida, state, redirectUri }: { clientId: string; sfida: string; state: string; redirectUri: string },
): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    code_challenge: sfida,
    code_challenge_method: 'S256',
    state,
    redirect_uri: redirectUri,
  });
  return `${GARMIN.autorizza}?${q.toString()}`;
}

// ── Dove si torna ─────────────────────────────────────────────────────────
/** `'app'` oppure un'origine ESATTA (mai un indirizzo, mai un prefisso). */
export function ritornoValido(ritorno: unknown, extra: string[] = []): boolean {
  if (typeof ritorno !== 'string' || !ritorno) return false;
  return ritorno === 'app' || ORIGINI_FISSE.includes(ritorno) || extra.includes(ritorno);
}

/** ⚠️ NON valida `ritorno`: chi chiama deve prima passare da `ritornoValido`. */
export function urlRitorno(ritorno: string, esito: 'ok' | 'errore', motivo?: string): string {
  const m = motivo ? `&motivo=${encodeURIComponent(motivo)}` : '';
  if (ritorno === 'app') return `fleofit://garmin?esito=${esito}${m}`;
  return `${ritorno}/settings?garmin=${esito}${m}`;
}

// ── Il ritorno di Garmin ──────────────────────────────────────────────────
type RigaPkce = { athlete_id: string; pkce_at: string | null } | null | undefined;

export function esitoCallback(
  { riga, adesso, garminUserIdGiaDi }: { riga: RigaPkce; adesso: Date; garminUserIdGiaDi: string | null },
): { ok: true } | { ok: false; motivo: 'scaduto' | 'altro_account' } {
  const inizio = riga?.pkce_at ? new Date(riga.pkce_at).getTime() : NaN;
  if (!riga || !Number.isFinite(inizio) || adesso.getTime() - inizio > MINUTI_PKCE * 60_000) {
    return { ok: false, motivo: 'scaduto' };
  }
  if (garminUserIdGiaDi && garminUserIdGiaDi !== riga.athlete_id) {
    return { ok: false, motivo: 'altro_account' };
  }
  return { ok: true };
}

// ── Cifratura dei token (AES-GCM, IV da 12 byte in testa) ─────────────────
const chiaveAes = (chiaveB64: string) =>
  crypto.subtle.importKey('raw', daBase64(chiaveB64), 'AES-GCM', false, ['encrypt', 'decrypt']);

/** `chiaveB64`: base64 standard di 32 byte (`GARMIN_TOKEN_KEY`). */
export async function cifra(testo: string, chiaveB64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dati = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chiaveAes(chiaveB64), new TextEncoder().encode(testo));
  const tutto = new Uint8Array(12 + dati.byteLength);
  tutto.set(iv, 0);
  tutto.set(new Uint8Array(dati), 12);
  return btoa(String.fromCharCode(...tutto));
}

/** Stessa chiave di `cifra` (base64 standard di 32 byte, `GARMIN_TOKEN_KEY`); con una chiave sbagliata lancia. */
export async function decifra(cifrato: string, chiaveB64: string): Promise<string> {
  const tutto = daBase64(cifrato);
  const dati = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: tutto.slice(0, 12) }, await chiaveAes(chiaveB64), tutto.slice(12),
  );
  return new TextDecoder().decode(dati);
}

// ── Le notifiche push di Garmin ───────────────────────────────────────────
// ⚠️ DA VERIFICARE nel portale Garmin (scritto il 28/10/2026 da conoscenza generale):
// i nomi dei campi `deregistrations` e `userPermissionsChange`.
const eStringa = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function leggiNotifiche(corpo: unknown): { revoche: string[]; permessi: { garminUserId: string; permessi: string[] }[] } {
  const out = { revoche: [] as string[], permessi: [] as { garminUserId: string; permessi: string[] }[] };
  if (!corpo || typeof corpo !== 'object') return out;
  const c = corpo as Record<string, unknown>;
  if (Array.isArray(c.deregistrations)) {
    for (const d of c.deregistrations) {
      const id = (d as { userId?: unknown } | null)?.userId;
      if (eStringa(id)) out.revoche.push(id);
    }
  }
  if (Array.isArray(c.userPermissionsChange)) {
    for (const p of c.userPermissionsChange) {
      const o = p as { userId?: unknown; permissions?: unknown } | null;
      if (eStringa(o?.userId)) {
        out.permessi.push({
          garminUserId: o!.userId as string,
          permessi: Array.isArray(o!.permissions) ? o!.permissions.filter(eStringa) : [],
        });
      }
    }
  }
  return out;
}

/** Garmin va avvisato di uno scollegamento tranne quando è stato lui a comunicarcelo. */
export const pianoScollegamento = (
  { origine }: { origine: 'app' | 'garmin' | 'eliminato' },
): { avvisaGarmin: boolean; cancellaDati: true } => ({ avvisaGarmin: origine !== 'garmin', cancellaDati: true });

/** Il token è da rinnovare? `null` = sconosciuto = sì. Margine di 5 minuti. */
export function scaduto(scadeAt: string | null, adesso: Date, margineS = 300): boolean {
  if (!scadeAt) return true;
  const t = new Date(scadeAt).getTime();
  return !Number.isFinite(t) || t - adesso.getTime() < margineS * 1000;
}
