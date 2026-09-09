import { describe, it, expect } from 'vitest'
import {
  sessioniDi, movimentiDi, movimentiTrascurati, settimaneConfronto,
  correzioneVolume, proposteDi, reportAtleta,
  SETTIMANE_CONFRONTO, GIORNI_TRASCURATO, AUMENTO_MASSIMO,
} from '../reportAtleta'
import { settimanaReport } from '../reportSettimanale'
import { GIORNI_FERMO } from '../statisticheCoach'

// Perché questi test esistono
// ────────────────────────────
// Questa pagina non riassume: PROPONE. Un numero sbagliato qui non produce una
// schermata brutta, produce un allenamento sbagliato. I casi presi sono quelli
// in cui il report resterebbe **plausibile e sbagliato**:
//
//  · i giri del blocco non contati sui movimenti — dieci burpees in un For Time
//    da cinque round sono cinquanta, e contarli dieci fa sembrare leggera la
//    seduta più dura della settimana;
//  · «Rest», che è l'unico esercizio a tenere la durata dentro `meters`: contarlo
//    come movimento inventa centinaia di metri che nessuno ha percorso;
//  · «saltato» e «in programma», che nei dati sono la stessa riga e per chi legge
//    sono opposti;
//  · la correzione di volume, che senza tetto propone di triplicare il carico a
//    chi ha appena scaricato.

// Mercoledì 2 settembre 2026. La settimana va da lun 31 ago a dom 6 set.
const MERCOLEDI = new Date('2026-09-02T10:00:00')
const DOMENICA = new Date('2026-09-06T20:00:00')

const hyrox = (blocks, intensity) => ({
  category: 'Hyrox',
  ...(intensity != null ? { intensity: String(intensity) } : {}),
  blocks,
})
const amrap = (minuti = 60, esercizi = []) =>
  [{ type: 'AMRAP', params: { duration: `${minuti} min` }, exercises: esercizi }]

let seme = 0
const ass = (data, { done = false, rpe = null, sections, testo = '', vocale = null, minuti = 60, intensity } = {}) => ({
  id: `aw${++seme}`,
  athlete_id: 'a1',
  completed_date: data,
  status: done ? 'completed' : 'pending',
  notes: rpe != null ? `[RPE: ${rpe}/10]\n${testo}` : (testo || null),
  voice_note_url: vocale,
  workouts: { id: `w${seme}`, title: 'Seduta', sections: sections || hyrox(amrap(minuti), intensity) },
})
const fatto = (data, extra = {}) => ass(data, { done: true, ...extra })

// ── Il diario ─────────────────────────────────────────────────────────────

describe('sessioniDi', () => {
  const settimana = settimanaReport(MERCOLEDI, 0)

  // 🔴 Nei dati «saltato» e «in programma» sono la stessa riga
  // (`status !== 'completed'`) e per chi legge sono opposti: senza la
  // distinzione, il venerdì ancora da fare compare come un buco già scavato.
  it('distingue il saltato da quello che deve ancora arrivare', () => {
    const s = sessioniDi([
      fatto('2026-08-31', { rpe: 7 }),
      ass('2026-09-01'),          // lunedì passato e non chiuso: saltato
      ass('2026-09-04'),          // venerdì: ancora da fare
    ], settimana)

    expect(s.map(x => x.stato)).toEqual(['completato', 'saltato', 'in programma'])
  })

  it('mette lo scarto solo dove esistono entrambi i valori', () => {
    const s = sessioniDi([
      fatto('2026-08-31', { rpe: 9, intensity: 6 }),
      fatto('2026-09-01', { intensity: 6 }),              // nessun RPE dichiarato
    ], settimana)

    expect(s[0].scarto).toBe(3)
    // 🔴 Con `parseNotesAndRpe` qui uscirebbe 5 − 6 = −1, cioè «più facile del
    // previsto» dedotto da un atleta che non ha scritto niente.
    expect(s[1].dichiarato).toBe(null)
    expect(s[1].scarto).toBe(null)
  })

  // 🔴 Alle dieci di mattina l'allenamento di oggi non è saltato: «Saltato» e
  // «Da fare» sono due parole opposte a schermo, e quella sbagliata comparirebbe
  // tutte le mattine su ogni atleta che si allena la sera.
  it('quello di oggi non ancora fatto è «da fare», non «saltato»', () => {
    const s = sessioniDi([ass('2026-09-02')], settimanaReport(MERCOLEDI, 0))
    expect(s[0].stato).toBe('in programma')
  })

  it('ma su una settimana chiusa lo stesso giorno è davvero saltato', () => {
    // Mercoledì 2 settembre guardato dalla domenica: la giornata è finita.
    const s = sessioniDi([ass('2026-09-02')], settimanaReport(DOMENICA, 0))
    expect(s[0].stato).toBe('saltato')
  })

  it('è in ordine di giorno, non di come arrivano le righe', () => {
    const s = sessioniDi([fatto('2026-09-04', { rpe: 7 }), fatto('2026-08-31', { rpe: 7 })], settimana)
    expect(s.map(x => x.data)).toEqual(['2026-08-31', '2026-09-04'])
  })

  it('non porta la nota di una seduta non ancora chiusa', () => {
    const s = sessioniDi([ass('2026-09-01', { testo: 'appunto del coach' })], settimana)
    expect(s[0].testo).toBe('')
  })
})

