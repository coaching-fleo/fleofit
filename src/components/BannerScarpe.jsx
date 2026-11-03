// Il banner «Scarpe» della Home: una card gialla (brand) con il titolo a
// capo, la pillola nera e la foto della scarpa che esce dal bordo alto.
// Legge i dati da sé; se qualcosa non va (tabelle assenti, errore) o mentre
// carica non rende niente, e non lancia mai.

import { useEffect, useState } from 'react'
import { leggiScarpeAtleta, elencoCatalogo, tabelleAssenti } from '../lib/scarpeDb'
import { contenutoBanner } from '../lib/bannerScarpe'
import { vibraScelta } from '../lib/aptica'
import FotoScarpa from './FotoScarpa'

export default function BannerScarpe({ ruolo, uid, onApri }) {
  // Il risultato porta la chiave per cui è stato letto: cambiando ruolo o uid
  // quello vecchio non vale più, senza un setState sincrono nell'effetto.
  const chiave = `${ruolo}:${uid || ''}`
  const [letto, setLetto] = useState({ chiave: null, contenuto: null })
  const setContenuto = (contenuto) => setLetto({ chiave, contenuto })
  const contenuto = letto.chiave === chiave ? letto.contenuto : null

  useEffect(() => {
    if (ruolo !== 'coach' && !uid) return undefined
    let vivo = true
    ;(async () => {
      try {
        if (ruolo === 'coach') {
          const catalogo = await elencoCatalogo()
          if (vivo) setContenuto(contenutoBanner({ ruolo, catalogo }))
          return
        }
        const [scarpe, catalogo] = await Promise.all([
          leggiScarpeAtleta(uid),
          elencoCatalogo().catch((e) => { if (!tabelleAssenti(e)) console.warn('banner scarpe: catalogo', e); return null }),
        ])
        if (vivo) setContenuto(scarpe?.disponibile ? contenutoBanner({ ruolo, scarpe: scarpe.scarpe, catalogo }) : null)
      } catch (e) {
        if (!tabelleAssenti(e)) console.warn('banner scarpe', e)
        if (vivo) setContenuto(null)
      }
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruolo, uid])

  if (!contenuto) return null
  return (
    <button type="button" aria-label={contenuto.titolo}
      onClick={() => { vibraScelta(); onApri?.() }}
      className="relative overflow-visible mt-8 w-full text-left rounded-3xl bg-brand text-black p-5 min-h-[150px]
                 flex flex-col items-start justify-between gap-4 active:scale-[.98] transition-transform duration-150">
      <span className="block text-2xl leading-[1.05] font-black tracking-tight max-w-[52%]">{contenuto.titolo}</span>
      <span className="rounded-full bg-black text-white text-sm font-bold px-4 py-2">{contenuto.bottone}</span>
      <FotoScarpa url={contenuto.foto} tipo={contenuto.tipo} tono="scuro" alt=""
        className="absolute right-2 -top-6 w-[46%] -rotate-12 drop-shadow pointer-events-none" />
    </button>
  )
}
