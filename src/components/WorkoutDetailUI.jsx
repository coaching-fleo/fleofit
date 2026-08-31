// WorkoutDetailUI.jsx — i pezzi visivi della scheda di un workout.
//
// Stesso patto di HomeAtletaUI, HomeCoachUI e CreaWorkoutUI: SOLA
// PRESENTAZIONE. Ricevono testo già formattato e callback già esistenti. Se
// qui dentro compare una `supabase`, un `useEffect` di rete o una regola su
// quanto dura un blocco, è finito nel file sbagliato.
//
// Il rework in una riga: la pagina apriva con il logo, poi il titolo, poi sei
// bottoncini e un avviso arancione alto quanto una card — e l'azione che conta,
// avviare l'allenamento, arrivava dopo tutto questo. Ora la testata porta due
// sole icone di STATO (TV e cardio: si accendono e si spengono durante
// l'allenamento) e un menu; il riepilogo dice subito durata, blocchi e RPE; e
// «Avvia» sta in una barra fissa che non dipende da quanto è lunga la lista.
//
// ⚠️ Il riepilogo NON è qui: è `RiepilogoWorkout` di CreaWorkoutUI, ed è lo
// stesso componente dello step 2 del builder. Il coach deve ritrovare in
// lettura la stessa cosa che ha visto in scrittura.

import { createPortal } from 'react-dom'
import { ChevronLeft, MoreHorizontal, ChevronDown, Activity, Check, User } from 'lucide-react'
import { CARD, LABEL, RIGA, VETRO } from '../lib/stiliCard'
import { useBottomSheet } from '../useBottomSheet'
import { SpinaBlocco, DurataBlocco, NumeroEsercizio } from './CreaWorkoutUI'

// ── Testata ───────────────────────────────────────────────────────────────
// Erano cinque bottoncini in fila (TV, Cardio, Duplica, Modifica, Elimina) più
// il logo FLEOFIT: sei elementi prima del contenuto, tutti dello stesso peso.
// Restano fuori solo i due che sono uno STATO — il resto è nel menu.

export function TestataScheda({ onIndietro, onMenu, children }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* ⚠️ `onIndietro` può mancare, e non è una svista del chiamante: la
          scheda atleta è anche `/profile`, cioè una destinazione della navbar.
          Lì non c'è un «indietro» — c'è la Home, e ci si arriva dalla navbar. */}
      {onIndietro && (
        <button aria-label="Torna indietro" onClick={onIndietro}
          className="-ml-2 w-11 h-11 rounded-full flex items-center justify-center text-gray-200
                     hover:text-white hover:bg-white/[.06] transition shrink-0">
          <ChevronLeft size={23} />
        </button>
      )}
      <div className="flex-1" />
      {children}
      <button aria-label="Altre azioni" onClick={onMenu}
        className="-mr-1.5 w-11 h-11 rounded-full flex items-center justify-center text-gray-200
                   hover:text-white hover:bg-white/[.06] transition shrink-0">
        <MoreHorizontal size={21} />
      </button>
    </div>
  )
}

/**
 * Un'icona di stato nella testata: spenta è vetro, accesa prende il colore di
 * ciò che sta segnalando e, se ha un valore da dire (i battiti), lo dice.
 */
export function IconaStato({ etichetta, icona: Icona, accesa, colore, valore, onClick, pulsa }) {
  const stile = accesa && colore
    ? { background: `${colore}24`, borderColor: `${colore}57`, color: colore }
    : undefined
  return (
    <button type="button" onClick={onClick} aria-label={etichetta} aria-pressed={!!accesa} title={etichetta}
      className={`shrink-0 h-11 rounded-full flex items-center justify-center gap-1.5 transition
                  hover:border-white/25 ${valore ? 'px-3.5' : 'w-11'} ${accesa ? 'border' : `${VETRO} text-gray-400`}`}
      style={stile}>
      <Icona size={18} className={pulsa ? 'animate-pulse' : ''} aria-hidden="true" />
      {valore && <span className="font-mono text-xs font-extrabold tracking-[.03em]">{valore}</span>}
    </button>
  )
}

// ── Il menu ───────────────────────────────────────────────────────────────
// I bottoncini della testata, più i quattro export che stavano in fondo alla
// pagina con lo stesso peso l'uno dell'altro. Bottom sheet e non tendina: è la
// forma che il progetto usa già per il centro notifiche, ed è raggiungibile
// col pollice su 393px.

