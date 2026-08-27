import { describe, it, expect } from 'vitest'
import {
  atletiFermi, allenamentiScaduti, copertura, feedbackNuovi, squadraDelGiorno,
  atletiSeguiti, contaInPausa, GIORNI_FERMO, FINESTRA_STORICO,
} from '../statisticheCoach'
import { formatNotePausa } from '../pausa'

// Perché questi test esistono
// ────────────────────────────
// Sono i quattro numeri su cui il coach decide la giornata, e nessuno di loro
// può dare errore: sbagliano in silenzio. Un atleta che non compare fra i fermi
// è un atleta che nessuno chiama; una copertura gonfiata è una programmazione
// che sembra fatta e non c'è.
//
// I casi che contano davvero sono quelli in cui la funzione produce un numero
// PLAUSIBILE e falso: l'atleta senza nessun allenamento nella finestra (che
// diventerebbe "fermo da 45 giorni" tondo tondo), il completamento datato nel
// futuro, l'account del coach dentro il totale, la nota che contiene solo il
// marcatore RPE, la nota vocale cancellata con il soft delete.

const OGGI = new Date('2026-08-27T12:00:00Z')       // giovedì
const giorno = (scarto) => new Date(OGGI.getTime() + scarto * 86400000).toISOString().split('T')[0]
const opz = { oggi: OGGI }

const atleta = (id, name = 'Nome', surname = 'Cognome') => ({ id, name, surname, photo_url: null })

const assegnazione = (id, athlete_id, scarto, extra = {}) => ({
  id, athlete_id, completed_date: giorno(scarto), status: 'pending',
  notes: null, voice_note_url: null,
  athletes: { id: athlete_id, name: 'Nome', surname: 'Cognome', photo_url: null },
  workouts: { id: `w-${id}`, title: `Allenamento ${id}`, sections: { category: 'Hyrox' } },
  ...extra,
})

const completata = (id, athlete_id, scarto, extra = {}) =>
  assegnazione(id, athlete_id, scarto, { status: 'completed', ...extra })

// ── atletiFermi ────────────────────────────────────────────────────────────

describe('atletiFermi', () => {
  it('esclude chi si è allenato entro la soglia e include chi l\'ha superata', () => {
    const atleti = [atleta('a'), atleta('b')]
    const righe = atletiFermi(atleti, [
      completata(1, 'a', -4),                     // 4 giorni fa: dentro la soglia
      completata(2, 'b', -9),                     // 9 giorni fa: fermo
    ], opz)
    expect(righe.map(r => r.id)).toEqual(['b'])
    expect(righe[0].giorni).toBe(9)
    expect(righe[0].oltre).toBe(false)
  })

  it('la soglia è inclusiva: esattamente GIORNI_FERMO giorni conta come fermo', () => {
    const righe = atletiFermi([atleta('a')], [completata(1, 'a', -GIORNI_FERMO)], opz)
    expect(righe).toHaveLength(1)
    expect(righe[0].giorni).toBe(GIORNI_FERMO)
  })

  it('chi non ha NESSUN completamento nella finestra è marcato `oltre`', () => {
    // Il caso che sbaglia in silenzio: senza `oltre`, un atleta sparito da sei
    // mesi verrebbe presentato come "fermo da 45 giorni" — preciso e falso.
    const righe = atletiFermi([atleta('a')], [], opz)
    expect(righe[0].giorni).toBe(FINESTRA_STORICO)
    expect(righe[0].oltre).toBe(true)
  })

  it('un allenamento assegnato ma NON completato non azzera il contatore', () => {
    const righe = atletiFermi([atleta('a')], [assegnazione(1, 'a', -1)], opz)
    expect(righe).toHaveLength(1)
    expect(righe[0].oltre).toBe(true)
  })

  it('un completamento datato nel futuro non conta come allenamento fatto', () => {
    // Succede: il coach assegna a domani e l\'atleta lo segna in anticipo.
    // Prenderlo come "ultimo allenamento" nasconderebbe un fermo reale.
    const righe = atletiFermi([atleta('a')], [completata(1, 'a', +2)], opz)
    expect(righe).toHaveLength(1)
    expect(righe[0].oltre).toBe(true)
  })

  it('porta la data dell\'ultimo allenamento, e NON la inventa per chi non ne ha', () => {
    // La riga in Home scrive «ultimo 18 ago» sotto la barra. Per chi non ha
    // nessun completamento nella finestra quella data non esiste: mostrarne una
    // qualsiasi (il bordo della finestra) sarebbe precisa e falsa.
    const f = atletiFermi([atleta('a'), atleta('b')], [completata(1, 'a', -9)], opz)
    const conStorico = f.find(x => x.id === 'a')
    const senzaStorico = f.find(x => x.id === 'b')
    expect(conStorico.ultimo).toBe(giorno(-9))
    expect(conStorico.ultimoEtichetta).toBe('18 ago')
    expect(senzaStorico.ultimo).toBeNull()
    expect(senzaStorico.ultimoEtichetta).toBeNull()
    expect(senzaStorico.oltre).toBe(true)
  })

  it('ordina dal più fermo, ed è quello per cui la telefonata è più urgente', () => {
    const atleti = [atleta('a', 'Anna'), atleta('b', 'Bruno'), atleta('c', 'Carla')]
    const righe = atletiFermi(atleti, [
      completata(1, 'a', -6), completata(2, 'b', -20), completata(3, 'c', -8),
    ], opz)
    expect(righe.map(r => r.giorni)).toEqual([20, 8, 6])
  })

  it('compone il nome e regge un atleta senza cognome', () => {
    const righe = atletiFermi([{ id: 'a', name: 'Anna', surname: null }], [], opz)
    expect(righe[0].nome).toBe('Anna')
  })
})

