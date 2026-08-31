// AtletiUI.jsx — i pezzi visivi della rubrica atleti.
//
// Stesso patto di HomeAtletaUI, HomeCoachUI, CreaWorkoutUI, WorkoutDetailUI,
// SchedaAtletaUI e ArchivioUI: SOLA PRESENTAZIONE. Ricevono testo già
// formattato e callback già esistenti. Se qui dentro compare una `supabase`,
// un `useEffect` di rete o una regola su quanti giorni fa un atleta è fermo, è
// finito nel file sbagliato — quella roba sta in `src/lib/rigaAtleta.js` e in
// `src/lib/statisticheCoach.js`.
//
// Il rework in una riga: la riga diceva peso, altezza ed età — dati che si
// consultano una volta al mese — e taceva l'unica cosa per cui il coach apre
// questa schermata, cioè chi sta seguendo il piano e chi si è fermato.

import { useState } from 'react'
import { ChevronRight, Plus, Trash2, Pause, User, RotateCcw } from 'lucide-react'
import { CARTA_RIGA, VETRO } from '../lib/stiliCard'

// ── Testata ───────────────────────────────────────────────────────────────

/**
 * La testata, con la ricerca e i chip sotto di sé: tutto il blocco resta
 * appiccicato in cima mentre la lista scorre.
 *
 * ⚠️ Niente «indietro», e non è una dimenticanza: `Atleti` è una voce della
 * navbar, non una pagina in cui si è entrati da qualche parte — vale la stessa
 * regola di `/profile` in `SchedaAtletaUI`.
 *
 * ⚠️ La safe area la porta QUESTO elemento, non la pagina: un `pt` sul
 * contenitore lascerebbe scorrere il contenuto sotto la barra di stato, perché
 * l'elemento appiccicato si ferma a `top-0`.
 */
export function TestataAtleti({ dettaglio, onNuovo, children }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 pt-[calc(env(safe-area-inset-top)+0.875rem)] pb-3
                    bg-[#0B0B0B]/85 backdrop-blur-xl border-b border-white/[.06]">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black tracking-[-.03em] text-white leading-none">Atleti</h1>
          {dettaglio && (
            <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[.1em] text-muted leading-none">
              {dettaglio}
            </p>
          )}
        </div>
        <button onClick={onNuovo}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-[13px] bg-brand text-black
                     text-sm font-black hover:brightness-110 transition
                     shadow-[0_10px_22px_-10px_rgba(241,186,23,.6),inset_0_1px_0_rgba(255,255,255,.35)]">
          <Plus size={17} strokeWidth={2.6} aria-hidden="true" /> Nuovo
        </button>
      </div>
      {children}
    </div>
  )
}

/**
 * I chip di stato. È qui che la pausa smette di essere un'etichetta persa in
 * mezzo agli attivi e diventa una vista, e che il cestino esce dall'accordion
 * in fondo alla pagina.
 *
 * ⚠️ La fila scorre in orizzontale e non va a capo: una fila che va a capo
 * farebbe saltare l'altezza della testata appiccicata, e con essa il punto in
 * cui la lista comincia.
 */
export function FiltriStato({ conteggi, vista, onCambia }) {
  return (
    <div role="group" aria-label="Filtra per stato" className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar">
      <ChipStato etichetta="Attivi" conteggio={conteggi.attivi}
        attivo={vista === 'attivi' || vista === 'fermi'} onClick={() => onCambia('attivi')} />
      {conteggi.pausa > 0 && (
        <ChipStato etichetta="In pausa" conteggio={conteggi.pausa} punto="bg-orange-500"
          attivo={vista === 'pausa'} onClick={() => onCambia(vista === 'pausa' ? 'attivi' : 'pausa')} />
      )}
      {conteggi.eliminati > 0 && (
        <ChipStato etichetta="Eliminati" soloIcona conteggio={conteggi.eliminati}
          attivo={vista === 'eliminati'} onClick={() => onCambia(vista === 'eliminati' ? 'attivi' : 'eliminati')} />
      )}
    </div>
  )
}

