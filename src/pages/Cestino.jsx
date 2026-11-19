// Cestino.jsx — il cestino dei workout (19/11/2026, docs/memoria/cestino.md).
// Un workout eliminato resta qui 14 giorni: lo vede il coach che l'ha creato
// (gli admin quelli senza autore), e lo ripristina scegliendo a spunte cosa
// riportare. La copia la fa il database (trigger `cestino_copia`), anche
// quando elimina un'app vecchia. Nessuno svuota il cestino a mano.
// Solo staff: un atleta torna alla Home (la policy lo fermerebbe comunque).
import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../App'
import { CestinoVuoto, RigaCestino } from '../components/CestinoUI'
import { elencoCestino, vociCestino, ripristinaWorkout } from '../lib/cestinoDb'
import { mostraErrore } from '../lib/alert'
import { vibraScelta, vibraSuccesso } from '../lib/aptica'
import { VETRO } from '../lib/stiliCard'
import { useIndietro } from '../useIndietro'

const FoglioRipristino = lazy(() => import('../components/FoglioRipristino'))

export default function Cestino() {
  const { role } = useAuth() || {}
  const navigate = useNavigate()
  const indietro = useIndietro('/libreria')
  // null = in lettura
  const [righe, setRighe] = useState(null)
  const [errore, setErrore] = useState(false)
  // { riga, voci } — voci null finché cestino_voci non risponde
  const [aperta, setAperta] = useState(null)

  useEffect(() => {
    if (role === 'athlete') return undefined
    let vivo = true
    elencoCestino()
      .then(({ righe: r }) => { if (vivo) setRighe(r) })
      .catch(e => { console.warn('Cestino non letto:', e); if (vivo) { setErrore(true); setRighe([]) } })
    return () => { vivo = false }
  }, [role])

  if (role === 'athlete') return <Navigate to="/" replace />

  const apri = (riga) => {
    vibraScelta()
    setAperta({ riga, voci: null })
    vociCestino(riga.id)
      .then(voci => setAperta(a => (a?.riga.id === riga.id ? { ...a, voci } : a)))
      .catch(e => {
        console.warn('Voci del cestino non lette:', e)
        setAperta(null)
        mostraErrore(e?.message || 'Non riesco ad aprirlo. Controlla la connessione e riprova.')
      })
  }

  const ripristina = async (assegnazioni, sfide) => {
    const riga = aperta?.riga
    if (!riga) return null
    try {
      const id = await ripristinaWorkout(riga.id, { assegnazioni, sfide })
      vibraSuccesso()
      setRighe(rs => (rs || []).filter(r => r.id !== riga.id))
      return id || riga.workout_id
    } catch (e) {
      console.warn('Workout non ripristinato:', e)
      mostraErrore(e?.message || 'Non sono riuscito a ripristinarlo. Controlla la connessione e riprova.')
      return null
    }
  }

  const chiudi = (workoutId) => {
    setAperta(null)
    if (workoutId) navigate(`/workout/${workoutId}`)
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      {/* La testata è cornice: sta ferma, fuori dalla cascata. */}
      <div className="sticky top-0 z-20 -mx-4 px-4 pb-3 pt-1 bg-[#0B0B0B]/95 backdrop-blur max-w-2xl md:mx-auto">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Torna indietro" onClick={indietro}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-200 hover:text-white transition shrink-0 ${VETRO}`}>
            <ChevronLeft size={19} />
          </button>
          <h1 className="flex-1 min-w-0 text-3xl font-black tracking-tight truncate">Cestino</h1>
        </div>
      </div>

      {righe == null ? (
        <div className="max-w-2xl mx-auto flex flex-col gap-2.5 mt-2">
          {[0, 1].map(i => <div key={i} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl h-24 animate-pulse" />)}
        </div>
      ) : (
        <div className="cascata max-w-2xl mx-auto flex flex-col gap-2.5 mt-2">
          {errore && <p role="alert" className="text-sm text-red-500">Non riesco a leggere il cestino.</p>}
          {righe.length === 0
            ? <CestinoVuoto />
            : righe.map(r => <RigaCestino key={r.id} riga={r} onApri={apri} />)}
        </div>
      )}

      {aperta && (
        <Suspense fallback={null}>
          <FoglioRipristino key={aperta.riga.id} riga={aperta.riga} voci={aperta.voci}
            onRipristina={ripristina} onChiudi={chiudi} />
        </Suspense>
      )}
    </div>
  )
}
