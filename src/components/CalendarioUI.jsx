// CalendarioUI.jsx — i pezzi visivi del calendario.
//
// Stesso patto di HomeAtletaUI, HomeCoachUI, CreaWorkoutUI, WorkoutDetailUI,
// SchedaAtletaUI, ArchivioUI e AtletiUI: SOLA PRESENTAZIONE. Ricevono testo già
// formattato e callback già esistenti. Se qui dentro compare una `supabase`, un
// `useEffect` di rete o una regola su quanto dura un blocco, è finito nel file
// sbagliato — quella roba sta in `src/lib/rigaCalendario.js`.
//
// Il rework in una riga: la griglia trasmetteva un solo bit per giorno («ci
// sono pallini o non ce ne sono»). Ora ogni cella porta il numero e una
// barra-corsia sotto, colorata per categoria e verde se l'allenamento è
// chiuso: il mese si legge come un pattern di carico invece che come puntini.

import { ChevronLeft, ChevronRight, Plus, Search, Check } from 'lucide-react'
import { CARD, CARTA_RIGA, CARTA_RIGA_BASE, LABEL, RIGA, VETRO } from '../lib/stiliCard'
import { corsia } from '../lib/categorie'
import { coloreCategoria } from '../lib/colori'

/**
 * Il verde di «fatto».
 *
 * ⚠️ È qui e non in `lib/colori.js` perché quel file tiene i colori del
 * MARCHIO, ed è legato ai token di `index.css` da un test che verifica che i
 * due elenchi non divergano. Questo è `green-500` di Tailwind, cioè il colore
 * di successo del §6, e serve in forma di valore perché finisce in uno `style`
 * inline: la barra di una cella porta un colore di categoria arbitrario, e una
 * classe non può esprimerlo.
 */
const VERDE = '#22c55e'

// ── Testata ───────────────────────────────────────────────────────────────

/**
 * La testata: il mese in grande, l'anno nell'occhiello sopra, e due soli
 * comandi.
 *
 * ⚠️ Erano CINQUE bottoni tutti della stessa dimensione — precedente, Oggi,
 * successivo, cerca, aggiungi — più due titoli sopra di essi (il logo FLEOFIT
 * e il mese). L'unico comando irreversibile era l'unico giallo, ma stava in
 * fila con gli altri come se pesasse uguale. Il logo è sparito: in una pagina
 * raggiunta da una voce di navbar chiamata «Calendario» non dice niente.
 */