function ChipStato({ etichetta, conteggio, punto, soloIcona, attivo, onClick }) {
  return (
    <button onClick={onClick} aria-pressed={attivo}
      aria-label={soloIcona ? `${etichetta} (${conteggio})` : undefined}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] transition ${attivo
        ? 'bg-brand text-black font-black tracking-[-.01em] shadow-[0_8px_18px_-8px_rgba(241,186,23,.6)]'
        : 'bg-white/[.05] border border-white/[.09] text-gray-200 font-bold hover:bg-white/[.08]'}`}>
      {punto && !attivo && <span className={`w-1.5 h-1.5 rounded-full ${punto}`} aria-hidden="true" />}
      {soloIcona
        ? <Trash2 size={13} className={attivo ? 'text-black' : 'text-muted'} aria-hidden="true" />
        : etichetta}
      <span className={attivo ? 'font-extrabold opacity-60' : 'text-muted font-bold'}>{conteggio}</span>
    </button>
  )
}

/**
 * La fascia «Da richiamare»: gli atleti senza un allenamento completato da
 * troppo tempo.
 *
 * È l'unico blocco con bordo colorato della pagina, ed è voluto — una seconda
 * cornice arancione la renderebbe atmosfera invece che allarme. Porta alla
 * lista già filtrata: un allarme che non ha una destinazione è una decorazione.
 */
export function FasciaRichiamo({ testo, attiva, onApri }) {
  return (
    <button onClick={onApri} aria-pressed={attiva}
      className={`w-full text-left mt-4 rounded-[18px] px-4 py-3.5 flex items-center gap-3.5 transition
                  bg-gradient-to-r from-orange-500/10 to-orange-500/[.02]
                  shadow-[inset_0_1px_0_rgba(255,255,255,.05)]
                  ${attiva ? 'border-2 border-orange-500/60' : 'border border-orange-500/[.28] hover:border-orange-500/50'}`}>
      <span className="flex-1 min-w-0">
        <span className="block font-mono text-[11px] font-bold uppercase tracking-[.1em] text-orange-400 leading-none">
          Da richiamare
        </span>
        <span className="block mt-1.5 text-sm font-bold tracking-[-.01em] text-white">{testo}</span>
      </span>
      <ChevronRight size={17} className={`shrink-0 text-orange-400 transition-transform ${attiva ? 'rotate-90' : ''}`}
        aria-hidden="true" />
    </button>
  )
}

// ── L'avatar ──────────────────────────────────────────────────────────────

/**
 * Iniziali su superficie tonale con hairline chiara quando la foto manca.
 *
 * ⚠️ Il ripiego sulla foto rotta vive QUI, non nello stato della pagina: prima
 * un `onError` riscriveva l'intero array degli atleti per azzerare una
 * `photo_url`, cioè un fetch andato bene veniva corretto da un errore di
 * rendering. Un'immagine che non carica è un fatto di questo componente.
 */
export function AvatarAtleta({ foto, sigla, spento = false, dimensione = 42 }) {
  const [rotta, setRotta] = useState(false)
  const stile = { width: dimensione, height: dimensione }
  const base = `rounded-full flex items-center justify-center overflow-hidden shrink-0 border ${spento
    ? 'bg-white/[.05] border-white/[.08] text-gray-400'
    : 'bg-white/[.07] border-white/[.1] text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]'}`

  if (foto && !rotta) {
    return (
      <span className={base} style={stile}>
        <img src={foto} alt="" className={`w-full h-full object-cover ${spento ? 'opacity-60' : ''}`}
          onError={() => setRotta(true)} />
      </span>
    )
  }
  return (
    <span className={`${base} text-sm font-black tracking-[-.02em]`} style={stile} aria-hidden="true">
      {sigla === '?' ? <User size={19} /> : sigla}
    </span>
  )
}

// ── Le righe ──────────────────────────────────────────────────────────────

/**
 * Una riga della rubrica.
 *
 * ⚠️ `fermo` colora la frazione, e viene da `atletiFermi` — NON dal fatto che
 * i completati siano zero. Gli assegnati comprendono i giorni ancora da venire
 * della settimana, quindi il lunedì mattina sono tutti a 0/N: legare il colore
 * alla frazione dipingerebbe di arancione l'intera rubrica ogni lunedì, cioè
 * un allarme che si accende quando non è successo niente.
 */
export function RigaAtleta({ nome, meta, foto, sigla, aderenza, fermo, onApri }) {
  return (
    <button onClick={onApri}
      className={`${CARTA_RIGA} w-full text-left px-3.5 py-3 flex items-center gap-3
                  hover:border-white/[.14] transition`}>
      <AvatarAtleta foto={foto} sigla={sigla} />
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-bold tracking-[-.01em] text-white truncate">{nome}</span>
        {meta && (
          <span className="block mt-[3px] font-mono text-[12px] font-medium text-muted leading-none truncate">
            {meta}
          </span>
        )}
      </span>
      <Aderenza {...aderenza} allarme={fermo} />
      <ChevronRight size={16} className="text-[#4f5462] shrink-0" aria-hidden="true" />
    </button>
  )
}

/**
 * Completati su assegnati della settimana, con una tacca per allenamento
 * previsto: piena se fatto, vuota se manca. Un solo dato, leggibile in mezzo
 * secondo.
 *
 * ⚠️ Chi non ha niente in programma scrive «—», non «0/0». Un atleta senza
 * assegnazioni non è a zero di aderenza: non c'è ancora niente da misurare, e
 * «0/0» con la barra vuota si legge come un fallimento. È la stessa regola di
 * `DurataBlocco` e di `rpeAtteso` — un ripiego travestito da misura è peggio
 * di un trattino.
 */
function Aderenza({ assegnati, completati, tacche, compresso, quota, allarme }) {
  if (!assegnati) {
    return (
      <span className="shrink-0 font-mono text-[13px] font-bold text-[#4f5462]"
        title="Niente in programma questa settimana">
        —<span className="sr-only">niente in programma questa settimana</span>
      </span>
    )
  }
  return (
    <span className="shrink-0 flex flex-col items-end gap-1.5">
      {/* ⚠️ L'allarme è nell'etichetta, non solo nel colore: chi legge con
          VoiceOver non ha modo di sapere che questa frazione è arancione, e
          «da richiamare» è l'unica informazione della riga che chiede un'azione. */}
      <span className="text-[13.5px] font-black tracking-[-.02em] leading-none"
        aria-label={`${completati} di ${assegnati} allenamenti completati questa settimana`
          + (allarme ? ' · da richiamare' : '')}>
        <span className={allarme ? 'text-orange-400' : 'text-white'}>{completati}</span>
        <span className="text-muted font-extrabold">/{assegnati}</span>
      </span>
      {compresso ? (
        // Oltre MASSIMO_TACCHE le tacche non ci starebbero: la stessa quota in
        // larghezza fissa dice quanto manca senza mangiare il nome.
        <span className="w-[46px] h-1 rounded-full bg-white/[.13] overflow-hidden" aria-hidden="true">
          <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.round(quota * 100)}%` }} />
        </span>
      ) : (
        <span className="flex gap-[3px]" aria-hidden="true">
          {tacche.map((piena, i) => (
            <span key={i} className={`w-2 h-1 rounded-full ${piena ? 'bg-brand' : 'bg-white/[.13]'}`} />
          ))}
        </span>
      )}
    </span>
  )
}

