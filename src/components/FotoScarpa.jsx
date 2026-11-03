import { useState } from 'react'
import { fotoConSfondo } from '../lib/fotoScarpa'
import allenamento from '../assets/scarpe/allenamento.svg'
import gara from '../assets/scarpe/gara.svg'
import trail from '../assets/scarpe/trail.svg'
import ammortizzata from '../assets/scarpe/ammortizzata.svg'

// Il disegno di ripiego, uno per tipo (TIPI_SCARPA in lib/kmScarpe.js).
const DISEGNI = { allenamento, gara, trail, ammortizzata }

/**
 * La foto di un modello di scarpa; senza foto, o se non carica, il disegno del
 * suo tipo. Una foto non scontornata (url che finisce con `#sfondo`) sta in un
 * riquadro chiaro. `tono`: 'chiaro' = tratto grigio per i fondi scuri,
 * 'scuro' = tratto nero per il banner giallo (il filtro vale solo sul disegno).
 */
export default function FotoScarpa({ url, tipo, alt = '', className = '', tono = 'chiaro' }) {
  const [rotta, setRotta] = useState(false)
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
      onError={() => setRotta(true)}
    />
  )
  if (!fotoConSfondo(url)) return foto
  return (
    <div data-sfondo="si" className={`bg-white rounded-2xl p-2 ${className}`}>
      {foto}
    </div>
  )
}
