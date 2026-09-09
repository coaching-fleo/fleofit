// Chi segue l'atleta, come costante.
//
// 🔴 Non è una scorciatoia: dal lato atleta il nome del coach NON è
// interrogabile. Lo schema non ha un `coach_id` — i coach sono un elenco di
// email dentro le policy RLS (CLAUDE.md §4-bis), cioè uno studio con un coach
// solo — e `athletes` si legge solo per la propria riga o da admin. È lo stesso
// muro contro cui sbatte già `CardInvitoValido` in `LoginUI`, che per questo
// scrive «Il tuo coach ti ha invitato» invece di un nome.
//
// Il giorno in cui esistono più coach, questa è l'unica riga da sostituire con
// una lettura vera — e il componente che la usa funziona anche senza:
// `BenvenutoCoach` senza `coach` scrive «Il tuo coach ti segue da oggi».
//
// ⚠️ Non è il nome del PRODOTTO (che è provvisorio, CLAUDE.md regola 1): è il
// nome della persona. Un rebranding non tocca questa riga.
export const COACH = 'Federico Leo'
