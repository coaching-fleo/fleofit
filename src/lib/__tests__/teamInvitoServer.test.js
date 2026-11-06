import { describe, it, expect } from 'vitest'
import {
  TITOLO_INVITO, routeInvito, testoInvito, destinatariInvito,
} from '../../../supabase/functions/send-reminders/team.ts'

// L'invito in un team: la parte pura del modo `team_invito` di send-reminders.
// Conta che arrivi solo a chi è ANCORA invitato e mai due volte.
describe('team_invito', () => {
  it('route e testi', () => {
    expect(TITOLO_INVITO).toBe('Invito in un team')
    expect(routeInvito('x')).toBe('/team/invito/x')
    expect(testoInvito('Federico Leo', 'Doppia Hyrox')).toBe('Federico Leo ti invita in «Doppia Hyrox»')
  })

  it('solo gli invitati richiesti', () => {
    const righe = [{ atleta_id: 'a', stato: 'invitato' }, { atleta_id: 'b', stato: 'dentro' }, { atleta_id: 'c', stato: 'invitato' }]
    expect(destinatariInvito(righe, ['a', 'b'], [])).toEqual(['a'])
  })

  it('mai due volte', () => {
    expect(destinatariInvito([{ atleta_id: 'a', stato: 'invitato' }], ['a'], ['a'])).toEqual([])
  })
})
