// Righello.jsx — il righello che si trascina col pollice.
//
// Un solo controllo per ogni numero del builder: ripetizioni, chili, metri,
// tempi, round, passi. La scala (src/lib/scaleMisura.js) decide quali valori
// esistono; qui c'è solo il gesto.
//
// ⚠️ Si importa SOLO da CreateWorkout (e da FoglioMisure, che lo usa lui), MAI
// da CreaWorkoutUI.jsx: quel chunk è condiviso con WorkoutDetail e deve restare
// leggero (CLAUDE.md §2).
//
// Come funziona, e le tre cose che non sono rifinitura:
//  1. **Scorre in modo nativo** (overflow-x con aggancio alle tacche), la stessa
//     tecnica di `RuotaValori` che sul telefono ha già funzionato: l'inerzia
//     del dito è quella di iOS e Android, non una nostra imitazione.
//  2. **Lo scorrimento fatto dal codice è marcato, tutto il resto è del dito.**
//     Il righello che si posa sul valore aperto, o su una scorciatoia toccata,
//     genera eventi di scroll: `daCodice` dice dove sta andando, e finché ci va
//     quegli eventi non scrivono — aprire un esercizio non inventa un valore.
//     Ogni altro scorrimento è del coach (dito, inerzia, rotella) e scrive.
//     🔴 Fino al 14/10/2026 era al contrario: si cercava di capire QUANDO c'era
//     il dito, da touchstart/touchend più un timer di 180ms. Sul telefono quei
//     segnali non sono affidabili — iOS usa il tocco che ferma un'inerzia
//     senza sempre avvisare la pagina, Android manda `pointercancel` col dito
//     ancora giù — e il righello, credendo il dito sparito, smetteva di
//     scrivere: il numero restava bloccato mentre la scala scorreva. E il
//     righello si riposizionava da solo mentre l'inerzia era ancora in corso,
//     due animazioni che si scontravano. Segnalato più volte dal committente.
//     Ora il righello non si riposiziona MAI su un valore che ha scelto lui.
//  3. **Per chi non vede è un cursore** (`role="slider"`): si muove con le
//     frecce e con i gesti di VoiceOver/TalkBack, e `aria-valuetext` dice il
//     valore con la sua unità invece di un indice.

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { battito } from '../lib/aptica'

/**
 * La larghezza di una tacca. Dieci tacche = 220px. Era 14 (140px ogni dieci)
 * fino al 14/10/2026: il committente non riusciva a spostarlo di una tacca
 * sola, perché bastavano 7px di dito per passare alla successiva.
 */
export const PASSO_TACCA = 22

const menoMovimento = () => {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true } catch { return false }
}

/**
 * @param {object} p
 * @param {Array<{valore:string, etichetta:string, tacca:string|null}>} p.voci
 * @param {number} p.indice       la tacca su cui sta il righello
 * @param {(i:number) => void} p.onScelta   chiamata quando il coach sposta il righello
 * @param {string} p.etichetta    il nome della misura, per chi usa VoiceOver
 * @param {string} p.testoValore  il valore scritto per intero ("82,5 kg")
 * @param {string} [p.colore]     l'ago: giallo FLEOFIT o azzurro corsa
 */
