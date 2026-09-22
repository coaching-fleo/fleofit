/**
 * I tre puntini dentro una CTA contratta.
 *
 * 🔴 STA IN UN FILE SUO, E NON IN `CreaWorkoutUI.jsx`, PER UNA RAGIONE DI PESO.
 * Lo usa anche `RpeModal`, che è montata da Home, WorkoutDetail e
 * AthleteDetail: importarlo da `CreaWorkoutUI` farebbe scaricare quel chunk da
 * 24 KB dentro la Home, che di builder non ha niente. È lo stesso danno del
 * fascio luminoso importato in un pezzo condiviso (CLAUDE.md §9-duetricies) e
 * di `jspdf` in testa alla scheda (§9-noviesdecies): il peso lo paga chi usa
 * l'effetto, non chi passa di lì.
 *
 * ⚠️ `aria-hidden`: chi legge con VoiceOver ha già `aria-busy` sul bottone e la
 * sua etichetta, che resta nel DOM anche quando è trasparente. Tre pallini
 * annunciati uno per uno sarebbero solo rumore.
 *
 * L'animazione è `.puntini` in `src/index.css`, dove è anche registrata fra
 * quelle che si spengono per chi ha chiesto meno movimento — spegnendosi,
 * restano visibili: sono l'unica cosa che dice «sto lavorando» dentro una
 * pillola senza più etichetta.
 */
export function Puntini({ colore = 'bg-black/70' }) {
  return (
    <span aria-hidden="true" className="puntini flex items-center gap-[5px]">
      <span className={`w-[7px] h-[7px] rounded-full ${colore}`} />
      <span className={`w-[7px] h-[7px] rounded-full ${colore}`} />
      <span className={`w-[7px] h-[7px] rounded-full ${colore}`} />
    </span>
  )
}
