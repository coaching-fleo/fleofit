// Il testo della TV si fa grande quanto ci sta (26/11/2026).
//
// La locandina mostra il workout INTERO a destra, e un workout può avere due
// blocchi o dieci: con una grandezza fissa o si legge male o non ci sta. Qui si
// cerca, con una ricerca binaria sulla `font-size`, la più grande per cui il
// contenitore non trabocca — in altezza e in larghezza. Dentro si misura tutto
// in `em`, così una sola grandezza muove tutto insieme.
//
// Si adattano i nodi con `data-adatta` dentro il contenitore del ref:
// - `lista` (la locandina) prova due disposizioni, un esercizio per riga
//   (`colonna`) o in fila separati da un pallino (`fila`), e tiene quella che
//   lascia il testo più grande;
// - `carta` (le righe di una carta del carosello) solo la grandezza.
//
// ⚠️ Le misure sono di layout: la `scale(.8)` delle carte laterali e quella del
// canvas da 1920×1080 non le toccano.

import { useLayoutEffect, useRef } from 'react'

const MISURE = { lista: [16, 40], carta: [18, 40] }

/** La più grande `font-size` (px) fra `min` e `max` con cui `el` non trabocca. */
export function adattaTesto(el, min, max) {
  let basso = min
  let alto = max
  while (alto - basso > 0.5) {
    const m = (basso + alto) / 2
    el.style.fontSize = `${m}px`
    const sta = el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1
    if (sta) basso = m
    else alto = m
  }
  el.style.fontSize = `${basso}px`
  return basso
}

function adattaNodo(el) {
  const [min, max] = MISURE[el.dataset.adatta] || [16, 40]
  if (el.dataset.adatta !== 'lista') return adattaTesto(el, min, max)
  el.dataset.disposizione = 'colonna'
  const inColonna = adattaTesto(el, min, max)
  el.dataset.disposizione = 'fila'
  const inFila = adattaTesto(el, min, max)
  if (inColonna >= inFila) {
    el.dataset.disposizione = 'colonna'
    adattaTesto(el, min, max)
  }
}

/**
 * Torna il ref da mettere sul contenitore. Si rifà quando cambiano `dipendenze`
 * (il workout, le persone, la carta in corso) e quando i caratteri sono pronti:
 * misurato col carattere di riserva, il testo verrebbe della misura sbagliata.
 */
export default function useAdattaTesto(dipendenze) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const fai = () => {
      const radice = ref.current
      if (!radice) return
      const nodi = radice.matches?.('[data-adatta]') ? [radice] : []
      radice.querySelectorAll('[data-adatta]').forEach(n => nodi.push(n))
      nodi.forEach(adattaNodo)
    }
    fai()
    let vivo = true
    document.fonts?.ready?.then(() => { if (vivo) fai() })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dipendenze)
  return ref
}