export function TestataCalendario({ mese, anno, onCerca, onNuovo }) {
  return (
    <div className="flex items-center justify-between px-0.5 pt-1.5 pb-0.5">
      <div>
        <p className={`${LABEL} font-mono tracking-[.12em] leading-none mb-[3px]`}>Calendario · {anno}</p>
        <h1 className="text-[26px] font-black tracking-[-.03em] text-white leading-none">{mese}</h1>
      </div>
      <div className="flex gap-2">
        <button aria-label="Cerca nell'archivio workout" onClick={onCerca}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-200
                      hover:text-white transition ${VETRO}`}>
          <Search size={18} />
        </button>
        <button aria-label="Aggiungi un evento o una gara" onClick={onNuovo}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-brand text-black
                     shadow-[0_10px_22px_-8px_rgba(241,186,23,.5),inset_0_1px_0_rgba(255,255,255,.35)]
                     hover:brightness-110 transition">
          <Plus size={19} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  )
}

// ── La carta del mese ─────────────────────────────────────────────────────

/** La carta che tiene insieme navigazione, legenda, griglia e sintesi. */
export function CardMese({ children }) {
  return <div className={`${CARD} p-4 pb-[18px]`}>{children}</div>
}

/**
 * Precedente / successivo, e «Oggi» solo quando serve.
 *
 * ⚠️ L'artboard toglie «Oggi» insieme agli altri tre bottoni, ma toglierlo del
 * tutto è una regressione: da tre mesi avanti si torna al giorno corrente in
 * tre tocchi invece che in uno. Qui compare SOLO quando il mese mostrato non è
 * quello corrente — cioè esattamente quando serve, e senza occupare posto
 * nell'unico caso in cui non servirebbe a niente.
 */
export function NavMese({ onPrecedente, onSuccessivo, onOggi, mostraOggi }) {
  return (
    <div className="flex items-center justify-between mb-3.5">
      <div className="flex gap-1.5">
        <BottoneNav etichetta="Mese precedente" onClick={onPrecedente}><ChevronLeft size={17} /></BottoneNav>
        <BottoneNav etichetta="Mese successivo" onClick={onSuccessivo}><ChevronRight size={17} /></BottoneNav>
      </div>
      {mostraOggi && (
        <button onClick={onOggi}
          className="px-3 h-[34px] rounded-[11px] font-mono text-[11px] font-bold uppercase
                     tracking-[.1em] text-brand hover:bg-brand/10 transition">
          Oggi
        </button>
      )}
    </div>
  )
}

function BottoneNav({ etichetta, onClick, children }) {
  return (
    <button aria-label={etichetta} onClick={onClick}
      className="w-[34px] h-[34px] rounded-[11px] bg-white/[.06] border border-white/[.09]
                 flex items-center justify-center text-[#c7cad3] hover:text-white
                 hover:bg-white/[.1] transition">
      {children}
    </button>
  )
}

/**
 * La legenda dei colori presenti nel mese.
 *
 * 🔴 Si DERIVA dai dati, non si scrive a mano. Un mese senza gare non ha
 * bisogno di una voce «Gara»: sarebbe la chiave di lettura di un colore che
 * non compare in nessuna cella, cioè la stessa trappola dei chip fissi
 * dell'archivio (§9-sedecies punto 2). Sotto le due voci non compare affatto:
 * con un colore solo non c'è niente da distinguere.
 *
 * ⚠️ Scorre in orizzontale e non va a capo: su 393px cinque voci ci stanno
 * strette, e una fila che va a capo farebbe saltare l'altezza della carta —
 * cioè il punto in cui la griglia comincia — a seconda dei dati del mese.
 *
 * ⚠️ NON è `aria-hidden`. I quadratini colorati lo sono — un colore non si
 * legge ad alta voce — ma l'elenco delle etichette dice quali corsie il mese
 * contiene, ed è un'informazione che altrimenti esisterebbe solo come colore.
 */
export function LegendaCorsie({ voci }) {
  if (voci.length < 2) return null
  return (
    <div role="group" aria-label="Legenda del mese"
      className="flex gap-3.5 mb-2.5 overflow-x-auto hide-scrollbar">
      {voci.map(({ chiave, etichetta, colore }) => (
        <span key={chiave} className="shrink-0 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-[3px]" style={{ backgroundColor: colore }} aria-hidden="true" />
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[.06em] text-muted leading-none">
            {etichetta}
          </span>
        </span>
      ))}
    </div>
  )
}

const GIORNI_SETTIMANA = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

/** La griglia del mese. Le celle vuote in testa tengono l'allineamento. */
export function GrigliaMese({ vuote, celle }) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1.5" aria-hidden="true">
        {GIORNI_SETTIMANA.map((g, i) => (
          <div key={i} className="text-center font-mono text-[10.5px] font-bold text-[#5b6070] py-1">{g}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: vuote }).map((_, i) => <div key={`v-${i}`} />)}
        {celle}
      </div>
    </div>
  )
}

/**
 * Una cella del mese: il numero e, sotto, la barra-corsia.
 *
 * 🔴 «Oggi» e «selezionato» sono DUE stati distinti e devono restare tali. Nel
 * calendario di prima erano quasi lo stesso — un riempimento pieno contro un
 * grigio appena più chiaro — e aprendo la pagina il giorno corrente spariva
 * sotto la selezione. Qui oggi è un ANELLO (il contorno), il selezionato è il
 * riempimento giallo con l'ombra: possono coesistere sulla stessa cella senza
 * annullarsi.
 *
 * ⚠️ L'anello di oggi non è un colore di categoria, ed è deliberato: il bianco
 * è già la corsia «Gara», e usarlo come RIEMPIMENTO della barra per marcare
 * oggi renderebbe indistinguibili «oggi» e «oggi c'è una gara».
 *
 * ⚠️ La barra vuota resta renderizzata come segnaposto trasparente: senza, i
 * giorni senza allenamento avrebbero il numero centrato più in basso degli
 * altri, e la griglia ballerebbe riga per riga.
 */
export function CellaGiorno({ numero, segno, selezionato, oggi, etichetta, onClick }) {
  const attivo = segno.n > 0

  const sfondo = selezionato
    ? 'bg-brand shadow-[0_10px_22px_-8px_rgba(241,186,23,.6),inset_0_1px_0_rgba(255,255,255,.4)]'
    : segno.tuttiFatti ? 'bg-green-500/10'
    : attivo ? 'bg-white/[.04]'
    : 'hover:bg-white/[.03]'

  const testo = selezionato ? 'text-black font-black'
    : oggi ? 'text-white font-black'
    : attivo ? 'text-gray-200 font-bold'
    : 'text-[#6c7280] font-bold'

  return (
    <button onClick={onClick} aria-label={etichetta}
      aria-pressed={selezionato} {...(oggi ? { 'aria-current': 'date' } : {})}
      className={`aspect-square rounded-[13px] flex flex-col items-center justify-center gap-[5px]
                  transition ${sfondo} ${oggi && !selezionato ? 'ring-1 ring-white/25' : ''}`}>
      <span className={`text-[14.5px] leading-none ${testo}`}>{numero}</span>
      <BarraCorsia segmenti={segno.segmenti} suGiallo={selezionato} />
    </button>
  )
}

/**
 * La barra sotto il numero: un segmento per allenamento, colorato per corsia e
 * verde se chiuso.
 *
 * ⚠️ Sulla cella selezionata i segmenti diventano neri: il giallo pieno
 * cancellerebbe il giallo di Hyrox, e un segmento invisibile si legge come
 * «quel giorno non c'è niente». Il colore di corsia lo ridà la riga sotto, che
 * di quel giorno parla per esteso.
 */
function BarraCorsia({ segmenti, suGiallo }) {
  if (segmenti.length === 0) {
    return <span className="w-3.5 h-[3px] rounded-[2px] bg-transparent" />
  }
  return (
    <span className="flex gap-[2px] w-4 h-[3px]">
      {segmenti.map((s, i) => (
        <span key={i} className="flex-1 rounded-[2px]" style={{
          backgroundColor: suGiallo
            ? (s.fatto ? 'rgba(0,0,0,.75)' : 'rgba(0,0,0,.4)')
            : (s.fatto ? VERDE : coloreCategoria(s.categoria)),
        }} />
      ))}
    </span>
  )
}

/**
 * La fascia di sintesi in fondo alla carta: tre numeri che dicono com'è andato
 * il mese prima di doverlo leggere giorno per giorno.
 */
export function StrisciaMese({ celle }) {
  return (
    <div role="group" aria-label="Riepilogo del mese"
      className="flex items-stretch gap-2.5 mt-4 pt-3.5 border-t border-white/[.07]">
      {celle.map((c, i) => (
        <div key={c.etichetta} className="contents">
          {i > 0 && <span className="w-px bg-white/[.07]" />}
          <div className="flex-1 min-w-0">
            <p className={`${LABEL} font-mono leading-none`}>{c.etichetta}</p>
            <p className={`mt-[7px] text-[22px] font-black tracking-[-.03em] leading-none truncate
                           ${c.evidenzia ? 'text-brand' : 'text-white'}`}>
              {c.valore}
              {c.suffisso && (
                <span className="text-[12px] font-semibold text-muted">{c.suffisso}</span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Il giorno scelto ──────────────────────────────────────────────────────

/** La data del giorno scelto, con quanto contiene. */
export function IntestazioneGiorno({ data, riepilogo }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mt-4 mb-2.5">
      <h2 className="text-[15px] font-extrabold tracking-[-.01em] text-white">{data}</h2>
      {riepilogo && (
        <span className="font-mono text-[11px] font-bold uppercase tracking-[.1em] text-muted shrink-0">
          {riepilogo}
        </span>
      )}
    </div>
  )
}

/**
 * Una sessione del giorno.
 *
 * ⚠️ Le vecchie card riempivano lo spazio con i NOMI degli esercizi («Air
 * Squat», «Burpees», «4 blocchi») — cioè con il contenuto, che è la ragione per
 * cui si apre la scheda, non quella per cui si decide di aprirla. Qui la riga
 * porta i dati della decisione: quanto dura, quanti blocchi, com'è andata.
 *
 * `stato` esiste solo dove il dato esiste: la query del coach legge `workouts`,
 * che non ha una colonna di stato, quindi per lui non c'è nessun «da fare» da
 * mostrare — e inventarlo sarebbe peggio che tacerlo.
 *
 * 🔴 Il bordo ambra vuol dire «DA FARE», non «riga», ed è la differenza che si
 * vede solo guardando la pagina. Legandolo al semplice «non è chiuso» la lista
 * del coach diventava tutta ambra — un allenamento di corsa incorniciato di
 * giallo, contro la Regola della Corsia — e con essa spariva l'unica cosa che
 * quel bordo doveva distinguere. Dove nessuno stato esiste, nessuna riga si
 * distingue: è la risposta giusta, non l'assenza di una risposta.
 */
export function RigaSessione({ categoria, etichetta, titolo, meta, stato, onApri }) {
  const c = corsia(categoria)
  const chiuso = stato === 'fatto'
  const daFare = stato === 'da fare'

  // ⚠️ Il bordo si dichiara UNA volta, non si sovrascrive: `CARTA_RIGA` porta
  // già `border-white/[.07]`, e affiancargli `border-brand/20` non vince —
  // stessa specificità, decide l'ordine nel foglio di stile. Da qui
  // `CARTA_RIGA_BASE`, che l'impasto lo dà senza il contorno.
  const superficie = chiuso
    ? `${RIGA} hover:bg-white/[.06]`
    : daFare
      ? `${CARTA_RIGA_BASE} border border-brand/25 hover:border-brand/45`
      : `${CARTA_RIGA} hover:border-white/[.14]`

  return (
    <button onClick={onApri}
      className={`w-full text-left px-4 py-[15px] flex items-center gap-3 transition ${superficie}`}>
      <span className={`w-[3px] self-stretch rounded-full shrink-0 ${chiuso ? 'bg-green-500' : c.bg}`} />
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 mb-[5px]">
          <span className={`inline-flex px-2 py-[3px] rounded-full text-[10px] font-black uppercase
                            tracking-[.07em] ${c.bg} ${c.testoSuBg}`}>
            {etichetta}
          </span>
          {stato && (chiuso ? (
            <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-green-500/15
                             text-green-500 text-[10px] font-black uppercase tracking-[.07em]">
              <Check size={10} strokeWidth={3.2} aria-hidden="true" /> Fatto
            </span>
          ) : (
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[.09em] text-muted">
              Da fare
            </span>
          ))}
        </span>
        <span className="block text-[15px] font-extrabold tracking-[-.01em] text-white truncate">
          {titolo}
        </span>
        {meta && (
          <span className="block mt-[3px] font-mono text-[12px] font-medium text-muted leading-none truncate">
            {meta}
          </span>
        )}
      </span>
      <ChevronRight size={17} className="text-[#5b6070] shrink-0" aria-hidden="true" />
    </button>
  )
}

/**
 * L'aggiunta, in fondo alla lista del giorno.
 *
 * ⚠️ Porta la DATA nel testo, e non è ridondanza con l'intestazione sopra: è
 * l'unico comando della pagina che scrive qualcosa, e il giorno su cui scrive
 * è quello selezionato tre schermate più in alto se la lista è lunga.
 */
export function AggiungiGiorno({ etichetta, onClick }) {
  return (
    <button onClick={onClick}
      className="w-full rounded-[18px] px-4 py-3.5 border border-dashed border-white/[.13]
                 flex items-center justify-center gap-2 text-gray-400 text-[13.5px] font-bold
                 hover:border-brand/40 hover:text-white transition">
      <Plus size={16} className="text-brand" aria-hidden="true" /> {etichetta}
    </button>
  )
}

/** Il giorno senza niente: uno stato normale, non un vicolo cieco. */
export function VuotoGiorno({ atleta }) {
  return (
    <div className="rounded-[18px] border border-dashed border-white/[.12] px-6 py-7 text-center">
      <p className="text-gray-300 font-bold text-sm">Nessun allenamento</p>
      <p className="mt-1 text-[13px] text-muted">
        {atleta ? 'Giorno di riposo. 😴' : 'Niente in programma per questo giorno.'}
      </p>
    </div>
  )
}

/** Il calendario che si sta caricando: la pagina non salta quando i dati arrivano. */
export function ScheletroGiorno() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden="true">
      <div className={`${CARTA_RIGA} h-[86px] animate-pulse`} />
      <div className={`${CARTA_RIGA} h-[86px] animate-pulse opacity-50`} />
    </div>
  )
}
