// testataFoto.js — le regole della «Testata con Foto» (src/components/TestataFoto.jsx).
// Logica pura e classi condivise: le usano il foglio veloce di «In allenamento oggi»
// e la scheda atleta. DESIGN.md, «La Testata con Foto».

/** Quanta altezza della foto deve restare visibile perché valga la foto piena. */
export const VISIBILE_MINIMO = 0.45

/**
 * «piena» o «ancorata»: quanto della foto si vedrebbe a tutta larghezza.
 * Con la foto più stretta (in proporzione) del riquadro se ne vede in altezza
 * proporzioneFoto / proporzioneRiquadro; con la foto più larga, tutta.
 * Senza misure (foto non ancora caricata) «piena»: è il caso del telefono.
 */
export function modoFoto(larghezzaFoto, altezzaFoto, larghezza, altezza) {
  if (!larghezzaFoto || !altezzaFoto || !larghezza || !altezza) return 'piena'
  const visibile = Math.min(1, (larghezzaFoto / altezzaFoto) / (larghezza / altezza))
  return visibile >= VISIBILE_MINIMO ? 'piena' : 'ancorata'
}

/** Quanta altezza della foto ancorata resta visibile: la si allarga fin lì, non oltre. */
export const VISIBILE_ANCORATA = 0.6
/** La foto ancorata non supera questa frazione della larghezza della testata. */
export const LARGHEZZA_MASSIMA_ANCORATA = 0.82

/**
 * Quanto è larga (px) la foto ancorata. Alla sua proporzione intera sarebbe
 * altezza × proporzione: su una testata larghissima (la scheda atleta sul
 * desktop) diventa un francobollo. La si allarga ritagliandola sopra e sotto
 * finché se ne vede il 60% dell'altezza, mai oltre l'82% della testata.
 */
export function larghezzaAncorata(larghezzaFoto, altezzaFoto, larghezza, altezza) {
  if (!larghezzaFoto || !altezzaFoto || !larghezza || !altezza) return null
  return Math.round(Math.min(larghezza * LARGHEZZA_MASSIMA_ANCORATA, (altezza * larghezzaFoto / altezzaFoto) / VISIBILE_ANCORATA))
}

/** Un bottone tondo di vetro sopra la foto (chiudi, indietro, menu): 44px, leggibile su qualunque foto. */
export const BOTTONE_SU_FOTO = 'w-11 h-11 rounded-full bg-black/45 backdrop-blur-md border border-white/[.12] text-white flex items-center justify-center hover:bg-black/60 transition'
/** La pillola di vetro sopra la foto («Scheda ›», «Aggiungi foto», i bottoni della scheda). */
export const PILLOLA_SU_FOTO = 'h-10 px-3.5 rounded-full bg-white/[.14] backdrop-blur-md border border-white/[.14] text-[13px] font-extrabold text-white flex items-center gap-1 transition hover:bg-white/[.2]'
