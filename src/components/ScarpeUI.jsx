import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Footprints, Pencil, Trash2, Plus } from 'lucide-react'
import { CARD, LABEL, BOTTONE_BRAND, BOTTONE_QUIETO } from '../lib/stiliCard'
import { chiudiTastieraSuInvio } from '../useTastiera'
import { useBottomSheet } from '../useBottomSheet'
import { Foglio } from './FoglioMessaggio'
import { statoScarpa, testoKm, TIPI_SCARPA, SOGLIA_PREDEFINITA } from '../lib/kmScarpe'
import { numeroKm } from '../lib/scarpeDb'
import { vibraScelta } from '../lib/aptica'

// «Scarpe da corsa» (02/11/2026, spec §2): solo presentazione. La pagina
// /scarpe, la card del profilo e (Task 7-8) il dettaglio e la scheda atleta
// decidono cosa fa ogni tocco.

const etichettaTipo = (t) => TIPI_SCARPA.find(x => x.valore === t)?.etichetta ?? null

/** Il colore della barra: neutra → giallo brand da 80% → rosso da 100%. Classi per intero. */
const COLORE_BARRA = { ok: 'bg-white/45', quasi: 'bg-brand', oltre: 'bg-red-500' }

/** La barra dei km verso la soglia di cambio. */
export function BarraKm({ km, soglia = SOGLIA_PREDEFINITA }) {
  const stato = statoScarpa(km, soglia)
  const quota = soglia > 0 && Number.isFinite(Number(km)) ? Math.min(Number(km) / soglia, 1) : 0
  return (
    <div role="progressbar" aria-label="Km verso la soglia di cambio"
      aria-valuemin={0} aria-valuemax={Math.round(soglia)} aria-valuenow={Math.round(Number(km) || 0)}
      data-stato={stato}
      className="h-1.5 w-full rounded-full bg-white/[.08] overflow-hidden">
      <div className={`h-full rounded-full ${COLORE_BARRA[stato] || COLORE_BARRA.ok}`} style={{ width: `${quota * 100}%` }} />
    </div>
  )
}

/** Il bollino «Principale». */
function Bollino() {
  return (
    <span className="shrink-0 px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/30 text-[11px] font-bold">
      Principale
    </span>
  )
}

/**
 * Una scarpa dell'atleta: marca, modello, «412 / 700 km» e la barra. Con
 * `onApri` è un bottone (il dettaglio, Task 7), senza è una card ferma.
 */
export function CardScarpa({ scarpa, onApri }) {
  const ritirata = !!scarpa.ritirata_at
  const corpo = (
    <>
      <span className="flex items-start gap-2">
        <span className="flex-1 min-w-0">
          <span className={`block ${LABEL}`}>{scarpa.marca}</span>
          <span className="block mt-0.5 text-[16px] font-extrabold text-white truncate">{scarpa.modello}</span>
        </span>
        {scarpa.principale && !ritirata && <Bollino />}
        {onApri && <ChevronRight size={17} className="shrink-0 mt-2 text-muted" aria-hidden="true" />}
      </span>
      <span className="flex items-baseline justify-between gap-2">
        <span className={`text-[13px] font-bold ${scarpa.stato === 'oltre' ? 'text-red-500' : scarpa.stato === 'quasi' ? 'text-brand' : 'text-gray-300'}`}>
          {`${testoKm(scarpa.km)} / ${testoKm(scarpa.soglia_km)} km`}
        </span>
        {scarpa.stato === 'oltre' && !ritirata && <span className="text-[12px] font-bold text-red-500">Da cambiare</span>}
      </span>
      <BarraKm km={scarpa.km} soglia={scarpa.soglia_km} />
    </>
  )
  const classe = `${CARD} w-full p-4 flex flex-col gap-2.5 text-left ${ritirata ? 'opacity-60' : ''}`
  return onApri
    ? <button type="button" data-testid="card-scarpa" onClick={() => onApri(scarpa)} className={`${classe} hover:border-white/20 transition`}>{corpo}</button>
    : <div data-testid="card-scarpa" className={classe}>{corpo}</div>
}

