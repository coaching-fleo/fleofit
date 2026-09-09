import { describe, it, expect } from 'vitest'
import {
  caricoPrevisto, caricoPrevistoDi, collocazioneCarico, caricoAssegnazione,
  biasAtleta, settimanaBersaglio, statoAtleta, acwrProiettato, avvisoAssegnazione,
  previsioneSquadra, previsioneWorkout, finestraPrevisione,
  MINIMO_PRECEDENTI, BIAS_MASSIMO, SEDUTE_BIAS,
} from '../previsione'
import { ACWR_ALTO } from '../reportSettimanale'

// Un martedì: la settimana ha già due giorni alle spalle.
const MARTEDI = new Date('2026-09-01T09:00:00')
// Il lunedì della stessa settimana, alle nove di mattina.
const LUNEDI = new Date('2026-08-31T09:00:00')

const ex = (name, reps, intensity) => ({ name, reps, intensity })

/** Un Hyrox con un EMOM: durata dichiarata, intensità dichiarata. */
const emom = (rounds, intensita) => ([
  { id: 1, type: 'EMOM', params: { interval: '1:00', rounds: String(rounds) },
    exercises: [ex('Wall Balls', '15', intensita)] },
])

const sezioni = (blocks, extra = {}) => ({ category: 'Hyrox', blocks, ...extra })

/** Una riga athlete_workouts chiusa, con RPE dichiarato. */
const chiusa = (data, { rpe = null, sections = sezioni(emom(30, 7)), id } = {}) => ({
  id: id || `aw-${data}-${rpe}`,
  athlete_id: 'a1',
  completed_date: data,
  status: 'completed',
  notes: rpe == null ? '' : `[RPE: ${rpe}/10]\n`,
  workouts: { id: `w-${data}`, title: 'Seduta', sections },
})

const pendente = (data, sections = sezioni(emom(30, 7))) => ({
  id: `aw-p-${data}`, athlete_id: 'a1', completed_date: data, status: 'pending',
  notes: '', workouts: { id: `w-${data}`, title: 'In programma', sections },
})

const ATLETA = { id: 'a1', name: 'Marco', surname: 'Rossi', notes: '' }

/**
 * Uno storico ricco e regolare: quattro settimane piene di sedute misurate,
 * abbastanza da superare MINIMO_SESSIONI_CARICO e MINIMO_SETTIMANE_CARICO.
 */
const storicoRicco = (rpe = 7) => {
  const righe = []
  // Dal 3 agosto al 30 agosto: quattro settimane, tre sedute a settimana.
  for (const giorno of ['08-03', '08-05', '08-07', '08-10', '08-12', '08-14',
                        '08-17', '08-19', '08-21', '08-24', '08-26', '08-28']) {
    righe.push(chiusa(`2026-${giorno}`, { rpe }))
  }
  return righe
}

describe('caricoPrevisto — la quarta cella del builder', () => {
  it('è il prodotto delle due celle che gli stanno accanto', () => {
    const p = caricoPrevisto(emom(30, 8))
    expect(p.minuti).toBe(30)
    expect(p.rpe).toBe(8)
    // Il coach che moltiplica a mente deve ritrovare il numero.
    expect(p.carico).toBe(p.minuti * p.rpe)
    expect(p.carico).toBe(240)
  })

  it('senza intensità dichiarata NON vale zero: il carico non esiste', () => {
    const p = caricoPrevisto([
      { id: 1, type: 'EMOM', params: { interval: '1:00', rounds: '20' },
        exercises: [ex('Wall Balls', '15', undefined)] },
    ])
    expect(p.rpe).toBeNull()
    // Zero direbbe «questa seduta non pesa niente», che è falso.
    expect(p.carico).toBeNull()
    expect(p.carico).not.toBe(0)
  })

  it('legge anche il formato legacy senza `blocks`', () => {
    const legacy = { sections: { warmup: { duration: '10:00' },
      main: { type: 'EMOM', params: { interval: '1:00', rounds: '20' },
              exercises: [ex('Burpees', '10', 8)] } } }
    expect(caricoPrevistoDi(legacy).carico).toBeGreaterThan(0)
  })
})

