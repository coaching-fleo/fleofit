import { describe, it, expect } from 'vitest'
import {
  settimaneDelPeriodo, filtraRighe, numeriPeriodo, confrontoPeriodi,
  aderenzaPerSettimana, mappaAderenza, caricoPerCategoria, gradimentoPerSettimana,
  tabellaAnalisi,
} from '../analisi'
import { reportSettimanale } from '../reportSettimanale'

// Perché questi test esistono
// ────────────────────────────
// La pagina Analisi mette accanto otto settimane di numeri: un errore qui non
// si vede, perché un grafico sbagliato è plausibile quanto uno giusto. I casi
// presi sono quelli in cui la pagina resterebbe PLAUSIBILE E SBAGLIATA:
//  · l'atleta arrivato a metà periodo, che senza lo stato `prima` avrebbe
//    quattro settimane allo 0%;
//  · la pausa, che senza esclusione abbassa l'aderenza di tutta la squadra;
//  · l'ACWR, che deve essere LO STESSO numero del report settimanale;
//  · il confronto con un periodo vuoto, che non deve stampare «+∞%».

// Mercoledì 14 ottobre 2026: la settimana in corso va da lun 12 a dom 18.
const OGGI = new Date('2026-10-14T10:00:00')

const atleta = (id, extra = {}) => ({ id, name: id, surname: 'Rossi', notes: '', photo_url: null, ...extra })

let seme = 0
const ass = (athlete_id, completed_date, { status = 'pending', rpe = null, minuti = 60, categoria = 'Hyrox', gradimento } = {}) => ({
  id: `aw-${++seme}`,
  athlete_id,
  completed_date,
  status,
  notes: [rpe != null ? `[RPE: ${rpe}/10]` : null, gradimento ? `[GRADIMENTO: ${gradimento}]` : null]
    .filter(Boolean).join('\n') || null,
  voice_note_url: null,
  workouts: {
    id: `w-${seme}`,
    title: 'Allenamento',
    sections: categoria === 'Running'
      ? { category: 'Running', steps: [{ type: 'run', duration: `${minuti} min` }] }
      : categoria === 'Custom'
        ? { category: 'Custom', isAutonomous: true }
        : { category: 'Hyrox', blocks: [{ type: 'AMRAP', params: { duration: `${minuti} min` } }] },
  },
})
const fatto = (id, data, extra = {}) => ass(id, data, { status: 'completed', ...extra })

describe('settimaneDelPeriodo', () => {
  it('conta le settimane da lunedì, e l\'ultima è quella in corso', () => {
    const s = settimaneDelPeriodo(8, OGGI)
    expect(s).toHaveLength(8)
    expect(s[0].chiave).toBe('2026-08-24')
    expect(s[7].chiave).toBe('2026-10-12')
    expect(s[7].fino).toBe('2026-10-14')
  })
})

describe('filtraRighe', () => {
  it('filtra per atleta e per categoria', () => {
    const righe = [fatto('a1', '2026-10-05'), fatto('a2', '2026-10-05', { categoria: 'Running' })]
    expect(filtraRighe(righe, { atletaId: 'a1' }).map(r => r.athlete_id)).toEqual(['a1'])
    expect(filtraRighe(righe, { categoria: 'Running' }).map(r => r.athlete_id)).toEqual(['a2'])
    expect(filtraRighe(righe, {})).toHaveLength(2)
  })
})

