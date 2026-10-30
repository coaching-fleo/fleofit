// I testi della notifica al coach, in una funzione pura (provata da Vitest).
// ⚠️ I testi esistenti devono restare identici byte per byte: la web app e le app
// negli Store leggono queste stesse notifiche.

export const SUFFISSO_DA_GARMIN = ' · da Garmin'

export type TestoNotifica = { title: string; bodyMsg: string }

/** Titolo e corpo della notifica al coach per una `action`. `daGarmin` vale solo per `completed`. */
export function testoNotificaCoach(body: Record<string, any>): TestoNotifica {
  let title = 'Aggiornamento Atleta'
  let bodyMsg = ''
  if (body.action === 'note') {
    title = `📝 Nota da ${body.athleteName}`
    bodyMsg = `${body.workoutTitle}: "${body.noteText}"`
  } else if (body.action === 'completed') {
    title = `✅ Workout completato!`
    bodyMsg = `${body.athleteName} ha completato: ${body.workoutTitle}${body.daGarmin === true ? SUFFISSO_DA_GARMIN : ''}`
  } else if (body.action === 'custom_workout') {
    title = `🏃‍♂️ Nuovo allenamento libero`
    bodyMsg = `${body.athleteName} ha aggiunto: ${body.workoutTitle}`
  } else if (body.action === 'moved') {
    // `newDate` arriva già scritta per esteso («mer 28 ott»): qui non si formatta.
    title = `📅 Allenamento spostato`
    bodyMsg = `${body.athleteName} ha spostato ${body.workoutTitle}${body.newDate ? ` a ${body.newDate}` : ''}`
  }
  return { title, bodyMsg }
}

export const TITOLO_GARMIN_REGISTRATO = '🎉 Allenamento completato!'

/**
 * La push all'atleta quando Garmin ha registrato il suo allenamento: i
 * complimenti, come Strava e Runna (30/10/2026). «registrato da Garmin» resta:
 * è la fonte del completamento (linee guida di marchio Garmin). Il link apre
 * la scheda, il «Com'è andata?» e poi il recap (`?rpe=1`, WorkoutDetail).
 */
export function testoGarminRegistrato(workoutTitle: string, workoutId: string, athleteId: string) {
  return {
    title: TITOLO_GARMIN_REGISTRATO,
    bodyMsg: `Complimenti! ${workoutTitle} · registrato da Garmin. Com'è andata?`,
    route: `/workout/${workoutId}?athlete_id=${athleteId}&rpe=1`,
  }
}
