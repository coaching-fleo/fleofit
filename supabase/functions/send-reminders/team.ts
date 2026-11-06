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
// già risposto non riceve l'invito), senza chi l'ha già ricevuto.
export function destinatariInvito(
  righe: { atleta_id: string; stato: string }[],
  richiesti: string[],
  giaNotificati: string[],
): string[] {
  const voluti = new Set(richiesti)
  const gia = new Set(giaNotificati)
  return righe
    .filter((r) => r.stato === 'invitato' && voluti.has(r.atleta_id) && !gia.has(r.atleta_id))
    .map((r) => r.atleta_id)
}
