import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { categoriaDi } from '../lib/categorie'
import {
  metaWorkout, testoCercabile, raggruppaPerMese, conteggiPerCorsia,
} from '../lib/rigaArchivio'
import {
  TestataArchivio, CampoRicerca, FiltriCorsia, IntestazioneSezione,
  RigaWorkout, ScheletroArchivio, VuotoArchivio,
} from '../components/ArchivioUI'

export default function WorkoutsArchive() {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [corsiaAttiva, setCorsiaAttiva] = useState(null)
  const navigate = useNavigate()
  const { role, user } = useAuth()
  const isCoach = role !== 'athlete'

  // Caricamento una volta sola, di proposito: `role` e `user` non cambiano
  // senza un rimontaggio della pagina. Aggiungere fetchWorkouts alle dipendenze
  // (e quindi un useCallback) non correggerebbe niente qui, e sposterebbe solo
  // segnalazione su setLoading(true) dentro il fetch. Vedi BACKLOG #17.
  useEffect(() => {
    fetchWorkouts()
  }, [])

  const fetchWorkouts = async () => {
    setLoading(true)
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

  return (
    <div className="px-4 max-w-2xl mx-auto pb-[var(--fondo-pagina)] page-transition">
      <TestataArchivio onIndietro={() => navigate(-1)} dettaglio={dettaglio}>
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
            <IntestazioneSezione etichetta={gruppo.etichetta} conteggio={gruppo.workouts.length} />
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
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
