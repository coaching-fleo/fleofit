import { describe, it, expect } from 'vitest'
import {
  settimaneAndamento, verdettoAndamento, totaliFinestra, prossimoPasso,
  costruisciRecap, recapMinimo, SETTIMANE_ANDAMENTO, SETTIMANE_VERDETTO, MINIMO_ANDAMENTO,
} from '../recapAllenamento'

// Martedì. Il lunedì di questa settimana è il 21.
const OGGI = new Date('2026-09-22T12:00:00')

/** Trenta minuti tondi, così i totali si leggono a occhio. */
const CORSA = (minuti = 30) => ({
  category: 'Running',
  steps: [{ id: 1, type: 'warmup', duration: `${minuti} min` }],
})

const HYROX = { category: 'Hyrox', intensity: '7', blocks: [{ id: 1, type: 'WarmUp', params: { duration: '10:00' }, exercises: [] }] }

let seq = 0
const riga = (data, stato = 'completed', { rpe = 7, sections = CORSA(), titolo = 'Seduta' } = {}) => ({
  id: `aw-${++seq}`,
  completed_date: data,
  status: stato,
  notes: stato === 'completed' && rpe != null ? `[RPE: ${rpe}/10]\n` : '',
  workouts: { id: `w-${seq}`, title: titolo, sections },
})

describe('settimaneAndamento', () => {
  it('raggruppa per settimana di CALENDARIO, che comincia di lunedì', () => {
    // Domenica 20 settembre: appartiene alla settimana aperta lunedì 14, non a
    // quella in corso. Con il default di date-fns (domenica) finirebbe nella
    // settimana di oggi, e la barra corrente direbbe il doppio del vero.
    const barre = settimaneAndamento([riga('2026-09-20'), riga('2026-09-22')], OGGI)
    const corrente = barre.at(-1)
    const precedente = barre.at(-2)
    expect(corrente.chiave).toBe('2026-09-21')
    expect(corrente.minuti).toBe(30)
    expect(precedente.minuti).toBe(30)
  })

  it('non conta gli assegnati non fatti', () => {
    const barre = settimaneAndamento([riga('2026-09-22', 'pending')], OGGI)
    expect(barre.at(-1).minuti).toBe(0)
    expect(barre.at(-1).sedute).toBe(0)
  })

  it('senza nessun dato le quote restano a zero invece di diventare NaN', () => {
    const barre = settimaneAndamento([], OGGI)
    expect(barre).toHaveLength(SETTIMANE_ANDAMENTO)
    expect(barre.every(b => b.quota === 0)).toBe(true)
  })

  it('la quota è relativa al massimo del periodo', () => {
    const barre = settimaneAndamento([
      riga('2026-09-22', 'completed', { sections: CORSA(60) }),
      riga('2026-09-15', 'completed', { sections: CORSA(30) }),
    ], OGGI)
    expect(barre.at(-1).quota).toBe(100)
    expect(barre.at(-2).quota).toBe(50)
  })
})

describe('verdettoAndamento', () => {
  /** `quante` settimane piene, tutte uguali tranne le ultime quattro chiuse. */
  const serie = (minutiVecchi, minutiRecenti, quante = SETTIMANE_VERDETTO) => {
    const righe = []
    // i = 0 è la settimana in corso; le chiuse sono da 1 in su.
    for (let i = 1; i < quante; i++) {
      const giorno = new Date(OGGI.getTime() - i * 7 * 86400000).toISOString().slice(0, 10)
      righe.push(riga(giorno, 'completed', { sections: CORSA(i <= 4 ? minutiRecenti : minutiVecchi) }))
    }
    return settimaneAndamento(righe, OGGI, quante)
  }

  it('resta muto sotto otto settimane CHIUSE — ed è il caso della serie disegnata', () => {
    // 🔴 Le barre del grafico sono otto, di cui una in corso: sette chiuse.
    // Se il verdetto leggesse quella serie non comparirebbe mai, e `null` è
    // anche la risposta giusta a un atleta nuovo — quindi nessuno se ne
    // accorgerebbe. È il difetto trovato guardando la schermata.
    expect(verdettoAndamento(serie(40, 80, SETTIMANE_ANDAMENTO))).toBeNull()
    expect(verdettoAndamento(serie(40, 80, SETTIMANE_VERDETTO))).not.toBeNull()
  })

  it('dichiara la crescita confrontando le quattro recenti con le quattro prima', () => {
    const v = verdettoAndamento(serie(40, 80))
    expect(v.testo).toBe('Volume in crescita')
    expect(v.delta).toBe(100)
  })

  it('dichiara il calo, e resta stabile dentro la soglia', () => {
    expect(verdettoAndamento(serie(80, 40)).testo).toBe('Volume in calo')
    expect(verdettoAndamento(serie(80, 82)).testo).toBe('Volume stabile')
  })

  it('la settimana IN CORSO non entra nel confronto', () => {
    // Una corrente enorme non deve poter dichiarare una crescita: è parziale
    // per definizione, e il lunedì mattina vale un settimo di sé stessa.
    const barre = serie(40, 40)
    const conCorrenteGonfia = barre.map(b => (b.corrente ? { ...b, minuti: 10000 } : b))
    expect(verdettoAndamento(conCorrenteGonfia).testo).toBe('Volume stabile')
  })
})

