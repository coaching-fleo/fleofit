import { describe, it, expect } from 'vitest'
import { rigaOrologio } from '../rigaOrologio'

describe('rigaOrologio', () => {
  it('senza riga di invio non c\'è la riga', () => {
    expect(rigaOrologio(null)).toBeNull()
    expect(rigaOrologio(undefined)).toBeNull()
  })

  it('inviato: dice il giorno, senza Riprova', () => {
    expect(rigaOrologio({ stato: 'inviato', data: '2026-10-28' }))
      .toEqual({ testo: 'Sull\'orologio · 28 ott', riprova: false })
  })

  it('da_rifare ed errore: «Non inviato» con Riprova', () => {
    for (const stato of ['da_rifare', 'errore']) {
      expect(rigaOrologio({ stato, data: '2026-10-28' })).toEqual({ testo: 'Non inviato', riprova: true })
    }
  })
})
