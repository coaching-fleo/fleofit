// CreaWorkoutUI.jsx — i pezzi visivi del builder «Crea Workout».
//
// Stesso patto di HomeAtletaUI.jsx e HomeCoachUI.jsx: SOLA PRESENTAZIONE.
// Ricevono numeri già calcolati (src/lib/stimaWorkout.js) e callback già
// esistenti. Se qui dentro compare una `supabase`, un `useEffect` di rete o una
// regola su quanto dura un blocco, è finito nel file sbagliato.
//
// Il rework in una riga: il builder era cieco e piatto. Ora lo step 1 fa una
// domanda sola («che tipo di allenamento è?»), lo step 2 apre con il riepilogo
// di ciò che si sta costruendo, e il salvataggio non dipende più da quanto è
// lungo lo scroll.
//
// ⚠️ CARD, LABEL e RIGA arrivano da lib/stiliCard: un file di componenti che
// esporta anche una costante perde il Fast Refresh per intero
// (react-refresh/only-export-components, CLAUDE.md §9-octies punto 3).

import { ChevronLeft, Copy, Wand2, Plus, Clock, ChevronRight } from 'lucide-react'
import { CARD, LABEL, VETRO } from '../lib/stiliCard'
import { useTastieraAperta, chiudiTastieraSuInvio } from '../useTastiera'
import { vibraScelta } from '../lib/aptica'
import { TYPE_COLORS } from '../lib/blockColors'
import { minutiStimati, decimale } from '../lib/stimaWorkout'
import { Puntini } from './Puntini'
import { useNumeroCheSale } from '../useNumeroCheSale'

// ── Testata ───────────────────────────────────────────────────────────────
// Una sola testata per i due passi. Al passo 1 porta i pallini e «1 / 2», al
// passo 2 il titolo e la data — che scendono lì proprio perché al passo 2 non
// si compilano più, si consultano.
//
// ⚠️ Il tasto è una FRECCIA, non una X: al passo 2 torna al passo 1, e una X lì
// si legge come «butto via tutto». E senza `onIndietro` non c'è affatto: è il
// caso del builder aperto dalla tab bar, che è una destinazione come
// Calendario e Atleti — e quelle non hanno un indietro.
export function TestataCrea({ passo, onIndietro, titolo, codice, sottotitolo, onTitolo }) {
  return (
    <div className="flex items-center gap-3 min-h-10">
      {onIndietro && (
        <button aria-label={passo === 2 ? 'Torna al passo 1' : 'Torna indietro'} onClick={onIndietro}
          className={`w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-gray-200
                      hover:text-white hover:border-white/25 transition shrink-0`}>
          <ChevronLeft size={19} />
        </button>
      )}

      {titolo ? (
        // Nome e data non sono più in cima allo schermo mentre si costruisce:
        // si compilano una volta e si dimenticano. Restano però raggiungibili —
        // in modifica il passo 1 è l'unico posto dove cambiarli.
        <button type="button" onClick={onTitolo} disabled={!onTitolo}
          aria-label="Modifica nome e data"
          className="flex-1 min-w-0 text-left rounded-xl px-1 py-0.5 -mx-1 hover:bg-white/[.04] transition disabled:hover:bg-transparent">
          <p className="text-base font-extrabold tracking-[-.02em] text-white truncate">{titolo}</p>
          {/* Il codice che finirà in coda al titolo, ricalcolato a ogni blocco.
              Monospazio e un tono sotto: è un'etichetta, non parte del nome. */}
          {codice && <p data-codice className="text-[11.5px] font-bold text-brand/80 tracking-[.02em] truncate mt-[1px]">{codice}</p>}
          {sottotitolo && <p className={`${LABEL} mt-[2px] tracking-[.07em] truncate`}>{sottotitolo}</p>}
        </button>
      ) : <div className="flex-1" />}

      <div className="flex items-center gap-[7px] shrink-0" aria-label={`Passo ${passo} di 2`}>
        <span aria-hidden="true" className="w-[22px] h-[5px] rounded-full bg-brand" />
        <span aria-hidden="true" className={`w-[22px] h-[5px] rounded-full ${passo >= 2 ? 'bg-brand' : 'bg-white/[.14]'}`} />
        {passo === 1 && <span className={`${LABEL} pl-1 tracking-[.1em]`}>1 / 2</span>}
      </div>
    </div>
  )
}

