// HomeAtletaVuotiUI.jsx — gli stati della Home atleta quando lo storico non
// c'è ancora: giorno 1, prima settimana, giorno di riposo.
//
// Sono componenti di SOLA PRESENTAZIONE, come `HomeAtletaUI.jsx`: ricevono i
// dati che `Home.jsx` già calcola e i callback che esistono già. Nessun fetch,
// nessuno stato, nessuna regola di dominio.
//
// 🔴 La regola del rework, ed è l'unica cosa da tenere in mente rimettendoci
// mano: *nessuna cella mostra uno zero. Al posto di un dato che non esiste
// ancora va la cosa che lo farà esistere.* Un anello 0/0, una serie a «0
// giorni» e un volume a «0 min» non sono uno stato vuoto: sono tre numeri veri
// che dicono all'atleta appena arrivato che è già indietro.
//
// ⚠️ NESSUNA di queste card dichiara la propria entrata, ed è voluto: a farle
// entrare è `cascata` sul contenitore in `Home.jsx`, che le sfasa di 65ms l'una
// dall'altra. Rimettere `hero-transition` qui non aggiunge un'entrata — ne mette
// una SECONDA di pari specificità sullo stesso nodo, e a decidere quale vince
// sarebbe l'ordine nel foglio di stile, in silenzio (§9-octodecies).
//
// ⚠️ E non si usa `animate-in fade-in slide-in-from-bottom-2`: quelle classi
// vengono da **tw-animate-css, che in questo progetto NON è installato** e
// generano zero CSS (CLAUDE.md §9-duodecies, verificato sul bundle:
// `grep -c "animate-in" dist/assets/*.css` → 0). Il disegno le usa perché
// altrove sono la convenzione; qui sarebbero un'animazione che nessuno vede.

import { CalendarDays, ChevronRight, Plus, User, Dumbbell, Archive } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
// ⚠️ CARD e LABEL vivono in `lib/stiliCard.js`, non in `HomeAtletaUI.jsx`: un
// file di componenti che esporta anche una costante perde il Fast Refresh per
// intero (`react-refresh/only-export-components`, CLAUDE.md §9-octies punto 3).
import { CARD, LABEL } from '../lib/stiliCard'

