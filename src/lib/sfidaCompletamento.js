// Team, al completamento (spec §4, 06/11/2026): la logica di
// useSfidaCompletamento. Modulo a parte, caricato PIGRO dal hook, perché Home
// è nel chunk d'ingresso (`index`): come per le Scarpe, il hook tiene solo gli
// stati.
//
// Regole:
//   · funzione spenta, tabelle assenti o lettura fallita = nessuna riga e MAI
//     un alert (la migrazione può non essere ancora applicata);
//   · una sfida chiusa non si scrive più (lo impone anche il trigger);
//   · il campo è saltabile: vuoto è valido e non scrive niente;
//   · un errore di scrittura dà un CustomAlert e basta: il completamento è già
//     salvato e non si tocca. Niente rilancia.

import { funzioneAttiva } from './funzioniApp'
import { sfidaDiAssegnazione, salvaRisultato } from './teamDb'
import { leggiValore, scriviValore } from './sfidaTeam'

/** La sfida aperta di quell'allenamento per l'atleta, o null. */
export async function leggi(workoutId, athleteId, data) {
  try {
    if (!(await funzioneAttiva('team'))) return null
    const s = await sfidaDiAssegnazione(workoutId, athleteId, data)
    return s && !s.chiusa_il ? s : null
  } catch (e) {
    console.warn('Sfida non caricata:', e)
    return null
  }
}

/** Il valore come si scrive nel campo: «4:07» per il tempo, il numero nudo per il resto. */
export const testoCampo = (valore, metrica) =>
  valore == null ? '' : metrica === 'tempo' ? scriviValore(valore, metrica) : String(valore)

/** Vuoto è valido (si salta); altrimenti deve leggersi. */
export const valido = (testo, metrica) =>
  !String(testo ?? '').trim() || leggiValore(testo, metrica) != null

const DOPO = "L'allenamento è salvato: il risultato si inserisce dalla scheda del team."

export async function registra({ sfida, testo, athleteId, avvisa }) {
  if (!sfida || !String(testo ?? '').trim()) return
  const valore = leggiValore(testo, sfida.metrica)
  if (valore == null) return
  try {
    await salvaRisultato(sfida.id, athleteId, valore)
  } catch (e) {
    console.warn('Risultato non salvato:', e)
    avvisa({ title: 'Risultato non salvato', message: DOPO, type: 'error' })
  }
}
