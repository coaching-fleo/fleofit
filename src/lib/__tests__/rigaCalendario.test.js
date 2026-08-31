import { describe, it, expect } from 'vitest'
import {
  MASSIMO_SEGMENTI, griglia, indicizzaPerGiorno, chiaveGiorno, segnoGiorno,
  minutiWorkout, riepilogoMese, formattaVolume, riepilogoGiorno,
  etichettaSessione, etichettaGiorno, etichettaMese, eMeseCorrente,
} from '../rigaCalendario'

const EMOM = {
  id: 1, type: 'EMOM', params: { interval: '1:00', rounds: '20' },
  exercises: [{ name: 'Wall Balls', reps: '15', intensity: '8' }],
}

const hyrox = (date, extra = {}) => ({
  id: date, title: 'Full Body', date,
  sections: { category: 'Hyrox', blocks: [EMOM] }, ...extra,
})
const corsa = (date, steps, extra = {}) => ({
  id: date, title: 'Lungo', date, sections: { category: 'Running', steps }, ...extra,
})
const gara = (date, title = 'Hyrox Milano') => ({
  id: date, title, date, sections: { category: 'Event', isEvent: true, isAutonomous: true },
})
const libero = (date) => ({
  id: date, title: 'Libero', date, sections: { category: 'Custom', isAutonomous: true },
})

describe('griglia', () => {
  // 🔴 La settimana comincia di LUNEDÌ. Agosto 2026 comincia di SABATO, che con
  // `getDay()` vale 6: il conto ingenuo darebbe 6 celle vuote ed è giusto per
  // caso. Il caso che prende l'errore è un mese che comincia di DOMENICA —
  // `getDay()` torna 0, e senza la correzione la domenica finirebbe nella
  // colonna del lunedì, cioè tutta la griglia scalata di un giorno.
  it('mette la domenica in fondo alla settimana, non in testa', () => {
    // 1° novembre 2026 è una domenica.
    expect(griglia(new Date(2026, 10, 1)).vuote).toBe(6)
  })

  it('conta le celle vuote di un mese che comincia di sabato', () => {
    expect(griglia(new Date(2026, 7, 1)).vuote).toBe(5)
  })

  it('elenca tutti i giorni del mese, e solo quelli', () => {
    const g = griglia(new Date(2026, 7, 15))
    expect(g.giorni).toHaveLength(31)
    expect(chiaveGiorno(g.giorni[0])).toBe('2026-08-01')
    expect(chiaveGiorno(g.giorni.at(-1))).toBe('2026-08-31')
  })
})

describe('indicizzaPerGiorno', () => {
  it('raggruppa più allenamenti sullo stesso giorno', () => {
    const per = indicizzaPerGiorno([hyrox('2026-08-22'), corsa('2026-08-22', []), hyrox('2026-08-23')])
    expect(per.get('2026-08-22')).toHaveLength(2)
    expect(per.get('2026-08-23')).toHaveLength(1)
  })

  it('scarta le date assenti o illeggibili invece di inventare un giorno', () => {
    const per = indicizzaPerGiorno([hyrox('2026-08-22'), { id: 'x', date: null }, { id: 'y', date: 'boh' }])
    expect(per.size).toBe(1)
  })
})

describe('segnoGiorno', () => {
  it('porta la categoria e lo stato di ogni allenamento, non un colore', () => {
    const s = segnoGiorno([hyrox('2026-08-22', { status: 'completed' }), corsa('2026-08-22', [])])
    expect(s.segmenti).toEqual([
      { categoria: 'Hyrox', fatto: true },
      { categoria: 'Running', fatto: false },
    ])
  })

  // ⚠️ Il tetto esiste perché tre segmenti in una cella da 43px sono già
  // schegge, ma `n` deve restare il numero VERO: è quello che finisce
  // nell'aria-label, e senza un giorno da cinque e uno da tre sarebbero
  // indistinguibili anche per chi la barra non la vede.
  it('taglia i segmenti disegnati ma NON il conteggio', () => {
    const cinque = Array.from({ length: 5 }, () => hyrox('2026-08-22'))
    const s = segnoGiorno(cinque)
    expect(s.segmenti).toHaveLength(MASSIMO_SEGMENTI)
    expect(s.n).toBe(5)
  })

  // 🔴 Il caso che prende la logica sbagliata: `some` invece di `every`. Con
  // una sessione su due chiusa il giorno NON è andato, e tingerlo di verde
  // direbbe il contrario.
  it('il giorno è chiuso solo se lo sono TUTTE le sessioni', () => {
    const mista = [hyrox('2026-08-22', { status: 'completed' }), corsa('2026-08-22', [])]
    expect(segnoGiorno(mista).tuttiFatti).toBe(false)
    const tutte = [hyrox('2026-08-22', { status: 'completed' }), corsa('2026-08-22', [], { status: 'completed' })]
    expect(segnoGiorno(tutte).tuttiFatti).toBe(true)
  })

  it('un giorno vuoto non è un giorno chiuso', () => {
    expect(segnoGiorno([]).tuttiFatti).toBe(false)
    expect(segnoGiorno([]).segmenti).toEqual([])
  })
})

