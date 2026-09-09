import { describe, it, expect } from 'vitest'
import {
  settimanaReport, caricoDi, rapportoCarico, scartoRpeDi, verdettoAtleta,
  reportSettimanale, oreMinuti, fraseSettimana, VERDETTI,
  ACWR_ALTO, SCARTO_RPE, MINIMO_SESSIONI_CARICO,
} from '../reportSettimanale'
import { GIORNI_FERMO } from '../statisticheCoach'

// Perché questi test esistono
// ────────────────────────────
// Il report è fatto di numeri su cui il coach decide se caricare, scaricare o
// telefonare. Nessuno di questi numeri dà errore quando sbaglia: cambia solo la
// decisione. I casi presi qui sono quelli in cui il report resterebbe
// **plausibile e sbagliato**:
//
//  · l'aderenza misurata sulla settimana INTERA, che il lunedì mattina mette
//    tutta la squadra a zero e accende un allarme su chi non ha ancora avuto
//    modo di allenarsi;
//  · il carico che conta come misura il 5 di ripiego di `parseNotesAndRpe`,
//    dando un totale plausibile a un atleta che non ha dichiarato niente;
//  · il rapporto acuto/cronico calcolato su due sessioni, che è rumore
//    presentato come un rischio;
//  · lo scarto RPE che confronta un valore inventato con un altro inventato.

// Mercoledì 2 settembre 2026. La settimana va da lun 31 ago a dom 6 set.
const MERCOLEDI = new Date('2026-09-02T10:00:00')
const LUNEDI = new Date('2026-08-31T08:00:00')
const DOMENICA = new Date('2026-09-06T22:00:00')

/** Un workout di `minuti` minuti, con l'intensità che il coach ha dichiarato. */
const sezioni = (minuti = 60, intensity) => ({
  category: 'Hyrox',
  ...(intensity != null ? { intensity: String(intensity) } : {}),
  blocks: [{ type: 'AMRAP', params: { duration: `${minuti} min` } }],
})

const ass = (athlete_id, completed_date, {
  status = 'pending', rpe = null, minuti = 60, intensity, testo = '', vocale = null,
  sections, id,
} = {}) => ({
  id: id || `${athlete_id}-${completed_date}-${Math.random()}`,
  athlete_id,
  completed_date,
  status,
  notes: rpe != null ? `[RPE: ${rpe}/10]\n${testo}` : (testo || null),
  voice_note_url: vocale,
  workouts: { id: `w-${completed_date}`, title: 'Allenamento', sections: sections || sezioni(minuti, intensity) },
})

const fatto = (athlete_id, data, extra = {}) => ass(athlete_id, data, { status: 'completed', ...extra })

const atleta = (id, name, extra = {}) => ({ id, name, surname: 'Rossi', notes: '', photo_url: null, ...extra })

// ── La settimana ──────────────────────────────────────────────────────────

describe('settimanaReport', () => {
  it('va da lunedì a domenica', () => {
    const s = settimanaReport(MERCOLEDI, 0)
    expect([s.da, s.a]).toEqual(['2026-08-31', '2026-09-06'])
  })

  // 🔴 Il caso che prende la mutazione. Con il `weekStartsOn` di default di
  // date-fns (domenica) la domenica cade nella settimana SUCCESSIVA, e il
  // report della domenica sera racconterebbe una settimana appena cominciata
  // invece di quella che si è appena chiusa.
  it('la domenica sera è ancora la stessa settimana', () => {
    const s = settimanaReport(DOMENICA, 0)
    expect([s.da, s.a]).toEqual(['2026-08-31', '2026-09-06'])
    expect(s.corrente).toBe(true)
  })

  it('lo scarto sposta di settimane intere', () => {
    const s = settimanaReport(MERCOLEDI, -1)
    expect([s.da, s.a]).toEqual(['2026-08-24', '2026-08-30'])
    expect(s.corrente).toBe(false)
    expect(s.futura).toBe(false)
  })

  // ⚠️ `fino` è la regola 1 del file: è il punto in cui si smette di contare
  // gli assegnati. Su una settimana passata è la domenica, su quella in corso è
  // oggi — e sono due cose diverse, non due modi di dire la stessa.
  it('si ferma a oggi sulla settimana in corso, alla domenica su quelle chiuse', () => {
    expect(settimanaReport(MERCOLEDI, 0).fino).toBe('2026-09-02')
    expect(settimanaReport(MERCOLEDI, -1).fino).toBe('2026-08-30')
    expect(settimanaReport(MERCOLEDI, 1).fino).toBe(null)
  })

  it('dice quanti giorni sono trascorsi, per rendere leggibile un «2 su 5»', () => {
    expect(settimanaReport(MERCOLEDI, 0).trascorsi).toBe(3)
    expect(settimanaReport(LUNEDI, 0).trascorsi).toBe(1)
    expect(settimanaReport(MERCOLEDI, -1).trascorsi).toBe(7)
  })
})

