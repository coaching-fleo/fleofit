import { useState } from 'react'
import { fotoConSfondo } from '../lib/fotoScarpa'
import allenamento from '../assets/scarpe/allenamento.svg'
import gara from '../assets/scarpe/gara.svg'
import trail from '../assets/scarpe/trail.svg'
import ammortizzata from '../assets/scarpe/ammortizzata.svg'

// Il disegno di ripiego, uno per tipo (TIPI_SCARPA in lib/kmScarpe.js).
// Il tratto degli SVG è fisso #9ca3af: currentColor non passa attraverso <img>;
// per il banner giallo ci pensa `tono`.
const DISEGNI = { allenamento, gara, trail, ammortizzata }

/**
 * La foto di un modello di scarpa; senza foto, o se non carica, il disegno del
 * suo tipo. Una foto non scontornata (url che finisce con `#sfondo`) sta in un
 * riquadro chiaro. `tono`: 'chiaro' = tratto grigio per i fondi scuri,
 * 'scuro' = tratto nero per il banner giallo (il filtro vale solo sul disegno).
 */
export default function FotoScarpa({ url, tipo, alt = '', className = '', tono = 'chiaro' }) {
  const [urlRotto, setUrlRotto] = useState(null)
  const rotta = urlRotto === url // un url nuovo (foto ricaricata) si riprova
  const chiave = DISEGNI[tipo] ? tipo : 'allenamento'
  const disegno = DISEGNI[chiave]

  if (!url || rotta) {
    return (
      <img
        src={disegno}
        alt={alt}
        data-disegno={chiave}
        className={className}
        style={tono === 'scuro' ? { filter: 'brightness(0)' } : undefined}
        loading="lazy"
        decoding="async"
      />
    )
  }

  const foto = (
    <img
      src={url}
      alt={alt}
      className={fotoConSfondo(url) ? 'w-full h-full object-contain' : className}
      loading="lazy"
      decoding="async"
      onError={() => setUrlRotto(url)}
    />
  )
  if (!fotoConSfondo(url)) return foto
  return (
    <span data-sfondo="si" className={`block bg-white rounded-2xl p-2 ${className}`}>
      {foto}
    </span>
  )
}
