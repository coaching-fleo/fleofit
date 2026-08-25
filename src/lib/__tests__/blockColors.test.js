import { describe, it, expect } from 'vitest'
import { TYPE_COLORS } from '../blockColors'
import { BLOCK_HINT } from '../blockHints'

// Perché questo test esiste: TYPE_COLORS è stata per mesi in QUATTRO copie
// divergenti (WorkoutDetail, CreateWorkout, TVDashboard e una forma diversa in
// Calendar). Il builder usava border-[#444] dove le altre usavano #333, e
// TVDashboard non aveva il campo hex. Nessuno se n'era accorto perché niente
// verificava che le due mappe restassero allineate.
//
// È La Regola della Corsia di DESIGN.md: ogni categoria ha un colore e uno solo,
// e quel colore attraversa puntino, bordo in hover, pillola, icona e glow.

const CATEGORIE = ['Running', 'Custom', 'Event']

describe('TYPE_COLORS copre tutto ciò che la UI può mostrare', () => {
  it('ha un colore per ogni tipo di blocco offerto dal builder', () => {
    for (const tipo of Object.keys(BLOCK_HINT)) {
      expect(TYPE_COLORS[tipo], `manca il colore per il blocco "${tipo}"`).toBeDefined()
    }
  })

  it('ha un colore per ogni categoria di workout', () => {
    for (const categoria of CATEGORIE) {
      expect(TYPE_COLORS[categoria], `manca il colore per la categoria "${categoria}"`).toBeDefined()
    }
  })

  it('non contiene voci orfane, che nessuna schermata userebbe', () => {
    const attese = new Set([...Object.keys(BLOCK_HINT), ...CATEGORIE])
    for (const chiave of Object.keys(TYPE_COLORS)) {
      expect(attese.has(chiave), `"${chiave}" non è né un blocco né una categoria`).toBe(true)
    }
  })
})

describe('ogni voce ha la forma completa', () => {
  it('porta text, bg, border e hex', () => {
    for (const [chiave, valore] of Object.entries(TYPE_COLORS)) {
      for (const campo of ['text', 'bg', 'border', 'hex']) {
        expect(valore[campo], `"${chiave}" non ha ${campo}`).toBeTruthy()
      }
    }
  })

  it('hex è un colore esadecimale valido', () => {
    for (const [chiave, valore] of Object.entries(TYPE_COLORS)) {
      expect(valore.hex, `hex non valido per "${chiave}"`).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    }
  })

  it('le tre categorie hanno i colori della palette, non grigi', () => {
    expect(TYPE_COLORS['Running'].hex.toLowerCase()).toBe('#0094c6')
    expect(TYPE_COLORS['Custom'].hex.toLowerCase()).toBe('#d11149')
    expect(TYPE_COLORS['Event'].hex.toLowerCase()).toBe('#ffffff')
  })
})
