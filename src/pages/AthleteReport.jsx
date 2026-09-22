// Il report settimanale del SINGOLO atleta — `/report/:id`.
//
// Perché esiste accanto a `/report`: quello risponde a «com'è andata la
// squadra», che è triage — chi guardare per primo. Questa risponde a «cosa gli
// faccio fare adesso», e per rispondere serve altro materiale: le sedute una
// per una, i movimenti che ha davvero fatto con che carichi, e le quattro
// settimane precedenti come metro di paragone.
//
// 🔒 Riservata al coach, come `/report`: l'atleta che ci arriva viene rimandato
// alla Home e la pagina NON legge niente. ⚠️ È una guardia di interfaccia, non
// di sicurezza — i dati sono già protetti dalle policy RLS.
//
// Il calcolo sta in `src/lib/reportAtleta.js`, il disegno in
// `src/components/ReportAtletaUI.jsx`, e qui restano la rete e le destinazioni.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useIndietro } from '../useIndietro'
import { format, startOfDay } from 'date-fns'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { FINESTRA_STORICO } from '../lib/statisticheCoach'
import { settimanaReport, SETTIMANE_CRONICO } from '../lib/reportSettimanale'
import { reportAtleta, MOVIMENTI_IN_PAGINA, GIORNI_TRASCURATO } from '../lib/reportAtleta'
import { nomeAtleta } from '../lib/rigaAtleta'
import { IntestazioneSezione } from '../components/ArchivioUI'
import { VuotoReport } from '../components/ReportUI'
import {
  TestataReportAtleta, ProposteSettimana, NumeriAtleta, AndamentoSettimane,
  Diario, Movimenti, BarraAtleta, VuotoDiario, ScheletroAtleta,
} from '../components/ReportAtletaUI'

const iso = (d) => format(d, 'yyyy-MM-dd')