/**
 * La riga di un atleta in pausa: stessa struttura, peso visivo tolto.
 *
 * ⚠️ Resta nella rubrica di proposito (CLAUDE.md §9-decies): è l'unico posto in
 * cui il coach si accorge di averne messo in pausa uno e dimenticato. Sparisce
 * dagli allarmi, non dalla lista — e qui non si misura aderenza, perché
 * misurare il piano di chi ha chiesto di fermarsi è la domanda sbagliata.
 */
export function RigaPausa({ nome, dettaglio, foto, sigla, onApri }) {
  return (
    <button onClick={onApri}
      className="w-full text-left rounded-2xl px-3.5 py-3 flex items-center gap-3
                 bg-white/[.028] border border-white/[.06] hover:bg-white/[.05] transition">
      <AvatarAtleta foto={foto} sigla={sigla} spento />
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-bold text-gray-300 truncate">{nome}</span>
        {/* Solo quando c'è la data: senza, la seconda riga direbbe «In pausa»
            sotto una pillola che dice già «Pausa». */}
        {dettaglio && (
          <span className="block mt-[3px] font-mono text-[12px] font-medium text-muted leading-none truncate">
            {dettaglio}
          </span>
        )}
      </span>
      <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                       bg-orange-500/[.12] border border-orange-500/30 text-orange-400
                       text-[11px] font-extrabold uppercase tracking-[.04em]">
        <Pause size={11} strokeWidth={2.6} aria-hidden="true" />Pausa
      </span>
    </button>
  )
}

