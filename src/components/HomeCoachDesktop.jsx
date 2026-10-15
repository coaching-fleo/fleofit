// HomeCoachDesktop.jsx — la Home del coach sulla versione desktop.
//
// Il disegno approvato il 14/10/2026 (tela «Home coach FLEOFIT», tavola
// Desktop): in alto il polso del team, poi a sinistra le due cose da DECIDERE
// — chi si allena oggi e in che stato arriva, cosa rivedere nel programma — e
// a destra le cose da SMALTIRE e le gare; in fondo la settimana atleti × giorni.
// Sostituisce la versione del 13/10 («Da guardare» + «Oggi» + «Ultime sedute
// chiuse»), che guardava solo indietro: il committente non la voleva né per i
// contenuti né per l'aspetto.
//
// Stesso patto di prima: SOLA PRESENTAZIONE. I numeri arrivano già calcolati
// da Home.jsx (src/lib/cruscottoCoach.js, src/lib/statisticheCoach.js), i pezzi
// sono quelli del telefono (CruscottoCoachUI.jsx). Si carica pigra: il telefono
// non la scarica mai.

import { Plus, Bell, Radio, Megaphone } from 'lucide-react'
import { cosaGuardare } from '../lib/cosaGuardare'
import { useCruscottoCoach } from '../useCruscottoCoach'
import { PolsoTeam, CardOggi, CardSegnali, CardSmaltire, CardPiano, CardGare } from './CruscottoCoachUI'

/** La frase sotto il saluto: la cosa più urgente, non il conto delle cose. */
function fraseDelGiorno({ oggi, segnali, voci }) {
  const allarmi = oggi.filter(r => r.allarme)
  // Semplice, e senza giudicare la persona: un allenamento intenso e
  // l'invito a guardare come sta (il perché è nel riquadro rosso sotto).
  const urgente = allarmi.length === 1 ? `${allarmi[0].nome} ha un allenamento intenso oggi: guarda come sta.`
    : allarmi.length > 1 ? `${allarmi.length} atleti hanno un allenamento intenso oggi: guarda come stanno.` : null
  const resto = segnali.length > 0
    ? `${urgente ? 'Più' : 'Hai'} ${segnali.length} ${segnali.length === 1 ? 'segnale' : 'segnali'} sul programma da guardare.`
    : voci.length > 0 ? `${voci.length} ${voci.length === 1 ? 'cosa' : 'cose'} da smaltire.`
      : urgente ? null : 'Niente da decidere stamattina: sei in pari.'
  return { urgente, resto }
}

export default function HomeCoachDesktop({
  saluto, nome, dataOggi, intestazione,
  atleti, assegnazioni, comeStai, estratti, righeGare, copertura,
  feedback, fermi, scaduti, squadra,
  live = [], caricamento, notificheDaLeggere = 0,
  onNotifiche, onNuovoWorkout, onCalendario, onGuardaLive,
  onApriFeedback, onApriAtleta, onApriScaduto, onApriSeduta, onMessaggio,
}) {
  const { gare, polso, oggi, segnali, piano, notaPiano } = useCruscottoCoach({
    atleti, assegnazioni, comeStai, estratti, righeGare, squadra, copertura, settimana: true,
  })
  const voci = cosaGuardare({ feedback, fermi, scaduti })
  const frase = fraseDelGiorno({ oggi, segnali, voci })

  // «Alleggerisci» apre l'allenamento di QUELL'atleta, dove il coach lo
  // modifica: niente si cambia da solo, il workout può essere di più atleti.
  const apriAllenamento = (r) => onApriSeduta({ workoutId: r.workoutId, atletaId: r.id })
  const apriGara = (g) => { if (g.workoutId) onApriSeduta({ workoutId: g.workoutId, atletaId: g.atleti[0]?.id }) }
  const apri = (v) => {
    if (v.tipo === 'feedback') onApriFeedback(v.dato)
    else if (v.tipo === 'fermo') onApriAtleta(v.dato)
    else onApriScaduto(v.dato)
  }

  return (
    <div className="px-12 pt-10 pb-[var(--fondo-pagina)] min-h-screen flex justify-center cascata">
      <div className="w-full max-w-[1120px] flex flex-col gap-6">

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-400 first-letter:uppercase">{dataOggi}{intestazione ? ` · ${intestazione}` : ''}</p>
            <h1 className="mt-1.5 text-[40px] leading-tight font-black tracking-[-.035em] text-white">
              {saluto}{nome ? `, ${nome}` : ''}
            </h1>
            {!caricamento && (
              <p className="mt-2 text-base text-gray-300">
                {frase.urgente && <strong className="text-red-400 font-bold">{frase.urgente}</strong>}
                {frase.urgente && frase.resto && ' '}
                {frase.resto}
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
            <button type="button" onClick={onMessaggio}
              aria-label="Apri la bacheca dei messaggi"
              className="inline-flex items-center gap-2 h-11 px-[18px] rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] text-gray-200 text-sm font-bold
                         transition hover:text-white hover:border-brand/40">
              <Megaphone size={18} aria-hidden="true" />Messaggi
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
            <span className="flex-1 text-sm text-white"><strong>{la.athleteName}</strong> si sta allenando adesso: {la.workoutTitle}</span>
            <span className="text-sm font-bold text-red-400">Guarda dal vivo</span>
          </button>
        ))}

        {caricamento
          ? <div className="h-[120px] rounded-[20px] bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />
          : <PolsoTeam {...polso} />}

        <div className="flex flex-wrap gap-5 items-start">
          <div className="flex-[3_1_560px] min-w-0 flex flex-col gap-5">
            <CardOggi righe={oggi} completati={squadra.completati} assegnati={squadra.assegnati} inCorso={squadra.inCorso}
              caricamento={caricamento} onApriAtleta={onApriAtleta} onAlleggerisci={apriAllenamento} />
            <CardSegnali segnali={segnali} caricamento={caricamento} onApri={(x) => onApriAtleta({ id: x.atletaId })} />
          </div>
          <div className="flex-[2_1_320px] min-w-0 flex flex-col gap-5">
            <CardSmaltire voci={voci} caricamento={caricamento} onApri={apri} />
            <CardGare gare={gare} onApri={apriGara} />
          </div>
        </div>

        <CardPiano piano={piano} titolo="La settimana" nota={notaPiano} caricamento={caricamento}
          onApri={onApriSeduta} onCalendario={onCalendario} />

      </div>
    </div>
  )
}
