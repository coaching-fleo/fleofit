// CruscottoCoachUI.jsx — i pezzi della Home coach, telefono e desktop (14/10/2026).
//
// Disegno approvato dal committente il 14/10/2026 (tela «Home coach FLEOFIT»):
// polso del team, oggi, da rivedere nel programma, da smaltire, settimana,
// gare. Gli stessi pezzi servono le due disposizioni: `compatto` è il telefono.
//
// SOLA PRESENTAZIONE: i numeri arrivano già calcolati da src/lib/cruscottoCoach.js
// (e da statisticheCoach.js per feedback, fermi, scaduti). Qui non si calcola,
// e dove il dato manca si scrive «—» invece di uno zero (CLAUDE.md §9).

import { useState } from 'react'
import { User, ChevronRight, CalendarDays } from 'lucide-react'
import { corsia } from '../lib/categorie'
import { TONI_RISPOSTA } from '../lib/comeStai'

const CARTA = 'bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl'

export function Volto({ foto, nome, anello = '', piccolo = false }) {
  const iniziali = (nome || '').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className={`${piccolo ? 'w-[34px] h-[34px] text-xs' : 'w-10 h-10 text-[13px]'} rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden
                      flex items-center justify-center text-gray-300 font-extrabold ${anello}`}>
      {foto
        ? <img src={foto} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0 }} />
        : (iniziali || <User size={16} aria-hidden="true" />)}
    </span>
  )
}

function Titolo({ id, children, meta, compatto }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className={`${compatto ? 'text-[19px]' : 'text-xl'} font-extrabold tracking-[-.02em] text-white`}>{children}</h2>
      {meta && <span className="text-[13px] font-semibold text-gray-400 shrink-0">{meta}</span>}
    </div>
  )
}

// ── Il polso del team ──────────────────────────────────────────────────────

function Tessera({ etichetta, valore, unita, nota, tonoNota = 'text-gray-400', grafico, compatto }) {
  return (
    <div className={`${CARTA} !rounded-[20px] flex flex-col gap-1.5 ${compatto ? 'shrink-0 w-[150px] p-3.5' : 'p-[18px] min-w-0'}`}>
      <span className="text-[13px] font-semibold text-gray-400">{etichetta}</span>
      <div className="flex items-end justify-between gap-2">
        <span className={`${compatto ? 'text-[28px]' : 'text-[34px]'} leading-none font-black tracking-[-.03em] text-white whitespace-nowrap`}>
          {valore ?? '—'}{valore != null && unita && <span className={`${unita === '%' ? 'ml-0.5' : 'ml-1.5'} text-[15px] font-bold text-gray-300`}>{unita}</span>}
        </span>
        {!compatto && grafico}
      </div>
      <span className={`text-[13px] font-semibold ${tonoNota}`}>{nota}</span>
    </div>
  )
}

const virgola = (n) => String(n).replace('.', ',')

/** Una barra per giorno: alta quanto la percentuale, l'ultima in giallo. Un giorno senza assegnazioni è un trattino. */
function BarreAderenza({ barre }) {
  return (
    <svg width="84" height="30" viewBox="0 0 84 30" aria-hidden="true">
      {barre.map((p, i) => {
        const h = p == null ? 2 : Math.max(3, Math.round((p / 100) * 28))
        return <rect key={i} x={i * 12} y={30 - h} width="8" height={h} rx="2"
          className={i === barre.length - 1 ? 'fill-brand' : 'fill-[#3a3a3a]'} />
      })}
    </svg>
  )
}

/** Le tacche di chi ha risposto oggi, dal peggiore al migliore. */
function TaccheTeam({ tacche }) {
  if (!tacche.length) return null
  return (
    <div className="flex gap-[2px] items-end shrink-0" aria-hidden="true">
      {tacche.slice(0, 10).map((v, i) => (
        <span key={i} className={`w-1.5 h-[26px] rounded-[2px] ${TONI_RISPOSTA[Math.min(4, Math.max(0, Math.round(v) - 1))].sfondo}`} />
      ))}
    </div>
  )
}

