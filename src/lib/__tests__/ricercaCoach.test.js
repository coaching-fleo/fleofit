import { describe, it, expect } from 'vitest'
import {
  risolviAtleta, statoAssegnazione, cercaWorkout, cercaAtleti, statisticheAtleta, cercaNelleNote,
  apri, eseguiStrumento, estratto, dataValida, caricaDatiRicerca, MASSIMO_PER_IA,
} from '../ricercaCoach'
import { fintoSupabase } from '../../test/fintoSupabase'
import { COACHING_ID } from '../constants'

// Perché questi test esistono
// ────────────────────────────
// Sono gli strumenti che l'IA chiama per rispondere al coach. L'IA NON vede i
// dati: vede solo quello che questi strumenti restituiscono, e scrive frasi
// sopra. Un filtro sbagliato qui diventa una risposta sicura e falsa — «nessuno
// è fermo» — detta con il tono di chi ha controllato. Tre cose contano di più:
//  1. chi è in pausa non compare fra gli inattivi (sarebbe una telefonata a
//     chi ha chiesto di non essere chiamato, come in Home);
//  2. l'RPE medio si fa solo su quelli DICHIARATI (il 5 di ripiego di
//     `parseNotesAndRpe` farebbe una media falsa);
//  3. un nome ambiguo non si risolve a caso.

const OGGI = new Date('2026-10-09T12:00:00')

const emom = { category: 'Hyrox', blocks: [{ type: 'EMOM', params: { interval: '1:00', rounds: '12' }, exercises: [{ name: 'Wall Balls', reps: '20' }, { name: 'Burpees', reps: '10' }] }] }
const forTime = { category: 'Hyrox', blocks: [{ type: 'For Time', params: { rounds: '3' }, exercises: [{ name: 'Sled Push', meters: '50m' }] }] }
const corsa = { category: 'Running', steps: [{ type: 'repeat', rounds: '8', runDuration: '400m', recDuration: '1 min' }] }
const gara = { category: 'Event', isEvent: true, isAutonomous: true }

const atleti = [
  { id: 'a1', name: 'Marco', surname: 'Rossi', notes: '' },
  { id: 'a2', name: 'Marco', surname: 'Bianchi', notes: '' },
  { id: 'a3', name: 'Sofia', surname: 'Neri', notes: '' },
  { id: 'a4', name: 'Nicolò', surname: 'Verdi', notes: '[PAUSA: 2026-10-01]\nInfortunio' },
]

const aw = (id, athlete_id, completed_date, status, sections, extra = {}) => ({
  id, athlete_id, completed_date, status, notes: '', voice_note_url: null,
  workouts: { id: `w-${id}`, title: `Workout ${id} · EM 12′ @7`, sections }, ...extra,
})

const dati = {
  atleti,
  assegnazioni: [
    aw('1', 'a1', '2026-10-08', 'completed', emom, { notes: '[RPE: 9/10]\nMale al ginocchio destro' }),
    aw('2', 'a1', '2026-10-05', 'completed', corsa, { notes: '[RPE: 6/10]\n' }),
    aw('3', 'a1', '2026-10-07', 'pending', forTime),
    aw('4', 'a2', '2026-09-20', 'completed', emom, { notes: 'senza rpe, tutto bene' }),
    aw('5', 'a3', '2026-10-09', 'pending', emom),
    aw('6', 'a3', '2026-10-30', 'pending', gara, { workouts: { id: 'w-6', title: 'Hyrox Milano', sections: gara } }),
    aw('7', 'a4', '2026-08-01', 'completed', emom),
  ],
}

describe('risolviAtleta', () => {
  it('trova per id prima che per nome', () => {
    expect(risolviAtleta(atleti, { atleta_id: 'a3', atleta: 'Marco' }).map(a => a.id)).toEqual(['a3'])
  })
  it('un nome condiviso torna TUTTI gli atleti, non uno a caso', () => {
    expect(risolviAtleta(atleti, { atleta: 'marco' }).map(a => a.id)).toEqual(['a1', 'a2'])
  })
  it('nome e cognome, senza accenti e maiuscole', () => {
    expect(risolviAtleta(atleti, { atleta: 'nicolo verdi' }).map(a => a.id)).toEqual(['a4'])
    expect(risolviAtleta(atleti, { atleta: 'Marco Bianchi' }).map(a => a.id)).toEqual(['a2'])
  })
})