export function MenuScheda({ onChiudi, voci, etichetta = "Azioni sull'allenamento" }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)

  return createPortal(
    // ⚠️ `touch-action: none` sta sul VELO, non sul foglio: serve a impedire che
    // il dito, muovendosi sullo sfondo, faccia scorrere quello che c'è sotto.
    // Metterlo sul foglio spegnerebbe anche lo scorrimento dell'elenco quando
    // le voci non ci stanno.
    <div className={`fixed inset-0 z-[100] flex flex-col justify-end bg-black/85 touch-none ${classeVelo}`}
      style={stileVelo} onClick={chiudi}>
      <div role="menu" aria-label={etichetta} onClick={(e) => e.stopPropagation()}
        style={stileFoglio}
        className={`bg-[#141416] border-t border-white/[.09] rounded-t-3xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]
                    flex flex-col gap-1 max-h-[85dvh] overflow-y-auto overscroll-contain
                    shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}>

        {/* La maniglia è un bersaglio, non un ornamento: si trascina giù per
            chiudere, e un tocco secco chiude lo stesso. Prima era uno `span`
            decorativo, e il gesto che tutti provano per primo non faceva niente. */}
        <button type="button" aria-label="Chiudi il menu" {...maniglia}
          className="w-full pt-3 pb-2.5 -mx-4 px-4 flex justify-center shrink-0 touch-none
                     cursor-grab active:cursor-grabbing group">
          <span aria-hidden="true"
            className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35 group-active:bg-white/45 transition-colors" />
        </button>

        {voci.filter(Boolean).map(({ etichetta, icona: Icona, onClick, pericolo }) => (
          <button key={etichetta} type="button" role="menuitem"
            onClick={() => { chiudi(); onClick() }}
            className={`min-h-[52px] shrink-0 rounded-2xl px-4 flex items-center gap-3.5 text-left text-[15.5px] font-bold
                        transition hover:bg-white/[.06] active:scale-[.995] ${
              pericolo ? 'text-red-400' : 'text-white'}`}>
            <Icona size={19} className={pericolo ? '' : 'text-gray-400'} aria-hidden="true" />
            {etichetta}
          </button>
        ))}
      </div>
    </div>,
    document.body
  )
}

// ── Il titolo ─────────────────────────────────────────────────────────────
// La categoria era una pillola in alto a destra, cioè un'etichetta a fine
// riga. È invece la prima cosa da sapere: diventa la sovrascritta, con il
// pallino della corsia e la data accanto. Il titolo prende lo spazio che aveva
// l'intestazione FLEOFIT, che in una pagina di dettaglio non dice niente.

export function TitoloScheda({ dot, etichettaCategoria, testoCategoria, data, titolo, intensita, classeIntensita }) {
  return (
    <div>
      <div className="flex items-center gap-[7px] mb-[7px] flex-wrap">
        <span aria-hidden="true" className={`w-[7px] h-[7px] rounded-full ${dot}`} />
        <span className={`font-mono text-[11px] font-bold uppercase tracking-[.11em] ${testoCategoria}`}>
          {etichettaCategoria}
        </span>
        {data && (
          <span className="font-mono text-[11px] font-bold uppercase tracking-[.07em] text-muted">· {data}</span>
        )}
        {intensita && (
          <span className={`font-mono text-[11px] font-bold uppercase tracking-[.07em] ${classeIntensita}`}>
            · Intensità {intensita}/10
          </span>
        )}
      </div>
      <h1 className="text-[27px] font-black tracking-[-.035em] leading-[1.12] text-white text-pretty break-words">
        {titolo}
      </h1>
    </div>
  )
}

// ── L'avviso sul riscaldamento ────────────────────────────────────────────

/**
 * ⚠️ IL TESTO È FISSO E INTERO, per decisione del committente (28/08/2026).
 *
 * Il redesign lo aveva ridotto a una riga («5-10 min di mobilità prima di
 * partire. Mai a freddo.») con la logica che una card si salta e una riga si
 * legge. È stato rimesso per intero: è l'unico avviso di sicurezza dell'app,
 * e accorciarlo toglie proprio la parte che spiega *perché* — la gradualità e
 * la prevenzione degli infortuni. **Non riassumerlo di nuovo.**
 *
 * Quello che si poteva cambiare è la forma, e questa è la risposta: non più un
 * rettangolo arancione piatto largo quanto un blocco di lavoro, ma una carta
 * sollevata con la sua luce, il titolo in ambra calda e il corpo in grigio —
 * il peso visivo di una nota, non di un allarme. Un avviso che urla quanto il
 * contenuto è un avviso che si impara a saltare.
 */
export function AvvisoRiscaldamento() {
  return (
    <div className="relative overflow-hidden rounded-[20px] px-4 py-[15px] flex gap-3.5
                    bg-gradient-to-br from-orange-500/[.13] to-orange-500/[.035]
                    border border-orange-500/25
                    shadow-[0_16px_30px_-18px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.06)]">
      <span aria-hidden="true"
        className="absolute -top-[70%] -right-[18%] w-[210px] h-[210px] pointer-events-none
                   bg-[radial-gradient(closest-side,rgba(249,115,22,.18),transparent_70%)]" />

      <span aria-hidden="true"
        className="relative shrink-0 w-[38px] h-[38px] rounded-[13px] flex items-center justify-center
                   bg-orange-500/[.16] border border-orange-500/30 text-orange-400
                   shadow-[0_10px_20px_-10px_rgba(249,115,22,.55)]">
        <Activity size={19} />
      </span>

      <div className="relative min-w-0">
        <p className="text-[14.5px] font-extrabold tracking-[-.015em] text-orange-300">Prima di iniziare</p>
        <p className="mt-[5px] text-[12.5px] leading-[1.6] text-gray-300 text-pretty">
          Esegui sempre 5-10 minuti di mobilità articolare. Approccia l'allenamento in modo graduale
          per preparare il corpo allo sforzo e prevenire infortuni. Non partire mai a freddo!
        </p>
      </div>
    </div>
  )
}

// ── I blocchi ─────────────────────────────────────────────────────────────
// Riscaldamento, lavoro centrale e chiusura avevano lo stesso bordo e lo stesso
// peso. La spina verticale di `SpinaBlocco` (colori di TYPE_COLORS, gerarchia
// fatta dallo spessore) e la durata in testa alla riga li mettono in ordine
// senza leggere un solo tempo — le stesse due cose che il builder mostra.

/**
 * ⚠️ La didascalia di BLOCK_HINT sta sulla SECONDA riga, sotto il nome.
 * Su 393px, accanto al nome e alla durata, «Blocco di apertura» finiva
 * troncata a «Blocco di apert…» — ed è la risposta al rilievo 3.2.1(viii) di
 * Apple (CLAUDE.md §9-ter), non un ornamento.
 */
export function BloccoScheda({ tipo, hint, sottotitolo, durata, lavoro, apribile, aperto, onToggle, children }) {
  const intestazione = (
    <>
      <SpinaBlocco tipo={tipo} aperto={false} lavoro={lavoro} />
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-extrabold tracking-[-.01em] text-white">{tipo}</p>
        {(hint || sottotitolo) && (
          <p className="mt-[3px] text-[11.5px] font-semibold text-muted">
            {hint}
            {hint && sottotitolo && <span aria-hidden="true"> · </span>}
            {sottotitolo && <span className="font-mono font-bold tracking-[.02em]">{sottotitolo}</span>}
          </p>
        )}
      </div>
      <DurataBlocco testo={durata} acceso={lavoro} />
      {apribile && (
        <ChevronDown size={17} aria-hidden="true"
          className={`shrink-0 text-[#5b6070] transition-transform ${aperto ? '' : '-rotate-90'}`} />
      )}
    </>
  )

  return (
    <div className={`${CARD} overflow-hidden`}>
      {apribile ? (
        <button type="button" onClick={onToggle} aria-expanded={aperto}
          className="relative w-full flex items-center gap-[11px] pl-[14px] pr-[13px] py-3 text-left
                     hover:bg-white/[.03] transition">
          {intestazione}
        </button>
      ) : (
        <div className="relative flex items-center gap-[11px] pl-[14px] pr-[13px] py-3">{intestazione}</div>
      )}
      {apribile && aperto && (
        <div className="px-3 pb-3 pl-[14px] flex flex-col gap-[7px]">{children}</div>
      )}
    </div>
  )
}

