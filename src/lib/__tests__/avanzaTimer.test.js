import { describe, it, expect } from 'vitest'

import { avanzaSequenza, statoTV, beepTV } from '../avanzaTimer'

// Perché questi test esistono
// ────────────────────────────
// Col telefono bloccato iOS sospende la webview: il timer del telefono si ferma
// e smette di mandare lo stato alla TV. Al ritorno il telefono saltava solo al
// passo SUCCESSIVO (ripartendo dalla sua durata piena), e la TV restava ferma
// sull'ultimo numero ricevuto. `avanzaSequenza` dice dove si è arrivati dopo N
// secondi: la usano il telefono al risveglio e la TV mentre il telefono tace.
// I due devono arrivare allo stesso punto, o al risveglio la TV salta indietro.

const seq = [
  { id: 'prep', type: 'prep', duration: 10 },
  { id: 'a', type: 'work', duration: 60 },
  { id: 'b', type: 'rest', duration: 30 },
  { id: 'sw', type: 'stopwatch', duration: 0 },
  { id: 'done', type: 'done', duration: 0 },
]

describe('avanzaSequenza — dove si è arrivati dopo N secondi', () => {
  it('dentro lo stesso passo toglie i secondi', () => {
    expect(avanzaSequenza(seq, 1, 60, 15)).toEqual({ idx: 1, timeLeft: 45, finito: false })
  })

  it('lo zero dura un secondo, come sul telefono: 0:00 si vede, poi si passa oltre', () => {
    expect(avanzaSequenza(seq, 1, 5, 5)).toEqual({ idx: 1, timeLeft: 0, finito: false })
    expect(avanzaSequenza(seq, 1, 0, 1)).toEqual({ idx: 2, timeLeft: 30, finito: false })
  })

  it('attraversa più passi di fila senza perdere secondi', () => {
    // 10 di prep → 0 al secondo 10, passo «a» al secondo 11 (60), 20 secondi dopo = 40
    expect(avanzaSequenza(seq, 0, 10, 31)).toEqual({ idx: 1, timeLeft: 40, finito: false })
  })

  it('si ferma su un cronometro e lo fa salire', () => {
    // a: 10 + 1 → b: 30 + 1 → cronometro, 9 secondi dentro
    expect(avanzaSequenza(seq, 1, 10, 51)).toEqual({ idx: 3, timeLeft: 9, finito: false })
    expect(avanzaSequenza(seq, 3, 9, 6)).toEqual({ idx: 3, timeLeft: 15, finito: false })
  })

  it('arrivato a «Completato» si ferma lì', () => {
    const corta = [{ id: 'a', type: 'work', duration: 5 }, { id: 'done', type: 'done', duration: 0 }]
    expect(avanzaSequenza(corta, 0, 5, 600)).toEqual({ idx: 1, timeLeft: 0, finito: true })
  })

  it('una sequenza senza «Completato» finisce a zero sull\'ultimo passo', () => {
    const corta = [{ id: 'a', type: 'work', duration: 5 }]
    expect(avanzaSequenza(corta, 0, 5, 600)).toEqual({ idx: 0, timeLeft: 0, finito: true })
  })

  it('zero secondi o secondi negativi non muovono niente', () => {
    expect(avanzaSequenza(seq, 1, 42, 0)).toEqual({ idx: 1, timeLeft: 42, finito: false })
    expect(avanzaSequenza(seq, 1, 42, -3)).toEqual({ idx: 1, timeLeft: 42, finito: false })
  })
})


describe('statoTV — la TV va avanti da sola mentre il telefono tace', () => {
  const ricevuto = 1_000_000
  const dal = (payload) => ({ ...payload, ricevuto })

  it('appena ricevuto mostra lo stato del telefono così com\'è', () => {
    const p = dal({ currentIdx: 1, timeLeft: 42, isRunning: true, step: seq[1] })
    expect(statoTV(p, seq, ricevuto)).toMatchObject({ currentIdx: 1, timeLeft: 42, isRunning: true, step: seq[1] })
  })

  it('col telefono bloccato continua a contare, anche oltre il passo', () => {
    const p = dal({ currentIdx: 1, timeLeft: 2, isRunning: true, step: seq[1] })
    // 2 → 0 in due secondi, il terzo passa al riposo (30), poi altri 10
    expect(statoTV(p, seq, ricevuto + 13_400)).toMatchObject({ currentIdx: 2, timeLeft: 20, step: seq[2] })
  })

  it('in pausa resta fermo', () => {
    const p = dal({ currentIdx: 1, timeLeft: 42, isRunning: false, step: seq[1] })
    expect(statoTV(p, seq, ricevuto + 60_000)).toMatchObject({ currentIdx: 1, timeLeft: 42 })
  })

  it('arrivato a «Completato» si ferma', () => {
    const p = dal({ currentIdx: 2, timeLeft: 1, isRunning: true, step: seq[2] })
    const corta = [seq[0], seq[1], seq[2], seq[4]]
    expect(statoTV(p, corta, ricevuto + 600_000)).toMatchObject({ currentIdx: 3, isRunning: false, step: seq[4] })
  })

  it('se la sua sequenza non coincide con quella del telefono non scavalca il passo', () => {
    // Workout cambiato nel frattempo, o un'app vecchia: la TV non sa cosa viene
    // dopo, quindi scende fino a zero e lì aspetta il telefono.
    const altro = { id: 'x', type: 'work', duration: 60 }
    const p = dal({ currentIdx: 1, timeLeft: 5, isRunning: true, step: altro })
    expect(statoTV(p, seq, ricevuto + 3_000)).toMatchObject({ currentIdx: 1, timeLeft: 2, step: altro })
    expect(statoTV(p, seq, ricevuto + 90_000)).toMatchObject({ currentIdx: 1, timeLeft: 0, step: altro })
  })

  it('senza stato non mostra niente', () => {
    expect(statoTV(null, seq, ricevuto)).toBeNull()
  })
})

describe('beepTV — i beep sulla TV seguono il suo orologio', () => {
  const stato = (currentIdx, timeLeft, step = seq[1]) => ({ currentIdx, timeLeft, isRunning: true, step })

  it('3, 2, 1 corti e lo zero lungo', () => {
    expect(beepTV(stato(1, 4), stato(1, 3))).toBe('corto')
    expect(beepTV(stato(1, 1), stato(1, 0))).toBe('lungo')
  })

  it('lo zero prima di «Completato» è il più lungo', () => {
    const ultimo = { ...seq[2], nextTask: 'Workout terminato 🎉' }
    expect(beepTV(stato(2, 1, ultimo), stato(2, 0, ultimo))).toBe('finale')
  })

  it('niente beep su un salto (il telefono che corregge) né sul cronometro', () => {
    expect(beepTV(stato(1, 10), stato(1, 2))).toBeNull()
    expect(beepTV(stato(1, 2), stato(1, 2))).toBeNull()
    expect(beepTV(stato(3, 4, seq[3]), stato(3, 3, seq[3]))).toBeNull()
    expect(beepTV(null, stato(1, 3))).toBeNull()
  })
})
