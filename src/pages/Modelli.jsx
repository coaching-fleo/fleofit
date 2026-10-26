// Modelli.jsx — «Modelli di blocco» (16/10/2026): i blocchi Hyrox, le fasi
// Corsa e i gruppi Gym che il coach ha salvato per riusarli.
// Tre schede per categoria; la scheda aperta sta in `?categoria=` (con
// `replace`), così tornando dal builder si ritrova la stessa. Toccare una card
// o «Modifica» apre il builder in modalità modello (`/create?modello=<id>`),
// «Nuovo» lo apre vuoto. Rinomina ed Elimina sono ottimistici con rollback.
// Solo staff: un atleta torna alla Home (le policy lo fermerebbero comunque).
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ChevronLeft, MoreHorizontal, LayoutTemplate } from 'lucide-react'
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../App'
import { CardModello, MenuModello } from '../components/ModelliUI'
import { FoglioRinomina } from '../components/FoglioModello'
import { CustomConfirm } from '../components/CustomModals'
import { CATEGORIE_MODELLI } from '../lib/modelliBlocco'
import { elencoModelli, aggiornaModello, eliminaModello } from '../lib/modelliBloccoDb'
import { mostraErrore } from '../lib/alert'
import { vibraScelta, vibraSuccesso } from '../lib/aptica'
import { VETRO } from '../lib/stiliCard'
import { useIndietro } from '../useIndietro'

/** Etichetta e colore di ogni scheda: le classi per intero, Tailwind le cerca nel testo. */
const SCHEDE = {
  Hyrox: { etichetta: 'Hyrox', testo: 'text-brand' },
  Running: { etichetta: 'Corsa', testo: 'text-running' },
  Gym: { etichetta: 'Gym', testo: 'text-gym' },
}
const SPOSTA = ['translate-x-0', 'translate-x-full', 'translate-x-[200%]']

