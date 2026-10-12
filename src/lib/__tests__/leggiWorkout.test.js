import { describe, it, expect } from 'vitest'
import { leggiHyrox, leggiCorsa, leggiEsercizio, leggiIntestazione, trovaEsercizio, trovaTempo, pulisciRiga } from '../leggiWorkout'

// ⚠️ Gli esempi qui sono gergo Hyrox generico. Quando arrivano i workout veri
// del coach (Note, foto della lavagna) vanno aggiunti in fondo, uno per
// describe, PRIMA di cambiare una regola.

describe('pulisciRiga', () => {
  it('riduce apici tipografici, × e punti elenco', () => {
    expect(pulisciRiga('• 40″ on 20’’ off × 8')).toBe('40" on 20" off x 8')
    expect(pulisciRiga('- 20 wall balls')).toBe('20 wall balls')
    expect(pulisciRiga('1) 500m row')).toBe('500m row')
    expect(pulisciRiga('b) 10 burpees')).toBe('10 burpees')
  })

  it('non toglie un numero che fa parte dell’esercizio', () => {
    expect(pulisciRiga('20 wall balls')).toBe('20 wall balls')
    expect(pulisciRiga('1.30 plank')).toBe('1.30 plank')
  })
})

describe('trovaTempo', () => {
  it('legge minuti, secondi e m:ss', () => {
    expect(trovaTempo("10'").secondi).toBe(600)
    expect(trovaTempo('40"').secondi).toBe(40)
    expect(trovaTempo("1'30").secondi).toBe(90)
    expect(trovaTempo('1:30').secondi).toBe(90)
    expect(trovaTempo('12 min').secondi).toBe(720)
    expect(trovaTempo('45 sec').secondi).toBe(45)
  })

  it('non scambia metri e passi per tempi', () => {
    expect(trovaTempo('400m')).toBeNull()
    expect(trovaTempo('2:00/500')).toBeNull()
    expect(trovaTempo('4:30 /km')).toBeNull()
  })
})

describe('trovaEsercizio', () => {
  it('riconosce nomi, plurali e sinonimi', () => {
    expect(trovaEsercizio('wall ball')).toBe('Wall Balls')
    expect(trovaEsercizio('WB')).toBe('Wall Balls')
    expect(trovaEsercizio('ski')).toBe('SkiErg')
    expect(trovaEsercizio('row')).toBe('Rowing')
    expect(trovaEsercizio('burpee')).toBe('Burpees')
    expect(trovaEsercizio('bbj')).toBe('Burpees Broad Jumps')
    expect(trovaEsercizio('sled push')).toBe('Sled Push')
    expect(trovaEsercizio('affondi')).toBe('Sandbag Lunges')
  })

  it('perdona un errore di battitura', () => {
    expect(trovaEsercizio('wal balls')).toBe('Wall Balls')
    expect(trovaEsercizio('thrusterr')).toBe('Thruster')
  })

  it('non indovina fra due esercizi', () => {
    // «wall» sta sia in Wall Balls sia in Wall Walk.
    expect(trovaEsercizio('wall')).toBeNull()
    expect(trovaEsercizio('mountain climber')).toBeNull()
  })
})

describe('leggiEsercizio', () => {
  it('legge reps, peso e nome', () => {
    expect(leggiEsercizio('20 Wall Balls 6kg')).toMatchObject({ name: 'Wall Balls', reps: '20', kg: '6', meters: '' })
    expect(leggiEsercizio('3x10 front squat @60')).toMatchObject({ name: 'Front Squat', reps: '10', kg: '60', notes: '3 × 10' })
    expect(leggiEsercizio('max burpee')).toMatchObject({ name: 'Burpees', reps: 'Max' })
  })

  it('su ergometri e slitte un numero nudo è distanza', () => {
    expect(leggiEsercizio('row 500')).toMatchObject({ name: 'Rowing', meters: '500m', reps: '' })
    expect(leggiEsercizio('1000m Ski @2:00/500')).toMatchObject({ name: 'SkiErg', meters: '1000m', ergoPace: '2:00 /500m' })
    expect(leggiEsercizio('Run 1km')).toMatchObject({ name: 'Run', meters: '1000m' })
    expect(leggiEsercizio('4x25m sled push 150kg')).toMatchObject({ name: 'Sled Push', meters: '25m', kg: '150', notes: '4 × 25m' })
  })

  it('il peso doppio resta doppio', () => {
    expect(leggiEsercizio('farmer carry 2x24kg 200m')).toMatchObject({ name: 'Farmers Carry', kg: '2x24', meters: '200m' })
  })

  it('🔴 non inventa una distanza da un numero che non lo è', () => {
    // «Row 15» non sono 15 metri: resta scritto nella nota.
    const ex = leggiEsercizio('row 15')
    expect(ex.meters).toBe('')
    expect(ex.reps).toBe('')
    expect(ex.notes).toBe('15')
    // Le calorie non hanno un campo, ma non si perdono.
    expect(leggiEsercizio('15 cal ski')).toMatchObject({ name: 'SkiErg', meters: '', notes: '15 cal' })
  })

  it('un esercizio sconosciuto con un numero entra col suo nome', () => {
    expect(leggiEsercizio('mountain climbers 30')).toMatchObject({ name: 'Mountain Climbers', reps: '30', riconosciuto: false })
  })

  it('una riga senza esercizio né numeri non è un esercizio', () => {
    expect(leggiEsercizio('tieni il ritmo')).toBeNull()
    expect(leggiEsercizio('Hyrox simulation')).toBeNull()
  })

  it('legge l’intensità scritta', () => {
    expect(leggiEsercizio('20 wall balls rpe 8')).toMatchObject({ intensity: '8' })
    expect(leggiEsercizio('20 wall balls @8/10')).toMatchObject({ intensity: '8', kg: '' })
  })
})

