import { describe, it, expect } from 'vitest'
import { parseNotePausa, formatNotePausa, inPausa } from '../pausa'

// Perché questi test esistono
// ────────────────────────────
// Lo stato «in pausa» è un marcatore dentro un campo di testo libero che
// l'utente modifica a mano (CLAUDE.md §9-decies). Tutti i modi in cui una cosa
// del genere si rompe sono silenziosi: il marcatore che diventa testo visibile,
// il testo che se lo mangia, il salvataggio che lo duplica. Nessuno di questi
// dà errore, e ognuno significa un atleta che ricompare (o sparisce) dalla
// lista di chi va chiamato.

describe('parseNotePausa', () => {
  it('riconosce il marcatore con la data e restituisce il testo pulito', () => {
    expect(parseNotePausa('[PAUSA: 2026-08-27]\nInfortunio al ginocchio')).toEqual({
      inPausa: true, dal: '2026-08-27', testo: 'Infortunio al ginocchio',
    })
  })

  it('regge il marcatore senza data', () => {
    expect(parseNotePausa('[PAUSA]\nnota')).toEqual({ inPausa: true, dal: null, testo: 'nota' })
  })

  it('regge il marcatore da solo, senza nota', () => {
    expect(parseNotePausa('[PAUSA: 2026-08-27]')).toEqual({
      inPausa: true, dal: '2026-08-27', testo: '',
    })
  })

  it('una nota normale non è una pausa, e non viene toccata', () => {
    expect(parseNotePausa('Preferisce allenarsi la sera')).toEqual({
      inPausa: false, dal: null, testo: 'Preferisce allenarsi la sera',
    })
  })

  it('su null e stringa vuota torna sempre un oggetto completo', () => {
    // Il chiamante non deve mai chiedersi se il dato c'è: `athletes.notes` è
    // nullo per quasi tutti gli atleti.
    expect(parseNotePausa(null)).toEqual({ inPausa: false, dal: null, testo: '' })
    expect(parseNotePausa(undefined).testo).toBe('')
    expect(parseNotePausa('').inPausa).toBe(false)
  })

  it('il marcatore vale SOLO in testa alla nota', () => {
    // Altrimenti bastava che il coach scrivesse «poi [PAUSA] per un mese»
    // perché l'atleta sparisse dagli allarmi senza che nessuno l'avesse deciso.
    expect(parseNotePausa('Ne parliamo, magari [PAUSA] a settembre').inPausa).toBe(false)
  })

  it('una data malformata non conta come marcatore', () => {
    expect(parseNotePausa('[PAUSA: ieri]\nnota').inPausa).toBe(false)
  })
})

describe('formatNotePausa', () => {
  it('mette il marcatore in testa conservando la nota', () => {
    expect(formatNotePausa('2026-08-27', 'Infortunio')).toBe('[PAUSA: 2026-08-27]\nInfortunio')
  })

  it('non duplica il marcatore se il testo ne porta già uno', () => {
    // È il caso vero: la modale di modifica rilegge `athlete.notes` e lo
    // risalva. Senza la pulizia, ogni salvataggio aggiungeva una riga
    // `[PAUSA: …]` visibile dentro la nota.
    const una = formatNotePausa('2026-08-27', 'Infortunio')
    expect(formatNotePausa('2026-08-27', una)).toBe(una)
  })

  it('regge una nota vuota o assente', () => {
    expect(formatNotePausa('2026-08-27', '')).toBe('[PAUSA: 2026-08-27]\n')
    expect(formatNotePausa('2026-08-27', null)).toBe('[PAUSA: 2026-08-27]\n')
  })

  it('il giro completo scrittura → lettura conserva il testo', () => {
    const testo = 'Riprende a settembre.\nMi ha scritto lunedì.'
    expect(parseNotePausa(formatNotePausa('2026-08-27', testo))).toEqual({
      inPausa: true, dal: '2026-08-27', testo,
    })
  })
})

describe('inPausa', () => {
  it('legge la riga athletes, e regge un atleta assente', () => {
    expect(inPausa({ id: 'a', notes: '[PAUSA: 2026-08-27]\nx' })).toBe(true)
    expect(inPausa({ id: 'a', notes: 'x' })).toBe(false)
    expect(inPausa({ id: 'a', notes: null })).toBe(false)
    expect(inPausa(null)).toBe(false)
  })
})
