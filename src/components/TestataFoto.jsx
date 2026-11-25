// TestataFoto.jsx — la testata con la foto della persona (25/11/2026).
//
// Lo stile nato col foglio veloce di «In allenamento oggi» e piaciuto al
// committente («mi piace moltissimo»): la foto grande in testa, che sfuma nel
// fondo di ciò che sta sotto, con il nome grande sopra. Lo usano il foglio
// veloce (FoglioSedutaOggi) e la scheda atleta (AthleteDetail). DESIGN.md,
// «La Testata con Foto».
//
// 🔴 IL RITAGLIO. La prima versione metteva sempre la foto in `object-cover` su
// tutta la larghezza: una foto verticale in un riquadro largo diventa una
// fascia, e sul desktop (440px e oltre) restavano naso e bocca. Ma sul telefono
// la foto piena era proprio ciò che piaceva. Quindi la testata SCEGLIE, dalla
// proporzione vera della foto e del riquadro (`modoFoto`):
//  - «piena»: si vede almeno il 45% dell'altezza della foto → tutta larghezza,
//    ritagliata dal 22% dall'alto (dove di solito c'è il viso). Il telefono.
//  - «ancorata»: taglierebbe di più → la foto INTERA alla sua proporzione, a
//    destra e alta quanto la testata, che sfuma a sinistra verso il nome;
//    dietro, la stessa foto molto sfocata e scura tinge il resto. Su una
//    testata larghissima la foto si allarga finché se ne vede il 60%
//    (`larghezzaAncorata`): intera sarebbe un francobollo. Il desktop.
//
// SENZA FOTO (o con la foto rotta): il monogramma. Le iniziali enormi in
// filigrana, a destra dove starebbe la foto, su un velo del colore dato (la
// corsia della categoria, o il giallo del marchio). Chi può aggiungere la foto
// lo dice con lo slot `senzaFoto` (la scheda atleta ci mette «Aggiungi foto»).
//
// ⚠️ Niente bottoni dentro bottoni: con `onClick` la testata intera è un
// bottone SOTTO il testo (che non prende i tocchi); gli slot `sopraSinistra`,
// `sopraDestra`, `azione` e `senzaFoto` tornano a prendere i tocchi, quindi lì
// dentro possono stare bottoni veri — ma allora non serve `onClick`.

import { useLayoutEffect, useRef, useState } from 'react'
import { BRAND, conVelo } from '../lib/colori'
import { modoFoto, larghezzaAncorata } from '../lib/testataFoto'

const iniziali = (nome = '') => nome.trim().split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase()

export default function TestataFoto({
  foto, nome, colore = BRAND, fondo = '#18181b', classe = 'h-[248px]',
  onClick, etichettaClick, onErroreFoto,
  sopraSinistra, sopraDestra, etichetta, titolo, sotto, azione, senzaFoto,
  margineAlto = '0px',
}) {
  const [rotta, setRotta] = useState(false)
  const [caricata, setCaricata] = useState(false)
  const [naturale, setNaturale] = useState(null) // { w, h } della foto
  const [riquadro, setRiquadro] = useState(null) // { w, h } della testata
  const scatola = useRef(null)
  const conFoto = !!foto && !rotta
  const sbaglia = () => { setRotta(true); onErroreFoto?.() }
  const carica = (e) => { setNaturale({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); setCaricata(true) }
  // La testata cambia larghezza (finestra ridimensionata, foglio → finestra): si rimisura.
  useLayoutEffect(() => {
    const el = scatola.current
    if (!el) return undefined
    const misura = () => setRiquadro({ w: el.clientWidth, h: el.clientHeight })
    misura()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(misura)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const ancorata = modoFoto(naturale?.w, naturale?.h, riquadro?.w, riquadro?.h) === 'ancorata'
  const largaPx = ancorata ? larghezzaAncorata(naturale?.w, naturale?.h, riquadro?.w, riquadro?.h) : null

  return (
    <div ref={scatola} data-modo-foto={conFoto ? (ancorata ? 'ancorata' : 'piena') : 'monogramma'}
      className={`group relative w-full shrink-0 overflow-hidden isolate ${classe}`} style={{ background: fondo }}>
      {conFoto ? (<>
        {ancorata && (<>
          {/* Il riempimento: la stessa foto, sfocata. Dà il suo colore al resto della testata. */}
          <img src={foto} alt="" aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover scale-150 blur-3xl opacity-45 saturate-[1.3]" />
          <span className="absolute inset-0 bg-black/45" aria-hidden="true" />
        </>)}
        {/* La foto vera: piena, o intera a destra che sfuma verso il nome. */}
        <img src={foto} alt="" onError={sbaglia} onLoad={carica} style={largaPx ? { width: largaPx } : undefined}
          className={`absolute top-0 h-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.02]
                      ${ancorata
                        ? 'right-0 object-[50%_22%] origin-right [mask-image:linear-gradient(to_left,#000_58%,transparent)] [-webkit-mask-image:linear-gradient(to_left,#000_58%,transparent)]'
                        : 'inset-x-0 w-full object-[50%_22%]'}
                      ${caricata ? 'opacity-100' : 'opacity-0'}`} />
      </>) : (<>
        <span className="absolute inset-0" aria-hidden="true"
          style={{ background: `radial-gradient(110% 95% at 88% 8%, ${conVelo(colore, 0.3)}, transparent 62%)` }} />
        {/* Le iniziali alte quasi quanto la testata, in alto a destra: dove starebbe il viso. */}
        <span className="absolute right-[.06em] top-[-.1em] leading-none font-black tracking-[-.07em] select-none"
          style={{ color: conVelo(colore, 0.2), fontSize: Math.round((riquadro?.h || 250) * 0.78) }} aria-hidden="true">
          {iniziali(nome) || '·'}
        </span>
      </>)}

      {/* In alto il buio per i bottoni, in basso la sfumatura nel fondo: il nome si legge, e non c'è un bordo. */}
      <span className="absolute inset-0 pointer-events-none" aria-hidden="true"
        style={{ background: `linear-gradient(to bottom, rgba(0,0,0,.45), transparent 32%, transparent 48%, ${fondo} 100%)` }} />
      {(ancorata || !conFoto) && (
        <span className="absolute inset-y-0 left-0 w-2/3 pointer-events-none" aria-hidden="true"
          style={{ background: `linear-gradient(to right, ${conVelo(fondo, 0.55)}, transparent)` }} />
      )}

      {onClick && (
        <button type="button" onClick={onClick} aria-label={etichettaClick}
          className="absolute inset-0 z-[1] w-full h-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white rounded-[inherit]" />
      )}

      {sopraSinistra && <div className="absolute left-4 z-[2]" style={{ top: `calc(${margineAlto} + 16px)` }}>{sopraSinistra}</div>}
      {sopraDestra && <div className="absolute right-3 z-[2]" style={{ top: `calc(${margineAlto} + 12px)` }}>{sopraDestra}</div>}

      <div className="absolute left-5 right-5 bottom-4 z-[2] flex items-end justify-between gap-3 pointer-events-none">
        <div className="min-w-0">
          {etichetta}
          {titolo}
          {sotto && <div className="pointer-events-auto">{sotto}</div>}
          {!conFoto && senzaFoto && <div className="mt-3 pointer-events-auto">{senzaFoto}</div>}
        </div>
        {azione && <div className={`shrink-0 ${onClick ? '' : 'pointer-events-auto'}`}>{azione}</div>}
      </div>
    </div>
  )
}
