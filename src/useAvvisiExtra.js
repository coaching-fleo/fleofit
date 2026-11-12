import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './App'
import { useExtra } from './useExtra'
import { ruoloExtra } from './lib/extra'
import { leggiJson, scriviJson } from './lib/offlineQueue'
import { CHIAVE_VISTI, aggiungiVisto, chiaveVisto, ordinaAvvisi } from './lib/avvisiExtra'

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
  const [letti, setLetti] = useState({ per: null, voci: [] })
  const [visti, setVisti] = useState(() => leggiJson(CHIAVE_VISTI, []))
  const per = `${uid || ''}:${role || ''}`

  useEffect(() => {
    if (!extra?.length || !uid) return undefined
    let vivo = true
    const r = ruoloExtra(role)
    Promise.all(extra.filter(e => e.avviso).map(async (e) => {
      try {
        const fn = await e.avviso()
        return { extra: e, avviso: await fn(uid, r) }
      } catch {
        return { extra: e, avviso: null }
      }
    })).then(voci => { if (vivo) setLetti({ per, voci }) })
    return () => { vivo = false }
  }, [extra, uid, role, per])

  const voci = useMemo(() => (letti.per === per && extra?.length ? letti.voci : []), [letti, per, extra])
  const { primo, altri } = useMemo(() => ordinaAvvisi(voci, visti), [voci, visti])
  const aperti = useMemo(() => new Set(
    voci.filter(v => v.avviso && !visti.includes(chiaveVisto(v.extra.id, v.avviso.chiave))).map(v => v.extra.id),
  ), [voci, visti])

  const chiudi = useCallback((idExtra, chiave) => {
    setVisti(prima => {
      const dopo = aggiungiVisto(prima, chiaveVisto(idExtra, chiave))
      scriviJson(CHIAVE_VISTI, dopo)
      return dopo
    })
  }, [])

  return { primo, altri, aperti, chiudi }
}