describe('totaliFinestra', () => {
  it('somma sedute e minuti dei soli completati nella finestra', () => {
    const t = totaliFinestra([
      riga('2026-09-22', 'completed', { sections: CORSA(60) }),
      riga('2026-09-20', 'completed', { sections: CORSA(60) }),
      riga('2026-09-21', 'pending'),
      riga('2026-01-01'),                                   // fuori finestra
    ], OGGI)
    expect(t.sedute).toBe(2)
    expect(t.minuti).toBe(120)
    expect(t.ore).toBe(2)
  })

  it("l'RPE medio torna null quando nessuno l'ha dichiarato, non 5", () => {
    // `parseNotesAndRpe` torna 5 dove il marcatore manca: quel 5 entrerebbe
    // nella media come se fosse una misura, e la schermata mostrerebbe «5,0»
    // a chi non ha mai segnato niente.
    const t = totaliFinestra([riga('2026-09-22', 'completed', { rpe: null })], OGGI)
    expect(t.rpeMedio).toBeNull()
    expect(t.sedute).toBe(1)
  })

  it("media solo gli RPE dichiarati davvero", () => {
    const t = totaliFinestra([
      riga('2026-09-22', 'completed', { rpe: 8 }),
      riga('2026-09-21', 'completed', { rpe: 6 }),
      riga('2026-09-20', 'completed', { rpe: null }),
    ], OGGI)
    expect(t.rpeMedio).toBe(7)
  })
})

describe('prossimoPasso', () => {
  it('sceglie il primo allenamento futuro, e la gara resta accanto', () => {
    const p = prossimoPasso([
      riga('2026-09-24', 'pending', { titolo: 'Soglia' }),
      riga('2026-09-28', 'pending', { titolo: 'Lungo' }),
      { ...riga('2026-10-10', 'pending', { titolo: 'Hyrox Milano' }), workouts: { id: 'g', title: 'Hyrox Milano', sections: { category: 'Event', isEvent: true } } },
    ], OGGI)
    expect(p.tipo).toBe('assegnato')
    expect(p.titolo).toBe('Soglia')
    expect(p.quando).toBe('Fra 2 giorni')
    expect(p.gara).toEqual({ titolo: 'Hyrox Milano', giorni: 18 })
  })

  it('una GARA non è il prossimo allenamento', () => {
    // Senza il filtro sulla corsia, l'unica cosa in calendario diventerebbe
    // «il tuo prossimo allenamento» — e una gara fra tre settimane non è una
    // seduta da aprire.
    const p = prossimoPasso([
      { ...riga('2026-10-10', 'pending'), workouts: { id: 'g', title: 'Hyrox Milano', sections: { category: 'Event', isEvent: true } } },
    ], OGGI)
    expect(p.tipo).toBe('evento')
    expect(p.gara.titolo).toBe('Hyrox Milano')
  })

  it('senza niente in programma ripiega sul libero, con la serie in mano', () => {
    const p = prossimoPasso([riga('2026-09-22'), riga('2026-09-21')], OGGI)
    expect(p.tipo).toBe('libero')
    expect(p.serie).toBe(2)
  })

  it('un assegnato GIÀ COMPLETATO non è il prossimo', () => {
    const p = prossimoPasso([riga('2026-09-24', 'completed')], OGGI)
    expect(p.tipo).toBe('libero')
  })

  it('su un allenamento libero non dichiara durata né blocchi', () => {
    // `durataWorkout` su un Custom torna il ripiego di 45 minuti: giusto per
    // una media, una bugia stampata in grande sotto il titolo.
    const p = prossimoPasso([
      { ...riga('2026-09-24', 'pending'), workouts: { id: 'c', title: 'Libero', sections: { category: 'Custom', isAutonomous: true } } },
    ], OGGI)
    expect(p.tipo).toBe('assegnato')
    expect(p.minuti).toBeNull()
    expect(p.blocchi).toBeNull()
  })
})

