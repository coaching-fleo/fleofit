// Prova a mano delle istruzioni di `estrai-note` su note inventate.
//
// Perché esiste: la risposta dell'IA non è deterministica, quindi non può stare
// nella suite (`npm test`). Ma cambiare le istruzioni «a sentimento» e
// ripubblicare la funzione per vedere cosa succede sui dati degli atleti veri è
// esattamente quello che ha prodotto «Finale facile il cash out» → «seduta
// troppo facile» (09/10/2026). Qui si guardano i risultati PRIMA del deploy.
//
// Usa le stesse identiche regole della funzione (`regole.ts`): istruzioni,
// richiesta e validazione. Le note sono inventate sul modello di quelle vere:
// mai incollare qui una nota di un atleta.
//
// Uso:
//   GROQ_API_KEY=... node tools/prova-estrai-note/prova.mjs
// (la chiave è la stessa del secret della funzione; non va mai scritta in un file)

import { readFileSync } from 'node:fs'
import { MODELLO_GROQ_PREDEFINITO, chatGroq } from '../../supabase/functions/_shared/groq.ts'
import { richiestaGroq, rispostaDaGroq, validaEstrazione } from '../../supabase/functions/estrai-note/regole.ts'

const chiave = process.env.GROQ_API_KEY
if (!chiave) {
  console.error('Manca GROQ_API_KEY. Uso: GROQ_API_KEY=... node tools/prova-estrai-note/prova.mjs')
  process.exit(1)
}

const casi = JSON.parse(readFileSync(new URL('./note.json', import.meta.url), 'utf8'))
const { ok, stato, dati } = await chatGroq(
  richiestaGroq(casi.map((c, i) => ({ i, testo: c.testo, esercizi: c.esercizi })), process.env.GROQ_MODELLO || MODELLO_GROQ_PREDEFINITO),
  chiave,
)
if (!ok) {
  console.error('Groq ha risposto', stato, dati?.error?.code ?? '')
  process.exit(1)
}
const mappa = rispostaDaGroq(String(dati?.choices?.[0]?.message?.content ?? ''))
if (!mappa) {
  console.error('Risposta illeggibile')
  process.exit(1)
}

const chiaveParte = (p) => String(p).toLowerCase()
let giusti = 0
for (const [i, c] of casi.entries()) {
  const e = validaEstrazione(mappa.get(i), c.testo, c.esercizi)
  const seduta = e.sensazioni.seduta.difficolta
  const parti = e.sensazioni.parti.map(p => `${p.parte}:${p.difficolta}`).sort()
  const attese = c.parti.map(p => `${p.parte}:${p.difficolta}`).sort()
  const okSeduta = seduta === c.seduta
  const okParti = attese.every(a => parti.map(chiaveParte).includes(chiaveParte(a)))
  if (okSeduta && okParti) giusti++
  console.log(`${okSeduta && okParti ? '✅' : '❌'} ${c.nome}`)
  if (!okSeduta) console.log(`   seduta: attesa ${c.seduta}, ottenuta ${seduta}  ${JSON.stringify(e.sensazioni.seduta.citazioni)}`)
  if (!okParti) console.log(`   parti: attese ${JSON.stringify(attese)}, ottenute ${JSON.stringify(parti)}`)
}
console.log(`\n${giusti}/${casi.length} come atteso`)
