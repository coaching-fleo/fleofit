import { describe, it, expect } from 'vitest'
import {
  nuovoGruppoGym, tipoGruppo, serieDi, riassuntoEsercizio, riassuntoGruppo, durataGruppoGym, riepilogoGym,
  etichetteGym, preparaGymIA, gymPerIA, candidatiNomeGym, secondiGym, tempoGym, testoTempo, repsGym, caricoGym,
  dettaglioDaSemplice, sempliceDaDettaglio, cambiaEsercizioGym, spostaInFase, gruppiPerElenco, righeTestoGym, tipoSerieDopo, SECONDI_CAMBIO,
} from '../gym'
import { trovaEsercizioGym, cercaEserciziGym, ESERCIZI_GYM, MUSCOLI } from '../eserciziGym'
import { codiceWorkout, separaCodice, unisciCodice } from '../codiceWorkout'
import { durataWorkout, numeroBlocchi, rpeAtteso } from '../statistiche'
import { candidatiNome } from '../nomeCasuale'
import { categoriaDi, corsia, parolaPezzi } from '../categorie'
import { haTimerGuidato } from '../timerSequence'
import { righeAllenamento } from '../recapStoria'

const gruppo = (campi, ...esercizi) => ({ id: Math.random(), fase: 'principale', serie: '4', recupero: '1:30', note: '', esercizi, ...campi })
const ex = (name, campi = {}) => ({ id: Math.random(), name, reps: '10', kg: '', ...campi })

describe('la libreria degli esercizi', () => {
  it('ha nomi unici e solo muscoli dichiarati', () => {
    const nomi = ESERCIZI_GYM.map(e => e.nome.toLowerCase())
    expect(new Set(nomi).size).toBe(nomi.length)
    for (const e of ESERCIZI_GYM) expect(MUSCOLI).toContain(e.muscolo)
  })
  it('riporta i nomi inglesi e le maiuscole alla voce italiana', () => {
    expect(trovaEsercizioGym('Bench Press').nome).toBe('Panca piana con bilanciere')
    expect(trovaEsercizioGym('lat pulldown').nome).toBe('Lat machine avanti')
    expect(trovaEsercizioGym('LEG PRESS').nome).toBe('Leg press')
    expect(trovaEsercizioGym('Esercizio inventato')).toBeNull()
  })
  it('cerca per parole e per muscolo', () => {
    expect(cercaEserciziGym('curl martello').map(e => e.nome)).toEqual(['Curl a martello'])
    expect(cercaEserciziGym('', 'Polpacci').every(e => e.muscolo === 'Polpacci')).toBe(true)
  })
})

describe('numeri e testi', () => {
  it('legge i tempi come li scrive un coach', () => {
    expect(secondiGym('1:30')).toBe(90)
    expect(secondiGym('90"')).toBe(90)
    expect(secondiGym('90 sec')).toBe(90)
    expect(secondiGym('2 min')).toBe(120)
    expect(secondiGym('2')).toBe(120)
    expect(secondiGym('90')).toBe(90)
    expect(secondiGym('')).toBeNull()
    expect(tempoGym('90')).toBe('1:30')
    expect(testoTempo('0:30')).toBe('30″')
    expect(testoTempo('10:00')).toBe('10′')
  })
  it('normalizza ripetizioni e carichi', () => {
    expect(repsGym('8 - 12')).toBe('8-12')
    expect(repsGym('a cedimento')).toBe('Max')
    expect(caricoGym('60')).toBe('60 kg')
    expect(caricoGym('62,5kg')).toBe('62.5 kg')
    expect(caricoGym('')).toBe('')
  })
})

