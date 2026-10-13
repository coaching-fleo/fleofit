import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRipresa, useRicorda } from '../useRipresa'
import { useIndietro } from '../useIndietro'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { categoriaDi } from '../lib/categorie'
import { voce } from '../lib/cascata'
import {
  metaWorkout, testoCercabile, raggruppaPerMese, conteggiPerCorsia,
  tipiBlocco, conteggiPerTipo, passaFiltroTipi,
  eserciziFiltrabili, conteggiPerEsercizio, passaFiltroEsercizi, prossimoStatoEsercizio,
} from '../lib/rigaArchivio'
import {
  TestataArchivio, CampoRicerca, FiltriCorsia, IntestazioneSezione,
  RigaWorkout, ScheletroArchivio, VuotoArchivio, FiltriTipo, FiltriEsercizio,
} from '../components/ArchivioUI'
import { useSchermoLargo, eDesktop } from '../useDesktop'

// L'archivio a griglia sul desktop (src/useDesktop.js): pigro, il telefono non
// lo scarica mai.
const ArchivioDesktop = lazy(() => import('../components/ArchivioDesktop'))

// Tornando da un workout l'archivio riprende dov'era: src/useRipresa.js.

export default function WorkoutsArchive() {
  const { role, user } = useAuth()
  const ripresa = useRipresa('archivio', user?.id)
  const [workouts, setWorkouts] = useState(() => ripresa?.workouts ?? [])
  const [loading, setLoading] = useState(!ripresa)
  const [searchTerm, setSearchTerm] = useState(() => ripresa?.searchTerm ?? '')
  const [corsiaAttiva, setCorsiaAttiva] = useState(() => ripresa?.corsiaAttiva ?? null)
  // I tipi di blocco scelti fra i chip (src/lib/rigaArchivio.js).
  const [tipiScelti, setTipiScelti] = useState(() => ripresa?.tipiScelti ?? [])
  // Gli esercizi a tre stati: { SkiErg: 'con' | 'senza' } (src/lib/rigaArchivio.js).
  const [eserciziScelti, setEserciziScelti] = useState(() => ripresa?.eserciziScelti ?? {})
  const navigate = useNavigate()
  const indietro = useIndietro('/')
  const isCoach = role !== 'athlete'
  const desktop = eDesktop(useSchermoLargo(), role)

  useRicorda('archivio', user?.id, ripresa, { workouts, searchTerm, corsiaAttiva, tipiScelti, eserciziScelti, caricato: !loading })

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
    () => workouts.map(w => ({
      w, testo: testoCercabile(w), categoria: categoriaDi(w.sections), tipi: tipiBlocco(w),
      esercizi: eserciziFiltrabili(w),
    })),
    [workouts]
  )

  const corsie = useMemo(() => conteggiPerCorsia(workouts), [workouts])
  const tipi = useMemo(() => conteggiPerTipo(workouts), [workouts])
  const esercizi = useMemo(() => conteggiPerEsercizio(workouts), [workouts])

  const filtrati = useMemo(() => {
    const termine = searchTerm.trim().toLowerCase()
    return indice
      .filter(v => (corsiaAttiva === null || v.categoria === corsiaAttiva)
                && (!termine || v.testo.includes(termine))
                && passaFiltroTipi(v.tipi, tipiScelti)
                // «A blocchi» = ha almeno un blocco: le corse non hanno esercizi.
                && passaFiltroEsercizi(v.esercizi, eserciziScelti, v.tipi.size > 0))
      .map(v => v.w)
  }, [indice, searchTerm, corsiaAttiva, tipiScelti, eserciziScelti])

  const gruppi = useMemo(() => raggruppaPerMese(filtrati), [filtrati])

  const conEsercizi = Object.keys(eserciziScelti).length > 0
  const conFiltri = searchTerm.trim() !== '' || corsiaAttiva !== null || tipiScelti.length > 0 || conEsercizi
  const azzera = () => { setSearchTerm(''); setCorsiaAttiva(null); setTipiScelti([]); setEserciziScelti({}) }
  const cambiaEsercizio = (id) => setEserciziScelti(prima => {
    const { [id]: stato, ...altri } = prima
    const prossimo = prossimoStatoEsercizio(stato)
    return prossimo ? { ...altri, [id]: prossimo } : altri
  })
  const cambiaTipo = (t) =>
    setTipiScelti(prima => (prima.includes(t) ? prima.filter(x => x !== t) : [...prima, t]))

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
  if (desktop) {
    return (
      <Suspense fallback={<div className="min-h-screen" />}>
        <ArchivioDesktop
          dettaglio={dettaglio}
          onIndietro={null}
          loading={loading}
          gruppi={gruppi}
          vuoto={<VuotoArchivio conFiltri={conFiltri} onAzzera={azzera} />}
          filtri={<>
            <CampoRicerca valore={searchTerm} onCambia={setSearchTerm} />
            {corsie.length > 1 && (
              <FiltriCorsia corsie={corsie} attiva={corsiaAttiva} totale={workouts.length}
                onCambia={setCorsiaAttiva} tuttiAttivo={corsiaAttiva === null && tipiScelti.length === 0 && !conEsercizi}
                onTutti={() => { setCorsiaAttiva(null); setTipiScelti([]); setEserciziScelti({}) }} />
            )}
            {tipi.length > 0 && <FiltriTipo tipi={tipi} scelti={tipiScelti} onCambia={cambiaTipo} />}
            {esercizi.length > 0 && (
              <FiltriEsercizio esercizi={esercizi} scelte={eserciziScelti} onCambia={cambiaEsercizio} />
            )}
            {conFiltri && (
              <button type="button" onClick={azzera} className="self-start mt-2 text-sm font-bold text-brand hover:brightness-110">
                Azzera i filtri
              </button>
            )}
          </>}
          schede={(w) => ({
            categoria: categoriaDi(w.sections),
            titolo: w.title || 'Senza titolo',
            meta: metaWorkout(w),
            assegnati: isCoach ? (w.athlete_workouts?.length ?? 0) : undefined,
            completato: !isCoach && w.status === 'completed',
            onApri: () => navigate(isCoach ? `/workout/${w.id}` : `/workout/${w.id}?athlete_id=${user.id}`),
          })}
        />
      </Suspense>
    )
  }

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
            onCambia={setCorsiaAttiva} tuttiAttivo={corsiaAttiva === null && tipiScelti.length === 0 && !conEsercizi}
            onTutti={() => { setCorsiaAttiva(null); setTipiScelti([]); setEserciziScelti({}) }} />
        )}
        {tipi.length > 0 && <FiltriTipo tipi={tipi} scelti={tipiScelti} onCambia={cambiaTipo} />}
        {esercizi.length > 0 && (
          <FiltriEsercizio esercizi={esercizi} scelte={eserciziScelti} onCambia={cambiaEsercizio} />
        )}
      </TestataArchivio>

      {/* 🔴 Tornando dalla scheda le righe non rifanno la cascata (ci sono già),
          ma senza niente al suo posto il ritorno era un taglio secco. La lista
          rientra perciò da SINISTRA, cioè il verso opposto di `passo-entra`:
          è il gesto «indietro» di iOS, e dice che si torna, non che si apre.
          ⚠️ Sta sul contenitore della lista e non sulla testata, che è
          `sticky` e quindi cornice: resta ferma, come all'andata. */}
      <div className={ripresa ? 'ritorno-entra' : undefined}>
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
                  // ⚠️ Come nel calendario: all'atleta serve `athlete_id`, o la scheda
                  // non carica la sua assegnazione (13/10/2026).
                  onApri={() => navigate(isCoach ? `/workout/${w.id}` : `/workout/${w.id}?athlete_id=${user.id}`)}
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
    </div>
  )
}