/**
 * Un esercizio come riga, non come testo che scorre.
 *
 * Prima era una sola riga di span concatenati — nome, misura, kg, note,
 * intensità — che a 393px andava a capo dove capitava. Ora il nome è il nome,
 * le specifiche stanno in monospazio sotto (così le cifre si incolonnano fra
 * un esercizio e l'altro) e l'intensità è in coda, dove si legge in verticale.
 */
export function RigaEsercizio({ numero, nome, specifiche, note, intensita, classeIntensita }) {
  return (
    <div className={`${RIGA} flex items-center gap-2.5 px-[11px] py-[9px]`}>
      {numero != null && <NumeroEsercizio n={numero} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{nome}</p>
        {specifiche && (
          <p className="mt-0.5 font-mono text-[11.5px] font-semibold tracking-[.02em] text-muted">{specifiche}</p>
        )}
        {note && <p className="mt-0.5 text-[11.5px] text-gray-400 text-pretty">{note}</p>}
      </div>
      {intensita && (
        <span className={`shrink-0 font-mono text-xs font-extrabold tracking-[.04em] ${classeIntensita}`}>
          {intensita}/10
        </span>
      )}
    </div>
  )
}

// ── Le sezioni sotto i blocchi ────────────────────────────────────────────

/** Un'intestazione di sezione: etichetta a sinistra, dettaglio a destra. */
export function IntestazioneSezione({ etichetta, dettaglio }) {
  return (
    <div className="flex items-baseline gap-2 px-[3px] pt-1.5">
      <span className={`${LABEL} tracking-[.11em]`}>{etichetta}</span>
      {dettaglio && (
        <span className="font-mono text-[11px] font-bold tracking-[.06em] text-[#5b6070]">{dettaglio}</span>
      )}
    </div>
  )
}

/** Una card colorata per le note: coach in ambra, atleta in azzurro. */
export function CardNota({ etichetta, icona: Icona, colore, children }) {
  return (
    <div className="rounded-[18px] px-3.5 py-[13px] flex flex-col gap-2 border"
      style={{ background: `${colore}0f`, borderColor: `${colore}47` }}>
      <div className="flex items-center gap-[7px]">
        <Icona size={14} className="shrink-0" style={{ color: colore }} aria-hidden="true" />
        <span className="font-mono text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: colore }}>
          {etichetta}
        </span>
      </div>
      {children}
    </div>
  )
}

/**
 * L'esito, per l'atleta che ha già finito.
 *
 * È la prima cosa in pagina dopo il titolo perché è la risposta alla domanda
 * per cui l'atleta riapre una scheda di ieri: «l'ho fatto?». Prima quella
 * risposta era un bottone verde a metà schermo, cioè uno stato travestito da
 * comando.
 */
export function EsitoCompletato({ dettaglio }) {
  return (
    <div className="rounded-[20px] px-4 py-3.5 bg-green-500/[.09] border border-green-500/30 flex items-center gap-3">
      <span aria-hidden="true"
        className="shrink-0 w-[34px] h-[34px] rounded-full bg-green-400 text-[#04140d] flex items-center justify-center">
        <Check size={19} strokeWidth={3} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-extrabold tracking-[-.01em] text-white">Allenamento completato</p>
        <p className="mt-0.5 font-mono text-[11px] font-bold uppercase tracking-[.06em] text-green-300">{dettaglio}</p>
      </div>
    </div>
  )
}

// ── Gli atleti a cui il workout è assegnato (solo coach) ──────────────────
// Erano N card separate, una per atleta, ognuna con la propria ombra: tre
// assegnazioni riempivano uno schermo. Sono un elenco, e un elenco si legge
// come un elenco.

export function RigaAssegnazione({ nome, foto, dettaglio, fatto, selezionata, onApri, azione }) {
  return (
    <div className={`flex items-center gap-[11px] px-1.5 py-2 rounded-2xl transition ${
      selezionata ? 'bg-brand/[.08]' : ''}`}>
      <button type="button" onClick={onApri}
        className="flex-1 min-w-0 flex items-center gap-[11px] text-left rounded-xl hover:bg-white/[.04] transition">
        <span className={`shrink-0 w-[34px] h-[34px] rounded-full overflow-hidden flex items-center justify-center
                          ${VETRO} text-muted`}>
          {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <User size={16} />}
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-sm font-bold truncate ${selezionata ? 'text-brand' : 'text-white'}`}>{nome}</span>
          <span className="block mt-0.5 font-mono text-[11px] font-bold tracking-[.05em] text-[#5b6070] truncate">
            {dettaglio}
          </span>
        </span>
      </button>
      <span className={`shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 border font-mono text-[11px]
                        font-extrabold tracking-[.05em] ${
        fatto ? 'bg-green-500/[.13] border-green-500/30 text-green-400'
              : 'bg-white/[.06] border-white/[.12] text-muted'}`}>
        {fatto && <Check size={11} strokeWidth={3} aria-hidden="true" />}
        {fatto ? 'Fatto' : 'Da fare'}
      </span>
      {azione}
    </div>
  )
}

export function ElencoAssegnazioni({ children }) {
  return <div className={`${CARD} px-1.5 py-1 divide-y divide-white/[.07]`}>{children}</div>
}

/**
 * La CTA della barra quando l'azione non è più quella che conta: «Rifallo» su
 * un allenamento già completato, o la minimizzazione di un timer già acceso.
 *
 * Esiste come componente a sé e non come variante di `CtaPrimaria` per La
 * Regola del Tratto Unico: il giallo pieno segna UNA cosa per schermo, e su
 * una scheda già chiusa quella cosa non c'è più.
 */
export function CtaVetro({ onClick, children, icona: Icona }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 min-h-[52px] rounded-2xl ${VETRO} text-white text-[16px] font-extrabold tracking-[-.01em]
                  flex items-center justify-center gap-2.5 transition hover:border-white/25 active:scale-[.99]`}>
      {Icona && <Icona size={19} aria-hidden="true" />}
      {children}
    </button>
  )
}
