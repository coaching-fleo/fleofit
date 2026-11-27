// Banco di prova del piano IA (spec 2026-11-27-pushfit-ai-design.md §8.2).
//
// Perché esiste: le risposte dell'IA non sono deterministiche e non possono
// stare in `npm test`. Qui si misurano qualità, token, costo e tempo di ogni
// modello candidato sugli stessi 30 utenti INVENTATI (casi.mjs), con lo
// stesso validatore che userà l'app. Mai dati veri, mai chiavi in un file.
//
// Uso (da la cartella del progetto):
//   npx jiti tools/prova-piano-ia/prova.mjs --secco
//       gratis: controlla solo la scelta del programma, senza IA
//   ANTHROPIC_API_KEY=… npx jiti tools/prova-piano-ia/prova.mjs --compito adattamento --modello claude-sonnet-5-5 [--solo caso-01]
//   ANTHROPIC_API_KEY=… npx jiti tools/prova-piano-ia/prova.mjs --compito analisi --modello claude-haiku-5-5
//   GROQ_API_KEY=… npx jiti tools/prova-piano-ia/prova.mjs --compito analisi --modello openai/gpt-oss-120b
//   npx jiti tools/prova-piano-ia/prova.mjs --giudizio 2026-11-27
//       il foglio alla cieca per i coach, dai risultati di quel giorno
// ⚠️ I compiti con --modello COSTANO soldi veri: si lanciano con il sì del committente.

import { mkdirSync, writeFileSync, readdirSync, readFileSync, appendFileSync } from 'node:fs'
import { perCaso } from './perCaso.mjs'
import { validaRisposte, controlloSicurezza, profiloPerIA } from '../../src/lib/pianoIA/questionario.js'
import { scegliProgramma } from '../../src/lib/pianoIA/programmi.js'
import { validaSeduta } from '../../src/lib/pianoIA/validaSeduta.js'
import { adattaSeduta } from '../../src/lib/pianoIA/differenze.js'
import { riassuntoFeedback } from '../../src/lib/pianoIA/riassunto.js'
import { costoChiamata } from '../../src/lib/pianoIA/costi.js'
import {
  richiestaAdattamento, richiestaAnalisi, richiestaGroqAnalisi, leggiRisposta, fornitoreDi,
} from '../../supabase/functions/_shared/pianoIA/richieste.ts'
import { chatGroq } from '../../supabase/functions/_shared/groq.ts'
import { CASI, OGGI } from './casi.mjs'
import { PROGRAMMI } from './programmi.mjs'

const REGOLE = [
  'Scarico ogni 4 settimane: −30% dei minuti',
  'Mai due sedute dure in giorni consecutivi',
  'Progressione massima +10% dei minuti a settimana',
  'La settimana della gara è più leggera della precedente',
]
const CARTELLA = new URL('./risultati/', import.meta.url)
const argomento = (nome) => { const i = process.argv.indexOf(nome); return i >= 0 ? process.argv[i + 1] : null }
const data = OGGI.toISOString().slice(0, 10)
const oggiVero = new Date().toISOString().slice(0, 10)

/** Profilo, programma scelto e prima settimana di un caso. */
function prepara(c) {
  const v = validaRisposte(c.risposte)
  const stop = controlloSicurezza(c.risposte)
  const profilo = profiloPerIA(c.risposte, OGGI)
  const scelta = scegliProgramma(PROGRAMMI, profilo)
  const settimana = scelta ? scelta.programma.settimane[scelta.settimaneUsate[0]] : null
  return { v, stop, profilo, scelta, settimana }
}

const opzioniPer = (c, s) => ({ minutiPrevisti: s.minuti, attrezzatura: c.risposte.attrezzatura, esclusioni: c.risposte.esclusioni })

// ── Controllo a secco ──────────────────────────────────────────────────────
function secco() {
  let giusti = 0
  for (const c of CASI) {
    const { v, stop, scelta, settimana } = prepara(c)
    const id = scelta?.programma.id ?? null
    const ok = id === c.atteso && v.ok && !stop.stop
    if (ok) giusti++
    const daAdattare = settimana ? settimana.sedute.filter(s => !validaSeduta(s.sections, opzioniPer(c, s)).ok).length : '—'
    console.log(`${ok ? '✓' : '✗'} ${c.id}  atteso ${c.atteso ?? 'rete'}  scelto ${id ?? 'rete'}${scelta ? ` (${scelta.punteggio}, ${scelta.settimaneUsate.length} sett.)` : ''}  sedute da adattare: ${daAdattare}${v.ok ? '' : `  risposte non valide: ${v.errori}`}`)
  }
  console.log(`\n${giusti}/${CASI.length} casi con il programma atteso`)
  process.exit(giusti === CASI.length ? 0 : 1)
}

