// HomeCoachDesktop.jsx — la Home del coach sulla versione desktop.
//
// È la bozza «1 · Home coach» approvata il 13/10/2026, nella versione
// semplificata: due domande e basta — cosa devo guardare, cosa succede oggi.
// La prima bozza aveva quattro numeri, filtri e la griglia del team, e il
// committente l'ha giudicata «molto caotica».
//
// Stesso patto di HomeCoachUI.jsx: SOLA PRESENTAZIONE. I dati arrivano già
// calcolati da Home.jsx (src/lib/statisticheCoach.js), le azioni sono le stesse
// callback del telefono. Si carica pigra: il telefono non la scarica mai.

import { useState } from 'react'
import { User, Plus, Bell, ChevronRight, Radio } from 'lucide-react'
import { corsia } from '../lib/categorie'
import { cosaGuardare } from '../lib/cosaGuardare'

const MOSTRATE = 8

function Volto({ foto, nome }) {
  const iniziali = (nome || '').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="w-11 h-11 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden flex items-center justify-center
                     text-gray-300 text-sm font-extrabold">
      {foto
        ? <img src={foto} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0 }} />
        : (iniziali || <User size={18} aria-hidden="true" />)}
    </span>
  )
}

/** La stessa scala dell'RPE del resto dell'app: ≤3 verde, ≤6 giallo, ≤8 arancione, oltre rosso. */
const coloreRpe = (v) =>
  v <= 3 ? 'bg-green-500/[.14] text-green-400'
    : v <= 6 ? 'bg-brand/[.14] text-brand'
      : v <= 8 ? 'bg-orange-400/[.14] text-orange-400'
        : 'bg-red-500/[.16] text-red-400'

const TESTO_STATO = {
  completato: { testo: 'Fatto', classe: 'text-green-400' },
  'in corso': { testo: 'In corso', classe: 'text-brand' },
  'da fare': { testo: 'Da fare', classe: 'text-gray-400' },
}

