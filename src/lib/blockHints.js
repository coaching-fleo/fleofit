/**
 * Didascalie in chiaro per i tipi di blocco Hyrox.
 *
 * I nomi dei blocchi ("Cash In", "Cash Out", "EMOM", "AMRAP"...) sono la
 * terminologia tecnica standard di Hyrox e CrossFit e NON vanno tradotti né
 * rinominati: sono anche i valori salvati in `workouts.sections.blocks[].type`
 * su Supabase, quindi rinominarli romperebbe tutti i workout esistenti.
 *
 * Queste didascalie affiancano il termine nella UI, senza sostituirlo: servono
 * a rendere leggibile il builder a chi non conosce il gergo e a chiarire che
 * "Cash In" e "Cash Out" indicano il blocco di apertura e quello di chiusura
 * di un allenamento, non movimenti di denaro.
 */
export const BLOCK_HINT = {
  'WarmUp':   'Riscaldamento',
  'Cash In':  'Blocco di apertura',
  'ON/OFF':   'Lavoro e recupero',
  'EMOM':     'Ogni minuto',
  'AMRAP':    'Più round possibili',
  'For Time': 'A tempo',
  'Interval': 'Intervalli',
  'Rest':     'Recupero',
  'Cash Out': 'Blocco di chiusura',
}

export const blockHint = (type) => BLOCK_HINT[type] || ''
