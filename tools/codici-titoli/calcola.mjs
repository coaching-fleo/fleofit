// Aggiunge il codice («EM+FT 55′ @8») in coda ai titoli dei workout salvati
// prima del 05/10/2026 — BACKLOG #57.
//
// ⚠️ Questo script NON tocca il database. Legge il CSV scaricato dal SQL editor
// di Supabase e scrive tre file accanto a lui:
//   anteprima.csv   id · titolo di oggi · titolo nuovo, da controllare
//   aggiorna.sql    gli UPDATE, da incollare nel SQL editor
//   ripristina.sql  gli UPDATE al contrario, per tornare indietro
//
// Le regole, tutte prese dal builder (src/lib/codiceWorkout.js):
// - il nome resta IDENTICO: si aggiunge « · CODICE» in coda e basta;
// - solo Hyrox e Corsa: Custom ed Evento il codice non ce l'hanno;
// - un titolo che ha già un codice non si tocca;
// - ogni UPDATE porta `AND title = <titolo di oggi>`: se nel frattempo
//   qualcuno ha risalvato il workout, quella riga non cambia.
//
// Uso:  node tools/codici-titoli/calcola.mjs <percorso del CSV>

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Uso: node tools/codici-titoli/calcola.mjs <percorso del CSV>')
  process.exit(1)
}

// CSV come lo scarica Supabase: virgole, campi fra virgolette, "" dentro.
const leggiCsv = (testo) => {
  const righe = []
  let riga = [], campo = '', tra = false
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i]
    if (tra) {
      if (c === '"' && testo[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') tra = false
      else campo += c
    } else if (c === '"') tra = true
    else if (c === ',') { riga.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && testo[i + 1] === '\n') i++
      riga.push(campo); righe.push(riga); riga = []; campo = ''
    } else campo += c
  }
  if (campo || riga.length) { riga.push(campo); righe.push(riga) }
  const [testa, ...corpo] = righe.filter(r => r.some(Boolean))
  return corpo.map(r => Object.fromEntries(testa.map((k, i) => [k.trim(), r[i] ?? ''])))
}

const sql = (s) => `'${String(s).replace(/'/g, "''")}'`
const csv = (s) => `"${String(s).replace(/"/g, '""')}"`

// Le funzioni del builder, caricate come le carica l'app: niente copie.
const radice = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const vite = await createServer({
  root: radice, configFile: false, logLevel: 'error',
  server: { middlewareMode: true, hmr: false }, appType: 'custom',
})
try {
  const { codiceWorkout, separaCodice, unisciCodice } = await vite.ssrLoadModule('/src/lib/codiceWorkout.js')
  const { getNormalizedBlocks } = await vite.ssrLoadModule('/src/lib/timerSequence.js')
  const { categoriaDi } = await vite.ssrLoadModule('/src/lib/categorie.js')

  const workout = leggiCsv(readFileSync(csvPath, 'utf8'))
  if (!workout.length || !('id' in workout[0]) || !('title' in workout[0]) || !('sections' in workout[0])) {
    throw new Error('Il CSV deve avere le colonne id, title, sections (passo 2 delle istruzioni).')
  }

  const conteggi = { cambiati: 0, giaCodice: 0, senzaCodice: 0, altraCategoria: 0 }
  const cambi = []
  for (const w of workout) {
    let s = {}
    try { s = JSON.parse(w.sections || '{}') || {} } catch { s = {} }
    const categoria = categoriaDi(s)
    if (categoria !== 'Hyrox' && categoria !== 'Running') { conteggi.altraCategoria++; continue }
    if (separaCodice(w.title).codice) { conteggi.giaCodice++; continue }

    const codice = categoria === 'Hyrox'
      ? codiceWorkout({ category: 'Hyrox', blocks: getNormalizedBlocks({ sections: s }), intensity: s.intensity })
      : codiceWorkout({ category: 'Running', steps: s.steps || s.main?.steps || [], intensity: s.intensity })
    if (!codice) { conteggi.senzaCodice++; continue }

    const nuovo = unisciCodice(w.title, codice)
    if (nuovo === w.title) { conteggi.senzaCodice++; continue }
    cambi.push({ id: w.id, vecchio: w.title, nuovo })
    conteggi.cambiati++
  }

  const cartella = dirname(resolve(csvPath))
  writeFileSync(join(cartella, 'anteprima.csv'),
    ['id,titolo di oggi,titolo nuovo', ...cambi.map(c => [c.id, c.vecchio, c.nuovo].map(csv).join(','))].join('\n') + '\n')

  const blocco = (righe) => ['BEGIN;', ...righe, 'COMMIT;', ''].join('\n')
  writeFileSync(join(cartella, 'aggiorna.sql'), blocco(cambi.map(c =>
    `UPDATE workouts SET title = ${sql(c.nuovo)} WHERE id = ${sql(c.id)} AND title = ${sql(c.vecchio)};`)))
  writeFileSync(join(cartella, 'ripristina.sql'), blocco(cambi.map(c =>
    `UPDATE workouts SET title = ${sql(c.vecchio)} WHERE id = ${sql(c.id)} AND title = ${sql(c.nuovo)};`)))

  console.log(`Workout letti:              ${workout.length}`)
  console.log(`Titoli da cambiare:         ${conteggi.cambiati}`)
  console.log(`Avevano già il codice:      ${conteggi.giaCodice}`)
  console.log(`Custom / Evento (esclusi):  ${conteggi.altraCategoria}`)
  console.log(`Senza blocchi (esclusi):    ${conteggi.senzaCodice}`)
  console.log(`\nFile scritti in ${cartella}: anteprima.csv, aggiorna.sql, ripristina.sql`)
  for (const c of cambi.slice(0, 8)) console.log(`  ${c.vecchio}  →  ${c.nuovo}`)
} finally {
  await vite.close()
}
