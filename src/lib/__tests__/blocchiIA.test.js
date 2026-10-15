import { describe, it, expect } from 'vitest'
import { preparaBlocchiIA, blocchiPerIA, intensitaValida, INTENSITA_PREDEFINITA } from '../blocchiIA'

describe('intensitaValida', () => {
  it('legge i formati che un modello può restituire', () => {
    expect(intensitaValida(7)).toBe('7')
    expect(intensitaValida('7')).toBe('7')
    expect(intensitaValida('7/10')).toBe('7')
    expect(intensitaValida('8.5')).toBe('9')
    expect(intensitaValida('6,4')).toBe('6')
  })

  it('tiene la scala fra 1 e 10', () => {
    expect(intensitaValida(14)).toBe('10')
    expect(intensitaValida(0)).toBeNull()
  })

  it('torna null quando non c’è un numero', () => {
    expect(intensitaValida(undefined)).toBeNull()
    expect(intensitaValida(null)).toBeNull()
    expect(intensitaValida('')).toBeNull()
    expect(intensitaValida('alta')).toBeNull()
  })
})

describe('preparaBlocchiIA', () => {
  it('dà un’intensità a ogni esercizio che non l’ha dettata', () => {
    const [b] = preparaBlocchiIA([{ type: 'EMOM', params: {}, exercises: [{ name: 'Burpees', reps: '15' }] }])
    expect(b.exercises[0].intensity).toBe(INTENSITA_PREDEFINITA)
  })

  it('tiene quella scritta da Gemini, normalizzata', () => {
    const [b] = preparaBlocchiIA([{ type: 'AMRAP', exercises: [{ name: 'Wall Balls', reps: '20', intensity: 8 }] }])
    expect(b.exercises[0].intensity).toBe('8')
  })

  it('non mette intensità su Rest, come il picker', () => {
    const [b] = preparaBlocchiIA([{ type: 'Interval', exercises: [{ name: 'Rest', exTime: '1:00', intensity: '3' }] }])
    expect(b.exercises[0]).not.toHaveProperty('intensity')
  })

  it('aggiunge gli id e lascia il resto com’è', () => {
    const [b] = preparaBlocchiIA([{ type: 'Rest', params: { duration: '2:00' } }])
    expect(typeof b.id).toBe('number')
    expect(b.params).toEqual({ duration: '2:00' })
    expect(b.exercises).toEqual([])
  })

  it('regge una risposta che non è un array', () => {
    expect(preparaBlocchiIA(null)).toEqual([])
    expect(preparaBlocchiIA({ blocks: [] })).toEqual([])
    expect(preparaBlocchiIA([null, 3])).toEqual([])
  })
})

describe('preparaBlocchiIA — le stazioni EMOM su più minuti', () => {
  // Segnalato dal committente: «minuti 2-3 sled push» dettato all'IA usciva
  // come due esercizi separati. Il prompt ora chiede `intervals`; qui si
  // controlla che arrivi nella forma che scrive il picker.
  it('in un EMOM tiene la durata della stazione, come stringa', () => {
    const [b] = preparaBlocchiIA([{ type: 'EMOM', exercises: [{ name: 'Sled Push', meters: '50m', intervals: 2 }] }])
    expect(b.exercises[0].intervals).toBe('2')
  })

  it('fuori da un EMOM, o se vale 1, il campo sparisce', () => {
    const [amrap, emom] = preparaBlocchiIA([
      { type: 'AMRAP', exercises: [{ name: 'Sled Push', intervals: '2' }] },
      { type: 'EMOM', exercises: [{ name: 'Burpees', intervals: '1' }, { name: 'Row', intervals: 'due' }] },
    ])
    expect(amrap.exercises[0]).not.toHaveProperty('intervals')
    expect(emom.exercises[0]).not.toHaveProperty('intervals')
    expect(emom.exercises[1]).not.toHaveProperty('intervals')
  })
})

describe('preparaBlocchiIA — i nomi degli esercizi', () => {
  const nomi = (exercises) => preparaBlocchiIA([{ type: 'For Time', params: {}, exercises }])[0].exercises.map(e => e.name)

  it('riporta gli ergometri al nome del picker, così il builder li riconosce', () => {
    expect(nomi([{ name: 'Ski Erg' }, { name: 'skierg' }, { name: 'Row Erg' }, { name: 'Air Bike' }]))
      .toEqual(['SkiErg', 'SkiErg', 'Rowing', 'Assault Bike'])
  })

  it('riporta al nome canonico anche gli esercizi della lista', () => {
    expect(nomi([{ name: 'wall balls' }, { name: 'Sled push' }])).toEqual(['Wall Balls', 'Sled Push'])
  })

  it('lascia com’è un nome che non conosce, e Rest', () => {
    expect(nomi([{ name: 'Mountain Climber Cross' }, { name: 'Rest' }])).toEqual(['Mountain Climber Cross', 'Rest'])
  })
})

describe('blocchiPerIA', () => {
  it('toglie gli id client-side e tiene tutto il resto', () => {
    const [b] = blocchiPerIA([{ id: 0.1, type: 'EMOM', params: { rounds: '12' }, notes: 'n',
      exercises: [{ id: 0.2, name: 'Burpees', reps: '15', kg: '9', notes: 'piano' }] }])
    expect(b).toEqual({ type: 'EMOM', params: { rounds: '12' }, notes: 'n',
      exercises: [{ name: 'Burpees', reps: '15', kg: '9', notes: 'piano' }] })
  })
  it('regge input storti', () => {
    expect(blocchiPerIA(null)).toEqual([])
    expect(blocchiPerIA([null, { type: 'Rest' }])).toEqual([{ type: 'Rest', exercises: [] }])
  })
})

describe('l incremento a ogni giro dall IA (src/lib/incremento.js)', () => {
  it('tiene il primo giro con gli aumenti, e il For Time diventa a tempo', () => {
    const [b] = preparaBlocchiIA([{
      type: 'For Time', incremento: true, params: { rounds: '3', timecap: '15:00' },
      exercises: [{ name: 'Ski Erg', meters: '200m', aumento: 100 }, { name: 'Sled Push', meters: '50m' }],
    }])
    expect(b.incremento).toBe(true)
    expect(b.params).toEqual({ timecap: '15:00' })
    expect(b.exercises).toHaveLength(2)
    expect(b.exercises[0]).toMatchObject({ name: 'SkiErg', meters: '200m', aumento: '100' })
    expect(b.exercises[1]).not.toHaveProperty('aumento')
  })

  it('senza time cap prende quello predefinito', () => {
    const [b] = preparaBlocchiIA([{ type: 'For Time', incremento: true, exercises: [{ name: 'Burpees', reps: '10', aumento: '5' }] }])
    expect(b.params.timecap).toBe('20:00')
  })

  it('fuori da For Time e AMRAP spia e aumenti si scartano', () => {
    const [b] = preparaBlocchiIA([{ type: 'EMOM', incremento: true, exercises: [{ name: 'Burpees', reps: '10', aumento: '5' }] }])
    expect(b).not.toHaveProperty('incremento')
    expect(b.exercises[0]).not.toHaveProperty('aumento')
  })
})
