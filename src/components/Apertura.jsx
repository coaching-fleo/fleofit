import { useEffect, useRef, useState } from 'react'
import { menoMovimento } from '../useNumeroCheSale'

/**
 * L'apertura dell'app.
 *
 * Richiesta del committente (22/09/2026): «quando avvio l'app compare il logo
 * FLEOFIT ma poi sparisce e basta, voglio un'animazione smooth con qualche
 * shape che si muove per fare comparire la home».
 *
 * 🔴 PRIMA DI PROGETTARE, MISURARE. Registrando l'avvio vero sul simulatore
 * (`xcrun simctl io recordVideo`) e leggendo la luminanza fotogramma per
 * fotogramma, la sequenza era:
 *     nero 0,52s  →  🔴 BIANCO 0,38s  →  «FLEOFIT / Caricamento…»  →  taglio
 * Il lampo bianco non era nella richiesta ed è il difetto peggiore dei due: su
 * un'app tutta scura sono quasi quattro decimi di secondo di schermo acceso.
 * Si corregge fuori di qui — `index.html` e `capacitor.config.ts` — perché
 * avviene PRIMA che React esista.
 *
 * 🔴 PERCHÉ LE FORME SONO COLORATE, E NON UNA TENDA COME NEL RIFERIMENTO.
 * Nel video di riferimento la rivelazione è un foglio chiaro che sale su un
 * fondo nero: funziona perché è nero su crema, cioè contrasto totale. In
 * FLEOFIT tutto è `#0B0B0B` su `#1e1e1e` e una tenda fra quei due colori è
 * invisibile (CLAUDE.md §9-septtricies, dove era l'unica delle quattro
 * animazioni lasciata fuori). Qui il contrasto lo portano le FORME: ambra e
 * azzurro sono gli unici due colori dell'app che si staccano dal nero, e sono
 * le due corsie — Hyrox e Running. Non sono decorazione: sono il marchio che
 * si muove.
 *
 * ⚠️ SONO `radial-gradient`, NON CERCHI SFOCATI. Una `filter: blur()` dentro un
 * elemento che anima l'opacità cambia colore nell'istante in cui il layer GPU
 * viene liberato — misurato, Y 48,08 → 52,31 (§9-septtricies). Qui l'opacità si
 * anima eccome, quindi la sfocatura è proprio ciò che non si può usare.
 */

/** Quanto resta a schermo al minimo, anche se i dati arrivano subito. */
const MINIMO_MS = 900
/** L'uscita, dopo che l'app è pronta. */
const USCITA_MS = 520

export function Apertura({ pronto, onFine }) {
  const [esce, setEsce] = useState(false)
  // ⚠️ L'istante di nascita si fissa in un EFFETTO, non durante il render:
  // `useRef(Date.now())` è una chiamata impura in fase di render, e due render
  // consecutivi darebbero due istanti diversi. È lo stesso difetto corretto su
  // `Athletes.jsx` il 26/08/2026 (CLAUDE.md §9-septies), qui preso dal linter.
  const nato = useRef(0)
  useEffect(() => { nato.current = Date.now() }, [])

  useEffect(() => {
    if (!pronto || esce) return
    // ⚠️ Il minimo NON è un ritardo inventato: senza, un avvio veloce mostra
    // l'apertura per due fotogrammi e si legge come uno sfarfallio — cioè
    // peggio del taglio netto che stiamo togliendo. Con i dati lenti non
    // aggiunge niente, perché il tempo è già passato.
    const resta = Math.max(0, MINIMO_MS - (Date.now() - (nato.current || Date.now())))
    const t = setTimeout(() => setEsce(true), resta)
    return () => clearTimeout(t)
  }, [pronto, esce])

  useEffect(() => {
    if (!esce) return
    // ⚠️ `onFine` smonta la sovrapposizione. Va chiamato DOPO l'uscita, o la
    // Home comparirebbe di colpo — che è il difetto che stiamo correggendo.
    const t = setTimeout(onFine, menoMovimento() ? 0 : USCITA_MS)
    return () => clearTimeout(t)
  }, [esce, onFine])

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[200] overflow-hidden bg-[#0B0B0B] ${esce ? 'apertura-esce' : ''}`}
    >
      {/* Le due forme. Partono fuori dallo schermo e si incrociano dietro al
          marchio; in uscita scappano verso l'alto e liberano la pagina.
          ⚠️ `will-change` NO: sono due elementi soli e vivono un secondo. */}
      <span className="apertura-forma apertura-forma-1"
        style={{ '--alone-rgb': '241 186 23', '--alone-alfa': .5 }} />
      <span className="apertura-forma apertura-forma-2"
        style={{ '--alone-rgb': '0 148 198', '--alone-alfa': .42 }} />

      {/* Il marchio, con la Regola del Logo di DESIGN.md: `FLEO` bianco,
          `FIT` ambra, peso 900, in un h1 solo. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <h1 className="apertura-marchio text-[44px] leading-none font-black tracking-[-.03em] text-white">
          FLEO<span className="text-brand">FIT</span>
        </h1>
      </div>
    </div>
  )
}
