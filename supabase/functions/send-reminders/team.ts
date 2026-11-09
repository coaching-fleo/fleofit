// «Team»: la parte pura del modo `team_invito` di send-reminders (06/11/2026,
// docs/superpowers/specs/2026-11-06-team-design.md §5). Niente Deno e niente
// URL esterni: è importata anche dai test (vitest).
//
// Un invito, una notifica: chi ha già la riga in `notifications` con questa
// route non la riceve di nuovo (rinvio dopo un errore a metà, o un reinvito
// mentre la vecchia notifica è ancora lì).

export const TITOLO_INVITO = 'Invito in un team'

export function routeInvito(teamId: string): string {
  return `/team/invito/${teamId}`
}

export function testoInvito(nomeCoach: string, nomeTeam: string): string {
  return `${nomeCoach} ti invita in «${nomeTeam}»`
}

// Chi riceve: gli atleti richiesti che sono ANCORA invitati (un atleta che ha
// già risposto non riceve l'invito), senza chi ha già una notifica di QUESTO
// invito. Una notifica più vecchia di `invitato_il` è di un invito precedente
// (poi rifiutato o lasciato): non blocca il reinvito (revisione 09/11/2026).
export function destinatariInvito(
  righe: { atleta_id: string; stato: string; invitato_il?: string | null }[],
  richiesti: string[],
  giaNotificati: { user_id: string; created_at?: string | null }[],
): string[] {
  const voluti = new Set(richiesti)
  return righe
    .filter((r) => r.stato === 'invitato' && voluti.has(r.atleta_id))
    .filter((r) => {
      const dal = r.invitato_il ? Date.parse(r.invitato_il) : -Infinity
      return !giaNotificati.some((n) => n.user_id === r.atleta_id
        && (n.created_at ? Date.parse(n.created_at) : Infinity) >= dal)
    })
    .map((r) => r.atleta_id)
}

// La push dell'invito parte solo con l'interruttore `team` su «tutti»: su
// «admin» l'atleta non vede i Team e la notifica lo porterebbe alla Home.
export function invitiAccesi(stato: string | null | undefined): boolean {
  return stato === 'tutti'
}