describe('collocazioneCarico — «sopra la media delle tue sedute»', () => {
  const precedenti = (n, rounds) =>
    Array.from({ length: n }, () => ({ sections: sezioni(emom(rounds, 7)) }))

  it('tace sotto il minimo di precedenti invece di inventare una media', () => {
    expect(collocazioneCarico(300, precedenti(MINIMO_PRECEDENTI - 1, 30))).toBeNull()
    expect(collocazioneCarico(300, precedenti(MINIMO_PRECEDENTI, 30))).not.toBeNull()
  })

  it('confronta solo dentro la stessa corsia', () => {
    // ⚠️ L'intruso deve avere BLOCCHI, o la mutazione «confronta tutte le
    // corsie» resta invisibile: una corsa non ha blocchi, quindi il suo carico
    // è `null` e verrebbe scartato comunque dal filtro sotto. Serve un workout
    // di un'altra corsia che un carico ce l'abbia davvero.
    const misti = [
      ...precedenti(3, 30),
      { sections: { category: 'Custom', isAutonomous: true, blocks: emom(120, 10) } },
    ]
    const c = collocazioneCarico(300, misti, 'Hyrox')
    // Le tre sedute Hyrox valgono 30 × 7 = 210 ciascuna: l'intruso da 1200 non entra.
    expect(c.media).toBe(210)
    expect(c.quante).toBe(3)
  })

  it('dice sopra, sotto e in linea, e il testo porta il numero', () => {
    const base = precedenti(4, 30) // 210 a testa
    expect(collocazioneCarico(300, base).dove).toBe('sopra')
    expect(collocazioneCarico(120, base).dove).toBe('sotto')
    expect(collocazioneCarico(215, base).dove).toBe('linea')
    expect(collocazioneCarico(300, base).testo).toContain('210')
  })

  it('senza carico previsto non si colloca niente', () => {
    expect(collocazioneCarico(null, precedenti(5, 30))).toBeNull()
  })
})

describe('caricoAssegnazione — la scala dello storico', () => {
  it('usa l\'intensità dichiarata dal coach quando c\'è', () => {
    const p = caricoAssegnazione(sezioni(emom(30, 3), { intensity: '9' }))
    expect(p.rpe).toBe(9)
    expect(p.carico).toBe(30 * 9)
  })

  it('senza intensità né blocchi riconoscibili non produce un carico', () => {
    const p = caricoAssegnazione({ category: 'Custom', isAutonomous: true })
    expect(p.rpe).toBeNull()
    expect(p.carico).toBeNull()
  })

  it('una corsa a distanza resta misurabile e non vale zero minuti', () => {
    const corsa = { category: 'Running', intensity: '6',
      steps: [{ type: 'run', duration: '10 km', intensity: '6' }] }
    const p = caricoAssegnazione(corsa)
    expect(p.minuti).toBeGreaterThan(0)
    expect(p.carico).toBeGreaterThan(0)
  })
})

