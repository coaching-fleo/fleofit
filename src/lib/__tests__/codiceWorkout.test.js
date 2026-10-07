import { describe, it, expect } from 'vitest'
import {
  codiceHyrox, codiceCorsa, codiceWorkout,
  separaCodice, unisciCodice, minutiCodice, strutturaCorsa,
} from '../codiceWorkout'

const ex = (name, extra = {}) => ({ id: Math.random(), name, ...extra })

const emom = {
  type: 'EMOM', params: { interval: '1:00', rounds: '24' },
  exercises: [ex('Wall Balls', { reps: '15', intensity: '8' }), ex('Burpees', { reps: '5', intensity: '8' })],
}
const forTime = {
  type: 'For Time', params: { rounds: '2' },
  exercises: [ex('Sled Push', { meters: '50m', intensity: '9' })],
}
const warmup = { type: 'WarmUp', params: { duration: '10:00' } }
const cashIn = { type: 'Cash In', params: { rounds: '1' }, exercises: [ex('SkiErg', { meters: '500m', intensity: '4' })] }

describe('minutiCodice', () => {
  it('esatti sotto i 10, arrotondati a 5 sopra', () => {
    expect(minutiCodice(7.4)).toBe(7)
    expect(minutiCodice(57)).toBe(55)
    expect(minutiCodice(58)).toBe(60)
  })
  it('niente minuti, niente numero', () => {
    expect(minutiCodice(0)).toBeNull()
    expect(minutiCodice(NaN)).toBeNull()
  })
})

describe('codiceHyrox', () => {
  it('sigle dei soli blocchi di lavoro, nell ordine, più durata e RPE', () => {
    // 10 warmup + 5 cash in + 24 EMOM + 30 For Time = 69 → 70
    expect(codiceHyrox([warmup, cashIn, emom, forTime])).toMatch(/^EM\+FT 70′ @\d+$/)
  })

  it('oltre tre blocchi di lavoro scrive «+N» invece di allungarsi', () => {
    const c = codiceHyrox([emom, emom, emom, emom, emom])
    expect(c.split(' ')[0]).toBe('EM+EM+EM+2')
  })

  it('l RPE atteso precede quello dichiarato, che nasce a 5', () => {
    expect(codiceHyrox([emom], '5')).toBe('EM 25′ @8')
  })

  it('senza intensità negli esercizi ripiega su quella dichiarata', () => {
    const muto = { ...emom, exercises: [ex('Wall Balls', { reps: '15' })] }
    expect(codiceHyrox([muto], '6')).toBe('EM 25′ @6')
  })

  it('senza nessuna intensità non inventa un @5', () => {
    const muto = { ...emom, exercises: [ex('Wall Balls', { reps: '15' })] }
    expect(codiceHyrox([muto])).toBe('EM 25′')
  })

  it('senza blocchi di lavoro restano durata e intensità', () => {
    expect(codiceHyrox([warmup, cashIn])).toBe('15′ @4')
  })

  it('nessun blocco, nessun codice', () => {
    expect(codiceHyrox([])).toBe('')
  })
})

describe('corsa', () => {
  const ripetute = [
    { type: 'warmup', duration: '10 min', intensity: '3' },
    { type: 'repeat', rounds: '8', runDuration: '400m', runIntensity: '9', recDuration: '1 min', recIntensity: '3' },
    { type: 'cooldown', duration: '10 min', intensity: '3' },
  ]

  it('ripetute: intensità della fase più dura', () => {
    expect(codiceCorsa(ripetute)).toMatch(/^RIP \d+′ @9$/)
  })

  it('tutta a distanza dichiara i km, non minuti dedotti', () => {
    const lungo = [{ type: 'run', duration: '18 km', intensity: '5' }]
    expect(codiceCorsa(lungo)).toBe('CL 18K @5')
  })

  it('i km sotto i 10 tengono un decimale con la virgola', () => {
    expect(codiceCorsa([{ type: 'run', duration: '7.5 km' }])).toBe('CL 7,5K')
  })

  it('a tempo dice i minuti', () => {
    const fondo = [{ type: 'run', duration: '45 min', pace: 'Z2', intensity: '5' }]
    expect(codiceCorsa(fondo)).toBe('CL 45′ @5')
  })

  it('progressivo solo con intensità che salgono davvero', () => {
    const sale = [{ type: 'run', duration: '10 min', intensity: '5' }, { type: 'run', duration: '10 min', intensity: '7' }]
    const pari = [{ type: 'run', duration: '10 min', intensity: '5' }, { type: 'run', duration: '10 min', intensity: '5' }]
    expect(strutturaCorsa(sale)).toBe('progressivo')
    expect(strutturaCorsa(pari)).toBe('continua')
  })
})

describe('codiceWorkout', () => {
  it('sceglie il codice della categoria', () => {
    expect(codiceWorkout({ category: 'Hyrox', blocks: [emom] })).toBe(codiceHyrox([emom]))
    expect(codiceWorkout({ category: 'Running', steps: [{ type: 'run', duration: '18 km' }] })).toBe('CL 18K')
  })

  it('Custom non ha codice: ci pensa il titolo dalla data', () => {
    expect(codiceWorkout({ category: 'Custom' })).toBe('')
  })
})

describe('separaCodice / unisciCodice', () => {
  it('andata e ritorno su ogni forma di codice', () => {
    for (const codice of ['EM+FT 55′ @8', 'EM+EM+EM+2 90′', 'RIP 50′ @9', 'CL 7,5K @5', '15′ @4', '@7', 'AM']) {
      const titolo = unisciCodice('Sled & Wall Balls', codice)
      expect(separaCodice(titolo)).toEqual({ nome: 'Sled & Wall Balls', codice })
    }
  })

  it('NON scambia per codice la data del titolo automatico', () => {
    expect(separaCodice('Allenamento libero · lun 25 ago')).toEqual({ nome: 'Allenamento libero · lun 25 ago', codice: '' })
  })

  it('non mangia un titolo che è SOLO un codice', () => {
    expect(separaCodice('EM 24′').nome).toBe('EM 24′')
  })

  it('rigenerare non accoda un secondo codice', () => {
    const vecchio = unisciCodice('Sled', 'EM 24′ @8')
    expect(unisciCodice(separaCodice(vecchio).nome, 'EM+FT 55′ @8')).toBe('Sled · EM+FT 55′ @8')
  })

  it('senza codice resta il solo nome', () => {
    expect(unisciCodice('Sled', '')).toBe('Sled')
  })
})
