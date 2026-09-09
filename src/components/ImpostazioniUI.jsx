// ImpostazioniUI.jsx — i pezzi visivi della pagina Impostazioni.
//
// Stesso patto di HomeAtletaUI, ArchivioUI, AtletiUI e CalendarioUI: SOLA
// PRESENTAZIONE. Ricevono testo già formattato e callback già esistenti. Se
// qui dentro compare una `supabase`, un permesso push o un `BleClient`, è
// finito nel file sbagliato — quella roba resta in `src/pages/Settings.jsx`.
//
// Il rework in una riga: la pagina era cinque card dello stesso peso in un
// ordine che non è quello dell'uso — la prima schermata occupata dai codici
// invito, cioè la cosa che il coach fa una volta al mese — e ogni voce, anche
// un semplice acceso/spento, era un bottone alto 76px con titolo e
// sottotitolo. Non diceva mai la cosa che una pagina di impostazioni deve dire
// per prima: con quale account sei dentro, e cosa è attivo su questo telefono.

import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ChevronDown, User, LogOut, Plus, Copy, Link as LinkIcon, Trash2 } from 'lucide-react'
import { CARD, LABEL, VETRO } from '../lib/stiliCard'
import { useBottomSheet } from '../useBottomSheet'

// ── I toni delle icone ────────────────────────────────────────────────────
// Una tavolozza chiusa, non un colore per riga. Il colore qui è una CATEGORIA
// (marchio, allarme, riuscita, anteprima), non decorazione: se ogni riga
// prendesse il suo, nessuna direbbe più niente — è la Regola del Tratto Unico
// applicata a un elenco.

const TONI = {
  neutro: 'bg-white/[.07] border-white/[.11] text-gray-200',
  brand: 'bg-brand/[.13] border-brand/[.28] text-brand',
  rosso: 'bg-red-500/[.14] border-red-500/30 text-red-500',
  verde: 'bg-green-500/[.14] border-green-500/30 text-green-500',
  azzurro: 'bg-running/[.14] border-running/30 text-running',
}

/** Il quadratino dell'icona: 34px, lo stesso in ogni riga della pagina. */
function Pastiglia({ icona: Icona, tono = 'neutro', pieno = false }) {
  return (
    <span aria-hidden="true"
      className={`w-[34px] h-[34px] rounded-xl border flex items-center justify-center shrink-0 ${TONI[tono] || TONI.neutro}`}>
      <Icona size={18} fill={pieno ? 'currentColor' : 'none'} />
    </span>
  )
}

// ── Testata ───────────────────────────────────────────────────────────────

/**
 * Un solo titolo, e nient'altro.
 *
 * Prima ce n'erano DUE `h1` — il logo FLEOFIT e «Impostazioni» con un'icona di
 * database accanto — più il sottotitolo «Gestisci la tua app». Il logo in una
 * pagina raggiunta da una voce chiamata «Impostazioni» non dice niente, e un
 * database non sono le impostazioni: era l'icona di una delle cinque card
 * promossa a simbolo dell'intera pagina.
 */
