// HomeCoachTelefono.jsx — il corpo della Home coach sul telefono (14/10/2026).
//
// Lo stesso disegno del desktop in una colonna sola (tela «Home coach
// FLEOFIT», tavola Telefono), nell'ordine delle domande del mattino: come sta
// il team, chi si allena oggi e in che stato, cosa rivedere, cosa smaltire,
// cosa programmare, le gare. Prima l'eroe era il feedback: ora è una voce di
// «Da smaltire», perché guarda indietro.
//
// Pigro come HomeCoachDesktop, e per la stessa ragione: i conti del cruscotto
// pesano (src/useCruscottoCoach.js), e l'atleta non deve scaricarli.
// Testata, barra di ricerca e Live Coach Cam restano in Home.jsx.

import { ChartNoAxesColumn, Megaphone } from 'lucide-react'
import { cosaGuardare } from '../lib/cosaGuardare'
import { GIORNI_COPERTURA } from '../lib/statisticheCoach'
import { useCruscottoCoach } from '../useCruscottoCoach'
import { RigaDestinazione } from './HomeCoachUI'
import { PolsoTeam, CardOggi, CardSegnali, CardSmaltire, CardPiano, CardGare } from './CruscottoCoachUI'

export default function HomeCoachTelefono({
  atleti, assegnazioni, comeStai, estratti, righeGare, squadra, copertura,
  feedback, fermi, scaduti, caricamento, numeroWorkout,
  onApriAtleta, onApriFeedback, onApriScaduto, onApriSeduta, onReport, onArchivio, onMessaggio,
}) {
  const { gare, polso, oggi, segnali, piano, notaPiano } = useCruscottoCoach({
    atleti, assegnazioni, comeStai, estratti, righeGare, squadra, copertura, settimana: false,
  })
  const voci = cosaGuardare({ feedback, fermi, scaduti })
  const apri = (v) => {
    if (v.tipo === 'feedback') onApriFeedback(v.dato)
    else if (v.tipo === 'fermo') onApriAtleta(v.dato)
    else onApriScaduto(v.dato)
  }
  const apriGara = (g) => { if (g.workoutId) onApriSeduta({ workoutId: g.workoutId, atletaId: g.atleti[0]?.id }) }

  return (<>
    {caricamento
      ? <div className="rounded-[20px] border border-[#2a2a2a] bg-[#1e1e1e] h-[104px] animate-pulse" />
      : <PolsoTeam {...polso} compatto />}

    {/* «Alleggerisci» apre l'allenamento di QUELL'atleta: è lì che il coach lo
        modifica. Non tocca niente da solo — il workout può essere condiviso
        con altri atleti, e cambiarlo per tutti non è una decisione da un tocco. */}
    <CardOggi compatto righe={oggi} completati={squadra.completati} assegnati={squadra.assegnati}
      inCorso={squadra.inCorso} caricamento={caricamento}
      onApriAtleta={onApriAtleta} onAlleggerisci={(r) => onApriSeduta({ workoutId: r.workoutId, atletaId: r.id })} />

    <CardSegnali compatto segnali={segnali} caricamento={caricamento} onApri={(x) => onApriAtleta({ id: x.atletaId })} />

    <CardSmaltire compatto voci={voci} caricamento={caricamento} onApri={apri} />

    <CardPiano compatto piano={piano} titolo={`Prossimi ${GIORNI_COPERTURA} giorni`} nota={notaPiano}
      caricamento={caricamento} onApri={onApriSeduta} />

    <CardGare compatto gare={gare} onApri={apriGara} />

    {/* Report e archivio restano, in fondo: materiale di lavoro che si apre
        sapendo già cosa si cerca, e sul telefono non hanno una voce nella tab bar. */}
    <RigaDestinazione icona={Megaphone} titolo="Messaggio a tutti"
      sottotitolo="Un avviso per tutti gli atleti"
      label="Scrivi un messaggio a tutti gli atleti" onClick={onMessaggio} />
    <RigaDestinazione icona={ChartNoAxesColumn} titolo="Report settimanale"
      sottotitolo="Aderenza, carico e chi richiede un'azione"
      label="Apri il report settimanale" onClick={onReport} />
    <RigaDestinazione titolo="Archivio workout"
      sottotitolo={`${numeroWorkout} allenamenti · riusa e duplica`}
      label="Apri l'archivio dei workout" onClick={onArchivio} />
  </>)
}
