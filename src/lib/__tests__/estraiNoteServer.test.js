import { describe, it, expect } from 'vitest'
import { testoNota } from '../rpe'
import {
  VERSIONE, GRUPPO, MAX_GRUPPI, FATTORI, MISURE, DIFFICOLTA, TIPI_MODIFICA,
  testoPulito, impronta, eserciziDelWorkout, valoreDaGrezzo, validaEstrazione,
  daEstrarre, daCancellare, richiestaGroq, rispostaDaGroq,
} from '../../../supabase/functions/estrai-note/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// `estrai-note` manda le note degli atleti all'IA e salva quello che torna.
// L'IA non è una fonte: inventa citazioni, sbaglia i conti, mette nomi di
// esercizi che nel workout non ci sono. Tutto ciò che finisce nei grafici del
// coach passa quindi da `validaEstrazione`, ed è qui che si decide cosa è un
// dato e cosa no. Le due regole che contano più delle altre:
//  1. ogni voce ha una citazione che sta DAVVERO nella nota;
//  2. il numero lo calcola la funzione da come l'atleta l'ha scritto, mai l'IA.
// Più una terza, di privacy: all'IA non arriva niente che identifichi l'atleta.

const NOTA = 'Wall balls 9kg finite in 6:40, gambe distrutte. Burpees saltati.'
const ESERCIZI = ['Wall Balls', 'Burpees']
const VUOTA = { stato: [], risultati: [], sensazioni: { difficolta: null, citazione: null, modifiche: [] } }

describe('le liste dello standard v1', () => {
  it('niente categorie sanitarie fra i fattori', () => {
    expect(VERSIONE).toBe(1)
    expect(FATTORI).toEqual(['stanchezza', 'motivazione', 'viaggio', 'lavoro'])
    expect(MISURE).toEqual(['tempo', 'kg', 'reps', 'round', 'distanza', 'passo'])
    expect(DIFFICOLTA).toEqual(['troppo_facile', 'giusta', 'troppo_dura'])
    expect(TIPI_MODIFICA).toEqual(['saltato', 'ridotto', 'sostituito', 'aggiunto'])
    expect(GRUPPO).toBe(15)
    expect(MAX_GRUPPI).toBe(3)
  })
})

describe('testoPulito', () => {
  it('una nota con solo RPE e gradimento è vuota', () => {
    expect(testoPulito('[RPE: 7/10]\n[GRADIMENTO: si]')).toBe('')
  })
  it('è la stessa regola del telefono (testoNota)', () => {
    for (const n of ['[RPE: 8/10]\nwall balls in 6:40', 'solo testo', null, '[RPE: 3/10]\n[GRADIMENTO: no]\nfacile', '  spazi  '])
      expect(testoPulito(n)).toBe(testoNota(n))
  })
})

