import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Pencil, TextCursorInput, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { CARD, LABEL } from '../lib/stiliCard'
import { chiudiTastieraSuInvio } from '../useTastiera'
import { useBottomSheet } from '../useBottomSheet'
import { Foglio } from './FoglioMessaggio'
import { anteprimaModello, MAX_NOME } from '../lib/modelliBlocco'
import { useModelliBlocco } from '../useModelliBlocco'

// «Modelli di blocco»: le card dei modelli, nei fogli «Aggiungi» del builder e
// nella pagina /modelli. Solo presentazione: chi le usa decide cosa fa il tocco.

/** Il colore della categoria, con le classi scritte per intero (Tailwind le cerca nel testo). */
const TONO = {
  Hyrox: { barra: 'bg-brand', bordo: 'hover:border-brand/50' },
  Running: { barra: 'bg-running', bordo: 'hover:border-running/50' },
  Gym: { barra: 'bg-gym', bordo: 'hover:border-gym/50' },
}

/** «Modificato il 20 ott», o «Salvato il …» se non è mai stato toccato. */
const dataModello = (m) => {
  const quando = m.modificato_at ?? m.creato_at
  if (!quando) return null
  return `${m.modificato_at ? 'Modificato' : 'Salvato'} il ${format(parseISO(quando), 'd MMM yyyy', { locale: it })}`
}

/**
 * Un modello: nome e anteprima, con la barra del colore della categoria.
 * `menu`, se c'è, sta a destra fuori dal bottone (la pagina /modelli ci mette
 * le sue azioni); `conData` aggiunge la data dell'ultima modifica.
 */
export function CardModello({ modello, onClick, menu, conData = false }) {
  const tono = TONO[modello.categoria] || TONO.Hyrox
  return (
    <div data-testid="card-modello" className={`relative overflow-hidden rounded-[16px] border border-white/[.07] bg-white/[.035] flex items-center transition ${tono.bordo}`}>
      <span aria-hidden="true" className={`absolute left-0 inset-y-0 w-[3px] ${tono.barra}`} />
      <button type="button" onClick={onClick} className="flex-1 min-w-0 min-h-14 pl-4 pr-3 py-2.5 text-left">
        <span data-nome className="block text-[14.5px] font-extrabold text-white truncate">{modello.nome}</span>
        <span className="block text-[12px] font-medium text-muted truncate mt-0.5">{anteprimaModello(modello)}</span>
        {conData && dataModello(modello) && (
          <span className="block text-[11px] font-bold text-[#5b6070] mt-1">{dataModello(modello)}</span>
        )}
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

/**
 * Il menu di un modello nella pagina /modelli: Modifica · Rinomina · Elimina.
 * `onChiudi(scelta)` arriva a uscita FINITA, come nel menu dei messaggi: un
 * foglio aperto mentre questo sta ancora uscendo resterebbe con lo
 * scorrimento bloccato.
 * ⚠️ X «Chiudi» e «Annulla»: il tasto indietro di Android li trova.
 */
export function MenuModello({ modello, onChiudi }) {
  const scelta = useRef(null)
  const sheet = useBottomSheet(() => onChiudi(scelta.current))
  const scegli = (s) => { scelta.current = s; sheet.chiudi() }
  const voce = 'w-full min-h-[52px] flex items-center gap-3 px-4 rounded-2xl bg-[#222] border border-[#333] text-left text-[15px] font-bold transition hover:border-[#444]'
  return (
    <Foglio titolo={modello.nome} {...sheet}>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => scegli('modifica')} className={`${voce} text-white`}>
          <Pencil size={18} aria-hidden="true" />Modifica
        </button>
        <button type="button" onClick={() => scegli('rinomina')} className={`${voce} text-white`}>
          <TextCursorInput size={18} aria-hidden="true" />Rinomina
        </button>
        <button type="button" onClick={() => scegli('elimina')} className={`${voce} text-red-500`}>
          <Trash2 size={18} aria-hidden="true" />Elimina
        </button>
        <button type="button" onClick={sheet.chiudi} className="w-full min-h-[48px] text-[15px] font-bold text-gray-400 hover:text-white">
          Annulla
        </button>
      </div>
    </Foglio>
  )
}

/**
 * Il nome del modello in cima al builder in modalità modello. Finché il coach
 * non lo scrive mostra quello proposto dal blocco (chi lo usa decide quale).
 */
export function CampoNomeModello({ valore, onChange }) {
  return (
    <label className={`${CARD} px-4 py-3.5 flex flex-col gap-1.5`}>
      <span className={LABEL}>Nome del modello</span>
      <input
        aria-label="Nome del modello"
        enterKeyHint="done"
        onKeyDown={chiudiTastieraSuInvio}
        maxLength={MAX_NOME}
        placeholder="Scegli prima il blocco"
        value={valore}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent text-[15.5px] font-bold text-white placeholder-[#5b6070] focus:outline-none"
      />
    </label>
  )
}
