import { describe, it, expect } from 'vitest'
import {
  settimanaDi, aderenzaSettimana, aderenzaDi, MASSIMO_TACCHE, NESSUNA_ADERENZA,
  etaDi, metaAtleta, nomeAtleta, iniziali, etichettaPausa,
  giorniRimastiCestino, conteggiStato, filtraPerNome,
} from '../rigaAtleta'

// Perché questi test esistono
// ────────────────────────────
// La rubrica ora dice un numero, e un numero si rompe restando verde. I casi
// presi qui sono quelli in cui la riga resterebbe **plausibile e sbagliata**:
//  · la settimana, che deve cominciare di lunedì anche quando la si chiede di
//    domenica — l'errore classico, che sposta l'intera colonna di un giorno;
//  · l'aderenza di chi non ha niente in programma, che NON è zero;
//  · le tacche, una per allenamento, che oltre una certa soglia sfondano la riga;
//  · la pausa, che porta una data di INIZIO e mai un rientro che nei dati non c'è.

// Mercoledì 26 agosto 2026. La settimana va da lun 24 a dom 30.
const MERCOLEDI = new Date('2026-08-26T10:00:00')
const DOMENICA = new Date('2026-08-30T23:00:00')

const ass = (athlete_id, completed_date, status = 'pending') =>
  ({ id: `${athlete_id}-${completed_date}`, athlete_id, completed_date, status })

describe('settimanaDi', () => {
  it('va da lunedì a domenica', () => {
    expect(settimanaDi(MERCOLEDI)).toEqual({ da: '2026-08-24', a: '2026-08-30' })
  })

  // 🔴 Il caso che prende la mutazione. Con `weekStartsOn` di default (domenica)
  // una domenica cade nella settimana SUCCESSIVA: l'atleta si vede azzerare la
  // frazione la sera della domenica, cioè l'unico momento in cui il piano della
  // settimana è finalmente completo.
  it('la domenica appartiene alla settimana che è cominciata il lunedì prima', () => {
    expect(settimanaDi(DOMENICA)).toEqual({ da: '2026-08-24', a: '2026-08-30' })
  })

  it('il lunedì è il primo giorno della sua settimana, non l\'ultimo della precedente', () => {
    expect(settimanaDi(new Date('2026-08-31T08:00:00')).da).toBe('2026-08-31')
  })
})

describe('aderenzaSettimana', () => {
  it('conta assegnati e completati della settimana in corso', () => {
    const m = aderenzaSettimana([
      ass('a', '2026-08-24', 'completed'),
      ass('a', '2026-08-26', 'completed'),
      ass('a', '2026-08-28'),
    ], { oggi: MERCOLEDI })
    expect(m.get('a')).toMatchObject({ assegnati: 3, completati: 2 })
  })

  // ⚠️ È la conseguenza da conoscere prima di dirla un bug: il martedì, il
  // workout di venerdì è già programmato e fa parte del piano della settimana.
  it('gli assegnati comprendono i giorni ancora da venire', () => {
    const m = aderenzaSettimana([ass('a', '2026-08-30')], { oggi: MERCOLEDI })
    expect(m.get('a').assegnati).toBe(1)
  })

  it('quello che sta fuori dalla settimana non entra', () => {
    const m = aderenzaSettimana([
      ass('a', '2026-08-23', 'completed'),   // domenica prima
      ass('a', '2026-08-31', 'completed'),   // lunedì dopo
    ], { oggi: MERCOLEDI })
    expect(m.has('a')).toBe(false)
  })

  it('righe senza atleta o senza data non sporcano la mappa', () => {
    const m = aderenzaSettimana([
      { id: 'x', athlete_id: null, completed_date: '2026-08-26' },
      { id: 'y', athlete_id: 'a', completed_date: null },
      null,
    ], { oggi: MERCOLEDI })
    expect(m.size).toBe(0)
  })

  it('tiene gli atleti separati', () => {
    const m = aderenzaSettimana([
      ass('a', '2026-08-24', 'completed'),
      ass('b', '2026-08-24'),
    ], { oggi: MERCOLEDI })
    expect(m.get('a').completati).toBe(1)
    expect(m.get('b').completati).toBe(0)
  })
})

