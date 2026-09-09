// Il report settimanale del coach — BACKLOG #27 («Coach Copilot»).
//
// Perché esiste: l'app dice al coach cosa succede OGGI (la Home) e com'è andato
// UN atleta (la scheda). La settimana della squadra — la domanda su cui si
// programma quella dopo — non la diceva nessuno: si ricavava aprendo una
// scheda alla volta e tenendo a mente i numeri.
//
// 🔒 È l'unica schermata dell'app riservata al coach in senso stretto: non
// esiste una versione «atleta» di questa pagina, e l'atleta che ci arriva viene
// rimandato alla Home (stessa guardia di `Athletes`). ⚠️ La guardia è di
// interfaccia, non di sicurezza: i dati sono già protetti dalle policy RLS, e
// un atleta che chiamasse l'API riceverebbe le sue righe e basta.
//
// Nessun campo di Supabase cambia forma, nessuna colonna nuova: tutto il
// report esce da due letture su tabelle esistenti. Il calcolo sta in
// `src/lib/reportSettimanale.js`, il disegno in `src/components/ReportUI.jsx`,
// e qui restano la rete e le destinazioni.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIndietro } from '../useIndietro'
import { format, startOfDay } from 'date-fns'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { COACHING_ID } from '../lib/constants'
import { FINESTRA_STORICO } from '../lib/statisticheCoach'
import {
  reportSettimanale, settimanaReport, SETTIMANE_CRONICO, FEEDBACK_IN_REPORT,
} from '../lib/reportSettimanale'
import { IntestazioneSezione } from '../components/ArchivioUI'
import {
  TestataReport, EroeSettimana, BentoSettimana, FasciaAzioni, NessunaAzione,
  RigaReport, NotaCarico, MixCorsie, SezioneProgramma, FeedbackReport,
  SezionePausa, VuotoReport, ScheletroReport,
} from '../components/ReportUI'

const iso = (d) => format(d, 'yyyy-MM-dd')

