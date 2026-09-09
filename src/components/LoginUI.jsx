import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, KeyRound, ArrowRight, Check, AlertTriangle, HelpCircle, ClipboardPaste, MessageCircle, Mail, Lock } from 'lucide-react'
import { CARD, CARTA_RIGA_BASE, LABEL, RIGA, VETRO } from '../lib/stiliCard'
import { celleCodice, GRUPPO_CODICE } from '../lib/codiceInvito'
import { useBottomSheet } from '../useBottomSheet'

/**
 * I pezzi visivi dell'accesso (artboard `Login.dc.html`, opzione 1b).
 *
 * Sola presentazione: qui non si parla con Supabase e non si decide niente.
 * Il flusso — chi entra, quando serve il codice, cosa si scrive in
 * localStorage — vive tutto in `src/pages/Login.jsx`, come per le altre nove
 * schermate rifatte.
 *
 * ⚠️ Questo file esporta SOLO componenti. Una costante esportata da un file di
 * componenti fa perdere il Fast Refresh all'intero file
 * (`react-refresh/only-export-components`, CLAUDE.md §9-octies punto 3): per
 * questo i due aloni stanno dentro `Guscio` invece di essere due stringhe
 * accanto a lui.
 */

/**
 * Il guscio di pagina dell'accesso.
 *
 * L'alone caldo in cima è l'unica atmosfera della schermata, e cambia colore
 * una volta sola in tutto il percorso: diventa verde quando l'invito è stato
 * accettato. È il segnale che si legge prima di aver letto qualsiasi parola —
 * e per questo il verde NON va usato per decorare gli altri passi.
 */
export function Guscio({ tinta = 'ambra', children }) {
  const alone = tinta === 'verde'
    ? 'radial-gradient(120% 45% at 50% 0%,#0f1a12 0%,#0B0B0B 58%)'
    : 'radial-gradient(120% 45% at 50% 0%,#17160f 0%,#0B0B0B 58%)'
  return (
    <div
      className="min-h-screen flex flex-col px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(1.5rem+env(safe-area-inset-bottom))] page-transition"
      style={{ background: alone }}
    >
      {children}
    </div>
  )
}

/**
 * Il marchio, e sta solo qui.
 *
 * La Regola del Logo (DESIGN.md): `FLEO` bianco + `FIT` ambra, peso 900,
 * `tracking-tight`, in un `<h1>` solo. Il benvenuto è l'unico posto dell'app
 * in cui sta a peso Display — nei passi successivi resta il titolo del passo e
 * basta, perché ripetere il marchio sopra ogni schermo toglie spazio all'unica
 * riga che dice dove si è.
 */
export function Marchio() {
  return (
    <div className="flex flex-col items-center gap-3 hero-transition">
      <h1 className="text-[48px] leading-none font-black tracking-[-.03em] text-white">
        FLEO<span className="text-brand">FIT</span>
      </h1>
      <p className={`${LABEL} tracking-[.16em] text-[11px]`}>Hyrox &amp; Running</p>
    </div>
  )
}

/**
 * Un modo per entrare.
 *
 * ⚠️ I tre bottoni hanno lo stesso peso di proposito, e Apple sta in cima. La
 * linea guida 4.8 di App Store chiede che l'accesso che permette di nascondere
 * la propria email non sia «meno in vista» degli altri: renderlo più piccolo o
 * più in basso è esattamente il rilievo che ha respinto la 1.1.0 (3) il
 * 02/09/2026 (CLAUDE.md §9-sexvicies).
 */
export function BottoneIdentita({ icona, etichetta, onClick, disabled, variante = 'bianco' }) {
  const stile = variante === 'bianco'
    ? 'bg-white text-black hover:brightness-95'
    : 'bg-surface2 border border-[#383838] text-white hover:bg-[#333]'
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={`w-full rounded-2xl p-4 flex items-center justify-center gap-2.5 font-bold text-[16.5px] tracking-[-.01em] transition disabled:opacity-50 ${stile}`}
    >
      {icona}
      {etichetta}
    </button>
  )
}

