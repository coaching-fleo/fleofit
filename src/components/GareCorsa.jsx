import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, ChevronLeft, ChevronDown, ExternalLink, Check } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../supabaseClient'
import { vibraScelta } from '../lib/aptica'
import { gareFuture, periodoGara, blocchettoData, quandoGara, perMese } from '../lib/gare'
import {
  caricaGareCorsa, filtraCorsa, regioniPresenti, distanzePresenti, leggiRegione, scriviRegione,
  REGIONI, DISTANZE,
} from '../lib/gareCorsa'
import { LABEL } from '../lib/stiliCard'

/**
 * Le gare di corsa italiane (calendario FIDAL, Edge Function `gare-corsa`)
 * dentro «Nuovo evento» → «Prossima gara» → Corsa.
 *
 * Pigro: lo importa solo NuovoEvento con `lazy()`, perché il foglio si apre
 * anche dalla Home e il chunk d'ingresso non deve crescere (CLAUDE.md §2).
 *
 * Senza `gara` mostra la lista (la carica da sé, con la copia di 12 ore di
 * src/lib/gareCorsa.js); con `gara` la card grande della gara scelta. Giorno
 * di gara, nome nel calendario e salvataggio restano in NuovoEvento, uguali
 * per Hyrox e Corsa.
 *
 * La regione scelta si ricorda (`fleofit_corsa_regione`): chi corre in
 * Lombardia non deve sceglierla ogni volta.
 */