describe('costruisciRecap', () => {
  const chiuso = riga('2026-09-22', 'completed', { rpe: 8, sections: HYROX, titolo: 'EMOM 20' })
  const tipi = (r) => r.slide.map(s => s.tipo)

  it('con uno storico pieno sono quattro schede', () => {
    const storico = Array.from({ length: 6 }, (_, i) =>
      riga(`2026-09-${String(10 + i).padStart(2, '0')}`))
    const r = costruisciRecap({ aw: chiuso, storico: [...storico, chiuso], totaleCompletati: 20, oggi: OGGI })
    expect(tipi(r)).toEqual(['fatto', 'gradimento', 'settimana', 'andamento', 'prossimo'])
  })

  it('al PRIMO allenamento di sempre la settimana e l\'andamento lasciano il posto al benvenuto', () => {
    const r = costruisciRecap({ aw: chiuso, storico: [chiuso], totaleCompletati: 1, oggi: OGGI })
    expect(tipi(r)).toEqual(['fatto', 'gradimento', 'primo', 'prossimo'])
    // Nessuna cella mostra uno zero: al posto dell'andamento c'è la soglia che
    // lo accenderà.
    expect(r.slide.find(s => s.tipo === 'primo').soglia).toBe(MINIMO_ANDAMENTO)
  })

  it('sotto la soglia l\'andamento diventa la cella che dice quanto manca', () => {
    const storico = [riga('2026-09-20'), chiuso]
    const r = costruisciRecap({ aw: chiuso, storico, totaleCompletati: 2, oggi: OGGI })
    expect(tipi(r)).toEqual(['fatto', 'gradimento', 'settimana', 'inArrivo', 'prossimo'])
    expect(r.slide.find(s => s.tipo === 'inArrivo')).toMatchObject({ fatti: 2, soglia: MINIMO_ANDAMENTO })
  })

  it('chi rientra dopo mesi NON riceve il benvenuto del primo allenamento', () => {
    // 🔴 La finestra è di 90 giorni: chi si è fermato più a lungo ha UNA sola
    // seduta là dentro — quella appena chiusa — e contare le righe della
    // finestra gli annuncerebbe «il primo è fatto» dopo cinquanta allenamenti.
    // È lo stesso difetto di `recapMinimo`, da un'altra porta.
    const r = costruisciRecap({ aw: chiuso, storico: [chiuso], totaleCompletati: 50, oggi: OGGI })
    expect(tipi(r)).toEqual(['fatto', 'gradimento', 'settimana', 'andamento', 'prossimo'])
  })

  it('la settimana conta i giorni da LUNEDÌ, assegnati compresi', () => {
    const r = costruisciRecap({
      aw: chiuso,
      // Domenica 20: settimana precedente, non deve entrare nel conto.
      storico: [chiuso, riga('2026-09-20'), riga('2026-09-25', 'pending')],
      totaleCompletati: 9, oggi: OGGI,
    })
    const settimana = r.slide.find(s => s.tipo === 'settimana')
    expect(settimana.fatti).toBe(1)
    expect(settimana.totale).toBe(2)
    expect(settimana.giorni.map(g => g.lettera)).toEqual(['L', 'M', 'M', 'G', 'V', 'S', 'D'])
  })

  it('l\'ordinale è quello di SEMPRE, non quello della finestra', () => {
    // Lo storico caricato copre 90 giorni; «il tuo 4° allenamento» detto a chi
    // ne ha fatti 47 è un numero vero di un'altra domanda.
    const storico = [riga('2026-09-20'), riga('2026-09-18'), chiuso]
    const r = costruisciRecap({ aw: chiuso, storico, totaleCompletati: 47, oggi: OGGI })
    expect(r.slide[0].ordinale).toBe(47)
  })

  it('senza il totale l\'ordinale sparisce invece di dire quello della finestra', () => {
    const storico = [riga('2026-09-20'), riga('2026-09-18'), chiuso]
    const r = costruisciRecap({ aw: chiuso, storico, totaleCompletati: null, oggi: OGGI })
    expect(r.slide[0].ordinale).toBeNull()
  })

  it('la scheda «fatto» porta le celle della grafica da storia, RPE dichiarato compreso', () => {
    const r = costruisciRecap({ aw: chiuso, storico: [chiuso], totaleCompletati: 1, oggi: OGGI })
    const rpe = r.slide[0].celle.find(c => c.chiave === 'rpe')
    expect(rpe.valore).toBe('8')
    expect(r.slide[0].titolo).toBe('EMOM 20')
    expect(r.categoria).toBe('Hyrox')
  })

  it("senza RPE dichiarato la cella NON ripiega su 5: passa all'intensità del coach", () => {
    const senzaRpe = riga('2026-09-22', 'completed', { rpe: null, sections: HYROX })
    const r = costruisciRecap({ aw: senzaRpe, storico: [senzaRpe], totaleCompletati: 1, oggi: OGGI })
    expect(r.slide[0].celle.find(c => c.chiave === 'rpe')).toBeUndefined()
    expect(r.slide[0].celle.find(c => c.chiave === 'intensita').valore).toBe('7')
  })

  it('la scheda «prossimo» porta la forma senza sovrascrivere il proprio tipo', () => {
    // `tipo` è la chiave con cui la UI sceglie il componente: scriverci dentro
    // 'assegnato' farebbe cercare una scheda che non esiste, e il recap
    // finirebbe con una pagina vuota — senza nessun errore.
    const r = costruisciRecap({ aw: chiuso, storico: [chiuso, riga('2026-09-24', 'pending')], totaleCompletati: 1, oggi: OGGI })
    const ultima = r.slide.at(-1)
    expect(ultima.tipo).toBe('prossimo')
    expect(ultima.forma).toBe('assegnato')
  })
})

