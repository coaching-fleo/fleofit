// Il cestino dei workout (19/11/2026, docs/memoria/cestino.md). Un workout
// eliminato resta 14 giorni in `cestino_workout`, poi il cron lo cancella.
// Qui la logica pura: quanto manca, come si legge una riga e una voce del
// ripristino, quali voci partono spuntate, chi entra nel cestino.

import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { separaCodice } from './codiceWorkout'
import { rpeDichiarato } from './rpe'

export const GIORNI_CESTINO = 14

const GIORNO_MS = 86_400_000

/** Giorni interi prima della cancellazione definitiva, mai sotto zero. */
export function giorniRimasti(eliminatoIl, ora = new Date()) {
  const scadenza = new Date(eliminatoIl).getTime() + GIORNI_CESTINO * GIORNO_MS
  const giorni = Math.floor((scadenza - ora.getTime()) / GIORNO_MS)
  return Number.isFinite(giorni) ? Math.max(0, giorni) : 0
}

const testoScadenza = (giorni) => {
  if (giorni <= 0) return 'si cancella oggi'
  if (giorni === 1) return 'si cancella domani'
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
