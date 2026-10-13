// La mappa atleti × settimane (pagina Analisi): una cella per settimana,
// colore = aderenza. Una sola tinta, il giallo del marchio, dal velo al pieno.
//
// ⚠️ Quattro stati, quattro aspetti: senza dati prima di arrivare (vuota, solo
// il bordo), settimana senza allenamenti (grigio), pausa (righe oblique), dato
// vero (giallo). Il nome dello stato è anche nell'`aria-label`: il colore non
// è l'unico canale.

import { BRAND, conVelo } from '../../lib/colori'

const LATO = 22, STACCO = 3

function aspetto({ valore, stato }) {
  if (stato === 'pausa') return { fill: 'url(#mappa-pausa)', stroke: 'none' }
  if (stato === 'prima') return { fill: 'none', stroke: '#2a2a2a' }
  if (stato === 'vuota') return { fill: '#2a2a2a', stroke: 'none' }
  return { fill: conVelo(BRAND, 0.15 + 0.85 * (valore / 100)), stroke: 'none' }
}

function testo(nome, colonna, cella) {
  if (cella.stato === 'pausa') return `${nome} · ${colonna}: in pausa`
  if (cella.stato === 'prima' || cella.stato === 'vuota') return `${nome} · ${colonna}: nessun dato`
  return `${nome} · ${colonna}: ${cella.valore}%`
}

export default function Mappa({ righe = [], colonne = [], onScegli }) {
  const largo = colonne.length * (LATO + STACCO)
  return (
    <div className="overflow-x-auto hide-scrollbar">
      <svg width="0" height="0" className="absolute">
        <defs>
          <pattern id="mappa-pausa" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#1e1e1e" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#4b5563" strokeWidth="2" />
          </pattern>
        </defs>
      </svg>
      <div className="grid gap-y-1" style={{ gridTemplateColumns: `minmax(120px, 180px) ${largo}px` }}>
        {righe.map(r => (
          <div key={r.id || r.nome} className="contents">
            <button type="button" onClick={() => onScegli?.(r.id)}
              className="text-left text-sm text-gray-300 hover:text-white truncate pr-3">
              {r.nome}
            </button>
            <svg width={largo} height={LATO} role="img" aria-label={`Aderenza di ${r.nome}`}>
              {r.celle.map((c, i) => {
                const etichetta = testo(r.nome, colonne[i], c)
                return (
                  <rect key={i} data-cella x={i * (LATO + STACCO)} y="0" width={LATO} height={LATO} rx="4"
                    {...aspetto(c)} aria-label={etichetta}>
                    <title>{etichetta}</title>
                  </rect>
                )
              })}
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}