/**
 * La card «Le mie scarpe» nel profilo atleta: la principale con i suoi km, o
 * l'invito ad aggiungerne una. Porta a /scarpe. Chi la monta la nasconde
 * quando le tabelle non ci sono.
 */
export function CardProfiloScarpe({ scarpe }) {
  const attive = scarpe.filter(s => !s.ritirata_at)
  const principale = attive.find(s => s.principale)
  const daCambiare = attive.filter(s => s.stato === 'oltre').length
  return (
    <Link to="/scarpe" className={`${CARD} w-full px-4 py-3.5 flex items-center gap-[13px] hover:border-white/20 transition`}>
      <span className="shrink-0 w-[38px] h-[38px] rounded-full bg-white/[.07] border border-white/[.12] flex items-center justify-center text-white">
        <Footprints size={19} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-1.5">
        <span className={`block ${LABEL} tracking-[.09em]`}>Le mie scarpe</span>
        {principale ? (
          <>
            <span className="flex items-baseline gap-2">
              <span className="flex-1 min-w-0 text-[15px] font-bold text-white truncate">{`${principale.marca} ${principale.modello}`}</span>
              <span className="shrink-0 text-[12.5px] font-bold text-gray-300">{`${testoKm(principale.km)} km`}</span>
            </span>
            <BarraKm km={principale.km} soglia={principale.soglia_km} />
          </>
        ) : (
          <span className="text-[14px] font-bold text-white truncate">
            {attive.length ? `${attive.length} ${attive.length === 1 ? 'scarpa' : 'scarpe'}, nessuna principale` : 'Aggiungi le tue scarpe'}
          </span>
        )}
        {daCambiare > 0 && (
          <span className="text-[12px] font-bold text-red-500">
            {daCambiare === 1 ? 'Una scarpa è da cambiare' : `${daCambiare} scarpe sono da cambiare`}
          </span>
        )}
      </span>
      <ChevronRight size={17} className="shrink-0 text-muted" aria-hidden="true" />
    </Link>
  )
}

/**
 * L'interruttore «Rendila principale». È `role="switch"` con `aria-checked`,
 * come quello delle Impostazioni (che non si importa: porterebbe tutta
 * ImpostazioniUI in un chunk condiviso).
 */
function Interruttore({ attivo, onCambia, etichetta }) {
  return (
    <button type="button" role="switch" aria-checked={attivo} aria-label={etichetta}
      onClick={() => { vibraScelta(); onCambia() }}
      className={`shrink-0 w-[51px] h-[31px] rounded-full flex items-center p-0.5 transition-colors duration-200 ${
        attivo ? 'justify-end bg-brand shadow-[0_6px_12px_-4px_rgba(241,186,23,.5)]' : 'justify-start bg-white/10 border border-white/[.12]'}`}>
      <span aria-hidden="true"
        className={`w-[27px] h-[27px] rounded-full transition-colors ${attivo ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,.4)]' : 'bg-[#8b8f9c]'}`} />
    </button>
  )
}

/** Una pillola di filtro. */
export function Filtro({ attivo, onClick, children }) {
  return (
    <button type="button" aria-pressed={attivo} onClick={onClick}
      className={`shrink-0 min-h-9 px-3.5 rounded-full text-[13px] font-bold border transition ${
        attivo ? 'bg-brand text-black border-brand' : 'bg-white/[.04] text-gray-300 border-white/[.1] hover:border-white/25'}`}>
      {children}
    </button>
  )
}

/**
 * Il catalogo, già filtrato da chi lo usa. L'atleta ha «Ce l'ho» su ogni
 * modello; lo staff ha Modifica ed Elimina.
 */
