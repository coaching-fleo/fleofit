// ReportUI.jsx — i pezzi visivi del report settimanale del coach.
//
// Stesso patto di HomeCoachUI, AtletiUI, ArchivioUI e CalendarioUI: SOLA
// PRESENTAZIONE. Ricevono numeri già calcolati (`src/lib/reportSettimanale.js`)
// e callback già esistenti. Se qui dentro compare una `supabase`, un
// `useEffect` di rete o una regola su cosa significhi «da scaricare», è finito
// nel file sbagliato.
//
// ⚠️ UNA SOLA CORNICE COLORATA in pagina, ed è la fascia «Da fare adesso».
// Vale la stessa regola della fascia «Da richiamare» della rubrica: una
// seconda cornice arancione la trasformerebbe in atmosfera invece che in
// allarme. Le pillole di verdetto sulle righe sono piccole di proposito.

import { ChevronLeft, ChevronRight, User, Mic, Plus, AlertTriangle,
         CheckCircle2, Inbox, Pause } from 'lucide-react'
import { CARD, LABEL, RIGA, CARTA_RIGA_BASE, VETRO, TONO_VERDETTO } from '../lib/stiliCard'
import { corsia } from '../lib/categorie'
import { decimale, oreMinuti, VERDETTI } from '../lib/reportSettimanale'
import { useNumeroCheSale } from '../useNumeroCheSale'
import { vibraScelta } from '../lib/aptica'

// ── Pezzi minuti, non esportati ───────────────────────────────────────────

/** Il volto, con il ripiego quando la foto manca o non carica. */
function Volto({ foto, dimensione = 38 }) {
  return (
    <span style={{ width: dimensione, height: dimensione }}
      className="rounded-full bg-surface2 border border-white/[.09] shrink-0 overflow-hidden
                 flex items-center justify-center text-gray-400">
      {foto
        ? <img src={foto} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0 }} />
        : <User size={17} aria-hidden="true" />}
    </span>
  )
}

function PillolaVerdetto({ verdetto }) {
  const v = VERDETTI[verdetto]
  if (!v) return null
  return (
    <span className={`shrink-0 whitespace-nowrap px-2 py-1 rounded-full border text-[10.5px] font-black
                      uppercase tracking-[.06em] ${TONO_VERDETTO[v.tono]}`}>
      {v.etichetta}
    </span>
  )
}

/** Una barra a segmenti: uno per allenamento, pieno se chiuso. */
function Tacche({ completati, assegnati, massimo = 7 }) {
  if (assegnati <= 0) return null
  if (assegnati > massimo) {
    // Oltre la soglia le tacche diventano schegge: una barra proporzionale
    // dice la stessa cosa in larghezza fissa (stessa regola di `rigaAtleta`).
    return (
      <span aria-hidden="true" className="inline-block w-14 h-[5px] rounded-full bg-white/[.12] overflow-hidden align-middle">
        <span className="block h-full rounded-full bg-green-500"
          style={{ width: `${Math.round((completati / assegnati) * 100)}%` }} />
      </span>
    )
  }
  return (
    <span aria-hidden="true" className="inline-flex gap-[3px] align-middle">
      {Array.from({ length: assegnati }, (_, i) => (
        <span key={i} className={`w-[9px] h-[5px] rounded-full ${i < completati ? 'bg-green-500' : 'bg-white/[.14]'}`} />
      ))}
    </span>
  )
}

// ── Testata ───────────────────────────────────────────────────────────────

/**
 * La testata con il navigatore di settimana, appiccicata in cima.
 *
 * ⚠️ La safe area la porta QUESTO elemento, non la pagina: un `pt` sul
 * contenitore lascerebbe scorrere il contenuto sotto la barra di stato, perché
 * l'elemento appiccicato si ferma a `top-0`. Stessa nota di `TestataAtleti`.
 *
 * ⚠️ «Successiva» si spegne sul futuro invece di sparire: un comando che
 * compare e scompare sposta l'altro di mezza riga a ogni tocco.
 */