/**
 * Una riga del cestino, con il conto alla rovescia.
 *
 * Il testo non è ammorbidito: dopo la scadenza il cron cancella l'atleta con
 * tutto il suo storico — workout assegnati, record personali, log — e il backup
 * di quella notte gira PRIMA, quindi da lì in poi non c'è più modo di
 * recuperarlo.
 */
export function RigaEliminato({ nome, foto, sigla, giorni, onRipristina }) {
  const urgente = giorni <= 2
  return (
    <div className="rounded-2xl px-3.5 py-3 flex items-center gap-3
                    bg-white/[.028] border border-dashed border-white/[.12]">
      <AvatarAtleta foto={foto} sigla={sigla} spento />
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold text-gray-300 truncate">{nome}</p>
        <p className={`mt-[3px] font-mono text-[12px] font-medium leading-none truncate
                       ${urgente ? 'text-red-400' : 'text-muted'}`}>
          {/* ⚠️ Corto di proposito. «Cancellazione fra 5 giorni» accanto al
              bottone Ripristina, su 393px, finisce troncato in «Cancellazione
              fra 5…» — e il numero tagliato è l'unica cosa per cui si apre
              questa vista: «fra 1…» e «fra 10…» diventano la stessa riga.
              Cosa sia il conto lo dice l'intestazione della sezione. */}
          {giorni === 0 ? 'Stanotte' : `Fra ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`}
        </p>
      </div>
      <button onClick={onRipristina}
        className={`shrink-0 inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-xl
                    text-sm font-bold text-white hover:bg-white/[.12] transition ${VETRO}`}>
        <RotateCcw size={14} aria-hidden="true" /> Ripristina
      </button>
    </div>
  )
}

// ── Stati vuoti ───────────────────────────────────────────────────────────

/** Le righe finte del caricamento: la lista non salta quando i dati arrivano. */
export function ScheletroAtleti() {
  return (
    <div className="flex flex-col gap-2 pt-4" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={`${CARTA_RIGA} h-[66px] animate-pulse`} />)}
    </div>
  )
}

/**
 * Il vuoto. Sono due vuoti diversi: una rubrica davvero vuota è uno stato
 * normale del prodotto e chiede il primo atleta, una ricerca senza esiti è un
 * vicolo cieco — e da un vicolo cieco serve la via d'uscita.
 */
export function VuotoAtleti({ titolo, dettaglio, azione, onAzione }) {
  return (
    <div className="mt-6 text-center px-6 py-10 rounded-3xl border border-dashed border-white/[.12]">
      <p className="text-gray-300 font-bold">{titolo}</p>
      {dettaglio && <p className="mt-1.5 text-sm text-muted">{dettaglio}</p>}
      {azione && (
        <button onClick={onAzione}
          className={`mt-5 px-4 py-2 rounded-xl text-sm font-bold text-white transition
                      hover:bg-white/[.12] ${VETRO}`}>
          {azione}
        </button>
      )}
    </div>
  )
}
