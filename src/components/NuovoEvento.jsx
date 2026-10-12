import { useState, useEffect, useMemo } from 'react'
import { X, Search, ChevronLeft, ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { supabase } from '../supabaseClient'
import { CustomAlert } from './CustomModals'
import CustomDatePicker from './CustomDatePicker'
import { vibraScelta } from '../lib/aptica'
import {
  caricaGare, gareFuture, cercaGare, giorniGara, giornoProposto, periodoGara, sectionsEvento,
} from '../lib/gareHyrox'

/**
 * La modale «Nuovo evento / gara» del calendario.
 *
 * Due modi: **HYROX**, che sceglie la gara dal calendario ufficiale
 * (Edge Function `gare-hyrox`, src/lib/gareHyrox.js) e ne prende nome e
 * giorni, e **Altro**, il campo libero di sempre. Se la lista non arriva,
 * la modale lo dice e porta al campo libero: un evento si crea comunque.
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

  const elenco = useMemo(() => cercaGare(gareFuture(gare || [], oggi), ricerca), [gare, oggi, ricerca])

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

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm max-h-[85vh] flex flex-col border border-[#333] shadow-2xl modal-transition">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a] shrink-0">
          <p className="text-white font-bold text-lg">Nuovo Evento / Gara</p>
          <button aria-label="Chiudi" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto hide-scrollbar">
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
              gare={gare} errore={erroreGare} elenco={elenco} ricerca={ricerca}
              onRicerca={setRicerca} onScegli={scegliGara} onAltro={() => scegliModo('altro')}
            />
          )}

          {modo === 'hyrox' && gara && (
            <>
              <div className="bg-[#111] border border-brand/40 rounded-2xl p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-bold leading-tight">{gara.nome}</p>
                    <p className="text-sm text-gray-400 mt-1">{periodoGara(gara)}</p>
                  </div>
                  {gara.codice && (
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-brand/10 text-brand border border-brand/30 shrink-0">{gara.codice}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
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

              {giorniGara(gara).length > 1 && (
                <div>
                  <p className="text-gray-400 text-xs pl-1 mb-1.5">Il tuo giorno di gara *</p>
                  <div className="flex flex-wrap gap-2">
                    {giorniGara(gara).map(g => (
                      <button key={g} onClick={() => { if (g !== date) vibraScelta(); setDate(g) }}
                        aria-pressed={g === date}
                        className={`px-3 py-2 rounded-xl text-sm font-bold border capitalize transition ${
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

          {(modo === 'altro' || gara) && (
            <button onClick={handleSave} disabled={saving || !pronto} className="w-full mt-2 py-3.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition disabled:opacity-50 shrink-0">
              {saving ? 'Salvataggio...' : 'Aggiungi al Calendario'}
            </button>
          )}
        </div>
      </div>
      {alertInfo && <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />}
    </div>
  )
}

function ListaGare({ gare, errore, elenco, ricerca, onRicerca, onScegli, onAltro }) {
  if (gare === null) {
    return (
      <div className="flex flex-col gap-2" aria-label="Caricamento gare">
        {[0, 1, 2].map(i => <div key={i} className="bg-[#111] border border-[#2a2a2a] rounded-2xl h-16 animate-pulse" />)}
      </div>
    )
  }
  if (errore) {
    return (
      <div className="border border-dashed border-[#333] rounded-2xl p-5 text-center flex flex-col gap-3">
        <p className="text-sm text-gray-400">{errore}</p>
        <button onClick={onAltro} className="text-sm font-bold text-white underline underline-offset-4">Scrivi l'evento a mano</button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input type="search" placeholder="Cerca città o gara" value={ricerca} onChange={e => onRicerca(e.target.value)}
          aria-label="Cerca gara HYROX"
          className="w-full bg-[#111] border border-[#333] text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-brand text-base" />
      </div>
      {elenco.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">Nessuna gara trovata 🤷</p>
      ) : (
        <ul className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto hide-scrollbar">
          {elenco.map(g => (
            <li key={g.id}>
              <button onClick={() => onScegli(g)}
                className="w-full text-left bg-[#111] border border-[#2a2a2a] hover:border-brand rounded-2xl px-4 py-3 flex items-center gap-3 transition">
                <span className="text-[11px] font-black w-11 shrink-0 text-center py-1 rounded-lg bg-brand/10 text-brand border border-brand/30">{g.codice || '—'}</span>
                <span className="min-w-0">
                  <span className="block text-white font-semibold leading-tight truncate">{g.nome}</span>
                  <span className="block text-xs text-gray-400 mt-0.5">{periodoGara(g)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
