import { describe, it, expect, vi } from 'vitest'
import {
  tempoCorto, leggiTempoScritto, divisioneCorta, cittaGara, nomeRecord, rigaRisultato, haRisultato,
  conRisultato, senzaRisultato, conRisultatoDi, daChiedere, splitInOrdine, tempoDallaNota,
  riferimentoDallaNota, riassuntoGara, statisticheSalvate,
  cercaGarePassate, perStagione, giornoSettimana, salvaGaraPassata, elencoGarePassate, CHIAVE_CACHE_PASSATE, nomeDaCercare, leggiIgnorate, ignora, salvaRisultato, CHIAVE_IGNORATE,
} from '../risultatoGara'
import { rpeDichiarato } from '../rpe'
import { gradimentoDi } from '../gradimento'

// Perché questi test esistono
// ────────────────────────────
// Il tempo di gara si salva in due posti che l'atleta può già scrivere (la
// nota dell'assegnazione e un record personale), perché `workouts` lo
// modifica solo il coach e lo schema è congelato. Quello che non deve mai
// succedere:
//  · la riga del tempo finisce DAVANTI a `[RPE: …]`: ogni lettura dell'RPE del
//    progetto è ancorata all'inizio e tornerebbe null, senza errori;
//  · un secondo salvataggio duplica la riga o il record invece di sostituirli;
//  · la domanda «com'è andata?» compare su un evento che non è una gara
//    HYROX, prima della gara, o dopo che l'atleta ha detto «non ho partecipato».

const RISULTATO = {
  tempo: '01:12:38', divisione: 'HYROX PRO - Friday', posizione: '79', posizioneCategoria: '31', categoriaEta: '30-34',
}

describe('tempi', () => {
  it('accorcia il tempo del sito', () => {
    expect(tempoCorto('01:12:38')).toBe('1:12:38')
    expect(tempoCorto('00:58:10')).toBe('58:10')
  })
  it('legge un tempo scritto a mano', () => {
    expect(leggiTempoScritto('1:12:38')).toBe('1:12:38')
    expect(leggiTempoScritto('1.12.38')).toBe('1:12:38')
    expect(leggiTempoScritto('72:38')).toBe('1:12:38')
    expect(leggiTempoScritto('58:10')).toBe('58:10')
    expect(leggiTempoScritto('veloce')).toBeNull()
    expect(leggiTempoScritto('1:75:00')).toBeNull()
  })
  it('la divisione in breve', () => {
    expect(divisioneCorta('HYROX PRO - Friday')).toBe('Pro')
    expect(divisioneCorta('HYROX - Sunday')).toBe('Open')
    expect(divisioneCorta('HYROX PRO DOUBLES - Saturday')).toBe('Pro Doubles')
    expect(divisioneCorta('HYROX TEAM RELAY - Sunday')).toBe('Relay')
    expect(divisioneCorta('')).toBe('')
  })
})

describe('città e record', () => {
  it('la città da sections, poi dal titolo, poi dal link', () => {
    expect(cittaGara({ hyrox: { citta: 'Valencia' } }, 'La mia gara')).toBe('Valencia')
    expect(cittaGara({ hyrox: {} }, 'INTERSPORT HYROX Hamburg')).toBe('Hamburg')
    expect(cittaGara({ hyrox: { url: 'https://hyrox.com/event/hyrox-sao-paulo-2/' } }, 'La gara')).toBe('Sao Paulo')
    expect(cittaGara({ hyrox: { url: 'https://hyrox.com/event/hyrox-nice-s26-27/' } }, 'Nizza!')).toBe('Nice')
  })
  it('il nome del record porta città e anno', () => {
    expect(nomeRecord('Valencia', '2026-10-17')).toBe('HYROX Valencia 2026')
  })
})

describe('la riga nella nota', () => {
  const riga = rigaRisultato(RISULTATO)

  it('dice tempo, divisione e posizioni', () => {
    expect(riga).toBe('🏁 Tempo HYROX: 1:12:38 · Pro · 79° assoluto · 31° di categoria (30-34)')
    expect(rigaRisultato({ tempo: '1:20:00' })).toBe('🏁 Tempo HYROX: 1:20:00')
  })

  it('va in testa alla nota, dopo i marcatori', () => {
    const nota = conRisultato('[RPE: 9/10]\n[GRADIMENTO: si]\nGambe distrutte', riga)
    expect(nota).toBe(`[RPE: 9/10]\n[GRADIMENTO: si]\n${riga}\nGambe distrutte`)
    expect(rpeDichiarato(nota)).toBe(9)
    expect(gradimentoDi(nota)).toBe('si')
    expect(haRisultato(nota)).toBe(true)
  })

  it('un secondo salvataggio sostituisce la riga, non la duplica', () => {
    const prima = conRisultato('Gambe distrutte', riga)
    const dopo = conRisultato(prima, rigaRisultato({ ...RISULTATO, tempo: '01:10:00' }))
    expect(dopo.match(/🏁/g)).toHaveLength(1)
    expect(dopo).toBe('🏁 Tempo HYROX: 1:10:00 · Pro · 79° assoluto · 31° di categoria (30-34)\nGambe distrutte')
  })

  it('su una nota vuota è la sola riga', () => {
    expect(conRisultato(null, riga)).toBe(riga)
  })
})