export function PolsoTeam({ aderenza, rpe, comeSta, gara, compatto = false }) {
  const segno = (n) => (n > 0 ? `↑ ${n}` : n < 0 ? `↓ ${Math.abs(n)}` : '=')
  const notaComeSta = comeSta.risposte === 0
    ? (comeSta.senzaRisposta > 0 ? `${comeSta.senzaRisposta} non ${comeSta.senzaRisposta === 1 ? 'ha' : 'hanno'} risposto` : 'Nessuna risposta oggi')
    : [comeSta.giornateStorte > 0 && `${comeSta.giornateStorte} da tenere d'occhio`,
       comeSta.senzaRisposta > 0 && `${comeSta.senzaRisposta} senza risposta`].filter(Boolean).join(' · ') || `${comeSta.risposte} risposte, tutte buone`
  return (
    <section aria-label="Il polso del team"
      className={compatto ? 'flex gap-2.5 -mx-4 px-4 overflow-x-auto hide-scrollbar' : 'grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3'}>
      <Tessera compatto={compatto} etichetta={compatto ? 'Aderenza 7 gg' : 'Aderenza · 7 giorni'}
        valore={aderenza.percentuale} unita="%"
        nota={aderenza.percentuale == null ? 'Niente assegnato' : aderenza.delta == null ? `${aderenza.fatti} su ${aderenza.assegnati}` : `${segno(aderenza.delta)} punti${compatto ? '' : ' sulla settimana prima'}`}
        tonoNota={aderenza.delta > 0 ? 'text-green-400' : aderenza.delta < 0 ? 'text-orange-400' : 'text-gray-400'}
        grafico={<BarreAderenza barre={aderenza.barre} />} />
      <Tessera compatto={compatto} etichetta={compatto ? 'Come sta il team' : 'Come sta il team · oggi'}
        valore={comeSta.fascia?.etichetta ?? null}
        nota={notaComeSta}
        tonoNota={comeSta.giornateStorte > 0 ? 'text-orange-400' : 'text-gray-400'}
        grafico={<TaccheTeam tacche={comeSta.tacche} />} />
      <Tessera compatto={compatto} etichetta={compatto ? 'RPE medio' : 'RPE medio · settimana'}
        valore={rpe.medio != null ? virgola(rpe.medio) : null}
        nota={rpe.medio == null ? 'Servono almeno 2 RPE' : rpe.prevista != null ? `Previsto ${virgola(rpe.prevista)}` : `${rpe.quanti} dichiarati`}
        tonoNota={rpe.prevista != null && rpe.medio - rpe.prevista >= 1 ? 'text-orange-400' : 'text-gray-400'} />
      <Tessera compatto={compatto} etichetta="Prossima gara"
        valore={gara ? gara.giorni : null} unita={gara ? (gara.giorni === 1 ? 'giorno' : 'giorni') : null}
        nota={gara ? `${gara.nome} · ${gara.atleti.length} ${gara.atleti.length === 1 ? 'atleta' : 'atleti'}` : 'Nessuna nei prossimi 60 giorni'}
        tonoNota={gara ? 'text-gray-300' : 'text-gray-400'} />
    </section>
  )
}

// ── Oggi ───────────────────────────────────────────────────────────────────

const STATO = {
  completato: { testo: 'Fatto', classe: 'text-green-400', anello: 'ring-2 ring-green-500' },
  'in corso': { testo: 'In corso', classe: 'text-red-400', anello: 'ring-2 ring-red-500' },
  'da fare': { testo: 'Da fare', classe: 'text-gray-400', anello: '' },
}

