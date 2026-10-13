// La presentazione della pagina Analisi (solo desktop, solo coach). Nessun
// calcolo qui: i numeri arrivano già fatti da `src/lib/analisi.js`.
//
// ⚠️ Il testo non prende mai il colore dei dati: i valori stanno in bianco e
// grigio, l'identità di una serie la porta il pallino accanto (dataviz).

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Printer, X } from 'lucide-react'
import { CORSIA } from '../lib/categorie'
import { quandoFa } from '../lib/tabellaAtleti'

const virgola = (n) => String(n).replace('.', ',')
const numero = (n) => (n == null ? '—' : n.toLocaleString('it-IT'))

/** Un gruppo di bottoni: periodo e categoria. */
function Scelta({ etichetta, voci, valore, onCambia }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-gray-500">{etichetta}</span>
      <div className="flex bg-[#111] p-1 rounded-xl border border-[#333]">
        {voci.map(v => (
          <button key={v.valore ?? 'tutte'} type="button" onClick={() => onCambia(v.valore)}
            aria-pressed={valore === v.valore}
            className={`px-3 h-8 rounded-lg text-xs font-bold transition-colors ${
              valore === v.valore ? 'bg-[#2a2a2a] text-white' : 'text-gray-400 hover:text-white'}`}>
            {v.testo}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TestataAnalisi({ titolo, sottotitolo, periodi, periodo, onPeriodo, categorie, categoria, onCategoria, atleta, onTogliAtleta, onApriScheda, onEsporta, onStampa }) {
  return (
    <header className="pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Analisi</p>
        <h1 className="text-3xl font-black tracking-tight text-white">{titolo}</h1>
        <p className="text-sm text-gray-400 mt-1">{sottotitolo}</p>
        {atleta && (
          <div className="flex gap-2 mt-3 print:hidden">
            <button type="button" onClick={onTogliAtleta}
              className="h-8 px-3 rounded-full bg-[#2a2a2a] text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1.5">
              <X size={14} aria-hidden="true" /> Tutta la squadra
            </button>
            <button type="button" onClick={onApriScheda}
              className="h-8 px-3 rounded-full border border-[#333] text-xs font-bold text-gray-300 hover:text-white">
              Apri la scheda
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 print:hidden">
        {onEsporta && (
          <div className="flex gap-2">
            <button type="button" onClick={onEsporta}
              className="h-10 px-3.5 rounded-xl border border-[#333] text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1.5">
              <Download size={14} aria-hidden="true" /> Esporta CSV
            </button>
            <button type="button" onClick={onStampa}
              className="h-10 px-3.5 rounded-xl border border-[#333] text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1.5">
              <Printer size={14} aria-hidden="true" /> Stampa
            </button>
          </div>
        )}
        <Scelta etichetta="Periodo" valore={periodo} onCambia={onPeriodo}
          voci={periodi.map(p => ({ valore: p, testo: `${p} sett.` }))} />
        <Scelta etichetta="Categoria" valore={categoria} onCambia={onCategoria}
          voci={[{ valore: null, testo: 'Tutte' }, ...categorie.map(c => ({ valore: c, testo: CORSIA[c].etichetta }))]} />
      </div>
    </header>
  )
}

/** Lo scarto dal periodo precedente, in grigio: è un fatto, non un giudizio. */
function Scarto({ scarto, unita }) {
  if (scarto == null) return <span className="text-xs text-gray-600">nessun confronto</span>
  if (scarto === 0) return <span className="text-xs text-gray-500">come il periodo prima</span>
  const Freccia = scarto > 0 ? ArrowUp : ArrowDown
  const testo = unita === '%' ? `${Math.abs(scarto)}%` : `${virgola(Math.abs(scarto))} ${Math.abs(scarto) === 1 ? 'punto' : 'punti'}`
  return (
    <span className="text-xs text-gray-400 flex items-center gap-1">
      <Freccia size={12} aria-hidden="true" />{testo} sul periodo prima
    </span>
  )
}

export function NumeriAnalisi({ numeri }) {
  const voci = [
    { chiave: 'sedute', titolo: 'Sedute chiuse', testo: numero(numeri.sedute?.valore) },
    { chiave: 'aderenza', titolo: 'Aderenza', testo: numeri.aderenza?.valore == null ? '—' : `${numeri.aderenza.valore}%` },
    { chiave: 'ore', titolo: 'Ore di allenamento', testo: numeri.ore?.valore == null ? '—' : virgola(numeri.ore.valore) },
    { chiave: 'rpeMedio', titolo: 'RPE medio', testo: numeri.rpeMedio?.valore == null ? '—' : virgola(numeri.rpeMedio.valore) },
    {
      chiave: 'attivi', titolo: 'Atleti attivi',
      testo: numeri.attivi?.valore == null ? '—' : `${numeri.attivi.valore} su ${numeri.seguiti?.valore ?? 0}`,
    },
  ]
  return (
    <section className="grid grid-cols-5 gap-3">
      {voci.map(v => (
        <div key={v.chiave} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500">{v.titolo}</p>
          <p className="text-3xl font-black tracking-tight text-white mt-1 tabular-nums">{v.testo}</p>
          <div className="mt-1"><Scarto {...numeri[v.chiave]} /></div>
        </div>
      ))}
    </section>
  )
}

/** Il contenitore di un grafico, con titolo, legenda e una riga di spiegazione. */
export function Riquadro({ titolo, spiega, legenda, className = '', children }) {
  return (
    <section className={`bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-5 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base font-extrabold text-white">{titolo}</h2>
          {spiega && <p className="text-xs text-gray-500 mt-0.5">{spiega}</p>}
        </div>
        {legenda && (
          <ul className="flex flex-wrap gap-3">
            {legenda.map(l => (
              <li key={l.nome} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.colore }} aria-hidden="true" />{l.nome}
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
    </section>
  )
}

const COLONNE = [
  { chiave: 'nome', titolo: 'Atleta', testo: (r) => r.nome },
  { chiave: 'sedute', titolo: 'Sedute', testo: (r) => numero(r.sedute) },
  { chiave: 'aderenza', titolo: 'Aderenza', testo: (r) => (r.aderenza == null ? '—' : `${r.aderenza}%`) },
  { chiave: 'ore', titolo: 'Ore', testo: (r) => (r.ore == null ? '—' : virgola(r.ore)) },
  { chiave: 'rpeMedio', titolo: 'RPE medio', testo: (r) => (r.rpeMedio == null ? '—' : virgola(r.rpeMedio)) },
  { chiave: 'scartoRpe', titolo: 'RPE vs previsto', testo: (r) => (r.scartoRpe == null ? '—' : `${r.scartoRpe > 0 ? '+' : ''}${virgola(r.scartoRpe)}`) },
  { chiave: 'acwr', titolo: 'ACWR', testo: (r) => (r.acwr == null ? '—' : virgola(r.acwr)) },
  { chiave: 'comeSta', titolo: 'Come sta', testo: (r) => (r.comeSta == null ? '—' : `${virgola(r.comeSta)}/5`) },
  { chiave: 'ultima', titolo: 'Ultima seduta', testo: (r) => quandoFa(r.ultima) || '—' },
]

/**
 * La tabella degli atleti, ordinabile per colonna. I valori mancanti stanno
 * sempre in fondo, in qualunque verso: un «—» in cima non dice niente.
 */
export function TabellaAnalisi({ righe, onScegli }) {
  const [ordine, setOrdine] = useState({ chiave: 'aderenza', verso: 1 })
  const ordinate = useMemo(() => [...righe].sort((a, b) => {
    const va = a[ordine.chiave], vb = b[ordine.chiave]
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    const confronto = typeof va === 'string' ? va.localeCompare(vb) : va - vb
    return confronto * ordine.verso
  }), [righe, ordine])

  const ordina = (chiave) => setOrdine(o => ({ chiave, verso: o.chiave === chiave ? -o.verso : 1 }))

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500">
          {COLONNE.map(c => (
            <th key={c.chiave} scope="col" className="font-semibold pb-2 pr-3"
              aria-sort={ordine.chiave === c.chiave ? (ordine.verso > 0 ? 'ascending' : 'descending') : 'none'}>
              <button type="button" onClick={() => ordina(c.chiave)} className="flex items-center gap-1 hover:text-white">
                {c.titolo}
                {ordine.chiave === c.chiave
                  ? (ordine.verso > 0 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)
                  : <ChevronsUpDown size={12} aria-hidden="true" className="opacity-40" />}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ordinate.map(r => (
          <tr key={r.id} onClick={() => onScegli(r.id)}
            className="border-t border-[#2a2a2a] cursor-pointer hover:bg-white/[.03] text-gray-300">
            {COLONNE.map(c => (
              <td key={c.chiave} className={`py-2.5 pr-3 ${c.chiave === 'nome' ? 'font-bold text-white' : 'tabular-nums'}`}>
                {c.testo(r)}
                {c.chiave === 'nome' && r.pausa && <span className="ml-2 text-xs font-semibold text-gray-500">in pausa</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ScheletroAnalisi() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="grid grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-[104px] rounded-2xl bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-[260px] rounded-3xl bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />
        <div className="h-[260px] rounded-3xl bg-[#1e1e1e] border border-[#2a2a2a] animate-pulse" />
      </div>
    </div>
  )
}
