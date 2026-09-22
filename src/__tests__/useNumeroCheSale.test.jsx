import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useNumeroCheSale, curvaSalita, DURATA_SALITA, menoMovimento } from '../useNumeroCheSale'

// Perché questi test esistono
// ────────────────────────────
// Un numero che sale è l'animazione più pericolosa dell'app: a differenza di
// un'entrata, se si ferma nel posto sbagliato **mostra un dato falso**, e lo
// mostra per sempre senza che niente segnali un errore. I casi presi qui sono
// esattamente quelli in cui la cella resterebbe plausibile e sbagliata.
//
// ⚠️ `src/test/setup.js` dichiara `prefers-reduced-motion: reduce` per tutta la
// suite, quindi qui il movimento va ACCESO a mano — come `LoginApple` fa con il
// ramo nativo. Senza, questi test verificherebbero solo il ramo fermo.

const vera = window.matchMedia

/** Spegne la preferenza «meno movimento», così l'animazione parte davvero. */
const conMovimento = () => {
  window.matchMedia = (query) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })
}

function Cella({ valore, decimali }) {
  const n = useNumeroCheSale(valore, decimali != null ? { decimali } : undefined)
  return <span data-testid="n">{n === null ? '—' : String(n)}</span>
}

const mostrato = () => screen.getByTestId('n').textContent

/** Fa passare `ms` di orologio E di fotogrammi. */
const avanza = async (ms) => {
  await act(async () => { vi.advanceTimersByTime(ms) })
}

beforeEach(() => { window.matchMedia = vera })
afterEach(() => { window.matchMedia = vera; vi.useRealTimers() })

describe('la curva', () => {
  it('parte da zero e arriva ESATTAMENTE a uno', () => {
    expect(curvaSalita(0)).toBe(0)
    expect(curvaSalita(1)).toBe(1)
  })

  // 🔴 IL TEST PIÙ IMPORTANTE DEL FILE. `2^(-10)` vale 1/1024: senza il salto
  // finale la curva si ferma a 0,9990 e un saldo di 22.000 resterebbe a 21.978
  // per sempre. È un numero sbagliato che nessun errore segnala, su una cella
  // che il coach usa per dosare il carico.
  it('NON si ferma a 0,999: l\'arrivo è esatto, non calcolato', () => {
    expect(1 - Math.pow(2, -10)).toBeLessThan(1)   // la formula da sola sbaglia
    expect(curvaSalita(1)).toBe(1)                 // la curva no
    expect(curvaSalita(1.5)).toBe(1)               // e oltre non supera
  })

  // La forma misurata sul riferimento: ciò che manca si riduce in fretta, e
  // metà del percorso è coperta nel primo 10% del tempo. Una curva lineare o
  // cubica passerebbe qui e darebbe un'animazione che striscia.
  it('è esponenziale: a un decimo del tempo ha già fatto metà strada', () => {
    expect(curvaSalita(0.1)).toBeGreaterThan(0.45)
    expect(curvaSalita(0.5)).toBeGreaterThan(0.95)
    // e non è lineare
    expect(curvaSalita(0.5)).toBeGreaterThan(0.5 * 1.5)
  })
})

describe('meno movimento', () => {
  it('senza matchMedia NON anima, invece di lanciare', () => {
    window.matchMedia = undefined
    expect(menoMovimento()).toBe(true)
  })

  // 🔴 Chi ha chiesto meno movimento deve vedere il numero vero al PRIMO
  // render, non uno zero corretto un istante dopo.
  //
  // ⚠️ E NON basta guardare il DOM dopo `render`: a quel punto gli effetti sono
  // già passati e lo zero è sparito comunque. Verificato per mutazione —
  // inizializzando lo stato a 0 per tutti, un'asserzione sul testo finale passa
  // lo stesso. Serve registrare OGNI valore renderizzato.
  it('mostra il valore vero al primo render, senza passare da zero', () => {
    const visti = []
    function Spia({ valore }) {
      const n = useNumeroCheSale(valore)
      visti.push(n)
      return <span data-testid="n">{String(n)}</span>
    }
    render(<Spia valore={516} />)
    expect(mostrato()).toBe('516')
    expect(visti.length).toBeGreaterThan(0)
    expect(visti).not.toContain(0)
    expect(visti.every((v) => v === 516)).toBe(true)
  })
})

describe('il numero che sale', () => {
  beforeEach(() => {
    conMovimento()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('parte da zero e arriva al valore vero', async () => {
    render(<Cella valore={516} />)
    expect(mostrato()).toBe('0')
    await avanza(DURATA_SALITA + 50)
    expect(mostrato()).toBe('516')
  })

  // 🔴 `null` NON è zero. Una cella senza dato non deve contare fino a zero:
  // è la regola di `rpeAtteso` e di `DurataBlocco`, alla sua ennesima comparsa.
  it('un valore assente resta assente, non conta fino a zero', async () => {
    render(<Cella valore={null} />)
    expect(mostrato()).toBe('—')
    await avanza(DURATA_SALITA + 50)
    expect(mostrato()).toBe('—')
  })

  it('arrotonda ai decimali chiesti — l\'RPE è 7,2 e non 7,1998', async () => {
    render(<Cella valore={7.2} decimali={1} />)
    await avanza(DURATA_SALITA + 50)
    expect(mostrato()).toBe('7.2')
  })

  // ⚠️ Un intero non deve mai mostrare decimali mentre sale.
  it('senza decimali non mostra mai una virgola per strada', async () => {
    render(<Cella valore={516} />)
    await avanza(120)
    expect(mostrato()).not.toContain('.')
    expect(Number(mostrato())).toBeGreaterThan(0)
  })
})
