// risultato-hyrox — il tempo di un atleta a una gara HYROX già corsa, letto da
// results.hyrox.com, perché l'app lo proponga («è tuo questo tempo?») invece
// di chiederlo a mano. Fase 2 delle gare HYROX (docs/memoria/calendario.md).
//
// Doubles e staffette si trovano per cognome di un componente, con
// `search_event` (vedi `urlRicerca`).
//
// Tre richieste:
//   { azione: 'gare' } → { gare: [{ gruppo, stagione, etichetta, anno, citta }] }
//       l'elenco di tutte le gare di tutte le stagioni, per «le tue gare
//       passate» (una pagina per stagione, copia di 12 ore). ⚠️ Senza date:
//       il sito non le dà, il giorno lo sceglie l'atleta.
//   { azione: 'dettaglio', stagione, idp, evento } → { stato, dettaglio }
//       tempo, posizioni e split della riga che l'atleta ha scelto
//   { gruppo, stagione, cognome, nome? } → come sotto, su una gara già scelta
//   { citta, data, cognome, nome? } → cerca prima la gara, poi il cognome.
// Le ultime due cercano SOLO IL COGNOME e tornano la lista intera (fino a 60
// righe, individuali e squadre): l'atleta sceglie chi è. Rispondono:
//   { stato: 'trovato', gruppo, candidati: [...] }   — uno o più risultati
//   { stato: 'nessun-risultato', gruppo }             — gara trovata, nome no
//                                                       (o risultati non ancora pubblicati)
//   { stato: 'gara-non-trovata' }                     — la gara non è sul sito
// La funzione NON scrive niente: salva il telefono, dopo la conferma
// dell'atleta (gli omonimi esistono).
//
// Perché una funzione NUOVA: `main` non la chiama, pubblicarla non tocca la
// web app (CLAUDE.md §1.1). Nessun secret, nessuna tabella.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import {
  BASE, leggiCategorie, leggiDettaglio, leggiGruppi, leggiRicerca, leggiStagioni,
  garePassate, ordinaCandidati, ordineStagioni, trovaGruppo, urlDettaglio, urlRicerca, validaRichiesta,
  validaDettaglio, validaRicercaDiretta, type GaraPassata, type Riga,
} from "./regole.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const risposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const INTESTAZIONI = {
  // ⚠️ Senza un User-Agent da browser il sito (dietro Cloudflare) risponde 403.
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  'Accept': 'text/html',
  'Accept-Language': 'en',
};

async function pagina(url: string): Promise<string> {
  const r = await fetch(url, { headers: INTESTAZIONI, signal: AbortSignal.timeout(12_000) });
  if (!r.ok) throw new Error(`results.hyrox.com ha risposto ${r.status}`);
  return r.text();
}

/** `n` lavori alla volta: il sito è di altri, non va colpito con 15 richieste insieme. */
async function aGruppi<T, R>(cose: T[], n: number, fai: (x: T) => Promise<R>): Promise<R[]> {
  const esiti: R[] = new Array(cose.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, cose.length) }, async () => {
    while (i < cose.length) { const k = i++; esiti[k] = await fai(cose[k]); }
  }));
  return esiti;
}

// Una stessa domanda nei 30 minuti successivi non riparte verso il sito: chi
// riapre la scheda della gara non deve costare altre 20 richieste.
const DURATA_COPIA = 30 * 60_000;
const copie = new Map<string, { corpo: unknown, scade: number }>();

// Un limite in memoria per utente: 12 ricerche l'ora bastano a chi cerca il
// proprio tempo, e fermano un ciclo che martellerebbe il sito.
const richieste = new Map<string, number[]>();
function consenti(utente: string): boolean {
  const adesso = Date.now();
  const recenti = (richieste.get(utente) || []).filter(t => adesso - t < 3_600_000);
  if (recenti.length >= 12) return false;
  recenti.push(adesso);
  richieste.set(utente, recenti);
  return true;
}