describe('gruppi e riassunti', () => {
  it('il tipo si legge dal numero di esercizi', () => {
    expect(tipoGruppo(gruppo({}, ex('Squat con bilanciere')))).toBe('singolo')
    expect(tipoGruppo(gruppo({}, ex('A'), ex('B')))).toBe('superserie')
    expect(tipoGruppo(gruppo({}, ex('A'), ex('B'), ex('C')))).toBe('triserie')
    expect(tipoGruppo(gruppo({}, ex('A'), ex('B'), ex('C'), ex('D')))).toBe('circuito')
  })
  it('un esercizio singolo dice serie × ripetizioni · carico', () => {
    const g = gruppo({}, ex('Panca piana con bilanciere', { reps: '8-12', kg: '60 kg', rir: '2' }))
    expect(riassuntoEsercizio(g, g.esercizi[0])).toBe('4 × 8–12 · 60 kg · RIR 2')
  })
  it('in una superserie le serie sono i giri del gruppo', () => {
    const g = gruppo({ serie: '3' }, ex('Push down con corda', { reps: '12', kg: '25 kg' }), ex('Piegamenti'))
    expect(riassuntoEsercizio(g, g.esercizi[0])).toBe('12 · 25 kg')
    expect(riassuntoGruppo(g)).toBe('Superserie · 3 giri · rec 1:30')
  })
  it('un esercizio a tempo dice la durata, non le ripetizioni', () => {
    const g = gruppo({ serie: '3' }, { id: 1, name: 'Plank', durata: '0:45', kg: '' })
    expect(riassuntoEsercizio(g, g.esercizi[0])).toBe('3 × 45″')
  })
  it('con il dettaglio le serie sono le righe, e il riassunto lo dice', () => {
    const g = gruppo({ serie: '9' }, ex('Squat con bilanciere', { dettaglio: [
      { tipo: 'riscaldamento', reps: '10', kg: '40 kg' },
      { tipo: 'normale', reps: '8', kg: '80 kg' },
      { tipo: 'normale', reps: '6', kg: '90 kg' },
    ] }))
    expect(serieDi(g)).toBe(3)
    expect(riassuntoEsercizio(g, g.esercizi[0])).toBe('3 serie · 10-8-6 · 40–90 kg')
  })
  it('dal semplice al dettaglio e ritorno senza perdere i numeri', () => {
    const g = gruppo({ serie: '3' }, ex('Leg press', { reps: '12', kg: '100 kg' }))
    const conD = { ...g, esercizi: [{ ...g.esercizi[0], dettaglio: dettaglioDaSemplice(g) }] }
    expect(conD.esercizi[0].dettaglio).toHaveLength(3)
    conD.esercizi[0].dettaglio[2] = { tipo: 'normale', reps: '8', kg: '120 kg' }
    const indietro = sempliceDaDettaglio(conD)
    expect(indietro.serie).toBe('3')
    expect(indietro.esercizi[0]).toMatchObject({ reps: '8', kg: '120 kg' })
    expect(indietro.esercizi[0].dettaglio).toBeUndefined()
  })
  it('il tipo di serie gira: normale → R → D → C → normale', () => {
    expect(['normale', 'riscaldamento', 'drop', 'cedimento'].map(tipoSerieDopo)).toEqual(['riscaldamento', 'drop', 'cedimento', 'normale'])
  })
  it('le lettere seguono l\'ordine delle fasi, e le superserie sono numerate', () => {
    const a = gruppo({ fase: 'principale' }, ex('A'))
    const b = gruppo({ fase: 'principale' }, ex('B1'), ex('B2'))
    const r = gruppo({ fase: 'riscaldamento' }, ex('R'))
    const mappa = etichetteGym([a, b, r])
    expect(mappa.get(r.id)).toEqual(['A'])
    expect(mappa.get(a.id)).toEqual(['B'])
    expect(mappa.get(b.id)).toEqual(['C1', 'C2'])
  })
})

describe('la durata stimata', () => {
  it('somma serie, recuperi fra le serie e un cambio', () => {
    // 4 serie da 10 reps (40″) + 3 recuperi da 90″ + cambio
    const g = gruppo({}, ex('Panca piana con bilanciere'))
    expect(durataGruppoGym(g)).toBe(4 * 40 + 3 * 90 + SECONDI_CAMBIO)
  })
  it('una superserie conta il giro intero', () => {
    const g = gruppo({ serie: '3', recupero: '1:00' }, ex('A', { reps: '10' }), ex('B', { reps: '5' }))
    expect(durataGruppoGym(g)).toBe(3 * 60 + 2 * 60 + SECONDI_CAMBIO)
  })
  it('il riepilogo conta esercizi e serie totali', () => {
    const r = riepilogoGym([gruppo({}, ex('A')), gruppo({ serie: '3' }, ex('B'), ex('C'))])
    expect(r.esercizi).toBe(3)
    expect(r.serie).toBe(4 + 6)
  })
  it('durataWorkout e numeroBlocchi leggono Gym, non lo trattano come un Hyrox vuoto', () => {
    const sections = { category: 'Gym', gym: [gruppo({}, ex('A')), gruppo({}, ex('B'), ex('C'))] }
    expect(numeroBlocchi(sections)).toBe(3)
    expect(durataWorkout(sections)).toBe(Math.round(riepilogoGym(sections.gym).secondi / 60))
    expect(rpeAtteso({ category: 'Gym', gym: sections.gym })).toBeNull()
    expect(rpeAtteso({ category: 'Gym', intensity: '7', gym: sections.gym })).toBe(7)
  })
})