// ── Step 1: la categoria come domanda ─────────────────────────────────────
// Erano tre segmenti stretti dentro un toggle, cioè una scelta presentata come
// un dettaglio. È invece LA domanda del primo schermo: tre card con il nome, la
// corsia di colore e una riga che dice cosa aspettarsi.
export function CardCategoria({ attiva, colore, testoSuColore = '#fff', icona: Icona, nome, descrizione, onClick }) {
  return (
    <button type="button" onClick={() => { if (!attiva) vibraScelta(); onClick() }} aria-pressed={attiva}
      className={`relative overflow-hidden rounded-[22px] px-[18px] py-[17px] flex items-center gap-3.5 text-left
                  transition active:scale-[.995] ${
        attiva
          ? 'border shadow-[0_16px_32px_-16px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)]'
          : `${CARD} hover:border-white/15`
      }`}
      style={attiva ? {
        borderColor: `${colore}66`,
        background: `linear-gradient(100deg, ${colore}22, ${colore}0a)`,
        boxShadow: `0 16px 32px -16px ${colore}55, inset 0 1px 0 rgba(255,255,255,.07)`,
      } : undefined}>
      {attiva && (
        <span aria-hidden="true" className="absolute -top-[60%] -right-[20%] w-[200px] h-[200px] pointer-events-none"
          style={{ background: `radial-gradient(closest-side, ${colore}26, transparent 70%)` }} />
      )}

      <span className="relative w-[46px] h-[46px] rounded-[14px] shrink-0 flex items-center justify-center"
        style={attiva ? { background: colore, color: testoSuColore } : undefined}>
        {!attiva && <span aria-hidden="true" className={`absolute inset-0 rounded-[14px] ${VETRO}`} />}
        <Icona size={22} className={attiva ? '' : 'relative text-gray-400'} />
      </span>

      <span className="relative flex-1 min-w-0">
        <span className={`block text-[17px] font-extrabold tracking-[-.02em] ${attiva ? 'text-white' : 'text-gray-200'}`}>{nome}</span>
        <span className="block mt-[3px] text-[12.5px] font-medium text-muted">{descrizione}</span>
      </span>

      <span aria-hidden="true"
        className="relative w-[22px] h-[22px] rounded-full shrink-0 border-2 flex items-center justify-center"
        style={attiva ? { borderColor: colore, background: colore } : { borderColor: 'rgba(255,255,255,.16)' }}>
        {attiva && <span className="w-[9px] h-[9px] rounded-full bg-black/85" />}
      </span>
    </button>
  )
}

