import { describe, it, expect } from 'vitest'
import cod from './fixtures/fidal-cod.html?raw'
import reg from './fixtures/fidal-reg.html?raw'
import {
  leggiGareCorsa, distanzaDa, luogo, decodifica, PROVINCE, mesiDaLeggere, unisci, urlMese,
} from '../../../supabase/functions/gare-corsa/regole.ts'

// Perché questi test esistono
// ────────────────────────────
// `gare-corsa` legge una pagina HTML che non è nostra: il calendario di
// https://www.fidal.it/calendario.php. Il test gira su due copie VERE di
// novembre 2026 (4/11/2026), ridotte alle righe che contano:
//  · fidal-cod.html = calendario nazionale (livello COD), 16 righe;
//  · fidal-reg.html = calendario regionale (livello REG), 7 righe, più UNA riga
//    presa dal calendario nazionale di giugno 2026 («CAMPIONATI EUROPEI
//    OFF-ROAD RUNNING», tipo MONTAGNA/TRAIL): a novembre non ce n'è nessuna.
// Se un giorno la lettura si rompe, si salva la pagina nuova al posto di
// queste e si vede subito cosa è cambiato. I casi che contano:
//  · escono le annullate, le gare ragazzi, il cross/pista e le gare fuori Italia;
//  · la distanza si decide dal NUMERO di km se c'è, dalle parole solo dopo;
//  · una sigla di provincia che la tabella non conosce non deve passare
//    inosservata (la gara finirebbe senza regione);
//  · una gara a cavallo d'anno prende l'anno giusto per la fine.

const tutte = [...leggiGareCorsa(cod, 2026), ...leggiGareCorsa(reg, 2026)]

