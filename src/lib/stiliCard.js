// Le due classi che definiscono la "carta sollevata" (DESIGN.md → La Regola
// della Carta Sollevata).
//
// Perché stanno in `lib/` e non dentro un componente: HomeAtletaUI.jsx e
// HomeCoachUI.jsx le usano entrambe, ma un file di componenti che esporta
// anche una costante perde il Fast Refresh per INTERO
// (`react-refresh/only-export-components`, §9-octies punto 3). Un modulo di
// sole costanti non ha quel problema, e soprattutto tiene l'ombra in un punto
// solo: era esattamente la ragione per cui erano state estratte.

/**
 * Card di primo livello: ombra proiettata morbida NEUTRA più una hairline
 * chiara sul bordo alto, che simula la luce che cade dall'alto. È questa riga
 * a togliere l'effetto piatto. Il glow COLORATO resta stato, non atmosfera.
 */
export const CARD = 'rounded-[22px] border border-white/[.07] bg-gradient-to-b from-[#1c1c1f] to-[#171719] ' +
  'shadow-[0_18px_34px_-18px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.06)]'

/** L'etichetta di cella: 11px è il pavimento tipografico del progetto. */
export const LABEL = 'text-[11px] font-bold uppercase tracking-[.1em] text-muted'

/**
 * La riga annidata dentro una sezione. Resta PIATTA di proposito: la carta
 * sollevata è un livello, non un effetto da ripetere a ogni profondità.
 */
export const RIGA = 'rounded-[18px] bg-white/[.035] border border-white/[.06] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,.05)]'
