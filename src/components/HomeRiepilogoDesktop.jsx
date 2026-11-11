// HomeRiepilogoDesktop.jsx — la Home coach «Riepilogo» sul desktop (10/11/2026).
//
// Gli stessi pezzi del telefono in griglia (proposta B3): card gialla larga
// con le due card accanto, allarme, fila delle foto, giorni, poi tre colonne
// (Da guardare · Il team · Gare), in fondo Analisi e Report. Le liste si
// aprono in un pannello a destra. Testata come HomeCoachDesktop.
// Pigra: il telefono non la scarica mai. Le Scarpe NON stanno qui (11/11/2026):
// sul desktop sono una voce della barra laterale.

import { Plus, Bell, Radio, Megaphone } from 'lucide-react'
import { useRiepilogoCoach } from '../useRiepilogoCoach'
import { CARD } from '../lib/stiliCard'
import { useState } from 'react'
import FoglioListaCoach from './FoglioListaCoach'
import FoglioCalendario from './FoglioCalendario'
import { CartaOggi, AvvisoStannoMale, CoppiaAzioni, FilaOggi, CalendarioProssimi, ContatoriDaGuardare,
         TeamQuattro, GareRighe, Destinazioni, TitoloSezione } from './RiepilogoCoachUI'

export default function HomeRiepilogoDesktop(props) {
  const {
    saluto, nome, dataOggi, intestazione, live = [], caricamento, notificheDaLeggere = 0,
    feedback = [], fermi = [], scaduti = [],
    onNotifiche, onNuovoWorkout, onCalendario, onGuardaLive, onApriSeduta, onMessaggio, onReport, onAnalisi,
  } = props
  const r = useRiepilogoCoach(props)
  const [calendarioIntero, setCalendarioIntero] = useState(false)
  const apriGara = (g) => { if (g.workoutId) onApriSeduta({ workoutId: g.workoutId, atletaId: g.atleti[0]?.id }) }

  return (
    <div className="px-12 pt-10 pb-[var(--fondo-pagina)] min-h-screen flex justify-center cascata">
      <div className="w-full max-w-[1200px] flex flex-col gap-6">

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-400 first-letter:uppercase">{dataOggi}{intestazione ? ` · ${intestazione}` : ''}</p>
            <h1 className="mt-1.5 text-[40px] leading-tight font-black tracking-[-.035em] text-white">
              {saluto}{nome ? `, ${nome}` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={onNotifiche}
              aria-label={notificheDaLeggere > 0 ? `Notifiche, ${notificheDaLeggere} da leggere` : 'Notifiche'}
              className="relative w-11 h-11 rounded-full bg-gradient-to-b from-white/[.08] to-white/[.04] border border-white/[.08] shadow-[0_10px_20px_-12px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)] text-gray-300 flex items-center justify-center transition hover:text-white">
              <Bell size={18} aria-hidden="true" />
              {notificheDaLeggere > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-brand" />}
            </button>
            <button type="button" onClick={onMessaggio} aria-label="Apri la bacheca dei messaggi"
              className="inline-flex items-center gap-2 h-11 px-[18px] rounded-xl bg-gradient-to-b from-white/[.08] to-white/[.04] border border-white/[.08] shadow-[0_10px_20px_-12px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)] text-gray-200 text-sm font-bold transition hover:text-white hover:border-white/[.16]">
              <Megaphone size={18} aria-hidden="true" />Messaggi
            </button>
            <button type="button" onClick={onNuovoWorkout}
              className="inline-flex items-center gap-2 h-11 px-[18px] rounded-xl bg-gradient-to-b from-[#f8c83a] to-brand text-black text-sm font-extrabold shadow-[0_10px_22px_-10px_rgba(241,186,23,.6),inset_0_1px_0_rgba(255,255,255,.45)] transition hover:brightness-110">
              <Plus size={18} strokeWidth={2.5} aria-hidden="true" />Nuovo workout
            </button>
          </div>
        </header>

        {live.map(la => (
          <button key={la.athleteWorkoutId} type="button" onClick={() => onGuardaLive(la)}
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-left transition hover:border-red-500/60">
            <Radio size={18} className="text-red-500 animate-pulse" aria-hidden="true" />
            <span className="flex-1 text-sm text-white"><strong>{la.athleteName}</strong> si sta allenando adesso: {la.workoutTitle}</span>
            <span className="text-sm font-bold text-red-400">Guarda dal vivo</span>
          </button>
        ))}

        {caricamento ? (
          <div className={`h-[230px] ${CARD} animate-pulse`} />
        ) : (<>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2"><CartaOggi stati={r.stati} perCategoria={r.perCategoria} onApri={(filtro) => r.apri({ tipo: 'oggi', filtro })} /></div>
            <CoppiaAzioni feedback={feedback.length} scoperti={r.scoperti.length}
              onFeedback={() => r.apri({ tipo: 'feedback' })} onProgramma={() => r.apri({ tipo: 'scoperti' })} />
          </div>

          <AvvisoStannoMale righe={r.allarmi} onApri={() => r.apri({ tipo: 'allarmi' })}
            onApriUno={(x) => onApriSeduta({ workoutId: x.workoutId, atletaId: x.id })} />

          <section>
            <TitoloSezione azione={r.ordinate.length ? 'Tutti' : null} onAzione={() => r.apri({ tipo: 'oggi' })}>In allenamento oggi</TitoloSezione>
            <FilaOggi righe={r.ordinate} onApri={(x) => onApriSeduta({ workoutId: x.workoutId, atletaId: x.id })}
              onTutti={() => r.apri({ tipo: 'oggi' })} />
          </section>

          <section>
            <TitoloSezione azione="Calendario" onAzione={onCalendario}>Prossimi giorni</TitoloSezione>
            <CalendarioProssimi desktop piano={r.piano} nota={r.notaCalendario} onApri={onApriSeduta} onProgramma={props.onCrea}
              onTutti={() => setCalendarioIntero(true)} />
          </section>

          <div className="grid grid-cols-3 gap-5 items-start">
            <section>
              <TitoloSezione>Da guardare</TitoloSezione>
              <ContatoriDaGuardare feedback={feedback.length} fermi={fermi.length} scaduti={scaduti.length} segnali={r.segnali.length}
                onApri={(tipo) => r.apri({ tipo })} />
            </section>
            <section>
              <TitoloSezione>Il team</TitoloSezione>
              <TeamQuattro polso={r.polso} />
            </section>
            <section>
              <TitoloSezione>Gare in arrivo</TitoloSezione>
              {r.gare.length
                ? <GareRighe gare={r.gare} onApri={apriGara} />
                : <p className={`${CARD} px-4 py-5 text-sm text-gray-400`}>Nessuna gara nei prossimi 60 giorni.</p>}
            </section>
          </div>
        </>)}

        <Destinazioni analisi onReport={onReport} onAnalisi={onAnalisi} />

        {r.foglio && <FoglioListaCoach key={r.foglio.titolo} laterale {...r.foglio} onChiudi={r.chiudi} />}
        {calendarioIntero && <FoglioCalendario laterale piano={r.piano} onApri={onApriSeduta} onProgramma={props.onCrea}
          onChiudi={() => setCalendarioIntero(false)} />}
      </div>
    </div>
  )
}
