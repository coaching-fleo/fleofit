// Una linea nel tempo (pagina Analisi). SVG a mano, nessuna libreria: il
// grafico vive in un chunk pigro, ma una libreria di grafici peserebbe più
// della pagina intera (CLAUDE.md §9, «mai una libreria in testa a un file»).
//
// ⚠️ Un valore `null` INTERROMPE la linea: una settimana senza dati disegnata
// a zero è un crollo che non è successo.

const L = 600, A = 180, M = { su: 12, giu: 26, sx: 32, dx: 12 }

export default function Linea({ titolo, punti = [], colore, massimo = 100, unita = '%' }) {
  const validi = punti.filter(p => p.valore != null)
  if (validi.length === 0) {
    return <p className="text-sm text-gray-500 py-10 text-center">Nessun dato nel periodo</p>
  }
  const passo = (L - M.sx - M.dx) / Math.max(punti.length - 1, 1)
  const x = (i) => M.sx + i * passo
  const y = (v) => M.su + (1 - Math.min(v, massimo) / massimo) * (A - M.su - M.giu)

  // Tratti continui fra i valori presenti.
  const tratti = []
  let corrente = []
  punti.forEach((p, i) => {
    if (p.valore == null) { if (corrente.length) tratti.push(corrente); corrente = [] }
    else corrente.push([x(i), y(p.valore)])
  })
  if (corrente.length) tratti.push(corrente)

  const griglia = [0, massimo / 2, massimo]
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-auto" role="img">
      <title>{titolo}</title>
      {griglia.map(v => (
        <g key={v}>
          <line x1={M.sx} x2={L - M.dx} y1={y(v)} y2={y(v)} stroke="#2a2a2a" strokeWidth="1" />
          <text x={M.sx - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#6b7280">{v}</text>
        </g>
      ))}
      {tratti.filter(t => t.length > 1).map((t, i) => (
        <path key={i} data-linea d={`M${t.map(([a, b]) => `${a},${b}`).join('L')}`}
          fill="none" stroke={colore} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {punti.map((p, i) => (
        <g key={i}>
          {p.valore != null && (
            <circle cx={x(i)} cy={y(p.valore)} r="4" fill={colore} stroke="#1e1e1e" strokeWidth="2">
              <title>{`${p.etichetta}: ${p.valore}${unita}`}</title>
            </circle>
          )}
          {(i === 0 || i === punti.length - 1 || punti.length <= 12) && (
            <text x={x(i)} y={A - 8} textAnchor="middle" fontSize="10" fill="#6b7280">{p.etichetta}</text>
          )}
        </g>
      ))}
    </svg>
  )
}