describe('biasAtleta — la calibrazione, e il suo tetto', () => {
  it('tace sotto il minimo di sedute con entrambi i valori', () => {
    const una = [chiusa('2026-08-28', { rpe: 9, sections: sezioni(emom(30, 7), { intensity: '5' }) })]
    expect(biasAtleta(una).valore).toBeNull()
    expect(biasAtleta(una).sessioni).toBe(1)
  })

  it('misura lo scarto fra dichiarato e atteso', () => {
    const righe = ['2026-08-26', '2026-08-28'].map(d =>
      chiusa(d, { rpe: 8, sections: sezioni(emom(30, 7), { intensity: '6' }) }))
    expect(biasAtleta(righe).valore).toBe(2)
  })

  it('si satura: un bias enorme su poche sedute non diventa un allarme', () => {
    const righe = ['2026-08-26', '2026-08-28'].map(d =>
      chiusa(d, { rpe: 10, sections: sezioni(emom(30, 7), { intensity: '1' }) }))
    // Lo scarto grezzo è 9; il tetto lo riporta a BIAS_MASSIMO.
    expect(biasAtleta(righe).valore).toBe(BIAS_MASSIMO)
    expect(biasAtleta(righe).saturato).toBe(true)
  })

  it(`guarda le ultime ${SEDUTE_BIAS} sedute, non tutta la storia`, () => {
    const vecchie = Array.from({ length: SEDUTE_BIAS }, (_, i) =>
      chiusa(`2026-08-${String(10 + i).padStart(2, '0')}`,
        { rpe: 7, sections: sezioni(emom(30, 7), { intensity: '7' }), id: `v${i}` }))
    const recenti = Array.from({ length: SEDUTE_BIAS }, (_, i) =>
      chiusa(`2026-09-${String(10 + i).padStart(2, '0')}`,
        { rpe: 9, sections: sezioni(emom(30, 7), { intensity: '7' }), id: `r${i}` }))
    // Solo le dieci più recenti: scarto +2, non la media +1 di tutte e venti.
    expect(biasAtleta([...vecchie, ...recenti]).valore).toBe(2)
  })
})

describe('settimanaBersaglio', () => {
  it('la settimana di oggi si ferma a oggi, non a domenica', () => {
    const s = settimanaBersaglio('2026-09-04', MARTEDI)
    expect(s.da).toBe('2026-08-31')
    expect(s.fino).toBe('2026-09-01')
    expect(s.corrente).toBe(true)
  })

  it('una settimana futura non ha ancora una parte trascorsa', () => {
    const s = settimanaBersaglio('2026-09-09', MARTEDI)
    expect(s.da).toBe('2026-09-07')
    expect(s.futura).toBe(true)
    expect(s.fino).toBeNull()
  })
})

describe('statoAtleta — l\'aderenza si misura sulla parte TRASCORSA', () => {
  it('il lunedì mattina non accusa nessuno: gli assegnati non sono ancora scaduti', () => {
    const righe = [
      pendente('2026-08-31'), pendente('2026-09-02'),
      pendente('2026-09-04'), pendente('2026-09-05'),
    ]
    const s = statoAtleta(ATLETA, righe, { data: '2026-09-04', oggi: LUNEDI })
    // Quattro assegnati nella settimana, ma oggi è lunedì e nulla è scaduto.
    expect(s.aderenza.assegnati).toBe(0)
    expect(avvisoAssegnazione(s, caricoAssegnazione(sezioni(emom(30, 7))))?.chiave)
      .not.toBe('aderenza')
  })

  it('a metà settimana conta ciò che è davvero passato', () => {
    const righe = [
      chiusa('2026-08-31', { rpe: 7 }), pendente('2026-09-01'), pendente('2026-09-04'),
    ]
    const s = statoAtleta(ATLETA, righe, { data: '2026-09-04', oggi: MARTEDI })
    // Lunedì chiuso conta; martedì pendente è oggi, non è saltato;
    // venerdì non è ancora arrivato.
    expect(s.aderenza).toMatchObject({ assegnati: 1, completati: 1, percentuale: 100 })
  })
})

