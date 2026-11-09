// «Team»: lettura e scrittura di `team`, `team_membri`, `team_sfide` e
// `team_risultati` (docs/superpowers/specs/2026-11-06-team-design.md §3-§7).
//
// Tiene in un posto solo ciò che l'app chiede al database per i team, così le
// schermate non conoscono i nomi delle colonne. Regole:
//   · tabelle o funzione assenti (migrazione non applicata: 42P01, PGRST205,
//     PGRST202) = «funzione non disponibile», mai un errore: le letture tornano
//     `{ disponibile: false }`;
//   · i permessi veri li impone il database (RLS + trigger): qui non si
//     «protegge» niente, si evita solo di chiedere cose che verrebbero rifiutate;
//   · la notifica dell'invito non blocca l'invito: se la Edge Function non
//     risponde, l'invito c'è lo stesso e il coach lo vede «in attesa»;
//   · i nomi dei compagni arrivano SOLO da `team_scheda`: l'atleta legge solo
//     la propria riga di `athletes`.

import { supabase } from '../supabaseClient'
import { versoDi, puoReinvitare } from './sfidaTeam'

const TEAM = 'team'
const MEMBRI = 'team_membri'
const SFIDE = 'team_sfide'
const RISULTATI = 'team_risultati'
const ALLENAMENTI = 'athlete_workouts'

/** Tabella o funzione SQL che non c'è (migrazione non applicata). */
export const assente = (error) =>
  !!error && ['42P01', 'PGRST205', 'PGRST202'].includes(error.code)

const STATI_RISPOSTA = ['dentro', 'rifiutato', 'uscito']
const CAMPI_TEAM = ['nome', 'evento_id', 'classifica_visibile']

// ── Letture ─────────────────────────────────────────────────────────────────

/** I team del coach (un admin li vede tutti), con i conteggi dei membri. */
export async function leggiMieiTeam() {
  const { data, error } = await supabase.from(TEAM)
    .select('id, nome, evento_id, classifica_visibile, chiuso_il, creato_il, team_membri(stato)')
    .order('creato_il', { ascending: false })
  if (error) {
    if (assente(error)) return { disponibile: false, team: [] }
    throw error
  }
  return {
    disponibile: true,
    team: (data || []).map(({ team_membri: membri = [], ...t }) => ({
      ...t,
      dentro: membri.filter(m => m.stato === 'dentro').length,
      inAttesa: membri.filter(m => m.stato === 'invitato').length,
    })),
  }
}

/** I team di un atleta: invitato o dentro. Un team che non vede più (coach cambiato) sparisce. */
export async function leggiTeamAtleta(atletaId) {
  const { data, error } = await supabase.from(MEMBRI)
    .select('stato, invitato_il, team(id, nome, classifica_visibile, chiuso_il)')
    .eq('atleta_id', atletaId)
    .in('stato', ['invitato', 'dentro'])
  if (error) {
    if (assente(error)) return { disponibile: false, team: [] }
    throw error
  }
  return {
    disponibile: true,
    team: (data || []).filter(r => r.team).map(r => ({ ...r.team, stato: r.stato, invitato_il: r.invitato_il })),
  }
}

/** La scheda con i nomi (RPC team_scheda). `scheda: null` = non è un mio team. */
export async function leggiScheda(teamId) {
  const { data, error } = await supabase.rpc('team_scheda', { t: teamId })
  if (error) {
    if (assente(error)) return { disponibile: false, scheda: null }
    throw error
  }
  return { disponibile: true, scheda: data && !Array.isArray(data) ? data : null }
}

/** Le sfide del team, la più recente prima, con i risultati che la RLS lascia vedere. */
export async function leggiSfide(teamId) {
  const { data, error } = await supabase.from(SFIDE)
    .select('id, workout_id, metrica, data, chiusa_il, workouts(title), team_risultati(atleta_id, valore)')
    .eq('team_id', teamId)
    .order('data', { ascending: false })
  if (error) {
    if (assente(error)) return { disponibile: false, sfide: [] }
    throw error
  }
  return {
    disponibile: true,
    sfide: (data || []).map(({ workouts, team_risultati: risultati = [], ...s }) => ({
      ...s,
      titolo: workouts?.title || '',
      risultati: risultati.map(r => ({ atleta_id: r.atleta_id, valore: Number(r.valore) })),
    })),
  }
}

/**
 * La sfida legata a questo allenamento dell'atleta, o null. `data` (il giorno
 * dell'assegnazione) distingue lo stesso workout usato in giorni diversi.
 */