describe('numeriPeriodo', () => {
  it('aderenza sulle assegnate già passate, sedute completate', () => {
    const righe = [
      fatto('a1', '2026-10-05', { rpe: 6 }),
      fatto('a1', '2026-10-06', { rpe: 8 }),
      ass('a1', '2026-10-07'),
      ass('a1', '2026-10-16'), // futura: non conta
    ]
    const n = numeriPeriodo([atleta('a1')], righe, settimaneDelPeriodo(8, OGGI))
    expect(n.sedute).toBe(2)
    expect(n.aderenza).toBe(67)
    expect(n.ore).toBe(2)
    expect(n.rpeMedio).toBe(7)
    expect(n.attivi).toBe(1)
  })

  it('senza assegnate non inventa un\'aderenza', () => {
    const n = numeriPeriodo([atleta('a1')], [], settimaneDelPeriodo(8, OGGI))
    expect(n.aderenza).toBeNull()
    expect(n.ore).toBeNull()
    expect(n.rpeMedio).toBeNull()
    expect(n.sedute).toBe(0)
  })
})

describe('confrontoPeriodi', () => {
  it('niente «+∞%» quando il periodo prima era vuoto', () => {
    const c = confrontoPeriodi({ sedute: 10 }, { sedute: 0 })
    expect(c.sedute.valore).toBe(10)
    expect(c.sedute.scarto).toBeNull()
  })

  it('percentuale sui conteggi, punti su aderenza e RPE', () => {
    const c = confrontoPeriodi({ sedute: 12, aderenza: 80, rpeMedio: 7 }, { sedute: 10, aderenza: 70, rpeMedio: 6.5 })
    expect(c.sedute).toEqual({ valore: 12, scarto: 20, unita: '%' })
    expect(c.aderenza).toEqual({ valore: 80, scarto: 10, unita: 'punti' })
    expect(c.rpeMedio).toEqual({ valore: 7, scarto: 0.5, unita: 'punti' })
  })
})

describe('mappaAderenza', () => {
  it('le settimane prima della prima assegnazione sono «prima», non 0%', () => {
    const righe = [fatto('a1', '2026-09-21'), ass('a1', '2026-09-22')]
    const [riga] = mappaAderenza([atleta('a1')], righe, settimaneDelPeriodo(8, OGGI))
    expect(riga.celle.slice(0, 4).every(c => c.stato === 'prima' && c.valore === null)).toBe(true)
    expect(riga.celle[4]).toMatchObject({ chiave: '2026-09-21', valore: 50, stato: 'ok' })
    expect(riga.celle[5]).toMatchObject({ valore: null, stato: 'vuota' })
  })

  it('le settimane di pausa sono «pausa»', () => {
    const a = atleta('a2', { notes: '[PAUSA: 2026-10-01]\n' })
    const [riga] = mappaAderenza([a], [ass('a2', '2026-08-25')], settimaneDelPeriodo(8, OGGI))
    expect(riga.celle.slice(5).map(c => c.stato)).toEqual(['pausa', 'pausa', 'pausa'])
    expect(riga.celle[0].stato).toBe('ok')
  })
})

describe('aderenzaPerSettimana', () => {
  it('la pausa non abbassa la media della squadra', () => {
    const atleti = [atleta('a1'), atleta('a2', { notes: '[PAUSA: 2026-10-01]\n' })]
    const righe = [fatto('a1', '2026-10-05'), ass('a2', '2026-10-05')]
    const serie = aderenzaPerSettimana(atleti, righe, settimaneDelPeriodo(8, OGGI))
    expect(serie[6]).toEqual({ chiave: '2026-10-05', valore: 100 })
    expect(serie[0].valore).toBeNull()
  })
})

describe('caricoPerCategoria e gradimentoPerSettimana', () => {
  it('minuti completati per categoria, settimana per settimana', () => {
    const righe = [
      fatto('a1', '2026-10-05', { minuti: 60 }),
      fatto('a1', '2026-10-06', { minuti: 30, categoria: 'Running' }),
      ass('a1', '2026-10-07', { minuti: 90 }),
    ]
    const c = caricoPerCategoria(righe, settimaneDelPeriodo(8, OGGI))
    expect(c[6]).toMatchObject({ chiave: '2026-10-05', Hyrox: 60, Running: 30, Custom: 0 })
  })

  it('percentuale di «mi è piaciuto», null senza risposte', () => {
    const righe = [
      fatto('a1', '2026-10-05', { gradimento: 'si' }),
      fatto('a1', '2026-10-06', { gradimento: 'no' }),
      fatto('a1', '2026-10-07', { gradimento: 'si' }),
      fatto('a1', '2026-10-08', { gradimento: 'nessuna' }),
    ]
    const g = gradimentoPerSettimana(righe, settimaneDelPeriodo(8, OGGI))
    expect(g[6]).toEqual({ chiave: '2026-10-05', valore: 50 })
    expect(g[5].valore).toBeNull()
  })
})

