import { useState, useEffect, useMemo } from 'react'
import { X, Search, ChevronLeft, ChevronDown, ExternalLink, MapPin } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { supabase } from '../supabaseClient'
import { CustomAlert } from './CustomModals'
import CustomDatePicker from './CustomDatePicker'
import { vibraScelta } from '../lib/aptica'
import {
  caricaGare, gareFuture, cercaGare, giorniGara, giornoProposto, periodoGara, sectionsEvento,
  continentiPresenti, filtraContinente, nomeContinente, bandiera, nomePaese,
} from '../lib/gareHyrox'

/**
 * «Nuovo evento / gara», a tutto schermo: dal calendario (bottone +) e dalla
 * Home dell'atleta («Hai una gara in programma?»).
 *
 * Due modi: **Gara HYROX**, che sceglie la gara dal calendario ufficiale
 * (Edge Function `gare-hyrox`, src/lib/gareHyrox.js) — card con la foto del
 * sito, bandiera, paese e filtro per continente — e **Altro evento**, il campo
 * libero di sempre. Se la lista non arriva, lo dice e porta al campo libero:
 * un evento si crea comunque.
 *
 * ⚠️ Il workout salvato è lo stesso evento di prima (`category: 'Event'`):
 * la gara scelta aggiunge solo `sections.hyrox`, che `main` ignora.
 */