describe('leggiIntestazione', () => {
  const blocco = (r) => leggiIntestazione(r)?.blocco

  it('EMOM: la durata scritta è il totale', () => {
    expect(blocco("EMOM 12'")).toMatchObject({ type: 'EMOM', params: { interval: '1:00', rounds: '12' } })
    expect(blocco("E2MOM 10'")).toMatchObject({ type: 'EMOM', params: { interval: '2:00', rounds: '5' } })
    expect(blocco('EMOM x 10')).toMatchObject({ type: 'EMOM', params: { rounds: '10' } })
    expect(blocco('EMOM 16')).toMatchObject({ type: 'EMOM', params: { rounds: '16' } })
    expect(blocco("ogni 3' x 4")).toMatchObject({ type: 'EMOM', params: { interval: '3:00', rounds: '4' } })
  })

  it('🔴 un EMOM senza durata non si inventa i giri', () => {
    expect(blocco('EMOM').params.rounds).toBeUndefined()
  })

  it('AMRAP, For Time, ON/OFF, Tabata', () => {
    expect(blocco('AMRAP 20')).toMatchObject({ type: 'AMRAP', params: { duration: '20:00' } })
    expect(blocco("amrap 8'")).toMatchObject({ type: 'AMRAP', params: { duration: '8:00' } })
    expect(blocco('4 RFT')).toMatchObject({ type: 'For Time', params: { rounds: '4' } })
    expect(blocco('3 rounds for time')).toMatchObject({ type: 'For Time', params: { rounds: '3' } })
    expect(blocco("For time cap 25'")).toMatchObject({ type: 'For Time', notes: 'Time cap 25:00' })
    expect(blocco('40" on 20" off x8')).toMatchObject({ type: 'ON/OFF', params: { on: '0:40', off: '0:20', rounds: '8' } })
    expect(blocco('40 on 20 off')).toMatchObject({ type: 'ON/OFF', params: { on: '0:40', off: '0:20' } })
    expect(blocco('Tabata')).toMatchObject({ type: 'ON/OFF', params: { on: '0:20', off: '0:10', rounds: '8' } })
  })

  it('riscaldamento, cash in/out, rest, giri da soli', () => {
    expect(blocco("Warm up 10'")).toMatchObject({ type: 'WarmUp', params: { duration: '10:00' } })
    expect(blocco('Riscaldamento')).toMatchObject({ type: 'WarmUp', params: {} })
    expect(blocco('Cash in')).toMatchObject({ type: 'Cash In' })
    expect(blocco('Buy out x2')).toMatchObject({ type: 'Cash Out', params: { rounds: '2' } })
    expect(blocco("Rest 3'")).toMatchObject({ type: 'Rest', params: { duration: '3:00' } })
    expect(blocco('3 rounds')).toMatchObject({ type: 'For Time', params: { rounds: '3' } })
  })

  it('porta con sé quello che segue i due punti', () => {
    expect(leggiIntestazione("EMOM 10': 12 burpees").coda).toBe('12 burpees')
    // I due punti di un tempo non sono un separatore.
    expect(leggiIntestazione('Rest 1:30').coda).toBe('')
  })

  it('una riga d’esercizio non è un’intestazione', () => {
    expect(leggiIntestazione('20 wall balls')).toBeNull()
    expect(leggiIntestazione('500m row')).toBeNull()
  })
})

