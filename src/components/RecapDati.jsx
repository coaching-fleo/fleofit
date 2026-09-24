// Il recap post-allenamento: le sue letture (22/09/2026).
//
// Sta fra `RecapAllenamento.jsx` — il confine pigro che le tre pagine montano —
// e i due moduli che fanno il lavoro vero:
// `src/lib/recapAllenamento.js` decide cosa mostrare, `RecapUI.jsx` lo disegna.
//
// 🔴 PERCHÉ LA LETTURA STA QUI E NON NELLE PAGINE. Delle tre, solo la Home ha
// già in mano lo storico dell'atleta — e ne ha 60 giorni, mentre al grafico
// delle settimane ne servono 90. Le altre due avrebbero dovuto caricarsi uno
// storico che non usano per nient'altro, a ogni apertura, per un recap che si
// vede solo quando si chiude un allenamento. Qui la lettura parte **quando il
// recap si apre**, cioè qualche volta a settimana, ed è la stessa in tutte e
// tre.
//
// ⚠️ La scheda «fatto» non aspetta niente: è costruita con i dati che la pagina
// ha già in mano e va a schermo al primo fotogramma. Le altre si aggiungono
// quando la lettura arriva — non c'è un momento in cui il recap sia una rotella.

import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../supabaseClient'
import { costruisciRecap, recapMinimo, GIORNI_RECAP } from '../lib/recapAllenamento'
import { conGradimento, gradimentoDopoSalta } from '../lib/gradimento'
import { accodaSuStorage } from '../lib/offlineQueue'
import { FoglioRecap } from './RecapUI'

export default function RecapDati({ aw, atletaId, onChiudi, onApri, onLibero, onNote }) {
  // La nota com'è ADESSO sul server. Parte da quella del completamento e
  // segue ogni risposta: un secondo parere (si torna indietro e si cambia
  // idea) deve partire dal primo, non dalla nota di prima del recap.
  const notaAttuale = useRef(aw?.notes || '')
  const [storico, setStorico] = useState(null)
  const [totale, setTotale] = useState(null)
  // ⚠️ Lo stato iniziale dice già se c'è qualcosa da aspettare: metterlo a
  // `true` e spegnerlo dentro l'effetto quando l'atleta non c'è è un render
  // in più e un `set-state-in-effect` in lista (CLAUDE.md §9-septies).
  const [caricamento, setCaricamento] = useState(() => !!atletaId)

  useEffect(() => {
    if (!atletaId) return
    let vivo = true

    const dal = format(new Date(Date.now() - GIORNI_RECAP * 86400000), 'yyyy-MM-dd')

    // Due letture, e la seconda è volutamente magra. La prima porta `sections`,
    // che è la colonna più pesante del database, e per questo è limitata alla
    // finestra; la seconda serve solo a contare quanti allenamenti l'atleta ha
    // chiuso **in tutta la sua storia** — il numero che rende «il tuo 47°» una
    // cosa vera invece di una riferita agli ultimi tre mesi — e per contarli
    // basta l'id.
    Promise.all([
      supabase.from('athlete_workouts')
        .select('id, status, completed_date, notes, workouts (id, title, sections)')
        .eq('athlete_id', atletaId)
        .gte('completed_date', dal)
        .order('completed_date', { ascending: true }),
      supabase.from('athlete_workouts')
        .select('id')
        .eq('athlete_id', atletaId)
        .eq('status', 'completed'),
    ]).then(([finestra, tutti]) => {
      if (!vivo) return
      // ⚠️ Una lettura fallita NON diventa uno storico vuoto: `costruisciRecap`
      // con zero allenamenti annuncia «il primo è fatto», e dirlo a chi ne ha
      // cento è un guasto travestito da dato. Qui resta `null`, e il recap si
      // ferma alla scheda che non ha bisogno di leggere niente.
      if (!finestra.error && Array.isArray(finestra.data)) setStorico(finestra.data)
      if (!tutti.error && Array.isArray(tutti.data)) setTotale(tutti.data.length)
      setCaricamento(false)
    }).catch((e) => {
      console.error('[recap] lettura fallita', e)
      if (vivo) setCaricamento(false)
    })

    return () => { vivo = false }
  }, [atletaId])

  /**
   * Il parere sull'allenamento: 'si', 'no', oppure `null` per «Salta».
   *
   * ⚠️ Non blocca niente e non mostra errori: il recap va avanti nello stesso
   * istante, e un allarme rosso su una schermata di festeggiamento per un dato
   * facoltativo sarebbe sproporzionato. Se l'aggiornamento fallisce — offline,
   * o il server che non risponde — la nota finisce nella coda offline, che è
   * UNA voce per allenamento (`accoda`): se il completamento stesso era in
   * coda, questa voce lo sostituisce portandosi dietro anche lo stato.
   */
  const salvaGradimento = (scelta) => {
    if (!aw?.id) return
    const valore = scelta ?? gradimentoDopoSalta(notaAttuale.current)
    const note = conGradimento(notaAttuale.current, valore)
    if (note === notaAttuale.current) return
    notaAttuale.current = note
    onNote?.(aw.id, note)

    const accoda = () => accodaSuStorage({ id: aw.id, status: aw.status || 'completed', notes: note })
    Promise.resolve(supabase.from('athlete_workouts').update({ notes: note }).eq('id', aw.id))
      .then(({ error } = {}) => {
        if (error) { console.error('[recap] gradimento non salvato, in coda', error); accoda() }
      })
      .catch((e) => { console.error('[recap] gradimento non salvato, in coda', e); accoda() })
  }

  const recap = useMemo(() => {
    if (!aw) return null
    if (!storico) return recapMinimo({ aw })
    return costruisciRecap({ aw, storico, totaleCompletati: totale })
  }, [aw, storico, totale])

  if (!recap) return null

  return (
    <FoglioRecap recap={recap} caricamento={caricamento}
      onChiudi={onChiudi} onApri={onApri} onLibero={onLibero} onGradimento={salvaGradimento} />
  )
}
