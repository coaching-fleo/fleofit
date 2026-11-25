// HomeRiepilogoTelefono.jsx — la Home coach «Riepilogo» sul telefono (10/11/2026).
//
// Numeri che aprono liste: la pagina ha la stessa lunghezza con 11 o con 500
// atleti (docs/superpowers/specs/2026-11-10-home-coach-riepilogo-design.md).
// Pigra come HomeCoachTelefono, per la stessa ragione: i conti del cruscotto
// pesano e l'atleta non li scarica. Testata, ricerca e Live restano in Home.jsx.
// La Home di prima resta dietro «Home classica» (src/lib/homeClassica.js).
// Niente banner Scarpe (11/11/2026): il coach le apre da Impostazioni, sul
// desktop dalla barra laterale.

import { useRiepilogoCoach } from '../useRiepilogoCoach'
import { lazy, Suspense, useState } from 'react'
import FoglioListaCoach from './FoglioListaCoach'
import FoglioCalendario from './FoglioCalendario'
import FoglioSedutaOggi from './FoglioSedutaOggi'
import { RIGHE_CALENDARIO_TELEFONO } from '../lib/riepilogoCoach'

const DagliExtra = lazy(() => import('./DagliExtra'))
import { CartaOggi, AvvisoStannoMale, CoppiaAzioni, FilaOggi, CalendarioProssimi, ContatoriDaGuardare,
         TeamQuattro, GareRighe, Destinazioni, TitoloSezione } from './RiepilogoCoachUI'

export default function HomeRiepilogoTelefono(props) {
  const { caricamento, feedback = [], fermi = [], scaduti = [], onApriSeduta, onReport, onCalendario } = props
  const r = useRiepilogoCoach(props)
  const [calendarioIntero, setCalendarioIntero] = useState(() => !!r.foglioCalendarioRipreso)
  const apriGara = (g) => { if (g.workoutId) onApriSeduta({ workoutId: g.workoutId, atletaId: g.atleti[0]?.id }) }

  if (caricamento) return (<>
    <div className="rounded-[28px] bg-brand/20 h-[230px] animate-pulse" />
    <div className="grid grid-cols-2 gap-2.5">
      <div className="rounded-3xl bg-[#1e1e1e] h-[150px] animate-pulse" /><div className="rounded-3xl bg-[#1e1e1e] h-[150px] animate-pulse" />
    </div>
  </>)

  return (<>
    <div className="flex flex-col gap-2.5">
      <CartaOggi compatto stati={r.stati} perCategoria={r.perCategoria} onApri={(filtro) => r.apri({ tipo: 'oggi', filtro })} />
      <AvvisoStannoMale righe={r.allarmi} onApri={() => r.apri({ tipo: 'allarmi' })}
        onApriUno={(x) => onApriSeduta({ workoutId: x.workoutId, atletaId: x.id })} />
      <div className="grid grid-cols-2 gap-2.5">
        <CoppiaAzioni feedback={feedback.length} scoperti={r.scoperti.length}
          onFeedback={() => r.apri({ tipo: 'feedback' })} onProgramma={() => r.apri({ tipo: 'scoperti' })} />
      </div>
    </div>

    <section>
      <TitoloSezione azione={r.ordinate.length ? 'Tutti' : null} onAzione={() => r.apri({ tipo: 'oggi' })}>In allenamento oggi</TitoloSezione>
      <FilaOggi compatto righe={r.ordinate} onApri={r.apriSeduta} posizione={r.filaRipresa}
        onTutti={() => r.apri({ tipo: 'oggi' })} />
    </section>

    <section>
      <TitoloSezione azione={onCalendario ? 'Calendario' : null} onAzione={onCalendario}>Prossimi giorni</TitoloSezione>
      <CalendarioProssimi piano={r.piano} nota={r.notaCalendario} onApri={onApriSeduta} onProgramma={props.onCrea}
        righeVisibili={RIGHE_CALENDARIO_TELEFONO} onAtleta={props.onApriAtleta}
        posizione={r.posizioneCalendario} onPosizione={r.ricordaCalendario}
        onTutti={() => setCalendarioIntero(true)} />
    </section>

    <section>
      <TitoloSezione>Da guardare</TitoloSezione>
      <ContatoriDaGuardare feedback={feedback.length} fermi={fermi.length} scaduti={scaduti.length} segnali={r.segnali.length}
        onApri={(tipo) => r.apri({ tipo })} />
    </section>

    <section>
      <TitoloSezione>Il team</TitoloSezione>
      <TeamQuattro polso={r.polso} />
    </section>

    {r.gare.length > 0 && (
      <section>
        <TitoloSezione>Gare in arrivo</TitoloSezione>
        <GareRighe gare={r.gare} onApri={apriGara} />
      </section>
    )}

    <Destinazioni onReport={onReport} />

    {/* In fondo: arriva dopo una lettura, sopra sposterebbe ciò che si sta leggendo. */}
    <Suspense fallback={null}><DagliExtra /></Suspense>

    {r.foglio && <FoglioListaCoach key={r.foglio.titolo} {...r.foglio} onChiudi={r.chiudi} />}
    {r.sedutaAperta && <FoglioSedutaOggi seduta={r.sedutaAperta} ripreso={r.corpoSedutaRipreso}
        onAtleta={r.vaiAtletaDaSeduta} onAllenamento={r.vaiAllenamentoDaSeduta} onChiudi={r.chiudiSeduta} />}
      {calendarioIntero && <FoglioCalendario piano={r.piano} ripreso={r.foglioCalendarioRipreso}
      onAtleta={props.onApriAtleta} onUscita={r.ricordaFoglioCalendario}
      onApri={onApriSeduta} onProgramma={props.onCrea}
      onChiudi={() => setCalendarioIntero(false)} />}
  </>)
}
