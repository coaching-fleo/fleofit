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
  continentiPresenti, filtraContinente, nomeContinente, bandiera, nomePaese,
  blocchettoData, quandoGara, perMese,
} from '../lib/gareHyrox'
import { LABEL } from '../lib/stiliCard'

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
            oggi={oggi} onScegli={scegliGara} onAltro={() => scegliModo('altro')}
          />
        )}

        {modo === 'hyrox' && gara && (
          <>
            <div className="flex flex-col gap-3">
              <CardGara gara={gara} oggi={oggi} alta />
              <div className="flex items-center justify-between px-1">
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
 * La card di una gara: la foto di hyrox.com riempie tutta la card, in bianco
 * e nero e scurita da sinistra, e il testo ci sta sopra. A sinistra il
 * blocchetto della data, a destra il codice della città in giallo — il segno
 * FLEOFIT della card — e in basso città, paese e quanto manca.
 *
 * In bianco e nero perché le foto di città diverse, a colori, litigherebbero
 * con la palette (CLAUDE.md §6). Senza foto, o se non si carica, resta il
 * fondo scuro con il codice grande in filigrana: la card non cambia altezza.
 */
function CardGara({ gara, oggi, alta = false }) {
  const [rotta, setRotta] = useState(false)
  const { giorni, mese } = blocchettoData(gara)
  const quando = quandoGara(gara, oggi)
  const flag = bandiera(gara.paese)
  const dove = [nomePaese(gara), nomeContinente(gara.continente)].filter(Boolean).join(' · ')
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-[#161616] ${alta ? 'h-52' : 'h-44'}`}>
      {gara.immagine && !rotta ? (
        <img src={gara.immagine} alt="" loading="lazy" decoding="async" onError={() => setRotta(true)}
          className="absolute inset-0 w-full h-full object-cover grayscale" />
      ) : (
        <span aria-hidden="true" className="absolute -right-2 -bottom-6 text-[96px] font-black tracking-tighter text-white/[.04] -rotate-12 leading-none">
          {gara.codice || 'HYROX'}
        </span>
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

      <div className="relative h-full p-4 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 text-center min-w-[58px]">
            <p className="text-[19px] font-black text-white leading-tight tracking-tight">{giorni}</p>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-brand">{mese}</p>
          </div>
          {gara.codice && (
            <span className="text-[12px] font-black tracking-[.12em] px-2.5 py-1 rounded-lg bg-brand text-black">{gara.codice}</span>
          )}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={`${alta ? 'text-[26px]' : 'text-[23px]'} font-black tracking-tight text-white leading-none truncate`}>
              {gara.citta || gara.nome}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-gray-300 truncate">
              {flag && <span aria-hidden="true" className="text-[15px] leading-none">{flag}</span>}
              <span className="truncate">{dove}</span>
            </p>
          </div>
          {quando && (
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
              quando === 'In corso' || quando === 'Oggi'
                ? 'bg-brand/15 text-brand border border-brand/40'
                : 'bg-black/50 text-gray-300 border border-white/10'
            }`}>
              {quando}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ListaGare({ gare, errore, elenco, ricerca, onRicerca, continenti, continente, onContinente, oggi, onScegli, onAltro }) {
  const mesi = useMemo(() => perMese(elenco), [elenco])
  if (gare === null) {
    return (
      <div className="flex flex-col gap-3" aria-label="Caricamento gare">
        {[0, 1, 2].map(i => <div key={i} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl h-44 animate-pulse" />)}
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
  const scegliContinente = (c) => {
    if (c === continente) return
    vibraScelta()
    onContinente(c)
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input type="search" placeholder="Cerca città, paese o gara" value={ricerca} onChange={e => onRicerca(e.target.value)}
          aria-label="Cerca gara HYROX"
          className="w-full bg-[#111] border border-[#333] text-white pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-brand text-base" />
      </div>

      {continenti.length > 1 && (
        <div role="group" aria-label="Regione del mondo" className="-mx-4 px-4 flex gap-2 overflow-x-auto hide-scrollbar">
          {['', ...continenti].map(c => {
            const attivo = c === continente
            return (
              <button key={c || 'tutte'} onClick={() => scegliContinente(c)} aria-pressed={attivo}
                className={`shrink-0 px-3.5 py-2 rounded-full text-[13px] font-bold border transition ${
                  attivo ? 'bg-white text-black border-white' : 'bg-[#111] text-gray-300 border-[#333] hover:border-gray-500'
                }`}>
                {c ? nomeContinente(c) : 'Tutto il mondo'}
              </button>
            )
          })}
        </div>
      )}

      {elenco.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">Nessuna gara trovata 🤷</p>
      ) : (
        <div className="flex flex-col gap-5 mt-1">
          {mesi.map(m => (
            <section key={m.chiave} aria-label={m.titolo} className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between px-1">
                <p className={LABEL}>{m.titolo}</p>
                <p className="text-[11px] font-semibold text-muted">{m.gare.length} {m.gare.length === 1 ? 'gara' : 'gare'}</p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {m.gare.map(g => (
                  <li key={g.id}>
                    <button onClick={() => onScegli(g)} aria-label={`${g.nome}, ${periodoGara(g)}`}
                      className="w-full text-left rounded-3xl border border-[#2a2a2a] hover:border-brand transition active:scale-[.99] overflow-hidden">
                      <CardGara gara={g} oggi={oggi} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
