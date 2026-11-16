// I membri di un team, in parole (06/11/2026, spec §5-§6). Puro, salvo le
// funzioni già pure di constants.js e pausa.js. Lo usano la scheda del team e
// il foglio dell'invito.
import { escludiDallaRubrica } from './constants'
import { inPausa } from './pausa'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { GIORNI_REINVITO, ordinaSfida, puoReinvitare } from './sfidaTeam'

const GIORNO = 86400000

export const ETICHETTE_METRICA = { tempo: 'Tempo', ripetizioni: 'Ripetizioni', kg: 'Kg', distanza: 'Distanza' }

const giorni = (n) => (n === 1 ? '1 giorno' : `${n} giorni`)

/** Lo stato di un membro come lo legge il coach. */
export function testoStato(m, adesso = new Date()) {
  if (m.stato === 'dentro') return 'Dentro'
  if (m.stato === 'rifiutato') return 'Non ha accettato'
  if (m.stato === 'uscito') return 'È uscito'
  const n = Math.floor((adesso.getTime() - new Date(m.invitato_il).getTime()) / GIORNO)
  return n <= 0 ? 'In attesa da oggi' : `In attesa da ${giorni(n)}`
}

/** Quanti giorni mancano al reinvito (0 = si può già). */
export function giorniAlReinvito(rispostoIl, adesso = new Date()) {
  if (puoReinvitare(rispostoIl, adesso)) return 0
  const mancano = GIORNI_REINVITO * GIORNO - (adesso.getTime() - new Date(rispostoIl).getTime())
  return Math.max(1, Math.ceil(mancano / GIORNO))
}

export const testoReinvito = (n) => `Fra ${giorni(n)}`

/** Chi si può invitare: i suoi atleti non dentro, non invitati, non in pausa, non eliminati. */
export function invitabili(atleti, membri, coachId, adesso = new Date()) {
  const perId = new Map((membri || []).map(m => [m.atleta_id, m]))
  return escludiDallaRubrica(atleti)
    .filter(a => !a.deleted_at && !inPausa(a) && a.id !== coachId)
    .filter((a) => {
      const m = perId.get(a.id)
      if (!m) return true
      return ['rifiutato', 'uscito'].includes(m.stato) && puoReinvitare(m.risposto_il, adesso)
    })
}

/** «ven 6 nov» da un giorno 'yyyy-MM-dd'; '' se non si legge. */
export const giornoBreve = (d) => {
  try { return format(new Date(`${d}T12:00:00`), 'EEE d MMM', { locale: it }) } catch { return '' }
}

/** Il nome di un atleta della scheda; chi non c'è più (uscito o assente) è «Ex membro». */
export const nomeDa = (membri) => (id) => {
  const m = (membri || []).find(x => x.atleta_id === id && x.stato !== 'uscito')
  return m ? `${m.nome || ''} ${m.cognome || ''}`.trim() : 'Ex membro'
}

/** Com'è finita una sfida, in una riga. */
export function esitoSfida(s, nome) {
  if (!s.chiusa_il) return 'In corso'
  const primi = ordinaSfida(s.risultati, [], s.metrica).filter(r => r.posto === 1)
  if (!primi.length) return 'Nessun risultato'
  return primi.length === 1 ? `Vince ${nome(primi[0].atleta_id)}` : 'Pari'
}

/** «Luca B.»: il nome e l'iniziale del cognome, dove lo spazio è poco (podio, fila dei membri). */
export const nomeBreve = (nome = '', cognome = '') => {
  const c = String(cognome || '').trim()
  return `${String(nome || '').trim()}${c ? ` ${c[0].toUpperCase()}.` : ''}`.trim() || '—'
}

/**
 * I team da mostrare nella scheda di UN atleta (16/11/2026), ognuno con lo
 * stato in parole e l'unica azione che il database accetterà:
 *   · 'invita'  — nessuna riga, o rifiutato/uscito da almeno 3 giorni;
 *   · 'annulla' — invito in attesa;
 *   · 'togli'   — dentro (cancella la riga: team_togli_2026-11-16.sql);
 *   · null      — reinvito troppo presto, atleta in pausa.
 * Si offrono solo i team APERTI di un coach che l'atleta segue (`coachDi`,
 * da coach_atleti): negli altri l'invito verrebbe rifiutato. Un team di un
 * altro coach in cui è già dentro o invitato resta, senza azione.
 */
export function teamPerAtleta(team = [], righe = [], { coachDi = [], inPausa = false, adesso = new Date() } = {}) {
  const perTeam = new Map((righe || []).map(r => [r.team_id, r]))
  const coach = new Set(coachDi)
  return (team || []).filter(t => !t.chiuso_il).flatMap((t) => {
    const r = perTeam.get(t.id)
    const presente = r && ['dentro', 'invitato'].includes(r.stato)
    if (!coach.has(t.coach_id)) {
      return presente ? [{ ...t, stato: r.stato, testo: testoStato(r, adesso), azione: null }] : []
    }
    if (r?.stato === 'dentro') return [{ ...t, stato: 'dentro', testo: testoStato(r, adesso), azione: 'togli' }]
    if (r?.stato === 'invitato') return [{ ...t, stato: 'invitato', testo: testoStato(r, adesso), azione: 'annulla' }]
    const prima = r ? testoStato(r, adesso) : ''
    if (r && !puoReinvitare(r.risposto_il, adesso)) {
      const n = giorniAlReinvito(r.risposto_il, adesso)
      return [{ ...t, stato: 'attesa', testo: `${prima} · ${testoReinvito(n).toLowerCase()}`, azione: null }]
    }
    if (inPausa) return [{ ...t, stato: 'fuori', testo: 'In pausa', azione: null }]
    return [{ ...t, stato: 'fuori', testo: prima, azione: 'invita' }]
  })
}