describe('leggiGareCorsa sulle pagine vere', () => {
  it('una gara nazionale letta per intero', () => {
    expect(leggiGareCorsa(cod, 2026).find(g => g.id === 'COD14771')).toEqual({
      id: 'COD14771', nome: 'Trofeo del Mare', dal: '2026-11-01', al: '2026-11-01', tipo: 'strada',
      citta: 'Bagheria', provincia: 'PA', regione: 'sicilia', distanza: '10k', livello: 'nazionale',
      url: 'https://www.fidal.it/calendario/XIII^-Trofeo-del-Mare/COD14771',
    })
  })

  it('gara di due giorni', () => {
    const caserta = leggiGareCorsa(cod, 2026).find(g => g.nome.includes('Caserta'))
    expect(caserta).toMatchObject({ dal: '2026-11-21', al: '2026-11-22', distanza: 'mezza', provincia: 'CE' })
  })

  it('escono annullate, cross, ragazzi e gare fuori Italia', () => {
    const nomi = tutte.map(g => g.nome).join('|')
    for (const via of ['Nuraghes', 'Valsugana', 'Kids', 'GIOCHI OLIMPICI', 'CASCINE', 'OFF-ROAD', 'Pecoraro', 'Balcone']) {
      expect(nomi).not.toContain(via)
    }
  })

  it('le annullate vere: «ANN: …» e «… - ANNULLATA» in coda, ma non «Annunziata»', () => {
    // Le prime due sono righe vere di dicembre 2026, in fidal-reg.html.
    expect(reg).toContain('ANN: 1° Memorial')
    expect(reg).toContain('ANNULLATA - ANNULLATA - ANNULLATA')
    const r = (nome, sotto = '') =>
      `<table><tr><td></td><td><b>06/12</b></td><td><abbr>R</abbr></td><td><a href="https://www.fidal.it/calendario/x/REG1">${nome}</a><br><font>${sotto}</font></td><td>STRADA</td><td>Roma RM</td></tr></table>`
    expect(leggiGareCorsa(r('Corsa X - ANNULLATA'), 2026)).toEqual([])
    expect(leggiGareCorsa(r('Corsa X', 'annullata'), 2026)).toEqual([])
    expect(leggiGareCorsa(r('Annullata - Corsa X'), 2026)).toEqual([])
    expect(leggiGareCorsa(r('ANN : Corsa X'), 2026)).toEqual([])
    expect(leggiGareCorsa(r('Corsa dell\'Annunziata'), 2026)).toHaveLength(1)
    expect(leggiGareCorsa(r('Memorial Annalisa'), 2026)).toHaveLength(1)
  })

  it('quante gare restano', () => {
    expect(leggiGareCorsa(cod, 2026)).toHaveLength(13)
    expect(leggiGareCorsa(reg, 2026)).toHaveLength(5)
  })

  it('nome decodificato e senza edizione', () => {
    const nomi = tutte.map(g => g.nome)
    expect(nomi).toContain("Maratona di Ravenna Citta' d'Arte")
    expect(nomi).toContain('Metà Mezza')
    expect(nomi).toContain('STRACASAGIOVE - KM 10,700')
    expect(nomi.some(n => /\^/.test(n))).toBe(false)
  })

  it('più distanze della stessa gara sono più righe, ognuna col suo id', () => {
    const lago = leggiGareCorsa(cod, 2026).filter(g => g.nome.startsWith('Lago Maggiore Marathon'))
    expect(lago.map(g => g.distanza).sort()).toEqual(['10k', 'altre', 'maratona', 'mezza'])
    expect(new Set(lago.map(g => g.id)).size).toBe(4)
  })

  it('regionale: livello e città senza parentesi', () => {
    expect(leggiGareCorsa(reg, 2026).find(g => g.nome === 'Metà Mezza')).toMatchObject({
      citta: 'Trestina', provincia: 'PG', regione: 'umbria', livello: 'regionale', distanza: 'altre', tipo: 'strada',
    })
  })

  it('una città con più parole e la sigla senza parentesi', () => {
    expect(leggiGareCorsa(cod, 2026).find(g => g.id === 'COD15900')).toMatchObject({
      citta: 'Savelletri Di Fasano', provincia: 'BR', regione: 'puglia', distanza: 'mezza',
    })
  })

  it('TRAIL diventa trail', () => {
    expect(leggiGareCorsa(reg, 2026).find(g => g.nome === 'SAGANTINO WINE TRAIL')).toMatchObject({
      tipo: 'trail', distanza: 'trail', provincia: 'PG',
    })
  })

  it('MONTAGNA/TRAIL diventa trail (la riga vera è all\'estero, si sposta a Trento)', () => {
    const riga = reg.slice(reg.indexOf('<tr><td><i', reg.indexOf('OFF-ROAD') - 400))
    expect(riga).toContain('MONTAGNA/TRAIL')
    const tabella = `<table>${riga.slice(0, riga.indexOf('</tr>') + 5)}</table>`
    expect(leggiGareCorsa(tabella, 2026)).toEqual([]) // Ljubljana --: fuori Italia
    expect(leggiGareCorsa(tabella.replace('Ljubljana-kamnik --', 'Trento TN'), 2026)).toMatchObject([
      { tipo: 'trail', distanza: 'trail', provincia: 'TN', regione: 'trentino-alto-adige', livello: 'nazionale' },
    ])
  })

  it('una pagina che non riconosce torna una lista vuota, senza lanciare', () => {
    expect(leggiGareCorsa('<html><body>Manutenzione</body></html>', 2026)).toEqual([])
    expect(leggiGareCorsa('', 2026)).toEqual([])
  })
})

describe('distanzaDa', () => {
  it.each([
    ['42.195km', 'STRADA', 'maratona'], ['Maratonina Citta di Crema', 'STRADA', 'mezza'],
    ['Mezza Maratona', 'STRADA', 'mezza'], ['Ravenna Half Marathon', 'STRADA', 'mezza'],
    ['21.0975km', 'STRADA', 'mezza'], ['XII STRACASAGIOVE - KM 10,700', 'STRADA', '10k'],
    ['Milano21 (10K)', 'STRADA', '10k'], ['Savona Ten 10K', 'STRADA', '10k'], ['Rome 5k', 'STRADA', '5k'],
    ['Egnazia 9.5', 'STRADA', '10k'], ['Metà Mezza', 'STRADA', 'altre'],
    ['Lago Maggiore Marathon - 33 km', 'STRADA', 'altre'], ['Ultramaratona del Mare', 'STRADA', 'altre'],
    ['Qualunque', 'TRAIL', 'trail'], ['Qualunque', 'MONTAGNA/TRAIL', 'trail'], ['Autun Run', 'STRADA', 'altre'],
    ['Corsa 10 km', 'STRADA', '10k'], ['Maratona di Roma 2026', 'STRADA', 'maratona'],
    ['Marathon 5km', 'STRADA', '5k'], ['Dieci Ten', 'STRADA', '10k'],
  ])('distanzaDa(%s, %s) = %s', (t, tipo, atteso) => expect(distanzaDa(t, tipo)).toBe(atteso))
})