export default function WeeklyReport() {
  const [atleti, setAtleti] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [caricato, setCaricato] = useState(false)
  const [errore, setErrore] = useState(false)
  const [caricatoIl, setCaricatoIl] = useState(() => Date.now())
  const [scarto, setScarto] = useState(0)
  const [soloAzioni, setSoloAzioni] = useState(false)
  const [feedbackEspanso, setFeedbackEspanso] = useState(false)
  const navigate = useNavigate()
  const indietro = useIndietro('/')
  const { role } = useAuth()

  useEffect(() => {
    if (role === 'athlete') navigate('/', { replace: true })
  }, [role, navigate])

  useEffect(() => {
    if (role === 'athlete') return
    let vivo = true

    const carica = async () => {
      const adesso = new Date()
      const settimana = settimanaReport(adesso, scarto)

      // Una finestra sola per tutte le domande del report: indietro fino a
      // FINESTRA_STORICO — la stessa della Home coach, così «fermo da oltre»
      // vuol dire la stessa cosa nelle due schermate — e avanti di una
      // settimana intera, che è la copertura da programmare.
      const da = iso(new Date(startOfDay(settimana.inizio).getTime() - FINESTRA_STORICO * 86400000))
      const a = iso(new Date(startOfDay(settimana.fine).getTime() + 7 * 86400000))

      const [atletiRes, assRes] = await Promise.all([
        // `notes` serve alla pausa: lo stato vive dentro la nota che il coach
        // scrive per l'atleta, perché lo schema è congelato (§9-decies).
        supabase.from('athletes').select('id, name, surname, photo_url, notes').is('deleted_at', null),
        supabase.from('athlete_workouts')
          .select('id, athlete_id, completed_date, status, notes, voice_note_url, workouts(id, title, sections)')
          .gte('completed_date', da).lte('completed_date', a)
          .order('completed_date', { ascending: false })
          .limit(1500),
      ])
      if (!vivo) return

      // ⚠️ Una lettura fallita NON si inghiotte (§9-quater): senza righe il
      // report direbbe «nessun allenamento questa settimana», che è la stessa
      // immagine di una settimana davvero vuota. Un errore travestito da dato
      // è il difetto peggiore di questa pagina.
      const guasto = atletiRes.error || assRes.error
      if (guasto) console.error('Report settimanale, lettura fallita:', guasto)
      setErrore(!!guasto)
      if (guasto) { setCaricato(true); return }

      // ⚠️ L'account del coach è una riga di `athletes` come le altre, ma non è
      // un atleta che si segue: se resta dentro compare fra chi «richiede
      // attenzione» ogni volta che il coach non si allena, e falsa aderenza,
      // carico e copertura. Stesso filtro di `Athletes` e della Home coach.
      setAtleti((atletiRes.data || []).filter(x => x?.id && x.id !== COACHING_ID))
      setAssegnazioni(assRes.data || [])
      // L'istante si fissa quando i dati arrivano, non durante il render: da
      // qui dipendono la settimana, chi è fermo e ogni finestra del report, e
      // `Date.now()` nel render darebbe due render con conteggi diversi.
      setCaricatoIl(Date.now())
      setCaricato(true)
    }

    carica()
    return () => { vivo = false }
  }, [role, scarto])

  const oggi = useMemo(() => new Date(caricatoIl), [caricatoIl])

  const report = useMemo(
    () => reportSettimanale(atleti, assegnazioni, { oggi, scarto }),
    [atleti, assegnazioni, oggi, scarto]
  )

  /**
   * Chi chiede un'azione ADESSO.
   *
   * ⚠️ «Senza programma» resta fuori di proposito: a quella condizione risponde
   * la sezione «Settimana prossima», che dice cosa fare e come farlo. Metterla
   * anche qui vorrebbe dire due allarmi per lo stesso atleta con due risposte
   * diverse, ed è il modo in cui un allarme smette di significare qualcosa.
   */
  const azioni = useMemo(
    () => [...report.gruppi.fermo, ...report.gruppi.scarica, ...report.gruppi.aderenza],
    [report]
  )

  const dettaglioAzioni = useMemo(() => [
    report.gruppi.fermo.length ? `${report.gruppi.fermo.length} da richiamare` : null,
    report.gruppi.scarica.length ? `${report.gruppi.scarica.length} da scaricare` : null,
    report.gruppi.aderenza.length ? `${report.gruppi.aderenza.length} con aderenza bassa` : null,
  ].filter(Boolean).join(' · '), [report])

  // ⚠️ Due destinazioni diverse, e non è un dettaglio. Una riga della lista
  // porta al report DI QUELL'ATLETA — è il seguito naturale della domanda «chi
  // guardo per primo». Il bottone «Assegna» porta invece alla sua scheda, che è
  // il posto in cui si assegna: mandare «Assegna» al report vorrebbe dire un
  // bottone che promette un'azione e apre una lettura.
  const apriReport = useCallback((a) => navigate(`/report/${a.id}`), [navigate])
  const apriAtleta = useCallback((a) => navigate(`/athletes/${a.id}`), [navigate])
  const apriFeedback = useCallback((f) => {
    // Il formato del deep link ai workout, lo stesso di `notifications.route`.
    if (f.workoutId) navigate(`/workout/${f.workoutId}?athlete_id=${f.atletaId}`)
    else navigate(`/athletes/${f.atletaId}`)
  }, [navigate])

  const cambiaSettimana = (delta) => {
    setScarto(s => Math.min(0, s + delta))
    setSoloAzioni(false)
    setFeedbackEspanso(false)
  }

  const { settimana, squadra, prossima, feedback } = report
  const righe = soloAzioni ? azioni : report.righe
  const vuota = squadra.assegnati === 0 && squadra.daVenire === 0 && report.righe.length > 0

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[var(--fondo-pagina)] page-transition">
      <TestataReport
        etichetta={settimana.etichetta}
        numero={settimana.numero}
        corrente={settimana.corrente}
        avanti={scarto < 0}
        onIndietro={indietro}
        onPrecedente={() => cambiaSettimana(-1)}
        onSuccessiva={() => cambiaSettimana(1)}
      />

      {!caricato ? <ScheletroReport /> : errore ? (
        <VuotoReport
          titolo="Non sono riuscito a leggere la settimana"
          dettaglio="Controlla la connessione e riprova: meglio non dirti niente che dirti una settimana vuota che vuota non è." />
      ) : report.righe.length === 0 ? (
        <VuotoReport titolo="Nessun atleta in rubrica"
          dettaglio="Il report nasce dagli allenamenti che assegni: aggiungi un atleta per cominciare. 🏃" />
      ) : (
        <>
          <EroeSettimana
            percentuale={squadra.percentuale}
            completati={squadra.completati}
            assegnati={squadra.assegnati}
            daVenire={squadra.daVenire}
            trascorsi={settimana.trascorsi}
            corrente={settimana.corrente}
            atleti={squadra.atleti}
            frase={report.frase}
          />

          {!vuota && <BentoSettimana squadra={squadra} />}

          {azioni.length > 0 ? (
            <FasciaAzioni
              attiva={soloAzioni}
              onApri={() => setSoloAzioni(v => !v)}
              testo={`${azioni.length} ${azioni.length === 1 ? 'atleta richiede' : 'atleti richiedono'} un'azione`}
              dettaglio={dettaglioAzioni}
            />
          ) : (
            <NessunaAzione atleti={squadra.atleti} />
          )}

          <IntestazioneSezione
            etichetta={soloAzioni ? 'Da fare adesso' : 'Atleta per atleta'}
            conteggio={soloAzioni ? `${righe.length}` : 'Fatti / assegnati'}
          />
          <div className="flex flex-col gap-2">
            {righe.map(r => <RigaReport key={r.id} riga={r} onApri={apriReport} />)}
          </div>
          <NotaCarico settimane={SETTIMANE_CRONICO} />

          <MixCorsie corsie={report.corsie} totale={squadra.assegnati + squadra.daVenire} />

          {prossima.utile && (
            <SezioneProgramma prossima={prossima} onApriAtleta={apriAtleta} onCrea={() => navigate('/create')} />
          )}

          {feedback.length > 0 && (
            <FeedbackReport
              elementi={feedback}
              mostrate={FEEDBACK_IN_REPORT}
              espanso={feedbackEspanso}
              onEspandi={() => setFeedbackEspanso(true)}
              onApri={apriFeedback}
            />
          )}

          {report.inPausa.length > 0 && <SezionePausa righe={report.inPausa} />}
        </>
      )}
    </div>
  )
}
