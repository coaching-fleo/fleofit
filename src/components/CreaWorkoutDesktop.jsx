// CreaWorkoutDesktop.jsx — la colonna di destra del builder sulla versione desktop.
//
// Bozza «3 · Crea workout» approvata il 13/10/2026: i blocchi a sinistra, e qui
// tutto quello che sul telefono sta nel passo 1 o in cima al passo 2 —
// categoria, nome, data, riepilogo, intensità — più i tipi di blocco e il
// salvataggio. Sul desktop il passo 1 non esiste: c'è spazio per vedere tutto.
//
// ⚠️ SOLA PRESENTAZIONE, e importata SOLO da CreateWorkout.jsx. Non va dentro
// CreaWorkoutUI.jsx: quello è un chunk condiviso con la scheda workout e deve
// restare leggero (CLAUDE.md §2).

import { Dices, Plus } from 'lucide-react'
import CustomDatePicker from './CustomDatePicker'
import { blockHint } from '../lib/blockHints'

const TIPI_BLOCCO = ['WarmUp', 'Cash In', 'ON/OFF', 'EMOM', 'AMRAP', 'For Time', 'Interval', 'Rest', 'Cash Out']

const ETICHETTA = 'text-xs font-bold text-gray-400'

export default function CreaWorkoutDesktop({
  categorie, categoria, onCategoria,
  nome, onNome, segnapostoNome, onAltroNome,
  data, onData,
  riepilogo, intensita,
  onAggiungiBlocco,
  azioni,
}) {
  return (
    <aside aria-label="Impostazioni del workout"
      className="w-[340px] shrink-0 sticky top-6 flex flex-col gap-4 max-h-[calc(100vh-48px)] overflow-y-auto pb-6">

      <section className="rounded-3xl bg-[#1e1e1e] border border-[#2a2a2a] p-5 flex flex-col gap-4">
        <div role="group" aria-label="Categoria" className="flex gap-1 bg-[#111] border border-[#333] p-1 rounded-2xl">
          {categorie.map(c => {
            const attiva = c.id === categoria
            return (
              <button key={c.id} type="button" onClick={() => onCategoria(c.id)} aria-pressed={attiva}
                style={attiva ? { background: c.colore, color: c.testoSuColore } : undefined}
                className={`flex-1 h-9 rounded-xl text-[13px] font-extrabold transition ${attiva ? '' : 'text-gray-400 hover:text-white'}`}>
                {c.nome}
              </button>
            )
          })}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={ETICHETTA}>Nome</span>
          <span className="flex items-center gap-2 h-11 px-3.5 rounded-xl bg-[#111] border border-[#333]">
            <input value={nome} onChange={(e) => onNome(e.target.value)} placeholder={segnapostoNome}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-white placeholder:text-[#6b7080]" />
            {onAltroNome && (
              <button type="button" aria-label="Un altro nome" onClick={onAltroNome}
                className="shrink-0 p-1 rounded-full text-gray-400 hover:text-white transition">
                <Dices size={17} />
              </button>
            )}
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={ETICHETTA}>Data</span>
          <span className="h-11 px-3.5 rounded-xl bg-[#111] border border-[#333] flex items-center">
            <CustomDatePicker date={data} onChange={onData} placeholder="Scegli la data" className="text-sm font-bold" />
          </span>
        </div>
      </section>

      {riepilogo}
      {intensita}

      {onAggiungiBlocco && (
        <section className="rounded-3xl bg-[#1e1e1e] border border-[#2a2a2a] p-4 flex flex-col gap-2">
          <h2 className="px-1 text-sm font-extrabold text-white">Aggiungi blocco</h2>
          <div className="grid grid-cols-2 gap-1.5">
            {TIPI_BLOCCO.map(t => (
              <button key={t} type="button" onClick={() => onAggiungiBlocco(t)} title={blockHint(t)}
                className="flex items-center gap-2 h-10 px-3 rounded-xl bg-[#2a2a2a] border border-[#383838] text-[13px] font-bold text-white
                           transition hover:border-brand hover:text-brand">
                <Plus size={14} className="text-brand shrink-0" aria-hidden="true" />{t}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2.5">{azioni}</div>
      <p className="px-1 text-xs text-gray-500">⌘S per salvare</p>
    </aside>
  )
}