describe('acwrProiettato — e il cancello dei dati sufficienti', () => {
  it('un atleta nuovo non riceve un ACWR: storico insufficiente', () => {
    const nuovo = [chiusa('2026-08-31', { rpe: 7 })]
    const s = statoAtleta(ATLETA, nuovo, { data: '2026-09-04', oggi: MARTEDI })
    expect(s.carico.acwr).toBeNull()
    expect(acwrProiettato(s, 300)).toBeNull()

    const avviso = avvisoAssegnazione(s, caricoAssegnazione(sezioni(emom(30, 7))))
    // NON verde, e NON un numero: una riga che dice perché il modello tace.
    expect(avviso).not.toBeNull()
    expect(avviso.chiave).toBe('storico')
    expect(avviso.tono).toBe('neutro')
  })

  it('quattro sedute tutte nella STESSA settimana non aprono il cancello', () => {
    // ⚠️ Il caso che giustifica il controllo su `stato.carico.acwr` in testa a
    // `acwrProiettato`, e l'unico che lo prende: qui le sedute misurate sono
    // abbastanza (4), ma stanno in una settimana sola, quindi
    // MINIMO_SETTIMANE_CARICO tiene il rapporto a `null`. Senza quel controllo,
    // il carico proiettato renderebbe «attiva» anche la settimana bersaglio —
    // sulla base di un allenamento che non è ancora stato fatto — e l'atleta
    // nuovo si vedrebbe assegnare un ACWR nato dal nulla.
    const unaSettimana = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27']
      .map(d => chiusa(d, { rpe: 8 }))
    const s = statoAtleta(ATLETA, unaSettimana, { data: '2026-09-04', oggi: MARTEDI })
    expect(s.carico.acwr).toBeNull()
    expect(acwrProiettato(s, 400)).toBeNull()
  })

  it('con uno storico vero il carico previsto alza il rapporto', () => {
    const s = statoAtleta(ATLETA, storicoRicco(7), { data: '2026-09-04', oggi: MARTEDI })
    expect(s.carico.acwr).not.toBeNull()
    expect(acwrProiettato(s, 400)).toBeGreaterThan(s.carico.acwr)
  })

  it('il carico entra ANCHE nel cronico: la forma è quella «coupled»', () => {
    // storicoRicco: tre sedute da 210 in ognuna delle quattro settimane fino al
    // 30 agosto, e niente nella settimana bersaglio. Le quattro settimane del
    // cronico sono quindi [630, 630, 630, 0] e l'acuto è 0.
    const s = statoAtleta(ATLETA, storicoRicco(7), { data: '2026-09-04', oggi: MARTEDI })
    expect(s.carico.acuto).toBe(0)

    // Con 400 previsti: numeratore 400, e il cronico diventa (630×3 + 400) / 4
    // = 572,5 → 0,70. Sommando il carico al SOLO numeratore verrebbe
    // 400 / 472,5 = 0,85, cioè un salto più grande di quello vero.
    expect(acwrProiettato(s, 400)).toBe(0.7)
  })

  it('la seduta prevista NON viene contata fra quelle misurate', () => {
    // Tre sedute misurate: sotto MINIMO_SESSIONI_CARICO (4). Il rapporto tace,
    // e deve continuare a tacere anche proiettando un carico enorme — quella
    // seduta non è ancora successa.
    const tre = ['2026-08-17', '2026-08-24', '2026-08-31'].map(d => chiusa(d, { rpe: 8 }))
    const s = statoAtleta(ATLETA, tre, { data: '2026-09-04', oggi: MARTEDI })
    expect(s.carico.acwr).toBeNull()
    // ⚠️ Il cancello è sullo storico VERO: nemmeno un carico enorme lo apre.
    expect(acwrProiettato(s, 5000)).toBeNull()
    // E l'avviso lo dice invece di tacere.
    expect(avvisoAssegnazione(s, caricoAssegnazione(sezioni(emom(200, 10), { intensity: '10' }))).chiave)
      .toBe('storico')
  })
})

