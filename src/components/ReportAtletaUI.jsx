// ReportAtletaUI.jsx — i pezzi visivi del report del singolo atleta.
//
// Stesso patto di ReportUI, HomeCoachUI, AtletiUI e gli altri: SOLA
// PRESENTAZIONE. Riceve numeri già calcolati (`src/lib/reportAtleta.js`) e
// callback già esistenti. Se qui dentro compare una `supabase`, un `useEffect`
// di rete o una regola su quanto scaricare, è finito nel file sbagliato.
//
// ⚠️ L'eroe di questa pagina NON sono i numeri: sono le PROPOSTE. Il report
// squadra risponde a «chi guardo per primo», questo a «cosa gli faccio fare», e
// la risposta a quella domanda deve stare nel primo schermo. I numeri vengono
// subito sotto perché servono a verificarla — una proposta che non si può
// verificare non si discute, si subisce, e la prima volta che sbaglia si smette
// di leggerla.

import { ChevronLeft, ChevronRight, User, Mic, Plus, ClipboardList,
         CheckCircle2, CircleSlash, CalendarClock, Dumbbell } from 'lucide-react'
import { CARD, LABEL, RIGA, CARTA_RIGA_BASE, VETRO, TONO_VERDETTO } from '../lib/stiliCard'
import { corsia } from '../lib/categorie'
import { decimale, oreMinuti, VERDETTI } from '../lib/reportSettimanale'

// ── Pezzi minuti, non esportati ───────────────────────────────────────────

function Volto({ foto, dimensione = 34 }) {
  return (
    <span style={{ width: dimensione, height: dimensione }}
      className="rounded-full bg-surface2 border border-white/[.09] shrink-0 overflow-hidden
                 flex items-center justify-center text-gray-400">
      {foto
        ? <img src={foto} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0 }} />
        : <User size={16} aria-hidden="true" />}
    </span>
  )
}

/** Lo stato di una seduta nel diario. Tre, non due: vedi `sessioniDi`. */
const STATO = {
  completato: { etichetta: 'Fatto', classe: 'text-green-400', icona: CheckCircle2 },
  saltato: { etichetta: 'Saltato', classe: 'text-orange-400', icona: CircleSlash },
  'in programma': { etichetta: 'Da fare', classe: 'text-[#5b6070]', icona: CalendarClock },
}

const conSegno = (n) => `${n > 0 ? '+' : ''}${decimale(n)}`

// ── Testata ───────────────────────────────────────────────────────────────