// ── I movimenti ───────────────────────────────────────────────────────────

const ex = (name, extra = {}) => ({ name, reps: '-', meters: '-', kg: '', ...extra })

describe('movimentiDi', () => {
  const opzioni = { fino: '2026-09-06' }

  // 🔴 Il caso che conta di più. Dieci burpees in un For Time da cinque round
  // sono cinquanta: contarli dieci fa sembrare leggera la seduta più dura
  // della settimana, e nessun errore lo segnala.
  it('moltiplica ripetizioni e metri per i giri del blocco', () => {
    const m = movimentiDi([fatto('2026-09-01', {
      rpe: 7,
      sections: hyrox([{
        type: 'For Time', params: { rounds: '5' },
        exercises: [ex('Burpees', { reps: '10' }), ex('Rowing', { meters: '250m' })],
      }]),
    })], opzioni)

    expect(m.find(x => x.nome === 'Burpees').reps).toBe(50)
    expect(m.find(x => x.nome === 'Rowing').metri).toBe(1250)
  })

  // 🔴 «Rest» è l'unico esercizio che tiene la propria durata dentro `meters`
  // (lo salva così ExercisePicker). Contarlo produce un movimento con
  // centinaia di metri che nessuno ha percorso.
  it('non conta Rest fra i movimenti', () => {
    const m = movimentiDi([fatto('2026-09-01', {
      rpe: 7,
      sections: hyrox(amrap(20, [ex('Rest', { meters: '2:00' }), ex('Wall Balls', { reps: '15' })])),
    })], opzioni)

    expect(m.map(x => x.nome)).toEqual(['Wall Balls'])
  })

  it('tiene l\'ultimo carico della seduta più recente, non dell\'ultima riga letta', () => {
    // Le righe arrivano dal server in ordine di data DECRESCENTE: con un
    // «l'ultimo che passa» ingenuo, «ultimo carico» sarebbe il più vecchio.
    const m = movimentiDi([
      fatto('2026-09-04', { rpe: 7, sections: hyrox(amrap(20, [ex('Wall Balls', { reps: '15', kg: '9' })])) }),
      fatto('2026-08-20', { rpe: 7, sections: hyrox(amrap(20, [ex('Wall Balls', { reps: '15', kg: '6' })])) }),
    ], opzioni)

    expect(m[0].kgUltimo).toBe(9)
    expect(m[0].kgMassimo).toBe(9)
    expect(m[0].sedute).toBe(2)
    expect(m[0].ultima).toBe('2026-09-04')
  })

  it('conta una seduta sola anche se il movimento compare in due blocchi', () => {
    const m = movimentiDi([fatto('2026-09-01', {
      rpe: 7,
      sections: hyrox([
        { type: 'Cash In', params: {}, exercises: [ex('Wall Balls', { reps: '10' })] },
        { type: 'Cash Out', params: {}, exercises: [ex('Wall Balls', { reps: '10' })] },
      ]),
    })], opzioni)

    expect(m[0].sedute).toBe(1)
    expect(m[0].reps).toBe(20)
  })

  it('salta le sedute non completate e quelle di corsa', () => {
    const m = movimentiDi([
      ass('2026-09-01', { sections: hyrox(amrap(20, [ex('Wall Balls', { reps: '15' })])) }),
      fatto('2026-09-02', { rpe: 6, sections: { category: 'Running', steps: [{ type: 'run', duration: '30 min' }] } }),
    ], opzioni)

    expect(m).toEqual([])
  })

  it('non inventa un carico dove il kg non c\'è', () => {
    const m = movimentiDi([fatto('2026-09-01', {
      rpe: 7, sections: hyrox(amrap(20, [ex('Burpees', { reps: '20' })])),
    })], opzioni)

    expect(m[0].kgUltimo).toBe(null)
    expect(m[0].kgMassimo).toBe(null)
  })
})

