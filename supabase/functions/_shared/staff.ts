// Chi è staff, e di chi: la parte delle Edge Function del multi-coach.
//
// Il ruolo viene dalla tabella `staff` (email → 'admin' | 'coach'); gli atleti
// di un coach da `coach_atleti`. ADMIN_EMAILS resta solo come RISERVA: se la
// tabella non risponde (non ancora creata, rete) le funzioni continuano a
// lavorare come prima, e lo stesso fa il client (`leggiRuolo` in src/lib/ruoli.js).
//
// Niente globali Deno né import da URL: il client del database si passa da
// fuori, così vitest può caricare questo file (come broadcast.ts).
import { ADMIN_EMAILS } from './admin.ts'

export type RuoloStaff = 'admin' | 'coach' | null

const normalizza = (email: string | null | undefined) => (email || '').trim().toLowerCase()

/** `'admin'`, `'coach'` o `null` (= atleta). Mai un'eccezione. */
export async function ruoloStaff(db: any, email: string | null): Promise<RuoloStaff> {
  const e = normalizza(email)
  if (!e) return null
  const riserva: RuoloStaff = ADMIN_EMAILS.includes(e) ? 'admin' : null
  try {
    const { data, error } = await db.from('staff').select('ruolo').eq('email', e).maybeSingle()
    if (error) return riserva
    return data?.ruolo === 'admin' || data?.ruolo === 'coach' ? data.ruolo : null
  } catch {
    return riserva
  }
}

/** Gli `athlete_id` seguiti da quel coach. Lettura fallita = nessuno. */
export async function atletiDi(db: any, coachId: string): Promise<string[]> {
  try {
    const { data, error } = await db.from('coach_atleti').select('athlete_id').eq('coach_id', coachId)
    if (error) return []
    return (data || []).map((r: any) => r.athlete_id)
  } catch {
    return []
  }
}

/** Tutti i `coach_id` di un atleta (può averne più d'uno). Lettura fallita = nessuno. */
export async function coachDi(db: any, athleteId: string): Promise<string[]> {
  try {
    const { data, error } = await db.from('coach_atleti').select('coach_id').eq('athlete_id', athleteId)
    if (error) return []
    return (data || []).map((r: any) => r.coach_id)
  } catch {
    return []
  }
}

/** Chi riceve la notifica «un atleta ha fatto qualcosa»: i suoi coach, e se non ne ha gli admin. */
export function destinatariNotificaCoach(coachIds: string[], adminIds: string[]): string[] {
  return coachIds.length > 0 ? coachIds : adminIds
}

/**
 * Gli id (auth.users) dei membri dello staff, scorrendo la lista di Supabase
 * Auth. Sostituisce `trovaIdAdmin`. Se `staff` non risponde ripiega su
 * ADMIN_EMAILS. Se listUsers fallisce lancia, come prima: chi chiama decide.
 */
export async function idStaff(db: any): Promise<{ tutti: string[]; admin: string[] }> {
  let ruoli: Map<string, string> | null = null;
  try {
    const { data, error } = await db.from('staff').select('email, ruolo')
    if (!error && data) ruoli = new Map(data.map((r: any) => [normalizza(r.email), r.ruolo]))
  } catch { /* ripiego sotto */ }

  const tutti: string[] = []
  const admin: string[] = []
  let page = 1
  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 50 })
    if (error) throw error
    const users = data?.users || []
    for (const u of users) {
      const e = normalizza(u.email)
      if (!e) continue
      const ruolo = ruoli ? ruoli.get(e) : (ADMIN_EMAILS.includes(e) ? 'admin' : undefined)
      if (ruolo !== 'admin' && ruolo !== 'coach') continue
      tutti.push(u.id)
      if (ruolo === 'admin') admin.push(u.id)
    }
    if (users.length < 50) break
    page++
  }
  return { tutti, admin }
}
