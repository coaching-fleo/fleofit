// CalendarioTeam.jsx — il calendario del coach sulla versione desktop.
//
// Bozza «2 · Calendario» approvata il 13/10/2026: una settimana, un atleta per
// riga, e la libreria dei workout a destra da TRASCINARE su un atleta e un
// giorno. È la cosa che il desktop fa e il telefono no.
//
// Si monta solo da Calendar.jsx quando `eDesktop` è vero, e si carica pigra.
// La logica della griglia sta in src/lib/calendarioTeam.js (coperta da test);
// qui ci sono le letture, le due scritture e il disegno.
//
// ⚠️ Le scritture sono le stesse del telefono, sullo stesso database condiviso
// con la web app in produzione (CLAUDE.md §1.1):
// - assegnare = una riga in `athlete_workouts` (status 'pending') e la push
//   `send-reminders` in modalità `immediate`, come AthleteDetail e WorkoutDetail;
// - spostare = cambiare `completed_date` di una sessione non ancora fatta.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { addWeeks, format, isToday } from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Flag, GripVertical, Search, Check, CalendarDays, User, Copy, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../App'
import NuovoEvento from '../components/NuovoEvento'
import { categoriaDi, corsia } from '../lib/categorie'
import { separaCodice } from '../lib/codiceWorkout'
import { giorniSettimana, chiave, grigliaTeam, caricoGiorni, spostamentoValido, copiaSettimana, liberoDellAtleta } from '../lib/calendarioTeam'

const FILTRI = [
  { valore: null, etichetta: 'Tutti' },
  { valore: 'Hyrox', etichetta: 'Hyrox' },
  { valore: 'Running', etichetta: 'Corsa' },
  { valore: 'Custom', etichetta: 'Libero' },
  { valore: 'Event', etichetta: 'Gare' },
]

/** Il fondo di una chip: il colore della corsia, attenuato. Le gare restano bianche piene. */
const FONDO = {
  Hyrox: 'bg-brand/10 border-brand/30',
  Running: 'bg-running/[.13] border-running/40',
  Custom: 'bg-custom/[.13] border-custom/40',
  Event: 'bg-white border-white',
}

const TIPO_DATI = 'application/x-fleofit'

function Volto({ foto, nome }) {
  const iniziali = (nome || '').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="w-8 h-8 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden flex items-center justify-center text-gray-300 text-xs font-extrabold">
      {foto
        ? <img src={foto} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0 }} />
        : (iniziali || <User size={14} aria-hidden="true" />)}
    </span>
  )
}

/**
 * «Copia settimana» (piano desktop fase 2, #5). La finestra È la conferma:
 * dice quante sedute, a chi e in quali giorni, prima di scrivere qualcosa.
 */
