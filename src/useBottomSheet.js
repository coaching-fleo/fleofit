import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Un bottom sheet che si comporta come quelli di iOS: entra dal basso, si
 * trascina giù per la maniglia, e mentre è aperto la pagina sotto NON scorre.
 *
 * Perché è un hook e non tre righe dentro un componente: i tre pezzi si
 * tengono. Il blocco dello scorrimento va rimesso a posto esattamente quando
 * finisce l'uscita, e il trascinamento deve poter *diventare* la chiusura senza
 * che il foglio torni su per un fotogramma. Separati, divergono.
 *
 * 🔴 **L'entrata era una classe che non esisteva.** La prima stesura usava
 * `animate-in slide-in-from-bottom` di tw-animate-css, che **non è installato**:
 * genera zero CSS (verificato sul bundle, `grep -c animate-in dist/assets/*.css`
 * → 0). Era un'animazione che nessuno ha mai visto — la stessa trappola già
 * annotata in `src/index.css`. Ora è il keyframe `.sheet-in`, scritto lì.
 *
 * ⚠️ **`.sheet-in` non ha `fill`, e va tolta appena il dito tocca il foglio.**
 * Un'animazione con `fill: both` **vince sullo stile inline**: il foglio
 * resterebbe fermo sotto il dito mentre lo si trascina. È esattamente il
 * difetto documentato in CLAUDE.md §9-octies punto 1 sullo swipe della Home.
 * Senza `fill`, a fine animazione l'elemento torna da sé allo stile di base —
 * che è già `translateY(0)` — e non serve nessuno stato per l'entrata.
 */

/** Quanto va trascinato prima che il rilascio chiuda invece di tornare su. */
export const SOGLIA_CHIUSURA = 100

const menoMovimento = () => {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    // Un matchMedia che lancia non è una ragione per non aprire il foglio.
    return false
  }
}

/**
 * ⚠️ Blocca lo scorrimento della pagina con `position: fixed` sul body, non con
 * `overflow: hidden`.
 *
 * Su iOS `overflow: hidden` sul body non ferma il WKWebView: il contenuto sotto
 * continua a scorrere dietro il foglio, ed è il difetto che questo hook esiste
 * per chiudere. `position: fixed` lo ferma davvero, ma azzera lo scorrimento —
 * quindi la posizione va memorizzata e rimessa alla chiusura, o chiudendo il
 * menu si torna in cima alla scheda.
 */
function useScorrimentoBloccato() {
  useEffect(() => {
    const body = document.body
    const y = window.scrollY || 0
    const prima = {
      position: body.style.position, top: body.style.top,
      left: body.style.left, right: body.style.right,
      width: body.style.width, overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      Object.assign(body.style, prima)
      window.scrollTo(0, y)
    }
  }, [])
}

export function useBottomSheet(onChiudi, { soglia = SOGLIA_CHIUSURA, durata = 300 } = {}) {
  // L'uscita è una transizione inline, quindi la sua durata la decide il JS:
  // una media query non può spegnere una `transition` scritta nello style.
  const ms = menoMovimento() ? 0 : durata

  const [uscendo, setUscendo] = useState(false)
  const [offset, setOffset] = useState(0)
  const [trascinando, setTrascinando] = useState(false)
  // ⚠️ Una volta toccato, il foglio non torna mai «in entrata». Senza questo,
  // un trascinamento annullato riportava offset a 0 e la classe `sheet-in`
  // sull'elemento: il foglio **rifaceva l'animazione di apertura** invece di
  // risalire al suo posto. Trovato scrivendo il test, non guardando il codice.
  const [toccato, setToccato] = useState(false)

  const gesto = useRef(null)
  const offsetRef = useRef(0)
  const inChiusura = useRef(false)
  const orologio = useRef(null)

  useScorrimentoBloccato()
  useEffect(() => () => clearTimeout(orologio.current), [])

  /** Avvia l'uscita, e avvisa il chiamante solo quando è finita. */
  const chiudi = useCallback(() => {
    if (inChiusura.current) return
    inChiusura.current = true
    setUscendo(true)
    orologio.current = setTimeout(onChiudi, ms)
  }, [onChiudi, ms])

  // Il tasto Esc chiude, come su ogni altra superficie modale.
  useEffect(() => {
    const suTasto = (e) => { if (e.key === 'Escape') chiudi() }
    window.addEventListener('keydown', suTasto)
    return () => window.removeEventListener('keydown', suTasto)
  }, [chiudi])

  const muoviA = (y) => {
    // Solo verso il basso: tirare in su non alza il foglio oltre il suo posto.
    const giu = Math.max(0, y)
    offsetRef.current = giu
    setOffset(giu)
  }

  const maniglia = {
    onTouchStart: (e) => {
      if (inChiusura.current) return
      gesto.current = { partenza: e.touches[0].clientY }
      setToccato(true)
      setTrascinando(true)
    },
    onTouchMove: (e) => {
      if (!gesto.current) return
      muoviA(e.touches[0].clientY - gesto.current.partenza)
    },
    onTouchEnd: () => {
      if (!gesto.current) return
      gesto.current = null
      setTrascinando(false)
      if (offsetRef.current > soglia) chiudi()
      else muoviA(0)
    },
    onTouchCancel: () => {
      gesto.current = null
      setTrascinando(false)
      muoviA(0)
    },
    // Un tocco sulla maniglia chiude, senza doverla trascinare: è il gesto che
    // chi non conosce il trascinamento prova per primo.
    onClick: () => { if (!gesto.current) chiudi() },
  }

  // Finché nessuno l'ha toccato, è il keyframe a governare il foglio. Dal primo
  // contatto in poi comanda lo stile inline — e le due cose non possono
  // convivere (vedi la nota in testa al file).
  const inEntrata = !toccato && !uscendo

  const stileFoglio = inEntrata ? undefined : {
    transform: uscendo ? 'translateY(100%)' : `translateY(${offset}px)`,
    transition: trascinando ? 'none' : `transform ${ms}ms cubic-bezier(.16,1,.3,1)`,
  }
  const stileVelo = uscendo ? { opacity: 0, transition: `opacity ${ms}ms ease-out` } : undefined

  return { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio: inEntrata ? 'sheet-in' : '', classeVelo: uscendo ? '' : 'velo-in', offset, uscendo, trascinando }
}