/** Le quattro risposte di «Come stai»: sonno, energia, dolori, stress. Tratteggio = non ha risposto. */
function Tacche({ comeSta, piccole }) {
  const dim = piccole ? 'w-[5px] h-3.5' : 'w-1.5 h-5'
  const etichetta = comeSta ? comeSta.map(r => `${r.titolo}: ${r.parola ?? 'non risposto'}`).join(', ') : 'Non ha risposto a «Come stai»'
  return (
    <span role="img" aria-label={etichetta} className="flex gap-[3px] shrink-0">
      {[0, 1, 2, 3].map(i => {
        const v = comeSta?.[i]?.valore
        return <span key={i} className={`${dim} rounded-[2px] ${v ? TONI_RISPOSTA[v - 1].sfondo : 'border border-dashed border-[#4a4a4a]'}`} />
      })}
    </span>
  )
}

function RigaAllarme({ r, compatto, onAlleggerisci }) {
  const c = corsia(r.categoria)
  return (
    <div className={`${compatto ? '-mx-2' : '-mx-3'} mt-3 mb-1 p-3 rounded-2xl bg-red-500/[.08] border border-red-500/25`}>
      <div className="flex items-center gap-3.5">
        <Volto foto={r.foto} nome={r.nome} anello="ring-2 ring-red-500" />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-white">{r.nome}</div>
          <div className="text-[13px] text-gray-300 mt-0.5 truncate">
            <span className={`font-bold ${c.txt}`}>{c.etichetta}</span> · {r.titolo} · intensità {r.intensita}
          </div>
          {!compatto && <div className="text-[13px] font-semibold text-red-400 mt-1">{r.motivi.join(' · ')}</div>}
        </div>
        {!compatto && (
          <button type="button" onClick={() => onAlleggerisci(r)}
            className="shrink-0 h-10 px-4 rounded-xl bg-white text-black text-[13px] font-extrabold transition hover:brightness-90">
            Alleggerisci
          </button>
        )}
      </div>
      {compatto && (<>
        <p className="mt-2.5 text-[13px] font-semibold text-red-400">{r.motivi.join(' · ')}</p>
        <button type="button" onClick={() => onAlleggerisci(r)}
          className="mt-2.5 w-full h-11 rounded-xl bg-white text-black text-sm font-extrabold active:scale-[.98] transition">
          Alleggerisci l'allenamento
        </button>
      </>)}
    </div>
  )
}

