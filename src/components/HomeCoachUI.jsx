// HomeCoachUI.jsx — i pezzi visivi della Home del coach.
//
// Stesso patto di HomeAtletaUI.jsx: SOLA PRESENTAZIONE. Ricevono numeri già
// calcolati (src/lib/statisticheCoach.js) e callback già esistenti. Se qui
// dentro compare una `supabase`, un `useEffect` o una regola su cosa conta
// come "fermo", è finito nel file sbagliato.
//
// Il rework in una riga: la Home coach non conteneva un solo dato, era un menù.
// Ora l'eroe è il FEEDBACK degli atleti — l'unica voce in entrata, e l'unica a
// cui il silenzio del coach si nota — seguito dalla squadra della giornata. Le
// destinazioni già presenti in navbar (Calendario, Atleti) sono uscite dalla
// pagina, per il corollario della Regola dell'Eroe Unico.
//
// ⚠️ L'eroe è cambiato una volta: fino al 27/08/2026 era «richiedono
// attenzione». Non è un ripensamento estetico — chi è fermo da nove giorni lo
// è ancora fra un'ora, mentre una nota non letta è l'unica cosa in pagina che
// ha già un mittente in attesa. Chi è fermo resta in pagina, più in basso, con
// lo stesso dato di prima.

import { User, Plus, Dumbbell, FolderArchive, ChevronRight, FileText, Mic,
         CheckCircle2, Inbox } from 'lucide-react'
import { CARD, LABEL, RIGA } from '../lib/stiliCard'
import { corsia } from '../lib/categorie'

// ── Pezzi minuti, non esportati ───────────────────────────────────────────
// Restano interni di proposito: sono dettagli di questa pagina, e un export in
// più è un pezzo in più da tenere coerente altrove.

/** Il volto di un atleta, con il ripiego quando la foto manca o non carica. */
function Volto({ foto, dimensione = 38, icona = 17, anello = 'border border-[#3a3a3a]' }) {
  return (
    <span style={{ width: dimensione, height: dimensione }}
      className={`rounded-full bg-surface2 ${anello} shrink-0 overflow-hidden flex items-center justify-center text-gray-400`}>
      {foto
        ? <img src={foto} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0 }} />
        : <User size={icona} aria-hidden="true" />}
    </span>
  )
}

/**
 * La tacca verde nella riga di chi è fermo: è l'ultimo allenamento, e il resto
 * della barra è il silenzio che lo segue.
 *
 * La scala è di DUE SETTIMANE, non della finestra di 45 giorni: su 45 la
 * differenza fra sei e nove giorni di fermo diventa invisibile, ed è esattamente
 * la differenza che il coach deve vedere.
 */
const SCALA_TACCA = 14
const taccaFermo = (giorni) => Math.max(4, Math.round(20 * (1 - Math.min(giorni, SCALA_TACCA) / SCALA_TACCA)))

/** Il numero con la virgola, come si scrive in italiano. */
const decimale = (n) => String(n).replace('.', ',')

// ── Header ────────────────────────────────────────────────────────────────
// Il logo resta, al contrario della Home atleta: il coach usa anche la web app,
// e qui il marchio distingue le due superfici. Ma perde una taglia e guadagna
// sopra la riga che serve davvero — la data e quanti atleti segue.
export function HeaderCoach({ dataOggi, atleti, inPausa = 0, azioni }) {
  return (
    <div className="flex items-center justify-between gap-3 px-0.5 pt-1.5 pb-0.5">
      <div className="min-w-0">
        <p className={`${LABEL} mb-[3px] tracking-[.12em]`}>
          {dataOggi}{atleti > 0 ? ` · ${atleti} ${atleti === 1 ? 'atleta' : 'atleti'}` : ''}
          {inPausa > 0 && <span className="text-[#5b6070]"> · {inPausa} in pausa</span>}
        </p>
        <h1 className="text-[26px] font-black tracking-[-.03em] leading-none text-white">
          FLEO<span className="text-brand">FIT</span>{' '}
          <span className="text-[19px] font-extrabold tracking-[-.02em] text-muted">Coach</span>
        </h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">{azioni}</div>
    </div>
  )
}