export function ListaCatalogo({ modelli, staff, onCeLho, onModifica, onElimina }) {
  return (
    <ul aria-label="Catalogo" className="flex flex-col gap-2">
      {modelli.map(m => {
        const nome = `${m.marca} ${m.modello}`
        return (
          <li key={m.id} className="rounded-[16px] border border-white/[.07] bg-white/[.035] flex items-center gap-2 pl-4 pr-1.5 min-h-14">
            <span className="flex-1 min-w-0 py-2.5">
              <span className="block text-[11.5px] font-bold text-muted">{m.marca}</span>
              <span className="block text-[14.5px] font-extrabold text-white truncate">{m.modello}</span>
              {(etichettaTipo(m.tipo) || m.drop_mm != null) && (
                <span className="block text-[12px] font-medium text-muted mt-0.5">
                  {[etichettaTipo(m.tipo), m.drop_mm != null ? `drop ${String(m.drop_mm).replace('.', ',')} mm` : null].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            {staff ? (
              <>
                <button type="button" aria-label={`Modifica ${nome}`} onClick={() => onModifica(m)}
                  className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-muted hover:text-white">
                  <Pencil size={17} aria-hidden="true" />
                </button>
                <button type="button" aria-label={`Elimina ${nome}`} onClick={() => onElimina(m)}
                  className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-muted hover:text-red-500">
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </>
            ) : (
              <button type="button" aria-label={`Ce l'ho: ${nome}`} onClick={() => onCeLho(m)}
                className="shrink-0 min-h-9 px-3.5 rounded-full bg-white/[.07] border border-white/[.12] text-[13px] font-bold text-white hover:border-white/25 transition">
                Ce l'ho
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Le scarpe scritte a mano dagli atleti, per lo staff. */
export function ListaScritte({ gruppi, onAggiungi }) {
  return (
    <ul className="flex flex-col gap-2">
      {gruppi.map(g => (
        <li key={`${g.marca}|${g.modello}`} className="rounded-[16px] border border-white/[.07] bg-white/[.035] flex items-center gap-2 pl-4 pr-1.5 min-h-14">
          <span className="flex-1 min-w-0 py-2.5">
            <span className="block text-[11.5px] font-bold text-muted">{g.marca}</span>
            {/* Va a capo invece di troncarsi: il numero è la ragione della riga. */}
            <span className="block text-[14.5px] font-extrabold text-white break-words">
              {`${g.modello} · ${g.quante} ${g.quante === 1 ? 'atleta' : 'atleti'}`}
            </span>
          </span>
          <button type="button" onClick={() => onAggiungi(g)}
            className="shrink-0 min-h-9 px-3 rounded-full bg-white/[.07] border border-white/[.12] text-[12.5px] font-bold text-white hover:border-white/25 transition inline-flex items-center gap-1">
            <Plus size={15} aria-hidden="true" />Aggiungi al catalogo
          </button>
        </li>
      ))}
    </ul>
  )
}

const CAMPO = 'w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-[15px] font-bold text-white ' +
  'placeholder-[#5b6070] focus:outline-none focus:border-brand'

/** Un campo di testo con etichetta, e l'errore sotto quando c'è. */
function Campo({ etichetta, valore, onChange, errore, ...resto }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL}>{etichetta}</span>
      <input aria-label={etichetta} enterKeyHint="done" onKeyDown={chiudiTastieraSuInvio}
        value={valore} onChange={e => onChange(e.target.value)}
        aria-invalid={errore ? true : undefined}
        className={`${CAMPO} ${errore ? 'border-red-500' : ''}`} {...resto} />
      {errore && <span className="text-[12.5px] font-medium text-red-500">{errore}</span>}
    </label>
  )
}

/**
 * «Ce l'ho» / «Scrivila tu»: km di partenza e «rendila principale». Con
 * `modello` del catalogo marca e modello sono già scelti; senza si scrivono.
 * `onSalva(dati)` torna true se il foglio può chiudersi.
 * ⚠️ X «Chiudi» e «Annulla»: il tasto indietro di Android li trova.
 */
export function FoglioScarpa({ modello, principaleDiBase = false, onSalva, onChiudi }) {
  const sheet = useBottomSheet(onChiudi)
  const [marca, setMarca] = useState('')
  const [nomeModello, setNomeModello] = useState('')
  const [km, setKm] = useState('')
  const [principale, setPrincipale] = useState(principaleDiBase)
  const [salvando, setSalvando] = useState(false)
  const kmValidi = numeroKm(km) !== null
  const completa = modello ? true : marca.trim() && nomeModello.trim()
  const puoSalvare = kmValidi && completa && !salvando

  const salva = async () => {
    if (!puoSalvare) return
    setSalvando(true)
    const ok = await onSalva({ marca: marca.trim(), modello: nomeModello.trim(), kmIniziali: km, principale })
    if (ok) sheet.chiudi()
    else setSalvando(false)
  }

  return (
    <Foglio titolo={modello ? `${modello.marca} ${modello.modello}` : 'Scrivila tu'} {...sheet}>
      <div className="flex flex-col gap-3.5 pb-1">
        {!modello && (
          <>
            <Campo etichetta="Marca" valore={marca} onChange={setMarca} maxLength={60} />
            <Campo etichetta="Modello" valore={nomeModello} onChange={setNomeModello} maxLength={80} />
          </>
        )}
        <Campo etichetta="Km di partenza" valore={km} onChange={setKm} inputMode="decimal" placeholder="0"
          errore={kmValidi ? null : 'Scrivi i km come numero, per esempio 350.'} />
        <div className="flex items-center gap-3">
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-white">Rendila principale</span>
            <span className="block text-[12.5px] font-medium text-muted">Si lega da sola alle corse che completi.</span>
          </span>
          <Interruttore etichetta="Rendila principale" attivo={principale} onCambia={() => setPrincipale(v => !v)} />
        </div>
        <div className="flex gap-3 mt-1">
          <button type="button" onClick={sheet.chiudi} className={BOTTONE_QUIETO}>Annulla</button>
          <button type="button" onClick={salva} disabled={!puoSalvare} className={BOTTONE_BRAND}>Salva</button>
        </div>
      </div>
    </Foglio>
  )
}

/**
 * Nuovo modello o modifica di uno del catalogo (solo staff). Il drop è
 * facoltativo, ma se è scritto deve essere un numero: un «zero» a parole non
 * diventa un vuoto in silenzio.
 * `iniziale`: il modello da modificare (con `id`) o i valori di partenza (da
 * «Scritte dagli atleti», senza `id`).
 */
export function FoglioModelloCatalogo({ iniziale, onSalva, onChiudi }) {
  const sheet = useBottomSheet(onChiudi)
  const modifica = !!iniziale?.id
  const [marca, setMarca] = useState(iniziale?.marca ?? '')
  const [modello, setModello] = useState(iniziale?.modello ?? '')
  const [tipo, setTipo] = useState(iniziale?.tipo ?? '')
  const [drop, setDrop] = useState(iniziale?.drop_mm != null ? String(iniziale.drop_mm).replace('.', ',') : '')
  const [salvando, setSalvando] = useState(false)
  const dropVuoto = drop.trim() === ''
  const dropNumero = dropVuoto ? null : numeroKm(drop)
  const dropValido = dropVuoto || dropNumero !== null
  const puoSalvare = marca.trim() && modello.trim() && dropValido && !salvando

  const salva = async () => {
    if (!puoSalvare) return
    setSalvando(true)
    const ok = await onSalva({ marca: marca.trim(), modello: modello.trim(), tipo: tipo || null, drop_mm: dropNumero })
    if (ok) sheet.chiudi()
    else setSalvando(false)
  }

  return (
    <Foglio titolo={modifica ? 'Modifica modello' : 'Nuovo modello'} {...sheet}>
      <div className="flex flex-col gap-3.5 pb-1">
        <Campo etichetta="Marca" valore={marca} onChange={setMarca} maxLength={60} />
        <Campo etichetta="Modello" valore={modello} onChange={setModello} maxLength={80} />
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Tipo</span>
          <div className="flex flex-wrap gap-2">
            {TIPI_SCARPA.map(t => (
              <Filtro key={t.valore} attivo={tipo === t.valore} onClick={() => setTipo(v => (v === t.valore ? '' : t.valore))}>
                {t.etichetta}
              </Filtro>
            ))}
          </div>
        </div>
        <Campo etichetta="Drop (mm)" valore={drop} onChange={setDrop} inputMode="decimal" placeholder="Facoltativo"
          errore={dropValido ? null : 'Il drop è un numero di millimetri, per esempio 8.'} />
        <div className="flex gap-3 mt-1">
          <button type="button" onClick={sheet.chiudi} className={BOTTONE_QUIETO}>Annulla</button>
          <button type="button" onClick={salva} disabled={!puoSalvare} className={BOTTONE_BRAND}>Salva</button>
        </div>
      </div>
    </Foglio>
  )
}