describe('Gym nel resto dell\'app', () => {
  it('ha la sua corsia, la sua parola e niente timer guidato', () => {
    expect(categoriaDi({ category: 'Gym' })).toBe('Gym')
    expect(corsia('Gym').bg).toBe('bg-gym')
    expect(parolaPezzi('Gym', 1)).toBe('esercizio')
    expect(parolaPezzi('Gym', 3)).toBe('esercizi')
    expect(haTimerGuidato({ sections: { category: 'Gym' } })).toBe(false)
  })
  it('il codice nel titolo è «GYM minuti @intensità», e si riconosce in coda', () => {
    const gym = [gruppo({}, ex('Panca piana con bilanciere'))]
    const codice = codiceWorkout({ category: 'Gym', gym, intensity: '7' })
    expect(codice).toMatch(/^GYM \d+′ @7$/)
    expect(separaCodice(unisciCodice('Push Day', codice))).toEqual({ nome: 'Push Day', codice })
    expect(codiceWorkout({ category: 'Gym', gym: [] })).toBe('')
  })
  it('il nome automatico viene dai muscoli', () => {
    const push = [gruppo({}, ex('Panca piana con bilanciere')), gruppo({}, ex('Push down con corda'))]
    expect(candidatiNomeGym(push)).toEqual(expect.arrayContaining(['Push Day', 'Petto e Tricipiti']))
    const gambe = [gruppo({}, ex('Squat con bilanciere')), gruppo({}, ex('Leg curl sdraiato'))]
    expect(candidatiNome({ category: 'Gym', gym: gambe })).toContain('Leg Day')
    const tutto = [...push, ...gambe]
    expect(candidatiNomeGym(tutto)).toContain('Full Body')
    // Il riscaldamento non decide il nome.
    expect(candidatiNomeGym([gruppo({ fase: 'riscaldamento' }, ex('Panca piana con bilanciere'))])).toEqual([])
  })
  it('la storia elenca gli esercizi con le lettere', () => {
    const w = { sections: { category: 'Gym', gym: [gruppo({}, ex('Leg press', { kg: '100 kg' }))] } }
    expect(righeAllenamento(w)).toEqual([{ genere: 'esercizio', nome: 'A. Leg press', specifiche: '4 × 10 · 100 kg · rec 1:30' }])
    expect(gruppiPerElenco([])).toEqual([])
  })
  it('il PDF ha la fase, il gruppo e le note', () => {
    const righe = righeTestoGym([gruppo({ serie: '3' }, ex('A', { notes: 'lento' }), ex('B'))])
    expect(righe.map(r => r.genere)).toEqual(['fase', 'gruppo', 'esercizio', 'nota', 'esercizio'])
  })
})