export function TestataImpostazioni({ onIndietro }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <button type="button" aria-label="Torna indietro" onClick={onIndietro}
        className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-200
                    hover:text-white transition shrink-0 ${VETRO}`}>
        <ChevronLeft size={20} />
      </button>
      <h1 className="text-[26px] font-black tracking-[-.03em] text-white leading-none">Impostazioni</h1>
    </div>
  )
}

// ── L'eroe: chi sei, e cosa è acceso su questo telefono ───────────────────

/**
 * L'unica parte della pagina che contiene INFORMAZIONE e non destinazioni:
 * l'account con cui sei dentro, il ruolo che hai, e lo stato dei due
 * interruttori che valgono solo su questo dispositivo. Tutto il resto sono
 * azioni, e le azioni stanno bene in righe.
 */
export function CartaAccount({ nome, email, ruolo, etichettaDispositivo, children }) {
  return (
    <section aria-label="Account e dispositivo"
      className="relative overflow-hidden rounded-[26px] border border-brand/[.22]
                 bg-[linear-gradient(168deg,#232019_0%,#1b1b1d_46%,#161618_100%)]
                 shadow-[0_24px_48px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)]
                 hero-transition">
      {/* L'alone caldo in alto a destra: è atmosfera, non uno stato. Resta
          inerte ai tocchi, o si mangia il bersaglio della pillola del ruolo. */}
      <span aria-hidden="true" className="pointer-events-none absolute -top-[45%] -right-[30%] w-[260px] h-[260px]
                   bg-[radial-gradient(closest-side,rgba(241,186,23,.15),transparent_70%)]" />

      <div className="relative px-[18px] pt-5 pb-4 flex items-center gap-3.5">
        <span aria-hidden="true"
          className="w-[54px] h-[54px] rounded-full bg-[#2a2a2a] border border-[#3a3a3a]
                     flex items-center justify-center text-gray-400 shrink-0">
          <User size={24} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[19px] font-black tracking-[-.02em] text-white truncate">{nome}</p>
          <p className="mt-[3px] text-[12.5px] font-medium text-muted truncate">{email}</p>
        </div>
        <span className="shrink-0 font-mono text-[11px] font-black uppercase tracking-[.06em] leading-none
                         px-2.5 py-1.5 rounded-full bg-brand/[.14] border border-brand/[.32] text-brand">
          {ruolo}
        </span>
      </div>

      <div className="relative px-[18px] pb-[18px]">
        <p className={`mb-2.5 font-mono ${LABEL}`}>{etichettaDispositivo}</p>
        <div className="rounded-[18px] bg-black/[.42] border border-white/[.07] overflow-hidden">
          {children}
        </div>
      </div>
    </section>
  )
}

// ── Righe ─────────────────────────────────────────────────────────────────

/** Il filo fra due righe, rientrato sotto il testo come nelle liste di iOS. */
export function Separatore() {
  return <div aria-hidden="true" className="h-px bg-white/[.06] ml-[60px]" />
}

/**
 * L'interruttore.
 *
 * 🔴 È `role="switch"` e non un bottone qualsiasi: senza `aria-checked`, chi
 * usa VoiceOver sente «Notifiche push, pulsante» e non ha modo di sapere se
 * sono accese — che è l'unica informazione della riga. Prima il testo del
 * bottone cambiava da «Abilita notifiche» a «Disabilita notifiche» per dire
 * dov'era: un comando travestito da stato, che si legge al contrario la metà
 * delle volte.
 */
export function Interruttore({ attivo, onCambia, occupato = false, etichetta, tono = 'brand' }) {
  const acceso = tono === 'rosso' ? 'bg-red-500 shadow-[0_6px_12px_-4px_rgba(239,68,68,.5)]'
    : 'bg-brand shadow-[0_6px_12px_-4px_rgba(241,186,23,.5)]'
  return (
    <button type="button" role="switch" aria-checked={attivo} aria-label={etichetta}
      onClick={onCambia} disabled={occupato}
      className={`shrink-0 w-[51px] h-[31px] rounded-full flex items-center p-0.5 transition-colors duration-200
                  disabled:opacity-50 ${occupato ? 'animate-pulse' : ''} ${
        attivo ? `justify-end ${acceso}` : 'justify-start bg-white/10 border border-white/[.12]'}`}>
      <span aria-hidden="true"
        className={`w-[27px] h-[27px] rounded-full transition-colors ${
          attivo ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,.4)]' : 'bg-[#8b8f9c]'}`} />
    </button>
  )
}

/** Una riga che porta un interruttore: il titolo non è cliccabile, lo switch sì. */
export function RigaInterruttore({ icona, tono = 'neutro', pieno = false, titolo, dettaglio, classeDettaglio = 'text-muted', attivo, onCambia, occupato }) {
  return (
    <div className="px-3.5 py-[13px] flex items-center gap-3">
      <Pastiglia icona={icona} tono={tono} pieno={pieno} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-white">{titolo}</p>
        {dettaglio && <p className={`mt-0.5 text-xs font-medium ${classeDettaglio}`}>{dettaglio}</p>}
      </div>
      <Interruttore attivo={attivo} onCambia={onCambia} occupato={occupato}
        etichetta={titolo} tono={tono === 'rosso' ? 'rosso' : 'brand'} />
    </div>
  )
}

/**
 * Una riga che porta altrove (o apre un foglio).
 *
 * ⚠️ `occupato` sostituisce il banner giallo «Operazione in corso, attendere
 * prego...» che stava in cima alla pagina: uno stato di caricamento staccato
 * dalla cosa che l'ha causato costringe a ricordarsi cosa si è appena premuto,
 * e su una pagina con nove comandi non è una domanda banale.
 */
export function RigaAzione({ icona, tono = 'neutro', titolo, dettaglio, onClick, occupato = false, etichetta }) {
  return (
    <button type="button" onClick={onClick} disabled={occupato} aria-label={etichetta}
      className="w-full px-3.5 py-3.5 flex items-center gap-3 text-left transition
                 hover:bg-white/[.04] active:scale-[.995] disabled:opacity-50">
      <Pastiglia icona={icona} tono={tono} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-white">{titolo}</p>
        {dettaglio && <p className="mt-0.5 text-xs font-medium text-muted">{occupato ? 'In corso…' : dettaglio}</p>}
      </div>
      <ChevronRight size={17} className="text-[#5b6070] shrink-0" aria-hidden="true" />
    </button>
  )
}