// ── Il carico ─────────────────────────────────────────────────────────────

describe('caricoDi', () => {
  it('somma minuti × RPE dichiarato', () => {
    const c = caricoDi([fatto('a', '2026-09-01', { minuti: 60, rpe: 8 })])
    expect(c.minuti).toBe(60)
    expect(c.punti).toBe(480)
    expect(c.rpeMedio).toBe(8)
  })

  // 🔴 Il caso che conta. `parseNotesAndRpe` torna 5 quando il marcatore non
  // c'è: usandolo qui, un atleta che non dichiara mai niente porterebbe 300
  // punti a settimana come chiunque altro — un carico inventato che entra nel
  // rapporto acuto/cronico e ne esce come un verdetto.
  it('NON conta come misura la sessione senza RPE, e lo dichiara', () => {
    const c = caricoDi([
      fatto('a', '2026-09-01', { minuti: 60, rpe: 8 }),
      fatto('a', '2026-09-02', { minuti: 60 }),
    ])
    expect(c.punti).toBe(480)
    expect(c.minuti).toBe(120)      // i minuti sì: quelli sono un fatto
    expect(c.sessioni).toBe(2)
    expect(c.misurate).toBe(1)
    expect(c.parziale).toBe(true)
  })

  it('senza un solo RPE dichiarato non inventa una media', () => {
    const c = caricoDi([fatto('a', '2026-09-01', { minuti: 60 })])
    expect(c.rpeMedio).toBe(null)
    expect(c.punti).toBe(0)
  })

  it('su nessuna sessione non è parziale: non manca niente', () => {
    expect(caricoDi([]).parziale).toBe(false)
  })
})

describe('rapportoCarico', () => {
  const settimana = (punti, misurate) => ({ punti, misurate, sessioni: misurate })

  it('confronta la settimana con la media delle quattro', () => {
    // cronico = (300 + 300 + 300 + 900) / 4 = 450 · acuto = 900
    const r = rapportoCarico(900, [settimana(300, 1), settimana(300, 1), settimana(300, 1), settimana(900, 3)])
    expect(r).toBe(2)
  })

  // 🔴 Con due sessioni misurate il rapporto esiste ed è rumore: saltarne una
  // dimezza il riferimento e raddoppia il numero. Un 2,1 costruito così manda
  // il coach a scaricare un atleta che sta benissimo.
  it('torna null sotto il minimo di sessioni misurate', () => {
    const storico = [settimana(0, 0), settimana(0, 0), settimana(300, 1), settimana(300, 1)]
    expect(storico.reduce((s, x) => s + x.misurate, 0)).toBeLessThan(MINIMO_SESSIONI_CARICO)
    expect(rapportoCarico(300, storico)).toBe(null)
  })

  // Un atleta appena arrivato ha tre settimane vuote non perché abbia smesso,
  // ma perché non c'era. Il suo cronico sarebbe un quarto del vero.
  it('torna null quando una sola delle quattro settimane ha carico', () => {
    expect(rapportoCarico(1800, [
      settimana(0, 0), settimana(0, 0), settimana(0, 0), settimana(1800, 6),
    ])).toBe(null)
  })

  it('torna null e non 1 quando non c\'è nessun carico', () => {
    expect(rapportoCarico(0, [])).toBe(null)
  })
})

