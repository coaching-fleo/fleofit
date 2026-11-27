import { describe, it, expect } from 'vitest'
import { riscontroAssegnazione, tonoRpe } from '../riscontroAtleta'

const atleta = { id: 'u1', name: 'Sara', surname: 'Rossi', photo_url: 'f.jpg' }

describe('riscontroAssegnazione', () => {
  it('toglie RPE, gradimento e righe della gara dal testo', () => {
    const r = riscontroAssegnazione({
      status: 'completed', completed_date: '2026-11-25', voice_note_url: 'v.m4a', athletes: atleta,
      notes: '[RPE: 8/10]\n[GRADIMENTO: si]\nGambe pesanti nel secondo blocco',
    })
    expect(r).toMatchObject({
      atletaId: 'u1', nome: 'Sara Rossi', foto: 'f.jpg', fatto: true, data: '2026-11-25',
      rpe: 8, gradimento: 'si', testo: 'Gambe pesanti nel secondo blocco', vocale: 'v.m4a',
    })
  })

  it('senza nota: niente RPE inventato, niente gradimento, testo vuoto', () => {
    const r = riscontroAssegnazione({ status: 'pending', notes: null, athletes: atleta })
    expect(r.rpe).toBeNull()
    expect(r.gradimento).toBeNull()
    expect(r.testo).toBe('')
    expect(r.fatto).toBe(false)
    expect(r.vocale).toBeNull()
  })

  it('un atleta senza nome resta «Atleta»', () => {
    expect(riscontroAssegnazione({ athletes: null }).nome).toBe('Atleta')
  })
})

describe('tonoRpe', () => {
  it('segue la scala della scheda', () => {
    expect(tonoRpe(3)).toBe('text-green-400')
    expect(tonoRpe(6)).toBe('text-yellow-400')
    expect(tonoRpe(8)).toBe('text-orange-400')
    expect(tonoRpe(9)).toBe('text-red-400')
    expect(tonoRpe(null)).toBe('text-gray-400')
  })
})
