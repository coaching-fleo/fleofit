// «Scarpe da corsa», al completamento (spec §2 e §5, 02/11/2026): la logica di
// useScarpaCompletamento. Sta in un modulo a parte, caricato PIGRO dal hook,
// perché Home è nel chunk d'ingresso (`index`) e questa logica, con scarpeDb e
// kmScarpe, lì dentro pesava (CLAUDE.md §2). Il hook tiene solo gli stati.
//
// Regole:
//   · tabelle assenti o lettura fallita = la funzione non c'è: niente riga e
//     MAI un alert (la migrazione può non essere ancora applicata);
//   · la scelta parte dalla scarpa già legata a quell'allenamento (il foglio
//     RPE riaperto da `?rpe=1` non deve riscrivere una correzione), poi dalla
//     principale, poi da «Nessuna», che non scrive niente;
//   · un errore di scrittura dà un CustomAlert e basta: il completamento è
//     già salvato e non si tocca. Niente rilancia.

import { leggiScarpeAtleta, assegnaScarpa, togliScarpa } from './scarpeDb'
import { haCorsa } from './kmScarpe'

/** Le scarpe dell'atleta; tabelle assenti o errore → `disponibile: false`. */
export async function leggi(athleteId) {
  try {
    const r = await leggiScarpeAtleta(athleteId)
    return { per: athleteId, disponibile: !!r?.disponibile, scarpe: r?.disponibile ? (r.scarpe || []) : [] }
  } catch (e) {
    console.warn('Scarpe non caricate:', e)
    return { per: athleteId, disponibile: false, scarpe: [] }
  }
}

const DOPO = "L'allenamento è salvato: la scarpa si sceglie dalla sua scheda."
const RESTA = 'La scarpa resta legata a questo allenamento: riprova.'
const RIPROVA = 'Controlla la connessione e riprova.'

/**
 * Ciò che il hook restituisce, calcolato dagli stati che il hook tiene.
 * `letto` porta anche `mod` (questo modulo): una rilettura lo conserva.
 * `scelta` = `{ per: letto, awId, id }`: vale solo per la lettura a cui
 * appartiene e per l'allenamento su cui è stata fatta (un foglio chiuso senza
 * salvare non la lascia alla corsa dopo). `id: null` = «Nessuna» scelta apposta.
 */
export function api({ letto, scelta, setScelta, setLetto, avvisa, athleteId }) {
  const disponibile = letto.disponibile
  const scarpe = disponibile ? letto.scarpe : null
  const attive = (scarpe || []).filter(s => !s.ritirata_at)
  const principale = attive.find(s => s.principale)?.id ?? null
  /** Vero se su questo allenamento l'atleta ha scelto lui, in questo foglio. */
  const sceltoSu = (awId) => scelta?.per === letto && scelta.awId === (awId ?? null)

  const scarpaDiUso = (awId) =>
    (scarpe || []).find(s => (s.usi || []).some(u => u.athlete_workout_id === awId)) ?? null
  const sceltaPer = (awId) => (sceltoSu(awId) ? scelta.id : (awId && scarpaDiUso(awId)?.id) || principale)
  const sceltaSu = (awId) => (id) => setScelta({ per: letto, awId: awId ?? null, id })
  const setSceltaId = sceltaSu(null)
  const conCorsa = (sections) => haCorsa(sections)

  // L'unica scrittura: lega `scarpaId` (o, con null, toglie) e rilegge i km.
  // Senza `messaggio` un errore resta nella console: niente da dire all'atleta.
  const scrivi = async (awId, scarpaId, messaggio) => {
    try {
      await (scarpaId ? assegnaScarpa(awId, scarpaId) : togliScarpa(awId))
      setLetto({ ...(await leggi(athleteId)), mod: letto.mod })
    } catch (e) {
      console.warn('Scarpa non salvata:', e)
      if (messaggio) avvisa({ title: 'Scarpa non salvata', message: messaggio, type: 'error' })
    }
  }

  const propRiga = (sections, awId) =>
    disponibile && attive.length && haCorsa(sections) ? { attive, sceltaId: sceltaPer(awId), onCambia: sceltaSu(awId) } : null

  return {
    disponibile, scarpe, attive, sceltaId: sceltaPer(null), setSceltaId, conCorsa, propRiga, scarpaDiUso,
    /** Dopo l'update riuscito a `completed`: lega la scarpa scelta, se è attiva;
     *  «Nessuna» scelta apposta su una corsa che ne aveva una la toglie. */
    registra: async (awId, sections) => {
      if (!awId || !propRiga(sections, awId)) return
      const id = sceltaPer(awId)
      if (attive.some(s => s.id === id)) await scrivi(awId, id, DOPO)
      else if (id == null && sceltoSu(awId) && scarpaDiUso(awId)) await scrivi(awId, null, DOPO)
    },
    /** Ritorno a «da fare». La delete parte sempre: una rilettura non ancora
     *  arrivata lascerebbe in piedi l'uso appena scritto. L'avviso invece solo
     *  se una scarpa risultava legata: altrimenti parlerebbe di una scarpa che non c'era. */
    annulla: async (awId) => {
      if (disponibile && awId) await scrivi(awId, null, scarpaDiUso(awId) ? RESTA : null)
    },
    /** Dalla scheda completata: cambia (o toglie, con null) la scarpa. */
    cambiaUso: async (awId, scarpaId) => { if (disponibile && awId) await scrivi(awId, scarpaId, RIPROVA) },
  }
}
