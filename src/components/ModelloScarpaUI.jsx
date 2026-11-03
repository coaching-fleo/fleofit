import { ChevronLeft, ExternalLink, Pencil, Footprints } from 'lucide-react'
import { LABEL, BOTTONE_BRAND, BOTTONE_QUIETO, VETRO } from '../lib/stiliCard'
import { TIPI_SCARPA } from '../lib/kmScarpe'
import { LIVELLI, righeCaratteristiche } from '../lib/caratteristicheScarpa'
import FotoScarpa from './FotoScarpa'
import { BottoneFoto } from './FoglioModelloCatalogo'

// La scheda di un modello del catalogo: presentazione pura. Uguale per tutti;
// cambiano i tasti (atleta: «Ce l'ho», coach: «Modifica» e «Carica foto»).

/** La testata sticky: cornice, sta ferma fuori dalla cascata. */
export function TestataModello({ onIndietro }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 pb-3 pt-1 bg-[#0B0B0B]/95 backdrop-blur max-w-2xl md:mx-auto">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Torna indietro" onClick={onIndietro}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-gray-200 hover:text-white transition shrink-0 ${VETRO}`}>
          <ChevronLeft size={19} />
        </button>
        <h1 className="flex-1 min-w-0 text-3xl font-black tracking-tight truncate">Scarpa</h1>
      </div>
    </div>
  )
}

const PILLOLA = 'px-2.5 py-0.5 rounded-full border text-[12px] font-bold'

export function SchedaModelloUI({ modello, staff, curaCatalogo, onCeLho, onModifica, onCaricaFoto, caricandoFoto, avvisoFoto, onPaginaUfficiale }) {
  const tipo = TIPI_SCARPA.find(t => t.valore === modello.tipo)
  const livello = LIVELLI.find(l => l.valore === modello.livello)
  return (
    <div className="cascata max-w-2xl mx-auto flex flex-col gap-4 mt-2">
      <div className="rounded-3xl bg-[#1e1e1e] flex items-center justify-center p-4">
        <FotoScarpa url={modello.foto_url} tipo={modello.tipo} alt={`${modello.marca} ${modello.modello}`}
          className="h-[220px] w-full object-contain" />
      </div>
      <div>
        <p className="text-[13px] font-bold text-muted">{modello.marca}</p>
        <h2 className="font-black text-[28px] leading-tight text-white">{modello.modello}</h2>
        {(tipo || livello) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {tipo && <span className={`${PILLOLA} text-gray-300 border-white/[.12] bg-white/[.05]`}>{tipo.etichetta}</span>}
            {livello && <span className={`${PILLOLA} ${livello.classe}`}>{livello.etichetta}</span>}
          </div>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-2.5">
        {righeCaratteristiche(modello).map(r => (
          <div key={r.chiave} className="bg-white/[.035] rounded-[16px] px-3.5 py-3">
            <dt className={LABEL}>{r.etichetta}</dt>
            <dd className="mt-1 text-[15px] font-extrabold text-white">{r.valore}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2.5">
        {!staff && (
          <button type="button" onClick={onCeLho} className={`${BOTTONE_BRAND} inline-flex items-center justify-center gap-2`}>
            <Footprints size={17} aria-hidden="true" />Ce l'ho
          </button>
        )}
        {curaCatalogo && (
          <>
            <button type="button" onClick={onModifica} className={`${BOTTONE_QUIETO} inline-flex items-center justify-center gap-2`}>
              <Pencil size={17} aria-hidden="true" />Modifica
            </button>
            <BottoneFoto onScelta={onCaricaFoto} disabled={caricandoFoto}>{caricandoFoto ? 'Carico…' : 'Carica foto'}</BottoneFoto>
            {avvisoFoto && <p role="status" className="text-[12.5px] font-medium text-muted">{avvisoFoto}</p>}
          </>
        )}
        {modello.url_ufficiale && (
          <button type="button" onClick={onPaginaUfficiale} className={`${BOTTONE_QUIETO} inline-flex items-center justify-center gap-2`}>
            <ExternalLink size={17} aria-hidden="true" />Pagina ufficiale
          </button>
        )}
      </div>
      {modello.foto_url && <p className="text-[12px] font-medium text-muted text-center">Foto: © del marchio</p>}
    </div>
  )
}
