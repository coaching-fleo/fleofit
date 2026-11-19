// Il cestino dei workout (19/11/2026, docs/memoria/cestino.md). Un workout
// eliminato resta 14 giorni in `cestino_workout`, poi il cron lo cancella.
// Qui la logica pura: quanto manca, come si legge una riga e una voce del
// ripristino, quali voci partono spuntate, chi entra nel cestino.

import { addDays, differenceInCalendarDays, format } from 'date-fns'
import { it } from 'date-fns/locale'
import { separaCodice } from './codiceWorkout'
import { rpeDichiarato } from './rpe'

export const GIORNI_CESTINO = 14

/** Giorni prima della cancellazione definitiva, mai sotto zero. */
export function giorniRimasti(eliminatoIl, ora = new Date()) {
  // Giorni di calendario fino all'ultimo giorno in cui è ancora nel cestino
  // (il giorno dell'eliminazione + 14): il cron delle 00:10 UTC lo toglie la
  // notte dopo. Appena eliminato = 14, l'ultimo giorno = 0.
  const eliminato = new Date(eliminatoIl)
  if (Number.isNaN(eliminato.getTime())) return 0
  const giorni = differenceInCalendarDays(addDays(eliminato, GIORNI_CESTINO), ora)
  return Math.max(0, giorni)
}

const testoScadenza = (giorni) => {
  if (giorni <= 0) return 'si cancella stanotte'
  if (giorni === 1) return 'resta fino a domani'
  return `si cancella tra ${giorni} giorni`
}

/** Una riga della lista del cestino, pronta da mostrare. */
export function rigaCestino(riga, ora = new Date()) {
  const { nome, codice } = separaCodice(riga?.titolo)
  const quando = riga?.eliminato_il ? format(new Date(riga.eliminato_il), 'd MMM, HH:mm', { locale: it }) : ''
  const chi = String(riga?.eliminato_da_nome ?? '').trim()
  return {
    titolo: nome || 'Workout',
    codice,
    dataWorkout: riga?.data_workout ?? null,
    eliminato: chi ? `eliminato da ${chi} il ${quando}` : `eliminato il ${quando}`,
    scade: testoScadenza(giorniRimasti(riga?.eliminato_il, ora)),
  }
}

/** Titolo e dettaglio di una voce del foglio di ripristino. */
export function etichettaVoce(voce) {
  if (voce?.tipo === 'sfida') {
    return { titolo: `Sfida · ${voce.team}`, dettaglio: String(voce.metrica ?? '') }
  }
  const parti = [voce?.stato === 'completed' ? 'completato' : 'da fare']
  const rpe = rpeDichiarato(voce?.notes)
  if (rpe != null) parti.push(`RPE ${rpe}`)
  if (voce?.nota_vocale) parti.push('nota vocale')
  return { titolo: String(voce?.atleta ?? 'Atleta'), dettaglio: parti.join(', ') }
}

/** All'apertura del foglio: spuntate tutte le voci che si possono ripristinare. */
export function spunteIniziali(voci) {
  return new Set((voci || []).filter(v => v?.ripristinabile).map(v => v.id))
}

/**
 * Il workout finirà nel cestino? No se l'ha scritto uno degli atleti a cui è
 * assegnato (l'allenamento libero), sì altrimenti — autore null compreso.
 * Deve dire lo stesso del trigger `cestino_copia`, che guarda se l'autore è staff.
 */
export function finisceNelCestino(workout, idAtletiAssegnati = []) {
  const autore = workout?.creato_da
  if (!autore) return true
  return !(idAtletiAssegnati || []).includes(autore)
}
