import { useState, useEffect } from 'react'

// Team, al completamento (spec §4, 06/11/2026): se l'allenamento fa parte di
// una sfida aperta, il foglio RPE chiede il risultato. Home e WorkoutDetail
// usano questo hook e nient'altro.
//
// ⚠️ Qui ci sono SOLO gli stati: la logica sta in src/lib/sfidaCompletamento.js,
// caricato pigro (Home è nel chunk d'ingresso), come useScarpaCompletamento.
//
// `athleteId` null = il coach che guarda o completa per conto di un atleta:
// nessuna lettura. `workoutId` null = nessun foglio aperto.

/**
 * @param athleteId  l'atleta che sta completando i PROPRI allenamenti, o null
 * @param workoutId  il workout che si sta completando, o null
 * @param data       il giorno dell'assegnazione ('yyyy-MM-dd'), o null
 * @param opzioni.setAlertInfo  il setter del CustomAlert della pagina
 * @returns {{ riga: { metrica, testo, onCambia, valido, lettura, classificaVisibile } | null, registra: () => Promise<void> }}
 */
export function useSfidaCompletamento(athleteId, workoutId, data, { setAlertInfo } = {}) {
  // `letto` = { chiave, sfida, mod }: vale solo per l'allenamento letto.
  const [letto, setLetto] = useState(null)
  const [testo, setTesto] = useState('')
  const chiave = athleteId && workoutId ? `${athleteId}|${workoutId}|${data || ''}` : null

  useEffect(() => {
    if (!chiave) return undefined
    let vivo = true
    import('./lib/sfidaCompletamento')
      .then(async (mod) => ({ chiave, mod, sfida: await mod.leggi(workoutId, athleteId, data) }))
      .then((r) => {
        if (!vivo) return
        setLetto(r)
        setTesto(r.sfida ? r.mod.testoCampo(r.sfida.valore, r.sfida.metrica) : '')
      })
      .catch((e) => console.warn('Sfida non caricata:', e))
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave])

  const attuale = letto?.chiave === chiave && letto?.sfida ? letto : null
  if (!attuale) return { riga: null, registra: async () => {} }
  const { sfida, mod } = attuale
  return {
    riga: {
      metrica: sfida.metrica,
      testo,
      onCambia: setTesto,
      valido: mod.valido(testo, sfida.metrica),
      lettura: mod.lettura(testo, sfida.metrica),
      classificaVisibile: sfida.classifica_visibile,
    },
    registra: () => mod.registra({ sfida, testo, athleteId, avvisa: (i) => setAlertInfo?.(i) }),
  }
}