describe('tabellaAnalisi', () => {
  it('ACWR identico a quello del report settimanale', () => {
    const righe = []
    // Cinque settimane con due sedute misurate l'una, l'ultima più pesante.
    for (const lun of ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']) {
      righe.push(fatto('a1', lun, { rpe: 6 }))
      righe.push(fatto('a1', lun.replace(/-(\d\d)$/, (_, g) => `-${String(+g + 1).padStart(2, '0')}`), { rpe: 6 }))
    }
    righe.push(fatto('a1', '2026-10-12', { rpe: 9, minuti: 120 }))
    righe.push(fatto('a1', '2026-10-13', { rpe: 9, minuti: 120 }))

    const [riga] = tabellaAnalisi([atleta('a1')], righe, settimaneDelPeriodo(8, OGGI))
    const report = reportSettimanale([atleta('a1')], righe, { oggi: OGGI })
    expect(riga.acwr).not.toBeNull()
    expect(riga.acwr).toBe(report.righe[0].acwr)
    expect(riga.sedute).toBe(10)
    expect(riga.ultima).toBe('2026-10-13')
  })

  it('le settimane di pausa non entrano nell\'aderenza dell\'atleta', () => {
    const a = atleta('a2', { notes: '[PAUSA: 2026-10-01]\n' })
    const righe = [fatto('a2', '2026-09-21'), ass('a2', '2026-10-05'), ass('a2', '2026-10-06')]
    const [riga] = tabellaAnalisi([a], righe, settimaneDelPeriodo(8, OGGI))
    expect(riga.aderenza).toBe(100)
    expect(riga.pausa).toBe(true)
  })
})

describe('correzioni della revisione finale', () => {
  it('filtraRighe tiene solo le righe degli atleti seguiti (né coach né cancellati)', () => {
    const righe = [fatto('a1', '2026-10-05'), fatto('coach', '2026-10-05'), fatto('cancellato', '2026-10-06')]
    expect(filtraRighe(righe, { atleti: [atleta('a1')] }).map(r => r.athlete_id)).toEqual(['a1'])
  })

  it('il gradimento si ferma a oggi, come tutti gli altri numeri', () => {
    const righe = [fatto('a1', '2026-10-13', { gradimento: 'si' }), fatto('a1', '2026-10-16', { gradimento: 'no' })]
    const g = gradimentoPerSettimana(righe, settimaneDelPeriodo(8, OGGI))
    expect(g[7].valore).toBe(100)
  })

  it('l\'aderenza della settimana in corso è quella del report', () => {
    const atleti = [
      atleta('a1'),
      atleta('a2', { notes: '[PAUSA: 2026-10-01]\n' }),
      atleta('a3'), // nuovo: niente prima di questa settimana
      atleta('a4'), // niente in programma
    ]
    const righe = [
      fatto('a1', '2026-10-05'), fatto('a1', '2026-10-12'), ass('a1', '2026-10-13'), ass('a1', '2026-10-15'),
      ass('a2', '2026-10-12'),
      fatto('a3', '2026-10-13'), fatto('a3', '2026-10-14'), ass('a3', '2026-10-14'),
    ]
    const serie = aderenzaPerSettimana(atleti, righe, settimaneDelPeriodo(8, OGGI))
    const report = reportSettimanale(atleti, righe, { oggi: OGGI })
    expect(serie.at(-1).valore).toBe(report.squadra.percentuale)
  })
})