// ── la pausa ───────────────────────────────────────────────────────────────

describe('gli atleti in pausa', () => {
  const inPausa = (id, name) => ({ ...atleta(id, name), notes: formatNotePausa('2026-08-20', 'Ha chiesto una sosta') })

  it('non compaiono fra chi richiede attenzione, per quanto fermi siano', () => {
    // È tutto il punto della funzione: l'atleta ha AVVISATO che si ferma, e
    // continuare a segnalarlo trasforma l'unico allarme della Home in rumore.
    const righe = atletiFermi([atleta('a'), inPausa('b')], [], opz)
    expect(righe.map(r => r.id)).toEqual(['a'])
  })

  it('escono anche dal totale della copertura', () => {
    // Contarli fra i «senza allenamento» vorrebbe dire chiedere al coach di
    // programmare per chi ha chiesto di fermarsi.
    const c = copertura([atleta('a'), atleta('b'), inPausa('c')], [assegnazione(1, 'a', 0)], opz)
    expect(c).toEqual({ coperti: 1, totale: 2, senza: 1 })
  })

  it('restano nella rubrica: `atletiSeguiti` filtra, non cancella', () => {
    const tutti = [atleta('a'), inPausa('b'), atleta('c')]
    expect(atletiSeguiti(tutti).map(x => x.id)).toEqual(['a', 'c'])
    expect(contaInPausa(tutti)).toBe(1)
    expect(tutti).toHaveLength(3)
  })

  it('una nota normale non mette nessuno in pausa', () => {
    const conNota = { ...atleta('b'), notes: 'Preferisce allenarsi la sera' }
    expect(atletiFermi([conNota], [], opz)).toHaveLength(1)
    expect(contaInPausa([conNota])).toBe(0)
  })
})

// ── allenamentiScaduti ─────────────────────────────────────────────────────

