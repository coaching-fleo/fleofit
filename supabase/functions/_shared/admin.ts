// Lista admin condivisa dalle Edge Function.
//
// ⚠️ Non è LA fonte unica, è una delle tre che restano. Le altre due:
//   • src/App.jsx        → decide cosa mostra l'interfaccia
//   • le policy RLS      → decidono cosa il database consegna davvero
// Aggiungere un admin richiede quindi TRE modifiche coordinate, e dimenticarne
// una produce un guasto silenzioso: è il meccanismo che ha causato il rifiuto
// App Store di maggio, quando l'account del revisore era admin nel client e non
// nel database.
//
// Il fix vero è una funzione public.is_admin() richiamata da tutte le policy,
// così la lista vive in un posto solo. È un cambiamento di policy non additivo,
// quindi soggetto al congelamento (CLAUDE.md regola 0-bis).
export const ADMIN_EMAILS = [
  'coaching@federicoleo.it',
  'alessandro.patrone@hotmail.it',
  'federico_leo@hotmail.it',
  'federico.leo88@gmail.com',
  'demo@fleofit.it',
];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
