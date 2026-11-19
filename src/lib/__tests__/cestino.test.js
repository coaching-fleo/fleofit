import { describe, it, expect } from 'vitest'
import {
  GIORNI_CESTINO, giorniRimasti, rigaCestino, etichettaVoce, spunteIniziali, finisceNelCestino,
} from '../cestino'

// Il cestino dei workout (19/11/2026): quanto manca alla cancellazione,
// come si legge una voce del ripristino, chi entra nel cestino.

const ORA = new Date('2026-11-19T11:00:00Z')

describe('giorniRimasti', () => {
  it('conta i giorni interi prima dei 14', () => {
    expect(GIORNI_CESTINO).toBe(14)
    expect(giorniRimasti('2026-11-18T16:29:00Z', ORA)).toBe(13)
  })

  it('non scende mai sotto zero', () => {
    expect(giorniRimasti('2026-11-05T10:00:00Z', new Date('2026-11-19T09:00:00Z'))).toBe(0)
    expect(giorniRimasti('2026-10-01T10:00:00Z', ORA)).toBe(0)
  })
})

describe('rigaCestino', () => {
  const riga = {
    titolo: 'SkiErg Tempo · FT+FT 155′ @6', data_workout: '2026-11-16',
    eliminato_il: '2026-11-18T16:29:00Z', eliminato_da_nome: 'Federico',
  }

  it('dice quanto manca', () => {
    expect(rigaCestino(riga, ORA).scade).toBe('si cancella tra 13 giorni')
    expect(rigaCestino({ ...riga, eliminato_il: '2026-11-06T12:00:00Z' }, ORA).scade).toBe('si cancella domani')
    expect(rigaCestino({ ...riga, eliminato_il: '2026-11-05T12:00:00Z' }, ORA).scade).toBe('si cancella oggi')
  })

  it('separa il nome dal codice', () => {
    expect(rigaCestino(riga, ORA).titolo).toBe('SkiErg Tempo')
    expect(rigaCestino(riga, ORA).codice).toBe('FT+FT 155′ @6')
  })

  it('dice chi l\'ha eliminato, se si sa', () => {
    expect(rigaCestino(riga, ORA).eliminato).toMatch(/^eliminato da Federico il 18 nov, \d\d:29$/)
    expect(rigaCestino({ ...riga, eliminato_da_nome: null }, ORA).eliminato).toMatch(/^eliminato il 18 nov, \d\d:29$/)
  })
})

describe('etichettaVoce', () => {
  it('un\'assegnazione completata con RPE e nota vocale', () => {
    expect(etichettaVoce({ tipo: 'assegnazione', atleta: 'Lara', stato: 'completed', notes: '[RPE: 7/10] ok', nota_vocale: true }))
      .toEqual({ titolo: 'Lara', dettaglio: 'completato, RPE 7, nota vocale' })
  })

  it('un\'assegnazione da fare', () => {
    expect(etichettaVoce({ tipo: 'assegnazione', atleta: 'Vittoria', stato: 'pending', notes: null, nota_vocale: false }))
      .toEqual({ titolo: 'Vittoria', dettaglio: 'da fare' })
  })

  it('una sfida', () => {
    expect(etichettaVoce({ tipo: 'sfida', team: 'Squadra A', metrica: 'tempo' }))
      .toEqual({ titolo: 'Sfida · Squadra A', dettaglio: 'tempo' })
  })
})

describe('spunteIniziali', () => {
  it('spunta solo le voci ripristinabili', () => {
    expect([...spunteIniziali([{ id: 'a', ripristinabile: true }, { id: 'b', ripristinabile: false }])]).toEqual(['a'])
    expect(spunteIniziali(null).size).toBe(0)
  })
})

describe('finisceNelCestino', () => {
  it('l\'allenamento libero (autore = un atleta assegnato) resta fuori', () => {
    expect(finisceNelCestino({ creato_da: 'at1' }, ['at1'])).toBe(false)
  })

  it('il workout del coach o senza autore ci entra', () => {
    expect(finisceNelCestino({ creato_da: null }, ['at1'])).toBe(true)
    expect(finisceNelCestino({ creato_da: 'coach' }, ['at1'])).toBe(true)
    expect(finisceNelCestino({ creato_da: 'coach' }, [])).toBe(true)
  })
})
