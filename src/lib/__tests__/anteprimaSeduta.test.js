import { describe, it, expect } from 'vitest'
import { anteprimaSeduta, nomiEsercizi } from '../anteprimaSeduta'

describe('anteprimaSeduta', () => {
  it('Hyrox: una riga per blocco, con i parametri e i primi esercizi', () => {
    const { righe, minuti } = anteprimaSeduta({
      category: 'Hyrox',
      blocks: [
        { type: 'WarmUp', params: { duration: '10:00' }, exercises: [] },
        { type: 'EMOM', params: { interval: '1:00', rounds: '12' }, exercises: [
          { name: 'Wall Balls', reps: '15' }, { name: 'Burpees', reps: '8' },
          { name: 'Sled Push', meters: '25m' }, { name: 'Row', meters: '200m' },
        ] },
      ],
    })
    expect(righe[0]).toEqual({ titolo: 'Riscaldamento', sotto: '10:00', esercizi: '' })
    expect(righe[1].titolo).toBe('EMOM')
    expect(righe[1].sotto).toContain('ogni 1:00 × 12')
    expect(righe[1].esercizi).toBe('Wall Balls · Burpees · Sled Push +1')
    expect(minuti).toBeGreaterThan(0)
  })

  it('Corsa: i tratti e le ripetute', () => {
    const { righe } = anteprimaSeduta({
      category: 'Running',
      steps: [
        { type: 'warmup', duration: '10 min', pace: 'Z2' },
        { type: 'repeat', rounds: '6', runDuration: '800m', runPace: '3:50 /km', recDuration: '1 min', recPace: 'Camminata' },
      ],
    })
    expect(righe[0]).toEqual({ titolo: 'Riscaldamento', sotto: '10 min · Z2', esercizi: '' })
    expect(righe[1]).toEqual({ titolo: '6 × ripetute', sotto: '800m 3:50 /km + 1 min Camminata', esercizi: '' })
  })

  it('Gym: un gruppo per riga, superserie unite', () => {
    const { righe } = anteprimaSeduta({
      category: 'Gym',
      gym: [{ fase: 'principale', serie: '4', recupero: '1:30', esercizi: [{ name: 'Panca', reps: '8' }, { name: 'Trazioni', reps: 'Max' }] }],
    })
    expect(righe).toEqual([{ titolo: 'Panca + Trazioni', sotto: '4 serie × 8 · rec 1:30', esercizi: '' }])
  })

  it('Custom e Gara: niente righe e nessuna durata inventata', () => {
    expect(anteprimaSeduta({ category: 'Custom', isAutonomous: true })).toEqual({ righe: [], minuti: null })
    expect(anteprimaSeduta({ category: 'Event', isEvent: true })).toEqual({ righe: [], minuti: null })
    expect(anteprimaSeduta(null).minuti).toBeNull()
  })

  it('nomiEsercizi salta i vuoti', () => {
    expect(nomiEsercizi(['A', '', null, 'B'])).toBe('A · B')
    expect(nomiEsercizi([])).toBe('')
  })
})
