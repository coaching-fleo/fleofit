import { describe, it, expect, beforeEach, vi } from 'vitest'
import { coachSalvato, leggiMioCoach } from '../coach'

// Il nome del coach dell'atleta (Home, giorno 1): dalla funzione `mio-coach`,
// con l'ultima risposta tenuta sul dispositivo. Mai un nome inventato.
const conRisposta = (risposta) => ({ functions: { invoke: vi.fn(() => risposta) } })

beforeEach(() => window.localStorage.clear())

describe('leggiMioCoach', () => {
  it('torna il nome e lo salva per la volta dopo', async () => {
    const db = conRisposta(Promise.resolve({ data: { nome: ' Giulia Bianchi ' }, error: null }))
    expect(await leggiMioCoach(db, 'u1')).toBe('Giulia Bianchi')
    expect(db.functions.invoke).toHaveBeenCalledWith('mio-coach', { body: {} })
    expect(coachSalvato('u1')).toBe('Giulia Bianchi')
    expect(coachSalvato('u2')).toBeNull()
  })

  it('con un errore o senza nome torna l\'ultimo salvato', async () => {
    await leggiMioCoach(conRisposta(Promise.resolve({ data: { nome: 'Giulia Bianchi' }, error: null })), 'u1')
    expect(await leggiMioCoach(conRisposta(Promise.resolve({ data: null, error: { message: 'giù' } })), 'u1')).toBe('Giulia Bianchi')
    expect(await leggiMioCoach(conRisposta(Promise.resolve({ data: { nome: null }, error: null })), 'u1')).toBe('Giulia Bianchi')
    expect(await leggiMioCoach(conRisposta(Promise.reject(new Error('rete'))), 'u1')).toBe('Giulia Bianchi')
  })

  it('senza niente salvato torna null', async () => {
    expect(await leggiMioCoach(conRisposta(Promise.resolve({ data: null, error: { message: 'x' } })), 'u1')).toBeNull()
    expect(coachSalvato(null)).toBeNull()
  })
})