describe('minutiWorkout', () => {
  it('stima i minuti di un Hyrox dai suoi blocchi', () => {
    expect(minutiWorkout(hyrox('2026-08-22'))).toBe(20)
  })

  it('legge i minuti di una corsa a tempo', () => {
    expect(minutiWorkout(corsa('2026-08-22', [
      { type: 'warmup', duration: '10 min' }, { type: 'run', duration: '50 min' },
    ]))).toBe(60)
  })

  // 🔴 Il caso peggiore, ed è il motivo per cui questa funzione torna `null` e
  // non un numero. «18 km» non ha minuti finché non si assume un passo, e
  // assumerlo qui vorrebbe dire inventarlo. Se tornasse 0, il volume del mese
  // conterebbe quella corsa come un'ora di niente senza dirlo a nessuno.
  it('torna null su una corsa misurata in DISTANZA, non zero', () => {
    expect(minutiWorkout(corsa('2026-08-22', [{ type: 'run', duration: '18 km' }]))).toBe(null)
  })

  it('torna null su Custom ed Evento, che non hanno blocchi da stimare', () => {
    expect(minutiWorkout(libero('2026-08-22'))).toBe(null)
    expect(minutiWorkout(gara('2026-08-22'))).toBe(null)
  })

  it('torna null su un Hyrox senza blocchi', () => {
    expect(minutiWorkout({ date: '2026-08-22', sections: { category: 'Hyrox', blocks: [] } })).toBe(null)
  })
})

describe('riepilogoMese', () => {
  const mese = [
    hyrox('2026-08-03', { status: 'completed' }),
    hyrox('2026-08-05', { status: 'completed' }),
    hyrox('2026-08-07', { status: 'pending' }),
    gara('2026-08-15'),
  ]

  // 🔴 Il test che conta di più. `soloCompletati` tiene le prime due celle
  // sullo STESSO orizzonte: le ore devono essere quelle dei DUE completati, non
  // quelle dei tre allenamenti. Con la stessa etichetta sopra, due orizzonti
  // diversi sarebbero la bugia peggiore della fascia — e nessuno dei due
  // numeri sarebbe sbagliato preso da solo.
  it('con soloCompletati misura le ore dei completati, non di tutti', () => {
    const r = riepilogoMese(mese, { soloCompletati: true })
    expect(r.completati).toBe(2)
    expect(r.totale).toBe(4)
    expect(r.minuti).toBe(40)
  })

  it('senza soloCompletati misura tutto il programmato', () => {
    const r = riepilogoMese(mese, { soloCompletati: false })
    expect(r.minuti).toBe(60)
  })

  // ⚠️ La gara è dentro `totale` ma NON dentro le ore: `minutiWorkout` la dà
  // per non stimabile, e `ignote` è ciò che permette al chiamante di dire che
  // la somma è parziale invece di spacciarla per completa.
  it('dichiara quante sessioni la somma ha dovuto lasciare fuori', () => {
    const r = riepilogoMese(mese, { soloCompletati: false })
    expect(r.ignote).toBe(1)
    expect(r.misurate).toBe(3)
  })

  it('trova la prima gara del mese e la scrive in forma corta', () => {
    const r = riepilogoMese([gara('2026-08-28'), gara('2026-08-15')])
    expect(r.gara.giorno).toBe('15 ago')
    expect(r.gara.n).toBe(2)
  })

  it('torna null sulla gara quando il mese non ne ha', () => {
    expect(riepilogoMese([hyrox('2026-08-03')]).gara).toBe(null)
  })

  it('regge un mese vuoto', () => {
    const r = riepilogoMese([])
    expect(r).toMatchObject({ totale: 0, completati: 0, minuti: 0, gara: null })
  })
})