export default function HomeCoachDesktop({
  saluto, nome, dataOggi,
  feedback, fermi, scaduti, squadra, giorno = 'oggi', copertura, live = [],
  caricamento, notificheDaLeggere = 0,
  onNotifiche, onNuovoWorkout, onCalendario, onCambiaGiorno, onGuardaLive,
  onApriFeedback, onApriAtleta, onApriScaduto,
}) {
  const [tutte, setTutte] = useState(false)
  const voci = cosaGuardare({ feedback, fermi, scaduti })
  const visibili = tutte ? voci : voci.slice(0, MOSTRATE)
  const restanti = voci.length - visibili.length

  const apri = (v) => {
    if (v.tipo === 'feedback') onApriFeedback(v.dato)
    else if (v.tipo === 'fermo') onApriAtleta(v.dato)
    else onApriScaduto(v.dato)
  }

  return (
    <div className="px-12 pt-10 pb-[var(--fondo-pagina)] min-h-screen flex justify-center cascata">
      <div className="w-full max-w-[1080px] flex flex-col gap-8">

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-400 first-letter:uppercase">{dataOggi}</p>
            <h1 className="mt-1.5 text-4xl font-black tracking-[-.03em] text-white">
              {saluto}{nome ? `, ${nome}` : ''}
            </h1>
            {!caricamento && (
              <p className="mt-2.5 text-base text-gray-300">
                {voci.length > 0
                  ? <>Hai <strong className="text-brand">{voci.length} {voci.length === 1 ? 'cosa' : 'cose'}</strong> da guardare.</>
                  : 'Niente da guardare: sei in pari.'}
                {squadra.assegnati > 0 && (
                  <> Oggi il team ha fatto <strong className="text-white">{squadra.completati} allenamenti su {squadra.assegnati}</strong>.</>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={onNotifiche}
              aria-label={notificheDaLeggere > 0 ? `Notifiche, ${notificheDaLeggere} da leggere` : 'Notifiche'}
              className="relative w-11 h-11 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] text-gray-300
                         flex items-center justify-center transition hover:text-white">
              <Bell size={18} aria-hidden="true" />
              {notificheDaLeggere > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-brand" />}
            </button>
            <button type="button" onClick={onNuovoWorkout}
              className="inline-flex items-center gap-2 h-11 px-[18px] rounded-xl bg-brand text-black text-sm font-extrabold
                         transition hover:brightness-110">
              <Plus size={18} strokeWidth={2.5} aria-hidden="true" />Nuovo workout
            </button>
          </div>
        </header>

        {live.map(la => (
          <button key={la.athleteWorkoutId} type="button" onClick={() => onGuardaLive(la)}
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-left
                       transition hover:border-red-500/60">
            <Radio size={18} className="text-red-500 animate-pulse" aria-hidden="true" />
            <span className="flex-1 text-sm text-white"><strong>{la.athleteName}</strong> si sta allenando: {la.workoutTitle}</span>
            <span className="text-sm font-bold text-red-400">Guarda</span>
          </button>
        ))}

        <div className="flex flex-wrap gap-6 items-start">

          <section aria-labelledby="t-guarda" className="flex-[3_1_520px] min-w-0 flex flex-col gap-3">
            <h2 id="t-guarda" className="text-lg font-extrabold text-white">Da guardare</h2>
            {caricamento ? (
              [0, 1, 2].map(i => <div key={i} className="h-[78px] rounded-[20px] bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />)
            ) : voci.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[#333] px-6 py-10 text-center text-sm text-gray-400">
                Hai letto tutti i feedback e nessun atleta è fermo.
              </div>
            ) : (
              <>
                {visibili.map(v => (
                  <div key={v.chiave}
                    className="flex items-center gap-4 px-[18px] py-4 rounded-[20px] bg-[#1e1e1e] border border-[#2a2a2a]">
                    <Volto foto={v.foto} nome={v.nome} />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="text-[15px] font-extrabold text-white truncate">{v.nome}</span>
                      <span className={`text-sm truncate ${v.avviso ? 'text-orange-400' : 'text-gray-400'}`}>{v.riga}</span>
                    </div>
                    {v.rpe != null && (
                      <span className={`shrink-0 h-[30px] px-3 rounded-full inline-flex items-center text-[13px] font-extrabold ${coloreRpe(v.rpe)}`}>
                        RPE {v.rpe}
                      </span>
                    )}
                    <button type="button" onClick={() => apri(v)}
                      aria-label={`${v.azione}: ${v.nome}`}
                      className="shrink-0 h-10 px-4 rounded-xl bg-[#2a2a2a] border border-[#383838] text-white text-sm font-bold
                                 transition hover:border-brand/50">
                      {v.azione}
                    </button>
                  </div>
                ))}
                {restanti > 0 && (
                  <button type="button" onClick={() => setTutte(true)}
                    className="self-center inline-flex items-center gap-1 pt-1 text-sm font-bold text-gray-400 transition hover:text-white">
                    Altre {restanti}<ChevronRight size={15} aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          </section>

          <section aria-labelledby="t-oggi" className="flex-[2_1_320px] min-w-0 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 id="t-oggi" className="text-lg font-extrabold text-white first-letter:uppercase">{giorno}</h2>
              <div className="flex items-center gap-4 text-sm font-bold">
                <button type="button" onClick={onCambiaGiorno} className="text-gray-400 transition hover:text-white">
                  {giorno === 'oggi' ? 'Ieri' : 'Oggi'}
                </button>
                <button type="button" onClick={onCalendario} className="text-brand transition hover:brightness-110">Calendario</button>
              </div>
            </div>
            <div className="rounded-[20px] bg-[#1e1e1e] border border-[#2a2a2a] px-[18px] py-1.5">
              {caricamento ? (
                <div className="h-40 animate-pulse" />
              ) : squadra.righe.length === 0 ? (
                <p className="py-6 text-sm text-gray-400">Nessun allenamento assegnato {giorno}.</p>
              ) : squadra.righe.map((r, i) => {
                const stato = TESTO_STATO[r.stato] || TESTO_STATO['da fare']
                return (
                  <button key={r.id} type="button" onClick={() => onApriAtleta(r)}
                    className={`w-full flex items-center gap-3 py-3 text-left group ${i > 0 ? 'border-t border-[#2a2a2a]' : ''}`}>
                    <span aria-hidden="true" className={`shrink-0 w-2.5 h-2.5 rounded-full ${corsia(r.categoria).dot}`} />
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-white group-hover:text-brand transition">{r.nome}</span>
                      <span className="text-[13px] text-gray-400 truncate">{r.titolo}</span>
                    </span>
                    <span className={`shrink-0 text-[13px] font-bold ${stato.classe}`}>
                      {stato.testo}{r.rpe != null ? ` · RPE ${r.rpe}` : ''}
                    </span>
                  </button>
                )
              })}
            </div>

            {!caricamento && copertura.totale > 0 && (
              <button type="button" onClick={onCalendario}
                className="flex items-center gap-4 px-[18px] py-4 rounded-[20px] bg-[#1e1e1e] border border-[#2a2a2a] text-left
                           transition hover:border-brand/40">
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold text-white">Prossimi 3 giorni</span>
                  <span className={`text-[13px] ${copertura.senza > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                    {copertura.senza > 0
                      ? `${copertura.senza} ${copertura.senza === 1 ? 'atleta' : 'atleti'} senza allenamento`
                      : 'Tutti programmati'}
                  </span>
                </span>
                <span className="text-2xl font-black tracking-[-.02em] text-white">
                  {copertura.coperti}<span className="text-base text-gray-400">/{copertura.totale}</span>
                </span>
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
