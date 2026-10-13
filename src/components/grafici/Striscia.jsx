// Un punto per atleta su una scala orizzontale, con la fascia «sana»
// evidenziata (pagina Analisi): ACWR, scarto RPE. Chi non ha un valore ha
// «—» invece di un punto inventato.

const L = 400, ALTA = 26

export default function Striscia({ titolo, voci = [], fascia, minimo = 0, massimo = 2.5, colore = '#f1ba17', formato = (v) => String(v).replace('.', ',') }) {
  const x = (v) => ((Math.min(Math.max(v, minimo), massimo) - minimo) / (massimo - minimo)) * L
  return (
    <div role="img" aria-label={titolo} className="space-y-1">
      {voci.map(v => (
        <div key={v.id || v.nome} className="grid items-center gap-3" style={{ gridTemplateColumns: 'minmax(120px, 180px) 1fr 48px' }}>
          <span className="text-sm text-gray-300 truncate">{v.nome}</span>
          <svg viewBox={`0 0 ${L} ${ALTA}`} className="w-full h-auto">
            <line x1="0" x2={L} y1={ALTA / 2} y2={ALTA / 2} stroke="#2a2a2a" strokeWidth="1" />
            {fascia && (
              <rect data-fascia x={x(fascia[0])} y="4" width={x(fascia[1]) - x(fascia[0])} height={ALTA - 8} rx="4" fill="#ffffff" fillOpacity="0.06" />
            )}
            {v.valore != null && (
              <circle data-punto cx={x(v.valore)} cy={ALTA / 2} r="5" fill={colore} stroke="#1e1e1e" strokeWidth="2">
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
