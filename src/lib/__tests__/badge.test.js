import { describe, it, expect, vi, beforeEach } from 'vitest'

// Perché questi test esistono
// ────────────────────────────
// BACKLOG #21. La stessa coppia di operazioni — badge nativo + badge_count su
// push_subscriptions — era ricopiata in sette punti fra Home, App e
// WorkoutDetail. Non sbagliava, ma bastava che una modifica futura ne
// aggiornasse sei su sette perché il contatore divergesse in silenzio.
//
// ⚠️ Le due scritture non sono equivalenti: il badge nativo è cosmetico, mentre
// badge_count viene RILETTO da send-reminders per calcolare il badge della push
// successiva. Se salta quella, ogni notifica futura porta il numero sbagliato.

const badgeNativo = vi.hoisted(() => ({ set: vi.fn(() => Promise.resolve()), clear: vi.fn(() => Promise.resolve()) }))
const piattaforma = vi.hoisted(() => ({ nativa: true }))

vi.mock('@capawesome/capacitor-badge', () => ({ Badge: badgeNativo }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => piattaforma.nativa, getPlatform: () => 'ios' },
  registerPlugin: () => ({}),
}))

const { sincronizzaBadge } = await import('../badge')

function fintoClient() {
  const catena = { update: vi.fn(() => catena), eq: vi.fn(() => catena), then: (ok) => Promise.resolve({ error: null }).then(ok) }
  return { from: vi.fn(() => catena), catena }
}

beforeEach(() => {
  piattaforma.nativa = true
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('sincronizzaBadge aggiorna SEMPRE tutte e due le cose', () => {
  it('con notifiche da leggere: badge acceso e badge_count scritto', async () => {
    const c = fintoClient()
    await expect(sincronizzaBadge(3, 'u1', c)).resolves.toBe(true)
    expect(badgeNativo.set).toHaveBeenCalledWith({ count: 3 })
    expect(badgeNativo.clear).not.toHaveBeenCalled()
    expect(c.from).toHaveBeenCalledWith('push_subscriptions')
    expect(c.catena.update).toHaveBeenCalledWith({ badge_count: 3 })
  })

  it('a zero si CANCELLA il badge, non si imposta a zero', async () => {
    // Badge.set({count: 0}) su iOS lascerebbe un pallino vuoto.
    const c = fintoClient()
    await sincronizzaBadge(0, 'u1', c)
    expect(badgeNativo.clear).toHaveBeenCalled()
    expect(badgeNativo.set).not.toHaveBeenCalled()
    expect(c.catena.update).toHaveBeenCalledWith({ badge_count: 0 })
  })

  it('scrive solo le subscription native dell utente giusto', async () => {
    // Senza il filtro su auth, si sovrascriverebbe anche il badge_count delle
    // subscription Web Push, che non ne hanno uno.
    const c = fintoClient()
    await sincronizzaBadge(2, 'u1', c)
    expect(c.catena.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(c.catena.eq).toHaveBeenCalledWith('auth', 'capacitor_ios')
  })
})

describe('non deve mai interrompere chi la chiama', () => {
  it('fuori da iOS non fa niente e non lancia', async () => {
    piattaforma.nativa = false
    const c = fintoClient()
    await expect(sincronizzaBadge(3, 'u1', c)).resolves.toBe(false)
    expect(badgeNativo.set).not.toHaveBeenCalled()
    expect(c.from).not.toHaveBeenCalled()
  })

  it('se il badge nativo fallisce, torna false invece di lanciare', async () => {
    badgeNativo.set.mockRejectedValueOnce(new Error('niente permesso'))
    await expect(sincronizzaBadge(3, 'u1', fintoClient())).resolves.toBe(false)
  })

  it('se la scrittura su Supabase fallisce, torna false e LOGGA', async () => {
    // Il caso che conta: send-reminders rileggerà un badge_count vecchio, e da
    // lì in poi ogni push porta il numero sbagliato. Non deve sparire.
    const c = fintoClient()
    c.catena.then = (_, ko) => Promise.reject(new Error('rete')).then(null, ko)
    await expect(sincronizzaBadge(3, 'u1', c)).resolves.toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })

  it('senza utente non scrive niente', async () => {
    const c = fintoClient()
    await expect(sincronizzaBadge(3, null, c)).resolves.toBe(false)
    expect(c.from).not.toHaveBeenCalled()
  })

  it('rifiuta conteggi assurdi invece di propagarli', async () => {
    const c = fintoClient()
    for (const v of [-1, undefined, null, '3', NaN]) {
      expect(await sincronizzaBadge(v, 'u1', c)).toBe(false)
    }
    expect(c.from).not.toHaveBeenCalled()
  })
})
