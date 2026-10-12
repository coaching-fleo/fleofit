import { describe, it, expect } from 'vitest'
import stagione from './fixtures/risultati-stagione.html?raw'
import categorie from './fixtures/risultati-categorie.html?raw'
import ricerca from './fixtures/risultati-ricerca.html?raw'
import dettaglio from './fixtures/risultati-dettaglio.html?raw'
import ricercaDoubles from './fixtures/risultati-ricerca-doubles.html?raw'
import {
  leggiStagioni, leggiGruppi, trovaGruppo, etichettaStagione, ordineStagioni, leggiCategorie,
  leggiRicerca, leggiDettaglio, urlRicerca, corrispondenza, ordinaCandidati, validaRichiesta,
  garePassate, validaRicercaDiretta, validaDettaglio, nomeSquadra,
} from '../../../supabase/functions/risultato-hyrox/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// `risultato-hyrox` legge quattro pagine di results.hyrox.com che non sono
// nostre: le copie in fixtures/ sono VERE (12/10/2026). Se un giorno la
// lettura si rompe, si salva la pagina nuova al posto della copia e si vede
// quale test cade. I casi che contano di più:
//  · la ricerca va fatta in OGNI categoria: senza `event` il sito cerca solo
//    nella prima, e un atleta Open non verrebbe mai trovato;
//  · il sito cerca per prefisso («Rossi» trova «Rossin»): una corrispondenza
//    piena va prima, ed è l'unica che il telefono propone come «è tuo?».

describe('stagioni e gruppi', () => {
  it('legge le stagioni dalla più recente', () => {
    const s = leggiStagioni(stagione)
    expect(s[0]).toEqual({ numero: 9, etichetta: 'Season 26/27' })
    expect(s[1]).toEqual({ numero: 8, etichetta: 'Season 25/26' })
  })

  it('la stagione HYROX comincia ad agosto', () => {
    expect(etichettaStagione('2026-10-15')).toBe('26/27')
    expect(etichettaStagione('2026-03-14')).toBe('25/26')
    expect(etichettaStagione('2026-08-01')).toBe('26/27')
  })

  it('cerca prima nella stagione della data, poi in quella accanto', () => {
    const s = leggiStagioni(stagione)
    expect(ordineStagioni(s, '2026-03-14').map(x => x.numero)).toEqual([8, 9])
    expect(ordineStagioni(s, '2026-10-15').map(x => x.numero)).toEqual([9, 8])
  })

  it('trova il gruppo di una gara senza accenti, e salta le Youngstars', () => {
    const g = leggiGruppi(stagione)
    expect(trovaGruppo(g, 'São Paulo', '2026')).toBe('2026 Sao Paulo')
    expect(trovaGruppo(g, 'Valencia', '2026')).toBe('2026 Valencia')
    expect(trovaGruppo(g, 'Washington', '2026')).toBe('2026 Washington DC')
    expect(trovaGruppo(g, 'Valencia', '2025')).toBeNull()
    expect(trovaGruppo(g, 'Milan', '2026')).toBeNull()
  })
})

describe('categorie e ricerca', () => {
  it('cerca in tutte le categorie tranne le «Overall»', () => {
    const c = leggiCategorie(categorie)
    expect(c).toHaveLength(13)
    expect(c.some(x => /overall/i.test(x.codice + x.nome))).toBe(false)
    expect(c[0]).toEqual({ codice: 'HPRO_LR3MS4JI12AE', nome: 'HYROX PRO - Friday' })
  })

  it('l\'URL di ricerca porta categoria, cognome e nome', () => {
    const u = new URL(urlRicerca(8, '2026 Turin', 'H_X', 'Rossi', 'Alessandro'))
    expect(u.pathname).toBe('/season-8/')
    expect(u.searchParams.get('event')).toBe('H_X')
    expect(u.searchParams.get('event_main_group')).toBe('2026 Turin')
    expect(u.searchParams.get('search[name]')).toBe('Rossi')
    expect(u.searchParams.get('search[firstname]')).toBe('Alessandro')
  })

  // 🔴 Senza `search_event` nei Doubles e nelle staffette il sito non trova i
  // componenti della squadra (verificato il 12/10/2026).
  it('porta anche `search_event`, e senza nome cerca il solo cognome', () => {
    const u = new URL(urlRicerca(8, '2026 Turin', 'HD_X', 'Rossi'))
    expect(u.searchParams.get('search_event')).toBe('HD_X')
    expect(u.searchParams.has('search[firstname]')).toBe(false)
  })

  it('legge le righe dei Doubles, con la coppia senza ripetizioni', () => {
    const righe = leggiRicerca(ricercaDoubles)
    expect(righe.length).toBeGreaterThan(1)
    expect(righe.every(r => r.evento.startsWith('HD_'))).toBe(true)
    expect(righe.every(r => r.nome.split(', ').length === 2)).toBe(true)
    expect(righe.some(r => /\bRossi\b/.test(r.nome))).toBe(true)
  })

  it('una squadra perde le ripetizioni del sito, un individuale resta com\'è', () => {
    expect(nomeSquadra('Anna Bianchi, Anna Bianchi, Luca Rossi, Luca Rossi')).toBe('Anna Bianchi, Luca Rossi')
    expect(nomeSquadra('Rossi, Alessandro (ITA)')).toBe('Rossi, Alessandro (ITA)')
  })

  it('legge le righe e scarta la riga ripetuta dal sito', () => {
    expect(leggiRicerca(ricerca)).toEqual([{
      idp: 'LR3MS4JI462AEB', evento: 'HPRO_LR3MS4JI12AE', nome: 'Rossi, Alessandro (ITA)',
      nazione: 'ITA', categoriaEta: '30-34', tempo: '01:12:38',
    }])
  })
})