export function CardOggi({ righe = [], completati = 0, assegnati = 0, inCorso = 0, caricamento, compatto = false,
                          mostrate = compatto ? 3 : 6, onApriAtleta, onAlleggerisci }) {
  const [tutte, setTutte] = useState(false)
  const allarmi = righe.filter(r => r.allarme)
  const altre = righe.filter(r => !r.allarme)
  const visibili = tutte ? altre : altre.slice(0, Math.max(0, mostrate - allarmi.length))
  const restanti = altre.length - visibili.length
  const daFare = assegnati - completati - inCorso
  const meta = assegnati === 0 ? null
    : compatto ? `${completati} su ${assegnati} fatti${inCorso ? ` · ${inCorso} in corso` : ''}`
      : [`${completati} fatti`, inCorso > 0 && `${inCorso} in corso`, daFare > 0 && `${daFare} da fare`].filter(Boolean).join(' · ')
  const conSenzaRisposta = righe.filter(r => !r.comeSta && r.stato !== 'completato').length

  return (
    <section aria-labelledby="c-oggi" className={`${CARTA} ${compatto ? 'p-[18px]' : 'px-6 py-[22px]'}`}>
      <Titolo id="c-oggi" compatto={compatto} meta={meta}>
        {assegnati > 0 && !compatto ? `Oggi · ${assegnati} ${assegnati === 1 ? 'allenamento' : 'allenamenti'}` : 'Oggi'}
      </Titolo>
      {caricamento ? <div className="h-40 animate-pulse" /> : assegnati === 0 ? (
        <p className="pt-4 text-sm text-gray-400">Nessun allenamento assegnato oggi.</p>
      ) : (<>
        <div className="flex gap-1 mt-3.5 mb-1" aria-hidden="true">
          {righe.map(r => (
            <span key={r.id} className={`flex-1 h-1.5 rounded-[3px] ${r.stato === 'completato' ? 'bg-green-500' : r.stato === 'in corso' ? 'bg-red-500' : 'bg-[#333]'}`} />
          ))}
        </div>
        {allarmi.map(r => <RigaAllarme key={r.id} r={r} compatto={compatto} onAlleggerisci={onAlleggerisci} />)}
        {visibili.map((r, i) => {
          const s = STATO[r.stato] || STATO['da fare']
          const c = corsia(r.categoria)
          return (
            <button key={r.id} type="button" onClick={() => onApriAtleta(r)}
              className={`w-full flex items-center gap-3.5 py-3 text-left group ${i > 0 || allarmi.length > 0 ? 'border-t border-[#2a2a2a]' : ''}`}>
              <Volto foto={r.foto} nome={r.nome} anello={s.anello} />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-bold text-white group-hover:text-brand transition">{r.nome}</span>
                <span className="block text-[13px] text-gray-400 mt-0.5 truncate">
                  <span className={`font-bold ${c.txt}`}>{c.etichetta}</span> · {r.titolo}
                </span>
                {r.avviso && <span className="block text-[13px] font-semibold text-orange-400 mt-0.5 truncate">{r.motivi.join(' · ')}</span>}
              </span>
              {compatto ? (
                <span className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-xs font-bold ${s.classe}`}>{r.rpe != null ? `RPE ${r.rpe}` : s.testo}</span>
                  <Tacche comeSta={r.comeSta} piccole />
                </span>
              ) : (<>
                <Tacche comeSta={r.comeSta} />
                <span className={`w-[120px] text-right text-[13px] font-bold shrink-0 ${s.classe}`}>
                  {s.testo}{r.rpe != null ? ` · RPE ${r.rpe}` : ''}
                </span>
              </>)}
            </button>
          )
        })}
        {restanti > 0 && (
          <button type="button" onClick={() => setTutte(true)}
            className="w-full pt-3 border-t border-[#2a2a2a] text-left text-[13px] font-bold text-brand">
            Vedi tutti e {righe.length}
          </button>
        )}
        {!compatto && (
          <p className="mt-2.5 text-xs text-gray-500">
            Le tacche sono sonno, energia, dolori e stress di «Come stai oggi»: verde bene, rosso male, tratteggio non ha risposto.
            {conSenzaRisposta > 0 && ` ${conSenzaRisposta} ${conSenzaRisposta === 1 ? 'deve' : 'devono'} ancora rispondere.`}
          </p>
        )}
      </>)}
    </section>
  )
}

// ── Da rivedere nel programma ──────────────────────────────────────────────

const ICONA_SEGNALE = {
  'piu-duro': { segno: '↑', classe: 'bg-red-500/[.14] text-red-400' },
  'piu-facile': { segno: '↓', classe: 'bg-running/[.16] text-running' },
  carico: { segno: '↗', classe: 'bg-brand/[.14] text-brand' },
  note: { segno: '↷', classe: 'bg-orange-500/[.14] text-orange-400' },
}
const TONO_BARRA = { alto: 'bg-red-500', medio: 'bg-orange-500', basso: 'bg-running', neutro: 'bg-[#444]' }

export function CardSegnali({ segnali = [], caricamento, compatto = false, mostrate = 4, onApri }) {
  const [tutti, setTutti] = useState(false)
  const visibili = tutti ? segnali : segnali.slice(0, mostrate)
  return (
    <section aria-labelledby="c-segnali" className={`${CARTA} ${compatto ? 'p-[18px]' : 'px-6 py-[22px]'}`}>
      <Titolo id="c-segnali" compatto={compatto} meta={compatto ? null : 'ultime 4 settimane'}>Da rivedere nel programma</Titolo>
      {caricamento ? <div className="h-28 animate-pulse" /> : segnali.length === 0 ? (
        <p className="pt-3 text-sm text-gray-400">
          Nessun segnale nelle ultime 4 settimane: RPE in linea con quello che hai programmato, carico regolare, nessun esercizio saltato più volte.
        </p>
      ) : (<>
        {visibili.map((s, i) => {
          const ic = ICONA_SEGNALE[s.tipo]
          return (
            <button key={s.chiave} type="button" onClick={() => onApri(s)}
              className={`w-full flex items-start gap-3.5 py-3.5 text-left group ${i > 0 ? 'border-t border-[#2a2a2a]' : 'mt-1'}`}>
              <span aria-hidden="true" className={`${compatto ? 'w-9 h-9' : 'w-10 h-10'} rounded-xl shrink-0 flex items-center justify-center text-lg font-black ${ic.classe}`}>{ic.segno}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-bold text-white group-hover:text-brand transition">{s.frase}</span>
                <span className="block text-[13px] text-gray-400 mt-0.5">{s.prova}</span>
                {!compatto && s.barre.length > 0 && (
                  <span className="flex gap-1 mt-2.5" aria-hidden="true">
                    {s.barre.map((t, j) => <span key={j} className={`w-7 h-2 rounded-[3px] ${TONO_BARRA[t]}`} />)}
                  </span>
                )}
              </span>
              {!compatto && <span className="shrink-0 pt-0.5 text-[13px] font-bold text-brand">Apri la scheda</span>}
            </button>
          )
        })}
        {segnali.length > visibili.length && (
          <button type="button" onClick={() => setTutti(true)}
            className="w-full pt-3 border-t border-[#2a2a2a] text-left text-[13px] font-bold text-brand">
            Altri {segnali.length - visibili.length}
          </button>
        )}
      </>)}
    </section>
  )
}

// ── Da smaltire ────────────────────────────────────────────────────────────

const PILLOLA = {
  feedback: { testo: 'Feedback', classe: 'bg-brand/[.14] text-brand' },
  fermo: { testo: 'Fermo', classe: 'bg-[#2a2a2a] text-gray-300' },
  scaduto: { testo: 'Scaduto', classe: 'bg-[#2a2a2a] text-gray-300' },
  recupero: { testo: 'Recupero', classe: 'bg-[#2a2a2a] text-gray-300' },
}
// Un tipo che qui non c'è non deve mai buttare giù la Home: pillola neutra.
const pillolaDi = (tipo) => PILLOLA[tipo] ?? { testo: 'Da vedere', classe: 'bg-[#2a2a2a] text-gray-300' }
const coloreRpe = (v) => (v <= 3 ? 'text-green-400' : v <= 6 ? 'text-brand' : v <= 8 ? 'text-orange-400' : 'text-red-400')

/** Feedback, recupero, fermi e scaduti in UNA lista (`cosaGuardare`): ogni voce apre la cosa giusta. */
export function CardSmaltire({ voci = [], caricamento, compatto = false, mostrate = compatto ? 4 : 6, onApri }) {
  const [tutte, setTutte] = useState(false)
  const visibili = tutte ? voci : voci.slice(0, mostrate)
  return (
    <section aria-labelledby="c-smaltire" className={`${CARTA} ${compatto ? 'p-[18px]' : 'px-6 py-[22px]'}`}>
      <div className="flex items-center gap-2.5">
        <h2 id="c-smaltire" className={`${compatto ? 'text-[19px]' : 'text-xl'} font-extrabold tracking-[-.02em] text-white`}>Da smaltire</h2>
        {voci.length > 0 && (
          <span className="min-w-[26px] h-[26px] px-2 rounded-full bg-brand text-black text-[13px] font-black flex items-center justify-center">{voci.length}</span>
        )}
      </div>
      {caricamento ? <div className="h-28 animate-pulse" /> : voci.length === 0 ? (
        <p className="pt-3 text-sm text-gray-400">Sei in pari: feedback letti, nessuno fermo, niente scaduto.</p>
      ) : (<>
        <div className="mt-2">
          {visibili.map((v, i) => (
            <button key={v.chiave} type="button" onClick={() => onApri(v)}
              aria-label={`${v.azione}: ${v.nome}`}
              className={`w-full flex items-center gap-3 py-3 text-left group ${i > 0 ? 'border-t border-[#2a2a2a]' : ''}`}>
              {compatto
                ? <span className={`shrink-0 px-2 py-[3px] rounded-full text-[11px] font-extrabold ${pillolaDi(v.tipo).classe}`}>{pillolaDi(v.tipo).testo}</span>
                : <Volto foto={v.foto} nome={v.nome} piccolo />}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-white group-hover:text-brand transition truncate">
                  {v.nome}
                  {v.rpe != null && <span className={`ml-1.5 font-semibold ${coloreRpe(v.rpe)}`}>RPE {v.rpe}</span>}
                </span>
                <span className={`block text-[13px] mt-0.5 truncate ${v.avviso && !compatto ? 'text-orange-400' : 'text-gray-400'}`}>{v.riga}</span>
              </span>
              {!compatto && <span className={`shrink-0 px-2 py-[3px] rounded-full text-[11px] font-extrabold ${pillolaDi(v.tipo).classe}`}>{pillolaDi(v.tipo).testo}</span>}
            </button>
          ))}
        </div>
        {voci.length > visibili.length && (
          <button type="button" onClick={() => setTutte(true)}
            className="w-full pt-3 border-t border-[#2a2a2a] text-left text-[13px] font-bold text-brand inline-flex items-center gap-1">
            Altre {voci.length - visibili.length}<ChevronRight size={14} aria-hidden="true" />
          </button>
        )}
      </>)}
    </section>
  )
}

// ── La settimana ───────────────────────────────────────────────────────────

// Classi intere: Tailwind non troverebbe un `border-${x}` composto a runtime.
const BORDO = { Hyrox: 'border-brand', Running: 'border-running', Gym: 'border-gym', Custom: 'border-custom', Event: 'border-white' }
const LEGENDA = [['Hyrox', 'bg-brand'], ['Corsa', 'bg-running'], ['Gym', 'bg-gym'], ['Libero', 'bg-custom']]

function Cella({ cella, compatto, onApri }) {
  const altezza = compatto ? 'h-[30px] text-[10px]' : 'h-[34px] text-[11px]'
  const base = `${altezza} min-w-0 rounded-lg font-extrabold flex items-center justify-center overflow-hidden whitespace-nowrap px-1`
  if (cella.chips.length === 0) {
    return cella.quando === 'futuro'
      ? <span className={`${base} border-[1.5px] border-dashed border-[#444] text-[#555]`} aria-label="Da programmare">+</span>
      : <span className={`${base} bg-[#161616] border border-[#222]`} aria-label="Niente" />
  }
  const ch = cella.chips[0]
  const altre = cella.chips.length - 1
  const c = corsia(ch.categoria)
  const etichetta = ch.categoria === 'Event' ? 'GARA' : ch.completato ? '✓' : ch.saltato ? 'saltato' : ch.titolo
  const stile = ch.categoria === 'Event' ? 'bg-white text-black'
    : ch.completato ? `${c.bg} ${c.testoSuBg}`
      : ch.saltato ? 'bg-red-500/[.12] border border-red-500/50 text-red-400'
        : `border-[1.5px] ${c.txt} ${BORDO[ch.categoria] || BORDO.Hyrox}`
  return (
    <button type="button" onClick={() => onApri(ch)}
      aria-label={`${ch.titolo}${ch.completato ? ', fatto' : ch.saltato ? ', saltato' : ''}`}
      className={`${base} ${stile} transition hover:brightness-110`}>
      <span className="truncate">{etichetta}</span>{altre > 0 && <span className="ml-0.5 opacity-80">+{altre}</span>}
    </button>
  )
}

export function CardPiano({ piano, titolo, nota, caricamento, compatto = false, onApri, onCalendario }) {
  const colonne = { gridTemplateColumns: `${compatto ? '92px' : '150px'} repeat(${piano.giorni.length}, minmax(0, 1fr))` }
  return (
    <section aria-labelledby="c-piano" className={`${CARTA} ${compatto ? 'p-[18px]' : 'px-6 py-[22px]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 id="c-piano" className={`${compatto ? 'text-[19px]' : 'text-xl'} font-extrabold tracking-[-.02em] text-white`}>{titolo}</h2>
          {nota && <p className={`mt-1 text-[13px] font-semibold ${nota.avviso ? 'text-orange-400' : 'text-green-400'}`}>{nota.testo}</p>}
        </div>
        {!compatto && (
          <div className="flex flex-wrap items-center gap-3.5 text-xs font-semibold text-gray-400">
            {LEGENDA.map(([t, cl]) => <span key={t} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-[3px] ${cl}`} />{t}</span>)}
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] border-[1.5px] border-dashed border-[#555]" />Da programmare</span>
            <button type="button" onClick={onCalendario} className="ml-1 inline-flex items-center gap-1.5 text-[13px] font-bold text-brand">
              <CalendarDays size={15} aria-hidden="true" />Calendario
            </button>
          </div>
        )}
      </div>
      {caricamento ? <div className="h-40 animate-pulse" /> : piano.righe.length === 0 ? (
        <p className="text-sm text-gray-400">Nessun atleta da programmare.</p>
      ) : (
        <div className="overflow-x-auto hide-scrollbar">
          <div className={`${compatto ? '' : 'min-w-[760px]'} flex flex-col gap-1.5`}>
            <div className="grid gap-1.5 text-xs font-bold" style={colonne}>
              <span />
              {piano.giorni.map(d => (
                <span key={d.data} className={`text-center ${d.oggi ? 'text-brand' : 'text-gray-500'}`}>{d.etichetta}</span>
              ))}
            </div>
            {piano.righe.map(r => (
              <div key={r.id} className="grid gap-1.5 items-center" style={colonne}>
                <span className={`${compatto ? 'text-[13px]' : 'text-sm'} font-bold text-white truncate`}>{r.nome}</span>
                {r.celle.map(c => <Cella key={c.data} cella={c} compatto={compatto} onApri={onApri} />)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Gare in arrivo ─────────────────────────────────────────────────────────

const quandoGara = (giorni) => (giorni === 0 ? 'oggi' : giorni === 1 ? 'domani' : `tra ${giorni} giorni`)

export function CardGare({ gare = [], compatto = false, onApri }) {
  if (gare.length === 0) return null
  return (
    <section aria-labelledby="c-gare" className={`${CARTA} ${compatto ? 'p-[18px]' : 'px-6 py-[22px]'}`}>
      <Titolo id="c-gare" compatto={compatto}>Gare in arrivo</Titolo>
      <div className="mt-1">
        {gare.slice(0, compatto ? 2 : 4).map((g, i) => (
          <button key={g.chiave} type="button" onClick={() => onApri(g)}
            className={`w-full flex items-center gap-3.5 py-3 text-left group ${i > 0 ? 'border-t border-[#2a2a2a]' : ''}`}>
            <span className="w-[52px] h-[52px] rounded-[14px] bg-white text-black shrink-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black leading-none">{g.giorno}</span>
              <span className="text-[11px] font-extrabold">{g.mese}</span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-bold text-white group-hover:text-brand transition truncate">{g.nome}</span>
              <span className="block text-[13px] text-gray-400 mt-0.5 truncate">{g.atleti.map(a => a.nome).join(', ')}</span>
            </span>
            <span className={`shrink-0 text-[13px] font-extrabold ${i === 0 ? 'text-brand' : 'text-gray-400'}`}>{quandoGara(g.giorni)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