describe('aderenzaDi', () => {
  // 🔴 Il caso che conta di più. Un atleta senza assegnazioni non è a zero di
  // aderenza: non c'è ancora niente da misurare. «0/0» con la barra vuota si
  // legge come un fallimento, ed è la stessa lezione di `DurataBlocco` («—»
  // invece di «0:00») e di `rpeAtteso` (null invece di 5).
  it('senza assegnati non dichiara una quota', () => {
    expect(aderenzaDi(0, 0)).toEqual(NESSUNA_ADERENZA)
    expect(aderenzaDi(0, 0).quota).toBeNull()
  })

  it('una tacca per assegnato, piene quante i completati', () => {
    expect(aderenzaDi(5, 3).tacche).toEqual([true, true, true, false, false])
  })

  it('tutte piene quando il piano è chiuso', () => {
    const a = aderenzaDi(4, 4)
    expect(a.tacche).toEqual([true, true, true, true])
    expect(a.quota).toBe(1)
  })

  // Un completato in più degli assegnati non è un dato, è un conteggio andato
  // storto: si tronca invece di disegnare sei tacche piene su cinque.
  it('non disegna più tacche piene degli assegnati', () => {
    const a = aderenzaDi(3, 7)
    expect(a.completati).toBe(3)
    expect(a.tacche).toEqual([true, true, true])
  })

  it('oltre la soglia passa alla barra proporzionale invece che alle tacche', () => {
    const a = aderenzaDi(MASSIMO_TACCHE + 1, 4)
    expect(a.compresso).toBe(true)
    expect(a.tacche).toEqual([])
    expect(a.quota).toBeCloseTo(4 / (MASSIMO_TACCHE + 1))
  })

  it('alla soglia esatta le tacche ci sono ancora', () => {
    const a = aderenzaDi(MASSIMO_TACCHE, 1)
    expect(a.compresso).toBe(false)
    expect(a.tacche).toHaveLength(MASSIMO_TACCHE)
  })
})

describe('etaDi e metaAtleta', () => {
  it('gli anni compiuti', () => {
    expect(etaDi('1995-01-10', MERCOLEDI)).toBe(31)
  })

  it('una data illeggibile o assente non diventa NaN', () => {
    expect(etaDi(null, MERCOLEDI)).toBeNull()
    expect(etaDi('non-una-data', MERCOLEDI)).toBeNull()
  })

  // Una data di nascita nel futuro darebbe «-2a» in pagina: un dato palesemente
  // rotto stampato come se fosse vero.
  it('una data nel futuro non produce un\'età negativa', () => {
    expect(etaDi('2030-01-01', MERCOLEDI)).toBeNull()
  })

  it('compone il meta con quello che c\'è', () => {
    expect(metaAtleta({ weight: 78, height: 182, birth_date: '1995-01-10' }, MERCOLEDI))
      .toBe('78kg · 182cm · 31a')
  })

  // I campi vuoti spariscono invece di stampare «N/A»: una cella che dice «non
  // lo so» occupa lo stesso spazio di una che dice qualcosa.
  it('i campi mancanti spariscono, non diventano N/A', () => {
    expect(metaAtleta({ weight: 78 }, MERCOLEDI)).toBe('78kg')
    expect(metaAtleta({}, MERCOLEDI)).toBe('')
  })
})

describe('nomeAtleta e iniziali', () => {
  it('il nome composto, con ripiego', () => {
    expect(nomeAtleta({ name: 'Marco', surname: 'Rossi' })).toBe('Marco Rossi')
    expect(nomeAtleta({ name: 'Marco' })).toBe('Marco')
    expect(nomeAtleta({})).toBe('Atleta')
  })

  it('le iniziali in maiuscolo', () => {
    expect(iniziali({ name: 'andrea', surname: 'bianchi' })).toBe('AB')
    expect(iniziali({ name: 'Giulia' })).toBe('G')
  })

  // Senza ripiego l'avatar resterebbe un cerchio vuoto, che è esattamente il
  // problema che le iniziali esistono per risolvere.
  it('senza nome ripiega su un segnaposto', () => {
    expect(iniziali({})).toBe('?')
    expect(iniziali(null)).toBe('?')
  })
})

