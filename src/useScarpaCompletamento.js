import { useState, useEffect } from 'react'

// «Scarpe da corsa», al completamento (spec §2 e §5, 02/11/2026): la scarpa
// scelta nel foglio RPE si lega alla corsa completata. Home, AthleteDetail e
// WorkoutDetail usano questo hook e nient'altro.
//
// ⚠️ Qui ci sono SOLO gli stati: la logica sta in src/lib/scarpaCompletamento.js,
// caricato pigro. Home è nel chunk d'ingresso (`index`), e con la logica
// statica qui dentro cresceva di ~2,4 KB (di ~9,6 con scarpeDb e kmScarpe).
//
// `athleteId` null = niente scarpe (il coach che guarda o completa per conto
// di un atleta): nessuna lettura, e il hook torna VUOTO. Finché il modulo non
// è caricato torna VUOTO anche per l'atleta: nessuna riga, scritture a vuoto.

const VUOTO = Object.freeze({
  disponibile: false, scarpe: null, attive: Object.freeze([]), sceltaId: null,
  setSceltaId: () => {}, conCorsa: () => false, propRiga: () => null, scarpaDiUso: () => null,
  registra: async () => {}, annulla: async () => {}, cambiaUso: async () => {},
})

/**
 * @param athleteId  l'atleta che sta completando i PROPRI allenamenti, o null
 * @param opzioni.setAlertInfo  il setter del CustomAlert della pagina
 */
export function useScarpaCompletamento(athleteId, { setAlertInfo } = {}) {
  // `letto` = { per, disponibile, scarpe, mod }: la lettura porta l'id per cui
  // è stata fatta (mai le scarpe di un altro) e il modulo che la sa usare.
  const [letto, setLetto] = useState(null)
  const [scelta, setScelta] = useState(null)
  // `setAlertInfo` è il setter di useState della pagina: stabile, non serve un ref.
  const avvisa = (info) => setAlertInfo?.(info)

  useEffect(() => {
    if (!athleteId) return undefined
    let vivo = true
    import('./lib/scarpaCompletamento')
      .then(async (mod) => ({ ...(await mod.leggi(athleteId)), mod }))
      .then((r) => { if (vivo) setLetto(r) })
      .catch((e) => console.warn('Scarpe non caricate:', e))
    return () => { vivo = false }
  }, [athleteId])

  return athleteId && letto?.per === athleteId
    ? letto.mod.api({ letto, scelta, setScelta, setLetto, avvisa, athleteId })
    : VUOTO
}
