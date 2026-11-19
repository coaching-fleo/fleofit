// FoglioRipristino — «Ripristina …» dal cestino dei workout (19/11/2026,
// docs/memoria/cestino.md). Il workout torna sempre; sotto, le cose che aveva
// attaccate, tutte spuntate all'apertura: il coach toglie la spunta a ciò che
// NON vuole riportare (per non riassegnare per sbaglio). Una voce che non si
// può ripristinare compare spenta, senza casella, con il perché.
// ⚠️ X «Chiudi» e «Annulla»: il tasto indietro di Android li trova.
import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useBottomSheet } from '../useBottomSheet'
import { Foglio } from './FoglioMessaggio'
import { BOTTONE_BRAND, BOTTONE_QUIETO } from '../lib/stiliCard'
import { etichettaVoce, rigaCestino, spunteIniziali } from '../lib/cestino'

function Casella({ spuntata }) {
  return (
    <span aria-hidden="true"
      className={`w-6 h-6 shrink-0 rounded-lg border flex items-center justify-center transition
                  ${spuntata ? 'bg-brand border-brand text-black' : 'border-[#444] text-transparent'}`}>
      <Check size={15} strokeWidth={3} />
    </span>
  )
}

/**
 * @param voci         da `cestino_voci` (null = ancora in arrivo)
 * @param onRipristina (assegnazioni, sfide) → Promise<id del workout | null>
 * @param onChiudi     (id del workout ripristinato | null), a uscita finita
 */
export default function FoglioRipristino({ riga, voci, onRipristina, onChiudi }) {
  const esito = useRef(null)
  const sheet = useBottomSheet(() => onChiudi(esito.current))
  const [spunte, setSpunte] = useState(() => spunteIniziali(voci))
  const [prese, setPrese] = useState(voci != null)
  const [lavora, setLavora] = useState(false)

  // Le voci arrivano dopo l'apertura: le spunte partono quando ci sono.
  if (voci != null && !prese) { setPrese(true); setSpunte(spunteIniziali(voci)) }

  const elenco = voci || []
  const possibili = elenco.filter(v => v.ripristinabile)
  const tutte = possibili.length > 0 && possibili.every(v => spunte.has(v.id))

  const cambia = (id) => setSpunte(s => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const cambiaTutte = () => setSpunte(tutte ? new Set() : new Set(possibili.map(v => v.id)))

  const ripristina = async () => {
    if (lavora || voci == null) return
    setLavora(true)
    const scelte = (tipo) => possibili.filter(v => v.tipo === tipo && spunte.has(v.id)).map(v => v.id)
    const id = await onRipristina(scelte('assegnazione'), scelte('sfida'))
    if (id) { esito.current = id; sheet.chiudi() } else setLavora(false)
  }

  const { titolo } = rigaCestino(riga)

  return (
    <Foglio titolo={`Ripristina «${titolo}»`} {...sheet}>
      <div className="max-h-[70dvh] overflow-y-auto hide-scrollbar flex flex-col gap-2 pb-1">
        <p className="text-[13.5px] text-gray-400 leading-relaxed pb-1">
          Il workout torna com&apos;era. Togli la spunta a quello che non vuoi riportare.
        </p>

        {voci == null ? (
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl h-14 animate-pulse" />
        ) : elenco.length === 0 ? (
          <p className="text-[13.5px] text-gray-500 py-2">Non era assegnato a nessuno.</p>
        ) : (
          <>
            {possibili.length > 0 && (
              <label className="flex items-center gap-3 rounded-2xl px-3 py-3 cursor-pointer">
                <input type="checkbox" className="sr-only" checked={tutte} onChange={cambiaTutte} aria-label="Seleziona tutto" />
                <Casella spuntata={tutte} />
                <span className="text-[15px] font-extrabold text-white">Seleziona tutto</span>
              </label>
            )}
            {elenco.map(v => {
              const e = etichettaVoce(v)
              if (!v.ripristinabile) {
                return (
                  <div key={v.id} className="flex items-center gap-3 rounded-2xl bg-white/[.02] border border-white/[.05] px-3 py-3 opacity-60">
                    <span className="w-6 h-6 shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-bold text-gray-300 truncate">{e.titolo}</span>
                      <span className="block text-[12.5px] text-gray-500">{v.motivo}</span>
                    </span>
                  </div>
                )
              }
              const on = spunte.has(v.id)
              return (
                <label key={v.id} className="flex items-center gap-3 rounded-2xl bg-white/[.035] border border-white/[.06] px-3 py-3 cursor-pointer">
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => cambia(v.id)}
                    aria-label={`${e.titolo}, ${e.dettaglio}`} />
                  <Casella spuntata={on} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold text-white truncate">{e.titolo}</span>
                    <span className="block text-[12.5px] text-gray-400">{e.dettaglio}</span>
                  </span>
                </label>
              )
            })}
          </>
        )}

        <div className="flex gap-3 mt-3">
          <button type="button" onClick={sheet.chiudi} disabled={lavora} className={BOTTONE_QUIETO}>Annulla</button>
          <button type="button" onClick={ripristina} disabled={lavora || voci == null} className={BOTTONE_BRAND}>
            Ripristina
          </button>
        </div>
      </div>
    </Foglio>
  )
}
