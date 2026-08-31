// ArchivioUI.jsx — i pezzi visivi dell'archivio dei workout.
//
// Stesso patto di HomeAtletaUI, HomeCoachUI, CreaWorkoutUI, WorkoutDetailUI e
// SchedaAtletaUI: SOLA PRESENTAZIONE. Ricevono testo già formattato e callback
// già esistenti. Se qui dentro compare una `supabase`, un `useEffect` di rete o
// una regola su quanto dura un blocco, è finito nel file sbagliato — quella
// roba sta in `src/lib/rigaArchivio.js`.
//
// Il rework in una riga: la pagina apriva con TRE righe di intestazione (il
// logo FLEOFIT, un secondo h1 «Archivio Workout» e un sottotitolo che lo
// ripeteva) prima di far vedere un solo workout, su una schermata che si
// raggiunge già da un link chiamato «Archivio». Ora l'intestazione è una riga
// sola e porta un numero, e sotto di essa i filtri restano fermi mentre la
// lista scorre.

import { ChevronLeft, ChevronRight, Search, Users, Check, X } from 'lucide-react'
import { CARTA_RIGA, VETRO } from '../lib/stiliCard'
import { corsia } from '../lib/categorie'

// ── Testata ───────────────────────────────────────────────────────────────

/**
 * La testata, con la ricerca e i filtri sotto di sé: tutto il blocco resta
 * appiccicato in cima mentre la lista scorre.
 *
 * ⚠️ È appiccicato perché su una schermata di sola lista i filtri sono
 * l'unico comando che c'è: se scorrono via, per cambiare corsia si deve
 * risalire tutto lo scroll che si è appena fatto — cioè proprio quando la
 * lista è lunga, che è l'unico caso in cui filtrare serve.
 *
 * ⚠️ La safe area la porta QUESTO elemento, non la pagina: un `pt` sul
 * contenitore lascerebbe scorrere il contenuto sotto la barra di stato,
 * perché l'elemento appiccicato si ferma a `top-0`.
 */
