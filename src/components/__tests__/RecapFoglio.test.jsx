import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FoglioRecap } from '../RecapUI'

// Perché questo test esiste
// ─────────────────────────
// La cornice del recap (CLAUDE.md §9-quadragies) è l'unico pezzo dell'app che
// si muove DA SOLO: le schede avanzano allo scadere del loro tempo, come in una
// storia. Tre proprietà, e nessuna delle tre dà errore quando si rompe —
// danno una schermata che scorre via prima di essere letta, o una che non
// scorre affatto:
//
//  1. il tempo passa e la scheda successiva arriva;
//  2. **tenere premuto lo ferma**, che è l'unico modo di leggere un grafico a
//     otto barre in una superficie che avanza da sola;
//  3. **l'ultima non si chiude da sola**, perché porta «Apri la scheda».
//
// Si monta `FoglioRecap` da solo e non una pagina: qui non c'entrano né
// Supabase né il completamento, e la logica di QUALI schede esistano è già
// coperta da `src/lib/__tests__/recapAllenamento`.

const SCHEDE = [
  { tipo: 'fatto', titolo: 'Hyrox Forza', categoria: 'Hyrox', data: 'martedì 22 settembre', celle: [], ordinale: 14 },
  { tipo: 'settimana', giorni: [], fatti: 2, totale: 3, minuti: 105, scarto: null, serie: 4 },
  { tipo: 'prossimo', forma: 'libero', gara: null, serie: 4 },
]

const recap = { categoria: 'Hyrox', titolo: 'Hyrox Forza', slide: SCHEDE }

/**
 * Accende il movimento per questo test.
 *
 * ⚠️ `src/test/setup.js` dichiara `prefers-reduced-motion: reduce` per tutta la
 * suite, e con quello l'avanzamento automatico **non parte affatto** — che è il
 * comportamento voluto, ma vuol dire che un test scritto senza questa riga
 * verificherebbe il caso opposto di quello che dice di verificare.
 */
const conMovimento = () => {
  const prima = window.matchMedia
  window.matchMedia = (query) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false,
  })
  return () => { window.matchMedia = prima }
}

/** Fa scorrere `ms` di fotogrammi veri (jsdom non ne produce da solo). */
const scorri = async (ms) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

const apri = (props = {}) =>
  render(<FoglioRecap recap={recap} onChiudi={() => {}} {...props} />)

const titoloCorrente = () => screen.getByRole('dialog').querySelector('h2')?.textContent

let ripristina = null
afterEach(() => { ripristina?.(); ripristina = null; vi.useRealTimers() })
beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })

