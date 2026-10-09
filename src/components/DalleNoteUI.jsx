// DalleNoteUI.jsx — la sezione «Dalle note» della scheda atleta (09/10/2026).
//
// Cosa dicono le note dell'atleta, trasformate in dati da `estrai-note`:
// risultati dichiarati, sensazioni sul workout, stato (stanchezza, motivazione,
// viaggio, lavoro). Niente dati di salute: lo standard v1 li esclude (spec
// docs/superpowers/specs/2026-10-09-dati-dalle-note-design.md, §2).
//
// Stesso patto degli altri *UI.jsx: SOLA PRESENTAZIONE. I conti stanno in
// `src/lib/dalleNote.js`, la rete in `src/lib/noteEstratte.js`.
//
// ⚠️ Si carica pigra da AthleteDetail, e solo per il coach: la scheda è anche
// `/profile` dell'atleta, e questi sono dati del coach SU di lui. Per lo stesso
// motivo qui non entra niente di pesante (niente librerie di grafici: SVG a
// mano, come l'anello e lo sparkline della scheda).
//
// ⚠️ Ogni dato porta la sua citazione: il coach deve poter leggere le parole
// dell'atleta, non un'etichetta scelta da un'IA.

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { CARD, LABEL } from '../lib/stiliCard'
import { BRAND } from '../lib/colori'
import { testoNota } from '../lib/rpe'
import {
  FINESTRE, FINESTRA_INIZIALE, estrattiValidi, copertura, nellaFinestra, serieRisultati,
  settimaneSensazioni, modificheFrequenti, righeStato, formattaValore,
} from '../lib/dalleNote'

// La scala dell'RPE dell'app (verde → giallo → arancione → rosso), non colori nuovi.
const VERDE = '#22c55e', ARANCIO = '#f97316', ROSSO = '#ef4444', GRIGIO = '#444'
const COLORE_DIFFICOLTA = { troppo_facile: BRAND, giusta: VERDE, troppo_dura: ROSSO }
const NOME_DIFFICOLTA = { troppo_facile: 'Troppo facile', giusta: 'Giusta', troppo_dura: 'Troppo dura' }
const COLORE_SEGNO = { '-1': ARANCIO, 0: GRIGIO, 1: VERDE }
const NOME_FATTORE = { stanchezza: 'Stanchezza', motivazione: 'Motivazione', viaggio: 'Viaggio', lavoro: 'Lavoro' }

const giorno = (d) => format(parseISO(d), 'd MMM', { locale: it })
const volte = (n) => `${n} ${n === 1 ? 'volta' : 'volte'}`

export default function DalleNoteUI({ nome, workouts = [], estratti = [], stato = 'pronto', onApriWorkout, oggi = new Date() }) {
  const [giorni, setGiorni] = useState(FINESTRA_INIZIALE)

  const validi = useMemo(() => estrattiValidi(estratti, workouts), [estratti, workouts])
  const cop = useMemo(() => copertura(workouts, estratti), [workouts, estratti])
  const finestra = useMemo(() => nellaFinestra(validi, giorni, oggi), [validi, giorni, oggi])
  const noteNelPeriodo = useMemo(() => nellaFinestra(
    workouts.filter(w => w.status === 'completed' && testoNota(w.notes)).map(w => ({ data: w.completed_date })),
    giorni, oggi).length, [workouts, giorni, oggi])

  return (
    <section aria-labelledby="dalle-note-titolo" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="dalle-note-titolo" className={LABEL}>Dalle note</h2>
        <SceltaFinestra giorni={giorni} onCambia={setGiorni} />
      </div>
      <RigaCopertura cop={cop} stato={stato} />

      {stato !== 'errore' && (noteNelPeriodo === 0 ? (
        <p className="px-1 text-[12.5px] text-muted">{nome} non ha scritto note in questo periodo</p>
      ) : (
        <>
          <CardRisultati estratti={finestra} giorni={giorni} />
          <CardSensazioni estratti={finestra} giorni={giorni} oggi={oggi} onApriWorkout={onApriWorkout} />
          <CardStato estratti={finestra} workouts={workouts} giorni={giorni} oggi={oggi} />
        </>
      ))}
    </section>
  )
}