describe('avvisoAssegnazione — un solo motivo, il più grave', () => {
  const previstoNormale = caricoAssegnazione(sezioni(emom(30, 7), { intensity: '7' }))

  it('il verde non si dichiara: chi non ha niente da segnalare resta com\'era', () => {
    // ⚠️ La settimana in corso deve essere al passo abituale, o il rapporto
    // scende sotto ACWR_BASSO e scatta «puoi caricare»: a metà settimana
    // l'atleta ha per forza fatto meno di una settimana intera.
    const righe = [...storicoRicco(7),
      chiusa('2026-08-31', { rpe: 7, id: 'lun' }), chiusa('2026-09-01', { rpe: 7, id: 'mar' })]
    const s = statoAtleta(ATLETA, righe, { data: '2026-09-04', oggi: MARTEDI })
    expect(avvisoAssegnazione(s, previstoNormale)).toBeNull()
  })

  it('un salto di carico è rosso e porta il numero da cui esce', () => {
    const s = statoAtleta(ATLETA, storicoRicco(7), { data: '2026-09-04', oggi: MARTEDI })
    const pesante = caricoAssegnazione(sezioni(emom(120, 10), { intensity: '10' }))
    const avviso = avvisoAssegnazione(s, pesante)
    expect(avviso.chiave).toBe('carico')
    expect(avviso.tono).toBe('allarme')
    expect(acwrProiettato(s, pesante.carico)).toBeGreaterThan(ACWR_ALTO)
    expect(avviso.riga).toMatch(/%/)
  })

  it('la pausa PRECEDE il fermo: chi si è fermato non è «da richiamare»', () => {
    const inPausa = { ...ATLETA, notes: '[PAUSA: 2026-08-20]\nCi sentiamo a settembre' }
    // Nessun allenamento chiuso da settimane: senza la pausa sarebbe «fermo».
    const s = statoAtleta(inPausa, [chiusa('2026-07-20', { rpe: 7 })],
      { data: '2026-09-04', oggi: MARTEDI })
    const avviso = avvisoAssegnazione(s, previstoNormale)
    expect(avviso.chiave).toBe('pausa')
    expect(avviso.riga).toContain('20 ago')
    // E il marcatore non si vede mai come testo.
    expect(avviso.frase).not.toContain('[PAUSA')
  })

  it('la pausa precede anche il CARICO, non solo il fermo', () => {
    // ⚠️ Il caso che ha corretto l'ordine, e che leggendo il codice non si
    // vede: chi è in pausa ha la settimana vuota, quindi qualunque allenamento
    // gli produce un salto enorme. Con il carico davanti, l'atleta che aveva
    // chiesto di fermarsi si ritrova addosso «Carico +112%», cioè esattamente
    // l'allarme che la pausa esiste per togliere.
    const inPausa = { ...ATLETA, notes: '[PAUSA: 2026-08-20]\n' }
    const s = statoAtleta(inPausa, storicoRicco(4), { data: '2026-09-04', oggi: MARTEDI })
    const pesante = caricoAssegnazione(sezioni(emom(120, 10), { intensity: '10' }))
    expect(acwrProiettato(s, pesante.carico)).toBeGreaterThan(ACWR_ALTO)
    expect(avvisoAssegnazione(s, pesante).chiave).toBe('pausa')
  })

  it('chi è fermo lo dice, con i giorni, e SENZA genere', () => {
    const s = statoAtleta(ATLETA, [chiusa('2026-08-20', { rpe: 7 })],
      { data: '2026-09-04', oggi: MARTEDI })
    const avviso = avvisoAssegnazione(s, previstoNormale)
    expect(avviso.chiave).toBe('rientro')
    // ⚠️ Non «Fermo da 12 giorni»: metà degli atleti sono donne e questa riga
    // sta accanto al loro nome. Si dice cosa è successo, non chi l'ha fatto.
    expect(avviso.riga).toBe('Nessun allenamento da 12 giorni')
  })

  it('nessun avviso è declinato al maschile', () => {
    // Ogni ramo, con l'atleta costruito apposta per farlo scattare.
    const casi = [
      [ATLETA, storicoRicco(4), caricoAssegnazione(sezioni(emom(200, 10), { intensity: '10' }))],
      [{ ...ATLETA, notes: '[PAUSA: 2026-08-20]\n' }, storicoRicco(7), previstoNormale],
      [ATLETA, [chiusa('2026-08-20', { rpe: 7 })], previstoNormale],
      [ATLETA, storicoRicco(7), caricoAssegnazione({ category: 'Custom', isAutonomous: true })],
      // ⚠️ Il bias serve nell'elenco: era il ramo con «lui lo sentirà intorno a
      // 10», e senza questo caso la regressione passava.
      [ATLETA, storicoRicco(7).map(r => ({
        ...r, notes: '[RPE: 9/10]\n',
        workouts: { ...r.workouts, sections: sezioni(emom(30, 7), { intensity: '7' }) },
      })), previstoNormale],
    ]
    for (const [atleta, righe, previsto] of casi) {
      const avviso = avvisoAssegnazione(
        statoAtleta(atleta, righe, { data: '2026-09-04', oggi: MARTEDI }), previsto)
      const testo = `${avviso.riga} ${avviso.frase}`
      expect(testo).not.toMatch(/\b(lui|lei|fermo|ferma|assegnargli|assegnarle|chiedergli|chiederle)\b/i)
    }
  })

  it('l\'aderenza bassa dice quanti ne ha già lasciati indietro', () => {
    const righe = [
      ...storicoRicco(7),
      pendente('2026-08-31'),
      { ...pendente('2026-08-31'), id: 'lun-due' },
      chiusa('2026-09-01', { rpe: 7, id: 'fatto-oggi' }),
    ]
    const s = statoAtleta(ATLETA, righe, { data: '2026-09-04', oggi: MARTEDI })
    const avviso = avvisoAssegnazione(s, previstoNormale)
    expect(avviso.chiave).toBe('aderenza')
    expect(avviso.riga).toContain('2')
  })

  it('un altro allenamento nello stesso giorno si segnala', () => {
    const righe = [...storicoRicco(7), pendente('2026-09-04')]
    const s = statoAtleta(ATLETA, righe, { data: '2026-09-04', oggi: MARTEDI })
    const avviso = avvisoAssegnazione(s, previstoNormale)
    expect(avviso.chiave).toBe('accumulo')
    expect(avviso.riga).toContain('quel giorno')
  })

  it('il giorno ACCANTO si segnala solo se entrambe le sedute sono dure', () => {
    const morbida = sezioni(emom(30, 4), { intensity: '4' })
    const dura = sezioni(emom(30, 9), { intensity: '9' })

    const conMorbida = statoAtleta(ATLETA,
      [...storicoRicco(7), pendente('2026-09-05', morbida)],
      { data: '2026-09-04', oggi: MARTEDI })
    expect(avvisoAssegnazione(conMorbida, caricoAssegnazione(dura))?.chiave).not.toBe('accumulo')

    const conDura = statoAtleta(ATLETA,
      [...storicoRicco(7), pendente('2026-09-05', dura)],
      { data: '2026-09-04', oggi: MARTEDI })
    expect(avvisoAssegnazione(conDura, caricoAssegnazione(dura)).chiave).toBe('accumulo')

    // ⚠️ E il vincolo vale sui DUE lati: un allenamento morbido accanto a uno
    // duro non è un accumulo. Senza questo caso, la guardia sulla durezza del
    // workout in arrivo può sparire senza che nessun test se ne accorga.
    expect(avvisoAssegnazione(conDura, caricoAssegnazione(morbida))?.chiave).not.toBe('accumulo')
  })

  it('il bias traduce l\'RPE previsto in quello che quell\'atleta segnerà', () => {
    // Storico regolare, ma segna sempre due punti sopra il previsto.
    const righe = storicoRicco(7).map(r => ({
      ...r,
      notes: '[RPE: 9/10]\n',
      workouts: { ...r.workouts, sections: sezioni(emom(30, 7), { intensity: '7' }) },
    }))
    const s = statoAtleta(ATLETA, righe, { data: '2026-09-04', oggi: MARTEDI })
    const avviso = avvisoAssegnazione(s, previstoNormale)
    expect(avviso.chiave).toBe('bias')
    expect(avviso.riga).toContain('9')
  })

  it('chi non segna MAI l\'RPE non produce un carico: il modello lo dice', () => {
    // Dodici sedute chiuse, nessuna con il marcatore.
    const senzaRpe = storicoRicco(7).map(r => ({ ...r, notes: 'Bella seduta' }))
    const s = statoAtleta(ATLETA, senzaRpe, { data: '2026-09-04', oggi: MARTEDI })
    expect(s.carico.acwr).toBeNull()
    const avviso = avvisoAssegnazione(s, previstoNormale)
    expect(avviso.chiave).toBe('storico')
    // In particolare non ripiega sul 5 di `parseNotesAndRpe`.
    expect(s.carico.acuto).toBe(0)
  })

  it('un workout senza intensità dichiarata NON dà un semaforo verde', () => {
    const s = statoAtleta(ATLETA, storicoRicco(7), { data: '2026-09-04', oggi: MARTEDI })
    const senzaCarico = caricoAssegnazione({ category: 'Custom', isAutonomous: true })
    const avviso = avvisoAssegnazione(s, senzaCarico)
    expect(avviso.chiave).toBe('senzaCarico')
    expect(avviso.tono).not.toBe('buono')
  })

  it('«puoi caricare» richiede che la settimana sia stata seguita', () => {
    // Storico pesante, settimana leggera ma tutta chiusa.
    const righe = [...storicoRicco(9), chiusa('2026-08-31', { rpe: 3, id: 'leggera',
      sections: sezioni(emom(10, 3)) })]
    const s = statoAtleta(ATLETA, righe, { data: '2026-09-04', oggi: MARTEDI })
    const leggero = caricoAssegnazione(sezioni(emom(10, 3), { intensity: '3' }))
    expect(avvisoAssegnazione(s, leggero).chiave).toBe('occasione')

    // Stessa situazione, ma con metà settimana saltata: niente «puoi caricare».
    const conSalti = [...storicoRicco(9),
      pendente('2026-08-31'), { ...pendente('2026-08-31'), id: 'due' }]
    const s2 = statoAtleta(ATLETA, conSalti, { data: '2026-09-04', oggi: MARTEDI })
    expect(avvisoAssegnazione(s2, leggero).chiave).not.toBe('occasione')
  })
})

