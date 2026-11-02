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
 * `scelta` = `{ per: letto, id }`: vale solo per la lettura a cui appartiene.
 */
export function api({ letto, scelta, setScelta, setLetto, avvisa, athleteId }) {
  const disponibile = letto.disponibile
  const scarpe = disponibile ? letto.scarpe : null
  const attive = (scarpe || []).filter(s => !s.ritirata_at)
  const principale = attive.find(s => s.principale)?.id ?? null
  const scelto = scelta?.per === letto

  const scarpaDiUso = (awId) =>
    (scarpe || []).find(s => (s.usi || []).some(u => u.athlete_workout_id === awId)) ?? null
  const sceltaPer = (awId) => (scelto ? scelta.id : (awId && scarpaDiUso(awId)?.id) || principale)
  const setSceltaId = (id) => setScelta({ per: letto, id })
  const conCorsa = (sections) => haCorsa(sections)

  // L'unica scrittura: lega `scarpaId` (o, con null, toglie) e rilegge i km.
  const scrivi = async (awId, scarpaId, messaggio) => {
    try {
      await (scarpaId ? assegnaScarpa(awId, scarpaId) : togliScarpa(awId))
      setLetto({ ...(await leggi(athleteId)), mod: letto.mod })
    } catch (e) {
      console.warn('Scarpa non salvata:', e)
      avvisa({ title: 'Scarpa non salvata', message: messaggio, type: 'error' })
    }
  }

  const propRiga = (sections, awId) =>
    disponibile && attive.length && haCorsa(sections) ? { attive, sceltaId: sceltaPer(awId), onCambia: setSceltaId } : null

  return {
    disponibile, scarpe, attive, sceltaId: sceltaPer(null), setSceltaId, conCorsa, propRiga, scarpaDiUso,
    /** Dopo l'update riuscito a `completed`: lega la scarpa scelta, se è attiva. */
    registra: async (awId, sections) => {
      const id = sceltaPer(awId)
      if (awId && propRiga(sections, awId) && attive.some(s => s.id === id)) await scrivi(awId, id, DOPO)
    },
    /** Ritorno a «da fare». Senza guardare `scarpaDiUso`: una rilettura non
     *  ancora arrivata lascerebbe in piedi l'uso appena scritto. */
    annulla: async (awId) => { if (disponibile && awId) await scrivi(awId, null, RESTA) },
    /** Dalla scheda completata: cambia (o toglie, con null) la scarpa. */
    cambiaUso: async (awId, scarpaId) => { if (disponibile && awId) await scrivi(awId, scarpaId, RIPROVA) },
  }
}