/** La riga «Nome» / «Data»: l'etichetta è un'etichetta, il valore è il valore. */
export function RigaCampo({ etichetta, children }) {
  return (
    <div className={`rounded-2xl px-[15px] py-[13px] ${VETRO} flex items-center gap-3`}>
      <span className={`${LABEL} shrink-0 w-11`}>{etichetta}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ── Step 2: il riepilogo ──────────────────────────────────────────────────
// I tre numeri che il builder non ha mai mostrato, e sotto la barra che dice
// COME la durata è distribuita: il riscaldamento che si mangia metà seduta si
// vede a occhio, senza leggere un solo tempo.

/**
 * Il tono di ogni segmento della barra. Il blocco di lavoro è l'unico in
 * ambra — La Regola del Tratto Unico: una sola superficie gialla, e marca la
 * cosa che conta. Gli altri scendono di tono nell'ordine in cui contano meno.
 */
const TONO_SEGMENTO = {
  'WarmUp': 'rgba(255,255,255,.2)',
  'Rest': 'rgba(255,255,255,.14)',
  'Cash In': 'rgba(255,255,255,.34)',
  'Cash Out': 'rgba(255,255,255,.34)',
}
const tonoSegmento = (tipo, lavoro) =>
  lavoro ? 'var(--color-brand)' : (TONO_SEGMENTO[tipo] || 'rgba(255,255,255,.28)')

/**
 * ⚠️ `etichettaDueRighe` non è un vezzo tipografico: con QUATTRO celle su 393px
 * ogni colonna scende a ~74px e «RPE ATTESO» va a capo, mentre «DURATA» e
 * «CARICO» no — i quattro numeri finiscono su due basi diverse e la carta si
 * legge come rotta. Accorciare l'etichetta a «RPE» sarebbe la soluzione
 * sbagliata: è proprio la parola «atteso» a distinguerla dall'«Il tuo RPE»
 * dichiarato dall'atleta, e perderla è la bugia peggiore della carta
 * (CLAUDE.md §9-duodecies punto 2). Si riserva quindi lo spazio di due righe a
 * tutte, e i valori tornano allineati.
 * ⚠️ Solo con quattro celle: con tre l'etichetta sta su una riga e riservarne
 * due lascerebbe un buco.
 */
function Cella({ etichetta, valore, unita, ambra, classeValore, etichettaDueRighe }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
      <span className={`${LABEL} leading-[1.15] ${etichettaDueRighe ? 'min-h-[2.3em]' : ''}`}>{etichetta}</span>
      <span className={`text-[23px] font-black tracking-[-.01em] leading-none ${
        classeValore || (ambra ? 'text-brand' : 'text-white')}`}>
        {valore}
        {unita && <span className="text-xs font-bold text-muted tracking-[.02em] pl-0.5">{unita}</span>}
      </span>
    </div>
  )
}

/**
 * I tre numeri del workout, e sotto la barra di come la durata è distribuita.
 *
 * Lo stesso componente serve il builder (in scrittura) e la scheda (in
 * lettura): il coach deve ritrovare in lettura la stessa cosa che ha visto in
 * scrittura, e due copie divergerebbero al primo ritocco.
 *
 * ⚠️ `terzaCella` esiste per un solo caso, e non è un'opzione di stile: nella
 * scheda di un allenamento già completato la terza colonna non è più l'RPE
 * ATTESO ma quello che l'atleta ha DICHIARATO. Sono due misure diverse — una
 * la fa il coach a tavolino, l'altra chi si è allenato — e mostrarle sotto la
 * stessa etichetta sarebbe la bugia peggiore della pagina.
 *
 * ⚠️ `carico` (minuti × RPE atteso) si mostra SOLO quando la terza cella è
 * ancora l'RPE atteso, ed è la stessa ragione di sopra portata a quattro
 * colonne: accanto a un RPE dichiarato dall'atleta, un carico calcolato su
 * quello previsto metterebbe nella stessa riga due misure che parlano di due
 * momenti diversi. O tutte e tre dicono «previsto», o la quarta non c'è.
 *
 * ⚠️ E `carico` è `null`, non 0, su un workout che non dichiara intensità: la
 * cella sparisce invece di dire che la seduta non pesa niente.
 */
export function RiepilogoWorkout({ secondi, blocchi, rpe, segmenti, terzaCella, carico, collocazione, anima = false }) {
  const conDurata = segmenti.filter(s => s.secondi > 0)
  const mostraCarico = !terzaCella && carico != null
  // 🔴 `anima` è FALSO di default, ed è la parte da non perdere. Questo
  // componente serve DUE pagine: la scheda, dove i numeri arrivano una volta
  // sola all'apertura, e il builder, dove cambiano a ogni blocco che si
  // aggiunge o si tocca. Un conteggio da 1,3 secondi a ogni modifica vorrebbe
  // dire un numero sempre in movimento e mai leggibile, proprio mentre il
  // coach lo sta usando per dosare la seduta. Il conteggio va dove un numero
  // ARRIVA, non dove lo si sta scrivendo.
  const salita = (v) => (anima ? v : null)
  const secondiSu = useNumeroCheSale(salita(secondi))
  const blocchiSu = useNumeroCheSale(salita(blocchi))
  const rpeSu = useNumeroCheSale(salita(rpe), { decimali: 1 })
  const caricoSu = useNumeroCheSale(salita(carico))
  return (
    <div data-riepilogo className={`${CARD} px-[17px] py-[15px] flex flex-col gap-3.5`}>
      <div className="flex gap-2.5">
        <Cella etichetta="Durata" valore={minutiStimati(anima ? secondiSu : secondi)} unita="min" etichettaDueRighe={mostraCarico} />
        <Cella etichetta="Blocchi" valore={anima ? blocchiSu : blocchi} etichettaDueRighe={mostraCarico} />
        {terzaCella
          ? <Cella {...terzaCella} />
          : <Cella etichetta="RPE atteso" valore={rpe === null ? '—' : decimale(anima ? rpeSu : rpe)} ambra={rpe !== null}
              etichettaDueRighe={mostraCarico} />}
        {mostraCarico && <Cella etichetta="Carico" valore={`≈${anima ? caricoSu : carico}`} etichettaDueRighe />}
      </div>

      {mostraCarico && collocazione && (
        <p className="text-[12px] leading-[1.45] text-gray-400 -mt-1">{collocazione.testo}</p>
      )}

      {conDurata.length > 0 && (
        <div className="flex gap-[3px] h-[7px]" aria-hidden="true">
          {conDurata.map(s => (
            <span key={s.id} className="rounded-full min-w-[3px]"
              style={{ flex: s.secondi, background: tonoSegmento(s.tipo, s.lavoro) }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step 2: il blocco ─────────────────────────────────────────────────────

/**
 * La spina verticale del blocco, e la sua unica ragione d'essere: dare alla
 * lista una gerarchia che prima non aveva. Riscaldamento e recupero erano
 * pesanti quanto il lavoro centrale.
 *
 * I colori vengono da TYPE_COLORS — non se ne inventano — e la gerarchia la fa
 * lo spessore. Il blocco aperto è l'unico in ambra: è stato, non categoria.
 */
export function SpinaBlocco({ tipo, aperto, lavoro }) {
  if (aperto) {
    return <span aria-hidden="true" className="absolute left-0 inset-y-0 w-1 bg-brand" />
  }
  const hex = (TYPE_COLORS[tipo] || {}).hex || '#9ca3af'
  const smorzato = tipo === 'WarmUp' || tipo === 'Rest'
  return (
    <span aria-hidden="true" className="absolute left-0 inset-y-0"
      style={{ width: lavoro ? 4 : 3, background: hex, opacity: lavoro ? 1 : (smorzato ? 0.55 : 0.6) }} />
  )
}

/**
 * La durata del blocco, in testa alla riga. Ambra solo sul blocco aperto.
 *
 * ⚠️ «0:00» è una bugia con l'aria di un dato: un Cash In senza esercizi non
 * dura zero, semplicemente non si può ancora stimare. Il trattino lo dice.
 */
export function DurataBlocco({ testo, acceso }) {
  const stimabile = testo !== '0:00'
  return (
    <span className={`shrink-0 text-[13px] font-extrabold tracking-[.02em] ${
      stimabile ? (acceso ? 'text-brand' : 'text-gray-200') : 'text-[#4a4f5c]'}`}>
      {stimabile ? testo : '—'}
    </span>
  )
}

/** La riga di un esercizio dentro il blocco aperto, in forma di sola lettura. */
// `n` può essere anche «2–3», una stazione EMOM su più minuti
// (src/lib/stazioniEmom.js): `min-w` e non `w`, così il cerchio si allunga in
// pillola invece di tagliare il testo.
export function NumeroEsercizio({ n }) {
  return (
    <span aria-hidden="true" data-numero-esercizio
      className="shrink-0 min-w-6 h-6 px-[5px] rounded-full bg-brand/[.13] border border-brand/30 flex items-center justify-center
                 text-[11px] font-extrabold text-brand tabular-nums whitespace-nowrap">
      {n}
    </span>
  )
}

// ── Step 2: le due azioni sopra la barra ──────────────────────────────────
// «Genera con IA» era un mezzo bottone tratteggiato accanto ad «Aggiungi
// blocco», cioè due gesti dello stesso peso. Non lo sono: uno è il modo veloce
// di partire da zero, l'altro è il gesto tranquillo che si ripete.
export function CardIA({ onClick }) {
  return (
    // 🔴 Il fascio luminoso NON si avvolge qui dentro, e non è una questione di
    // stile: questo file è un chunk CONDIVISO con `WorkoutDetail`, che ne
    // importa `RiepilogoWorkout` e `BarraAzioni`. Un `import 'border-beam'`
    // qui farebbe scaricare ~60 KB di fascio a ogni apertura di una scheda,
    // dove di fasci non ce n'è nemmeno uno — lo stesso danno che §9-noviesdecies
    // ha appena finito di togliere con `jspdf`. Lo avvolge il chiamante.
    <button type="button" onClick={onClick}
      className="w-full relative overflow-hidden rounded-[20px] px-4 py-[15px] flex items-center gap-3 text-left
                 bg-gradient-to-br from-ia/[.17] to-ia/[.05] border border-ia/30
                 shadow-[0_16px_30px_-18px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.06)]
                 hover:border-ia/60 transition active:scale-[.995]">
      <span aria-hidden="true" className="absolute -top-[70%] -right-[20%] w-[210px] h-[210px] pointer-events-none
                                          bg-[radial-gradient(closest-side,rgba(168,85,247,.22),transparent_70%)]" />
      <span className="relative w-11 h-11 rounded-[14px] bg-ia text-white flex items-center justify-center shrink-0
                       shadow-[0_10px_20px_-8px_rgba(168,85,247,.6)]">
        <Wand2 size={21} />
      </span>
      <span className="relative flex-1 min-w-0">
        <span className="block text-[15.5px] font-extrabold tracking-[-.015em] text-white">Genera con IA</span>
        <span className="block mt-[3px] text-[12.5px] font-medium text-[#c4a6e8]">Descrivi l'obiettivo, ti scrivo i blocchi</span>
      </span>
      <ChevronRight size={17} className="relative text-ia shrink-0" aria-hidden="true" />
    </button>
  )
}

/** Il gesto tranquillo sotto la card viola. */
export function BottoneGhost({ onClick, children, icona: Icona = Plus }) {
  return (
    <button type="button" onClick={onClick}
      className={`min-h-12 rounded-2xl ${VETRO} flex items-center justify-center gap-2.5 text-white
                  text-[14.5px] font-extrabold hover:border-white/25 transition active:scale-[.995]`}>
      <Icona size={18} aria-hidden="true" /> {children}
    </button>
  )
}

// ── La barra delle azioni ─────────────────────────────────────────────────
// Salva stava in fondo a uno scroll che cresce con il workout: più il coach
// costruiva, più il salvataggio si allontanava. Da qui la barra ancorata.
//
// ⚠️ `ancorata` NON è un gusto, ed è la ragione per cui il difetto del 15/09
// non si è chiuso cambiando il componente per tutti. Dove l'azione è quella
// per cui si è aperta la pagina — «Inizia allenamento» nella scheda, «Assegna»
// nella scheda atleta — restare a schermo è il punto. Nel builder no: lì
// l'azione è la CONCLUSIONE di un lavoro, e una barra che segue lo scroll
// mangia una riga di schermo per tutto il tempo in cui si compone, proprio
// mentre si ha bisogno di vedere i blocchi. Il committente l'ha segnalato il
// 15/09/2026: «il salva workout deve essere in fondo e basta».
export function BarraAzioni({ children, ancorata = true }) {
  // ⚠️ Solo la barra ANCORATA si nasconde mentre si scrive, e la distinzione è
  // il difetto del 22/09. Con `Keyboard.resize: 'native'` la webview si
  // rimpicciolisce: una barra `sticky` si ritrova incollata sopra la tastiera e
  // a schermo sembra «salita in cima» — non c'è modo di tenerla ferma dov'era,
  // quindi si toglie di mezzo. Una barra in FLUSSO non può saltare da nessuna
  // parte: `mt-auto` la porta al fondo della viewport rimpicciolita, cioè
  // esattamente sopra la tastiera, che è la barra accessoria di iOS.
  // 🔴 Nasconderla anche lì toglieva l'unica via d'uscita del passo 1 del
  // builder: si toccava «Nome», la tastiera saliva e «Costruisci l'allenamento»
  // spariva. Segnalato dal committente il 22/09/2026: «non mi piace che devo
  // premere invio per chiudere la tastiera, voglio poter cliccare direttamente».
  const tastieraAperta = useTastieraAperta()
  if (tastieraAperta && ancorata) return null

  // In fondo al contenuto e basta: niente velo, niente bordo, niente blur.
  // Erano il vestito dell'ancoraggio — servivano a separare la barra da ciò che
  // le scorreva sotto — e su una barra che sta in fondo alla pagina diventano
  // una riga netta sospesa sopra la capsula della tab bar, che è il secondo
  // rilievo del 15/09.
  //
  // ⚠️ `onMouseDown` annullato: il tocco NON deve togliere il fuoco al campo.
  // Senza, iOS chiude la tastiera al `mousedown`, la webview si riallarga e la
  // barra scende di 300px *prima* che il `click` venga consegnato — il primo
  // tocco cade nel vuoto e va ripetuto. Tenendo il fuoco non si muove niente:
  // la tastiera scende dopo, quando il campo si smonta. Nella barra non c'è
  // nessun campo di testo, quindi il fuoco non serve a lei.
  if (!ancorata) return (
    <div className="flex items-center gap-3" onMouseDown={e => e.preventDefault()}>{children}</div>
  )

  return (
    // ⚠️ `bottom-0` la metterebbe SOTTO la navbar, che è `fixed` a z-50:
    // l'offset non è decorativo, è quello che la tiene visibile.
    // Il numero NON si scrive più qui — è `--altezza-navbar` in src/index.css,
    // così quando la barra cambia forma questo la segue da solo. Era una delle
    // sette copie a mano che il 28/08 hanno fatto finire il contenuto sotto la
    // tab bar quando è diventata la capsula galleggiante dell'artboard 2b.
    <div className="sticky bottom-[var(--altezza-navbar)] z-30 -mx-4 px-4 py-3
                    bg-[#0B0B0B]/[.85] backdrop-blur-xl border-t border-white/[.07] flex items-center gap-3">
      {children}
    </div>
  )
}

/**
 * La CTA principale.
 *
 * ⚠️ `attesa` è FALSA di default e va accesa solo dove si aspetta davvero (il
 * salvataggio di un workout, non l'apertura di un modale): la contrazione dura
 * 570ms, e su un gesto istantaneo sarebbe solo un ritardo. Il perché della
 * forma sta in `src/index.css`, sotto «LA CTA CHE SI CONTRAE».
 */
export function CtaPrimaria({ onClick, disabled, children, icona: Icona, iconaCoda: IconaCoda, attesa = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || attesa} aria-busy={attesa || undefined}
      className={`relative flex-1 max-w-[100vw] min-h-[52px] rounded-2xl bg-brand text-black text-[16.5px] font-black tracking-[-.01em]
                 flex items-center justify-center gap-2.5 hover:brightness-110 active:scale-[.99]
                 overflow-hidden transition-[max-width,border-radius,filter] duration-[570ms] ease-[cubic-bezier(.33,1,.68,1)]
                 shadow-[0_14px_26px_-10px_rgba(241,186,23,.5),inset_0_1px_0_rgba(255,255,255,.4)]
                 ${attesa ? 'cta-contratta' : 'disabled:opacity-50'}`}>
      {/* ⚠️ L'etichetta sfuma in 150ms, molto prima che la contrazione finisca:
          deve sparire mentre c'è ancora spazio, o si vedrebbe tagliata dai
          bordi che si chiudono. E resta nel DOM, così il bottone conserva il
          proprio nome accessibile anche mentre è una pillola. */}
      <span className={`flex items-center gap-2.5 whitespace-nowrap transition-opacity duration-150
                        ${attesa ? 'opacity-0' : 'opacity-100'}`}>
        {Icona && <Icona size={19} aria-hidden="true" />}
        {children}
        {IconaCoda && <IconaCoda size={19} aria-hidden="true" />}
      </span>
      {attesa && (
        <span className="absolute inset-0 flex items-center justify-center"><Puntini /></span>
      )}
    </button>
  )
}

export function BottoneQuadrato({ onClick, etichetta, icona: Icona = Copy }) {
  return (
    <button type="button" onClick={onClick} aria-label={etichetta} title={etichetta}
      className={`shrink-0 w-[52px] h-[52px] rounded-2xl ${VETRO} flex items-center justify-center text-white
                  hover:border-white/25 transition active:scale-[.97]`}>
      <Icona size={20} aria-hidden="true" />
    </button>
  )
}

/**
 * Un campo di testo dentro una riga di vetro, con l'invio che chiude la
 * tastiera invece di non fare niente (vedi `chiudiTastieraSuInvio`).
 */
export function RigaTesto({ icona: Icona, valore, onChange, placeholder, etichetta }) {
  return (
    <div className={`rounded-[18px] px-[15px] py-[13px] ${VETRO} flex items-center gap-3`}>
      {Icona && <Icona size={17} className="text-[#5b6070] shrink-0" aria-hidden="true" />}
      <input
        aria-label={etichetta}
        enterKeyHint="done"
        onKeyDown={chiudiTastieraSuInvio}
        className="flex-1 min-w-0 bg-transparent text-sm font-medium text-white placeholder-[#5b6070] focus:outline-none"
        placeholder={placeholder}
        value={valore}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

/**
 * «Ultima volta»: i valori dell'ultima assegnazione dello stesso esercizio.
 *
 * Non è una comodità estetica — è il dato che il coach andava a cercare in
 * un'altra scheda prima di scegliere un peso, ed è la ragione per cui le
 * rotelle sembravano necessarie: senza un riferimento, ogni numero è cieco.
 */
export function RigaUltimaVolta({ testo, onRiusa }) {
  return (
    <div className="rounded-[18px] px-[15px] py-[13px] bg-brand/[.08] border border-brand/[.22] flex items-center gap-3">
      <Clock size={18} className="text-brand shrink-0" aria-hidden="true" />
      <p className="flex-1 min-w-0 text-[13px] font-semibold text-gray-200 truncate">
        Ultima volta: <b className="text-white">{testo}</b>
      </p>
      <button type="button" onClick={onRiusa}
        className="shrink-0 inline-flex items-center min-h-11 px-[15px] rounded-[13px] bg-brand/[.16] border border-brand/[.36]
                   text-brand text-[13px] font-extrabold hover:bg-brand/25 transition">
        Riusa
      </button>
    </div>
  )
}
