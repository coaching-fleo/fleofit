import { format, parseISO, isValid } from 'date-fns'
import { it } from 'date-fns/locale'

// La riga «Sull'orologio» della scheda: parte dalla riga di `garmin_invii`
// (stato + giorno) e dice cosa mostrare. Senza riga non si mostra niente.
export function rigaOrologio(invio) {
  if (!invio) return null
  if (invio.stato === 'inviato') {
    const d = invio.data ? parseISO(invio.data) : null
    const giorno = d && isValid(d) ? ` · ${format(d, 'd MMM', { locale: it })}` : ''
    return { testo: `Sull'orologio${giorno}`, riprova: false }
  }
  if (invio.stato === 'da_rifare' || invio.stato === 'errore') {
    return { testo: 'Non inviato', riprova: true }
  }
  return null
}