describe('scartoRpeDi', () => {
  it('dice di quanto l\'atleta ha sentito la settimana più dura del previsto', () => {
    const s = scartoRpeDi([
      fatto('a', '2026-09-01', { intensity: 6, rpe: 8 }),
      fatto('a', '2026-09-02', { intensity: 6, rpe: 9 }),
    ])
    expect(s.valore).toBe(2.5)
    expect(s.sessioni).toBe(2)
  })

  // Con una sola sessione lo «scarto» è quel giorno — un litigio, una notte
  // storta — non una tendenza della programmazione.
  it('torna null sotto due sessioni con entrambi i valori', () => {
    expect(scartoRpeDi([fatto('a', '2026-09-01', { intensity: 6, rpe: 9 })]).valore).toBe(null)
  })

  // 🔴 Il confronto ha senso solo fra due numeri che ESISTONO entrambi. Con
  // `parseNotesAndRpe` al posto di `rpeDichiarato` questa sessione porterebbe
  // uno scarto di 5 − 6 = −1, cioè «più facile del previsto» dedotto da un
  // atleta che non ha scritto niente.
  it('salta le sessioni in cui uno dei due valori manca', () => {
    const s = scartoRpeDi([
      fatto('a', '2026-09-01', { intensity: 6, rpe: 8 }),
      fatto('a', '2026-09-02', { intensity: 6 }),            // nessun RPE dichiarato
      fatto('a', '2026-09-03', { rpe: 8, sections: { category: 'Custom', isAutonomous: true } }),
    ])
    expect(s.sessioni).toBe(1)
    expect(s.valore).toBe(null)
  })
})

// ── I verdetti ────────────────────────────────────────────────────────────

const misure = (extra = {}) => ({
  assegnati: 3, completati: 3, daVenire: 0, percentuale: 100,
  acwr: null, scartoRpe: null, fermo: null, ...extra,
})

describe('verdettoAtleta', () => {
  it('chi è sparito si richiama, anche se il carico è alle stelle', () => {
    const v = verdettoAtleta(misure({ fermo: { giorni: 9, oltre: false }, acwr: 2.2 }))
    expect(v.verdetto).toBe('fermo')
    expect(v.motivo).toContain('9 giorni')
  })

  it('non stampa un numero di giorni che non conosce', () => {
    const v = verdettoAtleta(misure({ fermo: { giorni: null, oltre: true } }))
    expect(v.motivo).not.toMatch(/\d+ giorni/)
  })

  it('un carico sopra la soglia manda a scaricare', () => {
    const v = verdettoAtleta(misure({ acwr: ACWR_ALTO + 0.2 }))
    expect(v.verdetto).toBe('scarica')
  })

  it('lo scarto RPE manda a scaricare anche con il carico in ordine', () => {
    const v = verdettoAtleta(misure({ acwr: 1, scartoRpe: SCARTO_RPE }))
    expect(v.verdetto).toBe('scarica')
    expect(v.motivo).toContain('+1,5')
  })

  // 🔴 IL caso che questo file esiste per proteggere. Al lunedì mattina gli
  // assegnati trascorsi sono zero per tutti: legare l'aderenza alla frazione
  // piena della settimana dipingerebbe l'intera squadra di arancione prima che
  // sia successo qualcosa. «Senza programma» qui NON vuol dire «senza niente»:
  // il motivo dice quanti allenamenti restano nei giorni che seguono.
  it('senza giorni trascorsi non accusa nessuno di aderenza bassa', () => {
    const v = verdettoAtleta(misure({ assegnati: 0, completati: 0, percentuale: 0, daVenire: 4 }))
    expect(v.verdetto).toBe('attesa')
    expect(v.motivo).toContain('4 allenamenti in programma')
    // ⚠️ E NON «senza programma»: quattro allenamenti in programma da giovedì
    // sono un programma. L'etichetta sbagliata comparirebbe su tutta la squadra
    // ogni lunedì, e a quel punto non si crede più quando è vera.
    expect(VERDETTI[v.verdetto].etichetta).toBe('Da iniziare')
  })

  it('una settimana davvero senza niente lo dice', () => {
    const v = verdettoAtleta(misure({ assegnati: 0, completati: 0, percentuale: 0, daVenire: 0 }))
    expect(v.verdetto).toBe('vuoto')
    expect(v.motivo).toContain('Nessun allenamento assegnato')
  })

  it('un solo allenamento saltato non è un\'aderenza bassa', () => {
    const v = verdettoAtleta(misure({ assegnati: 1, completati: 0, percentuale: 0 }))
    expect(v.verdetto).toBe('linea')
  })

  it('metà settimana saltata sì', () => {
    const v = verdettoAtleta(misure({ assegnati: 4, completati: 1, percentuale: 25 }))
    expect(v.verdetto).toBe('aderenza')
  })

  // Chi non ha seguito la settimana non è «pronto a caricare» solo perché il
  // suo carico è basso: è basso PERCHÉ non si è allenato.
  it('non propone di caricare chi la settimana non l\'ha fatta', () => {
    expect(verdettoAtleta(misure({ assegnati: 4, completati: 2, percentuale: 50, acwr: 0.5 })).verdetto)
      .toBe('linea')
    expect(verdettoAtleta(misure({ percentuale: 100, acwr: 0.5 })).verdetto).toBe('carica')
  })
})

