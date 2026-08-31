import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Copy, Trash2 } from 'lucide-react'
import { MenuScheda } from '../components/WorkoutDetailUI'
import { SOGLIA_CHIUSURA } from '../useBottomSheet'

// Perché questo test esiste
// ─────────────────────────
// Il menu della scheda workout aveva tre difetti che si vedevano solo usandolo
// sul telefono, e nessuno dei tre dava un errore da nessuna parte:
//
//  1. **non si apriva con un'animazione**, perché la classe che avrebbe dovuto
//     farlo (`animate-in slide-in-from-bottom`) viene da tw-animate-css, che
//     non è installato: generava zero CSS;
//  2. **la maniglia non faceva niente** — era uno `span` decorativo, e il gesto
//     che chiunque prova per primo su un foglio iOS non era collegato a nulla;
//  3. **la pagina sotto continuava a scorrere**, quindi il foglio galleggiava
//     su un contenuto in movimento.
//
// Sono esercitati qui attraverso il componente vero, non attraverso l'hook:
// il difetto 2 stava proprio nel cablaggio fra i due.

const voci = [
  { etichetta: 'Duplica', icona: Copy, onClick: vi.fn() },
  { etichetta: 'Elimina', icona: Trash2, onClick: vi.fn(), pericolo: true },
]

const tocca = (el, y) => fireEvent.touchStart(el, { touches: [{ clientY: y }] })
const muovi = (el, y) => fireEvent.touchMove(el, { touches: [{ clientY: y }] })

const apri = (onChiudi = vi.fn()) => {
  render(<MenuScheda onChiudi={onChiudi} voci={voci} />)
  return { onChiudi, maniglia: screen.getByRole('button', { name: /Chiudi il menu/i }) }
}

/** L'uscita è animata: `onChiudi` arriva solo quando è finita. */
const attendiUscita = () => act(() => { vi.advanceTimersByTime(400) })

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(() => { vi.useRealTimers() })

describe('l’apertura del foglio', () => {
  it('parte dal basso, con un’animazione vera', async () => {
    apri()
    const foglio = screen.getByRole('menu')
    // ⚠️ È l'asserzione che coglie il difetto originale: la classe c'era ma non
    // esisteva in CSS. `sheet-in` è dichiarata in src/index.css, e il test
    // controlla che il foglio la porti — non che «una classe qualsiasi» ci sia.
    expect(foglio.className).toMatch(/\bsheet-in\b/)
  })

  it('e la lascia andare appena il dito lo tocca', async () => {
    // 🔴 La trappola: un keyframe attivo vince sullo stile inline, quindi
    // finché `sheet-in` è addosso al foglio il trascinamento non lo muove —
    // è lo stesso difetto dello swipe della Home (CLAUDE.md §9-octies).
    const { maniglia } = apri()
    tocca(maniglia, 400)
    muovi(maniglia, 460)
    const foglio = screen.getByRole('menu')
    expect(foglio.className).not.toMatch(/\bsheet-in\b/)
    expect(foglio.style.transform).toBe('translateY(60px)')
  })
})

describe('la maniglia', () => {
  it('trascinata oltre la soglia chiude', async () => {
    const { onChiudi, maniglia } = apri()
    tocca(maniglia, 400)
    muovi(maniglia, 400 + SOGLIA_CHIUSURA + 20)
    fireEvent.touchEnd(maniglia)
    expect(onChiudi).not.toHaveBeenCalled()   // l'uscita si vede prima
    attendiUscita()
    expect(onChiudi).toHaveBeenCalledTimes(1)
  })

  it('trascinata poco torna su, e non chiude', async () => {
    // Senza questo, «chiude sempre» passerebbe il test qui sopra.
    const { onChiudi, maniglia } = apri()
    tocca(maniglia, 400)
    muovi(maniglia, 400 + SOGLIA_CHIUSURA - 20)
    fireEvent.touchEnd(maniglia)
    attendiUscita()
    expect(onChiudi).not.toHaveBeenCalled()
    expect(screen.getByRole('menu').style.transform).toBe('translateY(0px)')
  })

  it('non si lascia tirare verso l’alto', async () => {
    const { maniglia } = apri()
    tocca(maniglia, 400)
    muovi(maniglia, 300)
    expect(screen.getByRole('menu').style.transform).toBe('translateY(0px)')
  })

  it('e a un tocco secco chiude lo stesso', async () => {
    // È il gesto che prova chi non sa che si può trascinare.
    const { onChiudi, maniglia } = apri()
    fireEvent.click(maniglia)
    attendiUscita()
    expect(onChiudi).toHaveBeenCalledTimes(1)
  })
})

describe('lo scorrimento della pagina sotto', () => {
  it('è bloccato finché il foglio è aperto', async () => {
    // ⚠️ `position: fixed` e non `overflow: hidden`: su iOS il secondo non
    // ferma il WKWebView, ed era il difetto segnalato.
    const { unmount } = render(<MenuScheda onChiudi={vi.fn()} voci={voci} />)
    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.position).toBe('')
    expect(document.body.style.overflow).toBe('')
  })

  it('e riparte da dove era, non dall’inizio della pagina', async () => {
    // `position: fixed` azzera lo scorrimento: senza il ripristino, chiudere
    // il menu riporterebbe in cima alla scheda.
    window.scrollY = 640
    const torna = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { unmount } = render(<MenuScheda onChiudi={vi.fn()} voci={voci} />)
    expect(document.body.style.top).toBe('-640px')
    unmount()
    expect(torna).toHaveBeenCalledWith(0, 640)
    torna.mockRestore()
    window.scrollY = 0
  })
})

describe('le altre vie di uscita', () => {
  it('il velo dietro al foglio', async () => {
    const onChiudi = vi.fn()
    const { container } = render(<MenuScheda onChiudi={onChiudi} voci={voci} />)
    void container
    fireEvent.click(screen.getByRole('menu').parentElement)
    attendiUscita()
    expect(onChiudi).toHaveBeenCalledTimes(1)
  })

  it('il tasto Esc', async () => {
    const { onChiudi } = apri()
    fireEvent.keyDown(window, { key: 'Escape' })
    attendiUscita()
    expect(onChiudi).toHaveBeenCalledTimes(1)
  })

  it('e una voce toccata chiude E fa la sua cosa', async () => {
    const { onChiudi } = apri()
    fireEvent.click(screen.getByRole('menuitem', { name: /Duplica/ }))
    expect(voci[0].onClick).toHaveBeenCalledTimes(1)
    attendiUscita()
    expect(onChiudi).toHaveBeenCalledTimes(1)
  })

  it('ma due gesti di chiusura non chiamano due volte', async () => {
    // L'uscita dura, e in quel mezzo secondo si può toccare ancora.
    const { onChiudi, maniglia } = apri()
    fireEvent.click(maniglia)
    fireEvent.keyDown(window, { key: 'Escape' })
    attendiUscita()
    expect(onChiudi).toHaveBeenCalledTimes(1)
  })
})
