// I testi della notifica al coach, in una funzione pura (provata da Vitest).
// ⚠️ I testi esistenti devono restare identici byte per byte: la web app e le app
// negli Store leggono queste stesse notifiche.

export const SUFFISSO_DA_GARMIN = ' · da Garmin'

export type TestoNotifica = { title: string; bodyMsg: string }

export const TITOLO_REGISTRATO = '👋 Nuovo atleta'

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
  } else if (body.action === 'registered') {
    // Un atleta nuovo, entrato con il codice invito del coach (11/11/2026).
    // «tra i tuoi atleti» e non «iscritto/iscritta»: il genere non lo sappiamo.
    title = TITOLO_REGISTRATO
    bodyMsg = `${body.athleteName} ha usato il tuo codice invito: da oggi è tra i tuoi atleti.`
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

const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

/** 'yyyy-MM-dd' → «ven 4 dic» (come `dataBreve` dell'app); '' se non è una data. */
export function dataSpostamento(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (isNaN(d.getTime())) return ''
  return `${GIORNI_BREVI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI_BREVI[d.getUTCMonth()]}`
}

/** Gli id delle assegnazioni dal corpo: solo stringhe, al massimo 200. */
export function idsSpostamento(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return ids.filter((x): x is string => typeof x === 'string').slice(0, 200)
}

/**
 * La push all'atleta quando il coach gli sposta un allenamento (26/11/2026,
 * modo `athlete_moved`). ⚠️ La data viene dalla riga (`completed_date`), MAI
 * dal corpo della chiamata: un testo libero arrivava così in una push a molti
 * atleti (revisione finale, 26/11/2026).
 */
export function testoSpostatoDalCoach({ workoutTitle, completedDate }: { workoutTitle: string; completedDate: string }): TestoNotifica {
  const data = dataSpostamento(completedDate)
  return { title: '📅 Allenamento spostato', bodyMsg: data ? `${workoutTitle} ora è ${data}` : `${workoutTitle} ha una data nuova` }
}

/**
 * Chi avvisare fra le assegnazioni spostate: mai chi l'ha già svolto (è una
 * correzione, non un avviso); un coach solo i suoi atleti, un admin (o il
 * servizio) tutti, nessun altro nessuno.
 */
export function daAvvisareSpostamento<T extends { athlete_id: string; status: string }>(
  righe: T[],
  { ruoloStaff, servizio = false, mieiAtleti }: { ruoloStaff: 'admin' | 'coach' | null; servizio?: boolean; mieiAtleti: string[] },
): T[] {
  const daFare = righe.filter(r => r.status !== 'completed')
  if (servizio || ruoloStaff === 'admin') return daFare
  if (ruoloStaff === 'coach') return daFare.filter(r => mieiAtleti.includes(r.athlete_id))
  return []
}