function FoglioCopia({ atleta, quante, altri, etichettaSettimana, etichettaDopo, onCopia, onClose }) {
  const [destinazione, setDestinazione] = useState('dopo')
  const nomeDestinazione = destinazione === 'dopo' ? atleta.nome : altri.find(a => a.id === destinazione)?.nome
  return (
    <div className="fixed inset-0 z-[150] bg-black/85 flex items-center justify-center p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Copia la settimana di ${atleta.nome}`}
        onClick={(e) => e.stopPropagation()}
        className="modal-transition w-full max-w-md bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Copia la settimana di {atleta.nome}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {quante} {quante === 1 ? 'allenamento' : 'allenamenti'} del {etichettaSettimana}, tutte le categorie. Le copie partono da fare.
            </p>
          </div>
          <button type="button" aria-label="Chiudi" onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 hover:text-white shrink-0">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-gray-500">Dove</span>
          <select value={destinazione} onChange={(e) => setDestinazione(e.target.value)}
            className="h-11 px-3 rounded-xl bg-[#111] border border-[#333] text-sm text-white">
            <option value="dopo">A {atleta.nome}, nella settimana dopo ({etichettaDopo})</option>
            {altri.map(a => <option key={a.id} value={a.id}>A {a.nome}, negli stessi giorni</option>)}
          </select>
        </label>
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-[#2a2a2a] text-sm font-bold text-gray-300 hover:text-white">Annulla</button>
          <button type="button" disabled={quante === 0} onClick={() => onCopia(destinazione)}
            className="flex-1 h-11 rounded-xl bg-brand text-black text-sm font-bold hover:brightness-110 disabled:opacity-40">
            Copia a {nomeDestinazione}
          </button>
        </div>
      </div>
    </div>
  )
}

function Chip({ chip, onApri, onTrascina }) {
  const gara = chip.categoria === 'Event'
  return (
    <button type="button" onClick={onApri}
      draggable={!chip.completato}
      onDragStart={(e) => onTrascina(e, chip)}
      title={chip.completato ? 'Completato' : 'Trascina per cambiare giorno'}
      className={`w-full text-left px-2.5 py-2 rounded-xl border flex flex-col gap-0.5 transition hover:brightness-125
                  ${FONDO[chip.categoria] || FONDO.Hyrox} ${chip.completato ? '' : 'cursor-grab active:cursor-grabbing'}`}>
      <span className="flex items-center gap-1.5 min-w-0">
        <span aria-hidden="true" className={`w-[7px] h-[7px] rounded-full shrink-0 ${gara ? 'bg-black' : corsia(chip.categoria).dot}`} />
        <span className={`text-xs font-bold truncate ${gara ? 'text-black' : 'text-white'}`}>{chip.titolo}</span>
      </span>
      <span className={`pl-[13px] text-[11px] flex items-center gap-1 ${gara ? 'text-gray-700' : 'text-gray-400'}`}>
        {chip.completato && <Check size={12} strokeWidth={3} className="text-green-500" aria-label="completato" />}
        <span className="truncate">{gara ? 'gara' : chip.codice || corsia(chip.categoria).etichetta}{chip.rpe != null ? ` · RPE ${chip.rpe}` : ''}</span>
      </span>
    </button>
  )
}

export default function CalendarioTeam({ onVistaMese }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [riferimento, setRiferimento] = useState(() => new Date())
  const [atleti, setAtleti] = useState([])
  const [assegnazioni, setAssegnazioni] = useState([])
  const [libreria, setLibreria] = useState([])
  const [cerca, setCerca] = useState('')
  const [filtro, setFiltro] = useState(null)
  const [caricamento, setCaricamento] = useState(true)
  const [sopra, setSopra] = useState(null)        // `${atletaId}|${data}` della cella sotto il puntatore
  const [avviso, setAvviso] = useState(null)      // { testo, errore }
  const [eventoAperto, setEventoAperto] = useState(false)

  const giorni = useMemo(() => giorniSettimana(riferimento), [riferimento])
  const da = chiave(giorni[0])
  const a = chiave(giorni[6])

  // `giro` cambia per ricaricare dopo una scrittura; la lettura sta tutta
  // nell'effetto, e `vivo` scarta la risposta di una settimana già lasciata.
  const [giro, setGiro] = useState(0)
  const carica = () => setGiro(g => g + 1)

  useEffect(() => {
    let vivo = true
    Promise.all([
      supabase.from('athletes').select('id, name, surname, photo_url, notes').is('deleted_at', null),
      supabase.from('athlete_workouts')
        .select('id, athlete_id, workout_id, completed_date, status, notes, workouts(id, title, sections, coach_notes)')
        .gte('completed_date', da).lte('completed_date', a),
    ]).then(([aRes, sRes]) => {
      if (!vivo) return
      if (aRes.error || sRes.error) setAvviso({ testo: 'Non riesco a caricare la settimana.', errore: true })
      setAtleti(aRes.data || [])
      setAssegnazioni(sRes.data || [])
      setCaricamento(false)
    })
    return () => { vivo = false }
  }, [da, a, giro])

  useEffect(() => {
    supabase.from('workouts').select('id, title, date, sections')
      .order('date', { ascending: false }).limit(80)
      .then(({ data }) => setLibreria((data || []).filter(w => categoriaDi(w.sections) !== 'Event')))
  }, [])

  useEffect(() => {
    if (!avviso) return
    const t = setTimeout(() => setAvviso(null), 3500)
    return () => clearTimeout(t)
  }, [avviso])

  const righe = useMemo(() => grigliaTeam(atleti, assegnazioni, giorni, { filtro }), [atleti, assegnazioni, giorni, filtro])
  const carico = useMemo(() => caricoGiorni(righe), [righe])

  const libreriaFiltrata = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    const visti = new Set()
    return libreria.filter(w => {
      const { nome } = separaCodice(w.title || '')
      if (q && !(w.title || '').toLowerCase().includes(q)) return false
      // Lo stesso workout duplicato in più date compare una volta sola.
      const k = `${nome}|${categoriaDi(w.sections)}`
      if (visti.has(k)) return false
      visti.add(k)
      return true
    }).slice(0, 30)
  }, [libreria, cerca])

  const nomeDi = (id) => righe.find(r => r.id === id)?.nome || 'l\'atleta'
  const giornoLeggibile = (data) => format(new Date(`${data}T12:00:00`), 'EEE d MMMM', { locale: it })

  const assegna = async (workout, atletaId, data) => {
    const { data: nuove, error } = await supabase.from('athlete_workouts')
      .insert({ athlete_id: atletaId, workout_id: workout.id, completed_date: data, status: 'pending' })
      .select('id')
    if (error) { setAvviso({ testo: `Assegnazione non riuscita: ${error.message}`, errore: true }); return }
    ;(nuove || []).forEach(n => {
      supabase.functions.invoke('send-reminders', { body: { mode: 'immediate', record_id: n.id } }).catch(console.error)
    })
    setAvviso({ testo: `«${separaCodice(workout.title).nome}» assegnato a ${nomeDi(atletaId)}, ${giornoLeggibile(data)}` })
    carica()
  }

  const sposta = async (chip, data) => {
    const prima = assegnazioni
    // Aggiornamento ottimistico, con ritorno indietro se il database dice no (CLAUDE.md §8).
    setAssegnazioni(lista => lista.map(x => (x.id === chip.id ? { ...x, completed_date: data } : x)))
    const { error } = await supabase.from('athlete_workouts').update({ completed_date: data }).eq('id', chip.id)
    if (error) {
      setAssegnazioni(prima)
      setAvviso({ testo: `Spostamento non riuscito: ${error.message}`, errore: true })
    } else {
      setAvviso({ testo: `Spostato a ${giornoLeggibile(data)}` })
    }
  }

  const [copiaDi, setCopiaDi] = useState(null) // la riga dell'atleta da copiare
  // 🔴 Una copia alla volta. La finestra si chiude subito e la scrittura arriva
  // dopo: un coach che riapre e riclicca nel frattempo leggerebbe la settimana
  // d'arrivo ancora vuota e la riempirebbe due volte, push comprese.
  const copiaInCorso = useRef(false)
  const [copiando, setCopiando] = useState(false)

  // Gli allenamenti liberi dell'atleta non si copiano (`liberoDellAtleta`): il
  // conteggio della finestra non li promette.
  const sedute = (atletaId) => assegnazioni.filter(x => x.athlete_id === atletaId
    && x.completed_date >= da && x.completed_date <= a && !liberoDellAtleta(x))

  const copia = async (atleta, destinazione) => {
    setCopiaDi(null)
    if (copiaInCorso.current) return
    copiaInCorso.current = true
    setCopiando(true)
    try {
      await eseguiCopia(atleta, destinazione)
    } finally {
      copiaInCorso.current = false
      setCopiando(false)
    }
  }

  const eseguiCopia = async (atleta, destinazione) => {
    setAvviso({ testo: 'Copio la settimana…' })
    const dopo = destinazione === 'dopo'
    const aAtleta = dopo ? atleta.id : destinazione
    let elenco = assegnazioni
    if (dopo) {
      // La settimana dopo non è caricata: senza le sue righe i doppioni non si
      // vedrebbero, e un secondo clic raddoppierebbe la settimana.
      const giorniDopo = giorni.map(g => chiave(addWeeks(g, 1)))
      const { data: arrivo, error } = await supabase.from('athlete_workouts')
        .select('id, athlete_id, workout_id, completed_date')
        .eq('athlete_id', aAtleta).gte('completed_date', giorniDopo[0]).lte('completed_date', giorniDopo[6])
      if (error) { setAvviso({ testo: `Copia non riuscita: ${error.message}`, errore: true }); return }
      elenco = [...assegnazioni, ...(arrivo || [])]
    }
    const { nuove, saltate, liberi } = copiaSettimana(elenco, {
      daAtleta: atleta.id, aAtleta, giorni: giorni.map(chiave), scartoGiorni: dopo ? 7 : 0,
    })
    const destinatario = dopo ? atleta.nome : nomeDi(aAtleta)
    if (nuove.length === 0) {
      setAvviso({ testo: saltate > 0 ? `${destinatario} ha già tutti questi allenamenti` : 'Niente da copiare' })
      return
    }
    const { data: create, error } = await supabase.from('athlete_workouts').insert(nuove).select('id')
    if (error) { setAvviso({ testo: `Copia non riuscita: ${error.message}`, errore: true }); return }
    ;(create || []).forEach(n => {
      supabase.functions.invoke('send-reminders', { body: { mode: 'immediate', record_id: n.id } }).catch(console.error)
    })
    setAvviso({
      testo: `${nuove.length} ${nuove.length === 1 ? 'allenamento copiato' : 'allenamenti copiati'} a ${destinatario}`
        + (saltate > 0 ? ` · ${saltate} già ${saltate === 1 ? 'presente' : 'presenti'}` : '')
        + (liberi > 0 ? ` · ${liberi} ${liberi === 1 ? 'allenamento libero' : 'allenamenti liberi'} dell'atleta non ${liberi === 1 ? 'copiato' : 'copiati'}` : ''),
    })
    carica()
  }

  const iniziaDaLibreria = (e, workout) => {
    e.dataTransfer.setData(TIPO_DATI, JSON.stringify({ tipo: 'libreria', id: workout.id }))
    e.dataTransfer.effectAllowed = 'copy'
  }
  const iniziaDaChip = (e, chip) => {
    e.dataTransfer.setData(TIPO_DATI, JSON.stringify({ tipo: 'sessione', id: chip.id }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const rilascia = (e, atletaId, data) => {
    e.preventDefault()
    setSopra(null)
    let dati
    try { dati = JSON.parse(e.dataTransfer.getData(TIPO_DATI)) } catch { return }
    if (dati?.tipo === 'libreria') {
      const w = libreria.find(x => x.id === dati.id)
      if (w) assegna(w, atletaId, data)
    } else if (dati?.tipo === 'sessione') {
      const chip = righe.flatMap(r => r.celle.flatMap(c => c.chips)).find(c => c.id === dati.id)
      if (spostamentoValido(chip, atletaId, data)) sposta(chip, data)
      else if (chip && chip.atletaId !== atletaId) setAvviso({ testo: 'Una sessione si sposta solo di giorno, non di atleta.', errore: true })
    }
  }

  const titolo = `${format(giorni[0], 'd', { locale: it })} – ${format(giorni[6], 'd MMMM yyyy', { locale: it })}`

  return (
    <div className="px-10 pt-8 pb-[var(--fondo-pagina)] flex flex-col gap-5 min-h-screen cascata">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3.5">
          <h1 className="text-3xl font-black tracking-[-.03em] text-white">{titolo}</h1>
          <div className="flex gap-1.5">
            <button type="button" aria-label="Settimana precedente" onClick={() => setRiferimento(d => addWeeks(d, -1))}
              className="w-10 h-10 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] text-gray-300 flex items-center justify-center hover:text-white">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Settimana successiva" onClick={() => setRiferimento(d => addWeeks(d, 1))}
              className="w-10 h-10 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] text-gray-300 flex items-center justify-center hover:text-white">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <button type="button" onClick={() => setRiferimento(new Date())}
            className="h-10 px-3.5 rounded-xl border border-[#383838] text-gray-300 text-[13px] font-bold hover:text-white">Oggi</button>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label="Vista" className="flex gap-1 bg-[#111] border border-[#333] p-1 rounded-2xl">
            <span className="h-[34px] px-3.5 rounded-xl bg-[#2a2a2a] text-white text-[13px] font-bold inline-flex items-center">Team</span>
            <button type="button" onClick={onVistaMese}
              className="h-[34px] px-3.5 rounded-xl text-gray-400 text-[13px] font-bold hover:text-white">Mese</button>
          </div>
          <div role="group" aria-label="Filtra per categoria" className="flex gap-1.5">
            {FILTRI.map(f => (
              <button key={f.etichetta} type="button" onClick={() => setFiltro(f.valore)} aria-pressed={filtro === f.valore}
                className={`h-[34px] px-3 rounded-full border text-xs font-bold transition ${
                  filtro === f.valore ? 'bg-white text-black border-white' : 'border-[#333] text-gray-400 hover:text-white'}`}>
                {f.etichetta}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setEventoAperto(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white text-black text-[13px] font-extrabold hover:brightness-95">
            <Flag size={16} aria-hidden="true" />Nuova gara
          </button>
        </div>
      </header>

      <div className="flex gap-5 items-start">
        {/* 🔴 La griglia scorre DENTRO il suo riquadro, non con la pagina: è
            l'unico modo perché la riga dei giorni resti in cima (sticky) anche
            con trenta atleti — un contenitore `overflow-x-auto` diventa il
            riferimento dello sticky, e con la pagina che scorre i giorni se ne
            andavano (segnalato dal committente il 13/10/2026). */}
        <div className="flex-1 min-w-0 overflow-auto max-h-[calc(100vh-150px)] rounded-3xl bg-[#141414] border border-[#2a2a2a]">
          <div className="min-w-[900px] grid grid-cols-[190px_repeat(7,minmax(0,1fr))]">
            <div className="sticky top-0 left-0 z-30 bg-[#141414] px-4 py-3.5 border-b border-[#262626] text-xs font-bold text-gray-400 flex items-end">
              {righe.length} {righe.length === 1 ? 'atleta' : 'atleti'}
            </div>
            {giorni.map(g => (
              <div key={chiave(g)}
                className={`sticky top-0 z-20 bg-[#141414] px-2.5 py-3 border-b border-[#262626] border-l border-[#1f1f1f] flex flex-col gap-0.5 ${isToday(g) ? 'shadow-[inset_0_0_0_999px_rgba(241,186,23,.06)]' : ''}`}>
                <span className={`text-xs font-bold uppercase tracking-[.06em] ${isToday(g) ? 'text-brand' : 'text-gray-400'}`}>
                  {format(g, 'EEE', { locale: it })}
                </span>
                <span className={`text-[22px] font-black tracking-[-.02em] ${isToday(g) ? 'text-brand' : 'text-white'}`}>{format(g, 'd')}</span>
              </div>
            ))}

            {caricamento ? (
              <div className="col-span-8 h-80 animate-pulse" />
            ) : righe.map(r => (
              <div key={r.id} className="contents">
                <div className={`sticky left-0 z-10 bg-[#141414] border-b border-[#222] flex items-center group/riga ${r.inPausa ? 'opacity-50' : ''}`}>
                  <button type="button" onClick={() => navigate(`/athletes/${r.id}`)}
                    className="flex-1 min-w-0 pl-4 py-2.5 flex items-center gap-2.5 text-left group">
                    <Volto foto={r.foto} nome={r.nome} />
                    <span className="min-w-0 flex flex-col">
                      <span className="text-[13px] font-bold text-white truncate group-hover:text-brand transition">{r.nome}</span>
                      {r.inPausa && <span className="text-[11px] text-gray-400">in pausa</span>}
                    </span>
                  </button>
                  <button type="button" onClick={() => setCopiaDi(r)} aria-label={`Copia la settimana di ${r.nome}`}
                    disabled={copiando}
                    title="Copia la settimana"
                    className="mr-2 w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[.06]
                               opacity-0 group-hover/riga:opacity-100 focus:opacity-100 transition disabled:cursor-wait disabled:opacity-30">
                    <Copy size={15} aria-hidden="true" />
                  </button>
                </div>
                {r.celle.map((c, i) => {
                  const k = `${r.id}|${c.data}`
                  return (
                    <div key={c.data}
                      onDragOver={(e) => { e.preventDefault(); if (sopra !== k) setSopra(k) }}
                      onDragLeave={() => setSopra(s => (s === k ? null : s))}
                      onDrop={(e) => rilascia(e, r.id, c.data)}
                      onDoubleClick={() => navigate(`/create?date=${c.data}&athlete_id=${r.id}`)}
                      title="Doppio clic per creare un workout per questo atleta e questo giorno"
                      className={`min-h-[76px] p-1.5 border-b border-[#222] border-l border-[#1f1f1f] flex flex-col gap-1.5 transition-colors
                        ${isToday(giorni[i]) ? 'bg-brand/[.03]' : ''}
                        ${sopra === k ? '!bg-brand/[.10] outline outline-[1.5px] outline-dashed outline-brand -outline-offset-4 rounded-xl' : ''}`}>
                      {c.chips.map(chip => (
                        <Chip key={chip.id} chip={chip} onTrascina={iniziaDaChip}
                          onApri={() => navigate(`/workout/${chip.workoutId}?athlete_id=${chip.atletaId}`)} />
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}

            {!caricamento && righe.length > 0 && (<>
              <div className="sticky left-0 z-10 bg-[#141414] px-4 py-3 text-xs font-bold text-gray-400">Sessioni</div>
              {carico.map((g, i) => (
                <div key={i} className="px-2.5 py-3 border-l border-[#1f1f1f] flex flex-col gap-1.5">
                  <div aria-hidden="true" className="h-1.5 rounded-full bg-[#262626] overflow-hidden">
                    <div className="h-1.5 rounded-full bg-green-500" style={{ width: g.sessioni ? `${(g.fatte / g.sessioni) * 100}%` : 0 }} />
                  </div>
                  <span className="text-[11px] text-gray-400">{g.sessioni ? `${g.fatte} di ${g.sessioni} fatte` : '—'}</span>
                </div>
              ))}
            </>)}
          </div>
        </div>

        <aside aria-label="Libreria dei workout" className="w-[260px] shrink-0 sticky top-6 flex flex-col gap-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-sm font-extrabold text-white">Libreria</h2>
            <span className="text-xs text-gray-400">trascina su un giorno</span>
          </div>
          <label className="h-10 px-3 rounded-xl bg-[#111] border border-[#2a2a2a] flex items-center gap-2">
            <Search size={15} className="text-gray-400" aria-hidden="true" />
            <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca un workout"
              aria-label="Cerca un workout nella libreria"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white placeholder:text-gray-500" />
          </label>
          <div className="flex flex-col gap-1.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {libreriaFiltrata.map(w => {
              const { nome, codice } = separaCodice(w.title || '')
              const cat = categoriaDi(w.sections)
              return (
                <div key={w.id} draggable onDragStart={(e) => iniziaDaLibreria(e, w)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#181818] border border-[#262626] cursor-grab active:cursor-grabbing hover:border-[#383838]">
                  <GripVertical size={14} className="text-gray-500 shrink-0" aria-hidden="true" />
                  <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${corsia(cat).dot}`} />
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="text-[13px] font-bold text-white truncate">{nome || 'Allenamento'}</span>
                    <span className="text-xs text-gray-400 truncate">{codice || corsia(cat).etichetta}</span>
                  </span>
                </div>
              )
            })}
            {libreriaFiltrata.length === 0 && (
              <p className="px-1 py-4 text-sm text-gray-400 flex items-center gap-2"><CalendarDays size={15} aria-hidden="true" />Nessun workout</p>
            )}
          </div>
          <p className="px-1 text-xs text-gray-500 leading-relaxed">
            Trascina un workout su una cella per assegnarlo. Trascina una sessione per cambiarle giorno. Doppio clic su una cella per crearne uno nuovo.
          </p>
        </aside>
      </div>

      {avviso && (
        <div role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] px-5 py-3 rounded-2xl border text-sm font-bold shadow-2xl
            ${avviso.errore ? 'bg-red-950 border-red-500/50 text-red-200' : 'bg-[#1e1e1e] border-[#383838] text-white'}`}>
          {avviso.testo}
        </div>
      )}

      {copiaDi && createPortal(
        <FoglioCopia atleta={copiaDi} quante={sedute(copiaDi.id).length}
          altri={righe.filter(x => x.id !== copiaDi.id)}
          etichettaSettimana={`${format(giorni[0], 'd MMM', { locale: it })} – ${format(giorni[6], 'd MMM', { locale: it })}`}
          etichettaDopo={`${format(addWeeks(giorni[0], 1), 'd MMM', { locale: it })} – ${format(addWeeks(giorni[6], 1), 'd MMM', { locale: it })}`}
          onCopia={(dest) => copia(copiaDi, dest)} onClose={() => setCopiaDi(null)} />,
        document.body,
      )}

      {eventoAperto && createPortal(
        <NuovoEvento athleteId={user.id} dataIniziale={chiave(new Date())}
          onClose={() => setEventoAperto(false)}
          onSaved={() => { setEventoAperto(false); carica() }} />,
        document.body,
      )}
    </div>
  )
}