export default function GareCorsa({ oggi = format(new Date(), 'yyyy-MM-dd'), gara, onScegli, onCambia, onAltro }) {
  const [gare, setGare] = useState(null) // null = in arrivo
  const [errore, setErrore] = useState(null)
  const [ricerca, setRicerca] = useState('')
  const [distanza, setDistanza] = useState('')
  const [regione, setRegione] = useState(() => leggiRegione())
  const [foglioRegione, setFoglioRegione] = useState(false)

  useEffect(() => {
    let vivo = true
    caricaGareCorsa(supabase).then(({ gare, errore }) => {
      if (!vivo) return
      setGare(gare)
      setErrore(errore)
    })
    return () => { vivo = false }
  }, [])

  // Solo le gare non ancora finite, come la lista HYROX. Regioni e distanze
  // vengono da tutta la lista, non da quella filtrata: anche con «Nessuna gara
  // trovata» i filtri restano lì da toccare.
  const future = useMemo(() => gareFuture(gare || [], oggi), [gare, oggi])
  const regioni = useMemo(() => regioniPresenti(future), [future])
  const distanze = useMemo(() => distanzePresenti(future), [future])
  const elenco = useMemo(() => filtraCorsa(future, { regione, distanza, ricerca }), [future, regione, distanza, ricerca])
  const mesi = useMemo(() => perMese(elenco), [elenco])

  if (gara) {
    return (
      <div className="flex flex-col gap-3">
        <CardCorsa gara={gara} oggi={oggi} />
        <div className="flex items-center justify-between px-1">
          <button onClick={onCambia} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
            <ChevronLeft size={16} aria-hidden="true" /> Cambia gara
          </button>
          {gara.url && (
            <a href={gara.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
              Pagina FIDAL <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    )
  }

  if (gare === null) {
    return (
      <div className="flex flex-col gap-2.5" aria-label="Caricamento gare">
        {[0, 1, 2, 3].map(i => <div key={i} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl h-16 animate-pulse" />)}
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

  const scegliDistanza = (d) => {
    if (d === distanza) return
    vibraScelta()
    setDistanza(d)
  }
  const scegliRegione = (r) => {
    if (r !== regione) vibraScelta()
    setRegione(r)
    scriviRegione(r)
    setFoglioRegione(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={18} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input type="search" placeholder="Cerca gara o città" value={ricerca} onChange={e => setRicerca(e.target.value)}
            aria-label="Cerca gara di corsa"
            className="w-full bg-[#111] border border-[#333] text-white pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-running text-base" />
        </div>
        <button onClick={() => setFoglioRegione(true)} aria-haspopup="dialog"
          className={`shrink-0 max-w-[45%] flex items-center gap-1.5 px-3.5 rounded-xl border text-[13px] font-bold transition ${
            regione ? 'bg-running/10 text-running border-running/30' : 'bg-[#111] text-gray-300 border-[#333] hover:border-gray-500'
          }`}>
          <span className="truncate">{regione ? (REGIONI[regione] || regione) : 'Tutta Italia'}</span>
          <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
        </button>
      </div>

      {distanze.length > 1 && (
        <div role="group" aria-label="Distanza" className="-mx-4 px-4 flex gap-2 overflow-x-auto hide-scrollbar">
          {['', ...distanze].map(d => {
            const attivo = d === distanza
            return (
              <button key={d || 'tutte'} onClick={() => scegliDistanza(d)} aria-pressed={attivo}
                className={`shrink-0 px-3.5 py-2 rounded-full text-[13px] font-bold border transition ${
                  attivo ? 'bg-white text-black border-white' : 'bg-[#111] text-gray-300 border-[#333] hover:border-gray-500'
                }`}>
                {d ? DISTANZE.find(x => x.id === d)?.etichetta : 'Tutte'}
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
              <ul className="flex flex-col gap-2">
                {m.gare.map(g => (
                  <li key={g.id}>
                    <RigaCorsa gara={g} onScegli={() => { vibraScelta(); onScegli(g) }} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {foglioRegione && (
        <FoglioRegione regioni={regioni} regione={regione} onScegli={scegliRegione} onChiudi={() => setFoglioRegione(false)} />
      )}
    </div>
  )
}

/** «Monza (MB) · Lombardia»; senza regione solo «Monza (MB)». */
function dove(gara, conProvincia = true) {
  const citta = [gara.citta, conProvincia && gara.provincia ? `(${gara.provincia})` : ''].filter(Boolean).join(' ')
  return [citta, gara.regione ? (REGIONI[gara.regione] || gara.regione) : ''].filter(Boolean).join(' · ')
}

function PillolaDistanza({ distanza }) {
  const d = DISTANZE.find(x => x.id === distanza)
  if (!d || d.id === 'altre') return null
  return (
    <span className="shrink-0 px-2.5 py-1 bg-running/10 text-running border border-running/30 rounded-full text-xs font-bold">
      {d.etichetta}
    </span>
  )
}

function RigaCorsa({ gara, onScegli }) {
  const { giorni, mese } = blocchettoData(gara)
  return (
    <button onClick={onScegli} aria-label={`${gara.nome}, ${periodoGara(gara)}`}
      className="w-full text-left flex items-center gap-3 min-h-16 px-3 py-2.5 rounded-2xl bg-[#1e1e1e] border border-[#2a2a2a] hover:border-running transition active:scale-[.99]">
      <div className="shrink-0 rounded-xl bg-[#111] border border-[#2a2a2a] px-2 py-1 text-center min-w-[52px]">
        <p className="text-[16px] font-black text-white leading-tight tracking-tight">{giorni}</p>
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-running">{mese}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-white truncate">{gara.nome}</p>
        <p className="mt-0.5 text-[13px] text-gray-400 truncate">{dove(gara)}</p>
      </div>
      <PillolaDistanza distanza={gara.distanza} />
    </button>
  )
}

/**
 * La gara scelta: la card alta di CardGara (NuovoEvento), senza foto — FIDAL
 * non ne dà — con la distanza grande in filigrana al posto del codice HYROX.
 */
function CardCorsa({ gara, oggi }) {
  const { giorni, mese } = blocchettoData(gara)
  const quando = quandoGara(gara, oggi)
  const filigrana = DISTANZE.find(d => d.id === gara.distanza)?.filigrana
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#161616] h-52">
      {filigrana && (
        <span aria-hidden="true" className="absolute -right-2 -bottom-6 text-[96px] font-black tracking-tighter text-white/[.04] -rotate-12 leading-none">
          {filigrana}
        </span>
      )}
      <div className="relative h-full p-4 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-2xl bg-black/55 border border-white/10 px-3 py-1.5 text-center min-w-[58px]">
            <p className="text-[19px] font-black text-white leading-tight tracking-tight">{giorni}</p>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-running">{mese}</p>
          </div>
          <PillolaDistanza distanza={gara.distanza} />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[24px] font-black tracking-tight text-white leading-tight line-clamp-2">{gara.nome}</p>
            <p className="mt-1.5 text-[13px] font-medium text-gray-300 truncate">{dove(gara, false)}</p>
          </div>
          {quando && (
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
              quando === 'In corso' || quando === 'Oggi'
                ? 'bg-running/15 text-running border border-running/40'
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

/**
 * Il foglio dal basso della regione. La X (`aria-label="Chiudi"`) serve anche
 * al tasto indietro di Android (src/lib/indietroAndroid.js). z-[150]: sopra
 * «Nuovo evento», che sta a z-[100].
 */
function FoglioRegione({ regioni, regione, onScegli, onChiudi }) {
  const voci = ['', ...regioni]
  return createPortal(
    <div className="fixed inset-0 z-[150] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 velo-in" onClick={onChiudi} />
      <div role="dialog" aria-modal="true" aria-labelledby="foglio-regione-titolo"
        className="relative bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[80dvh] flex flex-col sheet-in">
        <div className="w-10 h-1 rounded-full bg-[#383838] mx-auto mb-4 shrink-0" aria-hidden="true" />
        <div className="flex items-center justify-between gap-4 shrink-0">
          <h3 id="foglio-regione-titolo" className="text-xl font-black tracking-tight text-white">Regione</h3>
          <button aria-label="Chiudi" onClick={onChiudi}
            className="shrink-0 w-11 h-11 -mr-1 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <ul className="mt-3 overflow-y-auto hide-scrollbar flex flex-col">
          {voci.map(r => {
            const attiva = r === regione
            return (
              <li key={r || 'italia'}>
                <button onClick={() => onScegli(r)} aria-pressed={attiva}
                  className={`w-full min-h-[48px] flex items-center justify-between gap-3 px-1 text-left text-[15px] border-b border-[#2a2a2a] transition ${
                    attiva ? 'text-running font-bold' : 'text-gray-200 hover:text-white'
                  }`}>
                  <span className="truncate">{r ? (REGIONI[r] || r) : 'Tutta Italia'}</span>
                  {attiva && <Check size={18} aria-hidden="true" className="shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>,
    document.body
  )
}