// ── Live Coach Cam ────────────────────────────────────────────────────────
// Era una sezione con titolo e card alte 76px; è diventata una barra. Non
// perché conti meno, ma perché dura quanto un allenamento: una sezione che per
// 23 ore al giorno non c'è lascia un buco nella pagina, una barra no.
export function BannerLive({ nome, dettaglio, onGuarda }) {
  return (
    <button onClick={onGuarda} aria-label={`Guarda ${nome} in allenamento`}
      className="w-full text-left rounded-[18px] px-3.5 py-3 flex items-center gap-3 transition active:scale-[.99]
                 bg-gradient-to-r from-red-500/[.16] to-red-500/[.05] border border-red-500/30
                 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] hover:border-red-500/60">
      <span aria-hidden="true" className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse shadow-[0_0_10px_rgba(239,68,68,.9)]" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-white truncate">{nome} è in allenamento</p>
        {dettaglio && <p className="mt-0.5 text-xs font-medium text-red-300 truncate">{dettaglio}</p>}
      </div>
      <span className="shrink-0 px-3.5 py-1.5 rounded-[11px] bg-red-500 text-white text-xs font-extrabold">Guarda</span>
    </button>
  )
}

// ── L'eroe: il feedback in entrata ────────────────────────────────────────
//
// È l'unica voce «in entrata» della Home: se resta lì, l'atleta ha parlato e
// nessuno ha risposto. Ogni riga porta la citazione, perché un contatore senza
// il testo obbliga ad aprire quattro schermate per sapere se una delle quattro
// era urgente.
//
// ⚠️ L'entrata `hero-transition` la mette Home.jsx sul contenitore, non qui:
// stessa disciplina della Home atleta, così il nodo resta libero per gli stili
// inline di chi lo anima o lo trasforma.

/** L'RPE dichiarato, in pillola. Sopra il 9 diventa gialla: è l'unico caso in
 *  cui il numero da solo cambia cosa il coach deve fare. */
function PillolaRpe({ rpe }) {
  if (rpe == null) return null
  const forte = rpe >= 9
  return (
    <span className={`shrink-0 whitespace-nowrap font-mono text-[11px] font-black leading-none px-1.5 py-1 rounded-full border
      ${forte ? 'bg-brand/[.14] border-brand/30 text-brand' : 'bg-white/[.07] border-white/[.13] text-gray-200'}`}>
      RPE {rpe}
    </span>
  )
}