/** Il `sub` del JWT: la firma l'ha già verificata il gateway (verify_jwt = true). */
function utenteDa(req: Request): string {
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || 'anonimo';
  } catch { return 'anonimo'; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return risposta({ error: 'Metodo non ammesso' }, 405);

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return risposta({ error: 'Richiesta non valida' }, 400); }

  if (corpo?.azione === 'gare') return elencoGare();
  if (corpo?.azione === 'dettaglio') {
    const errore = validaDettaglio(corpo);
    if (errore) return risposta({ error: errore }, 400);
    const chiave = ['d', corpo.stagione, corpo.idp, corpo.evento].join('|');
    const copia = copie.get(chiave);
    if (copia && copia.scade > Date.now()) return risposta(copia.corpo);
    try {
      return ricorda(chiave, await dettaglio(Number(corpo.stagione), String(corpo.idp), String(corpo.evento)));
    } catch (e) {
      console.error('risultato-hyrox (dettaglio):', e);
      return risposta({ error: 'Risultati HYROX non raggiungibili' }, 502);
    }
  }

  const diretta = typeof corpo?.gruppo === 'string';
  const errore = diretta ? validaRicercaDiretta(corpo) : validaRichiesta(corpo);
  if (errore) return risposta({ error: errore }, 400);
  const cognome = String(corpo.cognome).trim();
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';

  const chiave = (diretta ? [corpo.stagione, corpo.gruppo, cognome, nome] : [corpo.citta, corpo.data, cognome, nome])
    .map(x => String(x).toLowerCase()).join('|');
  const copia = copie.get(chiave);
  if (copia && copia.scade > Date.now()) return risposta(copia.corpo);

  if (!consenti(utenteDa(req))) return risposta({ error: "Troppe ricerche, riprova fra un'ora" }, 429);

  try {
    if (diretta) {
      return ricorda(chiave, await cercaInGruppo(Number(corpo.stagione), String(corpo.gruppo), cognome, nome));
    }
    // La stagione e il gruppo della gara, da città e data
    const citta = String(corpo.citta);
    const data = String(corpo.data);
    const home = await pagina(`${BASE}/`);
    const stagioni = leggiStagioni(home);
    if (stagioni.length === 0) throw new Error('nessuna stagione riconosciuta: il sito è cambiato?');
    let stagione = 0;
    let gruppo: string | null = null;
    for (const s of ordineStagioni(stagioni, data)) {
      const html = s.numero === stagioni[0].numero ? home : await pagina(`${BASE}/season-${s.numero}/`);
      gruppo = trovaGruppo(leggiGruppi(html), citta, data.slice(0, 4));
      if (gruppo) { stagione = s.numero; break; }
    }
    if (!gruppo) return ricorda(chiave, { stato: 'gara-non-trovata' });
    return ricorda(chiave, await cercaInGruppo(stagione, gruppo, cognome, nome));
  } catch (e) {
    console.error('risultato-hyrox:', e);
    return risposta({ error: 'Risultati HYROX non raggiungibili' }, 502);
  }
});

/**
 * Cerca il COGNOME in tutte le categorie di una gara, e torna la lista intera:
 * l'atleta sceglie chi è (12/10/2026: «legga solo il cognome, mi dà la lista e
 * seleziono io»). Il nome serve solo a mettere prima le righe più probabili.
 * Il dettaglio di una riga si chiede a parte, quando l'atleta la tocca.
 */
async function cercaInGruppo(stagione: number, gruppo: string, cognome: string, nome: string) {
  const lista = await pagina(`${BASE}/season-${stagione}/?${new URLSearchParams({ pid: 'list', pidp: 'ranking_nav', event_main_group: gruppo })}`);
  const categorie = leggiCategorie(lista);
  if (categorie.length === 0) return { stato: 'gara-non-trovata' };
  const trovate: (Riga & { divisione: string })[] = [];
  await aGruppi(categorie, 5, async (c) => {
    try {
      for (const r of leggiRicerca(await pagina(urlRicerca(stagione, gruppo, c.codice, cognome)))) {
        if (!trovate.some(x => x.idp === r.idp)) trovate.push({ ...r, divisione: c.nome });
      }
    } catch (e) { console.warn(`risultato-hyrox: categoria ${c.codice} non letta:`, e); }
  });
  if (trovate.length === 0) return { stato: 'nessun-risultato', gruppo };
  // Un cognome comune in una gara grande dà decine di righe: 60 bastano per
  // trovarsi, e il telefono non deve ricevere una classifica.
  return { stato: 'trovato', gruppo, stagione, candidati: ordinaCandidati(trovate, cognome, nome).slice(0, 60) };
}

/** Il dettaglio di una riga scelta: tempo, posizioni, split. */
async function dettaglio(stagione: number, idp: string, evento: string) {
  const url = urlDettaglio(stagione, idp, evento);
  const d = leggiDettaglio(await pagina(url));
  return d ? { stato: 'trovato', dettaglio: { ...d, url } } : { stato: 'nessun-risultato' };
}

// L'elenco di tutte le gare cambia solo quando ne finisce una: 12 ore bastano.
let elenco: { gare: GaraPassata[], scade: number } | null = null;

async function elencoGare() {
  if (elenco && elenco.scade > Date.now()) return risposta({ gare: elenco.gare });
  try {
    const home = await pagina(`${BASE}/`);
    const stagioni = leggiStagioni(home);
    if (stagioni.length === 0) throw new Error('nessuna stagione riconosciuta: il sito è cambiato?');
    const perStagione = await aGruppi(stagioni, 4, async (s) => {
      try {
        const html = s.numero === stagioni[0].numero ? home : await pagina(`${BASE}/season-${s.numero}/`);
        return garePassate(leggiGruppi(html), s);
      } catch (e) {
        console.warn(`risultato-hyrox: stagione ${s.numero} non letta:`, e);
        return [];
      }
    });
    const gare = perStagione.flat();
    elenco = { gare, scade: Date.now() + 12 * 3_600_000 };
    return risposta({ gare });
  } catch (e) {
    console.error('risultato-hyrox (elenco):', e);
    if (elenco) return risposta({ gare: elenco.gare });
    return risposta({ error: 'Risultati HYROX non raggiungibili' }, 502);
  }
}

function ricorda(chiave: string, corpo: unknown) {
  copie.set(chiave, { corpo, scade: Date.now() + DURATA_COPIA });
  return risposta(corpo);
}