// ── 2a · Il blocco giallo del giorno 1 ────────────────────────────────────
//
// 🔴 È l'UNICO punto dell'app con il Gesso Ambra a **pieno campo**, ed è
// un'eccezione nominata alla Regola del Tratto Unico (DESIGN.md): vale perché
// succede una volta sola nella vita dell'atleta, su una schermata che non ha
// nient'altro da mettere in gerarchia. Non va riusato altrove.
// La Regola del Nero Sopra il Giallo vale anche qui: il testo è nero.
export function BenvenutoCoach({ coach, onProfilo }) {
  return (
    <div className="relative overflow-hidden rounded-[26px] bg-brand p-[22px] pt-6
                    shadow-[0_26px_50px_-22px_rgba(241,186,23,.5),inset_0_1px_0_rgba(255,255,255,.4)]">
      <div aria-hidden="true" className="absolute -top-4 -right-3 opacity-[.13] -rotate-12 text-black">
        <Dumbbell size={132} />
      </div>
      <div className="relative flex flex-col gap-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-black/60">Il tuo coach</p>
        <h2 className="text-[30px] font-black leading-[1.02] tracking-[-.035em] text-black text-pretty">
          {coach ? <>{coach}<br />ti segue da oggi</> : <>Il tuo coach<br />ti segue da oggi</>}
        </h2>
        <p className="max-w-[290px] text-[14.5px] font-semibold leading-[1.45] text-black/70">
          Sta preparando la tua prima settimana. Appena è pronta la trovi qui, e ti arriva una notifica.
        </p>
        <button onClick={onProfilo} aria-label="Completa il tuo profilo"
          className="flex min-h-[52px] items-center gap-3 rounded-[14px] bg-black px-4 text-left
                     transition active:scale-[.99]">
          <User size={18} className="shrink-0 text-brand" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-extrabold text-white">Completa il tuo profilo</span>
            <span className="block text-xs font-semibold text-muted">Peso, altezza, data di nascita</span>
          </span>
          <ChevronRight size={17} className="shrink-0 text-[#5b6070]" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

// ── 2a · Una sola domanda, non un onboarding ──────────────────────────────
// Il giorno 1 non è il posto per un questionario: è il posto per la sola cosa
// che cambia la programmazione della settimana dopo.
export function CampoObiettivo({ onFissa }) {
  return (
    <div className={`${CARD} flex flex-col gap-3.5 p-[18px]`}>
      <div>
        <p className={LABEL}>Una cosa sola, adesso</p>
        <p className="mt-2 text-[19px] font-black tracking-[-.02em] text-white">Hai una gara in programma?</p>
        <p className="mt-1 text-[13px] font-medium leading-[1.45] text-muted">
          La data serve al coach per costruire il programma. Puoi cambiarla quando vuoi.
        </p>
      </div>
      <button onClick={onFissa} aria-label="Aggiungi il tuo obiettivo"
        className="flex min-h-[50px] items-center gap-3 rounded-[15px] border border-brand/30 bg-black/40 px-3.5
                   shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-brand/60 active:scale-[.99]">
        <CalendarDays size={18} className="text-brand" aria-hidden="true" />
        {/* ⚠️ `text-muted` e non il grigio del disegno (#6f7482): quello sta a
            3,7:1 sul fondo delle card, sotto il 4,5:1 che DESIGN.md pretende
            su qualunque testo. Il secondario del sistema è uno solo. */}
        <span className="flex-1 text-left text-[15px] font-semibold text-muted">Aggiungi il tuo obiettivo</span>
        <ChevronRight size={17} className="text-[#5b6070]" aria-hidden="true" />
      </button>
    </div>
  )
}

// ── 2a · Il primo allenamento libero, come card e non come tratteggio ─────
export function CardPrimoLibero({ onAggiungi }) {
  return (
    <button onClick={onAggiungi} aria-label="Registra il primo allenamento"
      className={`${CARD} flex w-full items-center gap-4 p-[18px] text-left transition hover:border-brand/40 active:scale-[.99]`}>
      <span className="min-w-0 flex-1">
        <span className={`block ${LABEL}`}>Nel frattempo</span>
        <span className="mt-2 block text-[17px] font-black tracking-[-.02em] text-white">Registra il primo allenamento</span>
        <span className="mt-1 block text-[12.5px] font-medium leading-[1.4] text-muted">
          Anche quello che fai da solo entra nello storico.
        </span>
      </span>
      <span aria-hidden="true" className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[15px]
                       border border-brand/30 bg-brand/[.14] text-brand">
        <Plus size={22} />
      </span>
    </button>
  )
}

// ── 2a · Come funziona: tre righe, non tre card ───────────────────────────
// Tre card sarebbero tre superfici per tre frasi: qui il contenuto è il testo,
// e la Regola della Carta Sollevata dice che un livello si dichiara quando
// serve, non a ogni profondità.
const PASSI = [
  'Il coach ti assegna gli allenamenti sul calendario.',
  'Tu li completi e segni come è andata, con RPE e note.',
  'Lui vede i tuoi dati e aggiusta la settimana dopo.',
]

export function ComeFunziona() {
  return (
    <div className="px-1 pt-1">
      <p className={`${LABEL} mb-3`}>Come funziona</p>
      <ol className="flex flex-col gap-2.5">
        {PASSI.map((t, i) => (
          <li key={i} className="flex items-baseline gap-3">
            <span aria-hidden="true" className="w-5 shrink-0 font-mono text-xs font-extrabold text-brand">0{i + 1}</span>
            <p className="text-[13.5px] font-medium leading-[1.45] text-[#b6bac4]">{t}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── 2b · Le celle della prima settimana ───────────────────────────────────

/**
 * Il primo allenamento completato è un DATO, non un contatore a 1.
 *
 * ⚠️ `minuti` sono quelli di QUELL'allenamento, non della settimana: la data e
 * l'RPE accanto vengono da lì, e un totale settimanale sotto una data singola
 * darebbe tre numeri che non parlano della stessa cosa — «0 min · mar 2 · RPE
 * 7» per chi ha completato il primo allenamento la settimana scorsa.
 * ⚠️ `rpe` è quello **dichiarato** (`rpeDichiarato`, mai `parseNotesAndRpe`,
 * che torna 5 quando il marcatore manca): senza dichiarazione la voce sparisce
 * invece di inventare un 5 alla prima misura della vita dell'atleta.
 */
export function CellaPrimoDato({ minuti, data, rpe }) {
  return (
    <div className={`${CARD} flex-1 p-4`}>
      <p className={LABEL}>Primo dato</p>
      <p className="mt-2.5 text-[30px] font-black leading-none tracking-[-.04em] text-white">
        {minuti}<span className="text-[13px] font-semibold tracking-normal text-muted"> min</span>
      </p>
      <p className="mt-2 text-xs font-semibold capitalize text-muted">
        {format(parseISO(data), 'EEE d', { locale: it })}{rpe != null ? ` · RPE ${rpe}` : ''}
      </p>
    </div>
  )
}

/**
 * La cella che non ha ancora un valore dice cosa la accende, e a che punto è.
 *
 * Tratteggiata: nel sistema il tratteggio non vuol più dire «vuoto» — il vuoto
 * ora ha card piene — ma «non ancora pieno».
 *
 * ⚠️ `soglia` è facoltativa. Senza, la barra di progresso NON compare: una
 * cella che si accende al primo allenamento mostrerebbe «0/1», cioè proprio lo
 * zero che questo rework esiste per togliere. La soglia si dichiara solo
 * quando c'è un progresso da raccontare.
 */
export function CellaBloccata({ etichetta, testo, fatti = 0, soglia }) {
  const conProgresso = Number.isFinite(soglia) && soglia > 1
  const pct = conProgresso ? Math.min(100, Math.round((fatti / soglia) * 100)) : 0
  return (
    <div className="flex flex-1 flex-col justify-center gap-2.5 rounded-[22px] border border-dashed
                    border-white/[.13] bg-gradient-to-b from-[#1a1a1c] to-[#161618] p-4">
      <p className={LABEL}>{etichetta}</p>
      <p className="text-[12.5px] font-semibold leading-[1.35] text-muted">{testo}</p>
      {conProgresso && (
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="block h-1 flex-1 overflow-hidden rounded-full bg-white/[.09]">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </span>
          <span className="font-mono text-[11px] font-extrabold text-muted">{fatti}/{soglia}</span>
        </div>
      )}
    </div>
  )
}

// ── 2b · L'obiettivo non fissato prende il posto del countdown ────────────
// ⚠️ Sta SOLO nel ramo della prima settimana: al giorno 1 la stessa domanda la
// fa già `CampoObiettivo`, e farla due volte nella stessa schermata è
// un'insistenza, non un invito.
export function BannerObiettivoVuoto({ onFissa }) {
  return (
    <button onClick={onFissa} aria-label="Fissa il tuo obiettivo"
      className={`${CARD} flex w-full items-center gap-3.5 border-brand/[.18] px-[18px] py-4 text-left
                  transition hover:border-brand/40 active:scale-[.99]`}>
      <span className="min-w-0 flex-1">
        <span className={`block ${LABEL}`}>Prossimo obiettivo</span>
        <span className="mt-1.5 block text-base font-black tracking-[-.02em] text-white">Non l'hai ancora fissato</span>
        <span className="mt-0.5 block text-[12.5px] font-medium text-muted">Una gara, una data, e qui compare il countdown.</span>
      </span>
      <span aria-hidden="true" className="flex min-h-[44px] shrink-0 items-center rounded-[14px] border border-brand/30
                       bg-brand/[.14] px-4 text-[13.5px] font-extrabold text-brand">Fissa</span>
    </button>
  )
}

// ── 2c · Il giorno di riposo come contenuto pieno ─────────────────────────
//
// Sostituisce `HeroRest`, che era un tratteggio con «Recupera le energie»: il
// riposo non è l'assenza di un allenamento, è una giornata con un suo carico
// alle spalle e un suo seguito.
//
// ⚠️ Corsia **Running** per il colore, e non è arbitrario: il giallo è la
// corsia Hyrox, e tingere di giallo una giornata senza allenamento la
// leggerebbe come un Hyrox mancato (Regola della Corsia).
//
// 🔴 Quello che questa schermata NON può distinguere: il riposo *programmato*
// dal coach che non ha assegnato niente. Nei dati sono la stessa riga —
// `todayWorkouts.length === 0` — e non esiste un campo che dica «oggi è rest».
// La frase «È parte del piano» è vera nel primo caso; è la versione onesta
// possibile finché quel campo non c'è, e per chi non ha NIENTE in assoluto
// interviene prima il ramo del giorno 1.
export function HeroRiposo({ minutiSettimana, giorniAttivi, onRivedi }) {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-running/[.28] p-[22px]
                    bg-gradient-to-br from-[#16202a] via-[#181a1d] to-[#151517]
                    shadow-[0_24px_48px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)]">
      {/* ⚠️ `alone` (src/index.css) e non `blur-2xl`: la sfocatura cambiava
          colore nell'istante in cui la cascata finiva — misurato, Y 48,1 → 52,3.
          Le misure sono quelle del disco da 240px PIÙ lo spegnimento della
          sfocatura, o l'alone verrebbe tagliato di netto. */}
      <div aria-hidden="true" style={{ '--alone-rgb': '0 148 198' }}
        className="alone -top-[208px] -right-[176px] h-[400px] w-[400px]" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-running px-2.5 py-1 text-[11px] font-black uppercase tracking-[.08em] text-white">Riposo</span>
          <span className={LABEL}>Previsto dal programma</span>
        </div>
        <h2 className="text-[28px] font-black leading-[1.05] tracking-[-.03em] text-white text-pretty">
          Oggi non ti alleni.<br />È parte del piano.
        </h2>
        {minutiSettimana > 0 && (
          <p className="max-w-[300px] text-sm font-medium leading-[1.5] text-[#a8adb8]">
            Hai chiuso {minutiSettimana} minuti in {giorniAttivi} {giorniAttivi === 1 ? 'giorno' : 'giorni'}. Il carico regge solo se oggi recuperi.
          </p>
        )}
        <button onClick={onRivedi} aria-label="Rivedi la settimana"
          className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[15px] border border-white/[.12]
                     bg-white/[.07] text-[14.5px] font-extrabold text-white
                     shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition active:scale-[.98]">
          <Archive size={17} aria-hidden="true" /> Rivedi la settimana
        </button>
      </div>
    </div>
  )
}

/**
 * Il carico della settimana in corso, con lo scarto sulla precedente.
 *
 * `barre` = percentuali 0-100, una per giorno: le dà `barreUltimiGiorni` con
 * `quanti = 7`.
 *
 * ⚠️ `scarto` può essere `null` — settimana precedente vuota — e la card lo
 * omette da sé: «+214 min sulla scorsa» su una settimana in cui non esistevi è
 * un dato finto.
 */
export function CardSettimanaChiusa({ minuti, scarto, fatti, totale, barre = [] }) {
  const chiusa = totale > 0 && fatti === totale
  return (
    <div className={`${CARD} flex flex-col gap-4 p-[18px]`}>
      <div className="flex items-baseline justify-between">
        <p className={LABEL}>{chiusa ? 'Settimana chiusa' : 'Settimana'}</p>
        <span className={`font-mono text-[11px] font-extrabold uppercase tracking-[.06em]
                          ${chiusa ? 'text-green-500' : 'text-muted'}`}>{fatti} / {totale}</span>
      </div>
      <div className="flex items-end gap-3.5">
        <p className="text-[52px] font-black leading-[.86] tracking-[-.05em] text-white">
          {minuti}<span className="text-[15px] font-semibold tracking-normal text-muted"> min</span>
        </p>
        {scarto != null && scarto !== 0 && (
          <p className="mb-1.5 text-[12.5px] font-semibold leading-[1.35] text-muted">
            {scarto > 0 ? '+' : ''}{scarto} min<br />sulla scorsa
          </p>
        )}
      </div>
      <div aria-hidden="true" className="flex h-10 items-end gap-1.5">
        {barre.map((v, i) => (
          <span key={i} style={{ height: `${Math.max(10, v)}%` }}
            className={`flex-1 rounded-[3px] ${v >= 85 ? 'bg-brand shadow-[0_0_10px_rgba(241,186,23,.5)]' : v > 0 ? 'bg-brand/40' : 'bg-white/10'}`} />
        ))}
      </div>
    </div>
  )
}

/**
 * Cosa arriva dopo il riposo.
 *
 * ⚠️ `etichetta` esiste perché questa card mostra il **primo in arrivo**, non
 * «domani»: se il prossimo assegnato è fra tre giorni, scrivere «Domani» è una
 * riga che mente. Il chiamante passa «In arrivo» quando la data non è domani.
 */
export function CardDomani({ workout, quando, meta, etichetta = 'Domani', onOpen }) {
  return (
    <button onClick={onOpen} aria-label={`Apri ${workout?.title || 'allenamento'}`}
      className={`${CARD} flex w-full items-center gap-3.5 p-[18px] text-left transition hover:border-brand/40 active:scale-[.99]`}>
      <span className="min-w-0 flex-1">
        <span className={`block ${LABEL}`}>{etichetta}</span>
        <span className="mt-2 block truncate text-[17px] font-black tracking-[-.02em] text-white">{workout?.title}</span>
        {/* ⚠️ `capitalize` sta sul SOLO giorno. Su tutta la riga maiuscola
            ogni parola — `text-transform: capitalize` non conosce le frasi — e
            si leggeva «Gio 10 · 2 Blocchi · 56′». Trovato guardando la pagina,
            non il codice: nessun test lo avrebbe preso, perché nel DOM il testo
            è già quello giusto e a cambiarlo è il foglio di stile. */}
        <span className="mt-0.5 block text-[12.5px] font-medium text-muted">
          <span className="capitalize">{quando}</span>{meta ? ` · ${meta}` : ''}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-[#5b6070]" aria-hidden="true" />
    </button>
  )
}

// Il tratteggio finale del giorno di riposo. Non «Aggiungi allenamento libero»
// — che è l'ultima voce di una lista, e qui quella lista non c'è — ma la frase
// giusta per chi si è allenato lo stesso.
export function RigaFattoComunque({ onAggiungi }) {
  return (
    <button onClick={onAggiungi} aria-label="Registra un allenamento fatto oggi"
      className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-white/[.13]
                 px-4 py-3 text-[13.5px] font-bold text-gray-400 transition hover:border-brand/50 hover:text-brand">
      <Plus size={16} className="text-brand" aria-hidden="true" /> Ho fatto qualcosa comunque
    </button>
  )
}
