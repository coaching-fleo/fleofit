import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation, useNavigationType } from 'react-router-dom'
import { useIndietro } from '../useIndietro'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { categoriaDi } from '../lib/categorie'
import { voce } from '../lib/cascata'
import {
  metaWorkout, testoCercabile, raggruppaPerMese, conteggiPerCorsia,
} from '../lib/rigaArchivio'
import {
  TestataArchivio, CampoRicerca, FiltriCorsia, IntestazioneSezione,
  RigaWorkout, ScheletroArchivio, VuotoArchivio,
} from '../components/ArchivioUI'

// 🔴 TORNANDO INDIETRO L'ARCHIVIO RIPRENDE DOV'ERA (02/10/2026).
// `ScrollInCima` non tocca lo scorrimento sui ritorni (POP), ma non bastava: la
// pagina si rimontava con lo scheletro, che è corto, quindi il browser
// schiacciava lo scorrimento in cima — e quando la lista arrivava non c'era più
// niente da riprendere. Si tiene perciò in memoria la lista, i filtri e la
// posizione, **per voce di history** (`location.key`): così vale solo per il
// ritorno a QUESTA voce, mai per un'apertura nuova dell'archivio, che deve
// partire dall'inizio. La chiave `default` (prima pagina della sessione) non si
// memorizza: non c'è nessuna voce da cui tornarci.
// ⚠️ È memoria di modulo, non localStorage: dura quanto l'app aperta, ed è
// giusto così — dopo un riavvio non esiste nessun «indietro» verso l'archivio.
const memoria = new Map()