describe('formattaVolume', () => {
  it('scrive i minuti sotto l\'ora e le ore sopra', () => {
    expect(formattaVolume(48, 0, 2)).toMatchObject({ valore: '48', unita: '′' })
    expect(formattaVolume(150, 0, 3)).toMatchObject({ valore: '2,5', unita: ' h' })
    expect(formattaVolume(660, 0, 12)).toMatchObject({ valore: '11', unita: ' h' })
  })

  // 🔴 Il `≈` è l'unico modo di dire «questo totale è parziale» in una cella
  // larga quanto un numero. Senza, una corsa da 18 km e quattro allenamenti
  // liberi spariscono dentro un «11 h» che ha tutta l'aria di essere completo.
  it('premette ≈ quando qualcosa è rimasto fuori dalla somma', () => {
    expect(formattaVolume(660, 3, 12).valore).toBe('≈11')
    expect(formattaVolume(660, 3, 12).parziale).toBe(true)
    expect(formattaVolume(660, 0, 12).parziale).toBe(false)
  })

  // ⚠️ «0 h» sarebbe una bugia con l'aria di un dato: la stessa regola di
  // DurataBlocco, che scrive «—» invece di «0:00».
  it('scrive — quando non c\'è niente di misurabile, non «0 h»', () => {
    expect(formattaVolume(0, 4, 0).valore).toBe('—')
    expect(formattaVolume(0, 0, 3).valore).toBe('—')
  })
})

describe('riepilogoGiorno', () => {
  it('dice quante sessioni e quanti minuti', () => {
    expect(riepilogoGiorno([hyrox('2026-08-22'), hyrox('2026-08-22')])).toBe('2 sessioni · 40′')
  })

  it('usa il singolare su una sessione sola', () => {
    expect(riepilogoGiorno([hyrox('2026-08-22')])).toBe('1 sessione · 20′')
  })

  it('segna il totale come parziale quando una sessione non è stimabile', () => {
    expect(riepilogoGiorno([hyrox('2026-08-22'), gara('2026-08-22')])).toBe('2 sessioni · ≈20′')
  })

  it('non dichiara nessun minuto quando niente è stimabile', () => {
    expect(riepilogoGiorno([gara('2026-08-22')])).toBe('1 sessione')
  })

  it('torna la stringa vuota su un giorno senza niente', () => {
    expect(riepilogoGiorno([])).toBe('')
  })
})

describe('etichettaSessione', () => {
  // Per un Hyrox è il blocco che porta il lavoro: è quello che distingue una
  // seduta dall'altra dentro la stessa corsia.
  it('su un Hyrox nomina il blocco di lavoro', () => {
    expect(etichettaSessione(hyrox('2026-08-22'))).toBe('EMOM')
  })

  it('su un Hyrox di solo riscaldamento ricade sulla corsia', () => {
    const w = { sections: { category: 'Hyrox', blocks: [{ type: 'WarmUp', params: {} }] } }
    expect(etichettaSessione(w)).toBe('Hyrox')
  })

  // ⚠️ Sulle altre corsie il nome della corsia È la risposta: ripeterlo due
  // volte non aggiunge niente, e «Running» accanto a «Running» toglie posto al
  // titolo.
  it('sulle altre corsie usa l\'etichetta della corsia', () => {
    expect(etichettaSessione(corsa('2026-08-22', []))).toBe('Running')
    expect(etichettaSessione(libero('2026-08-22'))).toBe('Libero')
    expect(etichettaSessione(gara('2026-08-22'))).toBe('Gara')
  })

  it('riconosce il formato legacy, dove il blocco sta in sections.main', () => {
    const w = { sections: { category: 'Hyrox', main: { type: 'AMRAP', params: { duration: '12:00' } } } }
    expect(etichettaSessione(w)).toBe('AMRAP')
  })
})

describe('le etichette di data', () => {
  it('scrive il giorno per esteso con l\'iniziale maiuscola', () => {
    expect(etichettaGiorno(new Date(2026, 7, 22))).toBe('Sabato 22 agosto')
  })

  it('scrive il mese con l\'iniziale maiuscola', () => {
    expect(etichettaMese(new Date(2026, 7, 1))).toBe('Agosto')
  })

  it('sa se il mese mostrato è quello corrente', () => {
    const adesso = new Date(2026, 7, 22)
    expect(eMeseCorrente(new Date(2026, 7, 1), adesso)).toBe(true)
    expect(eMeseCorrente(new Date(2026, 8, 1), adesso)).toBe(false)
    // Stesso mese, anno diverso: non è «il mese corrente».
    expect(eMeseCorrente(new Date(2025, 7, 1), adesso)).toBe(false)
  })
})
