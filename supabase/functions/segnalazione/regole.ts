// Le regole della Edge Function `segnalazione`, senza Deno né rete.
//
// Stanno in un file a parte e PURO perché così Vitest le prova da
// `src/lib/__tests__/segnalazioneServer.test.js`: lì un test verifica anche
// che LIMITI e TIPI_VALIDI coincidano con quelli di `src/lib/segnalazione.js`.
// Due copie dello stesso limite sono accettabili solo se qualcosa le confronta
// (stessa idea di `colori.test.js`).

export const LIMITI = {
  descrizioneMin: 10,
  descrizioneMax: 4000,
  immaginiMax: 3,
  byteImmagineMax: 1_572_864,
  byteTecniciMax: 2048,
};

export const TITOLI_TIPO: Record<string, string> = {
  bug: 'Qualcosa non funziona',
  lenta: 'Si blocca o è lenta',
  notifiche: 'Notifiche',
  timer: 'Timer e allenamento',
  accesso: 'Accesso e account',
  idea: "Un'idea",
};

export const TIPI_VALIDI = Object.keys(TITOLI_TIPO);

// ── Niente link né codice (committente, 08/10/2026) ───────────────────────
// ⚠️ IDENTICHE a quelle di `src/lib/segnalazione.js`: un test fa passare gli
// stessi casi da tutte e due. Qui però è il server, ed è lui che decide.
// eslint-disable-next-line no-control-regex -- i caratteri di controllo sono proprio ciò che si cerca
const CARATTERI_PROIBITI = new RegExp('[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]');
const CODICE = /<\s*\/?\s*[a-z!?]/i;
const LINK = /(https?:\/\/|ftp:\/\/|javascript:|www\.|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b[a-z0-9-]{2,}\.(com|it|net|org|io|ly|me|co|app|xyz|ru|cn|info|biz|link|click|top|site|online|shop|eu|de|fr|uk|us|tk|gl|gg|to|be)\b)/i;

/** Il messaggio d'errore se il testo contiene qualcosa che non deve partire, o `null`. */
export function testoProibito(testo: unknown): string | null {
  const t = String(testo ?? '');
  if (CARATTERI_PROIBITI.test(t)) return 'Il testo contiene caratteri non ammessi';
  if (CODICE.test(t)) return 'Il testo non può contenere codice';
  if (LINK.test(t)) return 'Togli i link e gli indirizzi: non si possono inviare';
  return null;
}

/**
 * I dati tecnici non si rifiutano (uno user agent strano non deve bloccare
 * una segnalazione vera), ma un link lì dentro non deve diventare cliccabile
 * nella posta: i client di posta trasformano in link anche il testo semplice.
 */