describe('statoAssegnazione', () => {
  it('oggi non è scaduto, ieri sì', () => {
    expect(statoAssegnazione({ status: 'pending', completed_date: '2026-10-09' }, OGGI)).toBe('da_fare')
    expect(statoAssegnazione({ status: 'pending', completed_date: '2026-10-08' }, OGGI)).toBe('scaduto')
    expect(statoAssegnazione({ status: 'completed', completed_date: '2026-10-08' }, OGGI)).toBe('completato')
  })
})

describe('cercaWorkout', () => {
  it('filtra per atleta, stato e periodo insieme', () => {
    const r = cercaWorkout(dati, { atleta_id: 'a1', stato: 'scaduto', dal: '2026-10-01', al: '2026-10-09' }, OGGI)
    expect(r.risultati.map(x => x.id)).toEqual(['3'])
  })
  it('un nome ambiguo restituisce i candidati invece dei risultati', () => {
    const r = cercaWorkout(dati, { atleta: 'Marco' }, OGGI)
    expect(r.errore).toMatch(/Più atleti/)
    expect(r.candidati).toEqual(['Marco Rossi', 'Marco Bianchi'])
  })
  it('cerca dentro i blocchi: tipo ed esercizio', () => {
    expect(cercaWorkout(dati, { tipo_blocco: 'emom', esercizio: ['wall ball'] }, OGGI).totale).toBe(4)
    expect(cercaWorkout(dati, { esercizio: ['sled'] }, OGGI).risultati.map(x => x.id)).toEqual(['3'])
  })
  it('cerca le distanze della corsa nel testo', () => {
    expect(cercaWorkout(dati, { testo: ['400m'] }, OGGI).risultati.map(x => x.id)).toEqual(['2'])
  })
  it('il titolo arriva senza il codice in coda', () => {
    expect(cercaWorkout(dati, { atleta_id: 'a1' }, OGGI).risultati[0].titolo).toBe('Workout 1')
  })
  it('distinti tiene un workout una volta sola', () => {
    const doppio = { ...dati, assegnazioni: [...dati.assegnazioni, { ...dati.assegnazioni[0], id: '1b', athlete_id: 'a3' }] }
    expect(cercaWorkout(doppio, { distinti: true }, OGGI).totale).toBe(dati.assegnazioni.length)
  })
  it('una gara non ha durata, e non passa un filtro sulla durata', () => {
    expect(cercaWorkout(dati, { durata_min: 0 }, OGGI).risultati.some(x => x.categoria === 'Event')).toBe(false)
  })
})

describe('cercaWorkout: i workout mai assegnati', () => {
  const bozza = { id: 'w-bozza', title: 'Bozza EMOM · EM 10′ @6', date: '2026-10-02', sections: emom }
  const vecchio = { id: 'w-vecchio', title: 'Dato nel 2024', date: '2024-03-01', sections: emom }
  const conBozze = { ...dati, workouts: [bozza, vecchio], assegnati: new Set(['w-vecchio']) }

  it('ci sono, con lo stato «non_assegnato»', () => {
    const r = cercaWorkout(conBozze, { esercizio: ['wall ball'] }, OGGI)
    const riga = r.risultati.find(x => x.workoutId === 'w-bozza')
    expect(riga).toMatchObject({ stato: 'non_assegnato', atleta: null, titolo: 'Bozza EMOM' })
  })
  it('un workout assegnato fuori dalla finestra caricata NON è «non assegnato»', () => {
    expect(cercaWorkout(conBozze, {}, OGGI).risultati.some(x => x.workoutId === 'w-vecchio')).toBe(false)
  })
  it('non compaiono se si chiede di un atleta o di uno stato di esecuzione', () => {
    expect(cercaWorkout(conBozze, { atleta_id: 'a3' }, OGGI).risultati.some(x => x.stato === 'non_assegnato')).toBe(false)
    expect(cercaWorkout(conBozze, { stato: 'scaduto' }, OGGI).risultati.some(x => x.stato === 'non_assegnato')).toBe(false)
  })
  it('stato «non_assegnato» chiede solo loro, con gli stessi filtri sul contenuto', () => {
    expect(cercaWorkout(conBozze, { stato: 'non_assegnato' }, OGGI).risultati.map(x => x.workoutId)).toEqual(['w-bozza'])
    expect(cercaWorkout(conBozze, { stato: 'non_assegnato', esercizio: ['sled'] }, OGGI).totale).toBe(0)
    expect(cercaWorkout(conBozze, { stato: 'non_assegnato', dal: '2026-10-05' }, OGGI).totale).toBe(0)
  })
})

