import { describe, it, expect } from 'vitest'
import { senzaStorico, minutiSettimana, scartoMinutiSettimana } from '../statistiche'

// Perché questi test esistono
// ────────────────────────────
// Sono le tre funzioni che decidono QUALE Home vede l'atleta il giorno in cui
// non ha ancora numeri (CLAUDE.md §9-duodetricies). Sbagliano tutte e tre in
// silenzio: `senzaStorico` troppo generosa manda la schermata di benvenuto a
// chi ha già un programma scritto dal coach; `minutiSettimana` su una finestra
// sbagliata produce uno scarto che non corrisponde al totale sopra di esso; e
// uno scarto che torna 0 invece di `null` stampa «sulla scorsa» su una
// settimana in cui l'atleta non esisteva. Nessuna delle tre dà un errore.
//
// ⚠️ Mercoledì 9 settembre 2026 come «oggi» in tutti i test: la settimana è
// lunedì 7 → domenica 13, la precedente lunedì 31 ago → domenica 6 set. Un
// mercoledì e non un lunedì di proposito — con la settimana in corso a metà si
// vedono sia i giorni trascorsi sia quelli ancora da venire.
const OGGI = new Date('2026-09-09T12:00:00')

/** Una riga di athlete_workouts con una durata dichiarata in minuti. */
const seduta = (data, minuti, stato = 'completed') => ({
  id: `aw-${data}-${minuti}`,
  completed_date: data,
  status: stato,
  workouts: { sections: { category: 'Hyrox', blocks: [{ type: 'AMRAP', params: { duration: `${minuti} min` } }] } },
})

const giorno = (workouts = []) => ({ workouts })

describe('senzaStorico — chi è davvero al giorno 1', () => {
  it('è vero solo quando non c\'è niente da nessuna delle tre parti', () => {
    expect(senzaStorico({ storico: [], weeklyStatus: [giorno(), giorno()], upcoming: [] })).toBe(true)
  })

  it('regge senza argomenti: al primo render lo stato non è ancora arrivato', () => {
    expect(senzaStorico()).toBe(true)
    expect(senzaStorico({})).toBe(true)
  })

  // 🔴 Il caso per cui la funzione guarda tutte e tre le fonti invece di
  // contare solo lo storico. Un atleta che il coach ha già programmato per la
  // settimana prossima NON è al giorno 1: mostrargli «il tuo coach sta
  // preparando la tua prima settimana» vorrebbe dire nascondergli la settimana
  // che è già pronta.
  it('è FALSO con un assegnato fuori dalla settimana in corso', () => {
    const fraDieciGiorni = [{ id: 'aw-1', completed_date: '2026-09-19', status: 'pending' }]
    expect(senzaStorico({ storico: [], weeklyStatus: [giorno(), giorno()], upcoming: fraDieciGiorni })).toBe(false)
  })

  it('è FALSO con un assegnato dentro la settimana, anche non completato', () => {
    const assegnato = { id: 'aw-2', status: 'pending', title: 'Hyrox' }
    expect(senzaStorico({ storico: [], weeklyStatus: [giorno(), giorno([assegnato])], upcoming: [] })).toBe(false)
  })

  it('è FALSO con qualcosa nello storico, anche vecchio', () => {
    expect(senzaStorico({ storico: [seduta('2026-08-01', 40)], weeklyStatus: [giorno()], upcoming: [] })).toBe(false)
  })
})

describe('minutiSettimana — la settimana di CALENDARIO, non sette giorni a ritroso', () => {
  it('somma i completati della settimana in corso', () => {
    const dati = [seduta('2026-09-07', 40), seduta('2026-09-09', 50)]
    expect(minutiSettimana(dati, OGGI)).toBe(90)
  })

  // 🔴 Il confine che una finestra mobile sbaglierebbe. Domenica 6 settembre è
  // «sette giorni fa o meno» rispetto a mercoledì 9, quindi una finestra mobile
  // la conterebbe dentro la settimana in corso — ma è la settimana PRECEDENTE,
  // e `weeklyStats.time`, che sta due card più su nella stessa schermata, non
  // la conta. Sono due totali diversi per la stessa etichetta, e nessuno dei
  // due è sbagliato preso da solo: è il difetto impossibile da notare
  // (CLAUDE.md §9-septdecies punto 4, la regola del LUNEDÌ).
  it('esclude la domenica precedente, che una finestra mobile includerebbe', () => {
    const dati = [seduta('2026-09-06', 60), seduta('2026-09-08', 30)]
    expect(minutiSettimana(dati, OGGI)).toBe(30)
  })

  it('include la domenica della settimana in corso, che è ancora nel futuro', () => {
    expect(minutiSettimana([seduta('2026-09-13', 25)], OGGI)).toBe(25)
  })

  // Un assegnato non fatto non è volume: contarlo direbbe all'atleta di aver
  // chiuso una settimana che non ha chiuso.
  it('NON conta i pending', () => {
    const dati = [seduta('2026-09-08', 40), seduta('2026-09-10', 90, 'pending')]
    expect(minutiSettimana(dati, OGGI)).toBe(40)
  })

  it('ignora le righe senza data invece di schiantarsi', () => {
    const rotta = { id: 'x', status: 'completed', completed_date: null }
    expect(minutiSettimana([rotta, seduta('2026-09-08', 20)], OGGI)).toBe(20)
  })

  it('con niente da contare torna 0, non NaN', () => {
    expect(minutiSettimana([], OGGI)).toBe(0)
  })
})

describe('scartoMinutiSettimana — quando c\'è qualcosa da confrontare', () => {
  it('è la differenza fra la settimana in corso e la precedente', () => {
    const dati = [seduta('2026-09-02', 60), seduta('2026-09-08', 100)]
    expect(scartoMinutiSettimana(dati, OGGI)).toBe(40)
  })

  it('è negativo quando la settimana in corso pesa meno', () => {
    const dati = [seduta('2026-09-02', 100), seduta('2026-09-08', 60)]
    expect(scartoMinutiSettimana(dati, OGGI)).toBe(-40)
  })

  // 🔴 Il caso che conta più di tutti. Con la settimana precedente vuota, la
  // differenza è aritmeticamente «+214 min», e la card la scriverebbe come un
  // progresso — su una settimana in cui l'atleta non esisteva. `null` è
  // l'unica risposta onesta, ed è la stessa lezione di `rpeAtteso` e di
  // `rpeDichiarato` (CLAUDE.md §9-octies).
  it('torna null, NON il totale, con la settimana precedente vuota', () => {
    expect(scartoMinutiSettimana([seduta('2026-09-08', 214)], OGGI)).toBeNull()
  })

  // ⚠️ Un pending la settimana scorsa non è «la settimana scorsa c'era
  // qualcosa»: è un allenamento saltato, e il confronto resta impossibile.
  it('torna null anche se la settimana precedente ha solo assegnati non fatti', () => {
    const dati = [seduta('2026-09-02', 60, 'pending'), seduta('2026-09-08', 90)]
    expect(scartoMinutiSettimana(dati, OGGI)).toBeNull()
  })

  it('torna 0 — e non null — quando le due settimane pesano uguale', () => {
    const dati = [seduta('2026-09-02', 45), seduta('2026-09-08', 45)]
    expect(scartoMinutiSettimana(dati, OGGI)).toBe(0)
  })
})