/**
 * La riga distruttiva, fuori dal gruppo e con la sua cornice rossa.
 *
 * Prima «Ripristina database totale — sovrascrive tutti i dati esistenti»
 * aveva lo stesso aspetto di «Esporta»: due righe grigie identiche, una
 * innocua e una che può cancellare il lavoro di un anno. La conferma esisteva
 * già; quello che mancava era che il rischio si vedesse PRIMA del tocco.
 */
export function RigaPericolo({ icona: Icona, titolo, dettaglio, onClick, occupato = false }) {
  return (
    <button type="button" onClick={onClick} disabled={occupato}
      className="w-full rounded-[22px] px-3.5 py-3.5 flex items-center gap-3 text-left transition
                 bg-red-500/[.07] border border-red-500/[.24] hover:bg-red-500/[.11]
                 active:scale-[.995] disabled:opacity-50">
      <span aria-hidden="true"
        className="w-[34px] h-[34px] rounded-xl bg-red-500/[.16] border border-red-500/[.32]
                   text-red-500 flex items-center justify-center shrink-0">
        <Icona size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-red-500">{titolo}</p>
        <p className="mt-0.5 text-xs font-medium text-muted">{occupato ? 'In corso…' : dettaglio}</p>
      </div>
      <ChevronRight size={17} className="text-red-500/60 shrink-0" aria-hidden="true" />
    </button>
  )
}

/**
 * Una riga che si apre in pagina.
 *
 * Serve alle 90 parole sul Garmin e sul «Trasmetti FC»: sono giuste, e non
 * vanno rilette ogni volta che si apre Impostazioni. Sotto una riga si trovano
 * quando servono, e nel frattempo non occupano mezzo schermo.
 */
export function RigaPieghevole({ icona, tono = 'neutro', titolo, aperto, onToggle, piccola = false, children }) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={aperto}
        className={`w-full flex items-center gap-3 text-left transition hover:bg-white/[.04] ${
          piccola ? 'px-3.5 py-3' : 'px-3.5 py-3.5'}`}>
        {icona && <Pastiglia icona={icona} tono={tono} />}
        <span className={`flex-1 font-bold ${piccola ? 'text-[12.5px] text-muted' : 'text-[15px] text-white'}`}>
          {titolo}
        </span>
        <ChevronDown size={16} aria-hidden="true"
          className={`text-[#5b6070] shrink-0 transition-transform duration-300 ${aperto ? 'rotate-180' : ''}`} />
      </button>
      {aperto && <div className="px-3.5 pb-3.5 -mt-0.5">{children}</div>}
    </div>
  )
}

// ── Sezioni ───────────────────────────────────────────────────────────────

/** Etichetta in monospazio + la carta che raccoglie le righe. */
export function Sezione({ etichetta, children }) {
  return (
    <section aria-label={etichetta}>
      {etichetta && <p className={`mb-2 pl-1 font-mono ${LABEL}`}>{etichetta}</p>}
      <div className={`${CARD} overflow-hidden`}>{children}</div>
    </section>
  )
}

/** Il bottone di uscita: pieno quanto la pagina, rosso, e in fondo a tutto. */
export function BottoneEsci({ onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`${CARD} w-full px-3.5 py-3.5 flex items-center justify-center gap-2.5
                  text-red-500 transition hover:bg-red-500/[.06] active:scale-[.995]`}>
      <LogOut size={18} aria-hidden="true" />
      <span className="text-[15px] font-extrabold">Esci dall'account</span>
    </button>
  )
}

/**
 * Il piede della pagina.
 *
 * ⚠️ La versione arriva da `App.getInfo()` di Capacitor, cioè dal bundle
 * nativo. Sul web quella lettura non esiste e la riga NON compare: scrivere a
 * mano «FLEOFIT 1.1.0» qui dentro creerebbe una quarta copia di un numero che
 * vive già nel `pbxproj`, e che Xcode incrementa da solo a ogni archive
 * (CLAUDE.md §9-ter) — cioè un numero destinato a essere sbagliato.
 */
export function PiediPagina({ versione, email }) {
  return (
    <p className="mt-2 text-center font-mono text-[11px] font-bold leading-[1.6] tracking-[.08em] text-[#5b6070]">
      {versione && <>{versione}<br /></>}
      {email}
    </p>
  )
}