export const disinnesca = (v: unknown) => String(v ?? '')
  .replace(new RegExp(CARATTERI_PROIBITI.source, 'g'), '')
  .replace(/:\/\//g, '[:]//')
  .replace(/www\./gi, (m) => `${m.slice(0, 3)}[.]`)
  .replace(/@/g, '[at]');

type Risposta = { domanda: string; risposta: string };
type Immagine = { nome: string; base64: string };
export type Corpo = {
  tipo: string;
  risposte: Risposta[];
  descrizione: string;
  tecnici: Record<string, string>;
  immagini: Immagine[];
};

/** Byte di un base64 decodificato, senza decodificarlo. */
const byteBase64 = (b64: string) => Math.floor((b64.replace(/=+$/, '').length * 3) / 4);

const eStringa = (v: unknown): v is string => typeof v === 'string';

/** `null` se il corpo va bene, altrimenti il messaggio da rimandare all'app. */
export function validaCorpo(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== 'object') return 'Richiesta non valida';
  const c = corpo as Partial<Corpo>;
  if (!eStringa(c.tipo) || !TIPI_VALIDI.includes(c.tipo)) return 'Tipo di segnalazione non valido';

  const testo = eStringa(c.descrizione) ? c.descrizione.trim() : '';
  if (testo.length < LIMITI.descrizioneMin) return `Scrivi almeno ${LIMITI.descrizioneMin} caratteri`;
  if (testo.length > LIMITI.descrizioneMax) return 'Massimo 4.000 caratteri';
  const proibito = testoProibito(testo);
  if (proibito) return proibito;

  const risposte = c.risposte ?? [];
  if (!Array.isArray(risposte) || risposte.length > 5
    || risposte.some(r => !r || !eStringa(r.domanda) || !eStringa(r.risposta) || r.domanda.length > 200 || r.risposta.length > 200
      || testoProibito(r.domanda) || testoProibito(r.risposta))) {
    return 'Risposte non valide';
  }

  const immagini = c.immagini ?? [];
  if (!Array.isArray(immagini)) return 'Immagini non valide';
  if (immagini.length > LIMITI.immaginiMax) return `Massimo ${LIMITI.immaginiMax} immagini`;
  if (immagini.some(i => !i || !eStringa(i.nome) || !eStringa(i.base64) || !/^[A-Za-z0-9+/]*=*$/.test(i.base64))) {
    return 'Immagini non valide';
  }
  // Solo JPEG: «/9j/» è FF D8 FF, l'inizio di ogni JPEG. Il telefono manda
  // solo quelli (riduciImmagine); qualunque altra cosa l'ha costruita qualcuno
  // a mano, e finirebbe come allegato nella posta del coach.
  if (immagini.some(i => !i.base64.startsWith('/9j/'))) return 'Allega solo immagini';
  if (immagini.some(i => byteBase64(i.base64) > LIMITI.byteImmagineMax)) return 'Un\'immagine è troppo grande';

  const tecnici = c.tecnici ?? {};
  if (typeof tecnici !== 'object' || Array.isArray(tecnici)) return 'Dati tecnici non validi';
  if (new TextEncoder().encode(JSON.stringify(tecnici)).length > LIMITI.byteTecniciMax) return 'Dati tecnici troppo lunghi';

  return null;
}

/** Gli allegati per Resend. Il nome lo decide il server: quello del telefono non arriva mai nella posta. */
export const allegati = (immagini: Immagine[] = []) =>
  immagini.map((i, n) => ({ filename: `screenshot-${n + 1}.jpg`, content: i.base64 }));

/**
 * Il corpo della chiamata a Resend.
 * ⚠️ Niente `reply_to`: alle segnalazioni non si risponde (committente,
 * 08/10/2026). Chi ha scritto resta comunque nel testo, alla riga «Da:».
 */
export function messaggioResend(
  c: Corpo,
  { nome, email, mittente, destinatario }: { nome: string; email: string; mittente: string; destinatario: string },
) {
  return {
    from: mittente,
    to: [destinatario],
    subject: oggettoSegnalazione(c.tipo, nome),
    text: testoSegnalazione(c, nome, email),
    html: htmlSegnalazione(c, nome, email),
    attachments: allegati(c.immagini),
  };
}

export const oggettoSegnalazione = (tipo: string, nome: string) =>
  `[FLEOFIT] ${TITOLI_TIPO[tipo] ?? 'Segnalazione'} · ${nome}`;

export function testoSegnalazione(c: Corpo, nome: string, email: string): string {
  const righe = [
    `Da: ${nome} <${email}>`,
    `Tipo: ${TITOLI_TIPO[c.tipo] ?? c.tipo}`,
    '',
    ...(c.risposte ?? []).map(r => `${r.domanda} ${r.risposta}`),
    ...(c.risposte?.length ? [''] : []),
    c.descrizione.trim(),
    '',
    '— Dati tecnici —',
    ...Object.entries(c.tecnici ?? {}).map(([k, v]) => `${disinnesca(k)}: ${disinnesca(v)}`),
  ];
  if (c.immagini?.length) righe.push('', `Screenshot allegati: ${c.immagini.length}`);
  return righe.join('\n');
}

