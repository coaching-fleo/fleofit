// ─────────────────────────────────────────────────────────────────────────────
// AMBIENTE DI PROVA — il cestino dei workout (19/11/2026, docs/memoria/cestino.md).
//
// Nel database vero la copia la fa il trigger `cestino_copia` (prima della
// delete) e le chiavi esterne cancellano a cascata assegnazioni, sfide e log.
// La demo non ha trigger né cascate: senza questo file eliminare toglieva solo
// il workout, le assegnazioni restavano orfane e il cestino era sempre vuoto.
//
// Specchio SEMPLIFICATO di supabase/schema/cestino_workout_2026-11-19.sql:
//   · niente note_estratte, scarpe_uso, garmin (la demo non li ripristina);
//   · tutti vedono tutto il cestino (nella demo si entra da admin).
// Lo importa solo supabaseDemo.js, quindi non entra mai nell'app pubblicata.
// ─────────────────────────────────────────────────────────────────────────────

const nomeDi = (d, id) => {
  const a = (d.athletes ?? []).find(x => x.id === id)
  return a ? (`${a.name || ''} ${a.surname || ''}`.trim() || null) : null
}

/**
 * Prima della delete di `workouts`: copia nel cestino e cascata. Muta `d`.
 * @param staffIds gli id dello staff: un autore fuori dallo staff con un
 *                 workout autonomo è un allenamento libero, e resta fuori.
 */
export function eliminaWorkoutDemo(d, workouts, { staffIds, utente }) {
  const ids = new Set(workouts.map(w => w.id))
  d.cestino_workout ||= []
  for (const w of workouts) {
    const libero = w.creato_da && !staffIds.has(w.creato_da) && w.sections?.isAutonomous === true
    if (libero) continue
    const copia = {
      workout: { ...w },
      assegnazioni: (d.athlete_workouts ?? []).filter(a => a.workout_id === w.id)
        .map(a => ({ riga: { ...a }, nome_atleta: nomeDi(d, a.athlete_id) })),
      sfide: (d.team_sfide ?? []).filter(s => s.workout_id === w.id).map(s => ({
        riga: { ...s },
        nome_team: (d.team ?? []).find(t => t.id === s.team_id)?.nome ?? null,
        risultati: (d.team_risultati ?? []).filter(r => r.sfida_id === s.id).map(r => ({ ...r })),
      })),
      team_evento: (d.team ?? []).filter(t => t.evento_id === w.id).map(t => t.id),
      workout_logs: (d.workout_logs ?? []).filter(l => l.workout_id === w.id).map(l => ({ ...l })),
    }
    // Stesso workout già nel cestino: vale l'ultima copia.
    d.cestino_workout = d.cestino_workout.filter(r => r.workout_id !== w.id)
    d.cestino_workout.push({
      id: crypto.randomUUID(),
      workout_id: w.id,
      titolo: w.title ?? '',
      data_workout: w.date ?? null,
      creato_da: w.creato_da ?? null,
      eliminato_da: utente.id,
      eliminato_da_nome: utente.user_metadata?.first_name || null,
      eliminato_il: new Date().toISOString(),
      copia,
    })
  }
  // Le cascate del database vero.
  const sfide = new Set((d.team_sfide ?? []).filter(s => ids.has(s.workout_id)).map(s => s.id))
  if (d.athlete_workouts) d.athlete_workouts = d.athlete_workouts.filter(a => !ids.has(a.workout_id))
  if (d.workout_logs) d.workout_logs = d.workout_logs.filter(l => !ids.has(l.workout_id))
  if (d.tv_sessions) d.tv_sessions = d.tv_sessions.filter(t => !ids.has(t.workout_id))
  if (d.team_sfide) d.team_sfide = d.team_sfide.filter(s => !sfide.has(s.id))
  if (d.team_risultati) d.team_risultati = d.team_risultati.filter(r => !sfide.has(r.sfida_id))
  for (const t of d.team ?? []) if (ids.has(t.evento_id)) t.evento_id = null
}

const motivoAtleta = (d, id) => {
  const a = (d.athletes ?? []).find(x => x.id === id)
  return !a || a.deleted_at ? 'atleta eliminato' : null
}

const riga = (d, c) => {
  const r = (d.cestino_workout ?? []).find(x => x.id === c)
  if (!r) throw new Error('cestino: non trovato')
  return r
}

/** Come la RPC `cestino_voci`. */
export function vociCestinoDemo(d, c) {
  const r = riga(d, c)
  const assegnazioni = r.copia.assegnazioni.map(a => {
    const motivo = motivoAtleta(d, a.riga.athlete_id)
    return {
      tipo: 'assegnazione', id: a.riga.id, atleta: a.nome_atleta || 'Atleta',
      stato: a.riga.status, data: a.riga.completed_date ?? null,
      notes: motivo ? null : (a.riga.notes ?? null),
      nota_vocale: !motivo && !!a.riga.voice_note_url && !a.riga.voice_note_url.includes('#deleted='),
      ripristinabile: !motivo, motivo,
    }
  })
  const sfide = r.copia.sfide.map(s => {
    const c2 = (d.team ?? []).some(t => t.id === s.riga.team_id)
    return { tipo: 'sfida', id: s.riga.id, team: s.nome_team || 'Team', metrica: s.riga.metrica,
      ripristinabile: c2, motivo: c2 ? null : 'team sciolto' }
  })
  return [...assegnazioni, ...sfide]
}

/** Come la RPC `ripristina_workout`: torna l'id del workout. Muta `d`. */
export function ripristinaWorkoutDemo(d, c, assegnazioni = [], sfide = []) {
  const r = riga(d, c)
  if ((d.workouts ?? []).some(w => w.id === r.workout_id)) throw new Error('cestino: id occupato')
  const scelteA = new Set(assegnazioni || [])
  const scelteS = new Set(sfide || [])
  ;(d.workouts ||= []).push({ ...r.copia.workout })
  for (const a of r.copia.assegnazioni) {
    if (!scelteA.has(a.riga.id) || motivoAtleta(d, a.riga.athlete_id)) continue
    ;(d.athlete_workouts ||= []).push({ ...a.riga })
    for (const l of r.copia.workout_logs) {
      if (l.athlete_id === a.riga.athlete_id) (d.workout_logs ||= []).push({ ...l })
    }
  }
  for (const s of r.copia.sfide) {
    if (!scelteS.has(s.riga.id) || !(d.team ?? []).some(t => t.id === s.riga.team_id)) continue
    ;(d.team_sfide ||= []).push({ ...s.riga })
    for (const x of s.risultati) {
      if ((d.athletes ?? []).some(a => a.id === x.atleta_id)) (d.team_risultati ||= []).push({ ...x })
    }
  }
  for (const t of d.team ?? []) {
    if (t.evento_id == null && r.copia.team_evento.includes(t.id)) t.evento_id = r.workout_id
  }
  d.cestino_workout = d.cestino_workout.filter(x => x.id !== c)
  return r.workout_id
}