export default function NuovoEvento({ athleteId, dataIniziale, onClose, onSaved }) {
  const oggi = format(new Date(), 'yyyy-MM-dd')
  const [modo, setModo] = useState('hyrox')
  const [title, setTitle] = useState('')
  // La data parte da quella SELEZIONATA nel calendario, non da oggi: si apre
  // questa modale dopo aver scelto un giorno (calendario.md).
  const [date, setDate] = useState(dataIniziale || oggi)
  const [saving, setSaving] = useState(false)
  const [alertInfo, setAlertInfo] = useState(null)

  const [gare, setGare] = useState(null) // null = in arrivo
  const [erroreGare, setErroreGare] = useState(null)
  const [ricerca, setRicerca] = useState('')
  const [continente, setContinente] = useState('')
  const [gara, setGara] = useState(null)

  useEffect(() => {
    let vivo = true
    caricaGare(supabase).then(({ gare, errore }) => {
      if (!vivo) return
      setGare(gare)
      setErroreGare(errore)
    })
    return () => { vivo = false }
  }, [])

  const future = useMemo(() => gareFuture(gare || [], oggi), [gare, oggi])
  const continenti = useMemo(() => continentiPresenti(future), [future])
  const elenco = useMemo(
    () => cercaGare(filtraContinente(future, continente), ricerca),
    [future, continente, ricerca],
  )

  const scegliModo = (nuovo) => {
    if (nuovo === modo) return
    vibraScelta()
    setModo(nuovo)
  }

  const scegliGara = (g) => {
    vibraScelta()
    setGara(g)
    setTitle(g.nome)
    setDate(giornoProposto(g, dataIniziale))
  }

  const cambiaGara = () => {
    setGara(null)
    setTitle('')
    setDate(dataIniziale || oggi)
  }

  const garaInUso = modo === 'hyrox' ? gara : null
  const pronto = !!title.trim() && !!date && (modo !== 'hyrox' || !!gara)

  const handleSave = async () => {
    if (!title.trim() || !date) return setAlertInfo({ title: 'Errore', message: 'Titolo e data obbligatori', type: 'error' })
    setSaving(true)
    const { data: newW, error: wError } = await supabase.from('workouts').insert({
      title: title.trim(),
      date,
      sections: sectionsEvento(garaInUso),
    }).select().single()
    if (wError) { setSaving(false); return setAlertInfo({ title: 'Errore', message: wError.message, type: 'error' }) }
    const { error: awError } = await supabase.from('athlete_workouts').insert({
      athlete_id: athleteId, workout_id: newW.id, completed_date: date, status: 'pending'
    })
    setSaving(false)
    if (awError) return setAlertInfo({ title: 'Errore', message: awError.message, type: 'error' })
    onSaved()
  }

  const mostraSalva = modo === 'altro' || !!gara

  return (
    <div className="fixed inset-0 z-[100] bg-[#0B0B0B] flex flex-col velo-in">
      <div className="shrink-0 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 flex items-center gap-3">
        <button aria-label="Chiudi" onClick={onClose}
          className="w-11 h-11 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-gray-300 hover:text-white shrink-0">
          <X size={20} />
        </button>
        <h2 className="text-xl font-black tracking-tight text-white">Nuovo evento</h2>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-6 flex flex-col gap-4">
        <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333] shrink-0" role="tablist">
          <div
            className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] bg-[#2a2a2a] rounded-xl shadow-md transition-transform duration-300 ease-out ${
              modo === 'hyrox' ? 'translate-x-0' : 'translate-x-full'
            }`}
          />
          <button role="tab" aria-selected={modo === 'hyrox'} onClick={() => scegliModo('hyrox')}
            className={`relative z-10 flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors duration-300 ${modo === 'hyrox' ? 'text-brand' : 'text-muted hover:text-gray-300'}`}>
            Gara HYROX
          </button>
          <button role="tab" aria-selected={modo === 'altro'} onClick={() => scegliModo('altro')}
            className={`relative z-10 flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors duration-300 ${modo === 'altro' ? 'text-white' : 'text-muted hover:text-gray-300'}`}>
            Altro evento
          </button>
        </div>

        {modo === 'hyrox' && !gara && (
          <ListaGare
            gare={gare} errore={erroreGare} elenco={elenco} ricerca={ricerca} onRicerca={setRicerca}
            continenti={continenti} continente={continente} onContinente={setContinente}
            onScegli={scegliGara} onAltro={() => scegliModo('altro')}
          />
        )}

        {modo === 'hyrox' && gara && (
          <>
            <div className="bg-[#1e1e1e] border border-brand/40 rounded-3xl overflow-hidden">
              <FotoGara gara={gara} className="h-40" />
              <div className="p-5 flex flex-col gap-3">
                <InfoGara gara={gara} />
                <div className="flex items-center justify-between pt-1">
                  <button onClick={cambiaGara} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                    <ChevronLeft size={16} /> Cambia gara
                  </button>
                  {gara.url && (
                    <a href={gara.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                      Sito <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {giorniGara(gara).length > 1 && (
              <div>
                <p className="text-gray-400 text-xs pl-1 mb-1.5">Il tuo giorno di gara *</p>
                <div className="flex flex-wrap gap-2">
                  {giorniGara(gara).map(g => (
                    <button key={g} onClick={() => { if (g !== date) vibraScelta(); setDate(g) }}
                      aria-pressed={g === date}
                      className={`px-3.5 py-2 rounded-xl text-sm font-bold border capitalize transition ${
                        g === date ? 'bg-brand text-black border-brand' : 'bg-[#111] text-gray-300 border-[#333] hover:border-brand'
                      }`}>
                      {format(parseISO(g), 'EEE d', { locale: it })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-gray-400 text-xs pl-1 mb-1 block">Nome nel calendario</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-white text-base" />
            </div>
          </>
        )}

        {modo === 'altro' && (
          <>
            <div>
              <label className="text-gray-400 text-xs pl-1 mb-1 block">Nome Evento *</label>
              <input type="text" placeholder="Es. Maratona di Roma" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-white text-base" />
            </div>
            <div>
              <label className="text-gray-400 text-xs pl-1 mb-1 block">Data *</label>
              <CustomDatePicker date={date} onChange={setDate} className="bg-[#111] border border-[#333] rounded-xl px-4 py-3 hover:border-white w-full text-base" />
            </div>
          </>
        )}
      </div>

      {mostraSalva && (
        <div className="shrink-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-[#2a2a2a] bg-[#0B0B0B]">
          <button onClick={handleSave} disabled={saving || !pronto} className="w-full py-3.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Aggiungi al Calendario'}
          </button>
        </div>
      )}
      {alertInfo && <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />}
    </div>
  )
}

/**
 * La foto della gara presa da hyrox.com, in bianco e nero: le foto del sito
 * sono di città diverse con colori diversi, e a colori litigherebbero con la
 * palette (CLAUDE.md §6). Senza foto, o se non si carica, resta il fondo con
 * il codice della città: la card non cambia altezza.
 */
function FotoGara({ gara, className = '' }) {
  const [rotta, setRotta] = useState(false)
  return (
    <div className={`relative bg-[#161616] overflow-hidden ${className}`}>
      {gara.immagine && !rotta ? (
        <img src={gara.immagine} alt="" loading="lazy" decoding="async" onError={() => setRotta(true)}
          className="absolute inset-0 w-full h-full object-cover grayscale" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-4xl font-black tracking-tight text-[#2a2a2a]">
          {gara.codice || 'HYROX'}
        </span>
      )}
    </div>
  )
}