export default function AthleteReport() {
  const { id } = useParams()
  const [atleta, setAtleta] = useState(null)
  const [righe, setRighe] = useState([])
  const [caricato, setCaricato] = useState(false)
  const [errore, setErrore] = useState(false)
  const [caricatoIl, setCaricatoIl] = useState(() => Date.now())
  const [scarto, setScarto] = useState(0)
  const [movimentiEspansi, setMovimentiEspansi] = useState(false)
  const navigate = useNavigate()
  const indietro = useIndietro('/report')
  const { role } = useAuth()

  useEffect(() => {
    if (role === 'athlete') navigate('/', { replace: true })
  }, [role, navigate])

  useEffect(() => {
    if (role === 'athlete' || !id) return
    let vivo = true

    const carica = async () => {
      const adesso = new Date()
      const settimana = settimanaReport(adesso, scarto)

      // La stessa finestra del report squadra — indietro fino a
      // FINESTRA_STORICO, così «fermo da oltre» vuol dire la stessa cosa nelle
      // due schermate — e avanti di una settimana, che è la copertura da
      // programmare. Qui però è di UN atleta solo: niente join su `athletes`,
      // e un ordine di grandezza di righe in meno.
      const da = iso(new Date(startOfDay(settimana.inizio).getTime() - FINESTRA_STORICO * 86400000))
      const a = iso(new Date(startOfDay(settimana.fine).getTime() + 7 * 86400000))

      const [atletaRes, assRes] = await Promise.all([
        supabase.from('athletes').select('id, name, surname, photo_url, notes').eq('id', id).maybeSingle(),
        supabase.from('athlete_workouts')
          .select('id, athlete_id, completed_date, status, notes, voice_note_url, workouts(id, title, sections)')
          .eq('athlete_id', id)
          .gte('completed_date', da).lte('completed_date', a)
          .order('completed_date', { ascending: false })
          .limit(400),
      ])
      if (!vivo) return

      // ⚠️ Una lettura fallita NON si inghiotte (§9-quater): senza righe questa
      // pagina direbbe «non si è allenato» e proporrebbe di sentirlo. Un errore
      // travestito da dato, su una pagina che poi ti fa scrivere l'allenamento.
      const guasto = atletaRes.error || assRes.error
      if (guasto) console.error('Report atleta, lettura fallita:', guasto)
      setErrore(!!guasto)
      if (!guasto) {
        setAtleta(atletaRes.data || null)
        setRighe(assRes.data || [])
      }
      setCaricatoIl(Date.now())
      setCaricato(true)
    }

    carica()
    return () => { vivo = false }
  }, [role, id, scarto])

  // L'istante si fissa quando i dati arrivano, non durante il render: da qui
  // dipendono la settimana, il fermo e ogni finestra della pagina.
  const oggi = useMemo(() => new Date(caricatoIl), [caricatoIl])
  const report = useMemo(() => reportAtleta(righe, { oggi, scarto }), [righe, oggi, scarto])

  const apriSeduta = useCallback((s) => {
    // Il formato del deep link ai workout, lo stesso di `notifications.route`.
    if (s.workoutId) navigate(`/workout/${s.workoutId}?athlete_id=${id}`)
  }, [navigate, id])

  const cambiaSettimana = (delta) => {
    setScarto(s => Math.min(0, s + delta))
    setMovimentiEspansi(false)
  }

  const { settimana, misure, carico, sessioni, movimenti } = report
  const nome = atleta ? nomeAtleta(atleta) : 'Atleta'

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[var(--fondo-pagina)]">
      <TestataReportAtleta
        nome={caricato ? nome : ' '}
        foto={atleta?.photo_url}
        etichetta={settimana.etichetta}
        numero={settimana.numero}
        corrente={settimana.corrente}
        avanti={scarto < 0}
        onIndietro={indietro}
        onPrecedente={() => cambiaSettimana(-1)}
        onSuccessiva={() => cambiaSettimana(1)}
      />

      {/* ⚠️ Come nel report della squadra: `TestataReportAtleta` è `sticky` e
          non entra. Vedi WeeklyReport.jsx per il perché dell'involucro. */}
      <div className="cascata">
      {!caricato ? <ScheletroAtleta /> : errore ? (
        <VuotoReport
          titolo="Non sono riuscito a leggere la settimana"
          dettaglio="Controlla la connessione e riprova: meglio non dirti niente che proporti un allenamento su dati che non sono arrivati." />
      ) : !atleta ? (
        <VuotoReport titolo="Atleta non trovato"
          dettaglio="Potrebbe essere stato eliminato. Torna al report della squadra per vedere chi c'è. 🔎" />
      ) : (
        <>
          {/* L'eroe è la PROPOSTA, non il numero: la domanda per cui si apre
              questa pagina è cosa fargli fare, e i numeri sotto servono a
              verificarla. Regola dell'Eroe Unico. */}
          <ProposteSettimana voci={report.proposte.voci} settimana={settimana.etichetta}
            verdetto={report.verdetto} />

          <NumeriAtleta misure={misure} carico={carico}
            corrente={settimana.corrente} trascorsi={settimana.trascorsi} />

          <AndamentoSettimane settimane={report.settimane} />

          <IntestazioneSezione etichetta="Seduta per seduta"
            conteggio={sessioni.length > 0 ? `${sessioni.length}` : '—'} />
          {sessioni.length > 0
            ? <Diario sessioni={sessioni} onApri={apriSeduta} />
            : <VuotoDiario corrente={settimana.corrente} />}

          {movimenti.length > 0 && (
            <Movimenti righe={movimenti} mostrati={MOVIMENTI_IN_PAGINA} espanso={movimentiEspansi}
              onEspandi={() => setMovimentiEspansi(true)} soglia={GIORNI_TRASCURATO}
              corseEscluse={report.corseEscluse} />
          )}

          <p className="mt-3 px-0.5 text-[11px] leading-relaxed text-[#5b6070]">
            Movimenti e carichi vengono dalle sedute <strong className="font-bold text-muted">completate</strong> degli
            ultimi {FINESTRA_STORICO} giorni; il carico è minuti × RPE dichiarato e il moltiplicatore
            confronta la settimana con la media delle ultime {SETTIMANE_CRONICO}.
          </p>

          <BarraAtleta onScheda={() => navigate(`/athletes/${id}`)} onCrea={() => navigate('/create')} />
        </>
      )}
      </div>
    </div>
  )
}