describe('daChiedere', () => {
  const evento = { sections: { category: 'Event', hyrox: { id: '1' } }, giorno: '2026-10-17', note: '', awId: 'aw1' }

  it('dal giorno dopo la gara, per due mesi', () => {
    expect(daChiedere(evento, '2026-10-17')).toBe(false)
    expect(daChiedere(evento, '2026-10-18')).toBe(true)
    expect(daChiedere(evento, '2026-12-16')).toBe(true)
    expect(daChiedere(evento, '2026-12-17')).toBe(false)
  })
  it('mai su un evento che non viene da una gara HYROX', () => {
    expect(daChiedere({ ...evento, sections: { category: 'Event' } }, '2026-10-18')).toBe(false)
  })
  it('non se il tempo c\'è già, né se l\'atleta ha detto di non aver partecipato', () => {
    expect(daChiedere({ ...evento, note: '🏁 Tempo HYROX: 1:12:38' }, '2026-10-18')).toBe(false)
    expect(daChiedere(evento, '2026-10-18', ['aw1'])).toBe(false)
  })
})

describe('nomeDaCercare', () => {
  it('serve cognome e nome', () => {
    expect(nomeDaCercare({ name: ' Alessandro ', surname: 'Rossi' })).toEqual({ cognome: 'Rossi', nome: 'Alessandro' })
    expect(nomeDaCercare({ name: 'Alessandro' })).toBeNull()
  })
})

describe('«non ho partecipato»', () => {
  it('si ricorda sul dispositivo', () => {
    const dati = {}
    const storage = { getItem: k => dati[k] ?? null, setItem: (k, v) => { dati[k] = v }, removeItem: k => { delete dati[k] } }
    ignora('aw1', storage)
    ignora('aw1', storage)
    expect(leggiIgnorate(storage)).toEqual(['aw1'])
    expect(JSON.parse(dati[CHIAVE_IGNORATE])).toEqual(['aw1'])
  })
})

describe('salvaRisultato', () => {
  function finto({ note = 'Gambe distrutte', record = [] } = {}) {
    const scritture = []
    const catena = (tabella) => {
      const stato = { tabella, op: 'select', dati: null }
      const c = {
        select: () => c, eq: () => c,
        update: (d) => { stato.op = 'update'; stato.dati = d; scritture.push(stato); return c },
        insert: (d) => { stato.op = 'insert'; stato.dati = d; scritture.push(stato); return Promise.resolve({ error: null }) },
        single: () => Promise.resolve({ data: { notes: note }, error: null }),
        then: (ok) => Promise.resolve(stato.op === 'select' ? { data: record, error: null } : { error: null }).then(ok),
      }
      return c
    }
    return { supabase: { from: vi.fn(catena) }, scritture }
  }

  it('scrive la nota, chiude l\'evento e crea il record', async () => {
    const { supabase, scritture } = finto()
    await salvaRisultato(supabase, { awId: 'aw1', athleteId: 'u1', citta: 'Valencia', giorno: '2026-10-17', risultato: RISULTATO })
    expect(scritture[0]).toMatchObject({ tabella: 'athlete_workouts', op: 'update', dati: { status: 'completed' } })
    expect(scritture[0].dati.notes).toMatch(/^🏁 Tempo HYROX: 1:12:38.*\nGambe distrutte$/)
    expect(scritture[1]).toMatchObject({ tabella: 'personal_records', op: 'insert', dati: { athlete_id: 'u1', exercise: 'HYROX Valencia 2026', value: '1:12:38', date: '2026-10-17' } })
  })

  it('un record della stessa gara si aggiorna, non si duplica', async () => {
    const { supabase, scritture } = finto({ record: [{ id: 'pr1' }] })
    await salvaRisultato(supabase, { awId: 'aw1', athleteId: 'u1', citta: 'Valencia', giorno: '2026-10-17', risultato: RISULTATO })
    expect(scritture[1]).toMatchObject({ tabella: 'personal_records', op: 'update', dati: { value: '1:12:38' } })
  })
})