// ── Chiamate ───────────────────────────────────────────────────────────────
async function chiama(corpo, modello) {
  const inizio = Date.now()
  if (fornitoreDi(modello) === 'groq') {
    const chiave = process.env.GROQ_API_KEY
    if (!chiave) throw new Error('Manca GROQ_API_KEY')
    const r = await chatGroq(corpo, chiave)
    const testo = String(r.dati?.choices?.[0]?.message?.content ?? '')
    const u = r.dati?.usage ?? {}
    const message = { stop_reason: r.ok ? 'end_turn' : 'errore', content: [{ type: 'text', text: testo }] }
    return { message, secondi: (Date.now() - inizio) / 1000, token: { in: u.prompt_tokens ?? 0, cache: 0, out: u.completion_tokens ?? 0 } }
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()
  const message = corpo.betas ? await client.beta.messages.create(corpo) : await client.messages.create(corpo)
  const u = message.usage ?? {}
  // La scrittura in cache costa 1,25 volte l'ingresso: si somma all'ingresso pieno.
  const tokenIn = (u.input_tokens ?? 0) + Math.round((u.cache_creation_input_tokens ?? 0) * 1.25)
  return { message, secondi: (Date.now() - inizio) / 1000, token: { in: tokenIn, cache: u.cache_read_input_tokens ?? 0, out: u.output_tokens ?? 0 } }
}

const costo = (modello, t) => costoChiamata({ modello, tokenIn: t.in, tokenInCache: t.cache, tokenOut: t.out })

async function adattamento(modello, casi, salva) {
  return perCaso(casi, async (c) => {
    const { profilo, scelta, settimana } = prepara(c)
    if (!scelta) return { caso: c.id, saltato: 'rete di sicurezza (fase 2)' }
    const corpo = richiestaAdattamento({ modello, regole: REGOLE, sedute: settimana.sedute, profilo })
    const { message, secondi, token } = await chiama(corpo, modello)
    const r = leggiRisposta(message)
    const sedute = settimana.sedute.map(s => {
      const proposta = r.ok ? (r.dati.sedute || []).find(x => x.posto === s.posto) : null
      const esito = adattaSeduta(s.sections, proposta?.differenze ?? [], opzioniPer(c, s))
      return { posto: s.posto, origine: esito.origine, errori: esito.errori, perche: proposta?.perche ?? null, differenze: proposta?.differenze ?? [], sections: esito.sections }
    })
    console.log(`${c.id}  ${r.ok ? 'ok' : r.motivo}  ${secondi.toFixed(1)} s  ${costo(modello, token).toFixed(4)} $  adattate ${sedute.filter(s => s.origine === 'adattata').length}/${sedute.length}`)
    return { caso: c.id, modello, motivo: r.motivo, secondi, token, costo: costo(modello, token), sedute }
  }, salva)
}

async function analisi(modello, casi, salva) {
  return perCaso(casi.filter(x => x.storico), async (c) => {
    const { scelta, settimana } = prepara(c)
    if (!scelta) return null
    const storico = c.storico.map(s => ({ ...s, blocks: settimana.sedute[0].sections.blocks ?? [] }))
    const riassunto = riassuntoFeedback({ sedute: storico, comeStai: [], oggi: OGGI })
    const prossime = settimana.sedute.slice(0, 2)
    const args = { modello, riassunto, seduta: settimana.sedute[0], prossime }
    const corpo = fornitoreDi(modello) === 'groq' ? richiestaGroqAnalisi(args) : richiestaAnalisi(args)
    const { message, secondi, token } = await chiama(corpo, modello)
    const r = leggiRisposta(message)
    const esiti = prossime.map(s => {
      const proposta = r.ok ? (r.dati.prossime || []).find(x => x.posto === s.posto) : null
      return { posto: s.posto, ...adattaSeduta(s.sections, proposta?.differenze ?? [], opzioniPer(c, s)), differenze: proposta?.differenze ?? [] }
    })
    console.log(`${c.id}  ${r.ok ? 'ok' : r.motivo}  ${secondi.toFixed(1)} s  «${r.dati?.frase ?? ''}»`)
    return { caso: c.id, modello, riassunto, motivo: r.motivo, frase: r.dati?.frase ?? null, secondi, token, costo: costo(modello, token), prossime: esiti }
  }, salva)
}

function riepilogo(compito, modello, righe) {
  // Le righe 'errore' (429, 5xx…) non hanno token né sedute: fuori dalle medie.
  const fatte = righe.filter(r => !r.saltato && r.motivo !== 'errore')
  const sedute = fatte.flatMap(r => r.sedute ?? r.prossime ?? [])
  const salute = sedute.filter(s => !s.errori.some(e => e.tipo === 'esclusione' || e.tipo === 'attrezzatura')).length
  const altri = sedute.filter(s => !s.errori.some(e => e.tipo === 'formato' || e.tipo === 'nome' || e.tipo === 'durata')).length
  const ripiego = sedute.filter(s => s.origine === 'team' && s.differenze.length > 0).length
  const tempi = fatte.map(r => r.secondi).sort((a, b) => a - b)
  const p = (q) => tempi.length ? tempi[Math.min(tempi.length - 1, Math.floor(q * tempi.length))].toFixed(1) : '—'
  const media = (f) => fatte.length ? fatte.reduce((t, r) => t + f(r), 0) / fatte.length : 0
  const pct = (n) => sedute.length ? `${Math.round(n / sedute.length * 100)}%` : '—'
  return `| ${compito} | ${modello} | ${fatte.length} | ${pct(salute)} | ${pct(altri)} | ${pct(ripiego)} | ${Math.round(media(r => r.token.in + r.token.cache))} / ${Math.round(media(r => r.token.out))} | ${media(r => r.costo).toFixed(4)} $ | ${p(0.5)} / ${p(0.9)} s |\n`
}

function giudizio(giorno) {
  const file = readdirSync(CARTELLA).filter(f => f.startsWith(`${giorno}-adattamento-`) && f.endsWith('.json'))
  const perCaso = new Map()
  for (const f of file) {
    for (const r of JSON.parse(readFileSync(new URL(f, CARTELLA), 'utf8'))) {
      if (r.saltato) continue
      if (!perCaso.has(r.caso)) perCaso.set(r.caso, [])
      perCaso.get(r.caso).push(r)
    }
  }
  const chiave = []
  let md = `# Giudizio alla cieca — ${giorno}\n\nPer ogni caso e ogni candidato: **la firmerei** / **con piccole correzioni** / **la rifarei**.\n\n`
  for (const [caso, candidati] of perCaso) {
    const mescolati = [...candidati].sort(() => Math.random() - 0.5)
    md += `## ${caso}\n\n`
    mescolati.forEach((r, i) => {
      const etichetta = String.fromCharCode(65 + i)
      chiave.push(`${caso} ${etichetta} = ${r.modello}`)
      md += `### Candidato ${etichetta}\n\n${r.sedute.map(s => `- Seduta ${s.posto + 1} (${s.origine}): ${s.perche ?? '—'}\n  Differenze: ${JSON.stringify(s.differenze)}`).join('\n')}\n\nGiudizio: ______\n\n`
    })
  }
  writeFileSync(new URL(`${giorno}-giudizio.md`, CARTELLA), md)
  writeFileSync(new URL(`${giorno}-giudizio-chiave.txt`, CARTELLA), chiave.join('\n'))
  console.log(`Foglio scritto in tools/prova-piano-ia/risultati/${giorno}-giudizio.md (la chiave in -giudizio-chiave.txt: non darla ai coach)`)
}

// ── Avvio ──────────────────────────────────────────────────────────────────
if (process.argv.includes('--secco')) secco()
else if (argomento('--giudizio')) { mkdirSync(CARTELLA, { recursive: true }); giudizio(argomento('--giudizio')) }
else {
  const compito = argomento('--compito')
  const modello = argomento('--modello')
  if (!['adattamento', 'analisi'].includes(compito) || !modello) {
    console.error('Uso: --secco | --compito adattamento|analisi --modello <id> [--solo caso-NN] | --giudizio <aaaa-mm-gg>')
    process.exit(1)
  }
  fornitoreDi(modello)
  const solo = argomento('--solo')
  const casi = solo ? CASI.filter(c => c.id === solo) : CASI
  mkdirSync(CARTELLA, { recursive: true })
  const nome = `${oggiVero}-${compito}-${modello.replace(/\//g, '_')}`
  const salva = (righe) => writeFileSync(new URL(`${nome}.json`, CARTELLA), JSON.stringify(righe, null, 2))
  const righe = compito === 'adattamento' ? await adattamento(modello, casi, salva) : await analisi(modello, casi, salva)
  const errori = righe.filter(r => r.motivo === 'errore').length
  if (errori) console.log(`\n⚠️ ${errori} casi finiti in errore (sono nel file, con il messaggio)`)
  const riga = riepilogo(compito, modello, righe)
  const file = new URL(`${oggiVero}-riepilogo.md`, CARTELLA)
  try { readFileSync(file) } catch {
    writeFileSync(file, '| compito | modello | casi | salute rispettata | formato, nomi, durata | ripiego sul team | token in / out | costo medio | tempo p50 / p90 |\n|---|---|---|---|---|---|---|---|---|\n')
  }
  appendFileSync(file, riga)
  console.log(`\n${riga}\nRisultati in tools/prova-piano-ia/risultati/${nome}.json`)
}
