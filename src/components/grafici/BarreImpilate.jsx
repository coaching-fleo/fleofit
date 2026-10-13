// Colonne impilate per settimana (pagina Analisi): i minuti per categoria.
// Un'intercapedine di 2px nel colore della superficie separa le parti: niente
// bordi disegnati attorno alle barre.

const L = 600, A = 180, M = { su: 12, giu: 26, sx: 40, dx: 12 }
const STACCO = 2

export default function BarreImpilate({ titolo, colonne = [], unita = 'min' }) {
  const totali = colonne.map(c => c.parti.reduce((s, p) => s + (p.valore || 0), 0))
  const massimo = Math.max(...totali, 0)
  if (massimo === 0) {
    return <p className="text-sm text-gray-500 py-10 text-center">Nessun allenamento chiuso nel periodo</p>
  }
  const fascia = (L - M.sx - M.dx) / colonne.length
  const larga = Math.min(24, fascia * 0.6)
  const alto = A - M.su - M.giu
  const scala = (v) => (v / massimo) * alto

  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-auto" role="img">
      <title>{titolo}</title>
      <line x1={M.sx} x2={L - M.dx} y1={A - M.giu} y2={A - M.giu} stroke="#2a2a2a" strokeWidth="1" />
      <text x={M.sx - 6} y={M.su + 4} textAnchor="end" fontSize="12" fill="#6b7280">{Math.round(massimo)}</text>
      {colonne.map((c, i) => {
        const cx = M.sx + fascia * i + (fascia - larga) / 2
        let base = A - M.giu
        return (
          <g key={i}>
            {c.parti.filter(p => p.valore > 0).map(p => {
              const h = Math.max(scala(p.valore) - STACCO, 1)
              base -= h + STACCO
              return (
                <rect key={p.nome} data-parte x={cx} y={base + STACCO} width={larga} height={h} rx="2" fill={p.colore}>
                  <title>{`${c.etichetta} · ${p.nome}: ${Math.round(p.valore)} ${unita}`}</title>
                </rect>
              )
            })}
            {(colonne.length <= 12 || i === 0 || i === colonne.length - 1) && (
              <text x={cx + larga / 2} y={A - 8} textAnchor="middle" fontSize="12" fill="#6b7280">{c.etichetta}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