export async function sfidaDiAssegnazione(workoutId, atletaId, data = null) {
  let q = supabase.from(SFIDE)
    .select('id, metrica, chiusa_il, data, team(classifica_visibile)')
    .eq('workout_id', workoutId)
  if (data) q = q.eq('data', data)
  const { data: sfide, error } = await q.order('data', { ascending: false }).limit(1)
  if (error) {
    if (assente(error)) return null
    throw error
  }
  const s = sfide?.[0]
  if (!s) return null
  const { data: mio, error: e2 } = await supabase.from(RISULTATI)
    .select('valore').eq('sfida_id', s.id).eq('atleta_id', atletaId).maybeSingle()
  if (e2 && !assente(e2)) throw e2
  return {
    id: s.id, metrica: s.metrica, chiusa_il: s.chiusa_il,
    classifica_visibile: !!s.team?.classifica_visibile,
    valore: mio?.valore != null ? Number(mio.valore) : null,
  }
}

// ── Scritture del coach ─────────────────────────────────────────────────────

/** Un team nuovo. Nome doppio → errore con code '23505' (lo traduce l'interfaccia). */
export async function creaTeam({ nome, evento_id = null, classifica_visibile = false }) {
  const { data: u } = await supabase.auth.getUser()
  const { data, error } = await supabase.from(TEAM)
    .insert({ nome: String(nome || '').trim(), evento_id, classifica_visibile, coach_id: u?.user?.id })
    .select('id').single()
  if (error) throw error
  return { id: data.id }
}

export async function aggiornaTeam(id, campi) {
  const ammessi = Object.fromEntries(Object.entries(campi || {}).filter(([k]) => CAMPI_TEAM.includes(k)))
  const { error } = await supabase.from(TEAM).update(ammessi).eq('id', id)
  if (error) throw error
}