describe('leggiHyrox', () => {
  const TESTO = `Hyrox simulation
Warm up 10'
- 500m row
- 20 jumping jack
EMOM 12'
min 1: 15 cal ski
min 2: 12 burpees
min 3: rest
AMRAP 20: 10 burpees + 15 wb 6kg, 200m run
Rest 3'
mountain climbers 30
tieni il ritmo`

  it('compone i blocchi nell’ordine scritto', () => {
    const { blocchi } = leggiHyrox(TESTO)
    expect(blocchi.map(b => b.type)).toEqual(['WarmUp', 'EMOM', 'AMRAP', 'Rest', 'For Time'])
    expect(blocchi[1].exercises.map(e => e.name)).toEqual(['SkiErg', 'Burpees', 'Rest'])
    expect(blocchi[2].exercises.map(e => e.name)).toEqual(['Burpees', 'Wall Balls', 'Run'])
  })

  it('🔴 il riscaldamento non ha esercizi nel builder: le righe vanno nelle sue note', () => {
    const { blocchi, righe } = leggiHyrox(TESTO)
    expect(blocchi[0].exercises).toEqual([])
    // Unite da « · »: il campo note del blocco è su una riga sola.
    expect(blocchi[0].notes).toBe('500m row · 20 jumping jack')
    expect(righe.find(r => r.testo === '500m row').esito).toBe('nota')
  })

  it('dopo un Rest gli esercizi aprono un blocco nuovo, senza giri inventati', () => {
    const { blocchi } = leggiHyrox(TESTO)
    expect(blocchi[3].exercises).toEqual([])
    expect(blocchi[4]).toMatchObject({ type: 'For Time', params: {} })
  })

  it('🔴 nessuna riga si perde', () => {
    const { blocchi, note, righe } = leggiHyrox(TESTO)
    expect(note).toBe('Hyrox simulation')
    expect(blocchi[4].notes).toBe('tieni il ritmo')
    expect(righe).toHaveLength(TESTO.split('\n').length)
    expect(righe.filter(r => r.esito === 'nota').map(r => r.testo))
      .toEqual(['Hyrox simulation', '500m row', '20 jumping jack', 'tieni il ritmo'])
    expect(righe.find(r => r.testo.startsWith('mountain')).esito).toBe('nuovo')
  })

  it('il tempo di un esercizio va nel campo giusto per il blocco', () => {
    const interval = leggiHyrox('Interval x3\n45" wall balls').blocchi[0]
    expect(interval.exercises[0]).toMatchObject({ name: 'Wall Balls', exTime: '0:45' })
    const emom = leggiHyrox("EMOM 10'\nmin 2: rest 1'").blocchi[0]
    // Il Rest tiene la durata in `meters`, come la legge durataBlocco.
    expect(emom.exercises[0]).toMatchObject({ name: 'Rest', meters: '1:00' })
    const ft = leggiHyrox('3 rft\n30" plank').blocchi[0]
    expect(ft.exercises[0]).toMatchObject({ name: 'Plank', notes: '0:30' })
    expect(ft.exercises[0].exTime).toBeUndefined()
  })

  it('un testo vuoto non produce niente', () => {
    expect(leggiHyrox('')).toEqual({ blocchi: [], note: '', righe: [] })
    expect(leggiHyrox('\n  \n')).toEqual({ blocchi: [], note: '', righe: [] })
  })
})

describe('leggiCorsa', () => {
  it('riscaldamento, ripetute, corsa continua, defaticamento', () => {
    const { fasi } = leggiCorsa(`Riscaldamento 15' Z1
6x400m @3:45 rec 1' camminata
5x1km 4:10-4:20 r 2'
3 km Z2
defaticamento 10'`)
    expect(fasi.map(f => f.type)).toEqual(['warmup', 'repeat', 'repeat', 'run', 'cooldown'])
    expect(fasi[0]).toMatchObject({ duration: '15 min', pace: 'Z1' })
    expect(fasi[1]).toMatchObject({ rounds: '6', runDuration: '400m', runPace: '3:45 /km', recDuration: '1 min', recPace: 'Camminata' })
    expect(fasi[2]).toMatchObject({ runDuration: '1 km', runPace: '4:10 - 4:20 /km', runPaceMin: '4:10 /km', runPaceMax: '4:20 /km', recDuration: '2 min' })
    expect(fasi[3]).toMatchObject({ duration: '3 km', pace: 'Z2' })
    expect(fasi[4]).toMatchObject({ duration: '10 min', pace: 'Libero' })
  })

  it('🔴 delle ripetute senza recupero scritto non se lo inventano', () => {
    expect(leggiCorsa('8x200m all out').fasi[0]).toMatchObject({ rounds: '8', runDuration: '200m', runPace: 'All out', recDuration: '' })
  })

  it('una riga senza misure finisce nelle note', () => {
    const { fasi, note } = leggiCorsa('Seduta di qualità\n5 km Z2\nandatura facile')
    expect(note).toBe('Seduta di qualità')
    expect(fasi[0].notes).toBe('andatura facile')
  })
})
