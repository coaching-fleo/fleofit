import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

// ⚠️ Import PIGRI: Home sta nel chunk d'ingresso (`index`), e scarpeDb +
// kmScarpe lì dentro pesavano ~10 KB per una funzione che molti non usano
// (CLAUDE.md §2). Si caricano solo se c'è un atleta; il modulo poi resta in cache.
const caricaDb = () => import('./lib/scarpeDb')
const caricaKm = () => import('./lib/kmScarpe')

// «Scarpe da corsa», al completamento (spec §2 e §5, 02/11/2026).
//
// Quando l'atleta chiude un allenamento con corsa, la scarpa scelta (di base la
// principale) si lega all'allenamento in `scarpe_uso`, e i suoi km salgono.
// Le tre pagine che completano (Home, AthleteDetail, WorkoutDetail) usano
// questo hook e nient'altro: così la regola sta in un posto.
//
// Regole:
//   · `athleteId` null = niente scarpe (il coach che guarda o completa per
//     conto di un atleta): nessuna lettura, nessuna riga, nessuna scrittura;
//   · tabelle assenti o lettura fallita = la funzione non c'è: niente riga e
//     MAI un alert (la migrazione può non essere ancora applicata);
//   · senza principale attiva la scelta parte da «Nessuna» e non si scrive
//     niente finché l'atleta non sceglie;
//   · un errore di scrittura dà un CustomAlert e basta: il completamento è
//     già salvato e non si tocca;
//   · offline non si chiama: la scarpa si assegna dopo, dalla scheda;
//   · finché i moduli non sono caricati non c'è riga (`conCorsa` dice false).

const principaleDi = (attive) => attive.find(s => s.principale)?.id ?? null

/**
 * @param athleteId  l'atleta che sta completando i PROPRI allenamenti, o null
 * @param opzioni.setAlertInfo  il setter del CustomAlert della pagina
 */
export function useScarpaCompletamento(athleteId, { setAlertInfo } = {}) {
  // La lettura porta l'id per cui è stata fatta: mai le scarpe di un altro.
  const [letto, setLetto] = useState({ per: null, disponibile: false, scarpe: [], haCorsa: null })
  const [scelta, setScelta] = useState({ per: null, id: null })
  const alertRef = useRef(setAlertInfo)
  useEffect(() => { alertRef.current = setAlertInfo }, [setAlertInfo])

  const leggi = useCallback(async (id) => {
    const [db, km] = await Promise.all([caricaDb(), caricaKm()])
    try {
      const r = await db.leggiScarpeAtleta(id)
      return { per: id, disponibile: !!r?.disponibile, scarpe: r?.disponibile ? (r.scarpe || []) : [], haCorsa: km.haCorsa }
    } catch (e) {
      console.warn('Scarpe non caricate:', e)
      return { per: id, disponibile: false, scarpe: [], haCorsa: km.haCorsa }
    }
  }, [])

  useEffect(() => {
    if (!athleteId) return undefined
    let vivo = true
    leggi(athleteId)
      .then(r => { if (vivo) setLetto(r) })
      .catch((e) => { console.warn('Scarpe non caricate:', e) })
    return () => { vivo = false }
  }, [athleteId, leggi])

  const valido = !!athleteId && letto.per === athleteId
  const disponibile = valido && letto.disponibile
  const scarpe = useMemo(() => (disponibile ? letto.scarpe : null), [disponibile, letto.scarpe])
  const attive = useMemo(() => (scarpe || []).filter(s => !s.ritirata_at), [scarpe])

  // La scelta vale per la lettura a cui appartiene: riletta la lista (dopo
  // un completamento), torna alla principale senza un effetto che la azzeri.
  const sceltaId = scelta.per === letto ? scelta.id : principaleDi(attive)
  const setSceltaId = useCallback((id) => setScelta({ per: letto, id }), [letto])

  /** La scheda ha corsa? (`haCorsa` di kmScarpe, caricato con le scarpe.) */
  const conCorsa = (sections) => !!(valido && letto.haCorsa?.(sections))

  /** La scarpa che porta questo allenamento, o null. */
  const scarpaDiUso = (athleteWorkoutId) =>
    (scarpe || []).find(s => (s.usi || []).some(u => u.athlete_workout_id === athleteWorkoutId)) ?? null

  // L'unica scrittura: lega `scarpaId` (o, con null, toglie la scarpa) e
  // rilegge i km. Non rilancia MAI: un errore è un CustomAlert e basta.
  const scrivi = async (athleteWorkoutId, scarpaId, messaggio) => {
    try {
      const db = await caricaDb()
      await (scarpaId ? db.assegnaScarpa(athleteWorkoutId, scarpaId) : db.togliScarpa(athleteWorkoutId))
      setLetto(await leggi(athleteId))
    } catch (e) {
      console.warn('Scarpa non salvata:', e)
      alertRef.current?.({ title: 'Scarpa non salvata', message: messaggio, type: 'error' })
    }
  }
  const DOPO = "L'allenamento è salvato: la scarpa si sceglie dalla sua scheda."

  const propRiga = (sections) =>
    disponibile && attive.length && conCorsa(sections) ? { attive, sceltaId, onCambia: setSceltaId } : null

  /** Dopo l'update riuscito a `completed`: lega la scarpa scelta, se c'è. */
  const registra = async (athleteWorkoutId, sections) => {
    if (!athleteWorkoutId || !propRiga(sections) || !attive.some(s => s.id === sceltaId)) return
    await scrivi(athleteWorkoutId, sceltaId, DOPO)
  }

  /** Ritorno a «da fare»: l'allenamento non conta più nei km. */
  const annulla = async (athleteWorkoutId) => {
    if (disponibile && athleteWorkoutId && scarpaDiUso(athleteWorkoutId)) await scrivi(athleteWorkoutId, null, DOPO)
  }

  /** Dalla scheda di un allenamento completato: cambia (o toglie, con null) la scarpa. */
  const cambiaUso = async (athleteWorkoutId, scarpaId) => {
    if (disponibile && athleteWorkoutId) await scrivi(athleteWorkoutId, scarpaId, 'Controlla la connessione e riprova.')
  }

  return { disponibile, scarpe, attive, sceltaId, setSceltaId, conCorsa, propRiga, registra, annulla, scarpaDiUso, cambiaUso }
}
