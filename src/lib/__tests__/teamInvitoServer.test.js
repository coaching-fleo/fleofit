import { describe, it, expect } from 'vitest'
import {
  TITOLO_INVITO, routeInvito, testoInvito, destinatariInvito, invitiAccesi,
} from '../../../supabase/functions/send-reminders/team.ts'

// L'invito in un team: la parte pura del modo `team_invito` di send-reminders.
// Conta che arrivi solo a chi è ANCORA invitato e mai due volte.
describe('team_invito', () => {
  it('route e testi', () => {
    expect(TITOLO_INVITO).toBe('Invito in un team')
    expect(routeInvito('x')).toBe('/team/invito/x')
    expect(testoInvito('Federico Leo', 'Doppia Hyrox')).toBe('Federico Leo ti invita in «Doppia Hyrox»')
  })

  const INVITO = '2026-11-09T10:00:00Z'
  const riga = (atleta_id, stato = 'invitato', invitato_il = INVITO) => ({ atleta_id, stato, invitato_il })

  it('solo gli invitati richiesti', () => {
    const righe = [riga('a'), riga('b', 'dentro'), riga('c')]
    expect(destinatariInvito(righe, ['a', 'b'], [])).toEqual(['a'])
  })

  it('mai due volte per lo stesso invito', () => {
    expect(destinatariInvito([riga('a')], ['a'], [{ user_id: 'a', created_at: '2026-11-09T10:00:01Z' }])).toEqual([])
  })

  // Revisione 09/11: la notifica del PRIMO invito restava e bloccava quella del
  // reinvito (dopo un rifiuto, 3 giorni più tardi): reinvito muto.
  it('il reinvito arriva anche se la notifica del primo invito è ancora lì', () => {
    const vecchia = { user_id: 'a', created_at: '2026-11-01T09:00:00Z' }
    expect(destinatariInvito([riga('a')], ['a'], [vecchia])).toEqual(['a'])
  })

  // Revisione 09/11: con l'interruttore su «admin» l'atleta non vede i Team, e
  // la push lo porterebbe alla Home.
  it("la push parte solo con l'interruttore su «tutti»", () => {
    expect(invitiAccesi('tutti')).toBe(true)
    expect(invitiAccesi('admin')).toBe(false)
    expect(invitiAccesi('spenta')).toBe(false)
    expect(invitiAccesi(undefined)).toBe(false)
  })
})
