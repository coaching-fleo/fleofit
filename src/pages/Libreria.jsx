// La Libreria del coach (12/11/2026, richiesta del committente): la voce della
// barra apre un MENÙ, non l'archivio. Voci fisse Archivio e Modelli, poi un
// extra per ogni interruttore acceso (registro src/lib/extra.js, docs/memoria/extra.md).
// Un extra nuovo compare qui da solo, senza toccare questa pagina.
//
// Solo staff: l'atleta ha la sua voce Extra e la sua pagina (/extra).

import { Fragment, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FolderArchive, LayoutTemplate } from 'lucide-react'
import { useAuth } from '../App'
import { useExtra } from '../useExtra'
import { useAvvisiExtra } from '../useAvvisiExtra'
import { Sezione, RigaAzione, Separatore } from '../components/ImpostazioniUI'
import { vibraScelta } from '../lib/aptica'

const FISSE = [
  { id: 'archivio', nome: 'Archivio', icona: FolderArchive, rotta: '/archive', dettaglio: 'Tutti i tuoi workout' },
  { id: 'modelli', nome: 'Modelli', icona: LayoutTemplate, rotta: '/modelli', dettaglio: 'Blocchi, fasi e gruppi salvati' },
]

export default function Libreria() {
  const { user, role } = useAuth() || {}
  const extra = useExtra()
  const { aperti } = useAvvisiExtra()
  const navigate = useNavigate()
  const uid = user?.id
  // Le righe vive degli extra («12 modelli»), chieste dopo il montaggio.
  const [righe, setRighe] = useState({})

  useEffect(() => {
    if (!extra?.length) return undefined
    let vivo = true
    extra.filter(e => e.stato).forEach(async (e) => {
      try {
        const testo = await (await e.stato())(uid, 'coach')
        if (vivo && testo) setRighe(p => ({ ...p, [e.id]: testo }))
      } catch { /* resta la descrizione */ }
    })
    return () => { vivo = false }
  }, [extra, uid])

  if (role === 'athlete') return <Navigate to="/" replace />

  const apri = (rotta) => { vibraScelta(); navigate(rotta) }
  const voci = [
    ...FISSE.map(f => ({ ...f, pallino: false })),
    ...(extra || []).map(e => ({
      id: e.id, nome: e.nome, icona: e.icona, rotta: e.rotta,
      dettaglio: righe[e.id] || e.descrizione.coach, pallino: aperti.has(e.id),
    })),
  ]

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[var(--fondo-pagina)] pt-[calc(env(safe-area-inset-top)+1rem)]
                    flex flex-col gap-3.5 cascata">
      {/* Destinazione della barra: niente «indietro», come le altre voci. */}
      <h1 className="pt-4 pb-2 text-3xl font-black tracking-[-.03em] text-white leading-none">Libreria</h1>
      <Sezione>
        {voci.map((v, i) => (
          <Fragment key={v.id}>
            {i > 0 && <Separatore />}
            <RigaAzione icona={v.icona} titolo={v.nome} dettaglio={v.dettaglio} pallino={v.pallino}
              etichetta={v.pallino ? `${v.nome}, novità` : undefined}
              onClick={() => apri(v.rotta)} />
          </Fragment>
        ))}
      </Sezione>
    </div>
  )
}