export function TestataReport({ etichetta, numero, corrente, avanti, onIndietro, onPrecedente, onSuccessiva }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 pt-[calc(env(safe-area-inset-top)+0.875rem)] pb-3
                    bg-[#0B0B0B]/85 backdrop-blur-xl border-b border-white/[.06]">
      <div className="flex items-center gap-3">
        <button onClick={onIndietro} aria-label="Torna indietro"
          className={`shrink-0 w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-white`}>
          <ChevronLeft size={19} aria-hidden="true" />
        </button>
        <h1 className="flex-1 min-w-0 text-2xl font-black tracking-[-.03em] text-white leading-none">Report</h1>
        <div className="shrink-0 flex items-center gap-1.5">
          <button onClick={onPrecedente} aria-label="Settimana precedente"
            className={`w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-white`}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button onClick={onSuccessiva} disabled={!avanti} aria-label="Settimana successiva"
            className={`w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-white
                        disabled:opacity-30 disabled:pointer-events-none`}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      {/* ⚠️ La riga della settimana sta SOTTO e prende tutta la larghezza: in
          mezzo ai quattro bottoni tondi le restavano centoquaranta pixel, e
          «31 ago – 6 set» finiva in «31 ago – …» — cioè spariva proprio la
          data, che è l'unica cosa che dice quale settimana si sta guardando.
          Trovato guardando la pagina a 375px, non leggendo il codice. */}
      <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[.1em] text-muted leading-none truncate">
        Settimana {numero} · {etichetta}{corrente ? ' · in corso' : ''}
      </p>
    </div>
  )
}

// ── L'eroe: la settimana in una frase ─────────────────────────────────────
//
// Regola dell'Eroe Unico: la pagina ha una cosa sola che si legge da lontano,
// ed è l'aderenza della squadra con la frase che dice cosa farne. Tutto il
// resto è materiale per verificarla.