describe('etichettaPausa', () => {
  it('dice da quando', () => {
    expect(etichettaPausa({ notes: '[PAUSA: 2026-08-27]\nCi sentiamo a settembre' }))
      .toBe('In pausa dal 27 ago')
  })

  // 🔴 `null`, non «In pausa»: la pillola accanto alla riga dice già «Pausa»,
  // e una seconda riga che la ripete occupa lo spazio senza aggiungere niente.
  it('senza data non aggiunge una riga che ripete la pillola', () => {
    expect(etichettaPausa({ notes: '[PAUSA]\ntesto' })).toBeNull()
    // 2026-13-45 supera il marcatore (che vuole solo delle cifre) ma non è un
    // giorno: senza il controllo si stamperebbe «In pausa dal Invalid Date».
    expect(etichettaPausa({ notes: '[PAUSA: 2026-13-45]' })).toBeNull()
  })

  // 🔴 Il marcatore non deve MAI comparire come testo: quella nota la legge
  // anche l'atleta (CLAUDE.md §4).
  it('non mostra mai il marcatore grezzo', () => {
    expect(etichettaPausa({ notes: '[PAUSA: 2026-08-27]\ntesto' })).not.toContain('[PAUSA')
  })

  // Non esiste da nessuna parte nei dati una data di RIENTRO: `[PAUSA: …]`
  // registra il giorno in cui la pausa è cominciata. Stamparne una sarebbe un
  // numero plausibile e inventato.
  it('non promette un rientro', () => {
    expect(etichettaPausa({ notes: '[PAUSA: 2026-08-27]' })).not.toMatch(/rientro/i)
  })
})

describe('giorniRimastiCestino', () => {
  const adesso = new Date('2026-08-26T10:00:00').getTime()
  const giorniFa = (n) => adesso - n * 86400000

  it('conta i giorni che restano', () => {
    expect(giorniRimastiCestino(giorniFa(2), adesso)).toBe(5)
  })

  it('non scende sotto zero', () => {
    expect(giorniRimastiCestino(giorniFa(30), adesso)).toBe(0)
  })

  it('un valore illeggibile non produce NaN in pagina', () => {
    expect(giorniRimastiCestino('boh', adesso)).toBe(7)
  })
})

describe('conteggiStato', () => {
  // 🔴 Chi è in pausa NON conta fra gli attivi: il chip direbbe un numero, e il
  // conteggio della sezione sotto ne direbbe un altro.
  it('gli in pausa escono dagli attivi', () => {
    const c = conteggiStato([
      { id: '1', notes: '' },
      { id: '2', notes: '[PAUSA: 2026-08-01]\n' },
      { id: '3', notes: null },
    ], [{ id: '9' }])
    expect(c).toEqual({ attivi: 2, pausa: 1, eliminati: 1 })
  })
})

describe('filtraPerNome', () => {
  const lista = [
    { name: 'Marco', surname: 'Rossi' },
    { name: 'Chiara', surname: 'Donati' },
  ]

  it('trova per nome o per cognome', () => {
    expect(filtraPerNome(lista, 'ross')).toHaveLength(1)
    expect(filtraPerNome(lista, 'chiara')).toHaveLength(1)
  })

  // 🔴 La rubrica è ordinata per NOME, quindi il coach scrive tanto «rossi
  // marco» quanto «marco rossi». Un `includes` sull'intera frase trova solo il
  // secondo, e restituisce una lista vuota che si legge come «non c'è».
  it('trova anche con le parole invertite', () => {
    expect(filtraPerNome(lista, 'rossi marco')).toHaveLength(1)
  })

  it('senza termine torna tutto', () => {
    expect(filtraPerNome(lista, '   ')).toHaveLength(2)
  })
})
