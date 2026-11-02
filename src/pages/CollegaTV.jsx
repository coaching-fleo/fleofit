import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { format, parseISO, subDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { X, MonitorUp, ChevronRight, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import { sceltaTV } from '../lib/sceltaTV'
import { separaCodice } from '../lib/codiceWorkout'
import { categoriaDi, corsia, fuoriDallArchivioCoach } from '../lib/categorie'
import { coloreCategoria } from '../lib/colori'

// `/collega-tv/:codice` — ci arriva il link del QR della TV inquadrato con la
// fotocamera del telefono (`fleofit://tv/<codice>`, DeeplinkHandler in App.jsx).
// Spec: docs/superpowers/specs/2026-11-02-tv-qr-scelta-workout-design.md §2.
//
// Qui si sceglie SOLO il workout: il collegamento lo fa la scheda, che con
// `?tv=<codice>` si collega da sola (WorkoutDetail). Cosa proporre lo decide
// `sceltaTV` (src/lib/sceltaTV.js); questa pagina legge i dati e disegna il
// foglio. Chiudere = tornare alla Home.
//
// `?altro=1`: si arriva dal «No, un altro» della scheda (FoglioChiediTV) — si
// parte dalla lista, senza riproporre un workout.
//
// 🔴 Le scelte navigano con `replace` (ruling 8): «indietro» dalla scheda torna
// dov'era l'app prima del QR, non a questa pagina.

const CODICE_VALIDO = /^\d{4}$/
const GIORNI_RECENTI = 7

const MSG_ERRORE = 'Non riesco a leggere i workout. Controlla la connessione.'

const nomeDi = (w) => separaCodice(w?.title).nome || 'Senza titolo'
const dataBreve = (giorno) => {
  try { return format(parseISO(giorno), 'd MMM', { locale: it }) } catch { return '' }
}

// Le letture. Atleta come la Home: le SUE assegnazioni, e il giorno che conta
// è `completed_date` (quello dell'assegnazione), non la data del workout.
// Admin e coach: i workout (il coach vede solo i suoi perché lo impone la RLS).
// Mai un throw: `{ errore: true }`.
async function leggiWorkout({ isAtleta, userId, oggi }) {
  const inizio = format(subDays(parseISO(oggi), GIORNI_RECENTI), 'yyyy-MM-dd')
  try {
    const lista = isAtleta
      ? supabase.from('athlete_workouts')
          .select('id, completed_date, status, workouts (id, title, sections)')
          .eq('athlete_id', userId)
          .gte('completed_date', inizio)
          .lte('completed_date', oggi)
          .order('completed_date', { ascending: false })
          .limit(100)
      : supabase.from('workouts')
          .select('id, title, date, sections')
          .gte('date', inizio)
          .lte('date', oggi)
          .order('date', { ascending: false })
          .limit(100)
    const rLista = await lista
    if (rLista.error) return { errore: true }
    const workouts = isAtleta
      ? (rLista.data || []).filter(aw => aw.workouts).map(aw => ({ ...aw.workouts, date: aw.completed_date }))
      // Come l'archivio del coach: niente allenamenti liberi/autonomi degli atleti.
      : (rLista.data || []).filter(w => !fuoriDallArchivioCoach(w.sections))
    return { workouts }
  } catch {
    return { errore: true }
  }
}

// Una riga della lista: titolo senza codice, colore e nome della categoria,
// data breve. Il tocco = scelta.
function Riga({ w, onScegli }) {
  const categoria = categoriaDi(w.sections)
  return (
    <button onClick={() => onScegli(w)}
      className="w-full text-left px-3.5 py-3 flex items-center gap-3 rounded-2xl bg-[#222222] border border-[#2a2a2a] hover:border-[#444] transition active:scale-[.99]">
      <span className="w-[3px] self-stretch rounded-full shrink-0" style={{ background: coloreCategoria(categoria) }} aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-bold text-white truncate">{nomeDi(w)}</span>
        <span className="block mt-0.5 text-[13px] font-medium text-muted truncate">
          {corsia(categoria).etichetta} · {dataBreve(w.date)}
        </span>
      </span>
      <ChevronRight size={16} className="text-[#4f5462] shrink-0" aria-hidden="true" />
    </button>
  )
}

function Sezione({ titolo, righe, onScegli }) {
  if (righe.length === 0) return null
  return (
    <section className="mt-4">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{titolo}</h4>
      <div className="flex flex-col gap-2">
        {righe.map(w => <Riga key={w.id} w={w} onScegli={onScegli} />)}
      </div>
    </section>
  )
}

export default function CollegaTV() {
  const { codice } = useParams()
  const [searchParams] = useSearchParams()
  const { role, user } = useAuth()
  const navigate = useNavigate()
  const valido = CODICE_VALIDO.test(codice || '')
  const isAtleta = role === 'athlete'

  const [oggi] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [workouts, setWorkouts] = useState([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState(false)
  // «No, un altro»: dalla conferma alla lista (`?altro=1`: lo era già nella scheda).
  const [forzaLista, setForzaLista] = useState(() => searchParams.get('altro') === '1')

  // «Riprova» rilegge: cambia il giro, l'effetto riparte.
  const [giro, setGiro] = useState(0)
  const userId = user?.id

  useEffect(() => {
    if (!valido) return
    let vivo = true
    leggiWorkout({ isAtleta, userId, oggi }).then((esito) => {
      if (!vivo) return
      if (esito.errore) setErrore(true)
      else { setWorkouts(esito.workouts); setErrore(false) }
      setCaricamento(false)
    })
    return () => { vivo = false }
  }, [valido, isAtleta, userId, oggi, giro])

  if (!valido) return <Navigate to="/" replace />

  const chiudi = () => navigate('/', { replace: true })
  const riprova = () => { setCaricamento(true); setErrore(false); setGiro(g => g + 1) }
  const cercaNellArchivio = () => navigate(`/archive?tv=${codice}`, { replace: true })

  const scegli = (w) => {
    // All'atleta serve il suo `athlete_id`, o la scheda non carica l'assegnazione.
    const athleteId = isAtleta ? user.id : null
    navigate(`/workout/${w.id}?${athleteId ? `athlete_id=${athleteId}&` : ''}tv=${codice}`, { replace: true })
  }

  const scelta = sceltaTV({ ruolo: role, oggi, workouts, forzaLista })

  const bottoneGrande = 'w-full min-h-[56px] flex items-center justify-center gap-2.5 rounded-2xl font-bold text-[16px] transition active:scale-[.98]'

  const bottoneArchivio = !isAtleta && (
    <button onClick={cercaNellArchivio}
      className={`${bottoneGrande} mt-4 bg-[#2a2a2a] text-white hover:bg-[#333]`}>
      <Search size={18} aria-hidden="true" /> Cerca nell'archivio
    </button>
  )

  let contenuto
  if (caricamento) {
    contenuto = <p className="mt-5 text-sm text-muted text-center" aria-busy="true">Caricamento…</p>
  } else if (errore) {
    contenuto = (
      <div className="mt-5 flex flex-col gap-3">
        <p role="alert" className="text-sm font-semibold text-red-400 text-center">{MSG_ERRORE}</p>
        <button onClick={riprova} className={`${bottoneGrande} bg-brand text-black hover:brightness-110`}>Riprova</button>
        {bottoneArchivio}
      </div>
    )
  } else if (scelta.tipo === 'conferma') {
    const w = scelta.workout
    const categoria = categoriaDi(w.sections)
    contenuto = (
      <div className="mt-5">
        <p className="text-base font-bold text-white">Vuoi aprire questo?</p>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#111111] border border-[#333] px-4 py-3.5">
          <span className="w-[3px] self-stretch rounded-full shrink-0" style={{ background: coloreCategoria(categoria) }} aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-lg font-black tracking-tight text-white truncate">{nomeDi(w)}</span>
            <span className="block text-[13px] font-medium text-muted">{corsia(categoria).etichetta}{w.date ? ` · ${dataBreve(w.date)}` : ''}</span>
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <button onClick={() => scegli(w)} className={`${bottoneGrande} bg-brand text-black hover:brightness-110`}>Sì</button>
          <button onClick={() => setForzaLista(true)} className={`${bottoneGrande} bg-[#2a2a2a] text-white hover:bg-[#333]`}>No, un altro</button>
        </div>
      </div>
    )
  } else {
    const oggiRighe = scelta.tipo === 'lista' ? scelta.oggi : []
    const vuotoDelTutto = oggiRighe.length === 0 && scelta.recenti.length === 0
    contenuto = (
      <div className="mt-1">
        {scelta.tipo === 'vuoto' && isAtleta && (
          <p className="mt-4 text-base font-bold text-white">Oggi non hai workout assegnati</p>
        )}
        <Sezione titolo="Oggi" righe={oggiRighe} onScegli={scegli} />
        <Sezione titolo="Ultimi 7 giorni" righe={scelta.recenti} onScegli={scegli} />
        {vuotoDelTutto && (
          <p className="mt-4 text-sm text-muted">Nessun workout negli ultimi 7 giorni.</p>
        )}
        {bottoneArchivio}
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-[#0B0B0B]" />
      {createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/70 velo-in" onClick={chiudi} />
          <div role="dialog" aria-modal="true" aria-labelledby="collega-tv-titolo"
            className="relative bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[85dvh] overflow-y-auto sheet-in">
            <div className="w-10 h-1 rounded-full bg-[#383838] mx-auto mb-4" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 id="collega-tv-titolo" className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <MonitorUp size={22} className="text-brand shrink-0" aria-hidden="true" /> Trasmetti in TV
                </h3>
                <p className="mt-1 text-sm text-muted">TV {codice}</p>
              </div>
              <button aria-label="Chiudi" onClick={chiudi}
                className="shrink-0 w-11 h-11 -mr-1 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 hover:text-white">
                <X size={20} />
              </button>
            </div>
            {contenuto}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