describe('luogo', () => {
  it('con parentesi, senza, e fuori Italia', () => {
    expect(luogo('Crema (CR)')).toEqual({ citta: 'Crema', provincia: 'CR' })
    expect(luogo('Roma RM')).toEqual({ citta: 'Roma', provincia: 'RM' })
    expect(luogo('Dakar --')).toEqual({ citta: 'Dakar', provincia: '' })
  })
})

describe('PROVINCE', () => {
  it('copre ogni sigla delle copie e ha 20 regioni', () => {
    expect(new Set(Object.values(PROVINCE)).size).toBe(20)
    expect(tutte.length).toBeGreaterThan(0)
    for (const g of tutte) expect(PROVINCE[g.provincia], `${g.nome} (${g.provincia})`).toBeTruthy()
  })
  it('le sigle che il committente ha nominato ci sono', () => {
    for (const s of ['SU', 'MB', 'BT', 'FM', 'VS', 'CI', 'OT', 'OG', 'AO', 'BZ', 'TN']) expect(PROVINCE[s]).toBeTruthy()
    expect(PROVINCE.AO).toBe('valle-d-aosta')
    expect(PROVINCE.MB).toBe('lombardia')
  })
})

describe('mesi, date e unione', () => {
  it('mesiDaLeggere a cavallo d\'anno', () => {
    expect(mesiDaLeggere('2026-11-04')).toEqual(
      [[2026, 11], [2026, 12], [2027, 1], [2027, 2], [2027, 3], [2027, 4], [2027, 5]].map(([anno, mese]) => ({ anno, mese })),
    )
  })

  const riga = (data, id, nome) =>
    `<tr><td></td><td><b>${data}</b></td><td><abbr>N</abbr></td><td><a href="https://www.fidal.it/calendario/x/${id}">${nome}</a><br><font></font></td><td>STRADA</td><td>Roma RM</td></tr>`

  it('gara a cavallo d\'anno', () => {
    const [g] = leggiGareCorsa(`<table>${riga('30/12-02/01', 'COD1', 'Corsa di Capodanno')}</table>`, 2026)
    expect(g).toMatchObject({ dal: '2026-12-30', al: '2027-01-02' })
  })

  it('una data che non esiste o una fine prima dell\'inizio salta la riga', () => {
    for (const d of ['31/11', '30-02/12', '29/02', '32/01', '10/13']) {
      expect(leggiGareCorsa(`<table>${riga(d, 'COD1', 'Corsa')}</table>`, 2026), d).toEqual([])
    }
    expect(leggiGareCorsa(`<table>${riga('29/02', 'COD1', 'Corsa')}</table>`, 2028)).toHaveLength(1)
    expect(leggiGareCorsa(`<table>${riga('21-22/11', 'COD1', 'Corsa')}</table>`, 2026)).toHaveLength(1)
  })

  it('junior è una gara per ragazzi', () => {
    expect(leggiGareCorsa(`<table>${riga('08/11', 'COD1', 'Trofeo Junior')}</table>`, 2026)).toEqual([])
  })

  it('unisci deduplica e ordina', () => {
    const a = leggiGareCorsa(`<table>${riga('08/11', 'COD2', 'Zeta')}${riga('01/11', 'COD3', 'Beta')}</table>`, 2026)
    const b = leggiGareCorsa(`<table>${riga('08/11', 'COD2', 'Zeta')}${riga('08/11', 'COD4', 'Alfa')}</table>`, 2026)
    expect(unisci([a, b]).map(g => g.id)).toEqual(['COD3', 'COD4', 'COD2'])
  })

  it('urlMese', () => {
    expect(urlMese(2027, 1, 'REG')).toBe('https://www.fidal.it/calendario.php?anno=2027&mese=1&livello=REG&submit=Invia')
  })
})

describe('decodifica', () => {
  it('le entità con nome tengono la maiuscola', () => {
    expect(decodifica('&Egrave; &egrave; &Agrave; &amp; &#8217;')).toBe('È è À & \u2019')
  })
})