describe('movimentiTrascurati', () => {
  it('prende solo quelli oltre la soglia, il più vecchio per primo', () => {
    const m = [
      { nome: 'A', giorniDa: 3 },
      { nome: 'B', giorniDa: GIORNI_TRASCURATO },
      { nome: 'C', giorniDa: GIORNI_TRASCURATO + 10 },
    ]
    expect(movimentiTrascurati(m).map(x => x.nome)).toEqual(['C', 'B'])
  })
})

// ── Le cinque settimane ───────────────────────────────────────────────────

describe('settimaneConfronto', () => {
  it('sono cinque e finiscono con quella scelta', () => {
    const settimana = settimanaReport(MERCOLEDI, 0)
    const s = settimaneConfronto([], settimana, MERCOLEDI)
    expect(s).toHaveLength(SETTIMANE_CONFRONTO)
    expect(s.at(-1).da).toBe(settimana.da)
    expect(s.at(-1).corrente).toBe(true)
    expect(s[0].da).toBe('2026-08-03')
  })

  // 🔴 Senza il taglio a oggi, la settimana in corso è sempre la peggiore delle
  // cinque — ha lo stesso numeratore e un denominatore di sette giorni — e il
  // grafico direbbe «in calo» ogni lunedì.
  it('misura l\'aderenza della settimana in corso solo sui giorni passati', () => {
    const settimana = settimanaReport(MERCOLEDI, 0)
    const s = settimaneConfronto([
      fatto('2026-08-31', { rpe: 7 }), fatto('2026-09-01', { rpe: 7 }),
      ass('2026-09-04'), ass('2026-09-05'),
    ], settimana, MERCOLEDI)

    expect(s.at(-1).assegnati).toBe(2)
    expect(s.at(-1).percentuale).toBe(100)
  })

  // I due campi che `rapportoCarico` legge davvero: rinominarli non dà nessun
  // errore, fa solo sparire per sempre il moltiplicatore dalla pagina.
  it('porta punti e sessioni misurate, non solo i minuti', () => {
    const settimana = settimanaReport(MERCOLEDI, 0)
    const s = settimaneConfronto([fatto('2026-09-01', { rpe: 8, minuti: 60 })], settimana, MERCOLEDI)
    expect(s.at(-1).punti).toBe(480)
    expect(s.at(-1).misurate).toBe(1)
  })
})

// ── La correzione di volume ───────────────────────────────────────────────

describe('correzioneVolume', () => {
  it('toglie quanto serve a tornare sulla media', () => {
    // A 2× la media, per rientrare bisogna togliere metà del volume.
    expect(correzioneVolume(2)).toBe(-50)
  })

  it('nella fascia buona non chiede di cambiare niente', () => {
    expect(correzioneVolume(1)).toBe(0)
  })

  // 🔴 Il caso che il tetto esiste per prendere: chi ha appena scaricato sta a
  // 0,29× della propria media, e «riportarlo a 1» vuol dire +245% in una
  // settimana — un consiglio che, seguito, produce l'infortunio che questa
  // pagina esiste per evitare.
  it('non propone mai un salto oltre il tetto settimanale', () => {
    expect(correzioneVolume(0.29)).toBe(AUMENTO_MASSIMO)
    expect(correzioneVolume(0.75)).toBeLessThanOrEqual(AUMENTO_MASSIMO)
  })

  it('senza rapporto non propone niente', () => {
    expect(correzioneVolume(null)).toBe(null)
    expect(correzioneVolume(0)).toBe(null)
  })
})

