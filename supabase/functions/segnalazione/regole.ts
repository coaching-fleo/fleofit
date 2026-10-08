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

  const risposte = c.risposte ?? [];
  if (!Array.isArray(risposte) || risposte.length > 5
    || risposte.some(r => !r || !eStringa(r.domanda) || !eStringa(r.risposta) || r.domanda.length > 200 || r.risposta.length > 200)) {
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
    ...Object.entries(c.tecnici ?? {}).map(([k, v]) => `${k}: ${v}`),
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
    .map(([k, v]) => `<tr><td style="color:#888;padding-right:12px">${escape(k)}</td><td>${escape(v)}</td></tr>`).join('');
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