export function IconaApple() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.536c-.03-2.79 2.28-4.13 2.38-4.2-1.3-1.9-3.32-2.16-4.04-2.19-1.72-.17-3.36 1.01-4.23 1.01-.87 0-2.22-.99-3.65-.96-1.88.03-3.61 1.09-4.58 2.77-1.95 3.39-.5 8.41 1.4 11.16.93 1.35 2.04 2.86 3.5 2.8 1.4-.06 1.93-.9 3.63-.9 1.69 0 2.17.9 3.65.87 1.51-.02 2.46-1.37 3.38-2.72 1.07-1.56 1.51-3.07 1.53-3.15-.03-.01-2.94-1.13-2.97-4.49z" />
      <path d="M14.28 4.15c.77-.93 1.29-2.23 1.15-3.52-1.11.04-2.45.74-3.24 1.67-.71.82-1.33 2.14-1.16 3.4 1.24.1 2.5-.63 3.25-1.55z" />
    </svg>
  )
}

export function IconaGoogle() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

/**
 * La nota che sostituisce il muro del codice.
 *
 * Prima il codice era una porta davanti alla casa: chi sbagliava il bivio
 * «Accedi / Nuovo Utente» ci sbatteva contro senza sapere cosa fosse. Qui è
 * un avviso di due righe che dice **cos'è** e **quando** verrà chiesto — e la
 * frase «Lo chiediamo dopo» è la parte che toglie l'ansia, non l'ornamento.
 */
export function NotaInvito() {
  return (
    <div className="rounded-2xl bg-brand/[.07] border border-brand/20 p-[13px_15px] flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-brand/[.14] border border-brand/30 text-brand flex items-center justify-center shrink-0">
        <KeyRound size={17} />
      </div>
      <p className="text-[12.5px] leading-[1.45] font-medium text-gray-300">
        Primo accesso? Ti servirà il <b className="text-brand font-bold">codice invito</b> del tuo coach. Lo chiediamo dopo.
      </p>
    </div>
  )
}

/** Indietro + a che punto si è. Due passi in tutto, e la pagina lo dice. */
export function TestataPasso({ passo, onIndietro }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        type="button" onClick={onIndietro} aria-label="Torna indietro"
        className={`w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-gray-200 shrink-0 hover:text-white transition`}
      >
        <ChevronLeft size={20} />
      </button>
      <p className="text-[12.5px] font-bold text-muted">Passo {passo} di 2</p>
    </div>
  )
}

/**
 * Le otto caselle del codice.
 *
 * 🔴 È **un solo campo** vero sotto otto caselle disegnate, non otto campi.
 * Con otto input il codice si può incollare solo nella prima (e finisce
 * troncato a un carattere), la selezione e la correzione diventano un
 * labirinto, e VoiceOver legge otto campi senza nome invece di uno chiamato
 * «Codice invito». Le caselle qui sono `aria-hidden`: quello che c'è da
 * annunciare lo dice il campo.
 *
 * ⚠️ `autoCapitalize="characters"` non basta da solo — su iOS cambia la
 * tastiera, non il valore: chi incolla scavalca la tastiera. Il maiuscolo lo
 * fa `normalizzaCodice` lato dati, e questa prop serve solo a non far
 * comparire la tastiera minuscola.
 */
