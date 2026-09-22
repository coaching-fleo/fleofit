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
 * 🔴 IL MARCHIO NON HA UN'ENTRATA, ED È LA CORREZIONE DI UN DIFETTO.
 *
 * L'aveva (sfumava salendo di 10px), e produceva un rimbalzo: `index.html`
 * dipinge il primo fotogramma dell'apertura prima che React esista, quindi
 * quell'entrata veniva giocata due volte — una dal pre-disegno e una da qui,
 * quando React monta a metà. A schermo il marchio arrivava a piena opacità, si
 * abbassava di dieci pixel e si sbiadiva, poi tornava. Segnalato dal
 * committente il 22/09/2026 e confermato fotogramma per fotogramma.
 *
 * ⚠️ HO PROVATO DUE VOLTE A SALVARE L'ENTRATA, E SONO STATE DUE VOLTE
 * SBAGLIATE. Prima una soglia («se è passato più di 620ms, saltala»): copre
 * solo il caso in cui React arriva tardi, mentre quando arriva a metà —  il
 * caso normale — l'entrata non veniva saltata ma RICOMINCIATA. Poi un
 * `animation-delay` negativo per riprenderla da dove stava, leggendo il punto
 * con `getAnimations()` sul nodo del pre-disegno: non funziona perché questo
 * modulo viene valutato PRIMA che quell'animazione sia partita, quindi non
 * c'è ancora niente da leggere.
 *
 * La risposta non era un passaggio di consegne più furbo: era togliere la
 * seconda animazione. Il marchio c'è e basta, identico prima e dopo, e non può
 * più rimbalzare perché non gli succede niente. La cosa che si muove in questa
 * schermata è l'arco, che è il punto.
 */
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
          ⚠️ CENTRATO, e una stesura precedente lo metteva al 38% per paura che
          l'arco lo tagliasse a metà. Paura infondata: il marchio se ne va in
          260ms e l'arco parte a 390ms, quindi quando la curva passa dal centro
          dello schermo lì non c'è più niente. Il pre-disegno in index.html lo
          centra allo stesso modo, e i due devono coincidere. */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* ⚠️ `apertura-marchio-via` è una classe a sé e non un discendente di
            `.apertura-esce`: il marchio non ha più nessun'altra classe — non ha
            un'entrata, vedi sopra — quindi un selettore che pendesse da quella
            non avrebbe niente a cui attaccarsi, e l'uscita sparirebbe. */}
        <h1 className={`text-[44px] leading-none font-black tracking-[-.03em] text-white
                      ${esce ? 'apertura-marchio-via' : ''}`}>
          FLEO<span className="text-brand">FIT</span>
        </h1>
      </div>
    </div>
  )
}
