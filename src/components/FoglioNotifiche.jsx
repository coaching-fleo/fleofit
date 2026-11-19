import { createPortal } from 'react-dom'
import { X, BellRing } from 'lucide-react'

// Il foglio che propone le notifiche a chi non le ha (19/11/2026). Chi lo apre e
// quando: src/components/InvitoNotifiche.jsx; la cadenza: src/lib/promemoriaNotifiche.js.
//
// La X (`aria-label="Chiudi"`) vale come «Non ora»: è ciò che usa il tasto
// indietro di Android (src/lib/indietroAndroid.js), e anche il velo fa lo stesso.

const TESTI = {
  athlete: {
    titolo: 'Non perderti un allenamento',
    testo: 'Ti avviso quando il coach ti carica un allenamento, e la sera prima se domani ne hai uno.',
  },
  coach: {
    titolo: 'Sappi quando si allenano',
    testo: 'Ti avviso quando un atleta completa un allenamento o ti lascia una nota.',
  },
}

export default function FoglioNotifiche({ ruolo, negate, mostraMai, onAttiva, onNonOra, onMai }) {
  const { titolo, testo } = TESTI[ruolo] || TESTI.athlete
  const bottoneGrande = 'w-full min-h-[56px] flex items-center justify-center gap-2.5 rounded-2xl font-bold text-[16px] transition active:scale-[.98]'

  return createPortal(
    <div className="fixed inset-0 z-[150] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 velo-in" onClick={onNonOra} />
      <div role="dialog" aria-modal="true" aria-labelledby="notifiche-titolo"
        className="relative bg-[#1e1e1e] border-t border-[#2a2a2a] rounded-t-3xl px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[85dvh] overflow-y-auto sheet-in">
        <div className="w-10 h-1 rounded-full bg-[#383838] mx-auto mb-4" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <h3 id="notifiche-titolo" className="text-xl font-black tracking-tight text-white flex items-center gap-2 min-w-0">
            <BellRing size={22} className="text-brand shrink-0" aria-hidden="true" /> {titolo}
          </h3>
          <button aria-label="Chiudi" onClick={onNonOra}
            className="shrink-0 w-11 h-11 -mr-1 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-300 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-300">{testo}</p>
        {negate && (
          <p className="mt-2 text-sm text-gray-500">Le notifiche sono spente nelle impostazioni del telefono.</p>
        )}
        <div className="mt-5 flex flex-col gap-3">
          <button onClick={onAttiva} className={`${bottoneGrande} bg-brand text-black hover:brightness-110`}>
            {negate ? 'Apri Impostazioni' : 'Attiva'}
          </button>
          <button onClick={onNonOra} className={`${bottoneGrande} bg-[#2a2a2a] text-white hover:bg-[#333]`}>Non ora</button>
          {mostraMai && (
            <button onClick={onMai} className="w-full min-h-[44px] text-sm font-semibold text-gray-500 hover:text-gray-300">
              Non chiedermelo più
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