export default function Modelli() {
  const { role } = useAuth() || {}
  const navigate = useNavigate()
  const indietro = useIndietro('/create')
  const [params, setParams] = useSearchParams()
  const richiesta = params.get('categoria')
  const categoria = CATEGORIE_MODELLI.includes(richiesta) ? richiesta : 'Hyrox'

  // La lista è legata alla categoria per cui è stata letta: cambiando scheda
  // non si vede, nemmeno per un attimo, la lista di quella di prima.
  const [lista, setLista] = useState({ categoria: null, modelli: [], errore: false })
  const [menu, setMenu] = useState(null)
  const [rinomina, setRinomina] = useState(null)
  const [conferma, setConferma] = useState(null)

  useEffect(() => {
    if (role === 'athlete') return undefined
    let vivo = true
    elencoModelli(categoria)
      .then(modelli => { if (vivo) setLista({ categoria, modelli, errore: false }) })
      .catch(e => { console.warn('Modelli non caricati:', e); if (vivo) setLista({ categoria, modelli: [], errore: true }) })
    return () => { vivo = false }
  }, [categoria, role])

  if (role === 'athlete') return <Navigate to="/" replace />

  const caricata = lista.categoria === categoria
  const modelli = caricata ? lista.modelli : []
  const nomeScheda = SCHEDE[categoria].etichetta

  const scegliScheda = (c) => {
    if (c === categoria) return
    vibraScelta()
    setParams({ categoria: c }, { replace: true })
  }
  const nuovo = () => navigate(`/create?modello=nuovo&categoria=${categoria}`)
  const apri = (m) => navigate(`/create?modello=${m.id}`)

  /** Sostituisce un modello nella lista, o lo rimette dov'era (rollback). */
  const conModelli = (fn) => setLista(l => ({ ...l, modelli: fn(l.modelli) }))

  const salvaNome = async (m, nome) => {
    conModelli(ms => ms.map(x => (x.id === m.id ? { ...x, nome } : x)))
    try {
      await aggiornaModello(m.id, { nome })
      vibraSuccesso()
      return true
    } catch (e) {
      console.warn('Modello non rinominato:', e)
      conModelli(ms => ms.map(x => (x.id === m.id ? m : x)))
      mostraErrore('Non sono riuscito a rinominarlo. Controlla la connessione e riprova.')
      return false
    }
  }

  const elimina = async (m) => {
    // Il rollback rimette SOLO questa card, al suo posto: rimettere la lista di
    // prima farebbe ricomparire anche una card eliminata nel frattempo.
    const posto = modelli.findIndex(x => x.id === m.id)
    conModelli(ms => ms.filter(x => x.id !== m.id))
    try {
      await eliminaModello(m.id)
    } catch (e) {
      console.warn('Modello non eliminato:', e)
      conModelli(ms => (ms.some(x => x.id === m.id) ? ms
        : [...ms.slice(0, Math.max(posto, 0)), m, ...ms.slice(Math.max(posto, 0))]))
      mostraErrore('Non sono riuscito a eliminarlo. Controlla la connessione e riprova.')
    }
  }

  const dopoMenu = (scelta) => {
    const m = menu
    setMenu(null)
    if (!m) return
    if (scelta === 'modifica') apri(m)
    if (scelta === 'rinomina') setRinomina(m)
    if (scelta === 'elimina') setConferma({
      title: 'Eliminare il modello?',
      message: 'Il modello sparisce. I workout in cui l\'hai già usato non cambiano.',
      confirmLabel: 'Elimina',
      onConfirm: () => elimina(m),
    })
  }

  const indice = CATEGORIE_MODELLI.indexOf(categoria)

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[var(--fondo-pagina)]">
      {/* La testata è cornice: sta ferma, fuori dalla cascata. */}
      <div className="sticky top-0 z-20 -mx-4 px-4 pb-3 pt-1 bg-[#0B0B0B]/95 backdrop-blur max-w-2xl md:mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button type="button" aria-label="Torna indietro" onClick={indietro}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-200 hover:text-white transition shrink-0 ${VETRO}`}>
            <ChevronLeft size={19} />
          </button>
          <h1 className="flex-1 min-w-0 text-3xl font-black tracking-tight truncate">Modelli</h1>
          <button type="button" onClick={nuovo} aria-label="Nuovo"
            className="shrink-0 min-h-[40px] inline-flex items-center gap-1 rounded-full bg-brand text-black px-4 text-[14px] font-extrabold hover:brightness-110 transition">
            <Plus size={17} aria-hidden="true" />Nuovo
          </button>
        </div>

        <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333]" role="tablist" aria-label="Categoria">
          <div aria-hidden="true"
            className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc((100%-0.75rem)/3)] bg-[#2a2a2a] rounded-xl shadow-md transition-transform duration-300 ease-out ${SPOSTA[indice]}`} />
          {CATEGORIE_MODELLI.map(c => (
            <button key={c} type="button" role="tab" aria-selected={c === categoria} onClick={() => scegliScheda(c)}
              className={`relative z-10 flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-colors duration-300 ${
                c === categoria ? SCHEDE[c].testo : 'text-muted hover:text-gray-300'}`}>
              {SCHEDE[c].etichetta}
            </button>
          ))}
        </div>
      </div>

      {caricata && (
        <div key={categoria} className="cascata max-w-2xl mx-auto flex flex-col gap-2.5 mt-2">
          {lista.errore ? (
            <p role="alert" className="text-sm text-red-500">Non riesco a caricare i modelli.</p>
          ) : modelli.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#333] px-6 py-10 flex flex-col items-center gap-4 text-center">
              <span className="w-14 h-14 rounded-full bg-[#1e1e1e] flex items-center justify-center text-gray-500">
                <LayoutTemplate size={24} aria-hidden="true" />
              </span>
              <p className="text-[14px] text-gray-400 leading-relaxed max-w-xs">
                Nessun modello {nomeScheda}. Salvane uno da un blocco di un workout, o creane uno qui.
              </p>
              <button type="button" onClick={nuovo}
                className="min-h-11 px-5 rounded-xl bg-brand text-black text-[14px] font-extrabold hover:brightness-110 transition inline-flex items-center gap-1.5">
                <Plus size={17} aria-hidden="true" />Nuovo modello
              </button>
            </div>
          ) : modelli.map(m => (
            <CardModello key={m.id} modello={m} conData onClick={() => apri(m)}
              menu={(
                <button type="button" aria-label={`Azioni per ${m.nome}`} onClick={() => { vibraScelta(); setMenu(m) }}
                  className="shrink-0 w-11 h-11 mr-1.5 rounded-full flex items-center justify-center text-muted hover:text-white">
                  <MoreHorizontal size={19} aria-hidden="true" />
                </button>
              )} />
          ))}
        </div>
      )}

      {menu && <MenuModello modello={menu} onChiudi={dopoMenu} />}
      {rinomina && (
        <FoglioRinomina modello={rinomina} onChiudi={() => setRinomina(null)} onSalva={(nome) => salvaNome(rinomina, nome)} />
      )}
      {createPortal(<CustomConfirm info={conferma} onClose={() => setConferma(null)} />, document.body)}
    </div>
  )
}
