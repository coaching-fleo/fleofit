import { describe, it, expect } from 'vitest'
import { etichettaRuolo, riassuntoBackup, riassuntoCodici } from '../rigaImpostazioni'

// Perché questi test esistono
// ────────────────────────────
// Sono le tre righe che nel rework del 01/09/2026 hanno smesso di essere
// descrizioni generiche e sono diventate NUMERI. È il momento in cui un
// ripiego travestito da misura passa inosservato: «0 attivi» durante il
// caricamento e «0 workout» dopo una query fallita sono due frasi che nessuno
// mette in dubbio, e sono entrambe false.

describe('riassuntoCodici', () => {
  it('conta gli attivi e gli usati separatamente', () => {
    expect(riassuntoCodici([
      { is_active: true }, { is_active: true }, { is_active: true },
      { is_active: false, used_by: 'a' }, { is_active: false, used_by: 'b' },
    ])).toBe('3 attivi · 2 usati')
  })

  it('accorda il singolare', () => {
    expect(riassuntoCodici([{ is_active: true }, { is_active: false, used_by: 'a' }]))
      .toBe('1 attivo · 1 usato')
  })

  it('un codice spento che nessuno ha riscattato non conta come usato', () => {
    // `is_active: false` senza `used_by` è un codice ELIMINATO a metà o
    // scaduto, non un invito andato a segno: contarlo direbbe al coach che
    // qualcuno è entrato quando non è entrato nessuno.
    expect(riassuntoCodici([{ is_active: false, used_by: null }])).toBe('Nessuno attivo · 0 usati')
  })

  it('lo dice quando non ne esiste nemmeno uno', () => {
    expect(riassuntoCodici([])).toBe('Nessun codice generato')
  })

  it('🔴 torna null finché i codici non sono arrivati, invece di «0 attivi»', () => {
    // La riga in quel caso non scrive niente. «0 attivi · 0 usati» è un dato,
    // e durante il caricamento è un dato falso — che per giunta suggerisce di
    // generarne uno che forse esiste già.
    expect(riassuntoCodici(null)).toBeNull()
    expect(riassuntoCodici(undefined)).toBeNull()
  })
})

describe('riassuntoBackup', () => {
  it('mette insieme la data dell\'ultimo export e cosa finirebbe nel file', () => {
    expect(riassuntoBackup({ ultimoExport: '2026-08-28T10:00:00.000Z', atleti: 9, workout: 128 }))
      .toBe('Ultimo export 28 ago · 9 atleti · 128 workout')
  })

  it('«workout» è invariabile al plurale, «atleta» no', () => {
    expect(riassuntoBackup({ atleti: 1, workout: 1 })).toBe('1 atleta · 1 workout')
  })

  it('🔴 un conteggio mancante SPARISCE invece di diventare zero', () => {
    // La query dei conteggi può fallire — e «0 atleti · 0 workout» accanto a
    // «Esporta database» si legge come «non c'è niente da salvare», che è il
    // messaggio peggiore possibile sulla riga di un backup.
    expect(riassuntoBackup({ ultimoExport: '2026-08-28T10:00:00.000Z', atleti: null, workout: 128 }))
      .toBe('Ultimo export 28 ago')
  })

  it('senza niente da dire ripiega sulla descrizione, non su una riga vuota', () => {
    expect(riassuntoBackup({})).toBe('Tutti gli atleti e i workout in un file .json')
    expect(riassuntoBackup()).toBe('Tutti gli atleti e i workout in un file .json')
  })

  it('una data illeggibile non porta via i conteggi', () => {
    expect(riassuntoBackup({ ultimoExport: 'non-una-data', atleti: 9, workout: 128 }))
      .toBe('9 atleti · 128 workout')
  })
})

describe('etichettaRuolo', () => {
  it('distingue coach e atleta', () => {
    expect(etichettaRuolo('admin')).toBe('Coach')
    expect(etichettaRuolo('coach')).toBe('Coach')
    expect(etichettaRuolo('athlete')).toBe('Atleta')
  })

  it('🔴 in anteprima non dice «Atleta», che sarebbe vero e fuorviante', () => {
    // App.jsx riscrive davvero `role` a 'athlete' quando c'è
    // adminRoleOverride: senza il secondo pezzo la pillola direbbe «Atleta» a
    // un coach, e sarebbe l'unica cosa in pagina a non spiegare perché metà
    // dei comandi sono spariti.
    expect(etichettaRuolo('athlete', { anteprimaAtleta: true })).toBe('Anteprima atleta')
  })
})
