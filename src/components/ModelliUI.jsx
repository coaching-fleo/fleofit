import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { LABEL } from '../lib/stiliCard'
import { anteprimaModello } from '../lib/modelliBlocco'
import { useModelliBlocco } from '../useModelliBlocco'

// «Modelli di blocco»: le card dei modelli, nei fogli «Aggiungi» del builder e
// nella pagina /modelli. Solo presentazione: chi le usa decide cosa fa il tocco.

/** Il colore della categoria, con le classi scritte per intero (Tailwind le cerca nel testo). */
const TONO = {
  Hyrox: { barra: 'bg-brand', bordo: 'hover:border-brand/50' },
  Running: { barra: 'bg-running', bordo: 'hover:border-running/50' },
  Gym: { barra: 'bg-gym', bordo: 'hover:border-gym/50' },
}

/**
 * Un modello: nome e anteprima, con la barra del colore della categoria.
 * `menu`, se c'è, sta a destra fuori dal bottone (la pagina /modelli ci mette
 * le sue azioni).
 */
export function CardModello({ modello, onClick, menu }) {
  const tono = TONO[modello.categoria] || TONO.Hyrox
  return (
    <div className={`relative overflow-hidden rounded-[16px] border border-white/[.07] bg-white/[.035] flex items-center transition ${tono.bordo}`}>
      <span aria-hidden="true" className={`absolute left-0 inset-y-0 w-[3px] ${tono.barra}`} />
      <button type="button" onClick={onClick} className="flex-1 min-w-0 min-h-14 pl-4 pr-3 py-2.5 text-left">
        <span className="block text-[14.5px] font-extrabold text-white truncate">{modello.nome}</span>
        <span className="block text-[12px] font-medium text-muted truncate mt-0.5">{anteprimaModello(modello)}</span>
      </button>
      {menu}
    </div>
  )
}

/**
 * «I miei modelli» dentro un foglio di aggiunta. Non mostra niente finché non
 * ha caricato, se la lettura fallisce o se non ci sono modelli: è un foglio che
 * serve ad altro, e lì uno stato vuoto o un errore sarebbero rumore.
 */
export function SezioneModelli({ categoria, onScegli }) {
  const { modelli, caricato, errore } = useModelliBlocco(categoria)
  if (!caricato || errore || modelli.length === 0) return null

  return (
    <section className="flex flex-col gap-2" aria-label="I miei modelli">
      <p className={`${LABEL} px-1`}>I miei modelli</p>
      {modelli.map(m => (
        <CardModello key={m.id} modello={m} onClick={() => onScegli(m)} />
      ))}
      <Link to={`/modelli?categoria=${categoria}`}
        className="self-start min-h-9 px-1 flex items-center gap-1 text-[12.5px] font-bold text-muted hover:text-white">
        Gestisci i modelli <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </section>
  )
}
