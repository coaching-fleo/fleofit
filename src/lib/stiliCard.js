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
 *
 * 🔴 `CARD_BASE` è lo stesso impasto SENZA il bordo, ed esiste per la stessa
 * ragione di `CARTA_RIGA_BASE` qui sotto: `border-white/[.07]` e
 * `border-red-500/30` sono due utility della STESSA specificità, quindi
 * affiancarle non sovrascrive niente — a decidere è l'ordine nel foglio di
 * stile. Chi ha un bordo di stato (lo spettatore «LIVE» della Coach Cam) parte
 * da `CARD_BASE` e lo dichiara, invece di credere di averlo sovrascritto.
 */
export const CARD_BASE = 'rounded-[22px] bg-gradient-to-b from-[#1c1c1f] to-[#171719] ' +
  'shadow-[0_18px_34px_-18px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.06)]'

export const CARD = `${CARD_BASE} border border-white/[.07]`

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

/**
 * I quattro toni con cui il report marca un verdetto o una proposta.
 *
 * Solo l'arancione chiede un'azione e solo il verde dichiara un margine: tutto
 * il resto è quieto. Un report in cui ogni riga è colorata non ha più una riga
 * che spicca, che è l'unica cosa per cui lo si apre il lunedì.
 *
 * ⚠️ Stanno qui e non dentro `ReportUI.jsx` perché li usano DUE file di
 * componenti — il report squadra e quello del singolo — e un modulo di
 * componenti che esporta anche una costante perde il Fast Refresh per intero
 * (`react-refresh/only-export-components`, §9-octies punto 3). Una seconda
 * copia sarebbe il modo in cui le due pagine cominciano a colorare lo stesso
 * verdetto in due modi diversi.
 */
export const TONO_VERDETTO = {
  allarme: 'bg-orange-500/[.13] border-orange-500/[.32] text-orange-400',
  attenzione: 'bg-white/[.07] border-white/[.14] text-gray-200',
  buono: 'bg-green-500/[.13] border-green-500/[.3] text-green-400',
  neutro: 'bg-transparent border-white/[.08] text-[#5b6070]',
}

/**
 * ── IL DIALOGO CENTRATO ───────────────────────────────────────────────────
 *
 * Alert, conferme e «sei sicuro?»: la carta sollevata in formato dialogo, la
 * bolla dell'icona, i due corpi di testo e i tre bottoni.
 *
 * 🔴 Stanno qui e non dentro `CustomModals.jsx` per DUE ragioni, e la seconda
 * è quella che conta. La prima: un file di componenti che esporta anche una
 * costante perde il Fast Refresh per intero (§9-octies punto 3). La seconda:
 * `CustomAlert`/`CustomConfirm` non coprono tutti i dialoghi del progetto —
 * quelli con una conferma DISTRUTTIVA hanno etichette proprie («Sì, esci»,
 * «Elimina») e restano aperti mentre il lavoro è in corso, cosa che il
 * contratto di `CustomConfirm` non sa fare (chiude appena si conferma). Sono
 * quindi scritti a mano in tre pagine, ed erano quattro copie delle stesse
 * stringhe di classi: la quinta sarebbe stata quella che diverge.
 *
 * ⚠️ IL PESO DEL CARATTERE NON STA NELLA COSTANTE CONDIVISA DEL BOTTONE.
 * `font-bold` e `font-black` sono due utility della STESSA specificità: messe
 * insieme, a decidere è l'ordine nel foglio di stile e non l'ordine in cui le
 * si scrive. È la trappola del bordo di `CARTA_RIGA` e del raggio di `CARD`,
 * qui sopra. Ogni variante dichiara il proprio peso, una volta sola.
 */
export const CARTA_MODALE = `${CARD} w-full max-w-sm p-6 flex flex-col gap-3.5 text-center modal-transition`

/** La bolla dell'icona: gli stessi toni di `TONO_VERDETTO`, non un fondo pieno. */
export const BOLLA_MODALE = 'w-14 h-14 rounded-full border flex items-center justify-center mx-auto mb-1 shrink-0'
export const TONO_BOLLA = {
  errore: 'bg-red-500/[.13] border-red-500/[.32] text-red-400',
  successo: 'bg-green-500/[.13] border-green-500/[.3] text-green-400',
  avviso: 'bg-brand/[.13] border-brand/[.32] text-brand',
}

export const TITOLO_MODALE = 'text-[19px] font-black tracking-tight text-white'
export const TESTO_MODALE = 'text-[13.5px] leading-relaxed text-gray-400'

const BOTTONE_MODALE = 'flex-1 min-h-[52px] rounded-2xl text-[15.5px] transition active:scale-[.98] disabled:opacity-50'
/** Il secondario: vetro, come ogni controllo quieto dell'app. */
export const BOTTONE_QUIETO = `${BOTTONE_MODALE} ${VETRO} font-bold text-white hover:border-white/25`
/** Il primario: la stessa ombra ambra della CTA, perché è la stessa promessa. */
export const BOTTONE_BRAND = `${BOTTONE_MODALE} bg-brand text-black font-black hover:brightness-110 ` +
  'shadow-[0_14px_26px_-10px_rgba(241,186,23,.5),inset_0_1px_0_rgba(255,255,255,.4)]'
/** Il distruttivo: rosso, e mai la primaria di un dialogo che non elimina. */
export const BOTTONE_PERICOLO = `${BOTTONE_MODALE} bg-red-600 text-white font-black hover:bg-red-500 ` +
  'shadow-[0_14px_26px_-10px_rgba(220,38,38,.55),inset_0_1px_0_rgba(255,255,255,.25)]'
