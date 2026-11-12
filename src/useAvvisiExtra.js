import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useAuth } from './App'
import { useExtra } from './useExtra'
import { ruoloExtra } from './lib/extra'
import { leggiJson, scriviJson } from './lib/offlineQueue'
import { CHIAVE_VISTI, aggiungiVisto, chiaveVisto, ordinaAvvisi } from './lib/avvisiExtra'

// ⚠️ Una memoria SOLA per tutte le copie dell'hook: la barra (pallino), la card
// in Home, la Libreria e la pagina Extra. Con uno stato per copia, chiudere la
// card lasciava acceso il pallino della barra, che resta montata tutta la sessione.
// Dentro: gli avvisi chiusi (anche su localStorage) e gli ultimi avvisi letti,
// per chiave `uid:ruolo`. Chi rilegge (la Home a ogni montaggio) aggiorna tutti.
let memoria = { visti: null, letti: { per: null, voci: [] } }
const ascoltatori = new Set()
const inCorso = new Map()

const cambia = (dopo) => { memoria = { ...memoria, ...dopo }; ascoltatori.forEach(f => f()) }
const iscrivi = (f) => { ascoltatori.add(f); return () => ascoltatori.delete(f) }
const leggi = () => {
  if (memoria.visti === null) memoria = { ...memoria, visti: leggiJson(CHIAVE_VISTI, []) }
  return memoria
}

/** Legge gli avvisi; due copie che partono insieme fanno una lettura sola. */
function leggiAvvisi(extra, uid, ruolo, per) {
  if (inCorso.has(per)) return inCorso.get(per)
  const p = Promise.all(extra.filter(e => e.avviso).map(async (e) => {
    try {
      const fn = await e.avviso()
      return { extra: e, avviso: await fn(uid, ruolo) }
    } catch {
      return { extra: e, avviso: null }
    }
  })).finally(() => inCorso.delete(per))
  inCorso.set(per, p)
  return p
}

/**
 * Gli avvisi degli extra accesi (spec 2026-11-12 §3). Si chiedono in un effetto,
 * quindi dopo il primo fotogramma; un extra che fallisce è ignorato, gli altri
 * restano. Senza rete o con un errore: nessun avviso, mai uno inventato.
 *
 * → { primo: {extra, avviso} | null, altri: number, aperti: Set<idExtra>, chiudi(idExtra, chiave) }
 */
export function useAvvisiExtra() {
  const { user, role } = useAuth() || {}
  const extra = useExtra()
  const uid = user?.id
  const { visti, letti } = useSyncExternalStore(iscrivi, leggi)
  const per = `${uid || ''}:${role || ''}`

  useEffect(() => {
    if (!extra?.length || !uid) return undefined
    let vivo = true
    leggiAvvisi(extra, uid, ruoloExtra(role), per).then(voci => { if (vivo) cambia({ letti: { per, voci } }) })
    return () => { vivo = false }
  }, [extra, uid, role, per])

  const voci = useMemo(() => {
    if (letti.per !== per || !extra?.length) return []
    // Solo gli extra ancora accesi per chi guarda.
    const accesi = new Set(extra.map(e => e.id))
    return letti.voci.filter(v => accesi.has(v.extra.id))
  }, [letti, per, extra])
  const { primo, altri } = useMemo(() => ordinaAvvisi(voci, visti), [voci, visti])
  const aperti = useMemo(() => new Set(
    voci.filter(v => v.avviso && !visti.includes(chiaveVisto(v.extra.id, v.avviso.chiave))).map(v => v.extra.id),
  ), [voci, visti])

  const chiudi = useCallback((idExtra, chiave) => {
    const dopo = aggiungiVisto(leggi().visti, chiaveVisto(idExtra, chiave))
    scriviJson(CHIAVE_VISTI, dopo)
    cambia({ visti: dopo })
  }, [])

  return { primo, altri, aperti, chiudi }
}

/** Solo per i test: dimentica la memoria condivisa. */
export function dimenticaVisti() {
  memoria = { visti: null, letti: { per: null, voci: [] } }
  inCorso.clear()
}