describe('cercaAtleti', () => {
  it('gli inattivi NON comprendono chi è in pausa', () => {
    const r = cercaAtleti(dati, { inattivi_da_giorni: 5 }, OGGI)
    // a2 fermo dal 20/09, a3 mai completato; a4 è in pausa e resta fuori.
    expect(r.risultati.map(x => x.atletaId).sort()).toEqual(['a2', 'a3'])
    expect(r.risultati.find(x => x.atletaId === 'a2').giorniFermo).toBe(19)
    // a3 non ha mai completato niente: nessun numero di giorni inventato
    const a3 = r.risultati.find(x => x.atletaId === 'a3')
    expect(a3.giorniFermo).toBeUndefined()
    expect(a3.nessunCompletatoNellAnno).toBe(true)
  })
  it('in_pausa: true li chiede esplicitamente', () => {
    expect(cercaAtleti(dati, { in_pausa: true }, OGGI).risultati.map(x => x.atletaId)).toEqual(['a4'])
  })
  it('gara entro N giorni, con quanti giorni mancano', () => {
    const r = cercaAtleti(dati, { gara_entro_giorni: 30 }, OGGI)
    expect(r.risultati).toHaveLength(1)
    expect(r.risultati[0]).toMatchObject({ atletaId: 'a3', gara: 'Hyrox Milano', fraGiorni: 21 })
    expect(cercaAtleti(dati, { gara_entro_giorni: 10 }, OGGI).totale).toBe(0)
  })
  it('RPE alto solo su quelli dichiarati', () => {
    const r = cercaAtleti(dati, { rpe_minimo: 8, rpe_ultimi_giorni: 7 }, OGGI)
    expect(r.risultati.map(x => [x.atletaId, x.rpeMassimo])).toEqual([['a1', 9]])
  })
  it('senza programma nei prossimi giorni: oggi conta, la pausa no', () => {
    const r = cercaAtleti(dati, { senza_programma_giorni: 3 }, OGGI)
    expect(r.risultati.map(x => x.atletaId).sort()).toEqual(['a1', 'a2'])
    expect(r.risultati[0].senzaProgrammaGiorni).toBe(3)
  })
})

describe('statisticheAtleta', () => {
  it('conta e fa la media solo sugli RPE dichiarati', () => {
    const s = statisticheAtleta(dati, { atleta_id: 'a1', dal: '2026-10-01', al: '2026-10-09' }, OGGI)
    expect(s).toMatchObject({ assegnati: 3, completati: 2, scaduti: 1, percentuale: 67, rpeMedio: 7.5, rpeDichiarati: 2, rpeMassimo: 9, ultimoCompletato: '2026-10-08' })
  })
  it('un completato senza RPE non diventa un 5', () => {
    const s = statisticheAtleta(dati, { atleta_id: 'a2', dal: '2026-09-01', al: '2026-10-09' }, OGGI)
    expect(s.rpeMedio).toBeNull()
    expect(s.rpeDichiarati).toBe(0)
  })
  it('senza atleta è un errore, non le statistiche di tutti', () => {
    expect(statisticheAtleta(dati, {}, OGGI).errore).toBeTruthy()
  })
})

describe('cercaNelleNote', () => {
  it('trova una delle parole, senza il marcatore RPE nella nota', () => {
    const r = cercaNelleNote(dati, { parole: ['ginocch', 'menisco'] }, OGGI)
    expect(r.risultati).toHaveLength(1)
    expect(r.risultati[0].nota).toBe('Male al ginocchio destro')
  })
  it('dice che le note vocali non sono state ascoltate', () => {
    const conVocale = { ...dati, assegnazioni: [...dati.assegnazioni, aw('8', 'a3', '2026-10-01', 'completed', emom, { voice_note_url: 'https://x/a.m4a' })] }
    expect(cercaNelleNote(conVocale, { parole: ['ginocch'] }, OGGI).avviso).toMatch(/1 note vocali/)
  })
  it('l\'estratto è centrato sulla parola trovata', () => {
    const lungo = `${'a'.repeat(300)} ginocchio ${'b'.repeat(300)}`
    const e = estratto(lungo, ['ginocchio'], 60)
    expect(e).toContain('ginocchio')
    expect(e.startsWith('…') && e.endsWith('…')).toBe(true)
  })
})

