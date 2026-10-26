import { describe, it, expect } from 'vitest'
import { partiRipetuta, campiVecchiRipetuta, intensitaRipetuta, etichettaParte } from '../ripetute'
import { durataWorkout } from '../statistiche'
import { riepilogoCorsa } from '../rigaArchivio'
import { preparaFasiIA } from '../blocchiIA'
import { passoCorsa } from '../leggiWorkout'

// La ripetuta del committente (26/10/2026): 3 × (4′ Z3 + 3′ Z2), senza recupero.
const zone = {
  type: 'repeat', rounds: '3',
  parti: [
    { id: 1, tipo: 'run', duration: '4 min', pace: 'Z3', paceMin: 'Z3', paceMax: '-', intensity: '7' },
    { id: 2, tipo: 'run', duration: '3 min', pace: 'Z2', paceMin: 'Z2', paceMax: '-', intensity: '5' },
  ],
}

describe('partiRipetuta', () => {
  it('legge le parti nuove, in ordine e con il loro tipo', () => {
    const parti = partiRipetuta(zone)
    expect(parti.map(p => [p.tipo, p.duration, p.pace])).toEqual([['run', '4 min', 'Z3'], ['run', '3 min', 'Z2']])
    expect(parti.map(etichettaParte)).toEqual(['Corsa', 'Corsa'])
  })

  it('legge il formato di prima come corsa + recupero', () => {
    const parti = partiRipetuta({ type: 'repeat', runDuration: '400m', runPace: '3:45 /km', recDuration: '1 min', recPace: 'Camminata' })
    expect(parti.map(p => [etichettaParte(p), p.duration, p.pace])).toEqual([['Corsa', '400m', '3:45 /km'], ['Recupero', '1 min', 'Camminata']])
  })

  it('un recupero senza durata nel formato di prima non è una parte', () => {
    expect(partiRipetuta({ type: 'repeat', runDuration: '400m', recDuration: '' })).toHaveLength(1)
  })

  it('tre tratti restano tre', () => {
    const tre = { ...zone, parti: [...zone.parti, { id: 3, tipo: 'recover', duration: '1 min', pace: 'Da fermo' }] }
    expect(partiRipetuta(tre).map(etichettaParte)).toEqual(['Corsa', 'Corsa', 'Recupero'])
  })
})

describe('i campi di prima, per le app già sugli Store', () => {
  it('sono le prime due parti, per posizione', () => {
    const v = campiVecchiRipetuta(partiRipetuta(zone))
    expect([v.runDuration, v.runPace, v.recDuration, v.recPace]).toEqual(['4 min', 'Z3', '3 min', 'Z2'])
  })

  it('con una parte sola il recupero resta vuoto', () => {
    expect(campiVecchiRipetuta(partiRipetuta(zone).slice(0, 1)).recDuration).toBe('')
  })
})

describe('chi conta i minuti vede TUTTE le parti', () => {
  const tre = { ...zone, parti: [...zone.parti, { id: 3, tipo: 'recover', duration: '1 min', pace: 'Da fermo' }] }

  it('durataWorkout: 3 × (4 + 3 + 1) = 24 minuti', () => {
    expect(durataWorkout({ category: 'Running', steps: [tre] })).toBe(24)
  })

  it('riepilogoCorsa: 24 minuti', () => {
    expect(riepilogoCorsa([tre]).minuti).toBe(24)
  })

  it("l'intensità è quella del tratto più duro", () => {
    expect(intensitaRipetuta(zone)).toBe(7)
  })
})

describe('«Da fermo»', () => {
  it('si legge da un testo scritto', () => {
    expect(passoCorsa(' recupero 1 min da fermo ').pace).toBe('Da fermo')
  })
})

describe("le ripetute generate dall'IA", () => {
  it('con «parti» tengono tutti i tratti e riscrivono i campi di prima', () => {
    const [f] = preparaFasiIA([{
      type: 'repeat', rounds: '3',
      parti: [{ tipo: 'run', duration: '4 min', pace: 'Z3', intensity: '7' }, { tipo: 'run', duration: '3 min', pace: 'Z2', intensity: '5' }],
    }])
    expect(f.parti.map(p => [p.tipo, p.duration, p.pace])).toEqual([['run', '4 min', 'Z3'], ['run', '3 min', 'Z2']])
    expect([f.runDuration, f.recDuration, f.recPace]).toEqual(['4 min', '3 min', 'Z2'])
  })

  it('senza «parti» funzionano come prima', () => {
    const [f] = preparaFasiIA([{ type: 'repeat', rounds: '8', runDuration: '400m', recDuration: '1 min' }])
    expect(f.parti).toBeUndefined()
    expect(partiRipetuta(f).map(p => p.duration)).toEqual(['400m', '1 min'])
  })
})