// ── Il report intero ──────────────────────────────────────────────────────

describe('reportSettimanale', () => {
  const squadraBase = [atleta('a1', 'Anna'), atleta('a2', 'Bruno'), atleta('a3', 'Carla')]

  it('conta gli assegnati solo fino a oggi, e dice cosa resta', () => {
    const r = reportSettimanale(squadraBase, [
      ass('a1', '2026-08-31', { status: 'completed', rpe: 7 }),   // lunedì, fatto
      ass('a1', '2026-09-01', { status: 'completed', rpe: 7 }),   // martedì, fatto
      ass('a1', '2026-09-04'),                                    // venerdì, ancora da fare
      ass('a1', '2026-09-05'),                                    // sabato, ancora da fare
    ], { oggi: MERCOLEDI })

    const anna = r.righe.find(x => x.id === 'a1')
    expect(anna.assegnati).toBe(2)
    expect(anna.completati).toBe(2)
    expect(anna.percentuale).toBe(100)
    expect(anna.daVenire).toBe(2)
    // 🔴 Con la settimana intera al denominatore sarebbe 2/4 = 50%, cioè
    // «aderenza bassa» per un'atleta che ha chiuso tutto quello che poteva.
    expect(anna.verdetto).not.toBe('aderenza')
  })

  // 🔴 La giornata non è finita. Un allenamento programmato per OGGI e non
  // ancora fatto non è saltato: alle otto di mattina non è saltato niente, e
  // contarlo come tale metterebbe la squadra ad «aderenza bassa» ogni mattina
  // fino al primo allenamento. È la stessa eccezione di `serieGiorni`.
  it('non conta come saltato un allenamento di oggi non ancora fatto', () => {
    const r = reportSettimanale(squadraBase, [
      ass('a1', '2026-08-31', { status: 'completed', rpe: 7 }),
      ass('a1', '2026-09-02'),                                    // oggi, ancora aperto
    ], { oggi: MERCOLEDI })

    const anna = r.righe.find(x => x.id === 'a1')
    expect(anna.assegnati).toBe(1)
    expect(anna.percentuale).toBe(100)
    expect(anna.daVenire).toBe(1)
  })

  // ⚠️ L'altra metà della stessa regola, e senza di essa la prima è un danno:
  // escludere il giorno intero vorrebbe dire che una seduta chiusa stamattina
  // non entra né nel volume né nel carico né nell'RPE — il report ignorerebbe
  // l'ultima cosa successa.
  it('ma una seduta CHIUSA oggi conta, e porta i suoi minuti', () => {
    const r = reportSettimanale(squadraBase, [
      fatto('a1', '2026-09-02', { rpe: 8, minuti: 60 }),
    ], { oggi: MERCOLEDI })

    const anna = r.righe.find(x => x.id === 'a1')
    expect(anna.assegnati).toBe(1)
    expect(anna.completati).toBe(1)
    expect(anna.minuti).toBe(60)
    expect(r.squadra.carico).toBe(480)
  })

  it('l\'atleta in pausa esce dalla squadra e resta elencato a parte', () => {
    const r = reportSettimanale([
      atleta('a1', 'Anna'),
      atleta('a2', 'Bruno', { notes: '[PAUSA: 2026-08-20]\nTorna a ottobre' }),
    ], [], { oggi: MERCOLEDI })

    expect(r.squadra.atleti).toBe(1)
    expect(r.righe.map(x => x.id)).toEqual(['a1'])
    expect(r.inPausa).toEqual([{ id: 'a2', nome: 'Bruno Rossi', foto: null, dal: '20 ago' }])
    // ⚠️ Il marcatore non si vede MAI come testo, nemmeno qui (§9-decies).
    expect(JSON.stringify(r)).not.toContain('[PAUSA')
  })

  it('mette in cima chi richiede un\'azione, non chi viene prima in rubrica', () => {
    const giorniFa = (n) => new Date(MERCOLEDI.getTime() - n * 86400000).toISOString().split('T')[0]
    const r = reportSettimanale(squadraBase, [
      // Anna segue il programma
      fatto('a1', '2026-08-31', { rpe: 6 }), fatto('a1', '2026-09-01', { rpe: 6 }),
      // Bruno è sparito da GIORNI_FERMO+ giorni
      fatto('a2', giorniFa(GIORNI_FERMO + 4), { rpe: 6 }),
      ass('a2', '2026-09-01'),
      // Carla ha saltato tre allenamenti su quattro
      ass('a3', '2026-08-31'), ass('a3', '2026-09-01'), ass('a3', '2026-09-02'),
      fatto('a3', '2026-08-31', { rpe: 6, id: 'c-ok' }),
    ], { oggi: MERCOLEDI })

    expect(r.righe[0].id).toBe('a2')
    expect(r.gruppi.fermo.map(x => x.nome)).toEqual(['Bruno Rossi'])
    expect(r.gruppi.aderenza.map(x => x.id)).toEqual(['a3'])
  })

  // 🔴 Le corsie si DERIVANO dai dati, come i chip dell'archivio: una voce
  // «Running» in una settimana senza corse è la legenda di un colore che non
  // compare da nessuna parte.
  it('elenca solo le corsie che quella settimana esistono davvero', () => {
    const r = reportSettimanale(squadraBase, [
      fatto('a1', '2026-09-01', { rpe: 6 }),
      fatto('a2', '2026-09-01', { rpe: 6, sections: { category: 'Running', steps: [{ type: 'run', duration: '30 min' }] } }),
    ], { oggi: MERCOLEDI })

    expect(r.corsie.map(c => c.categoria)).toEqual(['Hyrox', 'Running'])
    expect(r.corsie.find(c => c.categoria === 'Running').sessioni).toBe(1)
  })

  it('dice chi non ha niente in programma la settimana prossima', () => {
    const r = reportSettimanale(squadraBase, [
      ass('a1', '2026-09-08'),   // dentro la prossima settimana (7–13 set)
      ass('a2', '2026-09-05'),   // dentro QUESTA settimana: non copre la prossima
    ], { oggi: MERCOLEDI })

    expect(r.prossima.coperti).toBe(1)
    expect(r.prossima.senza).toBe(2)
    expect(r.prossima.righe.map(x => x.nome)).toEqual(['Bruno Rossi', 'Carla Rossi'])
    expect(r.prossima.utile).toBe(true)
  })

  // Programmare una settimana già passata non è un'azione: la sezione deve
  // poter sparire, invece di chiedere al coach una cosa impossibile.
  it('non chiede di programmare una settimana già passata', () => {
    expect(reportSettimanale(squadraBase, [], { oggi: MERCOLEDI, scarto: -4 }).prossima.utile).toBe(false)
  })

  it('raccoglie le note e le vocali della settimana', () => {
    const r = reportSettimanale(squadraBase, [
      fatto('a1', '2026-09-01', { rpe: 9, testo: 'gambe distrutte' }),
      fatto('a2', '2026-09-02', { rpe: 6, vocale: 'https://x/nota.m4a' }),
      fatto('a3', '2026-09-02', { rpe: 6 }),                                  // niente da dire
      fatto('a3', '2026-08-31', { rpe: 6, vocale: 'https://x/v.m4a#deleted=1' }), // cancellata
    ], { oggi: MERCOLEDI })

    // Il più recente in cima: un report si legge dall'ultima cosa successa.
    expect(r.feedback.map(f => f.nome)).toEqual(['Bruno Rossi', 'Anna Rossi'])
    expect(r.feedback.find(f => f.nome === 'Anna Rossi').testo).toBe('gambe distrutte')
    expect(r.feedback.find(f => f.nome === 'Bruno Rossi').haVocale).toBe(true)
  })

  // ⚠️ Il confronto con la settimana precedente misura tre giorni contro sette
  // finché la settimana è in corso: l'aritmetica è giusta e l'informazione è
  // falsa. `confrontabile` è ciò che impedisce alla pagina di stamparlo.
  it('non dichiara confrontabile una settimana ancora in corso', () => {
    const dati = [
      fatto('a1', '2026-08-19', { rpe: 7 }),                                     // settimana 17–23
      fatto('a1', '2026-08-25', { rpe: 7 }), fatto('a1', '2026-08-27', { rpe: 7 }), // settimana 24–30
      fatto('a1', '2026-08-31', { rpe: 7 }),                                     // settimana in corso
    ]
    expect(reportSettimanale(squadraBase, dati, { oggi: MERCOLEDI }).squadra.delta.confrontabile).toBe(false)
    expect(reportSettimanale(squadraBase, dati, { oggi: MERCOLEDI, scarto: -1 }).squadra.delta.confrontabile).toBe(true)
  })

  it('il carico della squadra dichiara di essere parziale quando qualcuno non ha segnato l\'RPE', () => {
    const r = reportSettimanale(squadraBase, [
      fatto('a1', '2026-09-01', { rpe: 8, minuti: 60 }),
      fatto('a2', '2026-09-01', { minuti: 60 }),
    ], { oggi: MERCOLEDI })

    expect(r.squadra.carico).toBe(480)
    expect(r.squadra.caricoParziale).toBe(true)
    expect(r.squadra.senzaRpe).toBe(1)
  })
})

