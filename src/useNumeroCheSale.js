import { useEffect, useRef, useState } from 'react'

/**
 * Il numero che sale.
 *
 * Un valore non compare: parte da zero e ci arriva rallentando. È la seconda
 * delle quattro animazioni misurate sul riferimento indicato dal committente il
 * 21/09/2026 — là un saldo andava da ~11.000 a 22.000 in 1,27 secondi, con un
 * incremento di +1538 nel primo fotogramma e di +1 nell'ultimo.
 *
 * 🔴 LA CURVA È ESPONENZIALE, NON LINEARE NÉ CUBICA, e questo NON è lo stesso
 * gusto della cascata. Misurando il residuo fotogramma per fotogramma
 * (3916 → 834 → 182 → 22 a intervalli regolari) si legge un decadimento
 * esponenziale: ogni 0,2 secondi ciò che manca si riduce a un quinto. È la
 * ragione per cui il numero è leggibile quasi subito e poi «si assesta» invece
 * di strisciare: un ease-out cubico passerebbe metà del tempo su cifre che
 * cambiano ancora troppo per essere lette.
 *
 * ⚠️ L'ULTIMO PASSO È ESATTO, non calcolato. `2^(-10)` vale 1/1024, quindi a
 * fine corsa la curva si ferma allo 0,9990 del valore: su 22.000 sarebbero
 * 21.978 — un numero sbagliato, mostrato per sempre, che nessun errore
 * segnalerebbe. Il salto finale al valore vero è la riga più importante del
 * file.
 */
export const DURATA_SALITA = 1300

/** Ease-out esponenziale, con l'arrivo esatto. */
export const curvaSalita = (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u))

/**
 * Chi ha chiesto meno movimento vede subito il numero vero.
 *
 * ⚠️ In caso di dubbio NON si anima. Se `matchMedia` non c'è o lancia (WebView
 * vecchie, contesti non sicuri) si torna `true`: fra mostrare un numero fermo e
 * rischiare di lasciarne uno a zero, il numero fermo è sempre la risposta
 * giusta — è un dato, non una decorazione.
 */
export const menoMovimento = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

/**
 * @param {number|null} valore  il numero d'arrivo. `null` resta `null`: una
 *   cella che non ha un dato non deve contare fino a zero (è la regola di
 *   `rpeAtteso`, CLAUDE.md §9-undecies punto 3).
 * @param {{decimali?: number, durata?: number}} opzioni
 * @returns {number|null} il valore da mostrare adesso.
 */
export function useNumeroCheSale(valore, { decimali = 0, durata = DURATA_SALITA } = {}) {
  const arrivo = Number.isFinite(valore) ? valore : null
  // Il primo render mostra già il valore vero per chi non vuole movimento:
  // partire da 0 e correggere in un effetto gli farebbe vedere uno zero.
  const [grezzo, setGrezzo] = useState(() => (menoMovimento() || arrivo === null ? arrivo : 0))
  // ⚠️ Da dove ripartire: è un ref e non uno stato perché non si legge mai
  // durante il render, e come stato rientrerebbe nelle dipendenze dell'effetto
  // facendolo ripartire a ogni fotogramma (stessa disciplina di §9-quinquies).
  const da = useRef(grezzo ?? 0)

  useEffect(() => {
    if (arrivo === null) { da.current = 0; setGrezzo(null); return }
    if (menoMovimento()) { da.current = arrivo; setGrezzo(arrivo); return }

    const partenza = da.current
    if (partenza === arrivo) { setGrezzo(arrivo); return }

    const inizio = performance.now()
    let telaio = requestAnimationFrame(function passo(ora) {
      const u = Math.min(1, (ora - inizio) / durata)
      if (u >= 1) { da.current = arrivo; setGrezzo(arrivo); return }
      setGrezzo(partenza + (arrivo - partenza) * curvaSalita(u))
      telaio = requestAnimationFrame(passo)
    })
    return () => cancelAnimationFrame(telaio)
  }, [arrivo, durata])

  if (grezzo === null) return null
  const fattore = 10 ** decimali
  return Math.round(grezzo * fattore) / fattore
}