// ── Il foglio dei codici invito ───────────────────────────────────────────
//
// Prima erano una CARD con due accordion dentro, in cima alla pagina: un
// pozzetto dentro un pozzetto (contro la Regola dei Gradini), e la prima cosa
// che il coach vedeva aprendo Impostazioni — cioè la cosa che fa una volta al
// mese messa davanti a tutto. Ora la pagina ne porta solo il numero, e la
// lista si apre nel suo foglio, dove ha lo spazio che le serve.
//
// ⚠️ Un foglio e non una rotta nuova: l'artboard disegna una schermata
// dedicata ma il suo `dv-next` la dà fra i PROSSIMI pezzi di design («mostrami
// la schermata Codici invito»). Vale la stessa scelta fatta per il pannello
// dei filtri avanzati dell'archivio (§9-sedecies): si implementa ciò che è
// disegnato, non ciò che è annunciato.

export function FoglioCodici({
  onChiudi, codici, caricamento, onGenera, onCopia, onCopiaLink, onElimina, generando,
}) {
  const { chiudi, maniglia, stileFoglio, stileVelo, classeFoglio, classeVelo } = useBottomSheet(onChiudi)

  const attivi = (codici || []).filter(c => c.is_active)
  const usati = (codici || []).filter(c => !c.is_active && c.used_by)

  return createPortal(
    <div className={`fixed inset-0 z-[100] flex flex-col justify-end bg-black/85 touch-none ${classeVelo}`}
      style={stileVelo} onClick={chiudi}>
      <div role="dialog" aria-label="Codici invito" onClick={(e) => e.stopPropagation()}
        style={stileFoglio}
        className={`bg-[#141416] border-t border-white/[.09] rounded-t-3xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]
                    flex flex-col max-h-[85dvh] shadow-[0_-20px_50px_-12px_rgba(0,0,0,.85)] ${classeFoglio}`}>

        <button type="button" aria-label="Chiudi i codici invito" {...maniglia}
          className="w-full pt-3 pb-2.5 -mx-4 px-4 flex justify-center shrink-0 touch-none
                     cursor-grab active:cursor-grabbing group">
          <span aria-hidden="true"
            className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/35 group-active:bg-white/45 transition-colors" />
        </button>

        <div className="flex items-center justify-between gap-3 shrink-0 pb-3">
          <h2 className="text-xl font-black tracking-[-.02em] text-white">Codici invito</h2>
          <button type="button" onClick={onGenera} disabled={generando}
            className="flex items-center gap-1.5 bg-brand text-black text-sm font-bold px-3.5 py-2
                       rounded-full hover:brightness-110 transition disabled:opacity-50">
            <Plus size={16} aria-hidden="true" /> {generando ? 'Genero…' : 'Genera'}
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain hide-scrollbar flex flex-col gap-2 pb-2">
          {caricamento && <p className="text-muted text-xs py-2">Caricamento…</p>}

          {!caricamento && (
            <>
              <p className={`font-mono ${LABEL} pt-1`}>Attivi · {attivi.length}</p>
              {attivi.length === 0
                ? <p className="text-muted text-xs pb-1">Nessun codice attivo. Generane uno nuovo.</p>
                : attivi.map(c => (
                  <div key={c.id} className="rounded-2xl bg-white/[.05] border border-white/[.08] p-3
                                             flex items-center justify-between gap-2">
                    <span className="font-mono text-lg text-brand tracking-widest">{c.code}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <BottoneCodice etichetta={`Copia il codice ${c.code}`} icona={Copy} onClick={() => onCopia(c)} />
                      <BottoneCodice etichetta={`Copia il link di invito per ${c.code}`} icona={LinkIcon} onClick={() => onCopiaLink(c)} />
                      <BottoneCodice etichetta={`Elimina il codice ${c.code}`} icona={Trash2} pericolo onClick={() => onElimina(c)} />
                    </div>
                  </div>
                ))}

              <p className={`font-mono ${LABEL} pt-3`}>Usati · {usati.length}</p>
              {usati.length === 0
                ? <p className="text-muted text-xs">Nessun codice è stato ancora utilizzato.</p>
                : usati.map(c => (
                  <div key={c.id} className="rounded-2xl bg-white/[.03] border border-white/[.06] p-3
                                             flex items-center gap-3">
                    <span className="font-mono text-sm text-muted line-through shrink-0">{c.code}</span>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-[13px] font-semibold text-gray-300 truncate">
                        {c.riscattato_da || 'Utente sconosciuto'}
                      </p>
                      {c.riscattato_il && (
                        <p className="font-mono text-[10.5px] uppercase tracking-[.08em] text-muted truncate">
                          {c.riscattato_il}
                        </p>
                      )}
                    </div>
                    <BottoneCodice etichetta={`Elimina il codice ${c.code}`} icona={Trash2} pericolo onClick={() => onElimina(c)} />
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function BottoneCodice({ etichetta, icona: Icona, onClick, pericolo = false }) {
  return (
    <button type="button" aria-label={etichetta} onClick={onClick}
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${VETRO} ${
        pericolo ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-white'}`}>
      <Icona size={16} aria-hidden="true" />
    </button>
  )
}