export async function chiudiTeam(id) {
  const { error } = await supabase.from(TEAM).update({ chiuso_il: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/**
 * Invita: righe nuove per chi non c'è mai stato, reinvito per chi ha rifiutato
 * o è uscito da almeno 3 giorni; gli altri si saltano. Poi la notifica.
 */
export async function invita(teamId, atletaIds) {
  const { data: righe, error } = await supabase.from(MEMBRI)
    .select('atleta_id, stato, risposto_il').eq('team_id', teamId)
  if (error) throw error
  const esistenti = new Map((righe || []).map(r => [r.atleta_id, r]))
  const nuovi = []
  const reinviti = []
  for (const id of atletaIds || []) {
    const r = esistenti.get(id)
    if (!r) nuovi.push(id)
    else if (['rifiutato', 'uscito'].includes(r.stato) && puoReinvitare(r.risposto_il)) reinviti.push(id)
  }
  if (nuovi.length) {
    const { error: e } = await supabase.from(MEMBRI)
      .insert(nuovi.map(atleta_id => ({ team_id: teamId, atleta_id, stato: 'invitato' })))
    if (e) throw e
  }
  for (const id of reinviti) {
    const { error: e } = await supabase.from(MEMBRI)
      .update({ stato: 'invitato' }).eq('team_id', teamId).eq('atleta_id', id)
    if (e) throw e
  }
  const invitati = (atletaIds || []).filter(id => nuovi.includes(id) || reinviti.includes(id))
  if (invitati.length) {
    Promise.resolve()
      .then(() => supabase.functions.invoke('send-reminders', { body: { mode: 'team_invito', team_id: teamId, atleta_ids: invitati } }))
      .catch(console.error)
  }
  return { invitati }
}

export async function annullaInvito(teamId, atletaId) {
  const { error } = await supabase.from(MEMBRI).delete()
    .eq('team_id', teamId).eq('atleta_id', atletaId).eq('stato', 'invitato')
  if (error) throw error
}

/**
 * Chi del team riceve l'allenamento: chi è DENTRO e segue ancora il coach del
 * team (un atleta spostato a un altro coach non si può assegnare: la RLS di
 * athlete_workouts lo rifiuta e farebbe fallire l'insert di tutti, revisione
 * 09/11/2026), meno chi ha già quel workout quel giorno.
 */
async function chiRiceve(teamId, workoutId, data) {
  const { data: membri, error: e1 } = await supabase.from(MEMBRI)
    .select('atleta_id, stato').eq('team_id', teamId)
  if (e1) throw e1
  const { data: team, error: e0 } = await supabase.from(TEAM).select('coach_id').eq('id', teamId).single()
  if (e0) throw e0
  const { data: suoi, error: e5 } = await supabase.from('coach_atleti').select('athlete_id').eq('coach_id', team.coach_id)
  if (e5) throw e5
  const delCoach = new Set((suoi || []).map(r => r.athlete_id))
  const dentro = (membri || []).filter(m => m.stato === 'dentro' && delCoach.has(m.atleta_id)).map(m => m.atleta_id)

  const { data: gia, error: e3 } = await supabase.from(ALLENAMENTI)
    .select('athlete_id, workout_id, completed_date')
    .eq('workout_id', workoutId).eq('completed_date', data).in('athlete_id', dentro)
  if (e3) throw e3
  const hanno = new Set((gia || [])
    .filter(a => a.workout_id === workoutId && a.completed_date === data)
    .map(a => a.athlete_id))
  return dentro.filter(id => !hanno.has(id))
}

/** Assegna il workout a quegli atleti e manda la push «nuovo allenamento» (non blocca). */
async function assegna(atleti, workoutId, data) {
  if (!atleti.length) return
  const { data: nuove, error } = await supabase.from(ALLENAMENTI)
    .insert(atleti.map(athlete_id => ({ athlete_id, workout_id: workoutId, completed_date: data, status: 'pending' })))
    .select('id')
  if (error) throw error
  ;(nuove || []).forEach((n) => {
    Promise.resolve()
      .then(() => supabase.functions.invoke('send-reminders', { body: { mode: 'immediate', record_id: n.id } }))
      .catch(console.error)
  })
}

/**
 * Un allenamento da fare INSIEME (09/11/2026): lo stesso workout a tutto il
 * team, senza sfida, senza metrica, senza classifica. Nessuna riga in
 * team_sfide: per l'atleta è un allenamento come gli altri.
 */
export async function assegnaInsieme({ teamId, workoutId, data }) {
  const assegnati = await chiRiceve(teamId, workoutId, data)
  await assegna(assegnati, workoutId, data)
  return { assegnati }
}

/** Una sfida: il workout a chi è dentro, più la riga in team_sfide con la metrica. */
export async function creaSfida({ teamId, workoutId, metrica, data }) {
  const assegnati = await chiRiceve(teamId, workoutId, data)
  const { data: sfida, error: e2 } = await supabase.from(SFIDE)
    .insert({ team_id: teamId, workout_id: workoutId, metrica, verso: versoDi(metrica), data })
    .select('id').single()
  if (e2) throw e2
  try {
    await assegna(assegnati, workoutId, data)
  } catch (e) {
    // La sfida non resta orfana: nessuno l'ha ricevuta, e riprovare ne creerebbe un doppione.
    await supabase.from(SFIDE).delete().eq('id', sfida.id)
    throw e
  }
  return { id: sfida.id, assegnati }
}

export async function chiudiSfida(id) {
  const { error } = await supabase.from(SFIDE).update({ chiusa_il: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

// ── Scritture dell'atleta ───────────────────────────────────────────────────

/** Accetta, rifiuta o esce. Le transizioni ammesse le decide il database. */
export async function rispondi(teamId, atletaId, stato) {
  if (!STATI_RISPOSTA.includes(stato)) throw new Error(`Risposta non valida: ${stato}`)
  const { error } = await supabase.from(MEMBRI).update({ stato })
    .eq('team_id', teamId).eq('atleta_id', atletaId)
  if (error) throw error
}

/**
 * Cancella i propri risultati del team. Va chiamata PRIMA di uscire: dopo
 * l'uscita l'atleta non vede più le sfide del team, quindi non saprebbe quali.
 */
export async function cancellaMieiRisultati(teamId, atletaId) {
  const { data: sfide, error } = await supabase.from(SFIDE).select('id').eq('team_id', teamId)
  if (error) throw error
  const ids = (sfide || []).map(s => s.id)
  if (!ids.length) return
  const { error: e } = await supabase.from(RISULTATI).delete().eq('atleta_id', atletaId).in('sfida_id', ids)
  if (e) throw e
}

/** Il proprio risultato (inserito o corretto). */
export async function salvaRisultato(sfidaId, atletaId, valore) {
  const { error } = await supabase.from(RISULTATI)
    .upsert({ sfida_id: sfidaId, atleta_id: atletaId, valore, fonte: 'manuale' }, { onConflict: 'sfida_id,atleta_id' })
  if (error) throw error
}
