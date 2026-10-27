import { useRef } from 'react'

/** Quanto deve correre il dito in orizzontale perché sia un gesto e non un tocco. */
export const SOGLIA_SWIPE = 50

/**
 * useSwipeOrizzontale — un colpo di dito a sinistra o a destra (27/10/2026).
 *
 * Nato per cambiare mese nei calendari (`CardMese` di CalendarioUI), ma non sa
 * niente di mesi: dice solo da che parte è andato il dito.
 *
 * Si decide a dito ALZATO, non durante il movimento: niente da trascinare, e
 * così uno scorrimento di pagina che parte storto non fa scattare niente.
 * ⚠️ Vale solo se il gesto è netto in orizzontale (|dx| > 1,5 × |dy|): la
 * carta sta in una pagina che scorre in verticale, e un pollice che sale non
 * va mai dritto.
 *
 * Niente vibrazione: è navigazione, e sulla navigazione non si vibra
 * (docs/memoria/movimento-e-aptica.md).
 *
 * Uso:
 *   const swipe = useSwipeOrizzontale({ onSinistra, onDestra })
 *   <div {...swipe}>
 */
export function useSwipeOrizzontale({ onSinistra, onDestra }) {
  const inizio = useRef(null)
  if (!onSinistra && !onDestra) return {}

  return {
    onTouchStart: (e) => {
      const t = e.touches?.[0]
      inizio.current = t ? { x: t.clientX, y: t.clientY } : null
    },
    onTouchEnd: (e) => {
      const da = inizio.current
      inizio.current = null
      const t = e.changedTouches?.[0]
      if (!da || !t) return
      const dx = t.clientX - da.x
      const dy = t.clientY - da.y
      if (Math.abs(dx) < SOGLIA_SWIPE || Math.abs(dx) <= Math.abs(dy) * 1.5) return
      if (dx < 0) onSinistra?.()
      else onDestra?.()
    },
    onTouchCancel: () => { inizio.current = null },
  }
}