describe('allenamentiScaduti', () => {
  const RUBRICA = [atleta('a')]

  it('prende i pendenti con data passata, non quelli di oggi né i completati', () => {
    const scaduti = allenamentiScaduti(RUBRICA, [
      assegnazione(1, 'a', -3),
      assegnazione(2, 'a', 0),                    // oggi: non è scaduto
      completata(3, 'a', -5),                     // fatto: non è lavoro
      assegnazione(4, 'a', +1),                   // futuro
    ], opz)
    expect(scaduti.map(s => s.id)).toEqual([1])
    expect(scaduti[0].giorni).toBe(3)
  })

  it('il più recente per primo: uno scaduto ieri si recupera, uno di un mese fa è archeologia', () => {
    const scaduti = allenamentiScaduti(RUBRICA, [
      assegnazione(1, 'a', -20), assegnazione(2, 'a', -1), assegnazione(3, 'a', -7),
    ], opz)
    expect(scaduti.map(s => s.id)).toEqual([2, 3, 1])
  })

  it('ignora quelli fuori dalla finestra e rispetta il limite', () => {
    const vecchio = allenamentiScaduti(RUBRICA, [assegnazione(1, 'a', -(FINESTRA_STORICO + 1))], opz)
    expect(vecchio).toHaveLength(0)
    const molti = allenamentiScaduti(RUBRICA,
      [1, 2, 3, 4, 5, 6].map(i => assegnazione(i, 'a', -i)), { ...opz, limite: 2 })
    expect(molti).toHaveLength(2)
  })

  it('normalizza la categoria autonoma su Custom, come ovunque nella Home', () => {
    const scaduti = allenamentiScaduti(RUBRICA, [
      assegnazione(1, 'a', -2, { workouts: { id: 'w', title: 't', sections: { isAutonomous: true } } }),
    ], opz)
    expect(scaduti[0].categoria).toBe('Custom')
  })

  it('lo scaduto di un atleta in pausa non è lavoro da smaltire', () => {
    // È la conseguenza attesa della pausa: mostrarlo rimette in Home proprio
    // l'atleta che si era chiesto di togliere. Resta nella sua scheda.
    const rubrica = [{ ...atleta('a'), notes: formatNotePausa('2026-08-20', 'sosta') }]
    expect(allenamentiScaduti(rubrica, [assegnazione(1, 'a', -3)], opz)).toHaveLength(0)
  })

  it('lo scaduto di chi non è in rubrica non è lavoro di nessuno', () => {
    expect(allenamentiScaduti(RUBRICA, [assegnazione(1, 'fantasma', -3)], opz)).toHaveLength(0)
  })
})

// ── copertura ──────────────────────────────────────────────────────────────

describe('copertura', () => {
  const atleti = [atleta('a'), atleta('b'), atleta('c')]

  it('conta gli atleti coperti una volta sola, anche con più assegnazioni', () => {
    const c = copertura(atleti, [
      assegnazione(1, 'a', 0), assegnazione(2, 'a', +1), assegnazione(3, 'b', +2),
    ], opz)
    expect(c).toEqual({ coperti: 2, totale: 3, senza: 1 })
  })

  it('la finestra è oggi + 2: ieri non copre, il quarto giorno nemmeno', () => {
    // Il caso che gonfia il numero in silenzio: contare ieri fa sembrare
    // programmato chi non lo è più.
    expect(copertura(atleti, [assegnazione(1, 'a', -1)], opz).coperti).toBe(0)
    expect(copertura(atleti, [assegnazione(1, 'a', +3)], opz).coperti).toBe(0)
    expect(copertura(atleti, [assegnazione(1, 'a', +2)], opz).coperti).toBe(1)
  })

  it('un\'assegnazione a un id che non è fra gli atleti non copre nessuno', () => {
    // È il caso dell\'account del coach e degli atleti eliminati: righe che
    // esistono ancora in athlete_workouts ma non sono nella rubrica.
    const c = copertura(atleti, [assegnazione(1, 'fantasma', 0)], opz)
    expect(c).toEqual({ coperti: 0, totale: 3, senza: 3 })
  })

  it('senza atleti non divide per zero', () => {
    expect(copertura([], [], opz)).toEqual({ coperti: 0, totale: 0, senza: 0 })
  })
})

// ── feedbackNuovi ──────────────────────────────────────────────────────────

const VOCALE = 'https://x/voice-notes/a.m4a'

