// Quale esercizio di un blocco sta girando adesso, letto dall'id dello step che
// il telefono manda alla TV (`timer_state`).
//
// È SOLO LETTURA: non tocca il timer e non ricalcola tempi. Si appoggia agli
// stessi id che `buildTimerSequence` (src/lib/timerSequence.js) scrive:
//   EMOM   → `blk-<blocco>-<round>`            (round in base 1, il PRIMO della fase)
//   ON/OFF → `blk-<blocco>-<giro>-<k>-on|off`  (k = indice dell'esercizio)
// Se uno dei due formati cambia là, questa funzione smette di accendere la riga
// giusta: i test qui accanto lo dicono subito.

import { fasiEmom } from './stazioniEmom'

/**
 * L'indice dell'esercizio in corso nel blocco, o `null` se non si può dire
 * (blocco di altro tipo, step di un altro blocco, id che non torna).
 *
 * ⚠️ In un ON/OFF l'esercizio si accende solo durante l'ON: nell'OFF si
 * riposa, e accendere quello appena finito direbbe il contrario.
 */
export const esercizioInCorso = (block, indiceBlocco, stepId) => {
  if (!block || typeof stepId !== 'string') return null
  const parti = stepId.split('-')
  if (parti[0] !== 'blk' || parseInt(parti[1], 10) !== indiceBlocco) return null
  const esercizi = block.exercises || []
  if (!esercizi.length) return null

  if (block.type === 'EMOM') {
    const round = parseInt(parti[2], 10)
    if (!Number.isFinite(round)) return null
    const rounds = parseInt(block.params?.rounds, 10) || 10
    const fase = fasiEmom(esercizi, rounds).find(f => f.primo === round)
    if (!fase) return null
    const k = esercizi.indexOf(fase.esercizio)
    return k >= 0 ? k : null
  }

  if (block.type === 'ON/OFF') {
    if (parti[4] !== 'on') return null
    const k = parseInt(parti[3], 10)
    return Number.isFinite(k) && k >= 0 && k < esercizi.length ? k : null
  }

  return null
}
