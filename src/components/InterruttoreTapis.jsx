import { vibraScelta } from '../lib/aptica'

// «Outdoor | Tapis roulant» nella scheda di una Corsa (src/lib/tapisRoulant.js).
// Il toggle segmentato del design system (CLAUDE.md §6), con l'azzurro della
// Corsa sulla voce scelta. Parte sempre da Outdoor: la scelta non si ricorda.
export default function InterruttoreTapis({ tapis, onCambia }) {
  const scegli = (valore) => {
    if (valore === tapis) return
    vibraScelta()
    onCambia(valore)
  }
  return (
    <div className="relative flex bg-[#111] p-1.5 rounded-2xl border border-[#333]" role="group" aria-label="Dove corri">
      <div
        className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc((100%-0.75rem)/2)] bg-[#2a2a2a] rounded-xl shadow-md transition-transform duration-300 ease-out ${
          tapis ? 'translate-x-full' : 'translate-x-0'
        }`}
      />
      {[[false, 'Outdoor'], [true, 'Tapis roulant']].map(([valore, testo]) => (
        <button key={testo} type="button" aria-pressed={tapis === valore} onClick={() => scegli(valore)}
          className={`relative z-10 flex-1 py-2 rounded-xl text-[13px] font-bold transition-colors duration-300 ${
            tapis === valore ? 'text-running' : 'text-muted hover:text-gray-300'
          }`}>
          {testo}
        </button>
      ))}
    </div>
  )
}
