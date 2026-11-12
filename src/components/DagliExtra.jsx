// «Dagli Extra»: la card della Home con l'avviso più importante degli extra
// accesi (spec docs/superpowers/specs/2026-11-12-sezione-extra-design.md §3).
// Ha preso il posto di BannerScarpe. Si monta in FONDO alla Home: arriva dopo
// una lettura, e sopra la lista spingerebbe in basso gli allenamenti mentre
// l'atleta li sta per toccare.

import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { useAvvisiExtra } from '../useAvvisiExtra'
import { ruoloExtra } from '../lib/extra'
import { CartaDagliExtra } from './ExtraUI'

export default function DagliExtra({ className = '' }) {
  const { role } = useAuth() || {}
  const { primo, altri, chiudi } = useAvvisiExtra()
  const navigate = useNavigate()
  if (!primo) return null
  // Il coach la sezione la trova nella Libreria, l'atleta nella sua voce.
  const sezione = ruoloExtra(role) === 'coach' ? '/archive?vista=extra' : '/extra'
  return (
    <CartaDagliExtra className={className} extra={primo.extra} avviso={primo.avviso} altri={altri}
      onApri={(e) => navigate(e.rotta)}
      onChiudi={(e, a) => chiudi(e.id, a.chiave)}
      onApriTutti={() => navigate(sezione)} />
  )
}