export default function WorkoutsArchive() {
  const { key } = useLocation()
  const tipo = useNavigationType()
  const { role, user } = useAuth()
  // Letta una volta al montaggio: una ricarica di sfondo non deve ritirarla.
  const [ripresa] = useState(() => {
    const m = tipo === 'POP' && key !== 'default' ? memoria.get(key) : null
    return m && m.uid === user?.id ? m : null
  })
  const [workouts, setWorkouts] = useState(() => ripresa?.workouts ?? [])
  const [loading, setLoading] = useState(!ripresa)
  const [searchTerm, setSearchTerm] = useState(() => ripresa?.searchTerm ?? '')
  const [corsiaAttiva, setCorsiaAttiva] = useState(() => ripresa?.corsiaAttiva ?? null)
  const navigate = useNavigate()
  const indietro = useIndietro('/')
  const isCoach = role !== 'athlete'

  // Lo stato da memorizzare sta in un ref: la scrittura avviene all'USCITA, e
  // la pulizia di un effetto vede solo i valori del montaggio. Si aggiorna in
  // un effetto e non durante il render, dove un ref non si scrive.
  const stato = useRef(null)
  useLayoutEffect(() => {
    stato.current = { uid: user?.id, workouts, searchTerm, corsiaAttiva, caricato: !loading }
  })

  // ⚠️ Dipendenze vuote di proposito: `key` e `ripresa` sono quelli del
  // montaggio, ed è a quella voce di history che la posizione appartiene.
  // ⚠️ `useLayoutEffect` e non `useEffect`, in tutti e due i versi. All'uscita:
  // la sua pulizia gira prima che `ScrollInCima` porti in cima la pagina nuova,
  // quindi legge ancora la posizione vera. All'entrata: la posizione si rimette
  // prima del primo fotogramma, senza un lampo in cima.
  useLayoutEffect(() => {
    if (ripresa) window.scrollTo(0, ripresa.scrollY)
    return () => {
      if (key === 'default' || !stato.current.caricato) return
      memoria.set(key, { ...stato.current, scrollY: window.scrollY })
    }
  }, [])

  // Caricamento una volta sola, di proposito: `role` e `user` non cambiano
  // senza un rimontaggio della pagina. Aggiungere fetchWorkouts alle dipendenze
  // (e quindi un useCallback) non correggerebbe niente qui, e sposterebbe solo
  // segnalazione su setLoading(true) dentro il fetch. Vedi BACKLOG #17.
  useEffect(() => {
    fetchWorkouts()
  }, [])

  const fetchWorkouts = async () => {
    // Con la lista ripresa in pagina la ricarica è silenziosa: rimettere lo
    // scheletro accorcerebbe la pagina e butterebbe via la posizione appena
    // ripristinata.
    if (!ripresa) setLoading(true)
    if (role === 'athlete') {
      const { data, error } = await supabase
        .from('athlete_workouts')
        .select('id, completed_date, status, created_at, workouts (id, title, date, sections)')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: false })
      if (!error && data) {
         const mapped = data.filter(aw => {
           if (!aw.workouts) return false
           const s = aw.workouts.sections || {}
           const cat = s.category
           if (cat === 'Event' || s.isEvent || s.isAutonomous) return false
           return true
         }).map(aw => ({
           ...aw.workouts,
           aw_id: aw.id,
           // ⚠️ `created_at` è quello dell'ASSEGNAZIONE, non del workout: è
           // l'unico che l'atleta veda, ed è lo spareggio giusto per lui.
           created_at: aw.created_at,
           status: aw.status,
           date: aw.completed_date
         }))
         setWorkouts(mapped)
      }
    } else {
      const { data, error } = await supabase
        .from('workouts')
        .select('id, title, date, created_at, sections, athlete_workouts(id)')
        .order('created_at', { ascending: false })
      if (!error) {
        const filtered = (data || []).filter(w => {
           const s = w.sections || {}
           const cat = s.category
           if (cat === 'Event' || s.isEvent || cat === 'Custom' || cat === 'Autonomo' || s.isAutonomous) return false
           return true
        })
        setWorkouts(filtered)
      }
    }
    setLoading(false)
  }

  // Il testo cercabile si costruisce UNA volta per lista, non a ogni tasto
  // premuto: scandaglia i blocchi e gli esercizi di ogni workout, e in
  // produzione i workout sono 171.
  const indice = useMemo(
    () => workouts.map(w => ({ w, testo: testoCercabile(w), categoria: categoriaDi(w.sections) })),
    [workouts]
  )

  const corsie = useMemo(() => conteggiPerCorsia(workouts), [workouts])

  const filtrati = useMemo(() => {
    const termine = searchTerm.trim().toLowerCase()
    return indice
      .filter(v => (corsiaAttiva === null || v.categoria === corsiaAttiva)
                && (!termine || v.testo.includes(termine)))
      .map(v => v.w)
  }, [indice, searchTerm, corsiaAttiva])

  const gruppi = useMemo(() => raggruppaPerMese(filtrati), [filtrati])

  const conFiltri = searchTerm.trim() !== '' || corsiaAttiva !== null
  const azzera = () => { setSearchTerm(''); setCorsiaAttiva(null) }

  // Il dettaglio della testata dice la scala: quanti sono e su quante corsie.
  // Sotto filtro dice quanti se ne stanno vedendo, che è l'unica domanda che
  // resta aperta quando la lista si è accorciata sotto le dita.
  const dettaglio = loading
    ? null
    : conFiltri
      ? `${filtrati.length} di ${workouts.length} workout`
      : `${workouts.length} workout · ${corsie.length} ${corsie.length === 1 ? 'corsia' : 'corsie'}`

  // ⚠️ L'indice della cascata scorre ATTRAVERSO i gruppi. `nth-child` qui non
  // basta: le righe stanno dentro i mesi, quindi ripartirebbe da capo a ogni
  // intestazione e agosto entrerebbe insieme a settembre (src/lib/cascata.js).
  let n = 0

  return (
    /* ⚠️ Niente `page-transition`: la pagina non sale più tutta insieme, entrano
       gli elementi. ⚠️ E `TestataArchivio` NON entra, di proposito: è
       `sticky`, cioè la cornice della pagina e non il suo contenuto — nel
       riferimento il contenitore è fermo e si muovono le righe. È la regola per
       tutte le pagine con una testata appiccicata; la testata della Home invece
       scorre via con la pagina, quindi lì è contenuto e la sua voce ce l'ha. */
    <div className="px-4 max-w-2xl mx-auto pb-[var(--fondo-pagina)]">
      <TestataArchivio onIndietro={indietro} dettaglio={dettaglio}>
        <CampoRicerca valore={searchTerm} onCambia={setSearchTerm} />
        {corsie.length > 1 && (
          <FiltriCorsia corsie={corsie} attiva={corsiaAttiva} totale={workouts.length}
            onCambia={setCorsiaAttiva} />
        )}
      </TestataArchivio>

      {loading ? (
        <ScheletroArchivio />
      ) : gruppi.length === 0 ? (
        <VuotoArchivio conFiltri={conFiltri} onAzzera={azzera} />
      ) : (
        gruppi.map(gruppo => (
          <div key={gruppo.chiave}>
            <IntestazioneSezione etichetta={gruppo.etichetta} conteggio={gruppo.workouts.length}
              voce={ripresa ? undefined : voce(n++)} />
            <div className="flex flex-col gap-2">
              {gruppo.workouts.map(w => (
                <RigaWorkout
                  key={w.aw_id || w.id}
                  categoria={categoriaDi(w.sections)}
                  titolo={w.title || 'Senza titolo'}
                  meta={metaWorkout(w)}
                  assegnati={isCoach ? (w.athlete_workouts?.length ?? 0) : undefined}
                  completato={!isCoach && w.status === 'completed'}
                  onApri={() => navigate(`/workout/${w.id}`)}
                  // Tornando indietro le righe ci sono già: rifarle entrare
                  // sarebbe una pagina nuova, ed è proprio ciò che non è.
                  voce={ripresa ? undefined : voce(n++)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