export function CaselleCodice({ valore, onChange, errore = false, disabled = false, campoRef, descrittoDa }) {
  const celle = celleCodice(valore)
  const bordo = (cella) => {
    if (errore) return 'bg-red-500/[.08] border-red-500/45'
    if (cella.attiva && !disabled) return 'bg-[#111] border-[1.5px] border-brand shadow-[0_10px_15px_-3px_rgba(241,186,23,.2)]'
    return cella.carattere ? 'bg-[#111] border-[#383838]' : 'bg-[#111] border-[#333]'
  }
  return (
    <div className="relative">
      <input
        ref={campoRef}
        type="text" inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
        aria-label="Codice invito" aria-describedby={descrittoDa} aria-invalid={errore || undefined}
        value={valore} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 text-transparent caret-transparent z-10 disabled:pointer-events-none"
      />
      <div className="flex items-center justify-center gap-[5px] pointer-events-none" aria-hidden="true">
        {celle.map((cella, i) => (
          <div key={i} className="contents">
            {i === GRUPPO_CODICE && (
              <span className={`w-2.5 h-0.5 rounded-sm shrink-0 ${errore ? 'bg-red-500/45' : 'bg-[#383838]'}`} />
            )}
            <div className={`w-[33px] h-[46px] rounded-xl border flex items-center justify-center font-mono font-bold text-[19px] text-white ${bordo(cella)}`}>
              {cella.carattere || (cella.attiva && !disabled ? <span className="w-0.5 h-[22px] rounded-sm bg-brand" /> : '')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * «Incolla dagli appunti».
 *
 * ⚠️ Il chiamante lo mostra solo se `navigator.clipboard.readText` esiste: su
 * una WebView che non lo espone il bottone non potrebbe fare niente, e un
 * bottone che non può funzionare è peggio che non averlo (stessa regola del
 * badge sulla navbar, §9-quaterdecies). Chi non lo vede ha comunque il
 * «Incolla» di sistema, perché sotto le caselle c'è un campo vero.
 */
export function BottoneIncolla({ onClick, disabled }) {
  return (
    <div className="flex justify-center">
      <button
        type="button" onClick={onClick} disabled={disabled}
        className="inline-flex items-center gap-[7px] px-[15px] py-[9px] rounded-full bg-surface2 border border-[#383838] text-white text-[13.5px] font-bold hover:bg-[#333] transition disabled:opacity-50"
      >
        <ClipboardPaste size={16} className="text-gray-400" />
        Incolla dagli appunti
      </button>
    </div>
  )
}

/** Il codice è stato rifiutato, o non si è potuto verificare. */
export function AvvisoCodice({ id, titolo, corpo }) {
  return (
    <div id={id} role="alert" className="rounded-2xl bg-red-500/[.07] border border-red-500/25 p-[13px_14px] flex gap-3 items-start">
      <div className="w-[30px] h-[30px] rounded-full bg-red-500/[.16] border border-red-500/30 text-red-500 flex items-center justify-center shrink-0">
        <AlertTriangle size={16} />
      </div>
      <p className="text-[13px] leading-[1.5] font-medium text-gray-300">
        <b className="text-red-500 font-bold">{titolo}</b><br />{corpo}
      </p>
    </div>
  )
}

/** La riga che toglie il vicolo cieco: «Non ho un codice» ha una risposta. */
export function RigaAiuto({ onClick }) {
  return (
    <button type="button" onClick={onClick} className={`w-full ${RIGA} p-3.5 flex items-center gap-3 text-left hover:bg-white/[.06] transition`}>
      <div className="w-8 h-8 rounded-full bg-white/[.06] border border-white/10 text-gray-400 flex items-center justify-center shrink-0">
        <HelpCircle size={17} />
      </div>
      <p className="flex-1 text-sm font-bold text-white">Non ho un codice</p>
      <ChevronRight size={17} className="text-[#5b6070] shrink-0" />
    </button>
  )
}

/**
 * L'invito accettato.
 *
 * 🔴 **Non c'è il nome del coach, e non è una dimenticanza.** L'artboard lo
 * mette («Federico Leo ti ha invitato»), ma quel nome non è leggibile da qui:
 * l'unica policy che serve chi non è ancora dentro riguarda
 * `invitation_codes`, e `created_by` è un id di `auth.users` che nessuna
 * query anonima può risolvere in un nome — `athletes` si legge solo per la
 * propria riga o da admin. Prenderlo richiederebbe una policy nuova o una
 * funzione `security definer`, cioè una migrazione, e lo schema è congelato
 * (regola 0-bis). Scriverlo a mano sarebbe un dato inventato sulla schermata
 * che deve dimostrare di sapere chi sei.
 *
 * Quello che la card dice è quindi tutto vero: l'invito vale, viene dal
 * proprio coach, ed è **questo** codice — che resta a schermo finché il
 * profilo non esiste, così se ci si ferma a metà non è perso.
 */
export function CardInvitoValido({ codice }) {
  return (
    <div className="rounded-[26px] bg-gradient-to-b from-[#182016] via-[#1b1b1d] to-[#161618] border border-green-500/25 shadow-[0_24px_48px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)] px-5 py-6 flex flex-col items-center text-center hero-transition">
      <div className="w-[52px] h-[52px] rounded-full bg-green-500/15 border border-green-500/35 text-green-500 flex items-center justify-center mb-3.5">
        <Check size={26} strokeWidth={2.6} />
      </div>
      <p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-green-500 mb-1.5">Invito valido</p>
      <p className="text-[21px] font-black tracking-[-.02em] leading-[1.25] text-white mb-4.5">
        Il tuo coach ti ha<br />invitato su FLEOFIT
      </p>
      <div className="w-full rounded-[18px] bg-black/40 border border-white/[.07] p-3.5 flex items-center gap-3 text-left">
        <div className="w-10 h-10 rounded-full bg-surface2 border border-[#3a3a3a] text-gray-400 flex items-center justify-center shrink-0">
          <KeyRound size={19} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-white">Codice invito</p>
          <p className="text-xs font-medium text-muted mt-0.5">Vale una volta sola</p>
        </div>
        <span className="shrink-0 font-mono text-xs font-bold tracking-[.09em] px-2.5 py-1.5 rounded-lg bg-green-500/[.12] border border-green-500/[.28] text-green-500">
          {codice}
        </span>
      </div>
    </div>
  )
}

/**
 * Il profilo che sta per nascere: l'email già riconosciuta, e — solo per chi
 * è arrivato con l'email — la password da scegliere.
 *
 * ⚠️ La riga della password compare **solo** sul percorso email. Chi è entrato
 * con Apple o Google una password non ce l'ha e non deve inventarsene una: per
 * loro il modo di rientrare è lo stesso bottone di prima, che il chiamante
 * mette sotto questa card.
 */
export function CardProfilo({ email, password, onPassword, chiediPassword, onInvio }) {
  return (
    <>
      <p className={`${LABEL} mt-5 mb-3 pl-1`}>Il tuo profilo</p>
      <div className={`${CARD} overflow-hidden`}>
        <div className="p-3.5 flex items-center gap-3">
          <div className="w-[34px] h-[34px] rounded-xl bg-white/[.07] border border-white/[.11] text-gray-200 flex items-center justify-center shrink-0">
            <Mail size={18} />
          </div>
          <p className="flex-1 min-w-0 truncate text-[15px] font-bold text-white">{email}</p>
          <Check size={17} className="text-green-500 shrink-0" />
        </div>
        {chiediPassword && (
          <>
            <div className="h-px bg-white/[.06] ml-[60px]" />
            <div className="p-3.5 flex items-center gap-3">
              <div className="w-[34px] h-[34px] rounded-xl bg-white/[.07] border border-white/[.11] text-gray-200 flex items-center justify-center shrink-0">
                <Lock size={18} />
              </div>
              <input
                type="password" value={password} onChange={(e) => onPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onInvio?.() }}
                aria-label="Scegli una password" placeholder="Scegli una password" autoComplete="new-password"
                className="flex-1 min-w-0 bg-transparent text-[15px] text-white placeholder-muted focus:outline-none"
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}

/** La CTA piena, unica superficie gialla della schermata. */
export function CtaGialla({ etichetta, onClick, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="w-full bg-brand rounded-2xl p-4 flex items-center justify-center gap-2.5 text-black font-extrabold text-[16.5px] tracking-[-.01em] shadow-[0_10px_15px_-3px_rgba(241,186,23,.2)] hover:brightness-110 transition disabled:opacity-50"
    >
      {etichetta}
      {!disabled && <ArrowRight size={18} />}
    </button>
  )
}

/**
 * Il foglio «Non ho un codice».
 *
 * Tre risposte, non una: chi ha già un coach, chi ha ricevuto il link e non
 * sa che salta questa schermata, e chi un coach non ce l'ha. Erano tre stati
 * diversi che finivano tutti nello stesso vicolo cieco — chiudere l'app.
 *
 * ⚠️ Usa `useBottomSheet` come il menu della scheda: entrata vera (`sheet-in`,
 * non `animate-in`, che nel progetto genera zero CSS), maniglia trascinabile,
 * e pagina sotto ferma.
 */
export function FoglioAiuto({ onChiudi, onScrivi }) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)

  const passi = [
    ['Sei già seguito da un coach?', 'Scrivigli e chiedigli il codice invito: lo genera dalla sua app in due tocchi.'],
    ['Ti ha mandato un link?', 'Aprilo dal telefono: il codice si inserisce da solo e questa schermata non compare.'],
    ['Nessun coach, per ora?', 'Scrivici e ti mettiamo in contatto con uno.'],
  ]

  return createPortal(
    <div className={`fixed inset-0 z-[150] flex flex-col justify-end bg-black/85 touch-none ${classeVelo}`}
      style={stileVelo} onClick={chiudi}>
      <div role="dialog" aria-label="Non ho un codice" onClick={(e) => e.stopPropagation()} style={stileFoglio}
        className={`bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))]
                    max-h-[90dvh] overflow-y-auto hide-scrollbar shadow-[0_-25px_50px_-12px_rgba(0,0,0,.8)] ${classeFoglio}`}>

        <button type="button" aria-label="Chiudi" {...maniglia}
          className="w-full pt-3 pb-5 -mx-5 px-5 flex justify-center shrink-0 touch-none cursor-grab active:cursor-grabbing group">
          <span aria-hidden="true" className="w-10 h-[5px] rounded-full bg-white/20 group-hover:bg-white/35 transition-colors" />
        </button>

        <h2 className="text-[23px] font-black tracking-[-.025em] text-white mb-2">Il codice te lo dà il coach</h2>
        <p className="text-sm leading-[1.55] font-medium text-muted mb-5">
          FLEOFIT non è un'app a cui ci si iscrive da soli: si entra su invito di un coach, così il tuo programma arriva già collegato al suo.
        </p>
        <div className="flex flex-col gap-2.5 mb-5">
          {passi.map(([titolo, testo], i) => (
            <div key={titolo} className="rounded-2xl bg-[#111] border border-[#333] p-3.5 flex gap-3 items-start">
              <span className="w-[26px] h-[26px] rounded-full bg-brand/[.14] border border-brand/30 text-brand text-[13px] font-extrabold flex items-center justify-center shrink-0">{i + 1}</span>
              <p className="text-[13.5px] leading-[1.5] font-medium text-gray-300">
                <b className="text-white font-bold">{titolo}</b><br />{testo}
              </p>
            </div>
          ))}
        </div>
        <button type="button" onClick={onScrivi} className="w-full bg-surface2 border border-[#383838] rounded-2xl p-[15px] flex items-center justify-center gap-2.5 text-white text-base font-bold mb-2.5 hover:bg-[#333] transition">
          <MessageCircle size={18} className="text-gray-400" />
          Scrivi a FLEOFIT
        </button>
        <button type="button" onClick={chiudi} className="w-full text-center text-[15px] font-bold text-brand py-2">
          Torna al codice
        </button>
      </div>
    </div>,
    document.body
  )
}

/**
 * Il passo 1 dell'email.
 *
 * ⚠️ **Questo schermo non è disegnato**, e si vede: l'artboard copre il
 * benvenuto e il codice, e il suo `dv-next` dà il form email fra i prossimi
 * pezzi di design. Prende quindi la cornice condivisa — testata di passo,
 * titolo, campi, CTA — e niente di più. Vale la stessa scelta fatta per lo
 * step 2 della corsa nel builder (§9-undecies) e per il pannello filtri
 * dell'archivio: si implementa ciò che è disegnato, non ciò che è annunciato.
 */
export function CampoTesto({ icona, ...props }) {
  return (
    <div className={`${CARTA_RIGA_BASE} border border-white/[.07] flex items-center gap-3 px-3.5`}>
      <span className="text-gray-400 shrink-0">{icona}</span>
      <input
        {...props}
        className="flex-1 min-w-0 bg-transparent py-3.5 text-base text-white placeholder-muted focus:outline-none"
      />
    </div>
  )
}