describe('feedbackNuovi', () => {
  it('conta separatamente vocali e note, e il totale è la somma', () => {
    const f = feedbackNuovi([
      completata(1, 'a', -1, { voice_note_url: VOCALE }),
      completata(2, 'b', -2, { notes: '[RPE: 8/10]\nfaticoso' }),
    ], [], opz)
    expect(f).toMatchObject({ vocali: 1, note: 1, totale: 2 })
    expect(f.elementi).toHaveLength(2)
  })

  it('una nota vocale cancellata con il soft delete NON è feedback', () => {
    // `#deleted=` è l\'unica traccia della cancellazione: chi legge
    // voice_note_url senza filtrare conta note che non esistono più.
    const f = feedbackNuovi([
      completata(1, 'a', -1, { voice_note_url: `${VOCALE}#deleted=1756200000000` }),
    ], [], opz)
    expect(f.totale).toBe(0)
  })

  it('una nota che contiene SOLO il marcatore RPE conta come nota', () => {
    const f = feedbackNuovi([completata(1, 'a', -1, { notes: '[RPE: 6/10]' })], [], opz)
    expect(f).toMatchObject({ note: 1, totale: 1 })
    expect(f.elementi[0].rpe).toBe(6)
  })

  it('una nota vuota o di soli spazi non è feedback', () => {
    expect(feedbackNuovi([completata(1, 'a', -1, { notes: '   ' })], [], opz).totale).toBe(0)
  })

  it('gli id già letti spariscono dal conteggio', () => {
    const righe = [
      completata(1, 'a', -1, { voice_note_url: VOCALE }),
      completata(2, 'b', -1, { notes: '[RPE: 7/10]\nok' }),
    ]
    expect(feedbackNuovi(righe, [1], opz)).toMatchObject({ totale: 1, vocali: 0, note: 1 })
    expect(feedbackNuovi(righe, [1, 2], opz).totale).toBe(0)
  })

  it('il feedback su un allenamento NON completato non si conta', () => {
    // voice_note_url è una colonna sola per una comunicazione bidirezionale:
    // fuori dal completamento non si sa chi ha parlato, e una nota del coach a
    // sé stesso non è feedback in entrata.
    const f = feedbackNuovi([assegnazione(1, 'a', -1, { voice_note_url: VOCALE })], [], opz)
    expect(f.totale).toBe(0)
  })

  it('l\'etichetta del quando è «oggi», «ieri», poi la data breve', () => {
    const f = feedbackNuovi([
      completata(1, 'a', 0, { notes: 'oggi' }),
      completata(2, 'a', -1, { notes: 'ieri' }),
      completata(3, 'a', -5, { notes: 'la settimana scorsa' }),
    ], [], opz)
    expect(f.elementi.map(e => e.quando)).toEqual(['oggi', 'ieri', '22 ago'])
  })

  it('resta dentro la finestra e mette il più recente per primo', () => {
    const f = feedbackNuovi([
      completata(1, 'a', -30, { voice_note_url: VOCALE }),
      completata(2, 'a', -5, { voice_note_url: VOCALE }),
      completata(3, 'a', -1, { voice_note_url: VOCALE }),
    ], [], opz)
    expect(f.elementi.map(e => e.id)).toEqual([3, 2])
  })

  it('una riga con vocale E nota vale due, ma resta un solo elemento in lista', () => {
    const f = feedbackNuovi([
      completata(1, 'a', -1, { voice_note_url: VOCALE, notes: '[RPE: 9/10]\nduro' }),
    ], [], opz)
    expect(f).toMatchObject({ vocali: 1, note: 1, totale: 2 })
    expect(f.elementi).toHaveLength(1)
  })
})

// ── squadraDelGiorno ───────────────────────────────────────────────────────
//
// Sostituisce `attivitaRecente`. La differenza non è cosmetica: quella lista
// elencava gli eventi, questa descrive un INSIEME — cinque su sette — e un
// insieme sbaglia in modi che una lista non può avere (l'atleta contato due
// volte, il denominatore che include chi non era programmato).