describe('dettaglio', () => {
  const d = leggiDettaglio(dettaglio)

  it('legge tempo, categoria e posizioni', () => {
    expect(d).toMatchObject({
      nome: 'Rossi, Alessandro (ITA)', divisione: 'HYROX PRO - Friday', categoriaEta: '30-34',
      tempo: '01:12:38', posizione: '79', posizioneCategoria: '31',
      roxzone: '00:05:22', totaleCorsa: '00:32:22',
    })
  })

  it('legge gli otto run e le otto stazioni, nell\'ordine di gara', () => {
    expect(d.run).toHaveLength(8)
    expect(d.run[0]).toEqual({ nome: 'Running 1', tempo: '00:02:56', posizione: '' })
    expect(d.stazioni.map(s => s.nome)).toEqual([
      '1000m SkiErg', '50m Sled Push', '50m Sled Pull', '80m Burpee Broad Jump',
      '1000m Row', '200m Farmers Carry', '100m Sandbag Lunges', 'Wall Balls',
    ])
    expect(d.stazioni[7]).toEqual({ nome: 'Wall Balls', tempo: '00:06:59', posizione: '153' })
  })

  it('una pagina senza tempo non è un risultato', () => {
    expect(leggiDettaglio('<html>Not found</html>')).toBeNull()
  })
})

describe('corrispondenza', () => {
  it('piena, solo cognome, solo prefisso', () => {
    expect(corrispondenza({ nome: 'Rossi, Alessandro (ITA)' }, 'rossi', 'Alessandro')).toBe(2)
    expect(corrispondenza({ nome: 'Rossi, Alessandra (ITA)' }, 'Rossi', 'Alessandro')).toBe(1)
    expect(corrispondenza({ nome: 'Rossin, Alessandro (ITA)' }, 'Rossi', 'Alessandro')).toBe(0)
    expect(corrispondenza({ nome: 'Müller, Jörg (GER)' }, 'Muller', 'Jorg')).toBe(2)
  })

  it('nelle squadre guarda ogni componente', () => {
    expect(corrispondenza({ nome: 'Beatrice Schelfi, Stefano Rossi' }, 'Rossi', 'Stefano')).toBe(2)
    expect(corrispondenza({ nome: 'Beatrice Schelfi, Stefano Rossi' }, 'Rossi', 'Luca')).toBe(1)
    expect(corrispondenza({ nome: 'Maria Sorrentino, Laura Rossin' }, 'Rossi', 'Laura')).toBe(0)
    expect(corrispondenza({ nome: 'Luca Rossi Provesi, Alberto Abbate' }, 'Rossi Provesi', 'Luca')).toBe(2)
  })

  it('le corrispondenze piene vanno prima', () => {
    const o = ordinaCandidati([{ nome: 'Rossin, Alessandro (ITA)' }, { nome: 'Rossi, Alessandro (ITA)' }], 'Rossi', 'Alessandro')
    expect(o.map(r => [r.nome, r.corrispondenza])).toEqual([['Rossi, Alessandro (ITA)', 2], ['Rossin, Alessandro (ITA)', 0]])
  })
})

describe('validaRichiesta', () => {
  it('pretende città, data e cognome; il nome è facoltativo', () => {
    expect(validaRichiesta({ citta: 'Turin', data: '2026-03-14', cognome: 'Rossi', nome: 'Alessandro' })).toBeNull()
    expect(validaRichiesta({ citta: 'Turin', data: '2026-03-14', cognome: 'Rossi' })).toBeNull()
    expect(validaRichiesta({ citta: 'Turin', data: '2026-03-14', nome: 'Alessandro' })).toMatch(/cognome/)
    expect(validaRichiesta({ citta: 'Turin', data: '14/03/2026', cognome: 'Rossi', nome: 'A' })).toMatch(/Data/)
    expect(validaRichiesta(null)).toMatch(/non valida/)
  })
})

describe('gare passate', () => {
  it('elenca le gare di una stagione con anno e città, senza Youngstars', () => {
    const g = garePassate(leggiGruppi(stagione), { numero: 9, etichetta: 'Season 26/27' })
    expect(g.some(x => /youngstars/i.test(x.gruppo))).toBe(false)
    expect(g).toContainEqual({ gruppo: '2026 Sao Paulo', stagione: 9, etichetta: '26/27', anno: '2026', citta: 'Sao Paulo' })
    expect(g.find(x => x.citta === 'Washington DC')).toBeTruthy()
  })

  it('la ricerca su una gara scelta vuole gruppo, stagione, cognome e nome', () => {
    expect(validaRicercaDiretta({ gruppo: '2026 Turin', stagione: 8, cognome: 'Rossi', nome: 'A' })).toBeNull()
    expect(validaRicercaDiretta({ gruppo: '2026 Turin', stagione: '8', cognome: 'Rossi', nome: 'A' })).toMatch(/Stagione/)
    expect(validaRicercaDiretta({ gruppo: '', stagione: 8, cognome: 'Rossi', nome: 'A' })).toMatch(/gruppo/)
    expect(validaRicercaDiretta({ gruppo: '2026 Turin', stagione: 8, nome: 'A' })).toMatch(/cognome/)
  })
})

describe('validaDettaglio', () => {
  it('accetta solo gli id come li dà il sito', () => {
    expect(validaDettaglio({ stagione: 8, idp: 'LR3MS4JI462AEB', evento: 'HPRO_LR3MS4JI12AE' })).toBeNull()
    expect(validaDettaglio({ stagione: 8, idp: 'x&y=1', evento: 'H_X' })).toMatch(/idp/)
    expect(validaDettaglio({ stagione: '8', idp: 'a', evento: 'b' })).toMatch(/Stagione/)
  })
})