// ── Le proposte ───────────────────────────────────────────────────────────

const misureBase = (extra = {}) => ({
  assegnati: 4, completati: 4, daVenire: 0, percentuale: 100,
  acwr: 1, scartoRpe: null, sessioniScarto: 0, fermo: null, ...extra,
})
const caricoBase = (extra = {}) => ({ punti: 1200, sessioni: 4, misurate: 4, senzaRpe: 0, minuti: 240, ...extra })
const settimanaFinta = { etichetta: '31 ago – 6 set' }

const chiavi = (p) => p.voci.map(v => v.chiave)

describe('proposteDi', () => {
  it('ogni proposta porta il numero da cui esce', () => {
    const p = proposteDi({
      misure: misureBase({ acwr: 2.4 }), carico: caricoBase(), settimana: settimanaFinta,
    })
    const scarica = p.voci.find(v => v.chiave === 'scarica')
    expect(scarica.titolo).toContain('58%')
    expect(scarica.motivo).toContain('2,4×')
    expect(scarica.motivo).toContain('1200 punti')
  })

  it('chi è sparito si sente prima di programmargli qualcosa', () => {
    const p = proposteDi({
      misure: misureBase({ fermo: { giorni: 9, oltre: false } }),
      carico: caricoBase(), settimana: settimanaFinta,
    })
    expect(chiavi(p)[0]).toBe('fermo')
    expect(p.voci[0].motivo).toContain('9 giorni')
  })

  it('non stampa un numero di giorni che non conosce', () => {
    const p = proposteDi({
      misure: misureBase({ fermo: { giorni: null, oltre: true } }),
      carico: caricoBase(), settimana: settimanaFinta,
    })
    expect(p.voci[0].motivo).not.toMatch(/\d+ giorni/)
  })

  // 🔴 «Puoi caricare» a chi la settimana non l'ha fatta è il consiglio
  // peggiore della pagina: il suo carico è basso PERCHÉ non si è allenato.
  it('non propone di caricare chi non ha seguito la settimana', () => {
    const bassa = { misure: misureBase({ acwr: 0.5, percentuale: 40, completati: 2 }), carico: caricoBase(), settimana: settimanaFinta }
    expect(chiavi(proposteDi(bassa))).not.toContain('carica')
    const alta = { misure: misureBase({ acwr: 0.5 }), carico: caricoBase(), settimana: settimanaFinta }
    expect(chiavi(proposteDi(alta))).toContain('carica')
  })

  it('dice di scrivere più leggero quando l\'atleta ha sentito più duro', () => {
    const p = proposteDi({
      misure: misureBase({ scartoRpe: 2, sessioniScarto: 3 }), carico: caricoBase(), settimana: settimanaFinta,
    })
    expect(chiavi(p)).toContain('piuLeggero')
    expect(p.voci.find(v => v.chiave === 'piuLeggero').motivo).toContain('+2')
  })

  it('propone di rimettere i movimenti che non tocca da settimane', () => {
    const p = proposteDi({
      misure: misureBase(), carico: caricoBase(), settimana: settimanaFinta,
      movimenti: [
        { nome: 'Sled Push', giorniDa: 30, ultimaEtichetta: '3 ago' },
        { nome: 'Wall Balls', giorniDa: 2, ultimaEtichetta: '4 set' },
      ],
    })
    const v = p.voci.find(x => x.chiave === 'trascurati')
    expect(v.titolo).toContain('Sled Push')
    expect(v.titolo).not.toContain('Wall Balls')
  })

  // Senza RPE non esiste il carico, quindi non esiste nessuna delle altre
  // proposte: è la prima cosa da rimettere a posto, non un dettaglio.
  it('quando l\'RPE manca sulla maggior parte delle sedute lo chiede', () => {
    const p = proposteDi({
      misure: misureBase({ acwr: null }),
      carico: caricoBase({ sessioni: 4, misurate: 1, senzaRpe: 3 }),
      settimana: settimanaFinta,
    })
    expect(chiavi(p)).toContain('rpe')
  })

  // Una lista vuota si legge come «non so cosa dirti». Lo stato buono si dichiara.
  it('quando non c\'è niente da correggere lo dice, invece di restare vuota', () => {
    const p = proposteDi({ misure: misureBase(), carico: caricoBase(), settimana: settimanaFinta })
    expect(chiavi(p)).toEqual(['ripeti'])
    expect(p.voci[0].motivo).toContain('Aderenza 100%')
  })
})