export function TestataArchivio({ onIndietro, dettaglio, children }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 pt-[calc(env(safe-area-inset-top)+0.875rem)] pb-3
                    bg-[#0B0B0B]/85 backdrop-blur-xl border-b border-white/[.06]">
      <div className="flex items-center gap-3">
        <button aria-label="Torna indietro" onClick={onIndietro}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-200
                      hover:text-white transition shrink-0 ${VETRO}`}>
          <ChevronLeft size={19} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black tracking-[-.03em] text-white leading-none">Archivio</h1>
          {dettaglio && (
            <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[.1em] text-muted leading-none">
              {dettaglio}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

/**
 * Il campo di ricerca. L'icona sta a sinistra, dove si guarda per prima.
 *
 * ⚠️ Lo usa anche la rubrica atleti, ed è il motivo per cui il testo è
 * parametrico invece che scritto qui dentro: una seconda copia sarebbe il modo
 * in cui i due campi cominciano a divergere di un raggio o di un focus (§9
 * punto 1). I default restano quelli dell'archivio, così il suo chiamante non
 * cambia.
 */
export function CampoRicerca({
  valore, onCambia,
  etichetta = "Cerca nell'archivio",
  placeholder = 'Cerca titolo, blocco, esercizio',
}) {
  return (
    <div className="relative mt-3.5">
      <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        type="search"
        aria-label={etichetta}
        placeholder={placeholder}
        value={valore}
        onChange={e => onCambia(e.target.value)}
        className="w-full bg-black/50 border border-white/[.08] rounded-[14px] py-2.5 pl-10 pr-9
                   text-[15px] font-medium text-white placeholder:text-[#6b7080]
                   shadow-[inset_0_1px_0_rgba(255,255,255,.04)]
                   focus:outline-none focus:border-brand/60 transition"
      />
      {valore && (
        <button aria-label="Cancella la ricerca" onClick={() => onCambia('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full
                     flex items-center justify-center text-muted hover:text-white transition">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/**
 * I chip di corsia. Riducono con un tocco quello che prima si poteva ridurre
 * solo digitando il titolo esatto.
 *
 * ⚠️ La fila scorre in orizzontale e NON va a capo: con quattro corsie ci sta,
 * ma il giorno in cui ne compare una quinta una fila che va a capo farebbe
 * saltare l'altezza della testata appiccicata, e con essa il punto in cui la
 * lista comincia.
 */
export function FiltriCorsia({ corsie, attiva, totale, onCambia }) {
  return (
    <div role="group" aria-label="Filtra per categoria"
      className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar">
      <ChipCorsia etichetta="Tutti" conteggio={totale} attivo={attiva === null}
        onClick={() => onCambia(null)} />
      {corsie.map(({ categoria, n }) => (
        <ChipCorsia key={categoria} etichetta={corsia(categoria).etichetta} conteggio={n}
          punto={corsia(categoria).dot} attivo={attiva === categoria}
          onClick={() => onCambia(attiva === categoria ? null : categoria)} />
      ))}
    </div>
  )
}

function ChipCorsia({ etichetta, conteggio, punto, attivo, onClick }) {
  return (
    <button onClick={onClick} aria-pressed={attivo}
      className={`shrink-0 inline-flex items-center gap-1.5 pl-3 pr-3 py-1.5 rounded-full
                  text-[13px] transition ${attivo
        ? 'bg-brand text-black font-black tracking-[-.01em] shadow-[0_8px_18px_-8px_rgba(241,186,23,.6)]'
        : 'bg-white/[.05] border border-white/[.09] text-gray-200 font-bold hover:bg-white/[.08]'}`}>
      {punto && !attivo && <span className={`w-1.5 h-1.5 rounded-full ${punto}`} />}
      {etichetta}
      <span className={attivo ? 'font-extrabold opacity-60' : 'text-muted font-bold'}>{conteggio}</span>
    </button>
  )
}

// ── La lista ──────────────────────────────────────────────────────────────

/**
 * L'intestazione di un gruppo: nell'archivio è il mese, nella rubrica atleti è
 * lo stato. È la struttura dello scroll, ed è la stessa riga in entrambi i
 * casi — etichetta, filo, conteggio.
 *
 * ⚠️ NON è appiccicata, e non è una dimenticanza. Sarebbe dovuta stare
 * `top-<altezza della testata>`, ma quell'altezza cambia — il sottotitolo può
 * mancare, i chip possono essere due o cinque — e un `top` sbagliato non dà
 * errore: incolla l'intestazione a metà dei filtri, o la lascia scorrere
 * sotto di essi. Il gruppo dà già la struttura; a dire dove si è basta lui.
 */
export function IntestazioneSezione({ etichetta, conteggio }) {
  return (
    <div className="flex items-center gap-2.5 px-0.5 pt-3.5 pb-1.5">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[.14em] text-white leading-none">
        {etichetta}
      </span>
      <span className="flex-1 h-px bg-white/[.08]" />
      <span className="font-mono text-[11px] font-bold tracking-[.1em] text-muted leading-none">
        {conteggio}
      </span>
    </div>
  )
}

/**
 * Una riga dell'archivio.
 *
 * ⚠️ La categoria è la SPINA colorata a sinistra, non un chip di testo: è la
 * stessa Regola della Corsia del builder e della scheda, e la spina costa 3px
 * là dove il chip ne costava novanta — novanta pixel presi al titolo, che è
 * l'unica cosa per cui si scorre un archivio.
 *
 * `assegnati` e `completato` si escludono: il coach guarda a quante persone
 * ha dato questo workout, l'atleta se l'ha fatto. Sono la stessa colonna e due
 * domande diverse, ed è il ruolo di chi guarda a decidere quale — come il
 * verso della nota vocale in `WorkoutDetail` (§9-duodecies punto 7).
 */
export function RigaWorkout({ categoria, titolo, meta, assegnati, completato, onApri }) {
  const c = corsia(categoria)
  return (
    <button onClick={onApri}
      className={`${CARTA_RIGA} w-full text-left px-3.5 py-3 flex items-center gap-3
                  hover:border-white/[.14] transition`}>
      <span className={`w-[3px] self-stretch rounded-full shrink-0 ${c.bg}`} />
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-bold tracking-[-.01em] text-white truncate">
          {titolo}
        </span>
        {meta && (
          <span className="block mt-[3px] font-mono text-[12px] font-medium text-muted leading-none truncate">
            {meta}
          </span>
        )}
      </span>
      <span className="shrink-0 flex items-center gap-2.5">
        {assegnati !== undefined && (
          <span className="flex items-center gap-1 text-gray-200"
            title={`Assegnato a ${assegnati} ${assegnati === 1 ? 'atleta' : 'atleti'}`}>
            <Users size={13} className="text-[#5b6070]" aria-hidden="true" />
            <span className="text-sm font-black tracking-[-.02em]">{assegnati}</span>
            <span className="sr-only">
              assegnato a {assegnati} {assegnati === 1 ? 'atleta' : 'atleti'}
            </span>
          </span>
        )}
        {completato && (
          <span className="w-[22px] h-[22px] rounded-full bg-green-500/15 border border-green-500/30
                           flex items-center justify-center text-green-500">
            <Check size={13} strokeWidth={3} aria-hidden="true" />
            <span className="sr-only">completato</span>
          </span>
        )}
        <ChevronRight size={16} className="text-[#4f5462]" aria-hidden="true" />
      </span>
    </button>
  )
}

/** Le righe finte del caricamento: la lista non salta quando i dati arrivano. */
export function ScheletroArchivio() {
  return (
    <div className="flex flex-col gap-2 pt-4" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <div key={i} className={`${CARTA_RIGA} h-[60px] animate-pulse`} />
      ))}
    </div>
  )
}

/**
 * Il vuoto. Sono due vuoti diversi: un archivio davvero vuoto è uno stato
 * normale del prodotto, una ricerca senza esiti è un vicolo cieco — e da un
 * vicolo cieco serve la via d'uscita, cioè il bottone che azzera i filtri.
 */
export function VuotoArchivio({ conFiltri, onAzzera }) {
  return (
    <div className="mt-6 text-center px-6 py-10 rounded-3xl border border-dashed border-white/[.12]">
      <p className="text-gray-300 font-bold">
        {conFiltri ? 'Nessun workout con questi filtri' : 'Nessun workout in archivio'}
      </p>
      <p className="mt-1.5 text-sm text-muted">
        {conFiltri
          ? 'Prova con un altro termine, o togli il filtro di corsia.'
          : 'Gli allenamenti che crei finiscono qui. 🏋️'}
      </p>
      {conFiltri && (
        <button onClick={onAzzera}
          className={`mt-5 px-4 py-2 rounded-xl text-sm font-bold text-white transition
                      hover:bg-white/[.12] ${VETRO}`}>
          Azzera i filtri
        </button>
      )}
    </div>
  )
}