/** Periodo, città, bandiera e paese, continente: il corpo di una card. */
function InfoGara({ gara }) {
  const paese = nomePaese(gara)
  const flag = bandiera(gara.paese)
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm text-gray-400">{periodoGara(gara)}</p>
      <p className="text-[22px] font-black tracking-tight text-white leading-tight">{gara.citta || gara.nome}</p>
      <div className="flex items-center justify-between gap-3 mt-1">
        <span className="flex items-center gap-2 min-w-0 text-[15px] text-gray-300">
          {flag && (
            <span aria-hidden="true" className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-[26px] leading-none">
              {flag}
            </span>
          )}
          <span className="truncate">{paese}</span>
        </span>
        {gara.continente && (
          <span className="text-xs font-bold px-3 py-1 rounded-full border border-[#383838] text-gray-300 shrink-0">
            {nomeContinente(gara.continente)}
          </span>
        )}
      </div>
    </div>
  )
}

function ListaGare({ gare, errore, elenco, ricerca, onRicerca, continenti, continente, onContinente, onScegli, onAltro }) {
  if (gare === null) {
    return (
      <div className="flex flex-col gap-4" aria-label="Caricamento gare">
        {[0, 1].map(i => <div key={i} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl h-64 animate-pulse" />)}
      </div>
    )
  }
  if (errore) {
    return (
      <div className="border border-dashed border-[#333] rounded-3xl p-6 text-center flex flex-col gap-3">
        <p className="text-sm text-gray-400">{errore}</p>
        <button onClick={onAltro} className="text-sm font-bold text-white underline underline-offset-4">Scrivi l'evento a mano</button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input type="search" placeholder="Cerca città, paese o gara" value={ricerca} onChange={e => onRicerca(e.target.value)}
          aria-label="Cerca gara HYROX"
          className="w-full bg-[#1e1e1e] border border-[#2a2a2a] text-white pl-11 pr-4 py-3 rounded-full focus:outline-none focus:border-brand text-base" />
      </div>

      {continenti.length > 1 && (
        <label className="relative self-start flex items-center gap-2 bg-[#1e1e1e] border border-[#2a2a2a] rounded-full pl-4 pr-10 py-2.5 text-[15px] text-white focus-within:border-brand">
          <MapPin size={18} className="text-brand shrink-0" aria-hidden="true" />
          <select value={continente} onChange={e => { vibraScelta(); onContinente(e.target.value) }}
            aria-label="Regione del mondo"
            className="appearance-none bg-transparent text-white focus:outline-none pr-1">
            <option value="">Tutte le regioni</option>
            {continenti.map(c => <option key={c} value={c}>{nomeContinente(c)}</option>)}
          </select>
          <ChevronDown size={18} className="absolute right-3.5 text-gray-400 pointer-events-none" aria-hidden="true" />
        </label>
      )}

      {elenco.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">Nessuna gara trovata 🤷</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {elenco.map(g => (
            <li key={g.id}>
              <button onClick={() => onScegli(g)} aria-label={`${g.nome}, ${periodoGara(g)}`}
                className="w-full text-left bg-[#1e1e1e] border border-[#2a2a2a] hover:border-brand rounded-3xl overflow-hidden transition active:scale-[.99]">
                <FotoGara gara={g} className="h-36" />
                <div className="px-5 py-4">
                  <InfoGara gara={g} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
