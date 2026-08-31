import { describe, it, expect } from 'vitest'
import {
  giornoBreve, riepilogoCorsa, metaWorkout, testoCercabile,
  ordinaPerData, raggruppaPerMese, conteggiPerCorsia,
} from '../rigaArchivio'

const hyrox = (blocks) => ({ date: '2026-08-22', sections: { category: 'Hyrox', blocks } })
const corsa = (steps) => ({ date: '2026-08-20', sections: { category: 'Running', steps } })

describe('giornoBreve', () => {
  it('scrive il giorno in forma breve e con l\'iniziale maiuscola', () => {
    expect(giornoBreve('2026-08-22')).toBe('Sab 22')
  })
  it('torna la stringa vuota su una data assente o illeggibile', () => {
    expect(giornoBreve(null)).toBe('')
    expect(giornoBreve('non-una-data')).toBe('')
  })
})

describe('riepilogoCorsa', () => {
  it('somma i chilometri quando ogni fase è una distanza', () => {
    const r = riepilogoCorsa([{ type: 'run', duration: '10 km' }, { type: 'cooldown', duration: '2 km' }])
    expect(r.metri).toBe(12000)
    expect(r.puroDistanza).toBe(true)
    expect(r.puroTempo).toBe(false)
  })

  it('moltiplica le ripetute per i round, gamba di corsa e di recupero', () => {
    const r = riepilogoCorsa([{ type: 'repeat', rounds: '6', runDuration: '800m', recDuration: '200m' }])
    expect(r.metri).toBe(6000)
    expect(r.puroDistanza).toBe(true)
  })

  it('somma i minuti quando ogni fase è un tempo', () => {
    const r = riepilogoCorsa([{ type: 'warmup', duration: '10 min' }, { type: 'run', duration: '50 min' }])
    expect(r.minuti).toBe(60)
    expect(r.puroTempo).toBe(true)
  })

  // 🔴 Il caso che conta: un allenamento misto ha DUE totali veri, e nessuno
  // dei due è «la lunghezza dell'allenamento». Sommarli darebbe un numero
  // plausibile e inventato.
  it('non dichiara nessun totale se le fasi mescolano distanza e tempo', () => {
    const r = riepilogoCorsa([{ type: 'repeat', rounds: '8', runDuration: '400m', recDuration: '1 min' }])
    expect(r.puroDistanza).toBe(false)
    expect(r.puroTempo).toBe(false)
    expect(r.fasi).toBe(1)
  })

  it('una fase illeggibile toglie il totale anche se le altre concordano', () => {
    const r = riepilogoCorsa([{ type: 'run', duration: '5 km' }, { type: 'run', duration: 'Libero' }])
    expect(r.puroDistanza).toBe(false)
  })

  it('una ripetuta senza round conta una volta sola, non zero', () => {
    expect(riepilogoCorsa([{ type: 'repeat', runDuration: '1 km' }]).metri).toBe(1000)
  })
})

describe('metaWorkout', () => {
  it('conta i blocchi e stima i minuti di un Hyrox', () => {
    const w = hyrox([
      { id: 1, type: 'WarmUp', params: { duration: '10:00' } },
      { id: 2, type: 'EMOM', params: { interval: '1:00', rounds: '20' }, exercises: [{ name: 'Wall Balls', reps: '15' }] },
    ])
    expect(metaWorkout(w)).toBe('Sab 22 · 2 blocchi · 30′')
  })

  it('usa il singolare con un blocco solo', () => {
    const w = hyrox([{ id: 1, type: 'WarmUp', params: { duration: '10:00' } }])
    expect(metaWorkout(w)).toBe('Sab 22 · 1 blocco · 10′')
  })

  it('dice fasi e chilometri su una corsa a distanza', () => {
    expect(metaWorkout(corsa([{ type: 'run', duration: '18 km' }]))).toBe('Gio 20 · 1 fase · 18 km')
  })

  it('dice solo le fasi quando la corsa mescola le unità', () => {
    const w = corsa([{ type: 'repeat', rounds: '8', runDuration: '400m', recDuration: '1 min' }])
    expect(metaWorkout(w)).toBe('Gio 20 · 1 fase')
  })

  // ⚠️ «0 blocchi · 0′» sarebbe una bugia con l'aria di un dato.
  it('su Custom ed Evento dice solo il giorno', () => {
    expect(metaWorkout({ date: '2026-08-22', sections: { category: 'Custom' } })).toBe('Sab 22')
    expect(metaWorkout({ date: '2026-08-22', sections: { category: 'Event' } })).toBe('Sab 22')
    expect(metaWorkout({ date: '2026-08-22', sections: { isAutonomous: true } })).toBe('Sab 22')
  })

  it('un Hyrox senza blocchi non stampa un conteggio a zero', () => {
    expect(metaWorkout(hyrox([]))).toBe('Sab 22')
  })

  it('legge anche il formato legacy senza `blocks`', () => {
    const w = { date: '2026-08-22', sections: { category: 'Hyrox', warmup: { duration: '10:00' }, cashIn: [{ name: 'Row', meters: '500m' }] } }
    expect(metaWorkout(w)).toContain('2 blocchi')
  })

  it('non si schianta su un workout senza data né sezioni', () => {
    expect(metaWorkout({})).toBe('')
  })
})

