// Un punto per atleta su una scala orizzontale, con la fascia «sana»
// evidenziata (pagina Analisi): ACWR, scarto RPE. Chi non ha un valore ha
// «—» invece di un punto inventato.

// Coordinate in PERCENTUALE e niente viewBox: con un viewBox l'SVG si
// rimpicciolisce con la colonna e il punto diventa un granello.
const ALTA = 26

export default function Striscia({ titolo, voci = [], fascia, minimo = 0, massimo = 2.5, colore = '#f1ba17', formato = (v) => String(v).replace('.', ',') }) {
  const x = (v) => ((Math.min(Math.max(v, minimo), massimo) - minimo) / (massimo - minimo)) * 100
  const pc = (n) => `${n}%`
  return (
    <div role="img" aria-label={titolo} className="space-y-1">
      {voci.map(v => (
        <div key={v.id || v.nome} className="grid items-center gap-3" style={{ gridTemplateColumns: 'minmax(120px, 180px) 1fr 48px' }}>
          <span className="text-sm text-gray-300 truncate">{v.nome}</span>
          <svg width="100%" height={ALTA} className="overflow-visible">
            <line x1="0" x2="100%" y1={ALTA / 2} y2={ALTA / 2} stroke="#383838" strokeWidth="1" />
            {fascia && (
              <rect data-fascia x={pc(x(fascia[0]))} y="4" width={pc(x(fascia[1]) - x(fascia[0]))} height={ALTA - 8} rx="4" fill="#ffffff" fillOpacity="0.08" />
            )}
            {v.valore != null && (
              <circle data-punto cx={pc(x(v.valore))} cy={ALTA / 2} r="5" fill={colore} stroke="#1e1e1e" strokeWidth="2">
                <title>{`${v.nome}: ${formato(v.valore)}`}</title>
              </circle>
            )}
          </svg>
          <span className="text-sm text-right tabular-nums text-gray-400">{v.valore != null ? formato(v.valore) : '—'}</span>
        </div>
      ))}
    </div>
  )
}
