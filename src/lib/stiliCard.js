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

/**
 * Il vetro dei controlli secondari: bottoni tondi, righe, chip, barra fissa.
 *
 * Stava dentro CreaWorkoutUI.jsx come costante privata. La scheda del workout
 * usa gli stessi controlli — indietro, TV, cardio, menu — e una seconda copia
 * qui sarebbe il modo in cui i due schermi cominciano a divergere di un'ombra.
 */
export const VETRO = 'bg-white/[.07] border border-white/[.12] shadow-[inset_0_1px_0_rgba(255,255,255,.07)]'

/**
 * La carta sollevata in formato RIGA: stesso impasto di `CARD` — gradiente,
 * hairline chiara in alto, ombra proiettata neutra — con raggio e ombra
 * proporzionati a una riga da 60px invece che a una card intera.
 *
 * Perché non `CARD` con il raggio sovrascritto: `rounded-2xl` e
 * `rounded-[22px]` sono due utility della stessa specificità, e a decidere è
 * l'ordine nel foglio di stile, non l'ordine nella stringa di classi. Una
 * sovrascrittura del genere funziona finché Tailwind non cambia idea su come
 * ordina le regole, e allora smette senza dire niente.
 */
/**
 * L'impasto della carta-riga SENZA il bordo: gradiente, hairline chiara in
 * alto, ombra proiettata.
 *
 * 🔴 Esiste perché il bordo va DICHIARATO dal chiamante quando non è quello
 * neutro. `border-white/[.07]` e `border-brand/20` sono due utility della
 * stessa specificità: aggiungere la seconda accanto a `CARTA_RIGA` non
 * sovrascrive niente, e a decidere è l'ordine nel foglio di stile — cioè il
 * bordo resta bianco e nessuno se ne accorge. È la stessa trappola già
 * annotata qui sotto per il raggio, e nel calendario si è ripresentata
 * identica: la riga «da fare» credeva di avere il contorno ambra e aveva
 * quello neutro (31/08/2026, trovato leggendo lo stile CALCOLATO — lo
 * screenshot e il test sulla classe passavano entrambi).
 */
export const CARTA_RIGA_BASE = 'rounded-2xl bg-gradient-to-b from-[#1c1c1f] to-[#171719] ' +
  'shadow-[0_14px_28px_-18px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.06)]'

export const CARTA_RIGA = `${CARTA_RIGA_BASE} border border-white/[.07]`
