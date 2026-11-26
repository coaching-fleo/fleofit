// etichettaData — la pillola della data al passo 2 di Crea workout (26/11/2026).
// La data non si sceglie più al passo 1: parte da oggi (o dal giorno del
// Calendario) e la pillola dice qual è, a parole quando è vicina.
import { parseISO, isValid, differenceInCalendarDays, format } from 'date-fns'
import { it } from 'date-fns/locale'

const VICINI = { 0: 'Oggi', 1: 'Domani', '-1': 'Ieri' }

/** 'yyyy-MM-dd' → «Oggi, gio 26 nov» / «Domani, …» / «Ieri, …» / «Lun 1 dic». */
export function etichettaData(iso, oggi = new Date()) {
  const d = typeof iso === 'string' && iso ? parseISO(iso) : null
  if (!d || !isValid(d)) return 'Scegli la data'
  const giorno = format(d, 'EEE d MMM', { locale: it })
  const vicino = VICINI[differenceInCalendarDays(d, oggi)]
  return vicino ? `${vicino}, ${giorno}` : giorno.charAt(0).toUpperCase() + giorno.slice(1)
}