// ── Il report intero ──────────────────────────────────────────────────────

describe('reportAtleta', () => {
  const giorniFa = (n) => new Date(DOMENICA.getTime() - n * 86400000).toISOString().split('T')[0]

  it('calcola il moltiplicatore di carico sulle quattro settimane', () => {
    const righe = [
      // Tre settimane tranquille: 45 min a RPE 5 = 225 punti a settimana
      ...[26, 19, 12].map(d => fatto(giorniFa(d), { rpe: 5, minuti: 45 })),
      // Questa settimana: quattro sedute da 75 min a RPE 9 = 2700 punti
      ...[4, 3, 2, 1].map(d => fatto(giorniFa(d), { rpe: 9, minuti: 75 })),
    ]
    const r = reportAtleta(righe, { oggi: DOMENICA })

    // cronico = (225 + 225 + 225 + 2700) / 4 = 843,75 · acuto = 2700
    expect(r.misure.acwr).toBeCloseTo(3.2, 1)
    expect(r.verdetto).toBe('scarica')
    expect(r.proposte.voci.some(v => v.chiave === 'scarica')).toBe(true)
  })

  it('senza abbastanza sedute misurate non dichiara nessun moltiplicatore', () => {
    const r = reportAtleta([fatto(giorniFa(2), { rpe: 8 })], { oggi: DOMENICA })
    // 🔴 `null`, non 1: un rapporto neutro inventato si legge come «tutto a
    // posto», che è esattamente ciò che non si sa.
    expect(r.misure.acwr).toBe(null)
    expect(r.proposte.voci.some(v => ['scarica', 'carica'].includes(v.chiave))).toBe(false)
  })

  it('su una settimana passata «fermo» è la fotografia di allora, non di oggi', () => {
    // Un'unica seduta chiusa venerdì 28 agosto. Guardata dalla settimana del
    // 24–30 è di due giorni prima della domenica, quindi nessun fermo; guardata
    // da oggi (6 set) sono nove giorni di silenzio.
    const righe = [fatto('2026-08-28', { rpe: 7 })]
    expect(reportAtleta(righe, { oggi: DOMENICA, scarto: -1 }).misure.fermo).toBe(null)
    expect(reportAtleta(righe, { oggi: DOMENICA, scarto: 0 }).misure.fermo.giorni)
      .toBeGreaterThanOrEqual(GIORNI_FERMO)
  })

  it('dice quante sedute di corsa l\'elenco dei movimenti ha dovuto saltare', () => {
    const r = reportAtleta([
      fatto(giorniFa(2), { rpe: 6, sections: { category: 'Running', steps: [{ type: 'run', duration: '40 min' }] } }),
      fatto(giorniFa(1), { rpe: 7, sections: hyrox(amrap(20, [ex('Wall Balls', { reps: '15', kg: '9' })])) }),
    ], { oggi: DOMENICA })

    // Un elenco che tace su una seduta su due si legge come «ha fatto poco».
    expect(r.corseEscluse).toBe(1)
    expect(r.movimenti.map(m => m.nome)).toEqual(['Wall Balls'])
  })

  it('avvisa quando non ha niente per la settimana prossima', () => {
    const r = reportAtleta([fatto(giorniFa(1), { rpe: 7 })], { oggi: DOMENICA })
    expect(r.prossima.quante).toBe(0)
    expect(r.proposte.voci.some(v => v.chiave === 'vuota')).toBe(true)
  })

  it('su una settimana lontana non chiede di programmare quella dopo', () => {
    const r = reportAtleta([], { oggi: DOMENICA, scarto: -5 })
    expect(r.prossima.utile).toBe(false)
    expect(r.proposte.voci.some(v => v.chiave === 'vuota')).toBe(false)
  })
})