describe('testoCercabile', () => {
  const w = hyrox([{ id: 1, type: 'Cash In', notes: 'a ritmo gara', exercises: [{ name: 'Wall Balls' }, { name: 'Burpees' }] }])

  it('trova il nome di un esercizio, non solo il titolo', () => {
    expect(testoCercabile({ ...w, title: 'Full Body' })).toContain('wall balls')
  })
  it('trova il tipo di blocco e le note', () => {
    const t = testoCercabile({ ...w, title: 'Full Body' })
    expect(t).toContain('cash in')
    expect(t).toContain('ritmo gara')
  })
  it('trova la corsia con il nome che l\'interfaccia mostra', () => {
    const libero = { sections: { category: 'Custom' }, title: 'X' }
    expect(testoCercabile(libero)).toContain('libero')
  })
  // 🔴 La vecchia riga di filtro faceva `w.title.toLowerCase()` nudo: un
  // titolo nullo — possibile sui workout anteriori al titolo automatico del
  // 24/08/2026 — si portava via la pagina intera.
  it('non lancia su un titolo assente', () => {
    expect(() => testoCercabile({ ...w, title: null })).not.toThrow()
  })
})

describe('ordinaPerData', () => {
  it('mette il più recente in cima, per DATA e non per creazione', () => {
    const ordinati = ordinaPerData([
      { id: 'vecchio', date: '2026-07-01', created_at: '2026-08-30' },
      { id: 'nuovo', date: '2026-08-20', created_at: '2026-08-01' },
    ])
    expect(ordinati.map(w => w.id)).toEqual(['nuovo', 'vecchio'])
  })

  it('a parità di data spareggia con created_at', () => {
    const ordinati = ordinaPerData([
      { id: 'a', date: '2026-08-20', created_at: '2026-08-01' },
      { id: 'b', date: '2026-08-20', created_at: '2026-08-02' },
    ])
    expect(ordinati.map(w => w.id)).toEqual(['b', 'a'])
  })

  it('i workout senza data valida finiscono in fondo, non in cima', () => {
    const ordinati = ordinaPerData([
      { id: 'senza', date: null, created_at: '2026-08-30' },
      { id: 'con', date: '2026-01-01', created_at: '2026-01-01' },
    ])
    expect(ordinati.map(w => w.id)).toEqual(['con', 'senza'])
  })

  it('non modifica l\'array ricevuto', () => {
    const originale = [{ id: 'a', date: '2026-07-01' }, { id: 'b', date: '2026-08-01' }]
    ordinaPerData(originale)
    expect(originale.map(w => w.id)).toEqual(['a', 'b'])
  })
})

describe('raggruppaPerMese', () => {
  // 🔴 Il difetto che questa funzione esiste per prevenire: con l'ordine di
  // CREAZIONE le date non sono monotone, e lo stesso mese ricompare in tre
  // punti diversi dello scroll.
  // ⚠️ L'ordine dell'ingresso è quello che arriva da Supabase: `created_at`
  // decrescente. Il workout di LUGLIO è quello creato per ultimo, quindi
  // arriva per primo — ed è l'unica disposizione che prende la mutazione. Con
  // l'elemento di agosto in testa la Map produce le chiavi giuste anche senza
  // ordinare, e il test passa mentre lo scroll è a rovescio (§9-sexies).
  it('ordina da sé: i mesi escono dal più recente anche se l\'ingresso è per creazione', () => {
    const gruppi = raggruppaPerMese([
      { id: 'lug', date: '2026-07-10', created_at: '2026-08-30' },
      { id: 'ago-2', date: '2026-08-02', created_at: '2026-08-20' },
      { id: 'ago-22', date: '2026-08-22', created_at: '2026-08-01' },
    ])
    expect(gruppi.map(g => g.chiave)).toEqual(['2026-08', '2026-07'])
    expect(gruppi[0].workouts.map(w => w.id)).toEqual(['ago-22', 'ago-2'])
  })

  it('scrive il mese in italiano con l\'iniziale maiuscola', () => {
    expect(raggruppaPerMese([{ id: 1, date: '2026-08-22' }])[0].etichetta).toBe('Agosto 2026')
  })

  it('raccoglie i workout senza data in un gruppo in fondo', () => {
    const gruppi = raggruppaPerMese([{ id: 1, date: null }, { id: 2, date: '2026-08-22' }])
    expect(gruppi.map(g => g.etichetta)).toEqual(['Agosto 2026', 'Senza data'])
  })
})

describe('conteggiPerCorsia', () => {
  it('conta per corsia e tiene l\'ordine dichiarato', () => {
    const c = conteggiPerCorsia([
      { sections: { category: 'Running' } },
      { sections: { category: 'Hyrox' } },
      { sections: { category: 'Hyrox' } },
    ])
    expect(c).toEqual([{ categoria: 'Hyrox', n: 2 }, { categoria: 'Running', n: 1 }])
  })

  // ⚠️ La query del coach esclude Custom ed Evento: un chip fisso sarebbe
  // sempre a zero, e premuto svuoterebbe la pagina.
  it('non produce una corsia che non ha workout dietro', () => {
    const c = conteggiPerCorsia([{ sections: { category: 'Hyrox' } }])
    expect(c.map(x => x.categoria)).toEqual(['Hyrox'])
  })

  it('riconosce i tre modi di dire Custom', () => {
    const c = conteggiPerCorsia([
      { sections: { category: 'Custom' } },
      { sections: { category: 'Autonomo' } },
      { sections: { isAutonomous: true } },
    ])
    expect(c).toEqual([{ categoria: 'Custom', n: 3 }])
  })
})
