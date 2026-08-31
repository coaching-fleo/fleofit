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

import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Copy, Wand2, Plus, Minus, Keyboard, Clock, ChevronRight } from 'lucide-react'
import { CARD, LABEL, VETRO } from '../lib/stiliCard'
import { useTastieraAperta, chiudiTastieraSuInvio } from '../useTastiera'
import { battito } from '../lib/aptica'
import { TYPE_COLORS } from '../lib/blockColors'
import { minutiStimati, decimale } from '../lib/stimaWorkout'

// ── Testata ───────────────────────────────────────────────────────────────
// Una sola testata per i due passi. Al passo 1 porta i pallini e «1 / 2», al
// passo 2 il titolo e la data — che scendono lì proprio perché al passo 2 non
// si compilano più, si consultano.
export function TestataCrea({ passo, onIndietro, titolo, sottotitolo, onTitolo }) {
  return (
    <div className="flex items-center gap-3">
      <button aria-label="Torna indietro" onClick={onIndietro}
        className={`w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-gray-200
                    hover:text-white hover:border-white/25 transition shrink-0`}>
        <X size={19} />
      </button>

      {titolo ? (
        // Nome e data non sono più in cima allo schermo mentre si costruisce:
        // si compilano una volta e si dimenticano. Restano però raggiungibili —
        // in modifica il passo 1 è l'unico posto dove cambiarli.
        <button type="button" onClick={onTitolo} disabled={!onTitolo}
          aria-label="Modifica nome e data"
          className="flex-1 min-w-0 text-left rounded-xl px-1 py-0.5 -mx-1 hover:bg-white/[.04] transition disabled:hover:bg-transparent">
          <p className="text-base font-extrabold tracking-[-.02em] text-white truncate">{titolo}</p>
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
    <button type="button" onClick={onClick} aria-pressed={attiva}
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

function Cella({ etichetta, valore, unita, ambra, classeValore }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
      <span className={LABEL}>{etichetta}</span>
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
 */
export function RiepilogoWorkout({ secondi, blocchi, rpe, segmenti, terzaCella }) {
  const conDurata = segmenti.filter(s => s.secondi > 0)
  return (
    <div data-riepilogo className={`${CARD} px-[17px] py-[15px] flex flex-col gap-3.5`}>
      <div className="flex gap-2.5">
        <Cella etichetta="Durata" valore={minutiStimati(secondi)} unita="min" />
        <Cella etichetta="Blocchi" valore={blocchi} />
        {terzaCella
          ? <Cella {...terzaCella} />
          : <Cella etichetta="RPE atteso" valore={rpe === null ? '—' : decimale(rpe)} ambra={rpe !== null} />}
      </div>

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
    <span className={`shrink-0 font-mono text-[13px] font-extrabold tracking-[.02em] ${
      stimabile ? (acceso ? 'text-brand' : 'text-gray-200') : 'text-[#4a4f5c]'}`}>
      {stimabile ? testo : '—'}
    </span>
  )
}

/** La riga di un esercizio dentro il blocco aperto, in forma di sola lettura. */
export function NumeroEsercizio({ n }) {
  return (
    <span aria-hidden="true"
      className="shrink-0 w-6 h-6 rounded-full bg-brand/[.13] border border-brand/30 flex items-center justify-center
                 font-mono text-[11px] font-extrabold text-brand">
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
    <button type="button" onClick={onClick}
      className="relative overflow-hidden rounded-[20px] px-4 py-[15px] flex items-center gap-3 text-left
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

// ── La barra fissa ────────────────────────────────────────────────────────
// Salva stava in fondo a uno scroll che cresce con il workout: più il coach
// costruiva, più il salvataggio si allontanava. Ora è ancorato.
export function BarraAzioni({ children }) {
  // ⚠️ Sparisce mentre si scrive, come la navbar. Con `Keyboard.resize: 'native'`
  // la webview si rimpicciolisce: una barra ancorata al fondo si ritrova sopra
  // la tastiera, e a schermo sembra «salita in cima». Non c'è modo di tenerla
  // ferma dov'era — quel punto dello schermo, mentre si digita, non esiste più.
  // Quindi si toglie di mezzo, e torna appena la tastiera scende (invio, o un
  // tocco fuori dal campo).
  const tastieraAperta = useTastieraAperta()
  if (tastieraAperta) return null

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

export function CtaPrimaria({ onClick, disabled, children, icona: Icona, iconaCoda: IconaCoda }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex-1 min-h-[52px] rounded-2xl bg-brand text-black text-[16.5px] font-black tracking-[-.01em]
                 flex items-center justify-center gap-2.5 transition hover:brightness-110 active:scale-[.99]
                 disabled:opacity-50 shadow-[0_14px_26px_-10px_rgba(241,186,23,.5),inset_0_1px_0_rgba(255,255,255,.4)]">
      {Icona && <Icona size={19} aria-hidden="true" />}
      {children}
      {IconaCoda && <IconaCoda size={19} aria-hidden="true" />}
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

// ── I parametri senza rotella ─────────────────────────────────────────────
// Le rotelle da 102 opzioni erano il costo maggiore del builder: due parametri
// riempivano uno schermo, e per arrivare a «20 reps» si scorreva alla cieca.
// Al loro posto: il valore grande, meno e più ai lati, e sotto i valori che si
// usano davvero. Un tocco per il caso normale, la tastiera per il valore
// esatto, il passo per l'aggiustamento.
//
// ⚠️ Il valore resta una STRINGA, con lo stesso vocabolario di prima ("-",
// "Max", "9 kg", "1:00"): è quello che finisce dentro workouts.sections su
// Supabase, e il database è condiviso con la web app in produzione. Questo
// componente cambia il gesto, non il dato.
export function Stepper({
  etichetta, valore, onChange, opzioni = [], unitaPredefinita, onPasso, digitabile = true,
  onDigita, inDigitazione, accento = 'var(--color-brand)',
}) {
  const attivo = (o) => String(o) === String(valore)
  // Il valore è una stringa del vocabolario esistente. Quando è un numero con
  // un'unità attaccata ("9 kg", "500m") il numero va grande e l'unità piccola;
  // quando non lo è ("1:00", "Z2", "Max", "2x24 kg") resta intero, perché
  // spezzarlo lo renderebbe illeggibile.
  const pezzi = String(valore ?? '-').match(/^(\d+(?:[.,]\d+)?)\s*(kg|m|km)?$/i)
  const numero = pezzi ? pezzi[1] : String(valore ?? '-')
  const unita = pezzi ? (pezzi[2] || unitaPredefinita) : null

  return (
    <div className={`${CARD} px-4 py-[15px] flex flex-col gap-[13px]`}>
      <div className="flex items-center justify-between gap-3">
        <span className={LABEL}>{etichetta}</span>
        {digitabile && (
          <button type="button" onClick={onDigita}
            className={`inline-flex items-center gap-1.5 min-h-11 px-[13px] rounded-[13px] text-[12.5px] font-extrabold transition
                        ${inDigitazione
                          ? 'bg-brand/15 border border-brand/40 text-brand'
                          : 'bg-white/[.055] border border-white/10 text-[#c9ccd4] hover:border-white/20'}`}>
            <Keyboard size={15} aria-hidden="true" />{inDigitazione ? 'Fatto' : 'Digita'}
          </button>
        )}
      </div>

      {inDigitazione ? (
        <input autoFocus value={valore === '-' ? '' : valore}
          onChange={e => onChange(e.target.value || '-')}
          placeholder={`Scrivi il valore${unita ? ` in ${unita}` : ''}…`}
          className="w-full bg-black/40 border border-white/10 rounded-[14px] px-4 py-3 text-white text-base
                     font-mono focus:outline-none focus:border-brand" />
      ) : (
        <div className="flex items-center gap-3">
          <button type="button" aria-label={`Diminuisci ${etichetta}`} onClick={() => onPasso?.(-1)} disabled={!onPasso}
            className={`shrink-0 w-[46px] h-[46px] rounded-[14px] ${VETRO} flex items-center justify-center text-white
                        hover:border-white/25 transition active:scale-95 disabled:opacity-30`}>
            <Minus size={20} aria-hidden="true" />
          </button>
          <div className="flex-1 text-center min-w-0">
            <span data-valore-di={etichetta}
              className="font-mono text-[38px] font-extrabold tracking-[-.01em] text-white leading-none">{numero}</span>
            {unita && <span className="text-[15px] font-bold text-muted pl-1">{unita}</span>}
          </div>
          <button type="button" aria-label={`Aumenta ${etichetta}`} onClick={() => onPasso?.(1)} disabled={!onPasso}
            className={`shrink-0 w-[46px] h-[46px] rounded-[14px] ${VETRO} flex items-center justify-center text-white
                        hover:border-white/25 transition active:scale-95 disabled:opacity-30`}>
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
      )}

      {opzioni.length > 0 && (
        <div className="flex gap-[7px]">
          {opzioni.map(o => (
            <button key={o} type="button" onClick={() => onChange(o)}
              className={`flex-1 min-w-0 min-h-11 rounded-xl font-mono text-[13px] font-extrabold tracking-[.01em]
                          flex items-center justify-center truncate px-1 border transition ${
                attivo(o) ? '' : 'bg-white/[.055] border-white/10 text-[#c9ccd4] hover:border-white/20'
              }`}
              style={attivo(o) ? {
                background: `color-mix(in srgb, ${accento} 15%, transparent)`,
                borderColor: `color-mix(in srgb, ${accento} 40%, transparent)`,
                color: accento,
              } : undefined}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
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

// ── Il passo: una ruota orizzontale, un genere alla volta ─────────────────
//
// Due tentativi prima di questo, e vale la pena sapere perché sono caduti.
//
//  1. **Uno Stepper con cinque valori rapidi.** Il passo non è una scala: la
//     lista mette in fila «Z3», «All out» e «2:05 /500m», che non stanno sulla
//     stessa retta. Cinque valori su ottantacinque nascondevano gli altri
//     ottanta, e il più/meno attraversava categorie senza rapporto fra loro.
//  2. **Un elenco intero a schermo pieno.** Mostrava tutto, ma per cambiare un
//     passo di cinque secondi chiedeva di aprire una schermata, cercare in una
//     griglia di sessantuno pillole e tornare indietro. Corretto e faticoso.
//
// La lezione: la scelta ha DUE domande, non una. Prima *di che tipo* di passo si
// parla — a sensazione, ritmo, cadenza — e lì le voci sono poche e vanno viste
// tutte insieme. Poi *quale valore*, e lì sì che è una scala fitta e ordinata,
// dove si aggiusta per gradi rispetto a quello che c'è già.
//
// Quindi: un segmento per il genere, e per il valore una ruota orizzontale con
// il precedente a sinistra, il successivo a destra e quello scelto grande al
// centro. Dentro un genere la rotella è lo strumento giusto — è quando la si
// chiede di attraversare una tassonomia che diventa cieca.

const LARGHEZZA_VOCE = 78
const VUOTO = '-'

/**
 * Quanto larga e quanto grande la voce al centro.
 *
 * ⚠️ Non è una rifinitura: i generi non hanno tutti la stessa forma. «2:15» sta
 * in settantotto punti a venticinque, «Gara Singola» no — e una voce tranciata
 * al centro della ruota è il posto peggiore in cui tagliare qualcosa. La misura
 * si prende dal genere, non dalla singola voce, così le voci non ballano di
 * dimensione mentre si scorre.
 */
const misuraGenere = (voci, larghezzaScelta) => {
  const piuLunga = voci.reduce((n, o) => Math.max(n, o.etichetta.length), 1)
  const numerico = voci.every(o => /^[\d:.\u2014-]+$/.test(o.etichetta))
  return {
    larghezza: larghezzaScelta || (piuLunga <= 5 ? LARGHEZZA_VOCE : Math.min(150, 22 + piuLunga * 11)),
    dimensione: piuLunga <= 5 ? 25 : piuLunga <= 9 ? 19 : 16,
    numerico,
  }
}

/**
 * La ruota di un genere. Scorre, si aggancia allo scatto, e ogni voce è anche
 * un bottone: senza, il valore sarebbe raggiungibile solo trascinando — cioè
 * non raggiungibile né da tastiera né da VoiceOver.
 */
export function RuotaValori({ etichetta, valore, generi, onChange }) {
  const pista = useRef(null)
  const inScorrimento = useRef(false)
  const fineScorrimento = useRef(null)

  // Il genere che contiene il valore comanda; `-` sta in tutti, quindi in quel
  // caso resta quello che si stava guardando invece di saltare al primo.
  const [genereScelto, setGenereScelto] = useState(null)
  const genere =
    generi.find(g => g.id === genereScelto) ||
    generi.find(g => g.opzioni.some(o => o.valore === valore && o.valore !== VUOTO)) ||
    generi[0]

  const voci = genere.opzioni
  const indice = Math.max(0, voci.findIndex(o => o.valore === valore))
  const { larghezza, dimensione, numerico } = misuraGenere(voci, genere.larghezza)

  // Riporta la ruota sul valore quando cambia da fuori (il tocco su una voce,
  // «Riusa», il cambio di genere). ⚠️ Non mentre l'utente sta trascinando: la
  // strapperebbe di mano a metà gesto.
  useEffect(() => {
    const el = pista.current
    if (!el || inScorrimento.current) return
    el.scrollTo({ left: indice * larghezza, behavior: 'auto' })
  }, [indice, genere.id, larghezza])

  const scorri = useCallback(() => {
    const el = pista.current
    if (!el) return
    inScorrimento.current = true
    clearTimeout(fineScorrimento.current)

    const i = Math.round(el.scrollLeft / larghezza)
    const scelta = voci[i]
    if (scelta && scelta.valore !== valore) {
      onChange(scelta.valore)
      battito()
    }
    fineScorrimento.current = setTimeout(() => { inScorrimento.current = false }, 150)
  }, [voci, valore, onChange, larghezza])

  const posizione = voci.length > 1 ? indice / (voci.length - 1) : 0

  return (
    <div className={`${CARD} px-4 py-[15px] flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-3">
        <span className={LABEL}>{etichetta}</span>
        {genere.unita && <span className="font-mono text-[11px] font-bold text-[#5b6070]">{genere.unita}</span>}
      </div>

      {generi.length > 1 && (
        <div className="flex gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/[.06]">
          {generi.map(g => (
            <button key={g.id} type="button" onClick={() => setGenereScelto(g.id)}
              aria-pressed={g.id === genere.id}
              className={`flex-1 min-w-0 min-h-10 rounded-xl text-[12.5px] font-extrabold truncate px-2 transition ${
                g.id === genere.id ? 'bg-white/[.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)]' : 'text-muted hover:text-gray-300'
              }`}>
              {g.titolo}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        {/* Il fermo al centro: dice dove cade la scelta anche prima di leggere
            quale voce è più grande. */}
        <span aria-hidden="true"
          className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 rounded-2xl bg-brand/[.08] border border-brand/25 pointer-events-none"
          style={{ width: larghezza }} />

        {/* La sfumatura ai bordi non è decorazione: le voci a distanza 2 sono
            tagliate a metà cifra, e una cifra tranciata si legge come un difetto.
            Sfumate, dicono quello che devono dire — che la scala continua. */}
        <div ref={pista} onScroll={scorri} role="listbox" aria-label={etichetta}
          className="flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain"
          style={{
            scrollbarWidth: 'none',
            maskImage: 'linear-gradient(to right, transparent, #000 15%, #000 85%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, #000 15%, #000 85%, transparent)',
          }}>
          <span aria-hidden="true" className="shrink-0" style={{ width: `calc(50% - ${larghezza / 2}px)` }} />
          {voci.map((o, i) => {
            const distanza = Math.abs(i - indice)
            return (
              <button key={o.valore} type="button" role="option" aria-selected={i === indice}
                onClick={() => onChange(o.valore)}
                style={{
                  width: larghezza,
                  fontSize: distanza === 0 ? dimensione : distanza === 1 ? Math.round(dimensione * 0.6) : Math.round(dimensione * 0.52),
                }}
                className={`snap-center shrink-0 h-[62px] flex items-center justify-center px-1 whitespace-nowrap
                  transition-all duration-150 ${numerico ? 'font-mono' : ''} ${
                  distanza === 0 ? 'font-extrabold text-brand tracking-[-.02em]'
                    : distanza === 1 ? 'font-bold text-gray-300'
                    : 'font-bold text-[#4a4f5c]'
                }`}>
                {o.etichetta}
              </button>
            )
          })}
          <span aria-hidden="true" className="shrink-0" style={{ width: `calc(50% - ${larghezza / 2}px)` }} />
        </div>
      </div>

      {/* Dove si è, dentro il genere: senza, una ruota lunga sessantuno voci non
          dice se si è all'inizio o alla fine della scala. */}
      {voci.length > 8 && (
        <div aria-hidden="true" className="h-[3px] rounded-full bg-white/[.07] relative mx-1">
          <span className="absolute top-0 h-full w-8 rounded-full bg-brand/60 transition-[left] duration-150"
            style={{ left: `calc(${posizione * 100}% - ${posizione * 32}px)` }} />
        </div>
      )}
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
