// La Libreria del coach (12/11/2026, richiesta del committente): la voce della
// barra apre un MENÙ, non l'archivio. Voci fisse Archivio e Modelli, poi un
// extra per ogni interruttore acceso (registro src/lib/extra.js, docs/memoria/extra.md).
// Un extra nuovo compare qui da solo, senza toccare questa pagina.
//
// Solo staff: l'atleta ha la sua voce Extra e la sua pagina (/extra).

import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FolderArchive, LayoutTemplate } from 'lucide-react'
import { useAuth } from '../App'
import { useExtra } from '../useExtra'
import { useAvvisiExtra } from '../useAvvisiExtra'
import { CARD } from '../lib/stiliCard'
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

  const [prima, ...altre] = voci

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[var(--fondo-pagina)] pt-[calc(env(safe-area-inset-top)+1rem)]
                    flex flex-col gap-3 cascata">
      {/* Destinazione della barra: niente «indietro», come le altre voci. */}
      <h1 className="pt-4 pb-3 text-3xl font-black tracking-[-.03em] text-white leading-none">Libreria</h1>
      {/* Tasti grossi, non righe da impostazioni (16/11/2026, il committente):
          l'Archivio, la voce più usata, a tutta larghezza e in giallo; le
          altre a due a due. */}
      <Tasto voce={prima} grande onApri={apri} />
      <div className="grid grid-cols-2 gap-3">
        {/* Dispari: l'ultima prende la riga intera, non resta zoppa. */}
        {altre.map((v, i) => (
          <Tasto key={v.id} voce={v} onApri={apri}
            intera={altre.length % 2 === 1 && i === altre.length - 1} />
        ))}
      </div>
    </div>
  )
}

/**
 * Un tasto della Libreria: carta sollevata (stiliCard.js), icona nel cerchio e
 * la stessa icona, grande, in filigrana nell'angolo (DESIGN.md). Il giallo va
 * solo al tasto grande: un secondo campo giallo sarebbe la fine della regola.
 */
function Tasto({ voce: v, grande = false, intera = false, onApri }) {
  const Icona = v.icona
  return (
    <button type="button" onClick={() => onApri(v.rotta)}
      aria-label={v.pallino ? `${v.nome}, novità` : v.nome}
      className={`${CARD} group relative overflow-hidden text-left flex flex-col p-5
                  transition-transform duration-200 ease-out active:scale-[.97]
                  ${grande ? 'min-h-[156px]' : 'min-h-[164px]'} ${intera ? 'col-span-2' : ''}`}>
      <Icona aria-hidden="true" strokeWidth={1.6}
        size={grande ? 132 : 104}
        className={`absolute -right-5 -bottom-6 -rotate-12 transition-opacity duration-300
                    ${grande ? 'text-brand opacity-[.13] group-hover:opacity-20' : 'text-white opacity-[.06] group-hover:opacity-10'}`} />
      <span className={`w-12 h-12 rounded-full flex items-center justify-center
                        ${grande ? 'bg-brand/[.16] text-brand' : 'bg-[#2a2a2a] text-white'}`}>
        <Icona size={23} aria-hidden="true" />
      </span>
      {v.pallino && <span aria-hidden="true" className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-brand" />}
      <span className="relative mt-auto pt-4">
        <span className={`block font-black tracking-tight text-white leading-none ${grande ? 'text-[26px]' : 'text-[19px]'}`}>
          {v.nome}
        </span>
        <span className="block mt-1.5 text-[13px] font-medium text-gray-400 leading-snug">{v.dettaglio}</span>
      </span>
    </button>
  )
}
