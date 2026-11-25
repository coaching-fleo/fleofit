// SedutaUI.jsx — i pezzi che raccontano una seduta (25/11/2026).
//
// Nati nel foglio veloce di «In allenamento oggi» (FoglioSedutaOggi) e portati
// nella scheda atleta col ridisegno dello stesso giorno: i NUMERI grandi
// (durata, intensità con le sue dieci tacche, RPE) e la SEQUENZA dei blocchi
// (un puntino per tappa nel colore della corsia, uniti da un filo).
// DESIGN.md, «La Testata con Foto» e «I numeri e la sequenza».

import { conVelo } from '../lib/colori'

/** L'etichetta piccola sopra un numero. */
export const ETICHETTA_NUMERO = 'text-[11px] font-bold uppercase tracking-[.1em] text-muted'
const CIFRA = 'block mt-1 text-[34px] leading-none font-black tracking-[-.04em] text-white tabular-nums'
const UNITA = 'text-base font-extrabold tracking-normal text-gray-400'
/** Riscaldamento e recupero sono i passaggi «leggeri»: puntino neutro, il resto prende la corsia. */
const LEGGERI = new Set(['Riscaldamento', 'Recupero', 'Defaticamento'])

/** Durata, intensità con le sue dieci tacche, e l'RPE se c'è. Niente celle vuote. */
export function NumeriSeduta({ minuti, intensita, rpe, colore, compatto = false }) {
  const int = intensita ? Math.round(intensita) : null
  if (!minuti && !int && rpe == null) return null
  const cifra = compatto ? CIFRA.replace('text-[34px]', 'text-[28px]') : CIFRA
  return (
    <div className="flex items-stretch [&>*+*]:border-l [&>*+*]:border-white/[.08] [&>*+*]:pl-4 [&>*]:pr-4 [&>*:last-child]:pr-0">
      {minuti > 0 && (
        <div className="shrink-0">
          <span className={ETICHETTA_NUMERO}>Durata</span>
          <b className={cifra}>{minuti}<small className={`ml-1 ${UNITA}`}>min</small></b>
        </div>
      )}
      {int && (
        <div className="flex-1 min-w-0">
          <span className={ETICHETTA_NUMERO}>Intensità</span>
          <b className={cifra}>{int}<small className={UNITA}>/10</small></b>
          <span className="mt-2 flex gap-[3px]" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < int ? colore : 'rgba(255,255,255,.1)' }} />
            ))}
          </span>
        </div>
      )}
      {rpe != null && (
        <div className="shrink-0">
          <span className={ETICHETTA_NUMERO}>RPE</span>
          <b className={cifra}>{rpe}<small className={UNITA}>/10</small></b>
        </div>
      )}
    </div>
  )
}

/** I blocchi in fila, come si fanno: un puntino per tappa, unite da un filo. */
export function SequenzaSeduta({ righe, colore, massimo = 6 }) {
  const altre = righe.length - massimo
  return (
    <ol className="flex flex-col">
      {righe.slice(0, massimo).map((r, i, lista) => {
        const ultima = i === lista.length - 1 && altre <= 0
        return (
          <li key={i} className="relative grid grid-cols-[18px_1fr] gap-x-3 pb-3.5 last:pb-0">
            {!ultima && <span className="absolute left-[8.5px] top-[18px] bottom-0 w-px bg-white/[.12]" aria-hidden="true" />}
            <span className="mt-[5px] w-[18px] h-[18px] rounded-full grid place-items-center" aria-hidden="true">
              <i className="w-2.5 h-2.5 rounded-full"
                style={LEGGERI.has(r.titolo) ? { background: 'rgba(255,255,255,.3)' } : { background: colore, boxShadow: `0 0 8px ${conVelo(colore, 0.5)}` }} />
            </span>
            <span className="min-w-0">
              {/* I dettagli vanno a capo sotto il nome: sulla stessa riga «800m 4:00 /km + 2 min
                  Camminata» si mangiava il nome del blocco. */}
              <b className="block text-[15px] font-extrabold text-white">{r.titolo}</b>
              {r.sotto && <span className="block mt-0.5 text-[13px] font-bold text-gray-300 tabular-nums">{r.sotto}</span>}
              {r.esercizi && <span className="block mt-0.5 text-[13px] text-muted truncate">{r.esercizi}</span>}
            </span>
          </li>
        )
      })}
      {altre > 0 && (
        <li className="grid grid-cols-[18px_1fr] gap-x-3">
          <span />
          <span className="text-[13px] font-bold text-muted">+{altre} {altre === 1 ? 'altro' : 'altri'}</span>
        </li>
      )}
    </ol>
  )
}