describe('si avanza toccando le due metà dello schermo', () => {
  it('il tocco a destra porta avanti, quello a sinistra torna indietro', async () => {
    const utente = userEvent.setup()
    apri()
    expect(titoloCorrente()).toBe('Hyrox Forza')

    await utente.click(screen.getByRole('button', { name: 'Scheda successiva' }))
    expect(titoloCorrente()).toBe('A che punto sei')

    await utente.click(screen.getByRole('button', { name: 'Scheda precedente' }))
    expect(titoloCorrente()).toBe('Hyrox Forza')
  })

  it('i due bottoni «Avanti» e «Salta» non ci sono più', async () => {
    apri()
    expect(screen.queryByRole('button', { name: 'Avanti' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salta' })).not.toBeInTheDocument()
    // Al loro posto la riga che insegna il gesto: senza, il tocco a destra non
    // lo scopre nessuno.
    expect(screen.getByText(/Tocca a destra per continuare/)).toBeInTheDocument()
  })

  it('sulla prima scheda il tocco a sinistra non fa niente', async () => {
    const utente = userEvent.setup()
    const onChiudi = vi.fn()
    apri({ onChiudi })
    await utente.click(screen.getByRole('button', { name: 'Scheda precedente' }))
    expect(titoloCorrente()).toBe('Hyrox Forza')
    expect(onChiudi).not.toHaveBeenCalled()
  })
})

describe('le barre avanzano da sole, come in una storia', () => {
  it('allo scadere del tempo passa alla scheda successiva', async () => {
    ripristina = conMovimento()
    vi.useFakeTimers()
    apri()
    expect(titoloCorrente()).toBe('Hyrox Forza')

    await scorri(3000)
    expect(titoloCorrente()).toBe('Hyrox Forza')   // a metà è ancora lì
    await scorri(3500)
    expect(titoloCorrente()).toBe('A che punto sei')
  })

  it('il segmento della scheda corrente si riempie man mano', async () => {
    ripristina = conMovimento()
    vi.useFakeTimers()
    apri()
    const barra = () => screen.getByRole('button', { name: 'Scheda 1 di 3' }).querySelector('span > span')

    await scorri(100)
    const inizio = parseFloat(barra().style.width)
    await scorri(2500)
    const dopo = parseFloat(barra().style.width)
    expect(inizio).toBeLessThan(20)
    expect(dopo).toBeGreaterThan(inizio + 20)
  })

  it('🔴 tenere premuto ferma il tempo', async () => {
    ripristina = conMovimento()
    vi.useFakeTimers()
    const { container } = apri()
    const destra = screen.getByRole('button', { name: 'Scheda successiva' })

    // Il dito scende e resta giù: da qui in poi il tempo non deve più passare.
    await act(async () => {
      destra.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    await scorri(9000)
    expect(titoloCorrente()).toBe('Hyrox Forza')

    // Rilasciato dopo una TENUTA, il dito non conta come tocco: non avanza di
    // una scheda per il solo fatto di essersi alzato.
    await act(async () => {
      destra.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      destra.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(titoloCorrente()).toBe('Hyrox Forza')

    // E ripartito, riprende da dov'era.
    await scorri(6500)
    expect(titoloCorrente()).toBe('A che punto sei')
    expect(container).toBeTruthy()
  })

  it("🔴 l'ULTIMA scheda non si chiude da sola: porterebbe via l'azione", async () => {
    ripristina = conMovimento()
    vi.useFakeTimers()
    const onChiudi = vi.fn()
    apri({ onChiudi })

    // ⚠️ Un avanzamento per chiamata: fra una scheda e la successiva React
    // deve riconciliare, e l'effetto che rimette l'orologio parte solo DOPO
    // quel commit. Un solo `scorri(26000)` avanza di una scheda sola, e il
    // test passerebbe verificando un'altra cosa.
    await scorri(6500)
    await scorri(6500)
    await scorri(6500)
    expect(titoloCorrente()).toBe('Lo decidi tu')
    await scorri(12000)
    expect(onChiudi).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Chiudi' })).toBeInTheDocument()
  })

  it('con meno movimento non avanza da sola, e il segmento corrente resta PIENO', async () => {
    // Nessun `conMovimento`: vale il `prefers-reduced-motion: reduce` della
    // suite. ⚠️ Il segmento deve essere pieno e non fermo a zero: una barra
    // immobile a metà si legge come un caricamento bloccato.
    vi.useFakeTimers()
    apri()
    await scorri(20000)
    expect(titoloCorrente()).toBe('Hyrox Forza')
    const barra = screen.getByRole('button', { name: 'Scheda 1 di 3' }).querySelector('span > span')
    expect(barra.style.width).toBe('100%')
  })
})

describe('la domanda sul gradimento', () => {
  const conDomanda = {
    ...recap,
    slide: [SCHEDE[0], { tipo: 'gradimento' }, ...SCHEDE.slice(1)],
  }

  it('🔴 NON scorre via da sola: passarla allo scadere risponderebbe al posto dell atleta', async () => {
    ripristina = conMovimento()
    vi.useFakeTimers()
    const onGradimento = vi.fn()
    render(<FoglioRecap recap={conDomanda} onChiudi={() => {}} onGradimento={onGradimento} />)
    await scorri(6500)
    expect(titoloCorrente()).toBe('Ti è piaciuto questo allenamento?')
    await scorri(20000)
    expect(titoloCorrente()).toBe('Ti è piaciuto questo allenamento?')
    expect(onGradimento).not.toHaveBeenCalled()
  })

  it('una scelta la salva e passa alla scheda dopo', async () => {
    const utente = userEvent.setup()
    const onGradimento = vi.fn()
    render(<FoglioRecap recap={conDomanda} onChiudi={() => {}} onGradimento={onGradimento} />)
    await utente.click(screen.getByRole('button', { name: 'Scheda successiva' }))
    await utente.click(screen.getByRole('button', { name: /Non mi è piaciuto/ }))
    expect(onGradimento).toHaveBeenCalledWith('no')
    expect(screen.getByRole('button', { name: /Non mi è piaciuto/ })).toHaveAttribute('aria-pressed', 'true')
    await screen.findByText('A che punto sei', {}, { timeout: 1500 })
  })

  it('tornare INDIETRO dalla domanda non è «nessuna preferenza»', async () => {
    const utente = userEvent.setup()
    const onGradimento = vi.fn()
    render(<FoglioRecap recap={conDomanda} onChiudi={() => {}} onGradimento={onGradimento} />)
    await utente.click(screen.getByRole('button', { name: 'Scheda successiva' }))
    await utente.click(screen.getByRole('button', { name: 'Scheda precedente' }))
    expect(onGradimento).not.toHaveBeenCalled()
  })

  it('🔴 arriva senza niente selezionato, anche con un parere già dato in passato', async () => {
    // Una scelta già accesa è una risposta suggerita: chi ha fretta la
    // conferma senza averla data.
    const utente = userEvent.setup()
    render(<FoglioRecap recap={conDomanda} onChiudi={() => {}} onGradimento={() => {}} />)
    await utente.click(screen.getByRole('button', { name: 'Scheda successiva' }))
    expect(screen.getByRole('button', { name: /^Mi è piaciuto/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Non mi è piaciuto/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('«Salta» c è solo sulla domanda', async () => {
    const utente = userEvent.setup()
    render(<FoglioRecap recap={conDomanda} onChiudi={() => {}} onGradimento={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Salta' })).not.toBeInTheDocument()
    await utente.click(screen.getByRole('button', { name: 'Scheda successiva' }))
    expect(screen.getByRole('button', { name: 'Salta' })).toBeInTheDocument()
  })
})
