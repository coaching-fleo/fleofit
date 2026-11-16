// La sezione Extra (spec docs/superpowers/specs/2026-11-12-sezione-extra-design.md §2):
// una card per ogni extra acceso. L'atleta ci arriva dalla barra (`/extra`), il
// desktop dalla barra laterale. Il coach sul telefono trova gli extra come voci
// della Libreria (src/pages/Libreria.jsx). Cosa fa ogni extra lo decide la sua pagina.

import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { useExtra } from '../useExtra'
import { useAvvisiExtra } from '../useAvvisiExtra'
import { ruoloExtra } from '../lib/extra'
import { GrigliaExtra } from '../components/ExtraUI'

export default function Extra() {
  const { user, role } = useAuth() || {}
  const extra = useExtra()
  const { aperti } = useAvvisiExtra()
  const navigate = useNavigate()
  const r = ruoloExtra(role)
  const uid = user?.id
  // Le righe vive, chieste dopo il montaggio: { [idExtra]: stringa | null }.
  const [righe, setRighe] = useState({})

  useEffect(() => {
    if (!extra?.length) return undefined
    let vivo = true
    extra.filter(e => e.stato).forEach(async (e) => {
      try {
        const testo = await (await e.stato())(uid, r)
        if (vivo && testo) setRighe(p => ({ ...p, [e.id]: testo }))
      } catch { /* resta la descrizione */ }
    })
    return () => { vivo = false }
  }, [extra, uid, r])

  if (extra === null) return null
  // Tutto spento: la pagina vuota non ha senso (un link vecchio, un interruttore appena spento).
  if (!extra.length) return <Navigate to="/" replace />

  const voci = extra.map(e => ({ extra: e, riga: righe[e.id] || e.descrizione[r], avviso: aperti.has(e.id) }))
  const griglia = <GrigliaExtra voci={voci} onApri={(e) => navigate(e.rotta)} />

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      <div className="max-w-2xl mx-auto">
        {/* Destinazione della barra: niente «indietro», come le altre voci. */}
        <h1 className="text-3xl font-black tracking-tight mb-4">Extra</h1>
        {griglia}
      </div>
    </div>
  )
}