const escape = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** La stessa mail in HTML. TUTTO ciò che arriva dall'app passa da `escape`. */
export function htmlSegnalazione(c: Corpo, nome: string, email: string): string {
  const risposte = (c.risposte ?? [])
    .map(r => `<li><span style="color:#888">${escape(r.domanda)}</span> ${escape(r.risposta)}</li>`).join('');
  const tecnici = Object.entries(c.tecnici ?? {})
    .map(([k, v]) => `<tr><td style="color:#888;padding-right:12px">${escape(disinnesca(k))}</td><td>${escape(disinnesca(v))}</td></tr>`).join('');
  return [
    '<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111">',
    `<p style="margin:0 0 4px"><b>${escape(TITOLI_TIPO[c.tipo] ?? c.tipo)}</b></p>`,
    `<p style="margin:0 0 16px;color:#555">Da ${escape(nome)} &lt;${escape(email)}&gt;</p>`,
    risposte ? `<ul style="margin:0 0 16px;padding-left:18px">${risposte}</ul>` : '',
    `<p style="white-space:pre-wrap;margin:0 0 20px">${escape(c.descrizione.trim())}</p>`,
    c.immagini?.length ? `<p style="color:#555">Screenshot allegati: ${c.immagini.length}</p>` : '',
    `<table style="font-size:12px;border-top:1px solid #ddd;padding-top:8px">${tecnici}</table>`,
    '</div>',
  ].join('');
}

/**
 * Al massimo `max` invii per utente in `finestraMs`.
 *
 * ⚠️ È in MEMORIA dell'istanza: si azzera quando Supabase la ricicla, e due
 * istanze in parallelo non si vedono. È una protezione dal doppio tocco e
 * dall'abuso distratto, non da un attacco: per quello servirebbe una tabella,
 * e lo schema è congelato (CLAUDE.md regola 0-bis).
 */
export function limitatore(max = 5, finestraMs = 3_600_000) {
  const invii = new Map<string, number[]>();
  return {
    consenti(id: string, ora = Date.now()): boolean {
      const recenti = (invii.get(id) ?? []).filter(t => ora - t < finestraMs);
      if (recenti.length >= max) { invii.set(id, recenti); return false; }
      recenti.push(ora);
      invii.set(id, recenti);
      return true;
    },
  };
}

// ── Il limite che sopravvive alla funzione ────────────────────────────────
// `limitatore` vive in memoria e si azzera quando Supabase ricicla l'istanza.
// Questo invece si appoggia agli `app_metadata` dell'utente (un campo che
// esiste già, e che l'utente NON può scrivere: lo cambia solo il service role),
// quindi vale fra un'istanza e l'altra senza una tabella nuova (regola 0-bis).
export const LIMITI_INVIO = { perOra: 3, perGiorno: 10 };
const ORA_MS = 3_600_000;
const GIORNO_MS = 24 * ORA_MS;

/**
 * Si può inviare adesso? `storico` sono gli istanti (ms) degli invii riusciti.
 * Torna anche lo storico da salvare: solo le ultime 24 ore, più l'invio di adesso.
 * Uno storico rovinato non blocca nessuno: si riparte da vuoto.
 */
export function controllaInvii(storico: unknown, ora = Date.now(), limiti = LIMITI_INVIO) {
  const puliti = (Array.isArray(storico) ? storico : [])
    .filter((t): t is number => typeof t === 'number' && Number.isFinite(t) && t > 0 && t <= ora && ora - t < GIORNO_MS);
  const nellOra = puliti.filter(t => ora - t < ORA_MS).length;
  if (nellOra >= limiti.perOra) {
    return { consentito: false, messaggio: `Hai già inviato ${limiti.perOra} segnalazioni nell'ultima ora. Riprova più tardi.`, storico: puliti };
  }
  if (puliti.length >= limiti.perGiorno) {
    return { consentito: false, messaggio: `Hai raggiunto il massimo di ${limiti.perGiorno} segnalazioni al giorno. Riprova domani.`, storico: puliti };
  }
  return { consentito: true, messaggio: null, storico: [...puliti, ora] };
}
