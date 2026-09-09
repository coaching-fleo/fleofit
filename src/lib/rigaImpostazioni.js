// Le poche cose che la pagina Impostazioni deve CALCOLARE, fuori dal JSX.
//
// Stesso patto di rigaArchivio, rigaAtleta e rigaCalendario: qui non entra né
// una `supabase` né un componente. Sono le tre righe di testo che nel rework
// del 01/09/2026 hanno smesso di essere descrizioni generiche («Scarica un
// file .json con tutti gli atleti e i workout») e sono diventate numeri — ed
// è esattamente il punto in cui un numero inventato passerebbe inosservato.

import { format, parseISO, isValid } from 'date-fns'
import { it } from 'date-fns/locale'

/**
 * Quando questo dispositivo ha esportato il database l'ultima volta.
 *
 * ⚠️ È una memoria LOCALE, non un registro dei backup: `athletes` e `workouts`
 * non hanno una colonna che dica quando qualcuno ha scaricato il file, e lo
 * schema è congelato (CLAUDE.md regola 0-bis). Quindi la riga può dire «l'hai
 * esportato il 28 ago da questo iPhone» e non può dire «esiste un backup del
 * 28 ago»: sono due affermazioni diverse, e la seconda sarebbe falsa per chi
 * cambia telefono.
 */
export const CHIAVE_ULTIMO_EXPORT = 'fleofit_ultimo_export'

/** «1 attivo» / «3 attivi» — l'accordo che una `${n} attivi` sbaglia su uno. */
const conta = (n, singolare, plurale) => `${n} ${n === 1 ? singolare : plurale}`

/**
 * Il sottotitolo della riga «Codici invito»: quanti ce ne sono in circolazione
 * e quanti sono già stati bruciati.
 *
 * ⚠️ Torna `null` finché i codici non sono arrivati, e la riga in quel caso non
 * scrive niente invece di scrivere «0 attivi · 0 usati» — che è un dato, e
 * durante il caricamento sarebbe un dato falso. È la stessa regola per cui
 * `rpeAtteso` torna `null` invece di 5.
 */
export function riassuntoCodici(codici) {
  if (!Array.isArray(codici)) return null

  const attivi = codici.filter(c => c?.is_active).length
  const usati = codici.filter(c => c && !c.is_active && c.used_by).length

  // ⚠️ «Nessun codice generato» si dice solo sulla tabella VUOTA, non su
  // `attivi === 0 && usati === 0`: un codice spento che nessuno ha riscattato
  // esiste, non compare in nessuna delle due liste del foglio, e invitare a
  // generarne uno nuovo sarebbe l'unica frase della riga che si può smentire
  // aprendola.
  if (codici.length === 0) return 'Nessun codice generato'
  if (attivi === 0) return `Nessuno attivo · ${conta(usati, 'usato', 'usati')}`
  return `${conta(attivi, 'attivo', 'attivi')} · ${conta(usati, 'usato', 'usati')}`
}

/**
 * Il sottotitolo della riga «Esporta database»: quando l'hai fatto l'ultima
 * volta da qui, e cosa finirebbe nel file adesso.
 *
 * ⚠️ I due conteggi sono quelli GREZZI delle tabelle, cioè esattamente ciò che
 * `handleExportFull` scrive nel .json — atleti eliminati compresi. Non
 * coincidono con i «9 atleti» della rubrica, che filtra `deleted_at` e
 * l'account del coach, ed è voluto: questa riga descrive un file, non una
 * squadra. Prendere il numero della rubrica farebbe promettere all'export un
 * contenuto che non ha.
 *
 * ⚠️ Ogni pezzo compare solo se esiste. Un conteggio mancante — la query è
 * fallita, o non è ancora tornata — non diventa `0`: sparisce, e la riga
 * ripiega sulla descrizione di prima.
 */
export function riassuntoBackup({ ultimoExport = null, atleti = null, workout = null } = {}) {
  const pezzi = []

  const quando = dataLeggibile(ultimoExport)
  if (quando) pezzi.push(`Ultimo export ${quando}`)

  if (Number.isFinite(atleti) && Number.isFinite(workout)) {
    pezzi.push(`${conta(atleti, 'atleta', 'atleti')} · ${conta(workout, 'workout', 'workout')}`)
  }

  return pezzi.length ? pezzi.join(' · ') : 'Tutti gli atleti e i workout in un file .json'
}

/** Una ISO illeggibile non è una ragione per non mostrare la riga. */
function dataLeggibile(iso) {
  if (!iso || typeof iso !== 'string') return null
  try {
    const d = parseISO(iso)
    return isValid(d) ? format(d, 'd MMM', { locale: it }) : null
  } catch {
    return null
  }
}

/**
 * La pillola accanto al nome nell'eroe.
 *
 * ⚠️ In anteprima atleta `role` vale davvero `'athlete'` (App.jsx lo riscrive
 * quando c'è `adminRoleOverride`), quindi senza il secondo pezzo la pillola
 * direbbe «Atleta» a un coach e sarebbe l'unica cosa in pagina a non spiegare
 * perché metà dei comandi sono spariti.
 */
export function etichettaRuolo(role, { anteprimaAtleta = false } = {}) {
  if (anteprimaAtleta) return 'Anteprima atleta'
  return role === 'athlete' ? 'Atleta' : 'Coach'
}