describe('la scheda scritta dall\'IA', () => {
  it('diventa uguale a una fatta a mano', () => {
    const [g, s] = preparaGymIA([
      { fase: 'Warm up', esercizi: [{ name: 'treadmill', durata: '10 min' }] },
      { fase: 'principale', serie: 4, recupero: '90"', esercizi: [{ name: 'bench press', reps: '8 - 10', kg: 70 }] },
    ])
    expect(g).toMatchObject({ fase: 'riscaldamento', serie: '1', recupero: '', esercizi: [{ name: 'Tapis roulant', durata: '10:00' }] })
    expect(g.esercizi[0].reps).toBeUndefined()
    expect(s).toMatchObject({ fase: 'principale', serie: '4', recupero: '1:30', esercizi: [{ name: 'Panca piana con bilanciere', reps: '8-10', kg: '70 kg' }] })
    expect(typeof s.id).toBe('number')
  })
  it('non inventa un carico e non perde un esercizio custom', () => {
    const [g] = preparaGymIA([{ esercizi: [{ name: 'Affondi laterali con disco', reps: '12' }] }])
    expect(g.esercizi[0]).toMatchObject({ name: 'Affondi laterali con disco', reps: '12', kg: '' })
  })
  it('un esercizio arrivato senza gruppo diventa un gruppo; uno vuoto sparisce', () => {
    const fuori = preparaGymIA([{ name: 'Leg extension', reps: '15' }, { esercizi: [] }, null, 'x'])
    expect(fuori).toHaveLength(1)
    expect(fuori[0].esercizi[0].name).toBe('Leg extension')
    expect(preparaGymIA('non un array')).toEqual([])
  })
  it('il dettaglio resta solo sugli esercizi singoli', () => {
    const [g] = preparaGymIA([{ esercizi: [
      { name: 'A', dettaglio: [{ tipo: 'drop', reps: '10', kg: '20' }] },
      { name: 'B', dettaglio: [{ tipo: 'drop', reps: '10', kg: '20' }] },
    ] }])
    expect(g.esercizi.every(e => e.dettaglio === undefined)).toBe(true)
    const [s] = preparaGymIA([{ esercizi: [{ name: 'A', dettaglio: [{ tipo: 'boh', reps: '10', kg: '20' }] }] }])
    expect(s.esercizi[0].dettaglio).toEqual([{ tipo: 'normale', reps: '10', kg: '20 kg' }])
  })
  it('in una modifica l\'IA legge la scheda senza gli id', () => {
    const [g] = gymPerIA([gruppo({}, ex('A'))])
    expect(g.id).toBeUndefined()
    expect(g.esercizi[0].id).toBeUndefined()
    expect(g.esercizi[0].name).toBe('A')
  })
  it('un gruppo nuovo parte da 3 serie in centro e 1 nel riscaldamento', () => {
    expect(nuovoGruppoGym('principale', 'Leg press')).toMatchObject({ serie: '3', recupero: '1:30', esercizi: [{ reps: '10' }] })
    expect(nuovoGruppoGym('riscaldamento', 'Cyclette')).toMatchObject({ serie: '1', recupero: '', esercizi: [{ durata: '10:00' }] })
  })
})

describe('«Cambia esercizio»', () => {
  it('tiene id, numeri e note se la misura è la stessa', () => {
    const prima = ex('Panca piana con bilanciere', { reps: '8-12', kg: '60 kg', rir: '2', notes: 'fermo in basso' })
    expect(cambiaEsercizioGym(prima, 'Panca inclinata con manubri')).toEqual({ ...prima, name: 'Panca inclinata con manubri' })
  })

  it('da ripetizioni a tempo riparte dai valori di un esercizio nuovo', () => {
    const prima = ex('Panca piana con bilanciere', { reps: '8', kg: '60 kg', rir: '2' })
    const dopo = cambiaEsercizioGym(prima, 'Plank')
    expect(dopo).toMatchObject({ id: prima.id, name: 'Plank', durata: '0:30', kg: '' })
    expect(dopo.reps).toBeUndefined()
    expect(dopo.rir).toBeUndefined()
  })
})

describe('«Fase» di un gruppo', () => {
  it('il gruppo va in fondo alla fase nuova, com\'è', () => {
    const a = gruppo({ id: 'a', fase: 'riscaldamento', serie: '3' }, ex('Squat con bilanciere'))
    const b = gruppo({ id: 'b' }, ex('Leg press'))
    const dopo = spostaInFase([a, b], 'a', 'principale')
    expect(dopo.map(g => g.id)).toEqual(['b', 'a'])
    expect(dopo[1]).toEqual({ ...a, fase: 'principale' })
  })

  it('una fase sconosciuta o la stessa non cambiano niente', () => {
    const lista = [gruppo({ id: 'a' }, ex('Leg press'))]
    expect(spostaInFase(lista, 'a', 'principale')).toBe(lista)
    expect(spostaInFase(lista, 'a', 'cardio')).toBe(lista)
  })
})
