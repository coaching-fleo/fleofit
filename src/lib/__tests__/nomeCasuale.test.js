import { describe, it, expect } from 'vitest'
import { candidatiNome, scegliNome, nomeLibero, eNomeGenerato, nomiGiaUsati } from '../nomeCasuale'

const ex = (name, extra = {}) => ({ name, ...extra })
const hyrox = (blocks) => ({ category: 'Hyrox', blocks })
const corsa = (steps) => ({ category: 'Running', steps })

const emomWallBall = hyrox([{
  type: 'EMOM', params: { interval: '1:00', rounds: '24' },
  exercises: [ex('Wall Balls', { reps: '15', intensity: '8' }), ex('Burpees', { reps: '5', intensity: '8' })],
}])
const sledECorsa = hyrox([{
  type: 'For Time', params: { rounds: '4' },
  exercises: [ex('Run', { meters: '1000m', intensity: '9' }), ex('Sled Push', { meters: '50m', intensity: '9' })],
}])
const ergFacile = hyrox([{
  type: 'AMRAP', params: { duration: '30:00' },
  exercises: [ex('SkiErg', { meters: '500m', intensity: '5' }), ex('Rowing', { meters: '500m', intensity: '5' })],
}])

describe('candidatiNome · Hyrox', () => {
  it('parte dall esercizio che pesa di più, con l intensità', () => {
    const c = candidatiNome(emomWallBall)
    expect(c[0]).toBe('Wall Ball Burner')
    expect(c).toContain('Wall Ball EMOM')
    expect(c).toContain('Metcon Burner')
  })

  it('corsa più una stazione è compromised, e il nome parla della stazione', () => {
    const c = candidatiNome(sledECorsa)
    expect(c[0]).toBe('Compromised Sled Push')
    expect(c.some(n => /^Run (Burner|Grinder)/.test(n))).toBe(false)
  })

  it('a bassa intensità il registro è aerobico', () => {
    const c = candidatiNome(ergFacile)
    expect(c).toContain('Easy SkiErg')
    expect(c.some(n => /Burner|Grinder|Crusher/.test(n))).toBe(false)
  })

  it('le stazioni di gara più la corsa sono una simulazione', () => {
    const stazioni = ['SkiErg', 'Sled Push', 'Sled Pull', 'Burpees Broad Jumps', 'Rowing', 'Farmers Carry', 'Sandbag Lunges', 'Wall Balls']
    const sim = hyrox([{ type: 'For Time', params: { rounds: '1' },
      exercises: stazioni.flatMap(n => [ex('Run', { meters: '1000m' }), ex(n, { reps: '50' })]) }])
    expect(candidatiNome(sim)).toContain('Hyrox Sim')
    expect(candidatiNome(sim).every(n => /Sim|Race/.test(n))).toBe(true)
  })

  it('blocchi ancora vuoti: la sola struttura', () => {
    expect(candidatiNome(hyrox([{ type: 'EMOM', params: {}, exercises: [] }]))[0]).toMatch(/EMOM/)
  })

  it('senza contenuto nessun candidato, e Custom non ne ha', () => {
    expect(candidatiNome(hyrox([]))).toEqual([])
    expect(candidatiNome({ category: 'Custom' })).toEqual([])
  })

  it('mai una parola ripetuta («Sled Sled»)', () => {
    for (const w of [emomWallBall, sledECorsa, ergFacile]) {
      for (const n of candidatiNome(w)) expect(n).not.toMatch(/\b(\w+) \1\b/)
    }
  })
})

describe('candidatiNome · Corsa', () => {
  it('ripetute brevi e dure: velocità', () => {
    const c = candidatiNome(corsa([
      { type: 'warmup', duration: '10 min' },
      { type: 'repeat', rounds: '8', runDuration: '400m', runIntensity: '9', recDuration: '1 min' },
    ]))
    expect(c).toEqual(expect.arrayContaining(['VO2max 400s', '8×400 Repeats', 'Track Session']))
  })

  it('ripetute lunghe: soglia', () => {
    const c = candidatiNome(corsa([{ type: 'repeat', rounds: '5', runDuration: '2 km', runIntensity: '7', recDuration: '2 min' }]))
    expect(c).toEqual(expect.arrayContaining(['Threshold 2K', '5×2K Repeats', 'Cruise Intervals']))
  })

  it('il lungo', () => {
    expect(candidatiNome(corsa([{ type: 'run', duration: '18 km', intensity: '5' }])))
      .toEqual(expect.arrayContaining(['Long Run', 'Long Run Easy', 'Long 18K']))
  })

  it('facile in Z2 propone prima «Zone 2 Run»', () => {
    expect(candidatiNome(corsa([{ type: 'run', duration: '45 min', pace: 'Z2', intensity: '4' }]))[0]).toBe('Zone 2 Run')
  })

  it('il medio a intensità 6-7 è un tempo run', () => {
    expect(candidatiNome(corsa([{ type: 'run', duration: '8 km', intensity: '7' }])))
      .toEqual(expect.arrayContaining(['Tempo Run', 'Tempo 8K']))
  })

  it('intensità che salgono: progressivo', () => {
    expect(candidatiNome(corsa([
      { type: 'run', duration: '5 km', intensity: '5' }, { type: 'run', duration: '5 km', intensity: '7' },
    ]))[0]).toBe('Progression Run')
  })
})

describe('scelta del nome', () => {
  const c = ['A', 'B', 'C']

  it('il seme sceglie il candidato, e a seme fermo il nome non cambia', () => {
    expect(scegliNome(c, 4)).toBe('B')
    expect(scegliNome(c, 4)).toBe(scegliNome(c, 4))
    expect(scegliNome([], 4)).toBeNull()
  })

  it('un nome già usato passa al candidato dopo, senza guardare le maiuscole', () => {
    expect(nomeLibero(c, ['b'], 1)).toBe('C')
    expect(nomeLibero(c, ['B', 'C'], 1)).toBe('A')
  })

  it('tutti presi: si numera invece di ripetere', () => {
    expect(nomeLibero(c, ['A', 'B', 'C'], 0)).toBe('A 2')
    expect(nomeLibero(c, ['A', 'B', 'C', 'A 2'], 0)).toBe('A 3')
  })

  it('un nome generato si riconosce fra i candidati del suo workout, anche numerato', () => {
    const cand = candidatiNome(emomWallBall)
    expect(eNomeGenerato('Wall Ball Burner', cand)).toBe(true)
    expect(eNomeGenerato('Wall Ball Burner 2', cand)).toBe(true)
    expect(eNomeGenerato('Gambe dure', cand)).toBe(false)
    expect(eNomeGenerato('Long Run', cand)).toBe(false)
    expect(eNomeGenerato('', cand)).toBe(false)
  })
})

describe('nomiGiaUsati', () => {
  it('toglie il codice in coda', async () => {
    const supabase = { from: () => ({ select: async () => ({ data: [{ title: 'Long Run · CL 18K @5' }, { title: 'Gambe dure' }] }) }) }
    expect(await nomiGiaUsati(supabase)).toEqual(['Long Run', 'Gambe dure'])
  })

  it('se la lettura fallisce torna un elenco vuoto, e il salvataggio prosegue', async () => {
    const supabase = { from: () => ({ select: async () => { throw new Error('rete') } }) }
    expect(await nomiGiaUsati(supabase)).toEqual([])
  })
})
