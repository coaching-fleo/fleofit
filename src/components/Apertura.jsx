import { useEffect, useRef, useState } from 'react'
import { menoMovimento } from '../useNumeroCheSale'

/**
 * L'apertura dell'app.
 *
 * Richiesta del committente (22/09/2026): «quando avvio l'app compare il logo
 * FLEOFIT ma poi sparisce e basta, voglio un'animazione smooth con qualche
 * shape che si muove per fare comparire la home».
 *
 * 🔴 SECONDA STESURA. La prima usava due aloni colorati che entravano e una
 * dissolvenza in uscita: bocciata dal committente — «quel gradiente è osceno, e
 * la dissolvenza non mi piace». Aveva ragione su entrambe, e la seconda è il
 * punto: **nel riferimento non c'è nessuna dissolvenza**. Avevo aggirato il
 * problema del contrasto (§9-septtricies: nero su nero non si vede) con degli
 * aloni, invece di risolverlo.
 *
 * 🔴 IL MECCANISMO VERO, riletto fotogramma per fotogramma: l'area scura resta
 * ANCORATA IN ALTO e il suo bordo inferiore — una curva il cui punto più basso
 * sta a circa un terzo da sinistra — RISALE, scoprendo la pagina da sotto. Non
 * è un foglio che scorre via, non è un velo che si spegne: è un'area che si
 * ritira dietro un arco. Misurato: ~400ms, con una decelerazione forte.
 *
 * ⚠️ LA CURVA È UN'ELLISSE, e la scelta non è estetica. `clip-path: ellipse()`
 * interpola fra due valori della STESSA funzione, quindi l'arco si muove e si
 * appiattisce da sé senza JavaScript e senza un SVG da animare a mano.
 * I numeri vengono dai fotogrammi: con il centro dell'ellisse al 30% da
 * sinistra e un raggio orizzontale dell'80%, il bordo destro dell'arco risulta
 * al 48% della profondità del punto più basso — nel video è 0,48.
 *
 * ⚠️ E IL CONTRASTO LO FA IL CONTENUTO, non un colore inventato. Sotto c'è la
 * Home, già montata e già in cascata: quello che si vede risalire non è un
 * bordo fra due neri, è la pagina che compare. L'arco porta solo una luce
 * ambra sottile perché il gesto si legga anche nel primo fotogramma, quando
 * sotto non è ancora comparso niente.
 */

/** Quanto resta a schermo al minimo, anche se i dati arrivano subito. */
const MINIMO_MS = 900
/**
 * L'uscita, in tre tempi come nel riferimento: il marchio se ne va, c'è una
 * pausa di nero, poi l'arco risale.
 * ⚠️ I 130ms di pausa sono MISURATI, non un ritardo inventato: nel video fra il
 * logo che sfuma e la tenda che parte c'è un battito di nero assoluto, ed è
 * quello a far leggere il passaggio come deliberato invece che come un
 * caricamento. Toglierlo è la prima cosa che verrà in mente a qualcuno.
 */
/**
 * L'entrata del marchio, e quanto era già viva la pagina quando questo modulo è
 * stato caricato.
 *
 * 🔴 SERVE AL PASSAGGIO DI CONSEGNE COL PRE-DISEGNO. `index.html` dipinge il
 * primo fotogramma dell'apertura prima che React esista (misurato: 1,7 secondi
 * prima, sul simulatore). Quando React monta, il marchio è già entrato da un
 * pezzo: rigiocare l'entrata qui vorrebbe dire vederlo sfumare una seconda
 * volta, a metà apertura, senza nessuna ragione visibile.
 *
 * ⚠️ Si legge a livello di MODULO e non durante il render: `performance.now()`
 * in fase di render è una chiamata impura — è la regola che ha già preso
 * `useRef(Date.now())` in questo stesso file. Il modulo viene caricato appena
 * prima del montaggio, quindi questo valore è di fatto «quanti millisecondi la
 * pagina era viva quando React è arrivato».
 */
const ENTRATA_MS = 620
const ETA_AL_CARICAMENTO = typeof performance !== 'undefined' ? performance.now() : 0
const MARCHIO_GIA_ENTRATO = ETA_AL_CARICAMENTO > ENTRATA_MS

const MARCHIO_MS = 260
const PAUSA_MS = 130
const ARCO_MS = 430
const USCITA_MS = MARCHIO_MS + PAUSA_MS + ARCO_MS

export function Apertura({ pronto, onFine }) {
  const [esce, setEsce] = useState(false)
  // ⚠️ L'istante di nascita si fissa in un EFFETTO, non durante il render:
  // `useRef(Date.now())` è una chiamata impura in fase di render, e due render
  // consecutivi darebbero due istanti diversi. È lo stesso difetto corretto su
  // `Athletes.jsx` il 26/08/2026 (CLAUDE.md §9-septies).
  const nato = useRef(0)
  useEffect(() => { nato.current = Date.now() }, [])

  useEffect(() => {
    if (!pronto || esce) return
    // ⚠️ Il minimo NON è un ritardo inventato: senza, un avvio veloce mostra
    // l'apertura per due fotogrammi e si legge come uno sfarfallio — cioè
    // peggio del taglio netto che stiamo togliendo.
    const resta = Math.max(0, MINIMO_MS - (Date.now() - (nato.current || Date.now())))
    const t = setTimeout(() => setEsce(true), resta)
    return () => clearTimeout(t)
  }, [pronto, esce])

  useEffect(() => {
    if (!esce) return
    // ⚠️ `onFine` smonta la sovrapposizione, e va chiamato DOPO l'uscita: prima,
    // e la Home comparirebbe di colpo — il difetto da cui è nata.
    const t = setTimeout(onFine, menoMovimento() ? 0 : USCITA_MS)
    return () => clearTimeout(t)
  }, [esce, onFine])

  return (
    <div
      aria-hidden="true"
      className={`apertura fixed inset-0 z-[200] ${esce ? 'apertura-esce' : ''}`}
    >
      {/* Il marchio, con la Regola del Logo di DESIGN.md: `FLEO` bianco,
          `FIT` ambra, peso 900, in un h1 solo.
          ⚠️ CENTRATO, e la prima stesura lo metteva al 38% per paura che l'arco
          lo tagliasse a metà. Paura infondata: il marchio se ne va in 260ms e
          l'arco parte a 390ms, quindi quando la curva passa dal centro dello
          schermo lì non c'è più niente. Il pre-disegno in index.html lo centra
          allo stesso modo, e i due devono coincidere. */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* ⚠️ `apertura-marchio-via` è una classe a sé e non un discendente di
            `.apertura-esce`: saltando l'entrata il marchio non ha più la classe
            da cui il selettore dell'uscita pendeva, e se ne sarebbe andato di
            colpo invece di sfumare. */}
        <h1 className={`text-[44px] leading-none font-black tracking-[-.03em] text-white
                        ${esce ? 'apertura-marchio-via' : MARCHIO_GIA_ENTRATO ? '' : 'apertura-marchio'}`}>
          FLEO<span className="text-brand">FIT</span>
        </h1>
      </div>
    </div>
  )
}
