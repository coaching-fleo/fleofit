import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const verifyOtp = vi.fn()
vi.mock('../../supabaseClient', () => ({ clientVerifica: () => ({ auth: { verifyOtp } }) }))
import Conferma from '../Conferma'

let assign
const originale = window.location
function apri(search) {
  assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originale, origin: 'https://fleofit.vercel.app', search, assign },
  })
  return render(<Conferma />)
}

describe('Conferma', () => {
  beforeEach(() => verifyOtp.mockReset())
  afterEach(() => Object.defineProperty(window, 'location', { configurable: true, value: originale }))

  it('all\'apertura NON verifica: aspetta il tocco (antivirus della posta)', () => {
    apri('?token_hash=abc&type=recovery&torna=fleofit://login-callback')
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /password nuova/i })).toBeTruthy()
  })

  it('al tocco verifica e rimanda all\'app con la sessione e type=recovery', async () => {
    verifyOtp.mockResolvedValue({ data: { session: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, expires_at: 1 } }, error: null })
    apri('?token_hash=abc&type=recovery&torna=fleofit://login-callback')
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(assign).toHaveBeenCalled())
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'recovery' })
    const url = assign.mock.calls[0][0]
    expect(url.startsWith('fleofit://login-callback#')).toBe(true)
    expect(url).toContain('access_token=AT')
    expect(url).toContain('type=recovery')
  })

  it('un codice scaduto sul sito mostra «Link scaduto o già usato»', async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: { message: 'Email link is invalid or has expired' } })
    apri('?token_hash=abc&type=email&torna=https://fleofit.vercel.app')
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByText('Link scaduto o già usato')).toBeTruthy()
    expect(assign).not.toHaveBeenCalled()
  })

  it('senza codice dice che il link non è completo', () => {
    apri('')
    expect(screen.getByText('Link non valido')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