export function TestataReportAtleta({
  nome, foto, etichetta, numero, corrente, avanti, onIndietro, onPrecedente, onSuccessiva,
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 pt-[calc(env(safe-area-inset-top)+0.875rem)] pb-3
                    bg-[#0B0B0B]/85 backdrop-blur-xl border-b border-white/[.06]">
      <div className="flex items-center gap-2.5">
        <button onClick={onIndietro} aria-label="Torna al report della squadra"
          className={`shrink-0 w-10 h-10 rounded-full ${VETRO} flex items-center justify-center text-white`}>
          <ChevronLeft size={19} aria-hidden="true" />
        </button>
        <Volto foto={foto} />
        <h1 className="flex-1 min-w-0 text-[19px] font-black tracking-[-.03em] text-white leading-tight truncate">{nome}</h1>
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
      {/* ⚠️ Su una riga sua e a tutta larghezza, come nel report squadra: in
          mezzo ai bottoni tondi «31 ago – 6 set» finiva troncato, e spariva
          proprio la data che dice quale settimana si sta guardando. */}
      <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[.1em] text-muted leading-none truncate">
        Settimana {numero} · {etichetta}{corrente ? ' · in corso' : ''}
      </p>
    </div>
  )
}

// ── L'eroe: cosa fargli fare ──────────────────────────────────────────────

/**
 * Le proposte per la settimana successiva, ognuna con il numero da cui esce.
 *
 * 🔴 Il motivo sotto ogni titolo non è una didascalia: è la condizione che
 * rende la proposta **rifiutabile**. Senza, resta un oracolo — e un oracolo si
 * segue finché non sbaglia, poi non lo si legge più.
 */
export function ProposteSettimana({ voci = [], settimana, verdetto }) {
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
      <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 p-[18px] opacity-[.08] -rotate-12">
        <ClipboardList size={92} className="text-brand" />
      </div>

      <div className="relative flex flex-col gap-4">
        {/* ⚠️ L'etichetta prende una riga TUTTA SUA, e la pillola scende
            accanto al numero: affiancate, su 375px, «Come programmare la
            prossima» andava a capo dentro una colonna larga duecento pixel e
            spezzava il titolo della card in due righe storte. */}
        <div>
          <p className={LABEL}>Come programmare la prossima</p>
          <div className="flex items-center justify-between gap-3 mt-2">
            <h2 className="min-w-0 text-[26px] font-black leading-[1.05] tracking-[-.03em] text-white truncate">
              {voci.length} {voci.length === 1 ? 'indicazione' : 'indicazioni'}
            </h2>
            {verdetto && (
              <span className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full border text-[10.5px] font-black
                                uppercase tracking-[.06em] ${TONO_VERDETTO[VERDETTI[verdetto].tono]}`}>
                {VERDETTI[verdetto].etichetta}
              </span>
            )}
          </div>
          <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-[.08em] text-[#5b6070]">
            dalla settimana {settimana}
          </p>
        </div>

        <ol className="flex flex-col gap-2.5">
          {voci.map((v, i) => (
            <li key={v.chiave} className="rounded-2xl px-3.5 py-3 bg-black/[.42] border border-white/[.07] flex gap-3">
              <span aria-hidden="true"
                className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center
                            font-mono text-[11px] font-black ${TONO_VERDETTO[v.tono]}`}>
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-extrabold tracking-[-.01em] text-white leading-snug">{v.titolo}</span>
                <span className="block mt-1 text-[12.5px] font-medium text-muted leading-snug">{v.motivo}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ── I quattro numeri ──────────────────────────────────────────────────────

function Cella({ etichetta, valore, nota }) {
  return (
    <div className={`${CARD} p-3.5 flex flex-col gap-1.5 min-w-0`}>
      <p className={LABEL}>{etichetta}</p>
      <p className="text-[20px] font-black tracking-[-.02em] text-white leading-none truncate">{valore}</p>
      {nota && <p className="text-[11px] font-bold text-[#5b6070] leading-none truncate">{nota}</p>}
    </div>
  )
}

export function NumeriAtleta({ misure, carico, corrente, trascorsi }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 mt-3">
      <Cella etichetta="Aderenza"
        valore={misure.assegnati > 0 ? `${misure.percentuale}%` : '—'}
        nota={misure.assegnati > 0
          ? `${misure.completati}/${misure.assegnati}${corrente ? ` · giorno ${trascorsi} di 7` : ''}`
          : (misure.daVenire > 0 ? `${misure.daVenire} in programma` : 'niente assegnato')} />

      <Cella etichetta="Volume" valore={oreMinuti(carico.minuti)}
        nota={carico.deltaMinuti != null && carico.deltaMinuti !== 0
          ? `${conSegno(carico.deltaMinuti)} min sulla scorsa`
          : `${carico.sessioni} ${carico.sessioni === 1 ? 'seduta' : 'sedute'}`} />

      {/* Il `≈` compare quando il totale ha lasciato fuori le sedute senza RPE:
          lo stesso glifo del volume nel calendario, per la stessa ragione. */}
      <Cella etichetta="Carico"
        valore={carico.punti > 0 ? `${carico.parziale ? '≈' : ''}${carico.punti}` : '—'}
        nota={carico.acwr != null
          ? `${decimale(carico.acwr)}× la sua media`
          : (carico.senzaRpe > 0 ? `${carico.senzaRpe} senza RPE` : 'minuti × RPE')} />

      {/* `null` e non 5: chi non ha dichiarato niente non ha una media. */}
      <Cella etichetta="RPE medio"
        valore={carico.rpeMedio != null ? decimale(carico.rpeMedio) : '—'}
        nota={misure.scartoRpe != null
          ? `${conSegno(misure.scartoRpe)} sul previsto`
          : (carico.rpeMedio != null ? 'dichiarato' : 'nessuno dichiarato')} />
    </div>
  )
}

// ── Le cinque settimane ───────────────────────────────────────────────────

/**
 * Il carico delle ultime cinque settimane, con quella scelta accesa.
 *
 * ⚠️ Le barre sono normalizzate sul massimo del periodo, non su un tetto fisso:
 * il grafico racconta l'andamento di QUESTO atleta, e una scala assoluta
 * schiaccerebbe chiunque non sia il più carico della squadra.
 */
export function AndamentoSettimane({ settimane = [] }) {
  const massimo = Math.max(...settimane.map(s => s.punti), 0)
  return (
    <div className={`${CARD} p-4 mt-3`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={LABEL}>Carico, {settimane.length} settimane</p>
        <span className="font-mono text-[11px] font-bold text-[#5b6070]">minuti × RPE</span>
      </div>
      {/* ⚠️ `items-stretch` (il default) e `h-full` sulle colonne, NON
          `items-end`: con `items-end` la colonna si dimensiona sul contenuto,
          il `flex-1` della barra non ha spazio in cui crescere e le barre
          escono alte zero — numeri ed etichette al loro posto, e in mezzo il
          vuoto. Non dà nessun errore: sembra un grafico senza dati. */}
      <div className="flex gap-2 mt-4 h-[92px]">
        {settimane.map(s => (
          <div key={s.da} className="flex-1 h-full flex flex-col items-center gap-2 min-w-0">
            <span className={`font-mono text-[10.5px] font-bold leading-none ${s.corrente ? 'text-brand' : 'text-[#5b6070]'}`}>
              {s.punti > 0 ? `${s.caricoParziale ? '≈' : ''}${s.punti}` : '—'}
            </span>
            <span aria-hidden="true" className="w-full flex-1 flex items-end">
              <span className={`w-full rounded-t-[6px] rounded-b-[3px] ${s.corrente ? 'bg-brand' : 'bg-white/[.16]'}`}
                style={{ height: `${massimo > 0 ? Math.max(3, Math.round((s.punti / massimo) * 100)) : 3}%` }} />
            </span>
            <span className={`font-mono text-[10.5px] font-bold leading-none ${s.corrente ? 'text-white' : 'text-[#5b6070]'}`}>
              {s.breve}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2.5">
        {settimane.map(s => (
          <span key={s.da} className="flex-1 text-center font-mono text-[10px] font-bold text-[#5b6070] truncate">
            {s.assegnati > 0 ? `${s.completati}/${s.assegnati}` : '—'}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Il diario ─────────────────────────────────────────────────────────────

export function Diario({ sessioni = [], onApri }) {
  return (
    <div className="flex flex-col gap-2">
      {sessioni.map(s => {
        const stato = STATO[s.stato]
        const Icona = stato.icona
        return (
          <button key={s.id} onClick={() => onApri(s)}
            aria-label={`${s.giorno}, ${s.titolo}: ${stato.etichetta}`}
            className={`${CARTA_RIGA_BASE} border border-white/[.07] w-full text-left px-3.5 py-3 flex gap-3
                        transition active:scale-[.99] hover:border-brand/40`}>
            <span aria-hidden="true" className={`w-[3px] self-stretch rounded-full ${corsia(s.categoria).dot}`} />
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[.06em] text-[#5b6070]">{s.giorno}</span>
                <span className="flex-1 text-[14px] font-extrabold text-white truncate">{s.titolo}</span>
                <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-black ${stato.classe}`}>
                  <Icona size={13} aria-hidden="true" />{stato.etichetta}
                </span>
              </span>

              <span className="block mt-1 font-mono text-[11px] font-bold text-[#5b6070]">
                {oreMinuti(s.minuti)} · {s.blocchi} {s.blocchi === 1 ? 'blocco' : 'blocchi'}
                {s.atteso != null && <> · previsto {s.atteso}</>}
                {s.dichiarato != null && <> → <span className="text-gray-200">sentito {s.dichiarato}</span></>}
                {/* Lo scarto è la sola cosa di questa riga che il coach non può
                    ricavare da solo guardando la scheda: si dichiara. */}
                {s.scarto != null && s.scarto !== 0 && (
                  <span className={s.scarto > 0 ? ' text-orange-400' : ' text-green-400'}> ({conSegno(s.scarto)})</span>
                )}
              </span>

              {(s.testo || s.haVocale) && (
                <span className="flex items-center gap-1.5 mt-1.5 min-w-0">
                  {s.haVocale && <Mic size={12} className="shrink-0 text-brand" aria-label="nota vocale" />}
                  {s.testo && <span className="text-[12.5px] font-medium text-muted truncate">«{s.testo}»</span>}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── I movimenti ───────────────────────────────────────────────────────────

/**
 * Cosa ha davvero fatto, e con che carichi.
 *
 * È il pezzo che serve a comporre il prossimo allenamento: senza, per sapere
 * con che peso ha fatto i wall balls l'ultima volta bisogna aprire la sua
 * scheda, trovare la seduta, aprirla e cercare la riga.
 */
export function Movimenti({ righe = [], mostrati, espanso, onEspandi, soglia, corseEscluse = 0 }) {
  const visibili = espanso ? righe : righe.slice(0, mostrati)
  const restanti = righe.length - visibili.length

  return (
    <div className={`${CARD} p-[18px] mt-3 flex flex-col gap-3.5`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={LABEL}>Movimenti e carichi</p>
        <span className="font-mono text-[11px] font-bold text-[#5b6070]">{righe.length}</span>
      </div>

      <div className="flex flex-col gap-2">
        {visibili.map(m => {
          const trascurato = m.giorniDa >= soglia
          const volume = [
            m.reps > 0 ? `${m.reps} reps` : null,
            m.metri > 0 ? `${m.metri} m` : null,
          ].filter(Boolean).join(' · ')
          return (
            <div key={m.nome} className={`${RIGA} px-3.5 py-2.5 flex items-center gap-3`}>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-extrabold text-white truncate">{m.nome}</span>
                {/* 🔴 «ultima» davanti alla data, e la riga va a capo invece di
                    troncare. Senza quella parola la riga diceva «390 reps · 4 set»,
                    dove «4 set» è il 4 SETTEMBRE e si legge come «quattro serie»:
                    in una schermata di carichi e ripetizioni è la lettura più
                    naturale, ed è sbagliata. Trovato guardando la pagina, non i
                    dati — i dati erano giusti. */}
                <span className="block mt-0.5 font-mono text-[11px] font-bold text-[#5b6070] leading-snug">
                  {m.sedute} {m.sedute === 1 ? 'seduta' : 'sedute'}{volume ? ` · ${volume}` : ''}
                  {' · '}
                  <span className={trascurato ? 'text-orange-400' : ''}>
                    {trascurato ? `${Math.floor(m.giorniDa / 7)} sett. fa` : `ultima ${m.ultimaEtichetta}`}
                  </span>
                </span>
              </span>
              {/* Il carico dell'ULTIMA volta, non il massimo storico: è il
                  numero da cui riparte la progressione. Dove non c'è, non si
                  scrive un trattino — la colonna resta vuota. */}
              {m.kgUltimo != null && (
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[15px] font-black text-white leading-none">{decimale(m.kgUltimo)}</span>
                  <span className="block mt-0.5 font-mono text-[10px] font-bold text-[#5b6070] leading-none">kg</span>
                </span>
              )}
            </div>
          )
        })}
      </div>

      {restanti > 0 && (
        <button onClick={onEspandi} aria-expanded={espanso}
          className="flex items-center justify-center gap-1.5 text-[12.5px] font-extrabold text-muted transition hover:text-white">
          +{restanti} altr{restanti === 1 ? 'o' : 'i'}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}

      {/* ⚠️ Un elenco che tace su tre sedute su cinque si legge come «ha fatto
          poco»: le fasi di corsa non hanno movimenti nominati, e va detto. */}
      {corseEscluse > 0 && (
        <p className="text-[11px] leading-relaxed text-[#5b6070]">
          {corseEscluse} {corseEscluse === 1 ? 'seduta di corsa non è elencata' : 'sedute di corsa non sono elencate'}:
          le fasi di corsa hanno passo e distanza, non movimenti con un nome.
        </p>
      )}
    </div>
  )
}

// ── La barra fissa ────────────────────────────────────────────────────────

/**
 * Le due destinazioni in cui questo report va a finire.
 *
 * ⚠️ `bottom-0` la metterebbe SOTTO la navbar, che è `fixed` a z-50: l'offset
 * viene da `--altezza-navbar` in src/index.css, come per `BarraAzioni` del
 * builder — chi cambia la forma della tab bar cambia quel numero e basta.
 */
export function BarraAtleta({ onScheda, onCrea }) {
  return (
    <div className="sticky bottom-[var(--altezza-navbar)] z-30 -mx-4 px-4 py-3 mt-3
                    bg-[#0B0B0B]/[.85] backdrop-blur-xl border-t border-white/[.07] flex items-center gap-2.5">
      <button onClick={onScheda}
        className={`shrink-0 min-h-[50px] px-4 rounded-2xl ${VETRO} text-white text-sm font-extrabold
                    flex items-center gap-2 transition active:scale-[.98]`}>
        <User size={17} aria-hidden="true" /> Scheda
      </button>
      <button onClick={onCrea}
        className="flex-1 min-h-[50px] rounded-2xl bg-brand text-black text-[16px] font-black tracking-[-.01em]
                   flex items-center justify-center gap-2 transition hover:brightness-110 active:scale-[.99]
                   shadow-[0_14px_26px_-10px_rgba(241,186,23,.5),inset_0_1px_0_rgba(255,255,255,.4)]">
        <Plus size={19} strokeWidth={2.6} aria-hidden="true" /> Crea workout
      </button>
    </div>
  )
}

// ── Vuoto e scheletro ─────────────────────────────────────────────────────

export function VuotoDiario({ corrente }) {
  return (
    <div className="mt-2 rounded-[18px] border border-dashed border-white/[.12] px-4 py-6 flex items-center gap-3.5">
      <span className="w-11 h-11 rounded-full bg-white/[.05] border border-white/[.09] flex items-center justify-center text-muted shrink-0">
        <Dumbbell size={20} aria-hidden="true" />
      </span>
      <p className="text-[12.5px] font-medium text-muted leading-snug">
        {corrente
          ? 'Nessun allenamento assegnato in questa settimana. Le indicazioni qui sopra vengono dalle settimane precedenti.'
          : 'In questa settimana non aveva niente assegnato.'}
      </p>
    </div>
  )
}

export function ScheletroAtleta() {
  return (
    <div className="mt-4 flex flex-col gap-2.5" aria-hidden="true">
      <div className="h-[210px] rounded-[26px] bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />
      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-[80px] rounded-[22px] bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />)}
      </div>
      {[0, 1, 2].map(i => <div key={i} className="h-[80px] rounded-2xl bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />)}
    </div>
  )
}