/** Il toggle segmentato del design system, a tre voci. */
function SceltaFinestra({ giorni, onCambia }) {
  return (
    <div className="flex bg-[#111] p-1 rounded-2xl border border-[#333]">
      {FINESTRE.map(g => (
        <button key={g} type="button" aria-pressed={g === giorni} onClick={() => onCambia(g)}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors duration-300 ${
            g === giorni ? 'bg-[#2a2a2a] text-white' : 'text-muted'}`}>
          {g} giorni
        </button>
      ))}
    </div>
  )
}

function RigaCopertura({ cop, stato }) {
  if (stato === 'errore') {
    return <p className="px-1 text-[12px] text-orange-400">Non è stato possibile leggere i dati delle note. Riprova più tardi.</p>
  }
  if (!cop.totali) return null
  let testo = `${cop.analizzate} note analizzate su ${cop.totali}`
  if (cop.inAttesa) testo += ` · ${cop.inAttesa} in analisi`
  if (stato === 'sospesa') testo += ' · analisi sospesa: riprova più tardi'
  return <p className="px-1 text-[12px] text-muted">{testo}</p>
}

const Vuota = ({ children }) => <p className="text-[12.5px] text-muted">{children}</p>

// ── Risultati ─────────────────────────────────────────────────────────────
function CardRisultati({ estratti, giorni }) {
  const serie = serieRisultati(estratti)
  return (
    <div className={`${CARD} p-[18px] flex flex-col gap-4`}>
      <h3 className={LABEL}>Risultati</h3>
      {!serie.length && <Vuota>Nessun risultato nelle note degli ultimi {giorni} giorni</Vuota>}
      {serie.map(s => <Serie key={s.chiave} serie={s} />)}
    </div>
  )
}

function Serie({ serie }) {
  const { etichetta, punti, unita, scarto, migliorato } = serie
  const ultimo = punti[punti.length - 1]
  if (punti.length < 2) {
    return (
      <div>
        <p className="text-[13px] font-bold text-white">{etichetta}</p>
        <p className="text-[12px] text-muted">{formattaValore(ultimo.valore, unita)} · {giorno(ultimo.data)}, unico dato</p>
      </div>
    )
  }
  const valori = punti.map(p => p.valore)
  const min = Math.min(...valori), max = Math.max(...valori)
  const y = (v) => (max === min ? 17 : 32 - ((v - min) / (max - min)) * 30)
  const linea = punti.map((p, i) => `${(i / (punti.length - 1)) * 100},${y(p.valore)}`).join(' ')
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-bold text-white">{etichetta}</p>
        <p className="text-[13px] font-black text-white">{formattaValore(ultimo.valore, unita)}</p>
      </div>
      <svg viewBox="0 0 100 34" preserveAspectRatio="none" width="100%" height="34" role="img"
        aria-label={`${etichetta}: ${punti.map(p => `${formattaValore(p.valore, unita)} il ${giorno(p.data)}`).join(', ')}`}
        className="mt-1.5 block overflow-visible">
        <polyline points={linea} fill="none" stroke={BRAND} strokeWidth="2.5"
          vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {scarto !== 0 && (
        <p className={`mt-1 text-[11px] font-bold ${migliorato ? 'text-green-400' : 'text-orange-400'}`}>
          {scarto < 0 ? '−' : '+'}{formattaValore(Math.abs(scarto), unita)} dall'ultima
        </p>
      )}
    </div>
  )
}

// ── Sensazioni ────────────────────────────────────────────────────────────
function CardSensazioni({ estratti, giorni, oggi, onApriWorkout }) {
  const settimane = settimaneSensazioni(estratti, giorni, oggi)
  const modifiche = modificheFrequenti(estratti)
  const [aperta, setAperta] = useState(null)
  const massimo = Math.max(1, ...settimane.map(s => s.troppo_facile + s.giusta + s.troppo_dura))

  return (
    <div className={`${CARD} p-[18px] flex flex-col gap-3`}>
      <h3 className={LABEL}>Sensazioni</h3>
      {!settimane.length && !modifiche.length && (
        <Vuota>Nessuna sensazione sul workout nelle note degli ultimi {giorni} giorni</Vuota>
      )}

      {settimane.length > 0 && (
        <>
          <div className="flex items-end gap-[5px] h-[56px]" role="img"
            aria-label={settimane.map(s => `settimana del ${giorno(s.settimana)}: ${
              ['troppo_facile', 'giusta', 'troppo_dura'].filter(k => s[k]).map(k => `${NOME_DIFFICOLTA[k].toLowerCase()} ${s[k]}`).join(', ')}`).join('; ')}>
            {settimane.map(s => (
              <div key={s.settimana} className="flex-1 flex flex-col-reverse rounded-md overflow-hidden"
                style={{ height: `${((s.troppo_facile + s.giusta + s.troppo_dura) / massimo) * 56}px` }}>
                {['giusta', 'troppo_facile', 'troppo_dura'].map(k => s[k] > 0 && (
                  <div key={k} style={{ flexGrow: s[k], background: COLORE_DIFFICOLTA[k] }} />
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-3 text-[11px] font-bold text-muted">
            {['troppo_facile', 'giusta', 'troppo_dura'].map(k => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORE_DIFFICOLTA[k] }} />{NOME_DIFFICOLTA[k]}
              </span>
            ))}
          </div>
        </>
      )}

      {modifiche.length > 0 && (
        <div className="pt-2 border-t border-white/[.07]">
          <p className={`${LABEL} tracking-[.08em] mb-1.5`}>Modificati più spesso</p>
          {modifiche.map(m => {
            const chiave = `${m.esercizio}|${m.tipo}`
            return (
              <div key={chiave}>
                <button type="button" aria-expanded={aperta === chiave}
                  onClick={() => setAperta(aperta === chiave ? null : chiave)}
                  className="w-full text-left py-1.5 text-[13px] text-gray-300">
                  <span className="font-bold text-white">{m.esercizio}</span> · {m.tipo} · {volte(m.volte)}
                </button>
                {aperta === chiave && (
                  <ul className="pl-3 pb-1.5 flex flex-col gap-1">
                    {m.citazioni.map((c, i) => (
                      <li key={i}>
                        <button type="button" onClick={() => onApriWorkout?.(c.awId)}
                          className="text-left text-[12px] text-muted">
                          «{c.testo}» · {giorno(c.data)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Stato ─────────────────────────────────────────────────────────────────
function CardStato({ estratti, workouts, giorni, oggi }) {
  const righe = righeStato(estratti, workouts, giorni, oggi)
  // Una cella per giorno della finestra, da sinistra (il più lontano) a destra (oggi).
  const x = (data) => giorni - 1 - Math.round((oggi - parseISO(data)) / 86_400_000)
  return (
    <div className={`${CARD} p-[18px] flex flex-col gap-3`}>
      <h3 className={LABEL}>Stato</h3>
      {!righe.length && (
        <Vuota>Nessun accenno a stanchezza, motivazione, viaggio o lavoro nelle note degli ultimi {giorni} giorni</Vuota>
      )}
      {righe.map(r => (
        <div key={r.fattore}>
          <p className="text-[13px] font-bold text-white mb-1">{NOME_FATTORE[r.fattore]}</p>
          <svg viewBox={`0 0 ${giorni} 10`} preserveAspectRatio="none" width="100%" height="14" role="img"
            aria-label={`${NOME_FATTORE[r.fattore]}: ${r.giorni.map(g => `«${g.citazione}» il ${giorno(g.data)}`).join(', ')}`}>
            <rect x="0" y="3" width={giorni} height="4" rx="2" fill="rgba(255,255,255,.06)" />
            {r.durissime.map(d => <rect key={d} x={x(d)} y="0" width="1" height="2" fill={ROSSO} />)}
            {r.giorni.map((g, i) => <rect key={i} x={x(g.data)} y="3" width="1" height="7" fill={COLORE_SEGNO[g.segno]} />)}
          </svg>
          <p className="mt-1 text-[11.5px] text-muted truncate">
            «{r.giorni[r.giorni.length - 1].citazione}» · {giorno(r.giorni[r.giorni.length - 1].data)}
          </p>
        </div>
      ))}
      {righe.length > 0 && righe[0].durissime.length > 0 && (
        <p className="text-[11px] text-muted"><span className="text-red-400">▪</span> giorni con RPE 8 o più</p>
      )}
    </div>
  )
}
