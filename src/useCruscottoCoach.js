// useCruscottoCoach — i conti del cruscotto della Home coach (14/10/2026).
//
// Sta in un file suo, e non in Home.jsx, per il PESO: `segnaliProgramma` si
// porta dietro le regole di «Dalle note» (supabase/functions/estrai-note/
// regole.ts) e la griglia del calendario. Importato da Home.jsx finirebbe nel
// chunk d'ingresso, che scarica anche ogni atleta: +26 KB misurati il
// 14/10/2026 (CLAUDE.md §2). Lo importano solo i due pezzi pigri del coach,
// HomeCoachDesktop e HomeCoachTelefono.

import { useMemo } from 'react'
import { aderenzaTeam, rpeTeam, comeStaTeam, gareInArrivo, oggiConComeSta, segnaliProgramma,
         pianoGiorni, prossimiGiorni } from './lib/cruscottoCoach'
import { giorniSettimana } from './lib/calendarioTeam'
import { GIORNI_COPERTURA } from './lib/statisticheCoach'

/**
 * @param atleti       la rubrica (senza l'account del coach)
 * @param assegnazioni le righe della finestra della Home
 * @param comeStai     le risposte di oggi a «Come stai»
 * @param estratti     gli estratti delle note delle ultime settimane
 * @param righeGare    le assegnazioni dei prossimi due mesi
 * @param squadra      `squadraDelGiorno` di oggi
 * @param copertura    `copertura` dei prossimi tre giorni
 * @param settimana    true: la griglia è la settimana intera (desktop), false: i prossimi tre giorni
 */
export function useCruscottoCoach({ atleti, assegnazioni, comeStai, estratti, righeGare, squadra, copertura, settimana }) {
  const gare = useMemo(() => gareInArrivo(atleti, righeGare), [atleti, righeGare])
  const polso = useMemo(() => ({
    aderenza: aderenzaTeam(atleti, assegnazioni),
    rpe: rpeTeam(atleti, assegnazioni),
    comeSta: comeStaTeam(atleti, assegnazioni, comeStai),
    gara: gare[0] || null,
  }), [atleti, assegnazioni, comeStai, gare])
  const oggi = useMemo(() => oggiConComeSta(squadra.righe, comeStai), [squadra, comeStai])
  const segnali = useMemo(() => segnaliProgramma(atleti, assegnazioni, estratti), [atleti, assegnazioni, estratti])
  const piano = useMemo(
    () => pianoGiorni(atleti, assegnazioni, settimana ? giorniSettimana(new Date()) : prossimiGiorni(new Date(), GIORNI_COPERTURA)),
    [atleti, assegnazioni, settimana]
  )
  // Sotto la griglia, il numero che dice «devi programmare adesso»: chi non ha
  // niente nei prossimi tre giorni. È la copertura di prima, con le parole.
  const notaPiano = copertura.totale === 0 ? null : copertura.senza > 0
    ? { avviso: true, testo: `${copertura.senza} ${copertura.senza === 1 ? 'atleta' : 'atleti'} senza allenamento nei prossimi ${GIORNI_COPERTURA} giorni` }
    : { avviso: false, testo: `Tutti programmati per i prossimi ${GIORNI_COPERTURA} giorni` }
  return { gare, polso, oggi, segnali, piano, notaPiano }
}
