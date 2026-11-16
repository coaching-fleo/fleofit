import { describe, it, expect, beforeEach, vi } from 'vitest'
import { codiceDalPlayStore, CHIAVE_REFERRER } from '../referrerInvito'

const plugin = (referrer) => ({ leggi: vi.fn(async () => ({ referrer })) })

describe('codiceDalPlayStore', () => {
  beforeEach(() => localStorage.clear())

  it('su Android legge il codice dal referrer', async () => {
    expect(await codiceDalPlayStore({ piattaforma: 'android', plugin: plugin('invite=7KQ2M4XB') })).toBe('7KQ2M4XB')
  })

  // 🔴 Il Play Store riconsegna lo stesso referrer per 90 giorni.
  it('🔴 una volta sola per installazione', async () => {
    const p = plugin('invite=7KQ2M4XB')
    await codiceDalPlayStore({ piattaforma: 'android', plugin: p })
    expect(await codiceDalPlayStore({ piattaforma: 'android', plugin: p })).toBeNull()
    expect(p.leggi).toHaveBeenCalledTimes(1)
  })

  it('su iOS e sul web non chiede niente', async () => {
    const p = plugin('invite=7KQ2M4XB')
    expect(await codiceDalPlayStore({ piattaforma: 'ios', plugin: p })).toBeNull()
    expect(await codiceDalPlayStore({ piattaforma: 'web', plugin: p })).toBeNull()
    expect(p.leggi).not.toHaveBeenCalled()
  })

  it('installata senza link: niente codice, ma non richiede più', async () => {
    expect(await codiceDalPlayStore({ piattaforma: 'android', plugin: plugin('utm_source=google-play') })).toBeNull()
    expect(JSON.parse(localStorage.getItem(CHIAVE_REFERRER))).toBe(true)
  })

  it('plugin assente: niente errore, si riprova al prossimo avvio', async () => {
    const rotto = { leggi: vi.fn(async () => { throw new Error('not implemented') }) }
    expect(await codiceDalPlayStore({ piattaforma: 'android', plugin: rotto })).toBeNull()
    expect(localStorage.getItem(CHIAVE_REFERRER)).toBeNull()
  })
})
