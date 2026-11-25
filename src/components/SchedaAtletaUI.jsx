// SchedaAtletaUI.jsx — i pezzi visivi della scheda di un atleta.
//
// Stesso patto di HomeAtletaUI, HomeCoachUI, CreaWorkoutUI e WorkoutDetailUI:
// SOLA PRESENTAZIONE. Ricevono numeri già calcolati (src/lib/andamento.js) e
// callback già esistenti. Se qui dentro compare una `supabase`, un `useEffect`
// di rete o una regola su come si misura il carico, è finito nel file sbagliato.
//
// Il rework in una riga: la pagina apriva con il logo, poi una foto da 96px con
// quattro celle di anagrafica, poi tre celle di settimana, poi tre tab — e il
// dato per cui il coach entra qui, se questo atleta sta seguendo il programma e
// con quanto carico, era nella terza tab, dietro due tocchi e quattro grafici
// che non si parlavano. Ora è la prima cosa in pagina, e le tab non ci sono più.

import { Camera, ChevronDown, ChevronLeft, ChevronRight, Footprints, Layers, MessageSquareText, Mic, MoreHorizontal, Trash2, UserCog, UsersRound } from 'lucide-react'
import { ETICHETTA_NUMERO } from './SedutaUI'
import TestataFoto from './TestataFoto'
import { BOTTONE_SU_FOTO, PILLOLA_SU_FOTO } from '../lib/testataFoto'
import { RIGA } from '../lib/stiliCard'
import { BRAND, conVelo } from '../lib/colori'
import { testoKm } from '../lib/kmScarpe'

// ── La testata con la foto (25/11/2026) ──────────────────────────────────
// Era una foto da 56px accanto al nome. Ora è lo stile del foglio veloce di
// «In allenamento oggi», piaciuto al committente: la foto grande in testa
// (TestataFoto, che sceglie fra foto piena e foto intera a destra per non
// tagliare il viso), il nome grande sopra, social e anagrafica sotto il nome.
// Indietro e menu sono bottoni di vetro sulla foto. Sul telefono va da bordo a
// bordo e passa sotto la barra di stato; sul desktop sta nella colonna, con i
// bottoni della scheda in basso a destra.
// Senza foto: il monogramma, e chi può modificare la scheda vede «Aggiungi foto».
// ⚠️ Il nome resta un <h1>: i test della scheda lo cercano lì.

export function TestataAtleta({
  foto, nome, anagrafica, social, pillola, onErroreFoto, onIndietro, onMenu, onAggiungiFoto, azioni, desktop = false,
}) {
  return (
    <TestataFoto foto={foto} nome={nome} fondo="#0B0B0B" onErroreFoto={onErroreFoto}
      classe={desktop ? 'h-[300px] rounded-[28px]' : 'h-[calc(env(safe-area-inset-top)+312px)]'}
      margineAlto={desktop ? '0px' : 'env(safe-area-inset-top)'}
      sopraSinistra={onIndietro && (
        <button type="button" aria-label="Torna indietro" onClick={onIndietro} className={`-ml-1 ${BOTTONE_SU_FOTO}`}>
          <ChevronLeft size={23} aria-hidden="true" />
        </button>
      )}
      sopraDestra={(
        <button type="button" aria-label="Altre azioni" onClick={onMenu} className={BOTTONE_SU_FOTO}>
          <MoreHorizontal size={21} aria-hidden="true" />
        </button>
      )}
      etichetta={pillola && <div className="mb-2">{pillola}</div>}
      titolo={(
        <h1 className={`${desktop ? 'text-[40px]' : 'text-[32px]'} leading-[1.04] font-black tracking-[-.035em] text-white text-balance break-words`}>
          {nome}
        </h1>
      )}
      sotto={(anagrafica || social) && (
        <div className="mt-2 flex items-center gap-2.5 flex-wrap">
          {social && <span className="flex items-center gap-2.5">{social}</span>}
          {anagrafica && <p className="text-[13px] font-semibold text-white/70 tracking-[.01em]">{anagrafica}</p>}
        </div>
      )}
      senzaFoto={onAggiungiFoto && (
        <button type="button" onClick={onAggiungiFoto} className={PILLOLA_SU_FOTO}>
          <Camera size={15} aria-hidden="true" /> Aggiungi foto
        </button>
      )}
      azione={azioni} />
  )
}

/**
 * Un social accanto al nome: 15px, grigio.
 *
 * Erano due bottoni tondi da 40px sotto il nome, cioè due bersagli grandi
 * quanto una CTA per un collegamento che si apre una volta l'anno. `href`
 * quando il profilo c'è, `onClick` quando va ancora inserito.
 */