describe('i due chiamanti', () => {
  it('previsioneSquadra dà un avviso per atleta, e l\'atleta in pausa RESTA', () => {
    const atleti = [
      ATLETA,
      { id: 'a2', name: 'Luca', surname: 'Bianchi', notes: '[PAUSA: 2026-08-20]\n' },
    ]
    const assegnazioni = [...storicoRicco(7),
      ...storicoRicco(7).map(r => ({ ...r, id: `b-${r.id}`, athlete_id: 'a2' }))]
    const { avvisi } = previsioneSquadra(atleti, assegnazioni,
      { sections: sezioni(emom(30, 7), { intensity: '7' }), data: '2026-09-04', oggi: MARTEDI })

    expect(avvisi.size).toBe(2)
    expect(avvisi.has('a2')).toBe(true)
    expect(avvisi.get('a2').chiave).toBe('pausa')
  })

  it('previsioneWorkout calcola lo stato UNA volta per molti workout', () => {
    const workouts = [
      { id: 'w1', sections: sezioni(emom(30, 7), { intensity: '7' }) },
      { id: 'w2', sections: sezioni(emom(120, 10), { intensity: '10' }) },
    ]
    const { stato, avvisi } = previsioneWorkout(ATLETA, storicoRicco(7), workouts,
      { data: '2026-09-04', oggi: MARTEDI })
    expect(stato.carico.acwr).not.toBeNull()
    expect(avvisi.get('w1')).toBeNull()
    expect(avvisi.get('w2').chiave).toBe('carico')
  })

  it('finestraPrevisione copre le quattro settimane del cronico', () => {
    const f = finestraPrevisione(MARTEDI)
    expect(f.da <= '2026-08-03').toBe(true)
    expect(f.a >= '2026-09-13').toBe(true)
  })
})
