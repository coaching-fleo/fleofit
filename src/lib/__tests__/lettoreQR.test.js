import { describe, it, expect, vi, beforeEach } from 'vitest'

const { plugin, stato } = vi.hoisted(() => ({
  plugin: { leggi: vi.fn(), impostazioni: vi.fn() },
  stato: { disponibile: false },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isPluginAvailable: () => stato.disponibile },
  registerPlugin: () => plugin,
}))

import { qrDisponibile, leggiQR, apriImpostazioni } from '../lettoreQR'

beforeEach(() => {
  plugin.leggi.mockReset()
  plugin.impostazioni.mockReset()
  stato.disponibile = false
})

describe('lettoreQR', () => {
  it('sul web (plugin assente) non è disponibile e leggiQR rifiuta non_disponibile', async () => {
    expect(qrDisponibile()).toBe(false)
    await expect(leggiQR()).rejects.toMatchObject({ code: 'non_disponibile' })
    expect(plugin.leggi).not.toHaveBeenCalled()
  })

  it('con il plugin registrato è disponibile', () => {
    stato.disponibile = true
    expect(qrDisponibile()).toBe(true)
  })

  it('l\'errore «permesso» diventa code permesso', async () => {
    stato.disponibile = true
    plugin.leggi.mockRejectedValue({ message: 'permesso' })
    await expect(leggiQR()).rejects.toMatchObject({ code: 'permesso' })
  })

  it('un altro errore nativo diventa non_disponibile', async () => {
    stato.disponibile = true
    plugin.leggi.mockRejectedValue({ message: 'modulo in download' })
    await expect(leggiQR()).rejects.toMatchObject({ code: 'non_disponibile' })
  })

  it('passa invariati il valore e l\'annullamento', async () => {
    stato.disponibile = true
    plugin.leggi.mockResolvedValueOnce({ valore: 'fleofit://tv/1234' })
    expect(await leggiQR()).toEqual({ valore: 'fleofit://tv/1234' })
    plugin.leggi.mockResolvedValueOnce({ annullato: true })
    expect(await leggiQR()).toEqual({ annullato: true })
  })

  it('apriImpostazioni non fa niente senza plugin e chiama il metodo con il plugin', async () => {
    await expect(apriImpostazioni()).resolves.toBeUndefined()
    expect(plugin.impostazioni).not.toHaveBeenCalled()
    stato.disponibile = true
    plugin.impostazioni.mockResolvedValue({})
    await apriImpostazioni()
    expect(plugin.impostazioni).toHaveBeenCalled()
  })
})