export function IconaSocial({ etichetta, icona: Icona, href, colore, onClick }) {
  const classe = `shrink-0 w-7 h-7 -m-1 rounded-full flex items-center justify-center transition
                  hover:bg-white/[.07]`
  const stile = colore ? { color: colore } : undefined
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={etichetta} aria-label={etichetta}
        className={`${classe} text-gray-300`} style={stile}>
        <Icona size={15} aria-hidden="true" />
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} title={etichetta} aria-label={etichetta}
      className={`${classe} text-[#5b6070] hover:text-gray-300`}>
      <Icona size={15} aria-hidden="true" />
    </button>
  )
}

// ── Il ridisegno della pagina (25/11/2026) ────────────────────────────────
// Il committente: «salva questo stile e applicalo anche alla scheda atleta.
// Voglio proprio cambiare tutta la scheda». L'ordine è il suo: obiettivo, dati,
// oggi, calendario; poi il resto. Lo stile è quello del foglio veloce: superfici
// `#18181b` a 24px, titoli di sezione grandi (niente etichette in maiuscoletto
// sopra), NUMERI grandi con le tacche, il colore della corsia dove c'è una
// categoria. DESIGN.md, «La scheda atleta».

/** La pelle di ogni sezione: la stessa del foglio veloce. */
export const SUPERFICIE = 'rounded-[24px] bg-[#18181b] border border-white/[.08]'

/** Il titolo di una sezione: grande, bianco, con un dettaglio a destra se serve. */
export function TitoloSezione({ titolo, dettaglio, azione }) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <h2 className="text-[20px] leading-tight font-black tracking-[-.02em] text-white">{titolo}</h2>
      {azione || (dettaglio != null && <span className="pb-0.5 text-[13px] font-bold text-muted tabular-nums">{dettaglio}</span>)}
    </div>
  )
}

const quando = (giorni) => giorni <= 0 ? 'Oggi' : giorni === 1 ? 'Domani' : null

/**
 * L'obiettivo: la prossima gara. Il conto alla rovescia è il numero più grande
 * della pagina, ed è giusto: è la data verso cui tende tutta la programmazione.
 * Il tocco apre la gara. Senza gara la sezione non c'è.
 */
export function CardObiettivo({ titolo, data, giorni, onClick }) {
  const subito = quando(giorni)
  const settimane = Math.floor(giorni / 7)
  return (
    <button type="button" onClick={onClick} aria-label={`Obiettivo: ${titolo}, ${subito || `fra ${giorni} giorni`}`}
      className={`${SUPERFICIE} group relative w-full overflow-hidden isolate p-5 pr-4 text-left transition hover:border-white/25 active:scale-[.99]`}>
      {/* Il velo bianco della corsia Gara, in alto a destra dove sta il numero. */}
      <span className="absolute inset-0 -z-10" aria-hidden="true"
        style={{ background: 'radial-gradient(90% 120% at 100% 0%, rgba(255,255,255,.09), transparent 60%)' }} />
      <span className="flex items-center gap-5">
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-white/85">
            <i className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,.6)]" aria-hidden="true" />Obiettivo
          </span>
          <b className="mt-1.5 block text-[22px] leading-[1.1] font-black tracking-[-.02em] text-white break-words [text-wrap:balance]">{titolo}</b>
          <span className="mt-1.5 block text-[13px] font-bold text-gray-300 first-letter:uppercase">{data}</span>
        </span>
        <span className="shrink-0 text-right">
          {subito ? (
            <b className="block text-[40px] leading-none font-black tracking-[-.04em] text-white">{subito}</b>
          ) : (<>
            <b className="block text-[64px] leading-[.85] font-black tracking-[-.06em] text-white tabular-nums">{giorni}</b>
            <span className="mt-1.5 block text-[13px] font-extrabold text-gray-400">{settimane >= 2 ? `giorni · ${settimane} sett.` : 'giorni'}</span>
          </>)}
        </span>
      </span>
    </button>
  )
}

/** Dieci tacche: la stessa misura dell'intensità del foglio veloce. */
function Tacche({ piene, colore, totale = 10 }) {
  return (
    <span className="mt-2 flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: totale }, (_, i) => (
        <i key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < piene ? colore : 'rgba(255,255,255,.1)' }} />
      ))}
    </span>
  )
}

const CIFRA = 'block mt-1 text-[30px] leading-none font-black tracking-[-.04em] text-white tabular-nums'
const UNITA = 'ml-0.5 text-[14px] font-extrabold tracking-normal text-gray-400'