describe('split e lettura della riga', () => {
  it('alterna run e stazioni, nell\'ordine di gara', () => {
    const s = splitInOrdine({
      run: [{ nome: 'Running 1', tempo: '00:02:56' }, { nome: 'Running 2', tempo: '00:03:47' }],
      stazioni: [{ nome: '1000m SkiErg', tempo: '00:04:06', posizione: '54' }, { nome: '50m Sled Push', tempo: '00:03:12', posizione: '40' }],
    })
    expect(s.map(x => `${x.nome} ${x.tempo}`)).toEqual(['Run 1 2:56', '1000m SkiErg 4:06', 'Run 2 3:47', '50m Sled Push 3:12'])
  })
  it('rilegge il tempo dalla nota', () => {
    expect(tempoDallaNota('Bella gara\n🏁 Tempo HYROX: 1:12:38 · Pro · 79° assoluto')).toEqual({ tempo: '1:12:38', dettagli: 'Pro · 79° assoluto' })
    expect(tempoDallaNota('niente')).toBeNull()
  })
})

describe('gare passate', () => {
  const GARE = [
    { gruppo: '2026 Turin', stagione: 8, etichetta: '25/26', anno: '2026', citta: 'Turin' },
    { gruppo: '2025 Turin', stagione: 7, etichetta: '24/25', anno: '2025', citta: 'Turin' },
    { gruppo: '2026 Bologna', stagione: 8, etichetta: '25/26', anno: '2026', citta: 'Bologna' },
  ]

  it('cerca per città e anno', () => {
    expect(cercaGarePassate(GARE, 'turin').map(g => g.gruppo)).toEqual(['2026 Turin', '2025 Turin'])
    expect(cercaGarePassate(GARE, 'turin 2025').map(g => g.gruppo)).toEqual(['2025 Turin'])
    expect(cercaGarePassate(GARE, '')).toHaveLength(3)
  })

  it('divide per stagione, dalla più recente', () => {
    expect(perStagione([GARE[1], GARE[0], GARE[2]]).map(s => [s.etichetta, s.gare.length])).toEqual([['25/26', 2], ['24/25', 1]])
  })

  it('il giorno della settimana dalla categoria, quando c\'è', () => {
    expect(giornoSettimana('HYROX PRO - Saturday')).toBe(6)
    expect(giornoSettimana('HYROX - Friday')).toBe(5)
    expect(giornoSettimana('HYROX PRO')).toBeNull()
  })

  it('l\'elenco usa la copia del telefono se è fresca', async () => {
    const dati = { [CHIAVE_CACHE_PASSATE]: JSON.stringify({ salvate: 1000, gare: GARE }) }
    const storage = { getItem: k => dati[k] ?? null, setItem: (k, v) => { dati[k] = v }, removeItem: k => { delete dati[k] } }
    const invoke = vi.fn()
    expect(await elencoGarePassate({ functions: { invoke } }, { adesso: 2000, storage })).toEqual({ gare: GARE, errore: null })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('salva un evento autonomo già chiuso, con la riga del tempo, e il record', async () => {
    const scritte = []
    const supabase = {
      from: (tabella) => {
        const c = {
          select: () => c, eq: () => c,
          insert: (d) => { scritte.push({ tabella, op: 'insert', d }); return tabella === 'workouts' ? c : Promise.resolve({ error: null }) },
          update: (d) => { scritte.push({ tabella, op: 'update', d }); return c },
          single: () => Promise.resolve({ data: { id: 'w-nuovo' }, error: null }),
          then: (ok) => Promise.resolve({ data: [], error: null }).then(ok),
        }
        return c
      },
    }
    await salvaGaraPassata(supabase, { athleteId: 'u1', gara: GARE[0], giorno: '2026-03-14', risultato: RISULTATO })
    expect(scritte[0]).toMatchObject({ tabella: 'workouts', d: { title: 'HYROX Turin', date: '2026-03-14' } })
    // ⚠️ `isAutonomous: true` è l'unico modo in cui un atleta può inserire un workout (policy RLS)
    expect(scritte[0].d.sections).toMatchObject({ category: 'Event', isEvent: true, isAutonomous: true, hyrox: { gruppo: '2026 Turin', passata: true } })
    expect(scritte[1]).toMatchObject({ tabella: 'athlete_workouts', d: { athlete_id: 'u1', workout_id: 'w-nuovo', status: 'completed', completed_date: '2026-03-14' } })
    expect(scritte[1].d.notes).toMatch(/^🏁 Tempo HYROX: 1:12:38/)
    expect(scritte[2]).toMatchObject({ tabella: 'personal_records', op: 'insert', d: { exercise: 'HYROX Turin 2026', value: '1:12:38', date: '2026-03-14' } })
  })
})

describe('il link al risultato ufficiale', () => {
  const URL_UFF = 'https://results.hyrox.com/season-8/?content=detail&idp=LR3MS4JI462AEB&event=HPRO_LR3MS4JI12AE&lang=EN_CAP'

  it('va sotto la riga del tempo, e si rilegge', () => {
    const nota = conRisultato('[RPE: 9/10]\nGambe distrutte', rigaRisultato(RISULTATO), URL_UFF)
    expect(nota.split('\n')).toEqual([
      '[RPE: 9/10]',
      '🏁 Tempo HYROX: 1:12:38 · Pro · 79° assoluto · 31° di categoria (30-34)',
      `🔗 Risultato ufficiale: ${URL_UFF}`,
      'Gambe distrutte',
    ])
    expect(rpeDichiarato(nota)).toBe(9)
    expect(riferimentoDallaNota(nota)).toEqual({ stagione: 8, idp: 'LR3MS4JI462AEB', evento: 'HPRO_LR3MS4JI12AE' })
  })

  it('un nuovo salvataggio sostituisce anche il link', () => {
    const prima = conRisultato('', rigaRisultato(RISULTATO), URL_UFF)
    const dopo = conRisultato(prima, rigaRisultato(RISULTATO))
    expect(dopo).toBe('🏁 Tempo HYROX: 1:12:38 · Pro · 79° assoluto · 31° di categoria (30-34)')
    expect(riferimentoDallaNota(dopo)).toBeNull()
  })

  it('senza link, o con un link storpiato, nessun riferimento', () => {
    expect(riferimentoDallaNota('🏁 Tempo HYROX: 1:12:38')).toBeNull()
    expect(riferimentoDallaNota('🔗 Risultato ufficiale: https://results.hyrox.com/season-8/?idp=a%27b&event=X')).toBeNull()
  })
})

describe('le statistiche salvate', () => {
  const DETT = {
    tempo: '01:12:38', totaleCorsa: '00:32:22', roxzone: '00:05:22',
    stazioni: [
      { nome: '1000m SkiErg', tempo: '00:04:06', posizione: '54' },
      { nome: '50m Sled Push', tempo: '00:03:12', posizione: '40' },
      { nome: '80m Burpee Broad Jump', tempo: '00:04:24', posizione: '165' },
    ],
  }

  it('riassume corsa, stazioni, Roxzone, la stazione migliore e la peggiore per posizione', () => {
    expect(riassuntoGara(DETT)).toMatchObject({
      corsa: '32:22', roxzone: '5:22', stazioni: '11:42',
      migliore: { nome: '50m Sled Push', pos: 40 },
      peggiore: { nome: '80m Burpee Broad Jump', pos: 165 },
    })
  })

  it('la prima lettura resta nel telefono: la seconda non chiede al sito', async () => {
    const dati = {}
    const storage = { getItem: k => dati[k] ?? null, setItem: (k, v) => { dati[k] = v }, removeItem: k => { delete dati[k] } }
    const invoke = vi.fn(() => Promise.resolve({ data: { stato: 'trovato', dettaglio: DETT }, error: null }))
    const rif = { stagione: 8, idp: 'X1', evento: 'H_X' }
    expect((await statisticheSalvate({ functions: { invoke } }, rif, storage)).tempo).toBe('01:12:38')
    expect((await statisticheSalvate({ functions: { invoke } }, rif, storage)).tempo).toBe('01:12:38')
    expect(invoke).toHaveBeenCalledTimes(1)
  })
})

// 13/10/2026: tempo e link li mostra la card della gara; il riquadro delle
// note mostra solo le parole dell'atleta, e salvarle non cancella il risultato.
describe('le note della gara senza il risultato', () => {
  const riga = '🏁 Tempo HYROX: 1:12:38 · Pro'
  const link = '🔗 Risultato ufficiale: https://results.hyrox.com/season-8/?idp=A1&event=B2'

  it('senzaRisultato toglie tempo e link e lascia il resto', () => {
    expect(senzaRisultato(`${riga}\n${link}\nGambe dure al sled`)).toBe('Gambe dure al sled')
    expect(senzaRisultato(`${riga}\n${link}`)).toBe('')
    expect(senzaRisultato(null)).toBe('')
  })

  it('conRisultatoDi rimette tempo e link davanti al testo nuovo', () => {
    const prima = `${riga}\n${link}\nvecchia nota`
    expect(conRisultatoDi(prima, 'nota nuova')).toBe(`${riga}\n${link}\nnota nuova`)
    expect(conRisultatoDi(prima, '')).toBe(`${riga}\n${link}`)
    expect(conRisultatoDi('senza gara', 'nota')).toBe('nota')
    // Il tempo resta leggibile dopo il salvataggio, e l'RPE resta in testa.
    expect(tempoDallaNota(conRisultatoDi(prima, 'x')).tempo).toBe('1:12:38')
  })
})
