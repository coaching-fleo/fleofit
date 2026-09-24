import { describe, it, expect, vi, beforeEach } from 'vitest'

// Perché questo test esiste
// ─────────────────────────
// Il vocabolario aptico (CLAUDE.md §9-duoquadragies) ha due trappole che non
// danno nessun errore — il telefono semplicemente non vibra:
//
//  1. sul plugin iOS `selectionChanged()` è MUTO se prima non c'è stato un
//     `selectionStart()`: il generatore nasce lì;
//  2. `navigator.vibrate` su iPhone non esiste, quindi il ramo nativo deve
//     passare dal plugin e mai dal browser.
//
// `src/test/setup.js` finge sempre «web»: qui il ramo nativo si accende a mano.

const ctrl = vi.hoisted(() => ({ nativo: true }))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => ctrl.nativo, getPlatform: () => (ctrl.nativo ? 'ios' : 'web') },
  registerPlugin: () => ({}),
}))

const H = vi.hoisted(() => ({
  impact: vi.fn(() => Promise.resolve()),
  notification: vi.fn(() => Promise.resolve()),
  selectionStart: vi.fn(() => Promise.resolve()),
  selectionChanged: vi.fn(() => Promise.resolve()),
}))

vi.mock('@capacitor/haptics', () => ({
  Haptics: H,
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}))

const aptica = await import('../aptica')

beforeEach(() => {
  ctrl.nativo = true
  Object.values(H).forEach(f => f.mockClear())
  aptica._azzeraSelezione()
})

describe('ogni verbo parla con il suo generatore', () => {
  it.each([
    ['battito', 'impact', { style: 'LIGHT' }],
    ['vibraPresa', 'impact', { style: 'MEDIUM' }],
    ['vibraSuccesso', 'notification', { type: 'SUCCESS' }],
    ['vibraErrore', 'notification', { type: 'ERROR' }],
    ['vibraRichiamo', 'notification', { type: 'WARNING' }],
  ])('%s → %s', (verbo, metodo, argomento) => {
    aptica[verbo]()
    expect(H[metodo]).toHaveBeenCalledTimes(1)
    expect(H[metodo]).toHaveBeenCalledWith(argomento)
  })
})

describe('🔴 la selezione prepara il generatore, o è muta', () => {
  it('il primo cambio passa da selectionStart, e PRIMA di selectionChanged', () => {
    aptica.vibraScelta()
    expect(H.selectionStart).toHaveBeenCalledTimes(1)
    expect(H.selectionChanged).toHaveBeenCalledTimes(1)
    expect(H.selectionStart.mock.invocationCallOrder[0])
      .toBeLessThan(H.selectionChanged.mock.invocationCallOrder[0])
  })

  it('il generatore si prepara UNA volta sola per la sessione', () => {
    aptica.vibraScelta()
    aptica.vibraScelta()
    aptica.vibraScelta()
    expect(H.selectionStart).toHaveBeenCalledTimes(1)
    expect(H.selectionChanged).toHaveBeenCalledTimes(3)
  })

  it('se la preparazione fallisce, la volta dopo ci riprova', async () => {
    H.selectionStart.mockReturnValueOnce(Promise.reject(new Error('no')))
    aptica.vibraScelta()
    await Promise.resolve(); await Promise.resolve()
    aptica.vibraScelta()
    expect(H.selectionStart).toHaveBeenCalledTimes(2)
  })
})

describe('sul web', () => {
  it('ripiega su navigator.vibrate, e il plugin non si tocca', () => {
    ctrl.nativo = false
    const vibra = vi.fn()
    navigator.vibrate = vibra
    aptica.vibraSuccesso()
    aptica.vibraScelta()
    expect(vibra).toHaveBeenCalledTimes(2)
    expect(H.notification).not.toHaveBeenCalled()
    expect(H.selectionChanged).not.toHaveBeenCalled()
    delete navigator.vibrate
  })

  it('senza vibrate non lancia', () => {
    ctrl.nativo = false
    expect(() => aptica.battito()).not.toThrow()
  })
})

describe('un plugin che fallisce non porta giù il gesto', () => {
  it('né lanciando', () => {
    H.impact.mockImplementationOnce(() => { throw new Error('plugin assente') })
    expect(() => aptica.battito()).not.toThrow()
  })

  it('né rifiutando la promise', async () => {
    H.notification.mockReturnValueOnce(Promise.reject(new Error('silenzioso')))
    expect(() => aptica.vibraErrore()).not.toThrow()
    await Promise.resolve()
  })
})