export default function Righello({ voci, indice, onScelta, etichetta, testoValore, colore = 'var(--color-brand)' }) {
  const pista = useRef(null)
  const ultimo = useRef(indice)
  const ultimoBattito = useRef(0)
  const primaVolta = useRef(true)
  const vociPrima = useRef(voci)
  // Dove sta andando uno scorrimento fatto dal codice, o null.
  const daCodice = useRef(null)
  const scadenzaCodice = useRef(null)

  const liberaCodice = () => { daCodice.current = null; clearTimeout(scadenzaCodice.current) }
  // Rete di sicurezza: se lo scorrimento del codice viene interrotto senza che
  // ce ne accorgiamo (un dito che iOS non ci segnala), dopo una breve pausa
  // senza eventi il righello torna del coach. Senza, resterebbe sordo — che è
  // esattamente il difetto che questo file ha avuto.
  const rinviaScadenza = (ms) => {
    clearTimeout(scadenzaCodice.current)
    scadenzaCodice.current = setTimeout(() => { daCodice.current = null }, ms)
  }

  /** Porta il righello sulla tacca `i` (scorrimento del codice, che non scrive). */
  const portaA = useCallback((i, morbido) => {
    const el = pista.current
    if (!el) return
    const x = i * PASSO_TACCA
    if (Math.abs(el.scrollLeft - x) < 1) { liberaCodice(); return }
    daCodice.current = x
    rinviaScadenza(400)
    if (!morbido || menoMovimento() || typeof el.scrollTo !== 'function') el.scrollLeft = x
    else el.scrollTo({ left: x, behavior: 'smooth' })
  }, [])

  // Il righello si posa sul valore: prima del disegno la prima volta (niente
  // salto visibile), poi con un'animazione breve quando il valore cambia da
  // FUORI — una scorciatoia, «Riusa», il numero scritto a mano, il cambio di
  // misura. ⚠️ Se l'indice è quello che ha appena scelto il righello stesso
  // non si muove niente: l'inerzia del dito è ancora in corso, e uno
  // scorrimento del codice sopra di lei è la collisione di prima.
  useLayoutEffect(() => {
    const nuoveVoci = vociPrima.current !== voci
    vociPrima.current = voci
    if (!primaVolta.current && !nuoveVoci && indice === ultimo.current) return
    ultimo.current = indice
    portaA(indice, !primaVolta.current && !nuoveVoci)
    primaVolta.current = false
  }, [indice, voci, portaA])

  useEffect(() => () => clearTimeout(scadenzaCodice.current), [])

  const scegli = useCallback((i) => {
    const j = Math.max(0, Math.min(voci.length - 1, i))
    if (j === ultimo.current) return
    ultimo.current = j
    // Un battito per tacca, ma non più di uno ogni 30ms: a inerzia piena il
    // righello attraversa decine di tacche al secondo, e un ronzio continuo
    // non dice più niente al dito (src/lib/aptica.js, il criterio in testa).
    const ora = Date.now()
    if (ora - ultimoBattito.current > 30) { battito(); ultimoBattito.current = ora }
    onScelta(j)
  }, [voci.length, onScelta])

  const scorri = () => {
    const el = pista.current
    if (daCodice.current != null) {
      // Arrivato: da qui in poi ogni scorrimento è del coach.
      if (Math.abs(el.scrollLeft - daCodice.current) < 1) liberaCodice()
      else rinviaScadenza(150)
      return
    }
    scegli(Math.round(el.scrollLeft / PASSO_TACCA))
  }

  /** Un tasto o una tacca toccata: si sceglie, e il righello ci va. */
  const vaiA = (i) => {
    const j = Math.max(0, Math.min(voci.length - 1, i))
    scegli(j)
    portaA(j, true)
  }

  const tasto = (e) => {
    const salti = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }
    let j = null
    if (e.key in salti) j = indice + salti[e.key]
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = voci.length - 1
    if (j === null) return
    e.preventDefault()
    vaiA(j)
  }

  // Le due mezze-piste vuote ai lati: senza, la prima e l'ultima tacca non
  // potrebbero arrivare sotto l'ago.
  const margine = <span aria-hidden="true" className="shrink-0" style={{ width: `calc(50% - ${PASSO_TACCA / 2}px)` }} />

  return (
    <div className="relative select-none">
      <div
        ref={pista}
        role="slider"
        tabIndex={0}
        aria-label={etichetta}
        aria-valuemin={0}
        aria-valuemax={voci.length - 1}
        aria-valuenow={indice}
        aria-valuetext={testoValore}
        onScroll={scorri}
        onKeyDown={tasto}
        // Il dito (o la rotella) che arriva a metà di uno scorrimento del
        // codice se lo prende: da lì ogni movimento è suo.
        onTouchStart={liberaCodice}
        onPointerDown={liberaCodice}
        onWheel={liberaCodice}
        className="flex items-end h-[64px] overflow-x-auto snap-x snap-mandatory overscroll-x-contain cursor-grab
                   active:cursor-grabbing rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        style={{
          scrollbarWidth: 'none',
          // Le tacche sfumano ai bordi: dicono che la scala continua, senza
          // che una cifra tranciata a metà si legga come un difetto.
          maskImage: 'linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)',
        }}
      >
        {margine}
        {voci.map((v, i) => (
          <span key={v.valore} aria-hidden="true"
            onClick={() => vaiA(i)}
            className="snap-center shrink-0 h-full flex flex-col items-center justify-start gap-[7px] pt-3 cursor-pointer"
            style={{ width: PASSO_TACCA }}>
            <span className={`w-[2px] rounded-full ${v.tacca ? 'h-[22px] bg-[#5b6070]' : 'h-[11px] bg-white/[.14]'}`} />
            {v.tacca && (
              <span className="text-[11px] font-bold leading-none text-[#6b7080] whitespace-nowrap tabular-nums">{v.tacca}</span>
            )}
          </span>
        ))}
        {margine}
      </div>

      {/* L'ago: dove cade la scelta, nel colore della categoria. Il puntino in
          cima lo fa leggere come un indicatore e non come una tacca più lunga.
          ⚠️ I numeri delle tacche stanno SOTTO le tacche e l'ago scende solo
          fino a dove finiscono le tacche: con i numeri sopra, il puntino ci
          finiva addosso e copriva proprio il valore scelto. */}
      <span aria-hidden="true" className="absolute left-1/2 top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none">
        <span className="w-[9px] h-[9px] rounded-full" style={{ background: colore, boxShadow: `0 0 12px ${colore}` }} />
        <span className="w-[3px] h-[28px] rounded-full -mt-[2px]" style={{ background: colore }} />
      </span>
    </div>
  )
}
