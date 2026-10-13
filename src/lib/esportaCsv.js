// L'esportazione in CSV della pagina Analisi (piano desktop fase 2, #3).
//
// ⚠️ Il file si apre quasi sempre in Excel con le impostazioni italiane, e lì
// valgono tre regole che un CSV «da manuale» non rispetta:
//  · il separatore è il PUNTO E VIRGOLA (la virgola è il decimale);
//  · i decimali si scrivono con la virgola, o Excel legge 1.5 come una data;
//  · serve il BOM UTF-8 in testa, o «è» diventa «Ã¨».

import { format } from 'date-fns'

/** Il prefisso dei file esportati. Il nome dell'app è provvisorio (CLAUDE.md §0, regola 1). */
export const PREFISSO_FILE = 'fleofit'

const BOM = '﻿'

function campo(v) {
  if (v == null) return ''
  // 🔴 Un TESTO che comincia con = + - @ Excel lo esegue come formula, e i nomi
  // li scrivono gli atleti stessi. L'apostrofo lo fa restare testo. Solo sui
  // testi: un numero negativo (lo scarto RPE) deve restare un numero.
  const testo = typeof v === 'number'
    ? String(v).replace('.', ',')
    : (/^[=+\-@\t\r]/.test(String(v)) ? `'${v}` : String(v))
  return /[;"\r\n]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo
}

/** Un CSV da colonne `{ titolo, valore(riga) }` e righe. */
export function csvDa(colonne = [], righe = []) {
  const linee = [colonne.map(c => campo(c.titolo)).join(';')]
  for (const r of righe) linee.push(colonne.map(c => campo(c.valore(r))).join(';'))
  return BOM + linee.join('\r\n')
}

/** «giulia-neri»: minuscole, senza accenti, trattini al posto degli spazi. */
const slug = (testo) => String(testo).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function nomeFileAnalisi(periodo, atleta = null, oggi = new Date()) {
  return [PREFISSO_FILE, 'analisi', atleta ? slug(atleta) : null, `${periodo}sett`, format(oggi, 'yyyy-MM-dd')]
    .filter(Boolean).join('-') + '.csv'
}
