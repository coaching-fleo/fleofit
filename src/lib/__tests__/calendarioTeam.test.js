import { describe, it, expect } from 'vitest'
import { giorniSettimana, grigliaTeam, caricoGiorni, spostamentoValido, chipDi } from '../calendarioTeam'
import { COACHING_ID } from '../constants'

const giorni = giorniSettimana(new Date(2026, 9, 15)) // giovedì 15 ottobre 2026

const ass = (id, athlete_id, data, extra = {}) => ({
  id, athlete_id, completed_date: data, status: 'pending', notes: '',
  workouts: { id: `w-${id}`, title: 'EMOM sled · EM 40′ @8', sections: { category: 'Hyrox' } },
  ...extra,
})

describe('calendarioTeam', () => {
  it('la settimana comincia di lunedì', () => {
    expect(giorni).toHaveLength(7)
    expect(giorni[0].getDay()).toBe(1)
    expect(giorni[0].getDate()).toBe(12)
  })

  it('mette ogni sessione nella cella del suo atleta e del suo giorno', () => {
    const righe = grigliaTeam(
      [{ id: 'a', name: 'Marco' }, { id: 'b', name: 'Luca' }],
      [ass(1, 'a', '2026-10-13'), ass(2, 'b', '2026-10-18'), ass(3, 'a', '2026-10-30')],
      giorni,
    )
    const marco = righe.find(r => r.id === 'a')
    expect(marco.celle[1].chips.map(c => c.id)).toEqual([1])
    expect(marco.celle.flatMap(c => c.chips)).toHaveLength(1) // il 30 è fuori settimana
    expect(righe.find(r => r.id === 'b').celle[6].chips).toHaveLength(1)
  })

  it('il profilo del coach non è una riga', () => {
    const righe = grigliaTeam([{ id: COACHING_ID, name: 'Coach' }, { id: 'a', name: 'Marco' }], [], giorni)
    expect(righe.map(r => r.id)).toEqual(['a'])
  })

  it('chi è in pausa va in fondo, ma resta', () => {
    const righe = grigliaTeam(
      [{ id: 'a', name: 'Andrea', notes: '[PAUSA: 2026-10-01]' }, { id: 'b', name: 'Zeno' }],
      [], giorni,
    )
    expect(righe.map(r => r.id)).toEqual(['b', 'a'])
    expect(righe[1].inPausa).toBe(true)
  })

  it('separa il codice dal nome e non inventa un RPE', () => {
    const chip = chipDi(ass(1, 'a', '2026-10-13'))
    expect(chip.titolo).toBe('EMOM sled')
    expect(chip.codice).toBe('EM 40′ @8')
    expect(chip.rpe).toBeNull()
    const fatta = chipDi(ass(2, 'a', '2026-10-13', { status: 'completed', notes: '[RPE: 7/10]\nok' }))
    expect(fatta.rpe).toBe(7)
  })

  it('il filtro di categoria lascia solo quella', () => {
    const corsa = ass(2, 'a', '2026-10-14', { workouts: { id: 'w2', title: 'Ripetute', sections: { steps: [] } } })
    const righe = grigliaTeam([{ id: 'a', name: 'Marco' }], [ass(1, 'a', '2026-10-13'), corsa], giorni, { filtro: 'Running' })
    expect(righe[0].celle.flatMap(c => c.chips).map(c => c.id)).toEqual([2])
  })

  it('il carico del giorno conta le sessioni e quelle fatte, gare escluse', () => {
    const gara = ass(3, 'a', '2026-10-13', { workouts: { id: 'w3', title: 'HYROX Milano', sections: { category: 'Event' } } })
    const righe = grigliaTeam([{ id: 'a', name: 'Marco' }],
      [ass(1, 'a', '2026-10-13', { status: 'completed' }), ass(2, 'a', '2026-10-13'), gara], giorni)
    expect(caricoGiorni(righe)[1]).toEqual({ sessioni: 2, fatte: 1 })
  })

  it('si sposta solo una sessione da fare, sullo stesso atleta, in un altro giorno', () => {
    const chip = chipDi(ass(1, 'a', '2026-10-13'))
    expect(spostamentoValido(chip, 'a', '2026-10-15')).toBe(true)
    expect(spostamentoValido(chip, 'b', '2026-10-15')).toBe(false)
    expect(spostamentoValido(chip, 'a', '2026-10-13')).toBe(false)
    expect(spostamentoValido({ ...chip, completato: true }, 'a', '2026-10-15')).toBe(false)
  })
})