export function HeroFeedback({ righe = [], mostrate = 3, espanso = false, onEspandi, onApri, finestraGiorni }) {
  const visibili = espanso ? righe : righe.slice(0, mostrate)
  const restanti = righe.length - visibili.length
  return (
    <div className="relative overflow-hidden rounded-[26px] p-5 border border-brand/20
                    bg-gradient-to-br from-[#232019] via-[#1b1b1d] to-[#161618]
                    shadow-[0_24px_48px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)]">
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-24 w-64 h-64 rounded-full blur-2xl bg-brand/[.16]" />
      <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 p-[18px] opacity-[.08] -rotate-12">
        <FileText size={92} className="text-brand" />
      </div>

      <div className="relative flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={`${LABEL} mb-2`}>Feedback nuovi</p>
            <h2 className="text-[44px] font-black leading-[.92] tracking-[-.02em] text-white">
              {righe.length}
              <span className="text-[19px] font-bold tracking-[-.01em] text-muted"> da leggere</span>
            </h2>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand">
              <FileText size={14} aria-hidden="true" />Note degli atleti
            </span>
            {/* ⚠️ La finestra è quella VERA dei dati (FINESTRA_FEEDBACK), non un
                «ultime 48 ore» decorativo: un'etichetta che non descrive il
                numero sopra è un dato sbagliato scritto in piccolo. */}
            {finestraGiorni > 0 && (
              <span className="text-xs font-bold text-muted">Ultimi {finestraGiorni} giorni</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {visibili.map(f => (
            <button key={f.id} onClick={() => onApri(f)} aria-label={`Leggi il feedback di ${f.nome}`}
              className="rounded-2xl px-3 py-2.5 bg-black/[.42] border border-white/[.07] flex items-center gap-3
                         text-left transition active:scale-[.99] hover:border-brand/40">
              <Volto foto={f.foto} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-[7px] min-w-0">
                  <span className="text-[14.5px] font-extrabold text-white truncate">{f.nome}</span>
                  <PillolaRpe rpe={f.rpe} />
                  {/* Solo l'icona, senza la parola: il nome dell'atleta è la
                      prima cosa che deve stare per intero su questa riga, e
                      «vocale» scritto per esteso lo mandava nei puntini. */}
                  {f.haVocale && <Mic size={13} className="shrink-0 text-brand" aria-label="nota vocale" />}
                  <span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-[#5b6070]">{f.quando}</span>
                </span>
                <span className="block mt-1 text-[12.5px] font-medium text-muted truncate">
                  {f.testo ? `«${f.testo}»` : f.titolo}
                </span>
              </span>
              <span className="shrink-0 px-3.5 py-2 rounded-xl bg-white/[.08] border border-white/[.13] text-white text-[12.5px] font-extrabold
                               shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">Leggi</span>
            </button>
          ))}

          {restanti > 0 && (
            <button onClick={onEspandi} aria-expanded={espanso}
              className="flex items-center justify-center gap-1.5 pt-1 text-[12.5px] font-extrabold text-muted
                         transition hover:text-white">
              +{restanti} altr{restanti === 1 ? 'o feedback' : 'i feedback'}
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Nessun feedback da leggere.
 *
 * Non è un caso di bordo cosmetico: un eroe vuoto si legge come un guasto, e
 * questo è lo stato in cui la Home passerà la maggior parte del tempo se il
 * coach risponde. Lo stato buono si dichiara.
 */
export function HeroNessunFeedback() {
  return (
    <div className="rounded-[26px] p-5 border border-white/[.07] flex items-center gap-4
                    bg-gradient-to-br from-[#1c1c1f] to-[#171719]
                    shadow-[0_24px_48px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.06)]">
      <div className="w-12 h-12 rounded-full bg-white/[.06] border border-white/[.11] text-muted shrink-0 flex items-center justify-center">
        <Inbox size={24} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className={LABEL}>Feedback nuovi</p>
        <h2 className="mt-1.5 text-[22px] font-black tracking-[-.03em] text-white leading-tight">Nessuno</h2>
        <p className="mt-0.5 text-[12.5px] font-medium text-muted">Hai letto tutto quello che gli atleti ti hanno scritto.</p>
      </div>
    </div>
  )
}

// ── La squadra della giornata ─────────────────────────────────────────────
//
// Sostituisce la lista «Attività oggi e ieri», che elencava gli eventi uno per
// uno. Al coach serve il colpo d'occhio: cinque su sette, e quali due mancano.
// Il giorno si cambia in fondo alla card, perché ieri è consultazione — la
// domanda della mattina è su oggi.

const ANELLO = {
  completato: 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,.35)]',
  'in corso': 'border-brand shadow-[0_0_12px_rgba(241,186,23,.5)]',
  'da fare': 'border-white/[.14]',
}
const TESTO_STATO = {
  completato: 'text-green-500',
  'in corso': 'text-brand',
  'da fare': 'text-[#5b6070]',
}
const SEGMENTO = {
  completato: 'bg-green-500',
  'in corso': 'bg-brand shadow-[0_0_10px_rgba(241,186,23,.5)]',
  'da fare': 'bg-white/[.12]',
}

export function SquadraOggi({
  righe = [], completati = 0, assegnati = 0, inCorso = 0, rpeMedio = null,
  giorno = 'oggi', onCambiaGiorno, onApriAtleta,
}) {
  // Oltre sette volti la riga scorre invece di comprimersi: sotto i 44px un
  // volto smette di essere riconoscibile, ed è l'unica cosa che deve esserlo.
  const molti = righe.length > 7
  const altroGiorno = giorno === 'oggi' ? 'ieri' : 'oggi'
  return (
    <div className={`${CARD} p-[18px] flex flex-col gap-4`}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={`${LABEL} mb-2`}>Attività di {giorno}</p>
          {assegnati > 0 ? (
            <p className="text-[32px] font-black tracking-[-.01em] text-white leading-none">
              {completati}<span className="text-[17px] font-bold text-muted tracking-[.02em] pl-0.5">/{assegnati}</span>{' '}
              <span className="text-sm font-bold text-muted tracking-normal">completati</span>
            </p>
          ) : (
            <p className="text-[15px] font-extrabold text-white">Nessun allenamento assegnato</p>
          )}
        </div>
        {inCorso > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-[11px] py-1.5 rounded-full bg-brand/[.12] border border-brand/30">
            <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full bg-brand animate-pulse shadow-[0_0_8px_rgba(241,186,23,.7)]" />
            <span className="text-xs font-extrabold text-brand">{inCorso} in corso</span>
          </span>
        )}
      </div>

      {assegnati > 0 && (<>
        <div aria-hidden="true" className="flex gap-1">
          {righe.map(r => <span key={r.id} className={`flex-1 h-2 rounded-full ${SEGMENTO[r.stato]}`} />)}
        </div>

        <div className={`flex gap-[7px] ${molti ? 'overflow-x-auto -mx-1 px-1' : ''}`}>
          {righe.map(r => (
            <button key={r.id} onClick={() => onApriAtleta(r)}
              aria-label={`${r.nome}: ${r.stato}${r.rpe != null ? `, RPE ${r.rpe}` : ''}`}
              className={`${molti ? 'w-[54px] shrink-0' : 'flex-1 min-w-0'} flex flex-col items-center gap-1.5 transition active:scale-95`}>
              <span className={`w-[42px] h-[42px] rounded-full border-2 bg-[#232326] overflow-hidden shrink-0
                                flex items-center justify-center text-gray-200 ${ANELLO[r.stato]}`}>
                {r.foto
                  ? <img src={r.foto} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0 }} />
                  : <User size={18} aria-hidden="true" />}
              </span>
              <span className={`text-[11px] font-bold max-w-full truncate ${r.stato === 'da fare' ? 'text-[#5b6070]' : 'text-gray-200'}`}>{r.nome}</span>
              <span aria-hidden="true" className={`font-mono text-[11px] font-bold leading-none ${TESTO_STATO[r.stato]}`}>
                {r.rpe != null ? r.rpe : '—'}
              </span>
            </button>
          ))}
        </div>
      </>)}

      <div className="flex items-center justify-between pt-0.5">
        <span className="text-xs font-semibold text-muted">
          {/* Senza RPE dichiarati non si inventa una media: si dice che non c'è. */}
          {rpeMedio != null
            ? <>RPE medio squadra <span className="text-white font-extrabold">{decimale(rpeMedio)}</span></>
            : 'Nessun RPE dichiarato'}
        </span>
        <button onClick={onCambiaGiorno}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-gray-200 transition hover:text-white">
          {altroGiorno === 'ieri' ? 'Ieri' : 'Oggi'}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

// ── La CTA ────────────────────────────────────────────────────────────────
// Resta l'unica superficie gialla PIENA della pagina (Regola del Tratto Unico),
// e diventa orizzontale: da card alta 150px a riga alta 92, senza perdere peso.
export function CtaCreaWorkout({ onClick }) {
  return (
    <button onClick={onClick}
      className="relative overflow-hidden w-full text-left rounded-[22px] p-5 bg-brand flex items-center gap-4
                 shadow-[0_20px_40px_-14px_rgba(241,186,23,.5),inset_0_1px_0_rgba(255,255,255,.4)]
                 transition active:scale-[.99] hover:brightness-[1.06]">
      <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 p-3.5 opacity-[.16] -rotate-12 text-black">
        <Dumbbell size={92} />
      </span>
      <span className="relative w-[52px] h-[52px] rounded-full bg-black text-brand shrink-0 flex items-center justify-center">
        <Plus size={26} aria-hidden="true" />
      </span>
      <span className="relative min-w-0">
        {/* Nero sopra il giallo, sempre: DESIGN.md → La Regola del Nero Sopra il Giallo. */}
        <span className="block text-[23px] font-black tracking-[-.03em] text-black leading-[1.05]">Crea workout</span>
        <span className="block mt-1 text-[13px] font-bold text-black/[.62]">Componi e assegna ai tuoi atleti</span>
      </span>
    </button>
  )
}

/**
 * Una destinazione in forma di riga.
 *
 * L'archivio ci arriva dall'essere una barra piena `#2a2a2a` alta 56px: è
 * materiale di lavoro del coach, non una destinazione da promuovere. Le card
 * «Calendario» e «Atleti» invece sono uscite del tutto — sono già due voci
 * della navbar (corollario della Regola dell'Eroe Unico).
 */
export function RigaDestinazione({ icona: Icona = FolderArchive, titolo, sottotitolo, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label || titolo}
      className="w-full text-left rounded-[18px] px-4 py-3.5 bg-white/[.05] border border-white/[.09]
                 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] flex items-center gap-3
                 transition active:scale-[.99] hover:border-brand/40">
      <span className="w-[38px] h-[38px] rounded-full bg-white/[.07] border border-white/[.11] text-gray-200 shrink-0 flex items-center justify-center">
        <Icona size={18} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-extrabold tracking-[-.01em] text-white truncate">{titolo}</span>
        {sottotitolo && <span className="block mt-0.5 text-xs font-medium text-muted truncate">{sottotitolo}</span>}
      </span>
      <ChevronRight size={17} className="text-[#5b6070] shrink-0" aria-hidden="true" />
    </button>
  )
}

// ── Chi richiede attenzione ───────────────────────────────────────────────
//
// Una condizione sola: nessun allenamento completato da 5 giorni o più. Sono
// gli atleti che stanno sparendo, e la risposta è sempre la stessa — una
// telefonata. Ogni riga porta i giorni di fermo, l'ultimo allenamento e
// l'azione a un tocco.
//
// Non è più l'eroe (lo era fino al 27/08/2026): resta sotto la CTA, dove sta il
// lavoro. Chi è fermo da nove giorni lo è ancora fra un'ora — un feedback non
// letto no.
export function SezioneAttenzione({ righe = [], soglia = 5, onApriAtleta }) {
  return (
    <div className={`${CARD} p-[18px] flex flex-col gap-[15px]`}>
      <div className="flex items-center justify-between gap-3">
        <p className={LABEL}>Richiedono attenzione</p>
        <span className="text-xs font-bold text-[#5b6070]">Fermi da {soglia}+ giorni</span>
      </div>
      <div className="flex flex-col gap-3">
        {righe.map((r, i) => (
          <div key={r.id} className="flex flex-col gap-3">
            {i > 0 && <div aria-hidden="true" className="h-px bg-white/[.06]" />}
            {/* La riga intera è il bersaglio: il design metteva «Apri» in fondo
                alla card, ma con più nomi elencati quel bottone non dice quale
                atleta apre. */}
            <button onClick={() => onApriAtleta(r)} aria-label={`Apri la scheda di ${r.nome}`}
              className="text-left transition active:scale-[.99] group">
              <div className="flex items-baseline justify-between gap-2.5">
                <p className="text-[15px] font-extrabold text-white truncate group-hover:text-brand transition">{r.nome}</p>
                <p className="shrink-0 text-[19px] font-black tracking-[-.03em] text-white">
                  {r.oltre ? `${r.giorni}+` : r.giorni}<span className="text-xs font-bold text-muted"> gg</span>
                </p>
              </div>
              <div className="flex items-center gap-[3px] mt-2">
                <span aria-hidden="true" style={{ width: `${taccaFermo(r.giorni)}%` }} className="h-[5px] rounded-full bg-green-500" />
                <span aria-hidden="true" className="flex-1 h-[5px] rounded-full bg-gradient-to-r from-white/[.16] to-white/[.04]" />
                <span className="shrink-0 pl-1.5 text-[11px] font-bold text-[#5b6070]">
                  {r.ultimoEtichetta ? `ultimo ${r.ultimoEtichetta}` : 'mai, di recente'}
                </span>
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Nessuno richiede attenzione.
 *
 * Lo stato in cui la sezione passerà la maggior parte del tempo se il coach fa
 * il suo lavoro. Una sezione vuota si leggerebbe come un guasto.
 */
export function TuttiAttivi({ totale }) {
  return (
    <div className="rounded-[22px] p-[18px] border border-green-500/25 flex items-center gap-4
                    bg-gradient-to-b from-[#16231a] to-[#161618]
                    shadow-[0_18px_34px_-18px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.06)]">
      <div className="w-11 h-11 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 shrink-0 flex items-center justify-center">
        <CheckCircle2 size={22} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className={LABEL}>Richiedono attenzione</p>
        <h3 className="mt-1 text-[19px] font-black tracking-[-.03em] text-white leading-tight">Nessuno</h3>
        <p className="mt-0.5 text-[12.5px] font-medium text-muted">
          {totale === 1 ? 'Il tuo atleta si è allenato' : `Tutti e ${totale} gli atleti si sono allenati`} negli ultimi giorni.
        </p>
      </div>
    </div>
  )
}

/**
 * La copertura dei prossimi giorni: quanti atleti hanno almeno un allenamento
 * assegnato. Non è una metrica di vanità — è l'unico numero della Home che
 * dice «devi programmare adesso», e `senza` è quello che si guarda davvero.
 *
 * Le tacche sono una per atleta: con nove si leggono a colpo d'occhio, e sopra
 * i quattordici il numero grande resta comunque il dato.
 */
export function BarraCopertura({ coperti, totale, senza, giorni = 3 }) {
  const tacche = Math.min(totale, 14)
  const accese = totale > 0 ? Math.round((coperti / totale) * tacche) : 0
  return (
    <div className="rounded-[22px] px-[18px] py-4 border border-white/[.07] bg-gradient-to-r from-[#1b1b1e] to-[#151517]
                    shadow-[0_18px_34px_-18px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,255,255,.06)]
                    flex items-center justify-between gap-3.5">
      <div className="min-w-0">
        <p className={LABEL}>Copertura {giorni} gg</p>
        <p className={`mt-2 text-[15px] font-extrabold ${senza > 0 ? 'text-white' : 'text-green-500'}`}>
          {senza > 0
            ? `${senza} ${senza === 1 ? 'atleta' : 'atleti'} senza allenamento`
            : 'Tutti programmati'}
        </p>
        <div aria-hidden="true" className="flex gap-1 mt-2.5 w-[150px] max-w-full">
          {Array.from({ length: tacche }, (_, i) => (
            <span key={i} className={`flex-1 h-1.5 rounded-full ${i < accese ? 'bg-brand' : 'bg-white/[.12]'}`} />
          ))}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className="block text-[34px] font-black tracking-[-.01em] text-white leading-[.9]">
          {coperti}<span className="text-[17px] text-muted tracking-[.02em] pl-0.5">/{totale}</span>
        </span>
        <span className={LABEL}>coperti</span>
      </div>
    </div>
  )
}

// ── Le liste in fondo ─────────────────────────────────────────────────────

/** Intestazione di sezione: titolo a sinistra, etichetta a destra. */
export function TitoloSezione({ children, meta }) {
  return (
    <div className="flex items-baseline justify-between mt-1.5">
      <h3 className="text-[15px] font-extrabold tracking-[-.01em] text-white">{children}</h3>
      {meta && <span className={LABEL}>{meta}</span>}
    </div>
  )
}

/**
 * La riga compatta con la corsia di categoria a sinistra.
 *
 * È la stessa forma di `ListaInArrivo` nella Home atleta, e resta PIATTA: la
 * carta sollevata è un livello, non un effetto da ripetere a ogni profondità.
 */
export function RigaAttivita({ categoria, titolo, sottotitolo, coda, onClick, ariaLabel }) {
  const Elemento = onClick ? 'button' : 'div'
  return (
    <Elemento
      {...(onClick ? { onClick, type: 'button', 'aria-label': ariaLabel || `Apri ${titolo}` } : {})}
      className={`${RIGA} w-full text-left px-3.5 py-3 flex items-center gap-3 transition
                  ${onClick ? 'hover:bg-white/[.06] active:scale-[.99]' : ''}`}>
      <span aria-hidden="true" className={`w-[3px] self-stretch rounded-full ${corsia(categoria).dot}`} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-white truncate">{titolo}</span>
        <span className="block mt-0.5 text-xs font-medium text-muted truncate">{sottotitolo}</span>
      </span>
      {coda}
    </Elemento>
  )
}

/** Il bottone "Apri" a destra di una riga di lavoro. */
export function AzioneApri({ etichetta = 'Apri' }) {
  return (
    <span className="shrink-0 px-3 py-1.5 rounded-[11px] bg-white/[.07] border border-white/[.12] text-white text-xs font-extrabold">
      {etichetta}
    </span>
  )
}
