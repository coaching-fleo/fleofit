import { describe, it, expect } from 'vitest'
import { leggiRuolo, eStaff, eAdmin } from '../ruoli'

// Finto supabase: `from('staff').select().eq().maybeSingle()` torna `risposta`.
const finto = (risposta) => {
  const chiamate = []
  const q = {
    select: () => q,
    eq: (col, val) => { chiamate.push([col, val]); return q },
    maybeSingle: async () => risposta,
  }
  return { client: { from: (t) => { chiamate.push(['from', t]); return q } }, chiamate }
}

describe('eStaff / eAdmin', () => {
  it('staff = admin o coach', () => {
    expect(eStaff('admin')).toBe(true)
    expect(eStaff('coach')).toBe(true)
    expect(eStaff('athlete')).toBe(false)
    expect(eStaff(null)).toBe(false)
  })
  it('admin = solo admin', () => {
    expect(eAdmin('admin')).toBe(true)
    expect(eAdmin('coach')).toBe(false)
    expect(eAdmin('athlete')).toBe(false)
  })
})

describe('leggiRuolo', () => {
  it('legge il ruolo dalla tabella staff', async () => {
    const { client } = finto({ data: { ruolo: 'coach' }, error: null })
    expect(await leggiRuolo(client, 'x@y.it')).toBe('coach')
  })
  it('normalizza l\'email', async () => {
    const { client, chiamate } = finto({ data: { ruolo: 'coach' } })
    await leggiRuolo(client, ' Coach@Y.it ')
    expect(chiamate).toContainEqual(['email', 'coach@y.it'])
  })
  it('se la tabella non risponde ripiega su ADMIN_EMAILS', async () => {
    const { client } = finto({ data: null, error: { message: 'no table' } })
    expect(await leggiRuolo(client, 'Coaching@FedericoLeo.it ')).toBe('admin')
    expect(await leggiRuolo(client, 'altro@x.it')).toBe(null)
  })
  it('senza riga e senza errore: null', async () => {
    const { client } = finto({ data: null })
    expect(await leggiRuolo(client, 'chiunque@x.it')).toBe(null)
  })
})