describe('fraseSettimana', () => {
  const base = {
    squadra: { assegnati: 10, completati: 8, percentuale: 80, daVenire: 0, delta: { carico: 2 } },
    gruppi: { fermo: [], scarica: [], aderenza: [], vuoto: [], carica: [], linea: [] },
    prossima: { senza: 0 },
    settimana: { corrente: false },
  }

  it('dice l\'aderenza, la tendenza del carico e cosa fare', () => {
    const f = fraseSettimana({
      ...base,
      gruppi: { ...base.gruppi, fermo: [1, 2] },
      prossima: { senza: 3 },
    })
    expect(f.testo).toBe('Aderenza 80%, carico stabile.')
    expect(f.dettaglio).toBe('2 da richiamare · 3 senza programma la prossima settimana.')
  })

  // Una riga vuota si legge come un dato mancante. Lo stato buono si dichiara.
  it('quando non c\'è niente da fare lo dice', () => {
    expect(fraseSettimana(base).dettaglio).toBe('Nessun atleta richiede attenzione.')
  })
})

describe('oreMinuti', () => {
  it('scrive in minuti sotto l\'ora, in ore sopra', () => {
    expect(oreMinuti(48)).toBe('48 min')
    expect(oreMinuti(60)).toBe('1h')
    expect(oreMinuti(680)).toBe('11h 20')
  })

  // «0h 48» apre con uno zero e si legge come un dato mancante.
  it('non apre mai con uno zero', () => {
    expect(oreMinuti(0)).toBe('0 min')
    expect(oreMinuti(59)).not.toContain('h')
  })
})
