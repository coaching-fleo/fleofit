// Cosa propone la TV quando si scansiona il suo QR: confermare un workout,
// sceglierlo da una lista, oppure (se oggi non c'è niente) ripescarlo dagli
// ultimi giorni. Logica PURA: «oggi» arriva da fuori in formato yyyy-MM-dd
// locale, come `workouts.date`, e qui dentro non si legge mai l'orologio.
//
// Regole:
// - solo l'ATLETA con UN workout oggi ha la conferma, salvo `forzaLista` («No, un
//   altro», anche dalla scheda: `?altro=1`); coach e admin non hanno un «loro»
//   workout, quindi vedono sempre la lista. (Il workout già aperto non passa più
//   di qui: lo chiede la scheda stessa, FoglioChiediTV — ruling 7.)
// - gli eventi (gare) non si mandano in TV: esclusi sempre;
// - `recenti` = i 7 giorni prima di oggi (oggi escluso), dal più recente, max 20.

import { format, parseISO, subDays } from 'date-fns'

const MAX_RECENTI = 20
const GIORNI_RECENTI = 7

const eUnEvento = (w) => w?.sections?.category === 'Event'

export function sceltaTV({ ruolo, oggi, workouts = [], forzaLista = false }) {
  const validi = workouts.filter((w) => !eUnEvento(w))

  const daOggi = validi.filter((w) => w.date === oggi)

  // Date come stringhe yyyy-MM-dd: l'ordine alfabetico è quello cronologico.
  const inizio = format(subDays(parseISO(oggi), GIORNI_RECENTI), 'yyyy-MM-dd')
  const recenti = validi
    .filter((w) => w.date >= inizio && w.date < oggi)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, MAX_RECENTI)

  if (daOggi.length === 0) return { tipo: 'vuoto', recenti }
  if (ruolo === 'athlete' && daOggi.length === 1 && !forzaLista) {
    return { tipo: 'conferma', workout: daOggi[0] }
  }
  return { tipo: 'lista', oggi: daOggi, recenti }
}