describe('squadraDelGiorno', () => {
  const tre = [atleta('a1', 'Marco'), atleta('a2', 'Sara'), atleta('a3', 'Elena')]

  it('tiene solo chi era programmato quel giorno, e conta i completati', () => {
    const s = squadraDelGiorno(tre, [
      completata(1, 'a1', 0), assegnazione(2, 'a2', 0), completata(3, 'a3', -1),
    ], opz)
    expect(s.assegnati).toBe(2)          // Elena si è allenata ieri: non è di oggi
    expect(s.completati).toBe(1)
    expect(s.righe.map(r => r.id)).toEqual(['a1', 'a2'])
  })

  it('`scarto: -1` guarda ieri, con lo stesso codice', () => {
    const s = squadraDelGiorno(tre, [completata(3, 'a3', -1), completata(1, 'a1', 0)], { ...opz, scarto: -1 })
    expect(s.righe.map(r => r.id)).toEqual(['a3'])
    expect(s.completati).toBe(1)
  })

  it('un atleta con due assegnazioni nello stesso giorno conta UNA volta, e vince quella completata', () => {
    // Senza, il denominatore direbbe «1 su 2» per una persona sola, e il
    // pallino verde verrebbe annullato da una riga rimasta aperta.
    const s = squadraDelGiorno(tre, [assegnazione(1, 'a1', 0), completata(2, 'a1', 0)], opz)
    expect(s.assegnati).toBe(1)
    expect(s.completati).toBe(1)
    expect(s.righe[0].stato).toBe('completato')
  })

  it('`inCorso` distingue chi si sta allenando ADESSO da chi non ha ancora iniziato', () => {
    const s = squadraDelGiorno(tre, [assegnazione(1, 'a1', 0), assegnazione(2, 'a2', 0)],
      { ...opz, inCorso: ['a2'] })
    expect(s.righe.find(r => r.id === 'a2').stato).toBe('in corso')
    expect(s.righe.find(r => r.id === 'a1').stato).toBe('da fare')
    expect(s.inCorso).toBe(1)
  })

  it('un allenamento in corso NON è completato: il conteggio non lo include', () => {
    const s = squadraDelGiorno(tre, [assegnazione(1, 'a1', 0)], { ...opz, inCorso: ['a1'] })
    expect(s.completati).toBe(0)
  })

  it('chi non ha ancora fatto niente va in fondo, gli altri in ordine di nome', () => {
    const s = squadraDelGiorno(tre, [
      assegnazione(1, 'a1', 0),                 // Marco, da fare
      completata(2, 'a2', 0),                   // Sara, fatto
      completata(3, 'a3', 0),                   // Elena, fatto
    ], opz)
    expect(s.righe.map(r => r.nome)).toEqual(['Elena', 'Sara', 'Marco'])
  })

  it('la media RPE usa solo i valori DICHIARATI, non il ripiego 5', () => {
    // È lo stesso difetto già corretto in `mediaRpeCategoria` (§9-octies): un
    // numero plausibile e falso è peggio di un numero assente.
    const s = squadraDelGiorno(tre, [
      completata(1, 'a1', 0, { notes: '[RPE: 8/10]\nok' }),
      completata(2, 'a2', 0, { notes: '[RPE: 7/10]\nok' }),
      completata(3, 'a3', 0, { notes: 'nessun marcatore' }),
    ], opz)
    expect(s.rpeMedio).toBe(7.5)
  })

  it('senza nessun RPE dichiarato la media è null, non zero', () => {
    const s = squadraDelGiorno(tre, [completata(1, 'a1', 0, { notes: 'testo libero' })], opz)
    expect(s.rpeMedio).toBeNull()
  })

  it('gli atleti in pausa escono anche da qui, denominatore compreso', () => {
    const conPausa = { ...atleta('a1', 'Marco'), notes: formatNotePausa('2026-08-20', 'sosta') }
    const s = squadraDelGiorno([conPausa, atleta('a2', 'Sara')],
      [assegnazione(1, 'a1', 0), completata(2, 'a2', 0)], opz)
    expect(s.assegnati).toBe(1)
    expect(s.righe[0].nome).toBe('Sara')
  })

  it('l\'assegnazione di chi non è in rubrica non entra nella squadra', () => {
    // È il caso dell'account del coach, che è una riga `athletes` come le altre
    // ma viene filtrato prima: qui la sua assegnazione non deve rientrare.
    const s = squadraDelGiorno([atleta('a1', 'Marco')], [completata(1, 'sconosciuto', 0)], opz)
    expect(s.assegnati).toBe(0)
  })

  it('mostra il nome proprio, non il nome completo: è un\'etichetta larga 54px', () => {
    const s = squadraDelGiorno([atleta('a1', 'Marco', 'Bianchi')], [completata(1, 'a1', 0)], opz)
    expect(s.righe[0].nome).toBe('Marco')
  })
})
