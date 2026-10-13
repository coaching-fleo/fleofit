// Lo storico di un esercizio, nella pagina Analisi con un atleta scelto
// (piano desktop fase 2, #2). Il calcolo sta in `src/lib/storicoEsercizio.js`.
//
// ⚠️ «Prescritto» e «dichiarato» stanno in due colonne e non si mescolano: il
// primo è ciò che hai scritto nel workout, il secondo ciò che l'atleta ha
// raccontato nelle note (letto da «Dalle note»). Se le note non ci sono, la
// seconda colonna resta «—» e il resto funziona uguale.

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { BRAND } from '../lib/colori'
import { eserciziDi, storicoEsercizio } from '../lib/storicoEsercizio'
import Linea from './grafici/Linea'

const virgola = (n) => String(n).replace('.', ',')

const prescritto = (s) => [
  s.kg != null ? `${virgola(s.kg)} kg` : null,
  s.metri != null ? `${s.metri} m` : null,
  s.reps != null ? `${s.reps} rip.` : null,
].filter(Boolean).join(' · ') || '—'

/** Il valore di un risultato come l'ha scritto l'atleta: la citazione, che non tradisce. */
const dichiarato = (s) => (s.risultati.length ? s.risultati.map(r => `«${r.citazione}»`).join(' ') : '—')

export default function StoricoEsercizio({ righe = [], estratti = [] }) {
  const esercizi = useMemo(() => eserciziDi(righe), [righe])
  const [scelto, setScelto] = useState(null)
  const nome = scelto && esercizi.some(e => e.nome === scelto) ? scelto : esercizi[0]?.nome
  const storico = useMemo(() => (nome ? storicoEsercizio(righe, nome, estratti) : []), [righe, nome, estratti])

  if (esercizi.length === 0) {
    return <p className="text-sm text-gray-500 py-6 text-center">Nessun esercizio nelle sedute chiuse del periodo</p>
  }

  // Il grafico segue il carico; senza kg, la distanza; senza nessuno dei due, solo la tabella.
  const misura = storico.some(s => s.kg != null) ? 'kg' : storico.some(s => s.metri != null) ? 'metri' : null
  const punti = misura ? storico.map(s => ({ etichetta: format(parseISO(s.data), 'd MMM', { locale: it }), valore: s[misura] })) : []
  const tetto = misura ? Math.ceil(Math.max(...storico.map(s => s[misura] ?? 0)) * 1.2 / 2) * 2 : 0

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-500">Esercizio</span>
        <select value={nome} onChange={(e) => setScelto(e.target.value)}
          className="h-10 px-3 rounded-xl bg-[#111] border border-[#333] text-sm text-white">
          {esercizi.map(e => <option key={e.nome} value={e.nome}>{e.nome} · {e.sedute} {e.sedute === 1 ? 'seduta' : 'sedute'}</option>)}
        </select>
      </label>
      {misura && tetto > 0 && (
        <Linea titolo={`${nome}: ${misura === 'kg' ? 'carico prescritto' : 'distanza prescritta'}`}
          colore={BRAND} punti={punti} massimo={tetto} unita={misura === 'kg' ? ' kg' : ' m'} />
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th scope="col" className="font-semibold pb-2 pr-3">Seduta</th>
            <th scope="col" className="font-semibold pb-2 pr-3">Prescritto</th>
            <th scope="col" className="font-semibold pb-2">Dichiarato nelle note</th>
          </tr>
        </thead>
        <tbody>
          {[...storico].reverse().map(s => (
            <tr key={s.id} className="border-t border-[#2a2a2a] text-gray-300">
              <td className="py-2.5 pr-3 tabular-nums">{format(parseISO(s.data), 'EEE d MMM', { locale: it })}</td>
              <td className="py-2.5 pr-3 tabular-nums">{prescritto(s)}</td>
              <td className="py-2.5 text-gray-400">{dichiarato(s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