describe('impronta', () => {
  it('stabile sullo stesso testo, diversa su un testo diverso, 8 cifre esadecimali', () => {
    expect(impronta('abc')).toBe(impronta('abc'))
    expect(impronta('abc')).not.toBe(impronta('abd'))
    expect(impronta('abc')).toMatch(/^[0-9a-f]{8}$/)
    expect(impronta('')).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('eserciziDelWorkout', () => {
  it('Hyrox: nomi unici da tutti i blocchi', () => {
    const sections = { category: 'Hyrox', blocks: [
      { exercises: [{ name: 'Wall Balls' }, { name: 'Row' }] },
      { exercises: [{ name: 'Wall Balls' }, { name: '' }] },
    ] }
    expect(eserciziDelWorkout(sections)).toEqual(['Wall Balls', 'Row'])
  })
  it('formato legacy', () => {
    expect(eserciziDelWorkout({ main: [{ exercises: [{ name: 'Row' }] }] })).toEqual(['Row'])
  })
  it('Running è una corsa sola', () => {
    expect(eserciziDelWorkout({ category: 'Running', steps: [{ type: 'run' }] })).toEqual(['Corsa'])
  })
  it('niente sezioni, niente esercizi', () => {
    expect(eserciziDelWorkout(null)).toEqual([])
  })
})

describe('valoreDaGrezzo', () => {
  it.each([
    ['tempo', '6:40', 400, 's'],
    ['tempo', '1:02:30', 3750, 's'],
    ['tempo', '45 sec', 45, 's'],
    ['tempo', '45s', 45, 's'],
    ['tempo', '6 min', 360, 's'],
    ['kg', '9,5kg', 9.5, 'kg'],
    ['kg', '9 kg', 9, 'kg'],
    ['distanza', '1,2 km', 1200, 'm'],
    ['distanza', '5k', 5000, 'm'],
    ['distanza', '400m', 400, 'm'],
    ['passo', '4:55/km', 295, 's/km'],
    ['passo', `4'55"`, 295, 's/km'],
    ['reps', '15', 15, 'reps'],
    ['round', '5 round', 5, 'round'],
  ])('%s «%s» → %s %s', (misura, grezzo, valore, unita) => {
    expect(valoreDaGrezzo(misura, grezzo)).toEqual({ valore, unita })
  })
  it('niente numeri inventati', () => {
    expect(valoreDaGrezzo('tempo', 'circa sei minuti')).toBeNull()
    expect(valoreDaGrezzo('kg', '')).toBeNull()
    expect(valoreDaGrezzo('altezza', '12')).toBeNull()
    expect(valoreDaGrezzo('tempo', '6:99')).toBeNull()
  })
})

describe('validaEstrazione', () => {
  const ris = (extra) => ({ esercizio: 'wall balls', misura: 'tempo', grezzo: '6:40', citazione: 'Wall balls 9kg finite in 6:40', ...extra })
  const valida = (grezza) => validaEstrazione(grezza, NOTA, ESERCIZI)

  it('un risultato vero: nome canonico e valore calcolato dalla funzione', () => {
    const e = valida({ risultati: [ris({ valore: 999 })] })
    expect(e.risultati).toEqual([{ esercizio: 'Wall Balls', misura: 'tempo', grezzo: '6:40', valore: 400, unita: 's', citazione: 'Wall balls 9kg finite in 6:40' }])
  })
  it('citazione che non sta nella nota → scartata', () => {
    expect(valida({ risultati: [ris({ citazione: 'wall balls in 5:00' })] }).risultati).toEqual([])
  })
  it('grezzo che non sta nella citazione → scartato', () => {
    expect(valida({ risultati: [ris({ grezzo: '5:00' })] }).risultati).toEqual([])
  })
  it('esercizio fuori dal workout → tenuto senza esercizio', () => {
    expect(valida({ risultati: [ris({ esercizio: 'Thruster' })] }).risultati[0].esercizio).toBeNull()
  })
  it('stato: fattore sanitario scartato, maiuscole e spazi doppi tollerati', () => {
    const e = valida({ stato: [
      { fattore: 'sonno', segno: -1, citazione: 'gambe distrutte' },
      { fattore: 'stanchezza', segno: -1, citazione: 'GAMBE  distrutte' },
      { fattore: 'stanchezza', segno: 2, citazione: 'gambe distrutte' },
    ] })
    expect(e.stato).toEqual([{ fattore: 'stanchezza', segno: -1, citazione: 'GAMBE  distrutte' }])
  })
  it('modifica con nome canonico', () => {
    const e = valida({ sensazioni: { modifiche: [{ tipo: 'saltato', esercizio: 'burpees', citazione: 'Burpees saltati' }] } })
    expect(e.sensazioni.modifiche).toEqual([{ tipo: 'saltato', esercizio: 'Burpees', citazione: 'Burpees saltati' }])
  })
  it('difficoltà senza citazione vera → null', () => {
    expect(valida({ sensazioni: { difficolta: 'troppo_dura', citazione: 'durissima' } }).sensazioni)
      .toEqual({ difficolta: null, citazione: null, modifiche: [] })
  })
  it('difficoltà con citazione vera → tenuta', () => {
    expect(valida({ sensazioni: { difficolta: 'troppo_dura', citazione: 'gambe distrutte' } }).sensazioni.difficolta).toBe('troppo_dura')
  })
  it('citazioni troppo corte non valgono', () => {
    expect(valida({ stato: [{ fattore: 'stanchezza', segno: -1, citazione: 'in' }] }).stato).toEqual([])
  })
  it('una risposta che non è un oggetto → estrazione vuota', () => {
    expect(valida(null)).toEqual(VUOTA)
    expect(valida('x')).toEqual(VUOTA)
  })
})

describe('daEstrarre e daCancellare', () => {
  const riga = (id, extra = {}) => ({ id, athlete_id: 'a1', completed_date: '2026-10-01', status: 'completed', notes: `nota ${id}`, workouts: { sections: {} }, ...extra })
  const esiste = (r, extra = {}) => ({ athlete_workout_id: r.id, impronta: impronta(testoPulito(r.notes)), versione: VERSIONE, ...extra })

  it('nuova → da estrarre; uguale → no', () => {
    const a = riga('a'), b = riga('b')
    expect(daEstrarre([a, b], [esiste(b)]).map(r => r.id)).toEqual(['a'])
  })
  it('nota modificata o versione vecchia → di nuovo', () => {
    const a = riga('a'), b = riga('b')
    expect(daEstrarre([a, b], [esiste(a, { impronta: 'deadbeef' }), esiste(b, { versione: 0 })]).map(r => r.id)).toEqual(['a', 'b'])
  })
  it('da fare o solo RPE → non si estrae, e il vecchio estratto si cancella', () => {
    const a = riga('a', { status: 'pending' }), b = riga('b', { notes: '[RPE: 7/10]\n[GRADIMENTO: si]' })
    const esistenti = [{ athlete_workout_id: 'a', impronta: 'x', versione: 1 }, { athlete_workout_id: 'b', impronta: 'x', versione: 1 }, { athlete_workout_id: 'sparita', impronta: 'x', versione: 1 }]
    expect(daEstrarre([a, b], esistenti)).toEqual([])
    expect(daCancellare([a, b], esistenti).sort()).toEqual(['a', 'b', 'sparita'])
  })
  it('un estratto ancora valido non si cancella', () => {
    const a = riga('a')
    expect(daCancellare([a], [esiste(a)])).toEqual([])
  })
})

describe('richiestaGroq e rispostaDaGroq', () => {
  it('JSON a temperatura 0, con testo ed esercizi e niente che identifichi l\'atleta', () => {
    const corpo = richiestaGroq([{ i: 0, testo: NOTA, esercizi: ESERCIZI }], 'modello-x')
    expect(corpo.model).toBe('modello-x')
    expect(corpo.temperature).toBe(0)
    expect(corpo.response_format).toEqual({ type: 'json_object' })
    const s = JSON.stringify(corpo)
    expect(s).toContain('Wall balls 9kg finite in 6:40')
    expect(s).toContain('Burpees')
    expect(s).not.toMatch(/athlete_id|completed_date|"id"/)
  })
  it('legge la risposta per indice, null se il JSON è rotto', () => {
    const m = rispostaDaGroq('{"note":[{"i":0,"stato":[]},{"i":2}]}')
    expect([...m.keys()]).toEqual([0, 2])
    expect(rispostaDaGroq('non json')).toBeNull()
    expect(rispostaDaGroq('{"altro":1}')).toBeNull()
  })
})