export function EroeSettimana({
  percentuale, completati, assegnati, daVenire, trascorsi, corrente, atleti, frase,
}) {
  return (
    <div className="relative overflow-hidden rounded-[26px] p-5 mt-4 border border-brand/20
                    bg-gradient-to-br from-[#232019] via-[#1b1b1d] to-[#161618]
                    shadow-[0_24px_48px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)]">
      {/* ⚠️ `alone` e non `blur-2xl`: sotto un'animazione di opacità la sfocatura
          cambia colore nell'istante in cui l'animazione finisce — WebKit la rende
          sul layer GPU e la ridipinge dalla CPU quando il layer viene liberato
          (misurato sul simulatore, src/index.css). */}
      <div aria-hidden="true" style={{ '--alone-rgb': '241 186 23', '--alone-alfa': .16 }}
        className="alone -top-[208px] -right-[176px] h-[416px] w-[416px]" />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={`${LABEL} mb-2`}>Aderenza della squadra</p>
            {assegnati > 0 ? (
              <h2 className="text-[44px] font-black leading-[.92] tracking-[-.02em] text-white">
                {percentuale}<span className="text-[24px]">%</span>
                <span className="text-[17px] font-bold tracking-[-.01em] text-muted"> · {completati} di {assegnati}</span>
              </h2>
            ) : (
              <h2 className="text-[26px] font-black leading-tight tracking-[-.02em] text-white">
                {daVenire > 0 ? 'Settimana appena iniziata' : 'Nessun allenamento'}
              </h2>
            )}
          </div>
          <div className="shrink-0 text-right">
            <span className="block text-[13px] font-extrabold text-brand">{atleti} {atleti === 1 ? 'atleta' : 'atleti'}</span>
            {/* ⚠️ «giorno 3 di 7» non è decorazione: senza, un 40% al martedì
                si legge come un disastro invece che come una settimana a metà. */}
            {corrente && (
              <span className="block mt-0.5 text-xs font-bold text-muted">giorno {trascorsi} di 7</span>
            )}
          </div>
        </div>

        {assegnati > 0 && (
          <div aria-hidden="true" className="flex gap-1 h-2">
            <span className="rounded-full bg-green-500" style={{ flex: completati || 0 }} />
            <span className="rounded-full bg-white/[.14]" style={{ flex: Math.max(0, assegnati - completati) }} />
            {daVenire > 0 && <span className="rounded-full bg-white/[.06] border border-dashed border-white/[.14]" style={{ flex: daVenire }} />}
          </div>
        )}

        <div className="rounded-2xl px-3.5 py-3 bg-black/[.42] border border-white/[.07]">
          <p className="text-[14.5px] font-extrabold tracking-[-.01em] text-white leading-snug">{frase.testo}</p>
          {frase.dettaglio && <p className="mt-1 text-[12.5px] font-medium text-muted leading-snug">{frase.dettaglio}</p>}
        </div>

        {daVenire > 0 && (
          <p className="text-xs font-bold text-[#5b6070] -mt-1">
            {daVenire} {daVenire === 1 ? 'allenamento ancora' : 'allenamenti ancora'} in programma nei giorni che restano.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Il bento dei tre numeri ───────────────────────────────────────────────

/**
 * Lo scarto sulla settimana precedente.
 *
 * ⚠️ Si mostra SOLO a settimana finita (`confrontabile`): su una settimana in
 * corso confronterebbe tre giorni con sette, e un «−58%» al mercoledì è
 * aritmetica giusta e informazione falsa.
 */
function Scarto({ valore, confrontabile }) {
  if (!confrontabile || valore == null) return null
  const su = valore > 0
  return (
    <span className={`ml-1.5 font-mono text-[11px] font-black ${su ? 'text-green-400' : valore < 0 ? 'text-orange-400' : 'text-muted'}`}>
      {su ? '+' : ''}{valore}%
    </span>
  )
}

function Cella({ etichetta, children, nota }) {
  return (
    <div className={`${CARD} p-4 flex flex-col justify-between gap-2 min-w-0`}>
      <p className={LABEL}>{etichetta}</p>
      <p className="text-[21px] font-black tracking-[-.02em] text-white leading-none truncate">{children}</p>
      {nota && <p className="text-[11px] font-bold text-[#5b6070] leading-none truncate">{nota}</p>}
    </div>
  )
}

export function BentoSettimana({ squadra }) {
  const { minuti, carico, caricoParziale, rpeMedio, senzaRpe, completati, delta } = squadra
  // ⚠️ Si anima il NUMERO, non il formato: `oreMinuti` riceve i minuti che
  // salgono e li impagina a ogni fotogramma, così «6h 15» si compone da sé.
  const minutiCheSalgono = useNumeroCheSale(minuti)
  // ⚠️ Il carico sale solo se c'è: a zero la cella scrive «—», e un trattino
  // non conta fino a niente (regola di `rpeAtteso`).
  const caricoCheSale = useNumeroCheSale(carico > 0 ? carico : null)
  return (
    <div className="grid grid-cols-3 gap-2.5 mt-3">
      <Cella etichetta="Volume" nota={`${completati} ${completati === 1 ? 'sessione' : 'sessioni'}`}>
        {oreMinuti(minutiCheSalgono)}<Scarto valore={delta.minuti} confrontabile={delta.confrontabile} />
      </Cella>

      {/* 🔴 Il `≈` compare quando il totale ha dovuto lasciare fuori qualcosa —
          le sessioni chiuse senza RPE dichiarato. È lo stesso glifo del volume
          nel calendario, e per la stessa ragione: un totale parziale che si
          presenta come completo è peggio di un totale mancante. */}
      <Cella etichetta="Carico"
        nota={caricoParziale ? `${senzaRpe} senza RPE` : 'minuti × RPE'}>
        {carico > 0 ? <>{caricoParziale ? '≈' : ''}{caricoCheSale}<Scarto valore={delta.carico} confrontabile={delta.confrontabile} /></> : '—'}
      </Cella>

      {/* `null` e non 5: chi non ha dichiarato niente non ha una media. */}
      <Cella etichetta="RPE medio" nota={rpeMedio != null ? 'dichiarato' : 'nessuno dichiarato'}>
        {rpeMedio != null ? decimale(rpeMedio) : '—'}
      </Cella>
    </div>
  )
}

// ── La fascia delle azioni ────────────────────────────────────────────────

/**
 * L'unico blocco con bordo colorato della pagina: quanti atleti chiedono
 * qualcosa, e cosa. Porta alla lista già filtrata — un allarme senza
 * destinazione è una decorazione.
 */
export function FasciaAzioni({ testo, dettaglio, attiva, onApri }) {
  return (
    <button onClick={() => { vibraScelta(); onApri() }} aria-pressed={attiva}
      className={`w-full text-left mt-4 rounded-[18px] px-4 py-3.5 flex items-center gap-3.5 transition
                  bg-gradient-to-r from-orange-500/10 to-orange-500/[.02]
                  shadow-[inset_0_1px_0_rgba(255,255,255,.05)]
                  ${attiva ? 'border-2 border-orange-500/60' : 'border border-orange-500/[.28] hover:border-orange-500/50'}`}>
      <AlertTriangle size={19} className="shrink-0 text-orange-400" aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block font-mono text-[11px] font-bold uppercase tracking-[.1em] text-orange-400 leading-none">
          Da fare adesso
        </span>
        <span className="block mt-1.5 text-sm font-bold tracking-[-.01em] text-white">{testo}</span>
        {dettaglio && <span className="block mt-0.5 text-xs font-medium text-muted">{dettaglio}</span>}
      </span>
      <ChevronRight size={17} className={`shrink-0 text-orange-400 transition-transform ${attiva ? 'rotate-90' : ''}`}
        aria-hidden="true" />
    </button>
  )
}

/** Nessuno chiede niente: lo stato buono si dichiara, o si legge come un guasto. */
export function NessunaAzione({ atleti }) {
  return (
    <div className="mt-4 rounded-[18px] px-4 py-3.5 flex items-center gap-3.5 border border-green-500/25
                    bg-gradient-to-r from-green-500/[.08] to-transparent
                    shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
      <CheckCircle2 size={19} className="shrink-0 text-green-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[.1em] text-green-400 leading-none">Da fare adesso</p>
        <p className="mt-1.5 text-sm font-bold tracking-[-.01em] text-white">Niente</p>
        <p className="mt-0.5 text-xs font-medium text-muted">
          {atleti === 1 ? 'Il tuo atleta è' : `Tutti e ${atleti} gli atleti sono`} nei parametri della settimana.
        </p>
      </div>
    </div>
  )
}

// ── La riga per atleta ────────────────────────────────────────────────────

/**
 * Una riga per atleta: il verdetto, il perché, e i tre numeri su cui si può
 * verificare.
 *
 * ⚠️ Il moltiplicatore di carico si mostra solo quando esiste (`acwr != null`).
 * Un «1,0×» inventato dove il dato non c'è si legge come «tutto normale», che
 * è esattamente ciò che non si sa.
 */
export function RigaReport({ riga, onApri }) {
  const meta = [
    riga.assegnati > 0 ? `${riga.completati}/${riga.assegnati}` : null,
    riga.minuti > 0 ? oreMinuti(riga.minuti) : null,
    riga.rpeMedio != null ? `RPE ${decimale(riga.rpeMedio)}` : null,
    riga.acwr != null ? `carico ${decimale(riga.acwr)}×` : null,
    riga.daVenire > 0 ? `${riga.daVenire} in programma` : null,
  ].filter(Boolean)

  return (
    <button onClick={() => onApri(riga)}
      aria-label={`${riga.nome}: ${VERDETTI[riga.verdetto].etichetta}. ${riga.motivo}`}
      className={`${CARTA_RIGA_BASE} border border-white/[.07] w-full text-left px-3.5 py-3 flex items-start gap-3
                  transition active:scale-[.99] hover:border-brand/40`}>
      <Volto foto={riga.foto} />
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 min-w-0">
          <span className="flex-1 text-[14.5px] font-extrabold text-white truncate">{riga.nome}</span>
          <PillolaVerdetto verdetto={riga.verdetto} />
        </span>
        <span className="block mt-1 text-[12.5px] font-medium text-muted leading-snug">{riga.motivo}</span>
        {/* ⚠️ Va a capo, NON tronca. Il moltiplicatore di carico è l'ultimo
            della fila ed è la ragione stessa del verdetto «da scaricare»: su
            375px «carico 2,03×» diventava «carico…», cioè si perdeva il numero
            per cui quella riga è in cima alla pagina. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
          <Tacche completati={riga.completati} assegnati={riga.assegnati} />
          <span className="font-mono text-[11px] font-bold text-[#5b6070] leading-snug">{meta.join(' · ')}</span>
        </span>
      </span>
    </button>
  )
}

/** La legenda del moltiplicatore: senza, «1,8×» è un numero senza unità. */
export function NotaCarico({ settimane }) {
  return (
    <p className="mt-3 px-0.5 text-[11px] leading-relaxed text-[#5b6070]">
      Il <strong className="font-bold text-muted">carico</strong> è minuti × RPE dichiarato. Il
      moltiplicatore confronta la settimana con la media delle ultime {settimane}: sopra 1,5 è un
      salto, sotto 0,8 è uno scarico. Compare solo quando ci sono abbastanza sessioni con l'RPE segnato.
    </p>
  )
}

// ── Il mix della settimana ────────────────────────────────────────────────

/**
 * Di che cosa era fatta la settimana, per corsia.
 *
 * ⚠️ Le corsie si derivano dai dati, come i chip dell'archivio: una voce
 * «Running» in una settimana senza corse è la legenda di un colore che non
 * compare in nessuna riga.
 */
export function MixCorsie({ corsie, totale }) {
  if (corsie.length < 2) return null
  return (
    <div className={`${CARD} p-4 mt-3`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={LABEL}>Mix della settimana</p>
        <span className="font-mono text-[11px] font-bold text-[#5b6070]">{totale} assegnati</span>
      </div>
      <div aria-hidden="true" className="flex gap-1 mt-3 h-2.5">
        {corsie.map(c => (
          <span key={c.categoria} className={`rounded-full ${corsia(c.categoria).dot}`} style={{ flex: c.sessioni }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {corsie.map(c => (
          <span key={c.categoria} className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-200">
            <span aria-hidden="true" className={`w-2 h-2 rounded-full ${corsia(c.categoria).dot}`} />
            {c.etichetta} <span className="text-[#5b6070]">{c.sessioni}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Programmare la settimana successiva ───────────────────────────────────

/**
 * Chi non ha ancora niente per la settimana che viene.
 *
 * È l'unica sezione del report che guarda avanti, ed è la ragione per cui il
 * report è utile anche il lunedì mattina, quando la settimana in corso non ha
 * ancora niente da raccontare.
 */
export function SezioneProgramma({ prossima, onApriAtleta, onCrea }) {
  const tutti = prossima.senza === 0
  return (
    <div className={`${CARD} p-[18px] mt-3 flex flex-col gap-3.5`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={LABEL}>Settimana prossima</p>
        <span className="font-mono text-[11px] font-bold text-[#5b6070]">{prossima.etichetta}</span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className={`text-[15px] font-extrabold ${tutti ? 'text-green-500' : 'text-white'}`}>
          {tutti ? 'Tutti programmati' : `${prossima.senza} ${prossima.senza === 1 ? 'atleta' : 'atleti'} senza allenamenti`}
        </p>
        <span className="shrink-0 text-[28px] font-black tracking-[-.01em] text-white leading-[.9]">
          {prossima.coperti}<span className="text-[15px] text-muted tracking-[.02em] pl-0.5">/{prossima.totale}</span>
        </span>
      </div>

      {!tutti && (
        <div className="flex flex-col gap-2">
          {prossima.righe.map(a => (
            <button key={a.id} onClick={() => onApriAtleta(a)} aria-label={`Programma per ${a.nome}`}
              className={`${RIGA} w-full text-left px-3.5 py-2.5 flex items-center gap-3 transition
                          hover:bg-white/[.06] active:scale-[.99]`}>
              <Volto foto={a.foto} dimensione={32} />
              <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">{a.nome}</span>
              <span className="shrink-0 px-3 py-1.5 rounded-[11px] bg-white/[.07] border border-white/[.12] text-white text-xs font-extrabold">
                Assegna
              </span>
            </button>
          ))}
        </div>
      )}

      {/* L'unica superficie gialla piena della pagina, e sta qui e non in
          testa: la Regola del Tratto Unico vale sul report come altrove, e
          questo è il solo punto in cui il coach deve creare qualcosa. */}
      <button onClick={onCrea}
        className="w-full rounded-[14px] py-3 bg-brand text-black text-sm font-black flex items-center justify-center gap-2
                   shadow-[0_12px_26px_-12px_rgba(241,186,23,.6),inset_0_1px_0_rgba(255,255,255,.35)]
                   transition active:scale-[.99] hover:brightness-110">
        <Plus size={17} strokeWidth={2.6} aria-hidden="true" /> Crea workout
      </button>
    </div>
  )
}

// ── Il feedback della settimana ───────────────────────────────────────────

export function FeedbackReport({ elementi, mostrate, espanso, onEspandi, onApri }) {
  const visibili = espanso ? elementi : elementi.slice(0, mostrate)
  const restanti = elementi.length - visibili.length
  return (
    <div className={`${CARD} p-[18px] mt-3 flex flex-col gap-3.5`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={LABEL}>Cosa ti hanno detto</p>
        <span className="font-mono text-[11px] font-bold text-[#5b6070]">{elementi.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {visibili.map(f => (
          <button key={f.id} onClick={() => onApri(f)} aria-label={`Apri il feedback di ${f.nome}`}
            className={`${RIGA} w-full text-left px-3.5 py-2.5 transition hover:bg-white/[.06] active:scale-[.99]`}>
            <span className="flex items-center gap-2 min-w-0">
              <span className="flex-1 text-[13.5px] font-extrabold text-white truncate">{f.nome}</span>
              {f.rpe != null && (
                <span className={`shrink-0 font-mono text-[11px] font-black px-1.5 py-1 rounded-full border
                  ${f.rpe >= 9 ? 'bg-brand/[.14] border-brand/30 text-brand' : 'bg-white/[.07] border-white/[.13] text-gray-200'}`}>
                  RPE {f.rpe}
                </span>
              )}
              {f.haVocale && <Mic size={13} className="shrink-0 text-brand" aria-label="nota vocale" />}
              <span className="shrink-0 font-mono text-[11px] font-bold text-[#5b6070]">{f.giorno}</span>
            </span>
            <span className="block mt-1 text-[12.5px] font-medium text-muted truncate">
              {f.testo ? `«${f.testo}»` : f.titolo}
            </span>
          </button>
        ))}
      </div>
      {restanti > 0 && (
        <button onClick={onEspandi} aria-expanded={espanso}
          className="flex items-center justify-center gap-1.5 text-[12.5px] font-extrabold text-muted transition hover:text-white">
          +{restanti} altr{restanti === 1 ? 'o' : 'i'}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

// ── In pausa ──────────────────────────────────────────────────────────────

/**
 * Chi si è fermato per scelta, in fondo e senza peso visivo.
 *
 * Esce da ogni numero del report — aderenza, carico, copertura — ma non
 * dall'elenco: è l'unico posto, insieme alla rubrica, in cui il coach si
 * accorge di averne messo in pausa uno e dimenticato (CLAUDE.md §9-decies).
 */
export function SezionePausa({ righe }) {
  return (
    <div className="mt-3 rounded-[18px] px-4 py-3.5 bg-white/[.03] border border-white/[.06]">
      <div className="flex items-center gap-2">
        <Pause size={14} className="text-orange-400/70" aria-hidden="true" />
        <p className={LABEL}>In pausa · {righe.length}</p>
      </div>
      <p className="mt-2 text-[12.5px] font-medium text-muted leading-snug">
        {righe.map(r => r.dal ? `${r.nome} (dal ${r.dal})` : r.nome).join(' · ')}
      </p>
      <p className="mt-1.5 text-[11px] font-bold text-[#5b6070]">Fuori da tutti i numeri qui sopra.</p>
    </div>
  )
}

// ── Vuoto e scheletro ─────────────────────────────────────────────────────

export function VuotoReport({ titolo, dettaglio }) {
  return (
    <div className="mt-4 rounded-[22px] border border-dashed border-white/[.12] p-8 flex flex-col items-center text-center gap-3">
      <span className="w-14 h-14 rounded-full bg-white/[.05] border border-white/[.09] flex items-center justify-center text-muted">
        <Inbox size={26} aria-hidden="true" />
      </span>
      <p className="text-[15px] font-extrabold text-white">{titolo}</p>
      <p className="text-[12.5px] font-medium text-muted max-w-xs leading-relaxed">{dettaglio}</p>
    </div>
  )
}

export function ScheletroReport() {
  return (
    <div className="mt-4 flex flex-col gap-2.5" aria-hidden="true">
      <div className="h-[188px] rounded-[26px] bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map(i => <div key={i} className="h-[86px] rounded-[22px] bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />)}
      </div>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-[84px] rounded-2xl bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />
      ))}
    </div>
  )
}