/**
 * «Come sta andando»: i dati in una sezione sola. Tre numeri grandi in fila
 * (aderenza con le sue tacche, volume, sforzo con le fasce di RPE), poi il
 * carico delle ultime quattro settimane e la frase che li mette insieme — è la
 * riga su cui si decide se caricare o scaricare.
 */
export function CardAnalisi({ aderenza, volume, sforzo, settimane, delta, frase, dettaglio, children }) {
  const massimo = Math.max(...settimane.map(s => s.load), 1)
  const suGiu = delta == null ? null : delta >= 0
  return (
    <section className={`${SUPERFICIE} p-5 flex flex-col gap-5`} aria-label="Andamento">
      <div className="grid grid-cols-[1.15fr_1fr_1fr] [&>*+*]:border-l [&>*+*]:border-white/[.08] [&>*+*]:pl-3.5 [&>*]:pr-3.5 [&>*:last-child]:pr-0">
        <div className="min-w-0" role="img" aria-label={`Aderenza ${aderenza.percentuale}%, ${aderenza.fatti}/${aderenza.assegnati} allenamenti`}>
          <span className={ETICHETTA_NUMERO} aria-hidden="true">Aderenza</span>
          <b className={CIFRA} aria-hidden="true">{aderenza.percentuale}<small className={UNITA}>%</small></b>
          <Tacche piene={Math.round(aderenza.percentuale / 10)} colore={BRAND} />
          <span className="mt-1.5 block text-[12px] font-bold text-muted" aria-hidden="true">{aderenza.fatti} su {aderenza.assegnati}</span>
        </div>
        <div className="min-w-0">
          <span className={ETICHETTA_NUMERO}>Volume</span>
          <b className={CIFRA}>{volume.minuti}<small className={UNITA}>min</small></b>
          <span className={`mt-2 block text-[12px] font-bold leading-snug ${volume.notaColore}`}>{volume.nota}</span>
        </div>
        <div className="min-w-0">
          <span className={ETICHETTA_NUMERO}>Sforzo</span>
          <b className={CIFRA}>{sforzo.valore}{sforzo.unita && <small className={UNITA}>{sforzo.unita}</small>}</b>
          {sforzo.distribuzione && <BarraFasce distribuzione={sforzo.distribuzione} />}
          <span className="mt-1.5 block text-[12px] font-bold leading-snug text-muted">{sforzo.nota}</span>
        </div>
      </div>

      <div className="pt-4 border-t border-white/[.08]">
        <div className="flex items-baseline justify-between">
          <span className={ETICHETTA_NUMERO}>Carico · 4 settimane</span>
          {suGiu !== null && (
            <span className={`text-[13px] font-extrabold tabular-nums ${suGiu ? 'text-green-400' : 'text-orange-400'}`}>
              {suGiu ? '+' : ''}{delta}%
            </span>
          )}
        </div>
        <div className="mt-3 flex items-end gap-2 h-[76px]" role="img"
          aria-label={settimane.map(s => `${s.breve}: ${Math.round(s.load)} punti`).join(', ')}>
          {settimane.map((s, i) => {
            const ultima = i === settimane.length - 1
            return (
              <div key={s.startStr} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-[7px] transition-[height] duration-700 ease-out"
                  style={{
                    // Il minimo di 3px: una settimana a zero e una senza dati sono due cose diverse.
                    height: `${Math.max((s.load / massimo) * 56, s.load > 0 ? 3 : 0)}px`,
                    background: ultima ? BRAND : 'rgba(255,255,255,.14)',
                    boxShadow: ultima ? '0 8px 20px -8px rgba(241,197,23,.6)' : undefined,
                  }} />
                <span className={`text-[11px] font-bold ${ultima ? 'text-brand' : 'text-muted'}`}>{s.breve}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[14px] leading-[1.45] text-gray-200 text-pretty">
          {frase}{dettaglio && <span className="text-muted"> {dettaglio}</span>}
        </p>
      </div>
      {children}
    </section>
  )
}

/** Le quattro fasce di RPE come una barra sola. */
export function BarraFasce({ distribuzione }) {
  const { light, moderate, hard, extreme, total } = distribuzione
  if (!total) return <div className="mt-2 h-1.5 rounded-full bg-white/[.1]" />
  const fasce = [
    ['Leggero 1-4', light, '#22c55e'],
    ['Moderato 5-6', moderate, '#f1c517'],
    ['Impegnativo 7-8', hard, '#f97316'],
    ['Massimale 9-10', extreme, '#ef4444'],
  ]
  return (
    <div className="mt-2 flex gap-[3px] h-1.5" role="img"
      aria-label={fasce.filter(([, n]) => n > 0).map(([e, n]) => `${e}: ${n}`).join(', ')}>
      {fasce.map(([etichetta, n, colore]) => n > 0 && (
        <div key={etichetta} className="rounded-full" style={{ width: `${(n / total) * 100}%`, background: colore }} />
      ))}
    </div>
  )
}

/**
 * Un allenamento in programma, in una riga: il giorno grande a sinistra (come
 * un'agenda), il puntino della corsia, il titolo. Il tocco apre l'allenamento.
 * La nota (scritta e vocale) si apre sotto la riga col bottone della nota
 * (25/11/2026, il committente: «rimetti le note nei prossimi allenamenti»):
 * chiusa, la riga ne mostra l'inizio, così si vede chi l'ha già.
 */
export function RigaProssimo({ giorno, mese, settimana, titolo, categoria, colore, dettaglio, onApri, onRimuovi,
  anteprimaNota, vocale = false, notaAperta = false, onNota, children }) {
  const conNota = !!anteprimaNota || vocale
  return (
    <li className={`flex flex-col rounded-[18px] transition-colors ${notaAperta ? 'bg-white/[.04]' : ''}`}>
      <div className="relative flex items-stretch">
        <button type="button" onClick={onApri}
          className="flex-1 min-w-0 flex items-center gap-4 py-3 pl-4 pr-2 text-left transition hover:bg-white/[.04] rounded-[18px]">
          <span className="shrink-0 w-11 text-center">
            <span className="block text-[11px] font-extrabold uppercase tracking-[.08em] text-muted">{settimana}</span>
            <b className="block text-[24px] leading-none font-black tracking-[-.03em] text-white tabular-nums">{giorno}</b>
            <span className="block mt-0.5 text-[11px] font-bold text-muted">{mese}</span>
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-1.5 text-[12px] font-extrabold text-white/70">
              <i className="w-2 h-2 rounded-full shrink-0" style={{ background: colore, boxShadow: `0 0 8px ${conVelo(colore, 0.5)}` }} aria-hidden="true" />
              {categoria}{dettaglio && <span className="font-bold text-muted">· {dettaglio}</span>}
            </span>
            <b className="mt-0.5 block text-[16px] leading-snug font-extrabold text-white line-clamp-2 break-words">{titolo}</b>
            {conNota && !notaAperta && (
              <span className="mt-1 flex items-center gap-1.5 text-[13px] text-gray-400 min-w-0">
                {vocale && <Mic size={13} className="shrink-0" style={{ color: colore }} aria-label="Nota vocale" />}
                {anteprimaNota && <span className="truncate">{anteprimaNota}</span>}
              </span>
            )}
          </span>
          {!onRimuovi && !onNota && <ChevronRight size={17} className="shrink-0 text-muted" aria-hidden="true" />}
        </button>
        {onNota && (
          <button type="button" onClick={onNota} aria-expanded={notaAperta} aria-label="Nota"
            className={`relative shrink-0 w-11 grid place-items-center transition ${notaAperta ? 'text-white' : 'text-muted hover:text-white'}`}>
            <MessageSquareText size={18} aria-hidden="true" />
            {conNota && !notaAperta && <i className="absolute top-[calc(50%-12px)] right-2 w-2 h-2 rounded-full" style={{ background: colore }} aria-hidden="true" />}
          </button>
        )}
        {onRimuovi && (
          <button type="button" onClick={onRimuovi} aria-label="Elimina l'allenamento" title="Rimuovi assegnazione"
            className="shrink-0 w-11 grid place-items-center text-muted hover:text-red-500 transition">
            <Trash2 size={17} aria-hidden="true" />
          </button>
        )}
      </div>
      {notaAperta && <div className="px-3 pb-3">{children}</div>}
    </li>
  )
}

/** Il contenitore delle righe del profilo: una superficie sola, righe divise da un filo. */
export const GRUPPO_RIGHE = `${SUPERFICIE} overflow-hidden divide-y divide-white/[.07] empty:hidden`
const RIGA_IN_GRUPPO = 'w-full px-4 py-[15px] flex items-center gap-3 text-left'

/**
 * Una sezione che si apre in pagina.
 *
 * Sostituisce due delle tre tab. La differenza che conta non è estetica: una
 * tab nasconde il contenuto E l'esistenza del contenuto, mentre la riga dice
 * quanto c'è dentro prima di aprirla — 34 allenamenti, 6 record.
 */
export function RigaApribile({ icona: Icona, titolo, conteggio, aperta, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={aperta}
      className={`${RIGA} w-full px-[15px] py-[13px] flex items-center gap-3 text-left
                  hover:bg-white/[.055] transition`}>
      <Icona size={18} className={aperta ? 'text-brand shrink-0' : 'text-muted shrink-0'} aria-hidden="true" />
      <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">{titolo}</span>
      {conteggio != null && (
        <span className="shrink-0 text-[11px] font-bold text-muted">{conteggio}</span>
      )}
      <ChevronDown size={17} aria-hidden="true"
        className={`shrink-0 transition-transform ${aperta ? 'rotate-180 text-brand' : 'text-muted'}`} />
    </button>
  )
}

/** Una riga che è un comando e basta: nessun conteggio, nessuna apertura. */
export function RigaAzione({ icona: Icona, titolo, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`${RIGA} w-full px-[15px] py-[13px] flex items-center gap-3 text-left
                  hover:bg-white/[.055] transition`}>
      <Icona size={18} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">{titolo}</span>
      <ChevronRight size={17} className="shrink-0 text-muted" aria-hidden="true" />
    </button>
  )
}

/** La pillola «In pausa». ⚠️ Il chiamante la nasconde all'atleta (§9-decies). */
export function PillolaPausa({ dal }) {
  return (
    <p className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap
                  bg-orange-500/10 border border-orange-500/30 text-orange-400
                  text-[11px] font-bold uppercase tracking-[.06em]">
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-orange-400" />
      In pausa{dal ? ` dal ${dal}` : ''}
    </p>
  )
}

/** «Coach: <nome>» — solo per gli admin; apre la scelta di chi segue l'atleta. */
export function RigaCoach({ nome, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`${RIGA_IN_GRUPPO} hover:bg-white/[.04] transition`}>
      <UserCog size={18} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">Coach: {nome}</span>
      <ChevronRight size={17} className="shrink-0 text-muted" aria-hidden="true" />
    </button>
  )
}

/**
 * «Scarpe: Pegasus 41 · 412 km» — la principale dell'atleta, per il coach.
 * Solo lettura (nessun bottone: il coach non scrive le scarpe). Con una scarpa
 * attiva oltre la soglia aggiunge «da cambiare». Senza principale, «Scarpe: 2
 * attive» solo se c'è da avvisare. Senza scarpe attive: niente.
 */
/**
 * Team (06/11/2026): i team del coach in cui l'atleta è dentro o invitato.
 * Senza team, niente riga. Il tocco apre il primo team (o la lista, se sono più).
 */
export function RigaTeamCoach({ team, onApri }) {
  if (!team?.length) return null
  const nomi = team.map(t => (t.stato === 'invitato' ? `${t.nome} (invitato)` : t.nome)).join(', ')
  return (
    <button type="button" onClick={onApri}
      className={`${RIGA_IN_GRUPPO} hover:bg-white/[.04] transition`}>
      <UsersRound size={18} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">{`Team: ${nomi}`}</span>
      <ChevronRight size={17} aria-hidden="true" className="shrink-0 text-muted" />
    </button>
  )
}

/**
 * Gruppi (16/11/2026): i gruppi del coach in cui c'è l'atleta. Senza gruppi,
 * niente riga (l'azione resta nel menu). Il tocco apre «Team e gruppi».
 */
export function RigaGruppiCoach({ gruppi, onApri }) {
  if (!gruppi?.length) return null
  return (
    <button type="button" onClick={onApri}
      className={`${RIGA_IN_GRUPPO} hover:bg-white/[.04] transition`}>
      <Layers size={18} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">{`Gruppi: ${gruppi.map(g => g.nome).join(', ')}`}</span>
      <ChevronRight size={17} aria-hidden="true" className="shrink-0 text-muted" />
    </button>
  )
}

export function RigaScarpeCoach({ scarpe }) {
  const attive = (scarpe || []).filter(s => !s.ritirata_at)
  const principale = attive.find(s => s.principale)
  const daCambiare = attive.some(s => s.stato === 'oltre')
  // Senza principale la riga serve solo per l'avviso: allora dice quante sono attive.
  if (!principale && !daCambiare) return null
  const testo = principale
    ? `Scarpe: ${principale.modello} · ${testoKm(principale.km)} km`
    : `Scarpe: ${attive.length} ${attive.length === 1 ? 'attiva' : 'attive'}`
  return (
    <div className={RIGA_IN_GRUPPO}>
      <Footprints size={18} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">
        {testo}
      </span>
      {daCambiare && <span className="shrink-0 text-[12px] font-bold text-red-500">da cambiare</span>}
    </div>
  )
}