describe('apri', () => {
  it('porta alle schermate giuste', () => {
    expect(apri(dati, { schermata: 'scheda_atleta', atleta: 'Sofia' }).percorso).toBe('/athletes/a3')
    expect(apri(dati, { schermata: 'report_atleta', atleta_id: 'a1' }).percorso).toBe('/report/a1')
    expect(apri(dati, { schermata: 'crea_workout', atleta: 'Sofia', data: '2026-10-10' }).percorso)
      .toBe('/create?athlete_id=a3&date=2026-10-10')
    expect(apri(dati, { schermata: 'workout', workout_id: 'w-5' }).percorso).toBe('/workout/w-5?athlete_id=a3')
  })
  it('la scheda atleta senza atleta è un errore', () => {
    expect(apri(dati, { schermata: 'scheda_atleta' }).errore).toBeTruthy()
    expect(apri(dati, { schermata: 'ovunque' }).errore).toBeTruthy()
  })
})

describe('eseguiStrumento', () => {
  it('all\'IA arrivano al massimo MASSIMO_PER_IA righe, e il totale vero', () => {
    const tante = { atleti, assegnazioni: Array.from({ length: 40 }, (_, i) => aw(`x${i}`, 'a3', '2026-10-01', 'completed', emom)) }
    const { completo, perIA } = eseguiStrumento('cercaWorkout', {}, tante, OGGI)
    expect(completo.risultati).toHaveLength(40)
    expect(perIA.risultati).toHaveLength(MASSIMO_PER_IA)
    expect(perIA.totale).toBe(40)
  })
  it('all\'IA non arrivano id d\'atleta, foto né doppioni della data', () => {
    const { perIA } = eseguiStrumento('cercaWorkout', { atleta: 'Sofia' }, dati, OGGI)
    const riga = perIA.risultati[0]
    expect(riga).not.toHaveProperty('atletaId')
    expect(riga).not.toHaveProperty('quando')
    expect(riga).not.toHaveProperty('id')
    expect(riga).toHaveProperty('workoutId')
    const stat = eseguiStrumento('statisticheAtleta', { atleta: 'Sofia' }, dati, OGGI).perIA
    expect(stat).not.toHaveProperty('atletaId')
    expect(stat.atleta).toBe('Sofia Neri')
  })
  it('il nome completo di un candidato risolve l\'ambiguità', () => {
    expect(cercaWorkout(dati, { atleta: 'Marco Bianchi' }, OGGI).risultati.map(x => x.id)).toEqual(['4'])
  })

  it('uno strumento sconosciuto o che esplode diventa un errore leggibile', () => {
    expect(eseguiStrumento('cancellaTutto', {}, dati, OGGI).perIA.errore).toMatch(/sconosciuto/)
    expect(eseguiStrumento('cercaWorkout', {}, null, OGGI).perIA.errore).toMatch(/non è riuscito/)
  })
})

describe('dataValida', () => {
  it('normalizza le date scritte male e rifiuta il resto', () => {
    expect(dataValida('2026-9-3')).toBe('2026-09-03')
    expect(dataValida('ieri')).toBeNull()
  })
})

describe('caricaDatiRicerca', () => {
  it('toglie l\'account del coach e le assegnazioni di chi non è in rubrica', async () => {
    const finto = fintoSupabase({
      athletes: [...atleti, { id: COACHING_ID, name: 'Coach' }],
      workouts: [{ id: 'w-libero', title: 'Mai assegnato', date: '2026-10-01', sections: emom }],
      athlete_workouts: [...dati.assegnazioni, aw('c', COACHING_ID, '2026-10-01', 'completed', emom), aw('z', 'cancellato', '2026-10-01', 'completed', emom)],
    })
    const d = await caricaDatiRicerca(finto.supabase, OGGI)
    expect(d.atleti.map(a => a.id)).not.toContain(COACHING_ID)
    expect(d.assegnazioni.map(a => a.id)).toEqual(dati.assegnazioni.map(a => a.id))
    expect(d.dal).toBe('2025-10-09')
    // i workout si leggono dalla loro tabella, anche quelli mai assegnati
    expect(d.workouts.map(w => w.id)).toEqual(['w-libero'])
    expect(finto.chiamateA('workouts', 'select')).toHaveLength(1)
  })
})
