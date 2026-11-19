import { describe, it, expect, vi, beforeEach } from 'vitest'

const { push, stato, rinfresca, apri } = vi.hoisted(() => ({
  push: { checkPermissions: vi.fn(), requestPermissions: vi.fn() },
  stato: { nativo: true },
  rinfresca: vi.fn(),
  apri: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => stato.nativo } }))
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: push }))
vi.mock('../pushToken', () => ({ rinfrescaTokenPush: rinfresca }))
vi.mock('../lettoreQR', () => ({ apriImpostazioni: apri }))

import {
  statoPermesso, chiediPermesso, apriImpostazioniTelefono,
  EVENTO_MOMENTO, segnalaMomentoNotifiche,
} from '../permessoNotifiche'

beforeEach(() => {
  stato.nativo = true
  push.checkPermissions.mockReset()
  push.requestPermissions.mockReset()
  rinfresca.mockReset()
  apri.mockReset()
})

describe('statoPermesso', () => {
  it('sul web non è disponibile', async () => {
    stato.nativo = false
    expect(await statoPermesso()).toBe('non-disponibile')
    expect(push.checkPermissions).not.toHaveBeenCalled()
  })

  it.each([
    ['granted', 'attive'],
    ['prompt', 'da-chiedere'],
    ['prompt-with-rationale', 'da-chiedere'],
    ['denied', 'negate'],
  ])('%s → %s', async (receive, atteso) => {
    push.checkPermissions.mockResolvedValue({ receive })
    expect(await statoPermesso()).toBe(atteso)
  })

  it('se il plugin rifiuta non è disponibile', async () => {
    push.checkPermissions.mockRejectedValue(new Error('no'))
    expect(await statoPermesso()).toBe('non-disponibile')
  })
})

describe('chiediPermesso', () => {
  it('concesso: salva il token', async () => {
    push.requestPermissions.mockResolvedValue({ receive: 'granted' })
    expect(await chiediPermesso('u1')).toBe(true)
    expect(rinfresca).toHaveBeenCalledWith('u1')
  })

  it('negato: niente token', async () => {
    push.requestPermissions.mockResolvedValue({ receive: 'denied' })
    expect(await chiediPermesso('u1')).toBe(false)
    expect(rinfresca).not.toHaveBeenCalled()
  })

  it('se il plugin rifiuta torna false', async () => {
    push.requestPermissions.mockRejectedValue(new Error('no'))
    expect(await chiediPermesso('u1')).toBe(false)
  })
})

it('apriImpostazioniTelefono non lancia se il plugin manca', async () => {
  apri.mockRejectedValue(new Error('plugin assente'))
  await expect(apriImpostazioniTelefono()).resolves.toBeUndefined()
})

it('segnalaMomentoNotifiche lancia l\'evento con il ruolo', () => {
  const ricevuti = []
  const ascolta = (e) => ricevuti.push(e.detail.ruolo)
  window.addEventListener(EVENTO_MOMENTO, ascolta)
  segnalaMomentoNotifiche('coach')
  window.removeEventListener(EVENTO_MOMENTO, ascolta)
  expect(ricevuti).toEqual(['coach'])
})