describe('recapMinimo', () => {
  it('tiene solo «fatto» e il gradimento, e NON annuncia il primo allenamento', () => {
    // 🔴 È la risposta a una lettura fallita. La strada comoda era chiamare
    // `costruisciRecap` con uno storico vuoto, e lì `quanti` vale zero: a un
    // atleta con cento allenamenti alle spalle il recap avrebbe annunciato
    // «il primo è fatto» — un guasto travestito da dato.
    const aw = riga('2026-09-22', 'completed', { rpe: 8, sections: HYROX })
    const r = recapMinimo({ aw, oggi: OGGI })
    // Il gradimento resta: non legge niente, e offline la risposta va in coda.
    expect(r.slide.map(s => s.tipo)).toEqual(['fatto', 'gradimento'])
    expect(r.slide[0].celle.length).toBeGreaterThan(0)
  })
})

describe('la scheda del gradimento', () => {
  it('sta subito dopo «fatto»', () => {
    const aw = { ...riga('2026-09-22', 'completed', { rpe: 8, sections: HYROX }), notes: '[RPE: 8/10]\n[GRADIMENTO: no]\nduro' }
    const r = costruisciRecap({ aw, storico: [aw], totaleCompletati: 1, oggi: OGGI })
    expect(r.slide[1]).toEqual({ tipo: 'gradimento' })
  })

  it('senza un id da aggiornare la domanda non si fa', () => {
    // Una risposta che non ha dove finire è una domanda finta.
    const aw = { ...riga('2026-09-22', 'completed', { rpe: 8, sections: HYROX }), id: undefined }
    const r = costruisciRecap({ aw, storico: [aw], totaleCompletati: 1, oggi: OGGI })
    expect(r.slide.map(s => s.tipo)).not.toContain('gradimento')
  })
})
